import { _decorator, Component, Node, warn } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';

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
    private readonly _popupBindings: Array<{
        node: Node;
        handler: () => void;
    }> = [];

    protected onLoad(): void {
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
            this._battleButton.on(Node.EventType.TOUCH_END, this.openBattle, this);
        }

        this.bindPopup('bg/leftBtn/btn_daily_gift', UIID.DailyWelfare, '每日福利');
        this.bindPopup('bg/leftBtn/btn_limited', UIID.LimitedTimeEvents, '限时活动');
        this.bindPopup('bg/leftBtn/btn_server_rank', UIID.ServerOpeningRanking, '开服冲榜');
        this.bindPopup('bg/leftBtn/btn_pack', UIID.BestValueGiftPacks, '超值礼包');
        this.bindPopup('bg/rigth/btn_day_login', UIID.SevenDayLogin, '七日登录');
        this.bindPopup('bg/rigth/btn_encounter', UIID.ImmortalFateEncounter, '仙缘奇遇');
        this.bindPopup('bg/rigth/btn_server_rank', UIID.GrowthFund, '成长基金');
        this.bindPopup('bg/rigth/btn_pack', UIID.CumulativeRechargeRewards, '累充好礼');
    }

    protected onDestroy(): void {
        this._roleButton?.off(Node.EventType.TOUCH_END, this.openRole, this);
        this._battleButton?.off(Node.EventType.TOUCH_END, this.openBattle, this);
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

    /** 打开固定 5v5 演示战斗。 */
    openBattle(): void {
        if (oops.gui.has(UIID.Battle)) return;
        oops.gui.open(UIID.Battle, null, {
            onLoadFailure: () => warn('[MainMain] 战斗界面加载失败，请检查 battle bundle。'),
        });
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
