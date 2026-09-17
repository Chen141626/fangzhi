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
import { BATTLE_BUFF_CONFIG } from './BattleBuffConfig';
import { BattleDemoUnitConfig, BATTLE_DEMO_ALLIES, BATTLE_DEMO_ENEMIES } from './BattleDemoConfig';
import { BattleFlowController, BattleStepResult } from './BattleFlowController';
import { BattleCamp, BattleLogEntry, BattleUnitState } from './BattleEffectTypes';

const { ccclass, menu } = _decorator;

interface BattleUnitView {
    item: Node;
    icon: Sprite | null;
    hpBar: ProgressBar | null;
    nameLabel: Label;
    hpLabel: Label;
    buffLabel: Label;
    turnLabel: Label;
}

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
    private readonly _unitViews = new Map<string, BattleUnitView>();
    private _backButton: Node | null = null;
    private _roundLabel: Label | null = null;
    private _stateLabel: Label | null = null;
    private _actionLabel: Label | null = null;
    private _resultLayer: Node | null = null;
    private _resultLabel: Label | null = null;
    private _restartButton: Node | null = null;

    protected onLoad(): void {
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
        this.unschedule(this.advanceBattle);
    }

    protected onDestroy(): void {
        this._backButton?.off(Node.EventType.TOUCH_END, this.onBack, this);
        this._restartButton?.off(Node.EventType.TOUCH_END, this.restartBattle, this);
    }

    /** 固定阵容重新开战，也供结果面板按钮调用。 */
    restartBattle(): void {
        this.unschedule(this.advanceBattle);
        this._resultLayer && (this._resultLayer.active = false);
        const startResult = this._flow.start();
        this.attachUnitsToViews('ally', BATTLE_DEMO_ALLIES);
        this.attachUnitsToViews('enemy', BATTLE_DEMO_ENEMIES);
        this.renderAll(null);
        this.setActionText('双方入场，战斗开始！', startResult.logs);
        if (this._roundLabel) this._roundLabel.string = '准备回合';
        if (this._stateLabel) this._stateLabel.string = '自动战斗 · 5 vs 5';
        this.scheduleOnce(this.startAutoBattle, 0.65);
    }

    private startAutoBattle(): void {
        if (this._flow.status !== 'running') return;
        this.advanceBattle();
        this.schedule(this.advanceBattle, 0.85);
    }

    private advanceBattle(): void {
        if (this._flow.status !== 'running') {
            this.finishBattle();
            return;
        }

        const step = this._flow.step();
        this.renderAll(step.actorId);
        this.renderStep(step);
        if (step.status === 'finished') this.finishBattle();
    }

    private renderStep(step: BattleStepResult): void {
        if (this._roundLabel) this._roundLabel.string = `第 ${step.round} 回合`;
        const actor = this._flow.units.find((unit) => unit.id === step.actorId);
        const headline = actor && step.skill
            ? `${actor.name} 施放【${step.skill.name}】`
            : actor
                ? `${actor.name} 的回合`
                : '回合推进';
        this.setActionText(headline, step.logs);
    }

    private finishBattle(): void {
        this.unschedule(this.advanceBattle);
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
        const allyItems = findChild(this.node, 'bg/leftNode')?.children ?? [];
        const enemyItems = findChild(this.node, 'bg/leftNode-001')?.children ?? [];
        this.createSlotViews(allyItems.slice(0, 5), 'ally');
        this.createSlotViews(enemyItems.slice(0, 5), 'enemy');
    }

    private createSlotViews(items: Node[], camp: BattleCamp): void {
        items.forEach((item, index) => {
            const unitId = `${camp}_${camp === 'ally' ? index + 1 : index + 6}`;
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
                icon: findChild(item, 'icon')?.getComponent(Sprite) ?? null,
                hpBar: findChild(item, 'hp')?.getComponent(ProgressBar) ?? null,
                nameLabel,
                hpLabel,
                buffLabel,
                turnLabel,
            });
        });
    }

    private attachUnitsToViews(camp: BattleCamp, configs: readonly BattleDemoUnitConfig[]): void {
        const units = this._flow.units.filter((unit) => unit.camp === camp);
        units.forEach((unit, index) => {
            const view = this._unitViews.get(unit.id);
            const config = configs[index];
            if (!view || !config) return;
            view.item.active = true;
            resources.load(config.iconPath, SpriteFrame, (error, spriteFrame) => {
                if (error || !spriteFrame) {
                    warn(`[BattleMain] 角色图标加载失败：${config.iconPath}`);
                    return;
                }
                if (view.icon?.isValid) view.icon.spriteFrame = spriteFrame;
            });
        });
    }

    private renderAll(activeActorId: string | null): void {
        for (const unit of this._flow.units) {
            const view = this._unitViews.get(unit.id);
            if (!view) continue;
            const hpRate = Math.max(0, unit.currentHp / unit.attributes.maxHp);
            if (view.hpBar) view.hpBar.progress = hpRate;
            view.nameLabel.string = unit.name;
            view.hpLabel.string = `${Math.ceil(unit.currentHp)} / ${unit.attributes.maxHp}`;
            view.buffLabel.string = this.formatBuffs(unit);
            view.turnLabel.string = unit.currentHp <= 0
                ? '已阵亡'
                : unit.id === activeActorId ? '◆ 行动中 ◆' : '';
            if (view.icon) view.icon.color = unit.currentHp > 0
                ? Color.WHITE
                : new Color(78, 78, 78, 180);
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

    private onBack(): void {
        oops.gui.remove(UIID.Battle, false);
    }
}
