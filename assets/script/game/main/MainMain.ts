import { _decorator, Component, director, Label, Node, warn } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { GameStorage } from '../../core/GameStorage';
import { GAME_EVENT_RESOURCE_CHANGED, GAME_EVENT_TASK_CHANGED } from '../../core/GameEvents';
import { ItemService } from '../item/ItemService';
import { TaskService } from '../task/TaskService';

const { ccclass, menu } = _decorator;

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) {
            return null;
        }
    }
    return current;
}

/** 游戏主界面入口控制器。 */
@ccclass('MainMain')
@menu('Game/Main/MainMain')
export class MainMain extends Component {
    private _roleButton: Node | null = null;
    private _battleButton: Node | null = null;
    private _teamButton: Node | null = null;
    private _summonButton: Node | null = null;
    private _taskButton: Node | null = null;
    private readonly _tasks = new TaskService();
    private readonly _popupBindings: Array<{
        node: Node;
        handler: () => void;
    }> = [];

    protected onLoad(): void {
        this.ensureStarterResources();
        director.on(GAME_EVENT_RESOURCE_CHANGED, this.refreshCurrencyHud, this);
        director.on(GAME_EVENT_TASK_CHANGED, this.refreshTaskHud, this);
        this._roleButton = findChild(this.node, 'bg/bottom/btn_role');
        if (!this._roleButton) {
            warn('[MainMain] 找不到角色按钮：bg/bottom/btn_role');
        }
        else {
            this._roleButton.on(Node.EventType.TOUCH_END, this.openRole, this);
        }

        this._battleButton = findChild(this.node, 'bg/bottom/btn_battle');
        if (!this._battleButton) {
            warn('[MainMain] 找不到战斗按钮：bg/bottom/btn_battle');
        }
        else {
            this._battleButton.on(Node.EventType.TOUCH_END, this.openTeam, this);
        }

        this._teamButton = findChild(this.node, 'bg/bottom/btn_team');
        this._teamButton?.on(Node.EventType.TOUCH_END, this.openTeam, this);
        this._summonButton = findChild(this.node, 'bg/bottom/btn_dao');
        const summonLabel = this._summonButton?.getChildByName('Label')?.getComponent(Label);
        if (summonLabel) summonLabel.string = '召唤';
        this._summonButton?.on(Node.EventType.TOUCH_END, this.openSummon, this);

        this._taskButton = findChild(this.node, 'bg/task');
        if (!this._taskButton) warn('[MainMain] 找不到任务入口：bg/task');
        this._taskButton?.on(Node.EventType.TOUCH_END, this.openTask, this);

        this.bindPopup('bg/leftBtn/btn_daily_gift', UIID.DailyWelfare, '每日福利');
        this.bindPopup('bg/leftBtn/btn_limited', UIID.LimitedTimeEvents, '限时活动');
        this.bindPopup('bg/leftBtn/btn_server_rank', UIID.ServerOpeningRanking, '开服冲榜');
        this.bindPopup('bg/leftBtn/btn_pack', UIID.BestValueGiftPacks, '超值礼包');
        this.bindPopup('bg/rigth/btn_day_login', UIID.SevenDayLogin, '七日登录');
        this.bindPopup('bg/rigth/btn_encounter', UIID.ImmortalFateEncounter, '仙缘奇遇');
        this.bindPopup('bg/rigth/btn_server_rank', UIID.GrowthFund, '成长基金');
        this.bindPopup('bg/rigth/btn_pack', UIID.CumulativeRechargeRewards, '累充好礼');
    }

    protected onEnable(): void {
        this._tasks.report('login');
        this.refreshCurrencyHud();
        this.refreshTaskHud();
    }

    protected onDestroy(): void {
        director.off(GAME_EVENT_RESOURCE_CHANGED, this.refreshCurrencyHud, this);
        director.off(GAME_EVENT_TASK_CHANGED, this.refreshTaskHud, this);
        this._roleButton?.off(Node.EventType.TOUCH_END, this.openRole, this);
        this._battleButton?.off(Node.EventType.TOUCH_END, this.openTeam, this);
        this._teamButton?.off(Node.EventType.TOUCH_END, this.openTeam, this);
        this._summonButton?.off(Node.EventType.TOUCH_END, this.openSummon, this);
        this._taskButton?.off(Node.EventType.TOUCH_END, this.openTask, this);
        for (const binding of this._popupBindings) {
            binding.node.off(Node.EventType.TOUCH_END, binding.handler, this);
        }
        this._popupBindings.length = 0;
    }

    /** 打开角色界面；首次按需加载，之后复用已创建的页面。 */
    openRole(): void {
        // has 同时包含正在加载的页面，由框架统一防重和复用缓存。
        if (oops.gui.has(UIID.Role)) return;
        oops.gui.open(UIID.Role, null, {
            onLoadFailure: () => warn('[MainMain] 角色界面加载失败，请重新点击角色按钮。'),
        });
    }

    /** 打开关卡选择；选择后战斗页会从角色存档自动选择最多5名角色。 */
    openBattle(): void {
        if (oops.gui.has(UIID.Battle)) return;
        oops.gui.open(UIID.Battle, { selectStage: true }, {
            onLoadFailure: () => warn('[MainMain] 战斗界面加载失败，请检查 battle bundle。'),
        });
    }

    openTeam(): void {
        if (oops.gui.has(UIID.Team)) return;
        oops.gui.open(UIID.Team, null, {
            onLoadFailure: () => warn('[MainMain] 编队界面加载失败，请检查 team bundle。'),
        });
    }

    openSummon(): void {
        if (oops.gui.has(UIID.Summon)) return;
        oops.gui.open(UIID.Summon, null, {
            onLoadFailure: () => warn('[MainMain] 召唤界面加载失败，请检查 team bundle。'),
        });
    }

    openTask(): void {
        if (oops.gui.has(UIID.Task)) return;
        oops.gui.open(UIID.Task, null, {
            onLoadFailure: () => warn('[MainMain] 任务界面加载失败，请检查 team bundle。'),
        });
    }

    private ensureStarterResources(): void {
        const key = 'fangzhi.starter-resources-v1';
        if (GameStorage.load<boolean>(key) === true) return;
        const items = new ItemService();
        items.addMany([
            { itemId: 'currency.gold', amount: 30000 },
            { itemId: 'currency.jade', amount: 2000 },
            { itemId: 'currency.crystal', amount: 150 },
            { itemId: 'consumable.qi-pill', amount: 100 },
        ]);
        GameStorage.save(key, true);
    }

    private refreshCurrencyHud(): void {
        const items = new ItemService();
        // money 使用仙玉图标，money-001 使用金币图标；按实际 prefab 图标绑定，避免数值错位。
        const jade = findChild(this.node, 'bg/top/money/num')?.getComponent(Label);
        const gold = findChild(this.node, 'bg/top/money-001/num')?.getComponent(Label);
        if (gold) gold.string = String(items.getAmount('currency.gold'));
        if (jade) jade.string = String(items.getAmount('currency.jade'));
    }

    private refreshTaskHud(): void {
        const summary = this._tasks.getSummary();
        const title = findChild(this.node, 'bg/task/name')?.getComponent(Label);
        const description = findChild(this.node, 'bg/task/des')?.getComponent(Label);
        if (title) title.string = '任务';
        if (description) {
            const task = summary.activeMain;
            description.string = task
                ? `${summary.claimableCount > 0 ? `可领${summary.claimableCount} · ` : ''}${task.title}\n${task.progress}/${task.target}`
                : '主线已完成';
        }
    }

    private bindPopup(path: string, uiId: UIID, title: string): void {
        const node = findChild(this.node, path);
        if (!node) {
            warn(`[MainMain] 找不到${title}按钮：${path}`);
            return;
        }

        const handler = () => this.openPopup(uiId, title);
        node.on(Node.EventType.TOUCH_END, handler, this);
        this._popupBindings.push({ node, handler });
    }

    private openPopup(uiId: UIID, title: string): void {
        if (oops.gui.has(uiId)) return;
        oops.gui.open(uiId, null, {
            onLoadFailure: () => warn(`[MainMain] ${title}弹窗加载失败，请重新点击入口。`),
        });
    }
}
