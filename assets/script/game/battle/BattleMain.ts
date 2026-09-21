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
    resources,
    Sprite,
    SpriteFrame,
    UITransform,
    VerticalTextAlignment,
    warn,
} from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { BattleAnimationSequence } from './BattleAnimationConfig';
import { BattleAnimationPlayer } from './BattleAnimationPlayer';
import { BATTLE_BUFF_CONFIG } from './BattleBuffConfig';
import {
    BattleDemoUnitConfig,
    BATTLE_DEMO_ALLIES,
    BATTLE_DEMO_ENEMIES,
    validateBattleDemoConfig,
} from './BattleDemoConfig';
import { BattleFlowController, BattleStepResult, cloneBattleUnits } from './BattleFlowController';
import { BattleCamp, BattleLogEntry, BattleUnitState } from './BattleEffectTypes';

const { ccclass, menu } = _decorator;

interface BattleUnitView {
    item: Node;
    overlay: Node;
    icon: Sprite | null;
    hpBar: ProgressBar | null;
    nameLabel: Label;
    hpLabel: Label;
    buffLabel: Label;
    turnLabel: Label;
}

interface RuntimeButton {
    node: Node;
    label: Label;
}

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

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

/** battle.prefab 的演示战斗控制器。 */
@ccclass('BattleMain')
@menu('Game/Battle/BattleMain')
export class BattleMain extends Component {
    private readonly _flow = new BattleFlowController();
    private readonly _animationPlayer = new BattleAnimationPlayer();
    private readonly _unitViews = new Map<string, BattleUnitView>();
    private _backButton: Node | null = null;
    private _roundLabel: Label | null = null;
    private _stateLabel: Label | null = null;
    private _actionLabel: Label | null = null;
    private _resultLayer: Node | null = null;
    private _resultLabel: Label | null = null;
    private _restartButton: Node | null = null;
    private _animationPreviewPanel: Node | null = null;
    private _animationPreviewToggleButton: Node | null = null;
    private _animationPreviewToggleLabel: Label | null = null;
    private _previewUnitButton: Node | null = null;
    private _previewUnitLabel: Label | null = null;
    private _previewSequenceButton: Node | null = null;
    private _previewSequenceLabel: Label | null = null;
    private _previewReplayButton: Node | null = null;
    private _animationPreviewActive = false;
    private _previewUnitIndex = 0;
    private _previewSequenceIndex = 0;
    private _previewToken = 0;
    private _runToken = 0;
    private _loopRunning = false;

    protected onLoad(): void {
        validateBattleDemoConfig();
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);
        this._backButton = findChild(this.node, 'btn_back');
        this._backButton?.on(Node.EventType.TOUCH_END, this.onBack, this);
        this.buildRuntimeHierarchy();
        this.bindUnitSlots();
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
        this._animationPreviewToggleButton?.off(
            Node.EventType.TOUCH_END, this.onAnimationPreviewToggle, this,
        );
        this._previewUnitButton?.off(Node.EventType.TOUCH_END, this.onPreviewUnitSwitch, this);
        this._previewSequenceButton?.off(Node.EventType.TOUCH_END, this.onPreviewSequenceSwitch, this);
        this._previewReplayButton?.off(Node.EventType.TOUCH_END, this.onPreviewReplay, this);
    }

    /** 固定阵容重新开战，也供结果面板按钮调用。 */
    restartBattle(): void {
        this._animationPreviewActive = false;
        this._previewToken++;
        if (this._animationPreviewPanel) this._animationPreviewPanel.active = false;
        if (this._animationPreviewToggleLabel) this._animationPreviewToggleLabel.string = '动画预览';
        this.stopAutoBattle();
        const token = this._runToken;
        this._resultLayer && (this._resultLayer.active = false);
        const startResult = this._flow.start();
        const portraitLoading = Promise.all([
            this.attachUnitsToViews('ally', BATTLE_DEMO_ALLIES, token),
            this.attachUnitsToViews('enemy', BATTLE_DEMO_ENEMIES, token),
        ]).then(() => undefined);
        this.renderAll(null);
        this.setActionText('双方入场，战斗开始！', startResult.logs);
        if (this._roundLabel) this._roundLabel.string = '准备回合';
        if (this._stateLabel) this._stateLabel.string = '动画资源加载中…';
        void this.prepareAndRunBattle(token, portraitLoading);
    }

    private async prepareAndRunBattle(token: number, portraitLoading: Promise<void>): Promise<void> {
        await Promise.all([
            portraitLoading,
            this._animationPlayer.preload(this._flow.units.map((unit) => unit.configId)),
        ]);
        if (!this.isCurrentRun(token)) return;
        this._animationPlayer.reset();
        if (this._stateLabel) this._stateLabel.string = '自动战斗 · 5 vs 5';
        await this.delay(350);
        if (!this.isCurrentRun(token)) return;
        await this.runBattleLoop(token);
    }

    private async runBattleLoop(token: number): Promise<void> {
        if (this._loopRunning || !this.isCurrentRun(token)) return;
        this._loopRunning = true;
        while (this.isCurrentRun(token) && this._flow.status === 'running') {
            const step = this._flow.step();
            this.setActiveActor(step.actorId, step.beforeUnits);
            this.renderStep(step);
            await this.playBattleStep(step, token);
            if (!this.isCurrentRun(token)) return;
            this.renderAll(step.actorId, step.turnEndUnits);
            if (step.status === 'finished') break;
            await this.delay(160);
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
        if (this._roundLabel) this._roundLabel.string = `第 ${step.round} 回合`;
        const actor = this._flow.units.find((unit) => unit.id === step.actorId);
        const headline = actor && step.skill
            ? `${actor.name} 准备施放【${step.skill.name}】`
            : actor
                ? `${actor.name} 的回合`
                : '回合推进';
        this.setActionText(headline, []);
    }

    private finishBattle(): void {
        this.stopAutoBattle();
        if (!this._resultLayer || !this._resultLabel) return;
        this._resultLayer.active = true;
        const result = this._flow.winner === 'ally'
            ? '战斗胜利'
            : this._flow.winner === 'enemy'
                ? '战斗失败'
                : '战斗平局';
        this._resultLabel.string = `${result}\n历经 ${this._flow.round} 回合`;
        if (this._stateLabel) this._stateLabel.string = '战斗结束';
    }

    private bindUnitSlots(): void {
        const allyItems = (findChild(this.node, 'bg/leftNode')?.children ?? [])
            .filter((child) => child.name.startsWith('roleItem'));
        const enemyItems = (findChild(this.node, 'bg/leftNode-001')?.children ?? [])
            .filter((child) => child.name.startsWith('roleItem'));
        if (allyItems.length < BATTLE_DEMO_ALLIES.length || enemyItems.length < BATTLE_DEMO_ENEMIES.length) {
            warn(`[BattleMain] 战斗站位不足：角色${allyItems.length}个，怪物${enemyItems.length}个。`);
        }
        this.createSlotViews(allyItems.slice(0, 5), 'ally');
        this.createSlotViews(enemyItems.slice(0, 5), 'enemy');
    }

    private createSlotViews(items: Node[], camp: BattleCamp): void {
        items.forEach((item, index) => {
            const unitId = `${camp}_${index + 1}`;
            const overlay = new Node('battleInfo');
            overlay.layer = this.node.layer;
            overlay.setScale(camp === 'enemy' ? -1 : 1, 1, 1);
            item.addChild(overlay);

            const nameLabel = this.createLabel(overlay, 'name', 0, 188, 230, 34, 24, new Color(255, 244, 192));
            const hpLabel = this.createLabel(overlay, 'hpText', 22, 139, 190, 24, 18, Color.WHITE);
            const buffLabel = this.createLabel(overlay, 'buffs', 0, 103, 260, 50, 17, new Color(174, 235, 255));
            const turnLabel = this.createLabel(overlay, 'turnMark', 0, 225, 190, 28, 20, new Color(255, 214, 77));

            this._unitViews.set(unitId, {
                item,
                overlay,
                icon: findChild(item, 'icon')?.getComponent(Sprite) ?? null,
                hpBar: findChild(item, 'hp')?.getComponent(ProgressBar) ?? null,
                nameLabel,
                hpLabel,
                buffLabel,
                turnLabel,
            });
        });
    }

    private attachUnitsToViews(
        camp: BattleCamp,
        configs: readonly BattleDemoUnitConfig[],
        token: number,
    ): Promise<void> {
        const units = this._flow.units.filter((unit) => unit.camp === camp);
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
                resources.load(config.iconPath, SpriteFrame, (error, spriteFrame) => {
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
        card.addComponent(UITransform).setContentSize(560, 330);
        const cardGraphics = card.addComponent(Graphics);
        cardGraphics.fillColor = new Color(25, 40, 68, 245);
        cardGraphics.roundRect(-280, -165, 560, 330, 34);
        cardGraphics.fill();
        this._resultLayer.addChild(card);
        this._resultLabel = this.createLabel(card, 'resultText', 0, 55, 480, 130, 42, new Color(255, 226, 129));

        this._restartButton = new Node('btn_restart');
        this._restartButton.layer = this.node.layer;
        this._restartButton.setPosition(0, -92);
        this._restartButton.addComponent(UITransform).setContentSize(260, 78);
        const buttonGraphics = this._restartButton.addComponent(Graphics);
        buttonGraphics.fillColor = new Color(46, 137, 204, 255);
        buttonGraphics.roundRect(-130, -39, 260, 78, 24);
        buttonGraphics.fill();
        card.addChild(this._restartButton);
        this.createLabel(this._restartButton, 'Label', 0, 0, 220, 60, 30, Color.WHITE).string = '再次挑战';
        this._restartButton.on(Node.EventType.TOUCH_END, this.restartBattle, this);
        this._resultLayer.active = false;

        // 返回按钮始终高于结算遮罩，保证战斗结束后仍可退出页面。
        this._backButton?.setSiblingIndex(this.node.children.length - 1);
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

    private stopAutoBattle(): void {
        this._runToken++;
        this._loopRunning = false;
        this._animationPlayer.reset();
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
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    private onBack(): void {
        oops.gui.remove(UIID.Battle, false);
    }
}
