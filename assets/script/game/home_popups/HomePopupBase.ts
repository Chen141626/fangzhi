import {
    _decorator,
    BlockInputEvents,
    CCInteger,
    Color,
    Component,
    EventTouch,
    Node,
    Sprite,
    Tween,
    tween,
    Vec3,
    warn,
} from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { loadPlayerRoleData } from '../../model/PlayerRoleData';
import { ItemAmount, ItemService } from '../item/ItemService';
import {
    HOME_POPUP_ACTION_EVENT,
    HomePopupAction,
    HomePopupState,
} from './HomePopupState';

const { ccclass, menu, property } = _decorator;

const COLOR_NORMAL = new Color(255, 255, 255, 255);
const COLOR_DISABLED = new Color(135, 145, 158, 255);
const COLOR_UNSELECTED = new Color(150, 160, 176, 255);
const ACTION_THROTTLE_MS = 160;

const ITEM_JADE = 'currency.jade';
const ITEM_GOLD = 'currency.gold';
const ITEM_CRYSTAL = 'currency.crystal';
const ITEM_QI_PILL = 'consumable.qi-pill';
const ITEM_REWARD_CHEST = 'item.reward-chest';
const ITEM_CULTIVATION_ORB = 'item.cultivation-orb';

interface GrowthReward {
    level: number;
    items: readonly ItemAmount[];
    description: string;
}

const GROWTH_REWARDS: readonly GrowthReward[] = [
    {
        level: 10,
        items: [{ itemId: ITEM_GOLD, amount: 1000 }],
        description: '金币×1000',
    },
    {
        level: 20,
        items: [
            { itemId: ITEM_REWARD_CHEST, amount: 1 },
            { itemId: ITEM_JADE, amount: 300 },
        ],
        description: '成长宝箱×1、仙玉×300',
    },
    {
        level: 30,
        items: [
            { itemId: ITEM_CULTIVATION_ORB, amount: 2 },
            { itemId: ITEM_JADE, amount: 500 },
        ],
        description: '修炼灵珠×2、仙玉×500',
    },
    {
        level: 40,
        items: [
            { itemId: ITEM_REWARD_CHEST, amount: 2 },
            { itemId: ITEM_CRYSTAL, amount: 100 },
        ],
        description: '成长宝箱×2、仙晶×100',
    },
    {
        level: 50,
        items: [
            { itemId: ITEM_REWARD_CHEST, amount: 3 },
            { itemId: ITEM_CRYSTAL, amount: 300 },
        ],
        description: '成长宝箱×3、仙晶×300',
    },
];

interface TouchBinding {
    node: Node;
    handler: (event: EventTouch) => void;
}

interface LimitedTab {
    id: string;
    path: string;
    title: string;
}

const LIMITED_TABS: readonly LimitedTab[] = [
    { id: 'treasure', path: 'panel/content/tabs/tab_treasure_hunt', title: '寻宝活动' },
    { id: 'recharge', path: 'panel/content/tabs/tab_limited_recharge', title: '限时累充' },
    { id: 'login', path: 'panel/content/tabs/tab_login_gifts', title: '登录好礼' },
    { id: 'exchange', path: 'panel/content/tabs/tab_exchange', title: '限时兑换' },
    { id: 'packs', path: 'panel/content/tabs/tab_gift_packs', title: '特惠礼包' },
];

const ENCOUNTER_CHOICES = [
    { id: 'follow', path: 'panel/content/choices/follow_crane' },
    { id: 'pill', path: 'panel/content/choices/gift_pill' },
    { id: 'leave', path: 'panel/content/choices/leave_safely' },
] as const;

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

/**
 * 主界面活动弹窗通用控制器。
 *
 * 可在本地确定的领取行为会写入统一存档并发放到背包；付费、充值和活动跳转
 * 通过 HOME_POPUP_ACTION_EVENT 交给上层业务处理，不在界面层伪造结果。
 */
@ccclass('HomePopupBase')
@menu('Game/Home Popups/HomePopupBase')
export class HomePopupBase extends Component {
    @property({ type: CCInteger, tooltip: 'UIConfig 中注册的 UIID' })
    uiId = 0;

    private readonly _bindings: TouchBinding[] = [];
    private _state!: HomePopupState;
    private _items!: ItemService;

    protected onLoad(): void {
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);

        this._state = new HomePopupState();
        this._items = new ItemService();
        this.bindTouch('panel/header/btn_close', () => this.close());
        this.bindPopupActions();
    }

    protected onEnable(): void {
        if (this._state) {
            this._items.reload();
            this.refreshVisualState();
        }
    }

    protected onDestroy(): void {
        for (const binding of this._bindings) {
            binding.node.off(Node.EventType.TOUCH_END, binding.handler, this);
        }
        this._bindings.length = 0;
    }

    private bindPopupActions(): void {
        switch (this.uiId) {
            case UIID.BestValueGiftPacks:
                this.bindBestValueGiftPacks();
                break;
            case UIID.CumulativeRechargeRewards:
                this.bindCumulativeRechargeRewards();
                break;
            case UIID.DailyWelfare:
                this.bindDailyWelfare();
                break;
            case UIID.GrowthFund:
                this.bindGrowthFund();
                break;
            case UIID.ImmortalFateEncounter:
                this.bindImmortalFateEncounter();
                break;
            case UIID.LimitedTimeEvents:
                this.bindLimitedTimeEvents();
                break;
            case UIID.ServerOpeningRanking:
                this.bindServerOpeningRanking();
                break;
            default:
                warn(`[HomePopupBase] 未识别的 UIID：${this.uiId}`);
        }
    }

    private bindBestValueGiftPacks(): void {
        this.bindTouch(
            'panel/content/offers/daily_offer/btn_buy',
            () => this.requestBusinessAction('purchase', 'best-value.daily', '已提交每日特惠购买请求'),
            'panel/content/offers/daily_offer/card',
        );
        this.bindTouch(
            'panel/content/offers/supply_offer/btn_buy',
            () => this.requestBusinessAction('purchase', 'best-value.supply', '已提交修炼补给购买请求'),
            'panel/content/offers/supply_offer/card',
        );
        this.bindTouch(
            'panel/content/offers/crystal_offer/btn_buy',
            () => this.requestBusinessAction('purchase', 'best-value.crystal', '已提交仙晶礼包购买请求'),
            'panel/content/offers/crystal_offer/card',
        );
    }

    private bindCumulativeRechargeRewards(): void {
        this.bindTouch(
            'panel/content/reward_list/recharge_0060/row',
            () => this.toast('60 元档奖励已领取'),
        );
        this.bindTouch(
            'panel/content/reward_list/recharge_0300/row',
            () => this.requestBusinessAction(
                'claim',
                'cumulative-recharge.300',
                '已提交 300 元档奖励领取请求',
            ),
        );
        this.bindTouch(
            'panel/content/reward_list/recharge_1000/row',
            () => this.toast('累计充值尚未达到 1000 元'),
        );
        this.bindTouch(
            'panel/content/reward_list/recharge_2000/row',
            () => this.toast('累计充值尚未达到 2000 元'),
        );
        this.bindTouch(
            'panel/footer/btn_go_recharge',
            () => this.requestBusinessAction('recharge', 'recharge-center', '已提交前往充值请求'),
        );
    }

    private bindDailyWelfare(): void {
        this.bindTouch('panel/footer/btn_claim_reward', () => this.claimDailyWelfare());
        for (const minutes of [10, 30, 60]) {
            this.bindTouch(
                `panel/content/online_rewards/chest_${minutes}m`,
                () => this.requestBusinessAction(
                    'claim',
                    `daily-welfare.online-${minutes}`,
                    `已提交 ${minutes} 分钟在线奖励领取请求`,
                ),
            );
        }
    }

    private bindGrowthFund(): void {
        for (const reward of GROWTH_REWARDS) {
            this.bindTouch(
                `panel/content/reward_list/level_${reward.level}/row`,
                () => this.claimGrowthReward(reward),
            );
        }
        this.bindTouch('panel/footer/btn_claim_all', () => this.claimAllGrowthRewards());
    }

    private bindImmortalFateEncounter(): void {
        for (const choice of ENCOUNTER_CHOICES) {
            this.bindTouch(choice.path, () => this.selectEncounterChoice(choice.id));
        }
        this.bindTouch('panel/footer/btn_confirm', () => this.confirmEncounterChoice());
    }

    private bindLimitedTimeEvents(): void {
        for (const tab of LIMITED_TABS) {
            this.bindTouch(tab.path, () => this.selectLimitedTab(tab));
        }

        this.bindTouch(
            'panel/content/task_list/task_daily_training/btn_action',
            () => this.requestBusinessAction('navigate', 'daily-training', '已提交前往日常修炼请求'),
            'panel/content/task_list/task_daily_training/row',
        );
        this.bindTouch(
            'panel/content/task_list/task_secret_realm/btn_action',
            () => this.requestBusinessAction('navigate', 'secret-realm', '已提交前往秘境请求'),
            'panel/content/task_list/task_secret_realm/row',
        );
        this.bindTouch(
            'panel/content/task_list/task_online/btn_action',
            () => this.toast('在线时长会自动累计'),
            'panel/content/task_list/task_online/row',
        );
        this.bindTouch(
            'panel/footer/btn_cloud_sea_treasure',
            () => this.requestBusinessAction('open-event', 'cloud-sea-treasure', '已提交进入云海寻宝请求'),
        );
    }

    private bindServerOpeningRanking(): void {
        this.bindTouch('panel/footer/btn_power_up', () => {
            this.close();
            if (!oops.gui.has(UIID.Role)) {
                oops.gui.open(UIID.Role, null, {
                    onLoadFailure: () => warn('[HomePopupBase] 角色界面加载失败。'),
                });
            }
        });
    }

    private claimDailyWelfare(): void {
        const key = 'daily-welfare';
        if (!this._state.claimToday(key)) {
            this.toast('今日福利已经领取');
            return;
        }

        this.grant([
            { itemId: ITEM_JADE, amount: 100 },
            { itemId: ITEM_GOLD, amount: 5000 },
            { itemId: ITEM_QI_PILL, amount: 3 },
            { itemId: ITEM_CRYSTAL, amount: 50 },
        ]);
        this.toast('领取成功：仙玉×100、金币×5000、聚气丹×3、仙晶×50');
        this.refreshVisualState();
    }

    private claimGrowthReward(reward: GrowthReward): void {
        const highestLevel = this.getHighestRoleLevel();
        if (highestLevel < reward.level) {
            this.toast(`最高角色达到 ${reward.level} 级后可领取`);
            return;
        }

        const key = this.growthClaimKey(reward.level);
        if (!this._state.claim(key)) {
            this.toast(`${reward.level} 级成长奖励已经领取`);
            return;
        }

        this.grant(reward.items);
        this.toast(`${reward.level} 级奖励领取成功：${reward.description}`);
        this.refreshVisualState();
    }

    private claimAllGrowthRewards(): void {
        const highestLevel = this.getHighestRoleLevel();
        const rewards = GROWTH_REWARDS.filter((reward) => (
            reward.level <= highestLevel
            && !this._state.isClaimed(this.growthClaimKey(reward.level))
        ));
        if (!rewards.length) {
            this.toast(highestLevel > 0 ? '当前没有可领取的成长奖励' : '暂无角色，无法领取成长奖励');
            return;
        }

        const items: ItemAmount[] = [];
        for (const reward of rewards) {
            if (this._state.claim(this.growthClaimKey(reward.level))) {
                items.push(...reward.items);
            }
        }
        this.grant(items);
        this.toast(`已领取 ${rewards.length} 档成长奖励`);
        this.refreshVisualState();
    }

    private selectEncounterChoice(choice: string): void {
        if (this._state.isClaimed('immortal-encounter.resolved')) {
            this.toast('本次仙缘奇遇已经完成');
            return;
        }
        this._state.setValue('immortal-encounter.choice', choice);
        this.refreshEncounterVisuals();
    }

    private confirmEncounterChoice(): void {
        const resolvedKey = 'immortal-encounter.resolved';
        if (this._state.isClaimed(resolvedKey)) {
            this.toast('本次仙缘奇遇已经完成');
            return;
        }

        const choice = this._state.getValue('immortal-encounter.choice');
        if (!choice) {
            this.toast('请先选择一种应对方式');
            return;
        }

        this._items.reload();
        if (choice === 'pill' && !this._items.subtract(ITEM_QI_PILL, 1)) {
            this.toast('聚气丹不足，无法赠丹');
            return;
        }

        if (choice === 'follow') {
            this.grant([
                { itemId: ITEM_REWARD_CHEST, amount: 1 },
                { itemId: ITEM_JADE, amount: 100 },
            ]);
            this.toast('你随仙鹤而去，获得奇遇宝箱和仙玉');
        }
        else if (choice === 'pill') {
            this.grant([{ itemId: ITEM_CRYSTAL, amount: 100 }]);
            this.toast('仙鹤接受赠丹，留下仙晶×100');
        }
        else {
            this.toast('你选择了稳妥离开');
        }

        this._state.claim(resolvedKey);
        this.refreshVisualState();
    }

    private selectLimitedTab(tab: LimitedTab): void {
        this._state.setValue('limited-events.tab', tab.id);
        this.toast(`已切换到${tab.title}`);
        this.refreshLimitedTabVisuals();
    }

    private requestBusinessAction(
        action: HomePopupAction['action'],
        target: string,
        message: string,
    ): void {
        const payload: HomePopupAction = { uiId: this.uiId, action, target };
        oops.message.dispatchEvent(HOME_POPUP_ACTION_EVENT, payload);
        // 消息派发是同步的；业务监听器若在回调中更新了领取状态，应立即反映到当前弹窗。
        this.refreshVisualState();
        this.toast(message);
    }

    private refreshVisualState(): void {
        switch (this.uiId) {
            case UIID.DailyWelfare:
                this.setDisabled(
                    'panel/footer/btn_claim_reward',
                    this._state.isClaimedToday('daily-welfare'),
                );
                break;
            case UIID.CumulativeRechargeRewards:
                this.setDisabled('panel/content/reward_list/recharge_0060/row', true);
                this.setDisabled(
                    'panel/content/reward_list/recharge_0300/row',
                    this._state.isClaimed('cumulative-recharge.300'),
                );
                break;
            case UIID.GrowthFund:
                this.refreshGrowthFundVisuals();
                break;
            case UIID.ImmortalFateEncounter:
                this.refreshEncounterVisuals();
                break;
            case UIID.LimitedTimeEvents:
                this.refreshLimitedTabVisuals();
                break;
        }
    }

    private refreshEncounterVisuals(): void {
        const selected = this._state.getValue('immortal-encounter.choice');
        for (const choice of ENCOUNTER_CHOICES) {
            const node = findChild(this.node, choice.path);
            if (!node) continue;

            const isSelected = selected === choice.id;
            const hasSelection = selected.length > 0;
            this.tintNode(node, !hasSelection || isSelected ? COLOR_NORMAL : COLOR_UNSELECTED);
            node.setScale(isSelected ? 1.04 : 1, isSelected ? 1.04 : 1, 1);
        }
        this.setDisabled(
            'panel/footer/btn_confirm',
            this._state.isClaimed('immortal-encounter.resolved'),
        );
    }

    private refreshLimitedTabVisuals(): void {
        const selected = this._state.getValue('limited-events.tab', LIMITED_TABS[0].id);
        for (const tab of LIMITED_TABS) {
            const node = findChild(this.node, tab.path);
            if (!node) continue;

            const isSelected = selected === tab.id;
            this.tintNode(node, isSelected ? COLOR_NORMAL : COLOR_UNSELECTED);
            node.setScale(isSelected ? 1.04 : 1, isSelected ? 1.04 : 1, 1);
        }
    }

    private refreshGrowthFundVisuals(): void {
        const highestLevel = this.getHighestRoleLevel();
        let hasClaimableReward = false;
        for (const reward of GROWTH_REWARDS) {
            const claimed = this._state.isClaimed(this.growthClaimKey(reward.level));
            const unlocked = reward.level <= highestLevel;
            if (unlocked && !claimed) hasClaimableReward = true;
            this.setDisabled(
                `panel/content/reward_list/level_${reward.level}/row`,
                claimed || !unlocked,
            );
        }
        this.setDisabled('panel/footer/btn_claim_all', !hasClaimableReward);
    }

    private getHighestRoleLevel(): number {
        return loadPlayerRoleData().roles.reduce(
            (highest, role) => Math.max(highest, role.level),
            0,
        );
    }

    private growthClaimKey(level: number): string {
        return `growth-fund.level-${level}`;
    }

    private bindTouch(path: string, action: () => void, visualPath: string = path): void {
        const node = findChild(this.node, path);
        if (!node) {
            warn(`[HomePopupBase] ${this.node.name} 缺少交互节点：${path}`);
            return;
        }

        let lastActionAt = 0;
        const handler = (event: EventTouch) => {
            event.propagationStopped = true;
            const now = Date.now();
            if (now - lastActionAt < ACTION_THROTTLE_MS) return;
            lastActionAt = now;

            action();
            const visual = findChild(this.node, visualPath) ?? node;
            if (visual.isValid && visual.activeInHierarchy) this.playPressFeedback(visual);
        };
        node.on(Node.EventType.TOUCH_END, handler, this);
        this._bindings.push({ node, handler });
    }

    private playPressFeedback(node: Node): void {
        const original = node.scale.clone();
        const pressed = new Vec3(original.x * 0.96, original.y * 0.96, original.z);
        Tween.stopAllByTarget(node);
        tween(node)
            .to(0.06, { scale: pressed })
            .to(0.08, { scale: original })
            .start();
    }

    private setDisabled(path: string, disabled: boolean): void {
        const node = findChild(this.node, path);
        if (!node) return;
        this.tintNode(node, disabled ? COLOR_DISABLED : COLOR_NORMAL);
    }

    private tintNode(node: Node, color: Color): void {
        for (const sprite of node.getComponentsInChildren(Sprite)) {
            sprite.color = color;
        }
    }

    private grant(items: readonly ItemAmount[]): void {
        this._items.reload();
        this._items.addMany(items);
    }

    private toast(message: string): void {
        oops.gui.toast(message);
    }

    private close(): void {
        if (this.uiId > 0) oops.gui.remove(this.uiId, false);
    }
}
