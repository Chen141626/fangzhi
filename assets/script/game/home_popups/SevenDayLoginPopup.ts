import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    EventTouch,
    Node,
    Sprite,
    warn,
} from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { ItemAmount, ItemService } from '../item/ItemService';
import { HomePopupState } from './HomePopupState';

const { ccclass, menu } = _decorator;

const LOGIN_STATE_KEY = 'seven-day-login';
const COLOR_NORMAL = new Color(255, 255, 255, 255);
const COLOR_CLAIMED = new Color(135, 145, 158, 255);

const DAILY_REWARDS: ReadonlyArray<{
    items: readonly ItemAmount[];
    description: string;
}> = [
    { items: [{ itemId: 'currency.jade', amount: 100 }], description: '仙玉×100' },
    { items: [{ itemId: 'currency.gold', amount: 500 }], description: '金币×500' },
    { items: [{ itemId: 'consumable.qi-pill', amount: 3 }], description: '聚气丹×3' },
    { items: [{ itemId: 'currency.crystal', amount: 50 }], description: '仙晶×50' },
    { items: [{ itemId: 'item.cultivation-scroll', amount: 1 }], description: '修炼卷轴×1' },
    { items: [{ itemId: 'item.reward-chest', amount: 1 }], description: '珍稀宝箱×1' },
    {
        items: [
            { itemId: 'item.reward-chest', amount: 1 },
            { itemId: 'currency.crystal', amount: 100 },
        ],
        description: '七日宝箱×1、仙晶×100',
    },
];

interface TouchBinding {
    node: Node;
    handler: (event: EventTouch) => void;
}

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

/** 七日登录弹窗：按自然日持久化签到进度，并将奖励发放到统一背包。 */
@ccclass('SevenDayLoginPopup')
@menu('Game/Home Popups/SevenDayLoginPopup')
export class SevenDayLoginPopup extends Component {
    private readonly _bindings: TouchBinding[] = [];
    private _claimButton: Node | null = null;
    private _claimState: Node | null = null;
    private _state!: HomePopupState;
    private _items!: ItemService;

    protected onLoad(): void {
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);

        this._state = new HomePopupState();
        this._items = new ItemService();
        this._claimButton = findChild(this.node, 'panel/footer/btn_claim');
        this._claimState = findChild(this.node, 'panel/footer/claim_state');

        this.bindTouch('panel/header/btn_close', () => this.close());
        this.bindTouch('panel/footer/btn_claim', () => this.claimToday());
        for (let day = 1; day <= DAILY_REWARDS.length; day++) {
            const dayText = String(day).padStart(2, '0');
            this.bindTouch(`panel/content/rewards/day_${dayText}`, () => this.showDayStatus(day));
        }

        if (!this._claimButton || !this._claimState) {
            warn('[SevenDayLoginPopup] 弹窗节点结构不完整。');
        }
    }

    protected onEnable(): void {
        if (this._state) {
            this._items.reload();
            this.refreshClaimState();
        }
    }

    protected onDestroy(): void {
        for (const binding of this._bindings) {
            binding.node.off(Node.EventType.TOUCH_END, binding.handler, this);
        }
        this._bindings.length = 0;
    }

    private claimToday(): void {
        const claimedDays = this._state.getDailyClaimCount(LOGIN_STATE_KEY);
        if (claimedDays >= DAILY_REWARDS.length) {
            this.toast('七日登录奖励已全部领取');
            return;
        }
        if (this._state.isClaimedToday(LOGIN_STATE_KEY)) {
            this.toast('今日登录奖励已经领取');
            return;
        }

        const reward = DAILY_REWARDS[claimedDays];
        if (!this._state.claimToday(LOGIN_STATE_KEY)) return;

        this._items.reload();
        this._items.addMany(reward.items);
        this.toast(`第 ${claimedDays + 1} 天领取成功：${reward.description}`);
        this.refreshClaimState();
    }

    private showDayStatus(day: number): void {
        const claimedDays = this._state.getDailyClaimCount(LOGIN_STATE_KEY);
        if (day <= claimedDays) {
            this.toast(`第 ${day} 天奖励已领取`);
            return;
        }
        if (day === claimedDays + 1 && !this._state.isClaimedToday(LOGIN_STATE_KEY)) {
            this.toast(`今日可领取：${DAILY_REWARDS[day - 1].description}`);
            return;
        }
        this.toast(`连续登录第 ${day} 天可领取：${DAILY_REWARDS[day - 1].description}`);
    }

    private refreshClaimState(): void {
        const claimedDays = this._state.getDailyClaimCount(LOGIN_STATE_KEY);
        const unavailable = claimedDays >= DAILY_REWARDS.length
            || this._state.isClaimedToday(LOGIN_STATE_KEY);

        if (this._claimState) this._claimState.active = unavailable;
        this.tintNode(this._claimButton, unavailable ? COLOR_CLAIMED : COLOR_NORMAL);

        for (let day = 1; day <= DAILY_REWARDS.length; day++) {
            const dayText = String(day).padStart(2, '0');
            const card = findChild(this.node, `panel/content/rewards/day_${dayText}`);
            this.tintNode(card, day <= claimedDays ? COLOR_CLAIMED : COLOR_NORMAL);
        }
    }

    private bindTouch(path: string, action: () => void): void {
        const node = findChild(this.node, path);
        if (!node) {
            warn(`[SevenDayLoginPopup] 缺少交互节点：${path}`);
            return;
        }

        const handler = (event: EventTouch) => {
            event.propagationStopped = true;
            action();
        };
        node.on(Node.EventType.TOUCH_END, handler, this);
        this._bindings.push({ node, handler });
    }

    private tintNode(node: Node | null, color: Color): void {
        if (!node) return;
        for (const sprite of node.getComponentsInChildren(Sprite)) {
            sprite.color = color;
        }
    }

    private toast(message: string): void {
        oops.gui.toast(message);
    }

    private close(): void {
        oops.gui.remove(UIID.SevenDayLogin, false);
    }
}
