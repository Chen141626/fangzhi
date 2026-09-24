import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
    ProgressBar,
    Sprite,
    UITransform,
    VerticalTextAlignment,
    warn,
} from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { GameStorage } from '../../core/GameStorage';
import { loadSpriteFrameCompat } from '../common/loadSpriteFrameCompat';
import { BattleAnimationSequence } from './BattleAnimationConfig';
import { BattleAnimationPlayer } from './BattleAnimationPlayer';
import { BATTLE_BUFF_CONFIG } from './BattleBuffConfig';
import {
    BattleUnitConfig,
    validateBattleDemoConfig,
} from './BattleDemoConfig';
import {
    BattleActionDecision,
    BattleFlowController,
    BattleStepResult,
    BattleTurnPreview,
    cloneBattleUnits,
} from './BattleFlowController';
import { BattleCamp, BattleLogEntry, BattleUnitState } from './BattleEffectTypes';
import {
    BattleOpenArgs,
    ResolvedBattleSession,
    resolveBattleSession,
} from './BattleRosterService';
import { BattleRewardService, BattleSettlement } from './BattleRewardService';
import { validateBattleSkillConfig } from './BattleSkillConfig';
import {
    BATTLE_STAGE_CONFIG,
    BattleStageConfig,
    validateBattleStageConfig,
} from './BattleStageConfig';

const { ccclass, menu } = _decorator;

interface BattleUnitView {
    item: Node;
    overlay: Node;
    icon: Sprite | null;
    hpBar: ProgressBar | null;
    nameLabel: Label;
    hpLabel: Label;
    energyLabel: Label;
    buffLabel: Label;
    turnLabel: Label;
}

interface RuntimeButton {
    node: Node;
    label: Label;
}

interface BattleUnitStatistics {
    configId: string;
    name: string;
    camp: BattleCamp;
    damage: number;
    healing: number;
    damageTaken: number;
    kills: number;
    actions: number;
}

interface BattleReplayFrame {
    waveIndex: number;
    step: BattleStepResult;
}

const BATTLE_TUTORIAL_STORAGE_KEY = 'fangzhi.battle-tutorial-v1';
const BATTLE_LOG_PAGE_SIZE = 14;
const TUTORIAL_STEPS: readonly { title: string; body: string }[] = [
    {
        title: '战斗目标',
        body: '击败当前关卡的全部波次即可获胜。波次结束后，存活角色会保留生命、怒气和友方增益，并获得少量生命恢复。',
    },
    {
        title: '行动与怒气',
        body: '单位按照速度依次行动。普攻、主动技能和受到伤害都会回复怒气；怒气达到100后，绝技才会变为可用。',
    },
    {
        title: '手动操作',
        body: '点击“自动”可切换到手动模式。轮到己方时，先点击敌人或目标按钮选择目标，再选择技能；灰色技能表示冷却中或怒气不足。',
    },
    {
        title: '辅助功能',
        body: '暂停会冻结战斗，倍速可在1/2/4倍间切换，跳过会直接完成剩余波次。结算后可以查看详细日志或播放本场战斗回放。',
    },
];

const ANIMATION_PREVIEW_OPTIONS: readonly {
    sequence: BattleAnimationSequence;
    label: string;
}[] = [
    { sequence: 'idle', label: '待机' },
    { sequence: 'attack', label: '普攻' },
    { sequence: 'action', label: '技能' },
    { sequence: 'hit', label: '受击' },
    { sequence: 'death', label: '死亡' },
];

const ITEM_NAMES: Readonly<Record<string, string>> = {
    'currency.gold': '金币',
    'currency.jade': '仙玉',
    'currency.crystal': '仙晶',
    'consumable.qi-pill': '聚气丹',
    'item.reward-chest': '珍稀宝箱',
};

let battleSequence = 0;

function nextBattleId(stageId: string): string {
    battleSequence++;
    return `${stageId}-${Date.now().toString(36)}-${battleSequence.toString(36)}`;
}

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

/** battle.prefab 的战斗控制器，消费玩家阵容、关卡配置并完成奖励结算。 */
@ccclass('BattleMain')
@menu('Game/Battle/BattleMain')
export class BattleMain extends Component {
    private readonly _flow = new BattleFlowController();
    private readonly _animationPlayer = new BattleAnimationPlayer();
    private readonly _rewardService = new BattleRewardService();
    private readonly _unitViews = new Map<string, BattleUnitView>();
    private _openArgs: BattleOpenArgs = { selectStage: true };
    private _session: ResolvedBattleSession | null = null;
    private _battleId = '';
    private _settlement: BattleSettlement | null = null;
    private _backButton: Node | null = null;
    private _roundLabel: Label | null = null;
    private _stateLabel: Label | null = null;
    private _actionLabel: Label | null = null;
    private _resultLayer: Node | null = null;
    private _resultLabel: Label | null = null;
    private _restartButton: Node | null = null;
    private _nextStageButton: Node | null = null;
    private _stageSelectLayer: Node | null = null;
    private _stageSelectTitle: Label | null = null;
    private readonly _stageButtons = new Map<string, RuntimeButton>();
    private _helpButton: RuntimeButton | null = null;
    private _tutorialLayer: Node | null = null;
    private _tutorialTitle: Label | null = null;
    private _tutorialBody: Label | null = null;
    private _tutorialNextButton: RuntimeButton | null = null;
    private _tutorialStep = 0;
    private _tutorialVisible = false;
    private _pausedBeforeTutorial = false;
    private _logLayer: Node | null = null;
    private _logLabel: Label | null = null;
    private _logPageLabel: Label | null = null;
    private _logPage = 0;
    private _replayButton: RuntimeButton | null = null;
    private _detailLogButton: RuntimeButton | null = null;
    private _replayActive = false;
    private readonly _replayFrames: BattleReplayFrame[] = [];
    private readonly _battleLogLines: string[] = [];
    private _animationPreviewPanel: Node | null = null;
    private _animationPreviewToggleButton: Node | null = null;
    private _animationPreviewToggleLabel: Label | null = null;
    private _previewUnitButton: Node | null = null;
    private _previewUnitLabel: Label | null = null;
    private _previewSequenceButton: Node | null = null;
    private _previewSequenceLabel: Label | null = null;
    private _previewReplayButton: Node | null = null;
    private _controlPanel: Node | null = null;
    private _autoButton: RuntimeButton | null = null;
    private _pauseButton: RuntimeButton | null = null;
    private _speedButton: RuntimeButton | null = null;
    private _skipButton: RuntimeButton | null = null;
    private _turnOrderLabel: Label | null = null;
    private _manualPanel: Node | null = null;
    private _manualTargetButton: RuntimeButton | null = null;
    private readonly _manualSkillButtons: RuntimeButton[] = [];
    private _manualPreview: BattleTurnPreview | null = null;
    private _manualTargetIndex = 0;
    private _manualResolver: ((decision: BattleActionDecision) => void) | null = null;
    private _autoMode = true;
    private _paused = false;
    private _playbackSpeed = 1;
    private _waveIndex = 0;
    private _totalRounds = 0;
    private readonly _statistics = new Map<string, BattleUnitStatistics>();
    private _animationPreviewActive = false;
    private _previewUnitIndex = 0;
    private _previewSequenceIndex = 0;
    private _previewToken = 0;
    private _runToken = 0;
    private _loopRunning = false;

    protected onLoad(): void {
        validateBattleDemoConfig();
        validateBattleSkillConfig();
        validateBattleStageConfig();
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);
        this._backButton = findChild(this.node, 'btn_back');
        this._backButton?.on(Node.EventType.TOUCH_END, this.onBack, this);
        this.buildRuntimeHierarchy();
        this.bindUnitSlots();
    }

    /** Oops GUI 打开参数；阵容界面可传 stageId 与 allyInstanceIds。 */
    onAdded(params?: BattleOpenArgs): boolean {
        this._openArgs = params && typeof params === 'object' ? params : {};
        // 缓存页面再次打开时 onEnable 可能先执行，收到最新参数后重新开局并取消旧异步流程。
        if (this.node.activeInHierarchy && this._unitViews.size) this.restartBattle();
        return true;
    }

    protected onEnable(): void {
        this.restartBattle();
    }

    protected onDisable(): void {
        this.stopAutoBattle();
    }

    protected update(deltaTime: number): void {
        this._animationPlayer.update(deltaTime);
    }

    protected onDestroy(): void {
        this.stopAutoBattle();
        this._backButton?.off(Node.EventType.TOUCH_END, this.onBack, this);
        this._restartButton?.off(Node.EventType.TOUCH_END, this.restartBattle, this);
        this._nextStageButton?.off(Node.EventType.TOUCH_END, this.onNextStage, this);
        this._animationPreviewToggleButton?.off(
            Node.EventType.TOUCH_END, this.onAnimationPreviewToggle, this,
        );
        this._previewUnitButton?.off(Node.EventType.TOUCH_END, this.onPreviewUnitSwitch, this);
        this._previewSequenceButton?.off(Node.EventType.TOUCH_END, this.onPreviewSequenceSwitch, this);
        this._previewReplayButton?.off(Node.EventType.TOUCH_END, this.onPreviewReplay, this);
        this.cancelManualDecision();
    }

    /** 使用当前玩家阵容和关卡配置重新开战，也供结果面板按钮调用。 */
    restartBattle(): void {
        this.cancelManualDecision();
        this._tutorialVisible = false;
        if (this._tutorialLayer) this._tutorialLayer.active = false;
        this._replayActive = false;
        this._paused = false;
        this._animationPlayer.setPaused(false);
        this._animationPreviewActive = false;
        this._previewToken++;
        if (this._animationPreviewPanel) this._animationPreviewPanel.active = false;
        if (this._animationPreviewToggleLabel) this._animationPreviewToggleLabel.string = '动画预览';
        this.stopAutoBattle();
        const token = this._runToken;
        this._resultLayer && (this._resultLayer.active = false);
        if (this._openArgs.selectStage && !this._openArgs.stageId) {
            this.showStageSelection();
            return;
        }
        if (this._stageSelectLayer) this._stageSelectLayer.active = false;
        try {
            this._session = resolveBattleSession(this._openArgs);
        }
        catch (error) {
            warn(`[BattleMain] 战斗参数无效，已回退默认关卡：${String(error)}`);
            this._openArgs = {};
            this._session = resolveBattleSession();
        }
        this._battleId = nextBattleId(this._session.stage.id);
        this._settlement = null;
        this._waveIndex = 0;
        this._totalRounds = 0;
        this._statistics.clear();
        this._replayFrames.length = 0;
        this._battleLogLines.length = 0;
        this._battleLogLines.push(`【${this._session.stage.name}】战斗开始`);
        if (this._logLayer) this._logLayer.active = false;
        this.refreshControlLabels();
        for (const view of this._unitViews.values()) view.item.active = false;
        const startResult = this._flow.start(
            this._session.roster,
            this.getCurrentWaveMaxRounds(),
        );
        const firstWaveName = this._session.stage.waves?.[0]?.name ?? '战斗准备';
        this._battleLogLines.push(`【第1波：${firstWaveName}】`);
        for (const log of startResult.logs) this._battleLogLines.push(`  ${log.message}`);
        const portraitLoading = Promise.all([
            this.attachUnitsToViews('ally', this._session.allies, token),
            this.attachUnitsToViews('enemy', this._session.enemies, token),
        ]).then(() => undefined);
        this.renderAll(null);
        this.setActionText(`${this._session.stage.name} · 双方入场`, startResult.logs);
        if (this._roundLabel) this._roundLabel.string = this._session.stage.name;
        if (this._stateLabel) this._stateLabel.string = '动画资源加载中…';
        this.showTutorialIfNeeded();
        void this.prepareAndRunBattle(token, portraitLoading);
    }

    private async prepareAndRunBattle(token: number, portraitLoading: Promise<void>): Promise<void> {
        await Promise.all([
            portraitLoading,
            this._animationPlayer.preload([
                ...this._session?.allies.map((unit) => unit.configId) ?? [],
                ...this._session?.waves.flatMap((wave) => wave.map((unit) => unit.configId)) ?? [],
            ]),
        ]);
        if (!this.isCurrentRun(token)) return;
        this._animationPlayer.reset();
        const allyCount = this._session?.allies.length ?? 0;
        const enemyCount = this._session?.enemies.length ?? 0;
        const source = this._session?.usingFallbackAllies ? '体验阵容' : '玩家阵容';
        if (this._stateLabel) {
            this._stateLabel.string = `${this._autoMode ? '自动' : '手动'}战斗 · ${allyCount} vs ${enemyCount} · ${source}`;
        }
        await this.delay(350);
        if (!this.isCurrentRun(token)) return;
        await this.runBattleLoop(token);
    }

    private async runBattleLoop(token: number): Promise<void> {
        if (this._loopRunning || !this.isCurrentRun(token)) return;
        this._loopRunning = true;
        while (this.isCurrentRun(token)) {
            while (this.isCurrentRun(token) && this._flow.status === 'running') {
                await this.waitWhilePaused(token);
                if (!this.isCurrentRun(token)) return;
                const preview = this._flow.previewNextTurn();
                if (!preview) break;
                this.renderTurnOrder(preview);
                let decision: BattleActionDecision = {};
                if (!this._autoMode && preview.actor.camp === 'ally') {
                    decision = await this.requestManualDecision(preview, token);
                }
                if (!this.isCurrentRun(token)) return;
                const step = this._flow.step(decision);
                this.recordStatistics(step);
                this.recordReplayFrame(step);
                this.setActiveActor(step.actorId, step.beforeUnits);
                this.renderStep(step);
                await this.playBattleStep(step, token);
                if (!this.isCurrentRun(token)) return;
                this.renderAll(step.actorId, step.turnEndUnits);
                if (step.status === 'finished') break;
                await this.delay(160);
            }
            if (!this.isCurrentRun(token)) return;
            this._totalRounds += this._flow.round;
            if (this._flow.winner !== 'ally' || !this.hasNextWave()) break;
            await this.startNextWave(token);
        }
        if (this.isCurrentRun(token) && this._flow.status === 'finished') this.finishBattle();
    }

    private async playBattleStep(step: BattleStepResult, token: number): Promise<void> {
        const isCurrent = () => this.isCurrentRun(token);
        const actor = step.turnStartUnits.find((unit) => unit.id === step.actorId) ?? null;

        this.renderAll(step.actorId, step.turnStartUnits);
        if (step.turnStartLogs.length) {
            this.setActionText(`${actor?.name ?? '单位'}的回合开始`, step.turnStartLogs);
            await this._animationPlayer.playImpacts(
                step.turnStartLogs, 'none', null, step.actorId, isCurrent,
            );
        }
        if (!isCurrent()) return;

        if (actor && step.skill) {
            const { primaryLogs, reactionGroups } = this.splitActionLogs(step.actionLogs, actor.id);
            let visualUnits = cloneBattleUnits(step.turnStartUnits);
            const action = this._animationPlayer.playAction(
                actor.id,
                step.skill.kind === 'basic',
                isCurrent,
            );
            await this.delay(165);
            if (!isCurrent()) return;
            visualUnits = this.applyVisualLogs(visualUnits, primaryLogs, step.actionUnits);
            this.renderAll(step.actorId, visualUnits);
            this.setActionText(`${actor.name} 施放【${step.skill.name}】`, primaryLogs);
            const impact = this._animationPlayer.playImpacts(
                primaryLogs,
                step.skill.kind === 'basic' ? 'basic' : 'skill',
                actor.configId,
                actor.id,
                isCurrent,
            );
            await Promise.all([action, impact]);

            for (const reactionLogs of reactionGroups) {
                if (!isCurrent()) return;
                const sourceId = reactionLogs.find((log) => log.sourceUnitId)?.sourceUnitId ?? null;
                const reactionSource = step.actionUnits.find((unit) => unit.id === sourceId) ?? null;
                const hasCounterDamage = !!reactionSource && reactionLogs.some((log) => (
                    log.type === 'damage'
                    && log.sourceUnitId === reactionSource.id
                    && log.targetUnitId === actor.id
                    && (log.value ?? 0) > 0
                ));
                if (hasCounterDamage && reactionSource) {
                    this.setActionText(`${reactionSource.name} 发起反击`, []);
                    const counterAction = this._animationPlayer.playAction(
                        reactionSource.id, true, isCurrent,
                    );
                    await this.delay(145);
                    if (!isCurrent()) return;
                    visualUnits = this.applyVisualLogs(visualUnits, reactionLogs, step.actionUnits);
                    this.renderAll(step.actorId, visualUnits);
                    this.setActionText(`${reactionSource.name} 发起反击`, reactionLogs);
                    const counterImpact = this._animationPlayer.playImpacts(
                        reactionLogs, 'basic', reactionSource.configId, actor.id, isCurrent,
                    );
                    await Promise.all([counterAction, counterImpact]);
                }
                else {
                    visualUnits = this.applyVisualLogs(visualUnits, reactionLogs, step.actionUnits);
                    this.renderAll(step.actorId, visualUnits);
                    this.setActionText(`${reactionSource?.name ?? '单位'} 触发效果`, reactionLogs);
                    await this._animationPlayer.playImpacts(
                        reactionLogs, 'none', null, sourceId, isCurrent,
                    );
                }
            }
            this.renderAll(step.actorId, step.actionUnits);
        }
        else if (step.actionLogs.length) {
            this.renderAll(step.actorId, step.actionUnits);
            this.setActionText(`${actor?.name ?? '单位'} 触发效果`, step.actionLogs);
            await this._animationPlayer.playImpacts(
                step.actionLogs, 'none', null, step.actorId, isCurrent,
            );
        }
        if (!isCurrent()) return;

        this.renderAll(step.actorId, step.turnEndUnits);
        if (step.turnEndLogs.length) {
            this.setActionText(`${actor?.name ?? '单位'}的回合结束`, step.turnEndLogs);
            await this._animationPlayer.playImpacts(
                step.turnEndLogs, 'none', null, step.actorId, isCurrent,
            );
        }
    }

    private renderStep(step: BattleStepResult): void {
        if (this._roundLabel) {
            this._roundLabel.string = `第 ${this._waveIndex + 1}/${this.getWaveCount()} 波 · 第 ${step.round} 回合`;
        }
        const actor = this._flow.units.find((unit) => unit.id === step.actorId);
        const headline = actor && step.skill
            ? `${actor.name} 准备施放【${step.skill.name}】`
            : actor
                ? `${actor.name} 的回合`
                : '回合推进';
        this.setActionText(headline, []);
    }

    private getWaveCount(): number {
        return Math.max(1, this._session?.waves.length ?? 1);
    }

    private getCurrentWaveMaxRounds(): number {
        const configured = this._session?.stage.waves?.[this._waveIndex]?.maxRounds;
        return configured ?? this._session?.stage.maxRounds ?? 30;
    }

    private hasNextWave(): boolean {
        return this._waveIndex + 1 < this.getWaveCount();
    }

    private createWaveCarry(): BattleUnitState[] {
        const recovery = this._session?.stage.waves?.[this._waveIndex]?.recoveryAfterClear ?? 0;
        return cloneBattleUnits(this._flow.units.filter((unit) => unit.camp === 'ally'))
            .map((unit) => {
                if (unit.currentHp > 0 && recovery > 0) {
                    unit.currentHp = Math.min(
                        unit.attributes.maxHp,
                        unit.currentHp + Math.round(unit.attributes.maxHp * recovery),
                    );
                }
                // 波次结束清除敌方减益；友方增益、怒气和已触发被动继续保留。
                unit.buffs = unit.buffs.filter((buff) => BATTLE_BUFF_CONFIG[buff.buffId].category === 'buff');
                return unit;
            });
    }

    private async startNextWave(token: number): Promise<void> {
        const carry = this.createWaveCarry();
        this._waveIndex++;
        const enemies = this._session?.waves[this._waveIndex] ?? [];
        const allies = this._session?.allies ?? [];
        for (const [unitId, view] of this._unitViews) {
            if (unitId.startsWith('enemy_')) view.item.active = false;
        }
        const start = this._flow.start(
            [...allies, ...enemies],
            this.getCurrentWaveMaxRounds(),
            carry,
        );
        await this.attachUnitsToViews('enemy', enemies, token);
        if (!this.isCurrentRun(token)) return;
        // 不重置全部绑定，避免上一波阵亡的友方被视觉上重新站起；新敌人已由 bind 单独复位。
        this.renderAll(null);
        const waveName = this._session?.stage.waves?.[this._waveIndex]?.name ?? `第${this._waveIndex + 1}波`;
        if (this._roundLabel) this._roundLabel.string = `第 ${this._waveIndex + 1}/${this.getWaveCount()} 波`;
        if (this._stateLabel) this._stateLabel.string = `${waveName} · 敌人增援`;
        this.setActionText(`${waveName} · 波次开始`, start.logs);
        this._battleLogLines.push(``, `【第${this._waveIndex + 1}波：${waveName}】`);
        for (const log of start.logs) this._battleLogLines.push(`  ${log.message}`);
        await this.delay(500);
    }

    private recordStatistics(step: BattleStepResult): void {
        const actor = step.beforeUnits.find((unit) => unit.id === step.actorId);
        if (actor && step.skill) this.getStatistics(actor).actions++;
        for (const log of step.logs) {
            const source = step.beforeUnits.find((unit) => unit.id === log.sourceUnitId)
                ?? step.actionUnits.find((unit) => unit.id === log.sourceUnitId);
            const target = step.beforeUnits.find((unit) => unit.id === log.targetUnitId)
                ?? step.actionUnits.find((unit) => unit.id === log.targetUnitId);
            const value = Math.max(0, Math.round(log.value ?? 0));
            if (log.type === 'damage') {
                if (source) this.getStatistics(source).damage += value;
                if (target) this.getStatistics(target).damageTaken += value;
            }
            if (log.type === 'heal' && source) this.getStatistics(source).healing += value;
            if (log.type === 'defeated' && source) this.getStatistics(source).kills++;
        }
    }

    private recordReplayFrame(step: BattleStepResult): void {
        const cloneStep: BattleStepResult = {
            ...step,
            beforeUnits: cloneBattleUnits(step.beforeUnits),
            turnStartUnits: cloneBattleUnits(step.turnStartUnits),
            actionUnits: cloneBattleUnits(step.actionUnits),
            turnEndUnits: cloneBattleUnits(step.turnEndUnits),
            turnStartLogs: step.turnStartLogs.map((log) => ({ ...log })),
            actionLogs: step.actionLogs.map((log) => ({ ...log })),
            turnEndLogs: step.turnEndLogs.map((log) => ({ ...log })),
            logs: step.logs.map((log) => ({ ...log })),
        };
        this._replayFrames.push({ waveIndex: this._waveIndex, step: cloneStep });
        const actor = step.beforeUnits.find((unit) => unit.id === step.actorId);
        const headline = `第${this._waveIndex + 1}波 R${step.round} · ${actor?.name ?? '回合推进'}${step.skill ? `【${step.skill.name}】` : ''}`;
        this._battleLogLines.push(headline);
        for (const log of step.logs) this._battleLogLines.push(`  ${log.message}`);
        if (!step.logs.length) this._battleLogLines.push('  无额外效果');
    }

    private getStatistics(unit: BattleUnitState): BattleUnitStatistics {
        const key = `${unit.camp}:${unit.configId}`;
        let result = this._statistics.get(key);
        if (!result) {
            result = {
                configId: unit.configId,
                name: unit.name,
                camp: unit.camp,
                damage: 0,
                healing: 0,
                damageTaken: 0,
                kills: 0,
                actions: 0,
            };
            this._statistics.set(key, result);
        }
        return result;
    }

    private formatStatistics(): string {
        const allies = Array.from(this._statistics.values())
            .filter((item) => item.camp === 'ally')
            .sort((a, b) => (b.damage + b.healing) - (a.damage + a.healing))
            .slice(0, 3);
        if (!allies.length) return '';
        return ['战斗统计', ...allies.map((item) => (
            `${item.name} 伤害${item.damage} 治疗${item.healing} 击杀${item.kills}`
        ))].join('\n');
    }

    private finishBattle(): void {
        // 保留死亡末帧；只终止流程，不在结算遮罩出现时重置角色动画。
        this.stopAutoBattle(false);
        if (!this._resultLayer || !this._resultLabel) return;
        this._resultLayer.active = true;
        const result = this._flow.winner === 'ally'
            ? '战斗胜利'
            : this._flow.winner === 'enemy'
                ? '战斗失败'
                : '战斗平局';
        if (!this._settlement && this._session) {
            try {
                this._settlement = this._rewardService.settle(
                    this._session.stage,
                    this._flow.winner,
                    this._battleId,
                    this._totalRounds || this._flow.round,
                );
            }
            catch (error) {
                warn(`[BattleMain] 奖励结算失败：${String(error)}`);
            }
        }
        const stageName = this._session?.stage.name ?? '未知关卡';
        const settlementText = this.formatSettlement(this._settlement);
        this._resultLabel.string = [
            result,
            stageName,
            `历经 ${this._totalRounds || this._flow.round} 回合`,
            this.formatStatistics(),
            settlementText,
        ].filter(Boolean).join('\n');
        const canContinue = this._flow.winner === 'ally' && !!this._session?.stage.nextStageId;
        if (this._nextStageButton) this._nextStageButton.active = canContinue;
        if (this._replayButton) this._replayButton.node.active = this._replayFrames.length > 0;
        if (this._detailLogButton) this._detailLogButton.node.active = this._battleLogLines.length > 0;
        this._restartButton?.setPosition(canContinue ? -145 : 0, -245);
        if (this._stateLabel) this._stateLabel.string = '战斗结束';
    }

    private formatSettlement(settlement: BattleSettlement | null): string {
        if (this._flow.winner !== 'ally') return '本次战斗无奖励';
        if (!settlement) return '奖励发放失败，请重试';
        if (settlement.duplicate) return '奖励已结算';
        if (!settlement.rewards.length) return '本次战斗无奖励';
        const rewardText = settlement.rewards
            .map((item) => `${ITEM_NAMES[String(item.itemId)] ?? String(item.itemId)}×${item.amount}`)
            .join('  ');
        return `${settlement.firstClear ? '首通奖励 · ' : ''}${rewardText}`;
    }

    private bindUnitSlots(): void {
        const allyItems = (findChild(this.node, 'bg/leftNode')?.children ?? [])
            .filter((child) => child.name.startsWith('roleItem'));
        const enemyItems = (findChild(this.node, 'bg/leftNode-001')?.children ?? [])
            .filter((child) => child.name.startsWith('roleItem'));
        if (allyItems.length < 5 || enemyItems.length < 5) {
            warn(`[BattleMain] 战斗站位不足：角色${allyItems.length}个，怪物${enemyItems.length}个。`);
        }
        this.createSlotViews(allyItems.slice(0, 5), 'ally');
        this.createSlotViews(enemyItems.slice(0, 5), 'enemy');
    }

    private createSlotViews(items: Node[], camp: BattleCamp): void {
        items.forEach((item, index) => {
            const unitId = `${camp}_${index + 1}`;
            if (camp === 'enemy') {
                item.on(Node.EventType.TOUCH_END, () => this.selectManualTarget(unitId), this);
            }
            const overlay = new Node('battleInfo');
            overlay.layer = this.node.layer;
            overlay.setScale(camp === 'enemy' ? -1 : 1, 1, 1);
            item.addChild(overlay);

            const nameLabel = this.createLabel(overlay, 'name', 0, 188, 230, 34, 24, new Color(255, 244, 192));
            const hpLabel = this.createLabel(overlay, 'hpText', 22, 139, 190, 24, 18, Color.WHITE);
            const energyLabel = this.createLabel(overlay, 'energyText', 22, 118, 190, 20, 15, new Color(255, 211, 82));
            const buffLabel = this.createLabel(overlay, 'buffs', 0, 103, 260, 50, 17, new Color(174, 235, 255));
            const turnLabel = this.createLabel(overlay, 'turnMark', 0, 225, 190, 28, 20, new Color(255, 214, 77));

            this._unitViews.set(unitId, {
                item,
                overlay,
                icon: findChild(item, 'icon')?.getComponent(Sprite) ?? null,
                hpBar: findChild(item, 'hp')?.getComponent(ProgressBar) ?? null,
                nameLabel,
                hpLabel,
                energyLabel,
                buffLabel,
                turnLabel,
            });
        });
    }

    private attachUnitsToViews(
        camp: BattleCamp,
        configs: readonly BattleUnitConfig[],
        token: number,
        stateUnits: readonly BattleUnitState[] = this._flow.units,
    ): Promise<void> {
        const units = stateUnits.filter((unit) => unit.camp === camp);
        const portraitLoads: Promise<void>[] = [];
        units.forEach((unit, index) => {
            const view = this._unitViews.get(unit.id);
            const config = configs[index];
            if (!view || !config) return;
            view.item.active = true;
            if (view.icon) {
                this._animationPlayer.bind(
                    unit.id,
                    unit.configId,
                    unit.camp,
                    config.animation,
                    view.item,
                    view.overlay,
                    view.icon,
                );
            }
            portraitLoads.push(new Promise((resolve) => {
                loadSpriteFrameCompat(config.iconPath, (error, spriteFrame) => {
                    if (error || !spriteFrame) {
                        warn(`[BattleMain] 角色图标加载失败：${config.iconPath}`);
                        resolve();
                        return;
                    }
                    if (this.isCurrentRun(token) && view.icon?.isValid) view.icon.spriteFrame = spriteFrame;
                    resolve();
                });
            }));
        });
        return Promise.all(portraitLoads).then(() => undefined);
    }

    private renderAll(
        activeActorId: string | null,
        units: readonly BattleUnitState[] = this._flow.units,
    ): void {
        for (const unit of units) {
            const view = this._unitViews.get(unit.id);
            if (!view) continue;
            const hpRate = Math.max(0, unit.currentHp / unit.attributes.maxHp);
            if (view.hpBar) view.hpBar.progress = hpRate;
            this._animationPlayer.setAlive(unit.id, unit.currentHp > 0);
            view.nameLabel.string = unit.name;
            view.hpLabel.string = `${Math.ceil(unit.currentHp)} / ${unit.attributes.maxHp}`;
            view.energyLabel.string = `怒气 ${Math.round(unit.energy)} / ${unit.maxEnergy}`;
            view.buffLabel.string = this.formatBuffs(unit);
            view.turnLabel.string = unit.currentHp <= 0
                ? '已阵亡'
                : unit.id === activeActorId ? '◆ 行动中 ◆' : '';
            // 死亡序列本身已经表达阵亡状态，保持原色避免把死亡动画整体染黑。
            if (view.icon) view.icon.color = Color.WHITE;
        }
    }

    private formatBuffs(unit: BattleUnitState): string {
        if (!unit.buffs.length) return '';
        return unit.buffs.slice(0, 3).map((buff) => {
            const config = BATTLE_BUFF_CONFIG[buff.buffId];
            const stacks = buff.stacks > 1 ? `×${buff.stacks}` : '';
            return `${config.name}${stacks}(${buff.remainingTurns})`;
        }).join('  ');
    }

    private setActionText(headline: string, logs: readonly BattleLogEntry[]): void {
        if (!this._actionLabel) return;
        const details = logs
            .filter((log) => ['damage', 'heal', 'shield', 'controlResisted', 'skipTurn', 'defeated'].includes(log.type))
            .slice(0, 3)
            .map((log) => log.message);
        this._actionLabel.string = [headline, ...details].join('\n');
    }

    private buildRuntimeHierarchy(): void {
        const runtime = new Node('battleRuntime');
        runtime.layer = this.node.layer;
        this.node.addChild(runtime);

        const topHud = new Node('topHud');
        topHud.layer = this.node.layer;
        runtime.addChild(topHud);
        this._roundLabel = this.createLabel(topHud, 'round', 0, 715, 280, 50, 34, new Color(255, 233, 159));
        this._stateLabel = this.createLabel(topHud, 'state', 0, 672, 330, 36, 21, new Color(194, 224, 255));

        const previewToggle = this.createRuntimeButton(
            runtime, 'btn_animation_preview', 270, 700, 160, 54, '动画预览',
            new Color(55, 103, 153, 245),
        );
        this._animationPreviewToggleButton = previewToggle.node;
        this._animationPreviewToggleLabel = previewToggle.label;
        previewToggle.node.on(Node.EventType.TOUCH_END, this.onAnimationPreviewToggle, this);

        this._helpButton = this.createRuntimeButton(
            runtime, 'btn_battle_help', -270, 700, 150, 54, '玩法说明',
            new Color(69, 112, 95, 245),
        );
        this._helpButton.node.on(Node.EventType.TOUCH_END, this.onHelp, this);

        this._animationPreviewPanel = new Node('animationPreviewPanel');
        this._animationPreviewPanel.layer = this.node.layer;
        this._animationPreviewPanel.setPosition(0, -530);
        this._animationPreviewPanel.addComponent(UITransform).setContentSize(700, 96);
        this._animationPreviewPanel.addComponent(BlockInputEvents);
        const previewPanelGraphics = this._animationPreviewPanel.addComponent(Graphics);
        previewPanelGraphics.fillColor = new Color(12, 22, 39, 230);
        previewPanelGraphics.roundRect(-350, -48, 700, 96, 18);
        previewPanelGraphics.fill();
        runtime.addChild(this._animationPreviewPanel);

        const unitButton = this.createRuntimeButton(
            this._animationPreviewPanel, 'btn_preview_unit', -205, 0, 250, 62,
            '对象：晶霜法师', new Color(48, 91, 135, 255),
        );
        this._previewUnitButton = unitButton.node;
        this._previewUnitLabel = unitButton.label;
        unitButton.node.on(Node.EventType.TOUCH_END, this.onPreviewUnitSwitch, this);

        const sequenceButton = this.createRuntimeButton(
            this._animationPreviewPanel, 'btn_preview_sequence', 55, 0, 230, 62,
            '动画：待机', new Color(131, 89, 38, 255),
        );
        this._previewSequenceButton = sequenceButton.node;
        this._previewSequenceLabel = sequenceButton.label;
        sequenceButton.node.on(Node.EventType.TOUCH_END, this.onPreviewSequenceSwitch, this);

        const replayButton = this.createRuntimeButton(
            this._animationPreviewPanel, 'btn_preview_replay', 270, 0, 120, 62,
            '重播', new Color(45, 130, 97, 255),
        );
        this._previewReplayButton = replayButton.node;
        replayButton.node.on(Node.EventType.TOUCH_END, this.onPreviewReplay, this);
        this._animationPreviewPanel.active = false;

        this._controlPanel = new Node('battleControlPanel');
        this._controlPanel.layer = this.node.layer;
        runtime.addChild(this._controlPanel);
        this._autoButton = this.createRuntimeButton(
            this._controlPanel, 'btn_auto', -240, 610, 135, 52, '自动', new Color(56, 113, 166, 245),
        );
        this._pauseButton = this.createRuntimeButton(
            this._controlPanel, 'btn_pause', -80, 610, 135, 52, '暂停', new Color(87, 91, 128, 245),
        );
        this._speedButton = this.createRuntimeButton(
            this._controlPanel, 'btn_speed', 80, 610, 135, 52, '1 倍速', new Color(111, 83, 42, 245),
        );
        this._skipButton = this.createRuntimeButton(
            this._controlPanel, 'btn_skip', 240, 610, 135, 52, '跳过', new Color(126, 65, 65, 245),
        );
        this._autoButton.node.on(Node.EventType.TOUCH_END, this.onAutoToggle, this);
        this._pauseButton.node.on(Node.EventType.TOUCH_END, this.onPauseToggle, this);
        this._speedButton.node.on(Node.EventType.TOUCH_END, this.onSpeedToggle, this);
        this._skipButton.node.on(Node.EventType.TOUCH_END, this.onSkipBattle, this);
        this._turnOrderLabel = this.createLabel(
            this._controlPanel, 'turnOrder', 0, 558, 680, 34, 19, new Color(202, 222, 255),
        );
        this._turnOrderLabel.string = '行动顺序：准备中';

        this._manualPanel = new Node('manualActionPanel');
        this._manualPanel.layer = this.node.layer;
        this._manualPanel.setPosition(0, -525);
        this._manualPanel.addComponent(UITransform).setContentSize(700, 100);
        this._manualPanel.addComponent(BlockInputEvents);
        const manualGraphics = this._manualPanel.addComponent(Graphics);
        manualGraphics.fillColor = new Color(12, 27, 48, 240);
        manualGraphics.roundRect(-350, -50, 700, 100, 18);
        manualGraphics.fill();
        runtime.addChild(this._manualPanel);
        this._manualTargetButton = this.createRuntimeButton(
            this._manualPanel, 'btn_manual_target', -270, 0, 130, 66,
            '目标', new Color(118, 63, 66, 255),
        );
        this._manualTargetButton.node.on(Node.EventType.TOUCH_END, this.onManualTargetSwitch, this);
        [-105, 75, 255].forEach((x, index) => {
            const button = this.createRuntimeButton(
                this._manualPanel!, `btn_manual_skill_${index + 1}`, x, 0, 160, 66,
                `技能${index + 1}`, new Color(45, 103, 143, 255),
            );
            button.node.on(Node.EventType.TOUCH_END, () => this.onManualSkill(index), this);
            this._manualSkillButtons.push(button);
        });
        this._manualPanel.active = false;

        const actionPanel = new Node('actionPanel');
        actionPanel.layer = this.node.layer;
        actionPanel.setPosition(0, -650);
        actionPanel.addComponent(UITransform).setContentSize(670, 150);
        const actionGraphics = actionPanel.addComponent(Graphics);
        actionGraphics.fillColor = new Color(14, 22, 39, 205);
        actionGraphics.roundRect(-335, -75, 670, 150, 22);
        actionGraphics.fill();
        runtime.addChild(actionPanel);
        this._actionLabel = this.createLabel(actionPanel, 'actionText', 0, 0, 620, 122, 22, Color.WHITE);

        this._resultLayer = new Node('resultLayer');
        this._resultLayer.layer = this.node.layer;
        this._resultLayer.addComponent(UITransform).setContentSize(750, 1600);
        this._resultLayer.addComponent(BlockInputEvents);
        const shade = this._resultLayer.addComponent(Graphics);
        shade.fillColor = new Color(0, 0, 0, 150);
        shade.rect(-375, -800, 750, 1600);
        shade.fill();
        runtime.addChild(this._resultLayer);

        const card = new Node('resultCard');
        card.layer = this.node.layer;
        card.addComponent(UITransform).setContentSize(620, 600);
        const cardGraphics = card.addComponent(Graphics);
        cardGraphics.fillColor = new Color(25, 40, 68, 245);
        cardGraphics.roundRect(-310, -300, 620, 600, 34);
        cardGraphics.fill();
        this._resultLayer.addChild(card);
        this._resultLabel = this.createLabel(card, 'resultText', 0, 90, 560, 330, 30, new Color(255, 226, 129));

        this._restartButton = new Node('btn_restart');
        this._restartButton.layer = this.node.layer;
        this._restartButton.setPosition(0, -245);
        this._restartButton.addComponent(UITransform).setContentSize(260, 78);
        const buttonGraphics = this._restartButton.addComponent(Graphics);
        buttonGraphics.fillColor = new Color(46, 137, 204, 255);
        buttonGraphics.roundRect(-130, -39, 260, 78, 24);
        buttonGraphics.fill();
        card.addChild(this._restartButton);
        this.createLabel(this._restartButton, 'Label', 0, 0, 220, 60, 30, Color.WHITE).string = '再次挑战';
        this._restartButton.on(Node.EventType.TOUCH_END, this.restartBattle, this);

        const nextStageButton = this.createRuntimeButton(
            card, 'btn_next_stage', 145, -245, 220, 78, '下一关', new Color(58, 151, 91, 255),
        );
        this._nextStageButton = nextStageButton.node;
        this._nextStageButton.on(Node.EventType.TOUCH_END, this.onNextStage, this);
        this._nextStageButton.active = false;
        this._replayButton = this.createRuntimeButton(
            card, 'btn_battle_replay', -145, -150, 240, 72, '战斗回放', new Color(92, 78, 151, 255),
        );
        this._replayButton.node.on(Node.EventType.TOUCH_END, this.onReplayBattle, this);
        this._detailLogButton = this.createRuntimeButton(
            card, 'btn_battle_log', 145, -150, 240, 72, '详细日志', new Color(66, 118, 126, 255),
        );
        this._detailLogButton.node.on(Node.EventType.TOUCH_END, this.onShowBattleLog, this);
        this._resultLayer.active = false;

        this._stageSelectLayer = new Node('stageSelectLayer');
        this._stageSelectLayer.layer = this.node.layer;
        this._stageSelectLayer.addComponent(UITransform).setContentSize(750, 1600);
        this._stageSelectLayer.addComponent(BlockInputEvents);
        const stageShade = this._stageSelectLayer.addComponent(Graphics);
        stageShade.fillColor = new Color(4, 10, 20, 225);
        stageShade.rect(-375, -800, 750, 1600);
        stageShade.fill();
        runtime.addChild(this._stageSelectLayer);
        const stageCard = new Node('stageCard');
        stageCard.layer = this.node.layer;
        stageCard.addComponent(UITransform).setContentSize(650, 760);
        const stageCardGraphics = stageCard.addComponent(Graphics);
        stageCardGraphics.fillColor = new Color(22, 38, 65, 250);
        stageCardGraphics.roundRect(-325, -380, 650, 760, 32);
        stageCardGraphics.fill();
        this._stageSelectLayer.addChild(stageCard);
        this._stageSelectTitle = this.createLabel(
            stageCard, 'title', 0, 310, 560, 70, 36, new Color(255, 225, 137),
        );
        this._stageSelectTitle.string = '选择试炼关卡';
        Object.values(BATTLE_STAGE_CONFIG).forEach((stage, index) => {
            const button = this.createRuntimeButton(
                stageCard,
                `btn_stage_${stage.id}`,
                0,
                170 - index * 190,
                540,
                150,
                stage.name,
                new Color(48, 91, 135, 255),
            );
            button.node.on(Node.EventType.TOUCH_END, () => this.onStageSelected(stage), this);
            this._stageButtons.set(stage.id, button);
        });
        this._stageSelectLayer.active = false;

        this.buildBattleLogLayer(runtime);
        this.buildTutorialLayer(runtime);

        // 返回按钮始终高于结算遮罩，保证战斗结束后仍可退出页面。
        this._backButton?.setSiblingIndex(this.node.children.length - 1);
    }

    private buildBattleLogLayer(runtime: Node): void {
        this._logLayer = new Node('battleLogLayer');
        this._logLayer.layer = this.node.layer;
        this._logLayer.addComponent(UITransform).setContentSize(750, 1600);
        this._logLayer.addComponent(BlockInputEvents);
        const shade = this._logLayer.addComponent(Graphics);
        shade.fillColor = new Color(2, 8, 16, 230);
        shade.rect(-375, -800, 750, 1600);
        shade.fill();
        runtime.addChild(this._logLayer);

        const card = new Node('logCard');
        card.layer = this.node.layer;
        card.addComponent(UITransform).setContentSize(680, 1120);
        const graphics = card.addComponent(Graphics);
        graphics.fillColor = new Color(21, 35, 58, 252);
        graphics.roundRect(-340, -560, 680, 1120, 30);
        graphics.fill();
        this._logLayer.addChild(card);
        this.createLabel(card, 'title', 0, 490, 600, 70, 36, new Color(255, 225, 137)).string = '战斗详细日志';
        this._logLabel = this.createLabel(card, 'content', 0, 30, 610, 820, 22, new Color(222, 235, 249));
        this._logLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
        this._logLabel.verticalAlign = VerticalTextAlignment.TOP;
        const previous = this.createRuntimeButton(card, 'btn_log_previous', -220, -470, 150, 64, '上一页', new Color(54, 91, 130, 255));
        const next = this.createRuntimeButton(card, 'btn_log_next', 220, -470, 150, 64, '下一页', new Color(54, 91, 130, 255));
        const close = this.createRuntimeButton(card, 'btn_log_close', 0, -535, 180, 58, '关闭', new Color(120, 70, 70, 255));
        this._logPageLabel = this.createLabel(card, 'page', 0, -470, 180, 50, 22, Color.WHITE);
        previous.node.on(Node.EventType.TOUCH_END, () => this.changeLogPage(-1), this);
        next.node.on(Node.EventType.TOUCH_END, () => this.changeLogPage(1), this);
        close.node.on(Node.EventType.TOUCH_END, this.onCloseBattleLog, this);
        this._logLayer.active = false;
    }

    private buildTutorialLayer(runtime: Node): void {
        this._tutorialLayer = new Node('battleTutorialLayer');
        this._tutorialLayer.layer = this.node.layer;
        this._tutorialLayer.addComponent(UITransform).setContentSize(750, 1600);
        this._tutorialLayer.addComponent(BlockInputEvents);
        const shade = this._tutorialLayer.addComponent(Graphics);
        shade.fillColor = new Color(0, 0, 0, 185);
        shade.rect(-375, -800, 750, 1600);
        shade.fill();
        runtime.addChild(this._tutorialLayer);

        const card = new Node('tutorialCard');
        card.layer = this.node.layer;
        card.addComponent(UITransform).setContentSize(640, 560);
        const graphics = card.addComponent(Graphics);
        graphics.fillColor = new Color(25, 43, 73, 252);
        graphics.roundRect(-320, -280, 640, 560, 34);
        graphics.fill();
        this._tutorialLayer.addChild(card);
        this._tutorialTitle = this.createLabel(card, 'title', 0, 190, 540, 70, 38, new Color(255, 224, 128));
        this._tutorialBody = this.createLabel(card, 'body', 0, 30, 540, 230, 27, Color.WHITE);
        this._tutorialNextButton = this.createRuntimeButton(
            card, 'btn_tutorial_next', 120, -190, 220, 72, '下一步', new Color(47, 130, 91, 255),
        );
        const skip = this.createRuntimeButton(
            card, 'btn_tutorial_skip', -150, -190, 180, 72, '跳过引导', new Color(83, 88, 105, 255),
        );
        this._tutorialNextButton.node.on(Node.EventType.TOUCH_END, this.onTutorialNext, this);
        skip.node.on(Node.EventType.TOUCH_END, this.onTutorialSkip, this);
        this._tutorialLayer.active = false;
    }

    private createLabel(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number,
        color: Color,
    ): Label {
        const node = new Node(name);
        node.layer = this.node.layer;
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        const label = node.addComponent(Label);
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.25);
        label.color = color;
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = true;
        parent.addChild(node);
        return label;
    }

    private createRuntimeButton(
        parent: Node,
        name: string,
        x: number,
        y: number,
        width: number,
        height: number,
        text: string,
        color: Color,
    ): RuntimeButton {
        const node = new Node(name);
        node.layer = this.node.layer;
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color;
        graphics.roundRect(-width / 2, -height / 2, width, height, 16);
        graphics.fill();
        parent.addChild(node);
        const label = this.createLabel(
            node, 'Label', 0, 0, width - 20, height - 10, 22, Color.WHITE,
        );
        label.string = text;
        return { node, label };
    }

    private onAnimationPreviewToggle(): void {
        if (this._animationPreviewActive) {
            this.restartBattle();
            return;
        }
        this.stopAutoBattle();
        this._animationPreviewActive = true;
        this._previewToken++;
        if (this._resultLayer) this._resultLayer.active = false;
        if (this._animationPreviewPanel) this._animationPreviewPanel.active = true;
        if (this._animationPreviewToggleLabel) this._animationPreviewToggleLabel.string = '返回战斗';
        if (this._roundLabel) this._roundLabel.string = '动画预览';
        if (this._stateLabel) this._stateLabel.string = '自动战斗已暂停';
        this.refreshAnimationPreviewLabels();
        void this.playCurrentAnimationPreview();
    }

    private onAutoToggle(): void {
        this._autoMode = !this._autoMode;
        if (this._autoMode && this._manualResolver) {
            this.resolveManualDecision({});
        }
        this.refreshControlLabels();
        if (this._stateLabel && this._flow.status === 'running') {
            this._stateLabel.string = `${this._autoMode ? '自动' : '手动'}战斗 · ${this._playbackSpeed}倍速`;
        }
    }

    private onPauseToggle(): void {
        if ((this._flow.status !== 'running' && !this._replayActive) || this._animationPreviewActive) return;
        this._paused = !this._paused;
        this._animationPlayer.setPaused(this._paused);
        this.refreshControlLabels();
        if (this._stateLabel) {
            this._stateLabel.string = this._paused
                ? this._replayActive ? '回放已暂停' : '战斗已暂停'
                : this._replayActive ? '战斗回放中' : '战斗进行中';
        }
    }

    private onSpeedToggle(): void {
        this._playbackSpeed = this._playbackSpeed === 1 ? 2 : this._playbackSpeed === 2 ? 4 : 1;
        this._animationPlayer.setPlaybackSpeed(this._playbackSpeed);
        this.refreshControlLabels();
    }

    private onSkipBattle(): void {
        if (this._replayActive) {
            this.completeReplay(true);
            return;
        }
        if (this._flow.status !== 'running' || this._animationPreviewActive) return;
        this.cancelManualDecision();
        this.stopAutoBattle(false);
        let guard = 0;
        while (guard++ < 5000) {
            while (this._flow.status === 'running' && guard++ < 5000) {
                const step = this._flow.step();
                this.recordStatistics(step);
                this.recordReplayFrame(step);
            }
            this._totalRounds += this._flow.round;
            if (this._flow.winner !== 'ally' || !this.hasNextWave()) break;
            const carry = this.createWaveCarry();
            this._waveIndex++;
            const enemies = this._session?.waves[this._waveIndex] ?? [];
            this._flow.start(
                [...this._session?.allies ?? [], ...enemies],
                this.getCurrentWaveMaxRounds(),
                carry,
            );
        }
        this.renderAll(null);
        this.finishBattle();
    }

    private onManualTargetSwitch(): void {
        const targets = this._manualPreview?.targets ?? [];
        if (!targets.length) return;
        this._manualTargetIndex = (this._manualTargetIndex + 1) % targets.length;
        this.refreshManualPanel();
    }

    private selectManualTarget(unitId: string): void {
        const preview = this._manualPreview;
        if (!preview || !this._manualResolver) return;
        const index = preview.targets.findIndex((unit) => unit.id === unitId);
        if (index < 0) return;
        this._manualTargetIndex = index;
        this.refreshManualPanel();
    }

    private onManualSkill(index: number): void {
        const preview = this._manualPreview;
        const state = preview?.skills[index];
        if (!preview || !state || !this._manualResolver) return;
        if (!state.available) {
            const reason = state.reason === 'energy'
                ? '怒气未满'
                : `冷却剩余 ${state.cooldown} 回合`;
            this.setActionText(`【${state.skill.name}】暂不可用`, [{
                type: 'skipTurn',
                targetUnitId: preview.actor.id,
                message: reason,
            }]);
            return;
        }
        const target = preview.targets[this._manualTargetIndex];
        this.resolveManualDecision({ skillId: state.skill.id, targetId: target?.id });
    }

    private requestManualDecision(
        preview: BattleTurnPreview,
        token: number,
    ): Promise<BattleActionDecision> {
        if (!this.isCurrentRun(token)) return Promise.resolve({});
        this._manualPreview = preview;
        this._manualTargetIndex = Math.max(0, preview.targets.findIndex((unit) => (
            unit.currentHp / unit.attributes.maxHp
            === Math.min(...preview.targets.map((item) => item.currentHp / item.attributes.maxHp))
        )));
        if (this._manualPanel) this._manualPanel.active = true;
        this.refreshManualPanel();
        this.setActionText(`${preview.actor.name}：请选择技能和目标`, []);
        return new Promise((resolve) => {
            this._manualResolver = resolve;
        });
    }

    private resolveManualDecision(decision: BattleActionDecision): void {
        const resolve = this._manualResolver;
        this._manualResolver = null;
        this._manualPreview = null;
        if (this._manualPanel) this._manualPanel.active = false;
        resolve?.(decision);
    }

    private cancelManualDecision(): void {
        this.resolveManualDecision({});
    }

    private refreshManualPanel(): void {
        const preview = this._manualPreview;
        if (!preview) return;
        const target = preview.targets[this._manualTargetIndex];
        if (this._manualTargetButton) {
            this._manualTargetButton.label.string = `目标\n${target?.name ?? '无'}`;
        }
        for (const unit of this._flow.units) {
            const view = this._unitViews.get(unit.id);
            if (!view) continue;
            view.turnLabel.string = unit.currentHp <= 0
                ? '已阵亡'
                : unit.id === preview.actor.id
                    ? '◆ 选择技能 ◆'
                    : unit.id === target?.id ? '◎ 当前目标 ◎' : '';
        }
        this._manualSkillButtons.forEach((button, index) => {
            const state = preview.skills[index];
            if (!state) {
                button.node.active = false;
                return;
            }
            button.node.active = true;
            const suffix = state.available
                ? state.skill.kind === 'ultimate' ? '满怒' : '可用'
                : state.reason === 'energy' ? `${preview.actor.energy}/${preview.actor.maxEnergy}` : `冷却${state.cooldown}`;
            button.label.string = `${state.skill.name}\n${suffix}`;
            button.label.color = state.available ? Color.WHITE : new Color(158, 165, 176);
        });
    }

    private refreshControlLabels(): void {
        if (this._autoButton) this._autoButton.label.string = this._autoMode ? '自动' : '手动';
        if (this._pauseButton) this._pauseButton.label.string = this._paused ? '继续' : '暂停';
        if (this._speedButton) this._speedButton.label.string = `${this._playbackSpeed} 倍速`;
        if (this._skipButton) this._skipButton.label.string = this._replayActive ? '退出回放' : '跳过';
    }

    private renderTurnOrder(preview: BattleTurnPreview): void {
        if (!this._turnOrderLabel) return;
        const names = preview.upcomingUnitIds
            .map((id) => this._flow.units.find((unit) => unit.id === id)?.name)
            .filter((name): name is string => !!name);
        this._turnOrderLabel.string = `行动顺序：${names.join(' → ') || '结算中'}`;
    }

    private async waitWhilePaused(token: number): Promise<void> {
        while (this._paused && this.isCurrentRun(token)) {
            await new Promise<void>((resolve) => setTimeout(resolve, 50));
        }
    }

    private onPreviewUnitSwitch(): void {
        const count = this._flow.units.length;
        if (!this._animationPreviewActive || !count) return;
        this._previewUnitIndex = (this._previewUnitIndex + 1) % count;
        this.refreshAnimationPreviewLabels();
        void this.playCurrentAnimationPreview();
    }

    private onPreviewSequenceSwitch(): void {
        if (!this._animationPreviewActive) return;
        this._previewSequenceIndex = (
            this._previewSequenceIndex + 1
        ) % ANIMATION_PREVIEW_OPTIONS.length;
        this.refreshAnimationPreviewLabels();
        void this.playCurrentAnimationPreview();
    }

    private onPreviewReplay(): void {
        if (this._animationPreviewActive) void this.playCurrentAnimationPreview();
    }

    private onNextStage(): void {
        const nextStageId = this._session?.stage.nextStageId;
        if (!nextStageId || this._flow.winner !== 'ally') return;
        this._openArgs = { ...this._openArgs, stageId: nextStageId };
        this.restartBattle();
    }

    private onHelp(): void {
        this.showTutorial(0);
    }

    private showTutorialIfNeeded(): void {
        if (GameStorage.load<boolean>(BATTLE_TUTORIAL_STORAGE_KEY) !== true) this.showTutorial(0);
    }

    private showTutorial(step: number): void {
        if (!this._tutorialLayer) return;
        if (!this._tutorialVisible) this._pausedBeforeTutorial = this._paused;
        this._tutorialVisible = true;
        this._tutorialStep = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, step));
        this._tutorialLayer.active = true;
        if (this._flow.status === 'running' || this._replayActive) {
            this._paused = true;
            this._animationPlayer.setPaused(true);
            this.refreshControlLabels();
        }
        this.refreshTutorial();
    }

    private refreshTutorial(): void {
        const content = TUTORIAL_STEPS[this._tutorialStep];
        if (this._tutorialTitle) this._tutorialTitle.string = `${this._tutorialStep + 1}/${TUTORIAL_STEPS.length} · ${content.title}`;
        if (this._tutorialBody) this._tutorialBody.string = content.body;
        if (this._tutorialNextButton) {
            this._tutorialNextButton.label.string = this._tutorialStep === TUTORIAL_STEPS.length - 1
                ? '开始战斗'
                : '下一步';
        }
    }

    private onTutorialNext(): void {
        if (this._tutorialStep < TUTORIAL_STEPS.length - 1) {
            this._tutorialStep++;
            this.refreshTutorial();
            return;
        }
        this.closeTutorial(true);
    }

    private onTutorialSkip(): void {
        this.closeTutorial(true);
    }

    private closeTutorial(markCompleted: boolean): void {
        if (markCompleted) GameStorage.save(BATTLE_TUTORIAL_STORAGE_KEY, true);
        this._tutorialVisible = false;
        if (this._tutorialLayer) this._tutorialLayer.active = false;
        this._paused = this._pausedBeforeTutorial;
        this._animationPlayer.setPaused(this._paused);
        this.refreshControlLabels();
        if (this._stateLabel && !this._paused && this._flow.status === 'running') {
            this._stateLabel.string = this._replayActive ? '战斗回放中' : '战斗进行中';
        }
    }

    private onShowBattleLog(): void {
        if (!this._logLayer || !this._battleLogLines.length) return;
        this._logPage = 0;
        this._logLayer.active = true;
        if (this._resultLayer) this._resultLayer.active = false;
        this.refreshBattleLogPage();
    }

    private onCloseBattleLog(): void {
        if (this._logLayer) this._logLayer.active = false;
        if (this._resultLayer && this._flow.status === 'finished') this._resultLayer.active = true;
    }

    private changeLogPage(offset: number): void {
        const pageCount = Math.max(1, Math.ceil(this._battleLogLines.length / BATTLE_LOG_PAGE_SIZE));
        this._logPage = Math.max(0, Math.min(pageCount - 1, this._logPage + offset));
        this.refreshBattleLogPage();
    }

    private refreshBattleLogPage(): void {
        const pageCount = Math.max(1, Math.ceil(this._battleLogLines.length / BATTLE_LOG_PAGE_SIZE));
        this._logPage = Math.min(this._logPage, pageCount - 1);
        const start = this._logPage * BATTLE_LOG_PAGE_SIZE;
        if (this._logLabel) {
            this._logLabel.string = this._battleLogLines.slice(start, start + BATTLE_LOG_PAGE_SIZE).join('\n');
        }
        if (this._logPageLabel) this._logPageLabel.string = `${this._logPage + 1} / ${pageCount}`;
    }

    private onReplayBattle(): void {
        if (!this._replayFrames.length || this._replayActive) return;
        void this.playBattleReplay();
    }

    private async playBattleReplay(): Promise<void> {
        this.stopAutoBattle(false);
        this._replayActive = true;
        this.refreshControlLabels();
        const token = this._runToken;
        if (this._resultLayer) this._resultLayer.active = false;
        if (this._logLayer) this._logLayer.active = false;
        this._animationPlayer.reset();
        let preparedWave = -1;
        for (const frame of this._replayFrames) {
            if (!this.isCurrentRun(token) || !this._replayActive) return;
            await this.waitWhilePaused(token);
            if (!this.isCurrentRun(token) || !this._replayActive) return;
            if (frame.waveIndex !== preparedWave) {
                await this.prepareReplayWave(frame.waveIndex, token);
                if (!this.isCurrentRun(token)) return;
                preparedWave = frame.waveIndex;
            }
            if (this._roundLabel) {
                this._roundLabel.string = `回放 · 第 ${frame.waveIndex + 1}/${this.getWaveCount()} 波 · R${frame.step.round}`;
            }
            await this.playBattleStep(frame.step, token);
            if (!this.isCurrentRun(token)) return;
            await this.delay(100);
        }
        if (this.isCurrentRun(token)) this.completeReplay(false);
    }

    private async prepareReplayWave(waveIndex: number, token: number): Promise<void> {
        const enemies = this._session?.waves[waveIndex] ?? [];
        const replayUnits = this._replayFrames.find((frame) => frame.waveIndex === waveIndex)
            ?.step.beforeUnits ?? [];
        for (const [unitId, view] of this._unitViews) {
            if (unitId.startsWith('enemy_')) view.item.active = false;
        }
        await this.attachUnitsToViews('enemy', enemies, token, replayUnits);
        if (this._stateLabel) this._stateLabel.string = `战斗回放 · 第${waveIndex + 1}波`;
    }

    private completeReplay(cancelled: boolean): void {
        if (cancelled) {
            this._runToken++;
            this._animationPlayer.reset();
            this.renderAll(null);
        }
        this._replayActive = false;
        this.refreshControlLabels();
        if (this._resultLayer) this._resultLayer.active = true;
        if (this._stateLabel) this._stateLabel.string = cancelled ? '已退出战斗回放' : '战斗回放结束';
    }

    private showStageSelection(): void {
        if (!this._stageSelectLayer) return;
        this._stageSelectLayer.active = true;
        if (this._resultLayer) this._resultLayer.active = false;
        const progress = this._rewardService.getProgress();
        if (this._stageSelectTitle) this._stageSelectTitle.string = '选择试炼关卡';
        for (const stage of Object.values(BATTLE_STAGE_CONFIG)) {
            const button = this._stageButtons.get(stage.id);
            if (!button) continue;
            const unlocked = progress.unlockedStageIds.includes(stage.id);
            const record = progress.stages[stage.id];
            const waves = stage.waves?.length ?? 1;
            const status = !unlocked
                ? '未解锁'
                : record
                    ? `已通关${record.clearCount}次 · 最佳${record.bestRounds}回合`
                    : '尚未通关';
            button.label.string = `${unlocked ? '' : '🔒 '}${stage.name}\n${waves}波敌人 · ${status}\n${this.formatRewardPreview(stage)}`;
            button.label.color = unlocked ? Color.WHITE : new Color(143, 151, 165);
        }
        if (this._roundLabel) this._roundLabel.string = '试炼关卡';
        if (this._stateLabel) this._stateLabel.string = '选择已解锁的关卡开始挑战';
        if (this._turnOrderLabel) this._turnOrderLabel.string = '';
    }

    private onStageSelected(stage: BattleStageConfig): void {
        const progress = this._rewardService.getProgress();
        if (!progress.unlockedStageIds.includes(stage.id)) {
            if (this._stageSelectTitle) this._stageSelectTitle.string = '请先通关上一关';
            return;
        }
        this._openArgs = { ...this._openArgs, stageId: stage.id, selectStage: false };
        if (this._stageSelectLayer) this._stageSelectLayer.active = false;
        this.restartBattle();
    }

    private formatRewardPreview(stage: BattleStageConfig): string {
        const rewards = [...stage.rewards.repeat, ...stage.rewards.firstClear]
            .map((reward) => `${ITEM_NAMES[String(reward.itemId)] ?? String(reward.itemId)}×${reward.amount}`)
            .join('  ');
        return `奖励：${rewards}`;
    }

    private refreshAnimationPreviewLabels(): void {
        const units = this._flow.units;
        const unit = units.length ? units[this._previewUnitIndex % units.length] : null;
        const option = ANIMATION_PREVIEW_OPTIONS[this._previewSequenceIndex];
        if (this._previewUnitLabel) this._previewUnitLabel.string = `对象：${unit?.name ?? '无'}`;
        if (this._previewSequenceLabel) this._previewSequenceLabel.string = `动画：${option.label}`;
    }

    private async playCurrentAnimationPreview(): Promise<void> {
        if (!this._animationPreviewActive) return;
        const units = this._flow.units;
        const unit = units.length ? units[this._previewUnitIndex % units.length] : null;
        if (!unit) return;
        const option = ANIMATION_PREVIEW_OPTIONS[this._previewSequenceIndex];
        const token = ++this._previewToken;
        const isCurrent = () => (
            this._animationPreviewActive
            && token === this._previewToken
            && this.isValid
            && this.node.activeInHierarchy
        );
        if (this._stateLabel) this._stateLabel.string = '动画资源加载中…';
        await this._animationPlayer.preload(units.map((item) => item.configId));
        if (!isCurrent()) return;
        this._animationPlayer.reset();
        if (this._stateLabel) this._stateLabel.string = `预览：${unit.name} · ${option.label}`;
        this.setActionText(`正在播放【${option.label}】`, [{
            type: 'skipTurn',
            targetUnitId: unit.id,
            message: '点击对象或动画按钮可继续切换，点击重播可重复查看。',
        }]);
        await this._animationPlayer.previewAnimation(unit.id, option.sequence, isCurrent);
    }

    private stopAutoBattle(resetAnimations = true): void {
        this.cancelManualDecision();
        this._paused = false;
        this._animationPlayer.setPaused(false);
        this.refreshControlLabels();
        this._runToken++;
        this._loopRunning = false;
        if (resetAnimations) this._animationPlayer.reset();
    }

    private setActiveActor(
        unitId: string | null,
        units: readonly BattleUnitState[] = this._flow.units,
    ): void {
        for (const unit of units) {
            const view = this._unitViews.get(unit.id);
            if (!view) continue;
            view.turnLabel.string = unit.currentHp <= 0
                ? '已阵亡'
                : unit.id === unitId ? '◆ 行动中 ◆' : '';
        }
    }

    private splitActionLogs(
        logs: readonly BattleLogEntry[],
        actorId: string,
    ): { primaryLogs: BattleLogEntry[]; reactionGroups: BattleLogEntry[][] } {
        const primaryLogs: BattleLogEntry[] = [];
        const reactionBySource = new Map<string, BattleLogEntry[]>();
        for (const log of logs) {
            const sourceId = log.sourceUnitId;
            if (!sourceId || sourceId === actorId) {
                primaryLogs.push(log);
                continue;
            }
            const group = reactionBySource.get(sourceId) ?? [];
            group.push(log);
            reactionBySource.set(sourceId, group);
        }
        return { primaryLogs, reactionGroups: Array.from(reactionBySource.values()) };
    }

    /** 根据本段日志推进展示快照，最终权威状态仍以 FlowController 的阶段快照为准。 */
    private applyVisualLogs(
        units: readonly BattleUnitState[],
        logs: readonly BattleLogEntry[],
        authoritativeUnits: readonly BattleUnitState[],
    ): BattleUnitState[] {
        const result = cloneBattleUnits(units);
        for (const log of logs) {
            const unit = result.find((item) => item.id === log.targetUnitId);
            if (!unit) continue;
            const value = Math.max(0, log.value ?? 0);
            if (log.type === 'damage') unit.currentHp = Math.max(0, unit.currentHp - value);
            if (log.type === 'heal') {
                unit.currentHp = Math.min(unit.attributes.maxHp, unit.currentHp + value);
            }
            if ((log.type === 'buffApplied' || log.type === 'shield') && log.buffId) {
                const authoritative = authoritativeUnits
                    .find((item) => item.id === unit.id)
                    ?.buffs.find((buff) => buff.buffId === log.buffId);
                if (authoritative) {
                    const index = unit.buffs.findIndex((buff) => buff.buffId === log.buffId);
                    if (index >= 0) unit.buffs[index] = { ...authoritative };
                    else unit.buffs.push({ ...authoritative });
                }
            }
            if (log.type === 'buffRemoved' && log.buffId) {
                unit.buffs = unit.buffs.filter((buff) => buff.buffId !== log.buffId);
            }
            if (log.type === 'defeated') unit.currentHp = 0;
        }
        return result;
    }

    private isCurrentRun(token: number): boolean {
        return token === this._runToken && this.isValid && this.node.activeInHierarchy;
    }

    private delay(milliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, milliseconds / this._playbackSpeed));
    }

    private onBack(): void {
        oops.gui.remove(UIID.Battle, false);
    }
}
