import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    director,
    Label,
    Node,
    Sprite,
    warn,
} from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { FairyScrollType, RoleProfession } from '../../core/GameEnum';
import { GAME_EVENT_RESOURCE_CHANGED } from '../../core/GameEvents';
import { PlayerMonsterInstance } from '../../model/PlayerMonsterData';
import { PlayerRoleInstance } from '../../model/PlayerRoleData';
import { getUnitBattleSkills } from '../battle/BattleSkillConfig';
import { resolveRoleConfigId } from '../battle/BattleRosterService';
import { ItemService } from '../item/ItemService';
import { TaskService } from '../task/TaskService';
import { loadSpriteFrameCompat } from '../common/loadSpriteFrameCompat';
import {
    DEFAULT_SUMMON_MONSTER_POOL,
    DEFAULT_SUMMON_ROLE_POOL,
    SUMMON_SINGLE_COST,
    SUMMON_TEN_COST,
} from './SummonConfig';
import {
    PlayerMonsterSummonService,
    PlayerSummonService,
} from './SummonService';

const { ccclass, menu } = _decorator;

type SummonPoolKind = 'role' | 'monster';

interface SummonCardData {
    kind: SummonPoolKind;
    configId: string;
    star: number;
    profession: RoleProfession;
}

interface RuntimeTab {
    kind: SummonPoolKind;
    normalArt: Node;
    selectedArt: Node;
    label: Label;
}

interface RuntimeResultCard {
    node: Node;
    icon: Sprite;
    elementIcon: Sprite;
    roleBg: Node;
    monsterBg: Node;
    stars: Label;
    name: Label;
    type: Label;
}

const PROFESSION_NAMES: Record<RoleProfession, string> = {
    [RoleProfession.Water]: '水',
    [RoleProfession.Fire]: '火',
    [RoleProfession.Wind]: '风',
    [RoleProfession.Light]: '光',
    [RoleProfession.Dark]: '暗',
};

const ELEMENT_PATHS: Record<RoleProfession, string> = {
    [RoleProfession.Water]: 'gui/common/elementIcon/element_water/spriteFrame',
    [RoleProfession.Fire]: 'gui/common/elementIcon/element_fire/spriteFrame',
    [RoleProfession.Wind]: 'gui/common/elementIcon/element_wind/spriteFrame',
    [RoleProfession.Light]: 'gui/common/elementIcon/element_light/spriteFrame',
    [RoleProfession.Dark]: 'gui/common/elementIcon/element_dark/spriteFrame',
};

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

@ccclass('SummonMain')
@menu('Game/Summon/SummonMain')
export class SummonMain extends Component {
    private readonly _items = new ItemService();
    private readonly _roleSummon = new PlayerSummonService(DEFAULT_SUMMON_ROLE_POOL);
    private readonly _monsterSummon = new PlayerMonsterSummonService(DEFAULT_SUMMON_MONSTER_POOL);
    private readonly _tasks = new TaskService();
    private readonly _tabs: RuntimeTab[] = [];
    private readonly _cards: RuntimeResultCard[] = [];
    private readonly _iconVersions = new WeakMap<Node, number>();
    private _activePool: SummonPoolKind = 'role';
    private _currencyLabel: Label | null = null;
    private _resultLabel: Label | null = null;
    private _statusLabel: Label | null = null;
    private _ruleLabel: Label | null = null;

    protected onLoad(): void {
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);
        this.bindHierarchy();
        this.setPool('role');
    }

    protected onEnable(): void {
        this._items.reload();
        this._roleSummon.reload();
        this._monsterSummon.reload();
        this.refreshCurrency();
    }

    private bindHierarchy(): void {
        this._currencyLabel = findChild(this.node, 'header/currency')?.getComponent(Label) ?? null;
        this._ruleLabel = findChild(this.node, 'probability/Label')?.getComponent(Label) ?? null;
        this._resultLabel = findChild(this.node, 'resultPanel/results')?.getComponent(Label) ?? null;
        this._statusLabel = findChild(this.node, 'status')?.getComponent(Label) ?? null;

        const title = findChild(this.node, 'header/title')?.getComponent(Label);
        if (title) title.string = '仙缘召唤';
        const singleLabel = findChild(this.node, 'actions/btn_single/Label')?.getComponent(Label);
        if (singleLabel) singleLabel.string = '召唤1次';
        const singleCost = findChild(this.node, 'actions/btn_single/cost')?.getComponent(Label);
        if (singleCost) singleCost.string = '仙玉×' + SUMMON_SINGLE_COST;
        const tenLabel = findChild(this.node, 'actions/btn_ten/Label')?.getComponent(Label);
        if (tenLabel) tenLabel.string = '召唤10次';
        const tenCost = findChild(this.node, 'actions/btn_ten/cost')?.getComponent(Label);
        if (tenCost) tenCost.string = '仙玉×' + SUMMON_TEN_COST;
        const rosterLabel = findChild(this.node, 'actions/btn_roles/Label')?.getComponent(Label);
        if (rosterLabel) rosterLabel.string = '阵容';

        this._tabs.length = 0;
        for (const kind of ['role', 'monster'] as const) {
            const node = findChild(this.node, 'poolTabs/' + kind + 'Tab');
            const normalArt = node?.getChildByName('normalArt') ?? null;
            const selectedArt = node?.getChildByName('selectedArt') ?? null;
            const label = node?.getChildByName('Label')?.getComponent(Label) ?? null;
            if (!node || !normalArt || !selectedArt || !label) continue;
            node.on(Node.EventType.TOUCH_END, () => this.setPool(kind), this);
            this._tabs.push({ kind, normalArt, selectedArt, label });
        }

        this._cards.length = 0;
        for (let index = 0; index < 10; index++) {
            const node = findChild(this.node, 'resultPanel/resultCard' + (index + 1));
            const icon = node?.getChildByName('icon')?.getComponent(Sprite) ?? null;
            const elementIcon = node?.getChildByName('elementIcon')?.getComponent(Sprite) ?? null;
            const roleBg = node?.getChildByName('roleBg') ?? null;
            const monsterBg = node?.getChildByName('monsterBg') ?? null;
            const stars = node?.getChildByName('stars')?.getComponent(Label) ?? null;
            const name = node?.getChildByName('name')?.getComponent(Label) ?? null;
            const type = node?.getChildByName('type')?.getComponent(Label) ?? null;
            if (!node || !icon || !elementIcon || !roleBg || !monsterBg || !stars || !name || !type) continue;
            this._cards.push({ node, icon, elementIcon, roleBg, monsterBg, stars, name, type });
        }

        findChild(this.node, 'header/btn_back')?.on(
            Node.EventType.TOUCH_END,
            () => oops.gui.remove(UIID.Summon, false),
            this,
        );
        findChild(this.node, 'actions/btn_single')?.on(Node.EventType.TOUCH_END, () => this.summon(1), this);
        findChild(this.node, 'actions/btn_ten')?.on(Node.EventType.TOUCH_END, () => this.summon(10), this);
        findChild(this.node, 'actions/btn_roles')?.on(Node.EventType.TOUCH_END, this.openRoster, this);
        if (!this._currencyLabel || !this._resultLabel || !this._statusLabel || !this._ruleLabel
            || this._tabs.length !== 2 || this._cards.length !== 10) {
            warn('[SummonMain] 召唤 prefab 层级不完整，请重新生成或检查节点命名。');
        }
    }

    private setPool(kind: SummonPoolKind): void {
        this._activePool = kind;
        for (const tab of this._tabs) {
            const selected = tab.kind === kind;
            tab.selectedArt.active = selected;
            tab.normalArt.active = !selected;
            tab.label.color = selected ? new Color(255, 232, 143) : new Color(202, 220, 230);
        }
        if (this._ruleLabel) {
            this._ruleLabel.string = kind === 'role'
                ? '角色池：三星91.5% · 四星8% · 五星0.5%'
                : '怪物池：三星91.5% · 四星8% · 五星0.5%';
        }
        if (this._resultLabel) {
            this._resultLabel.node.active = true;
            this._resultLabel.string = kind === 'role'
                ? '选择召唤次数，获得可培养并上阵的角色'
                : '选择召唤次数，获得可加入阵容的怪物伙伴';
        }
        const banner = findChild(this.node, 'resultPanel/leftBanner');
        const bannerText = findChild(this.node, 'resultPanel/bannerText');
        if (banner) banner.active = true;
        if (bannerText) bannerText.active = true;
        if (this._statusLabel) this._statusLabel.string = '';
        for (const card of this._cards) card.node.active = false;
        this.refreshCurrency();
    }

    private summon(count: 1 | 10): void {
        const cost = count === 1 ? SUMMON_SINGLE_COST : SUMMON_TEN_COST;
        this._items.reload();
        if (!this._items.subtract('currency.jade', cost)) {
            if (this._statusLabel) this._statusLabel.string = '仙玉不足，需要' + cost;
            return;
        }

        let cards: SummonCardData[];
        try {
            if (this._activePool === 'role') {
                cards = this._roleSummon.summonMany(FairyScrollType.All, count)
                    .map((result) => this.roleCard(result.role));
            } else {
                cards = this._monsterSummon.summonMany(FairyScrollType.All, count)
                    .map((result) => this.monsterCard(result.monster));
            }
        } catch (error) {
            this._items.add('currency.jade', cost);
            if (this._statusLabel) this._statusLabel.string = '召唤失败：' + String(error);
            return;
        }

        director.emit(GAME_EVENT_RESOURCE_CHANGED);
        this._tasks.report('summon', count);
        this.renderResults(cards);
        this.refreshCurrency();
        const highest = Math.max(...cards.map((card) => card.star));
        const targetName = this._activePool === 'role' ? '角色' : '怪物伙伴';
        if (this._statusLabel) {
            this._statusLabel.string = highest >= 5
                ? '鸿运当头！获得五星' + targetName + '！'
                : '召唤成功，获得' + count + '名' + targetName;
        }
    }

    private roleCard(role: PlayerRoleInstance): SummonCardData {
        return {
            kind: 'role',
            configId: resolveRoleConfigId(role) ?? String(role.roleId),
            star: role.star,
            profession: role.profession,
        };
    }

    private monsterCard(monster: PlayerMonsterInstance): SummonCardData {
        return {
            kind: 'monster',
            configId: monster.monsterId,
            star: monster.star,
            profession: monster.profession,
        };
    }

    private renderResults(results: readonly SummonCardData[]): void {
        if (this._resultLabel) this._resultLabel.node.active = false;
        const banner = findChild(this.node, 'resultPanel/leftBanner');
        const bannerText = findChild(this.node, 'resultPanel/bannerText');
        if (banner) banner.active = false;
        if (bannerText) bannerText.active = false;
        this._cards.forEach((card, index) => {
            const data = results[index];
            card.node.active = !!data;
            if (!data) return;

            if (results.length === 1) {
                card.node.setPosition(35, 0, 0);
                card.node.setScale(1.65, 1.65, 1);
            } else {
                const column = index % 5;
                const row = Math.floor(index / 5);
                card.node.setPosition(-242 + column * 121, 145 - row * 265, 0);
                card.node.setScale(1, 1, 1);
            }

            const name = getUnitBattleSkills(data.configId)[0]?.unitName ?? data.configId;
            card.roleBg.active = data.kind === 'role';
            card.monsterBg.active = data.kind === 'monster';
            card.stars.string = '★'.repeat(data.star);
            card.name.string = name;
            card.type.string = PROFESSION_NAMES[data.profession] + ' · ' + (data.kind === 'role' ? '角色' : '怪物');
            this.renderIcon(card.icon, data);
            this.renderElementIcon(card.elementIcon, data.profession);
        });
    }

    private renderIcon(sprite: Sprite, data: SummonCardData): void {
        const iconNode = sprite.node;
        const version = (this._iconVersions.get(iconNode) ?? 0) + 1;
        this._iconVersions.set(iconNode, version);
        sprite.spriteFrame = null;
        const path = data.kind === 'role'
            ? 'gui/common/roleIcon/character_' + data.configId.replace(/^ally_\d+_/, '') + '/spriteFrame'
            : 'gui/common/roleIcon/' + data.configId.replace(/^enemy_/, 'monster_') + '/spriteFrame';
        loadSpriteFrameCompat(path, (error, frame) => {
            if (error || !frame || !iconNode.isValid || this._iconVersions.get(iconNode) !== version) return;
            sprite.spriteFrame = frame;
        });
    }

    private renderElementIcon(sprite: Sprite, profession: RoleProfession): void {
        const iconNode = sprite.node;
        const version = (this._iconVersions.get(iconNode) ?? 0) + 1;
        this._iconVersions.set(iconNode, version);
        loadSpriteFrameCompat(ELEMENT_PATHS[profession], (error, frame) => {
            if (error || !frame || !iconNode.isValid || this._iconVersions.get(iconNode) !== version) return;
            sprite.spriteFrame = frame;
        });
    }

    private openRoster(): void {
        oops.gui.remove(UIID.Summon, false);
        if (!oops.gui.has(UIID.Team)) oops.gui.open(UIID.Team);
    }

    private refreshCurrency(): void {
        if (!this._currencyLabel) return;
        this._currencyLabel.string = [
            '仙玉：' + this._items.getAmount('currency.jade'),
            '角色：' + this._roleSummon.roles.length,
            '怪物：' + this._monsterSummon.monsters.length,
        ].join('　');
    }
}
