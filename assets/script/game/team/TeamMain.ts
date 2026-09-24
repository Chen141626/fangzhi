import {
    _decorator,
    assetManager,
    BlockInputEvents,
    Color,
    Component,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    warn,
} from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { RoleProfession } from '../../core/GameEnum';
import { getPlayerMonsterCurrentAttribute, loadPlayerMonsterData } from '../../model/PlayerMonsterData';
import { getPlayerRoleCurrentAttribute, loadPlayerRoleData } from '../../model/PlayerRoleData';
import {
    loadBattleFormation,
    resolveRoleConfigId,
    saveBattleFormation,
} from '../battle/BattleRosterService';
import { getUnitBattleSkills } from '../battle/BattleSkillConfig';
import { TaskService } from '../task/TaskService';
import { loadSpriteFrameCompat } from '../common/loadSpriteFrameCompat';

const { ccclass, menu } = _decorator;
const PAGE_SIZE = 8;

interface RuntimeButton {
    node: Node;
    state: Label;
    level: Label;
    name: Label;
    stars: Label;
    power: Label;
    elementIcon: Sprite;
}

interface FormationUnit {
    kind: 'role' | 'monster';
    instanceId: string;
    configId: string;
    star: number;
    level: number;
    obtainedAt: number;
    name: string;
    iconPath: string;
    profession: RoleProfession;
    power: number;
}

const ELEMENT_PATHS: Record<RoleProfession, string> = {
    [RoleProfession.Water]: 'gui/common/elementIcon/element_water/spriteFrame',
    [RoleProfession.Fire]: 'gui/common/elementIcon/element_fire/spriteFrame',
    [RoleProfession.Wind]: 'gui/common/elementIcon/element_wind/spriteFrame',
    [RoleProfession.Light]: 'gui/common/elementIcon/element_light/spriteFrame',
    [RoleProfession.Dark]: 'gui/common/elementIcon/element_dark/spriteFrame',
};

function calculatePower(attribute: { hp: number; attack: number; defense: number; speed: number }): number {
    return Math.round(attribute.hp + attribute.attack * 5 + attribute.defense * 4 + attribute.speed * 10);
}

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

@ccclass('TeamMain')
@menu('Game/Team/TeamMain')
export class TeamMain extends Component {
    private readonly _tasks = new TaskService();
    private _units: FormationUnit[] = [];
    private _selectedIds: string[] = [];
    private _page = 0;
    private _slotLabels: Label[] = [];
    private _slotEmptyArts: Node[] = [];
    private _unitButtons: RuntimeButton[] = [];
    private _pageLabel: Label | null = null;
    private _statusLabel: Label | null = null;
    private _countLabel: Label | null = null;
    private _normalCardFrame: SpriteFrame | null = null;
    private _deployedCardFrame: SpriteFrame | null = null;
    private readonly _iconVersions = new WeakMap<Node, number>();

    protected onLoad(): void {
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);
        this.bindHierarchy();
        this.loadCardFrames();
    }

    protected onEnable(): void {
        this.refresh();
    }

    refresh(): void {
        if (this._statusLabel) this._statusLabel.string = '';
        const roleUnits = loadPlayerRoleData().roles
            .map((role): FormationUnit | null => {
                const configId = resolveRoleConfigId(role);
                if (!configId) return null;
                return {
                    kind: 'role',
                    instanceId: role.instanceId,
                    configId,
                    star: role.star,
                    level: role.level,
                    obtainedAt: role.obtainedAt,
                    name: getUnitBattleSkills(configId)[0]?.unitName ?? String(role.roleId),
                    iconPath: 'gui/common/roleIcon/character_'
                        + configId.replace(/^ally_\d+_/, '')
                        + '/spriteFrame',
                    profession: role.profession,
                    power: calculatePower(getPlayerRoleCurrentAttribute(role)),
                };
            })
            .filter((unit): unit is FormationUnit => !!unit);
        const monsterUnits = loadPlayerMonsterData().monsters
            .map((monster): FormationUnit | null => {
                const configId = monster.monsterId;
                if (!getUnitBattleSkills(configId).length) return null;
                return {
                    kind: 'monster',
                    instanceId: monster.instanceId,
                    configId,
                    star: monster.star,
                    level: monster.level,
                    obtainedAt: monster.obtainedAt,
                    name: getUnitBattleSkills(configId)[0]?.unitName ?? configId,
                    iconPath: 'gui/common/roleIcon/'
                        + configId.replace(/^enemy_/, 'monster_')
                        + '/spriteFrame',
                    profession: monster.profession,
                    power: calculatePower(getPlayerMonsterCurrentAttribute(monster)),
                };
            })
            .filter((unit): unit is FormationUnit => !!unit);
        this._units = [...roleUnits, ...monsterUnits].sort((a, b) => (
            b.star - a.star || b.level - a.level || a.obtainedAt - b.obtainedAt
        ));

        const ownedIds = new Set(this._units.map((unit) => unit.instanceId));
        this._selectedIds = loadBattleFormation().allyInstanceIds
            .filter((id) => ownedIds.has(id))
            .slice(0, 5);
        if (!this._selectedIds.length) this.autoDeploy(false);
        this._page = Math.min(this._page, this.pageCount() - 1);
        this.render();
    }

    private bindHierarchy(): void {
        findChild(this.node, 'header/btn_back')?.on(
            Node.EventType.TOUCH_END,
            () => oops.gui.remove(UIID.Team, false),
            this,
        );
        const title = findChild(this.node, 'header/title')?.getComponent(Label);
        if (title) title.string = '阵容编辑';
        const tip = findChild(this.node, 'header/tip')?.getComponent(Label);
        if (tip) tip.string = '角色和怪物伙伴均可上阵，点击卡片调整';
        const panelTitle = findChild(this.node, 'rolePanel/sectionTitle')?.getComponent(Label);
        if (panelTitle) panelTitle.string = '可选伙伴';

        this._slotLabels.length = 0;
        this._slotEmptyArts.length = 0;
        for (let index = 0; index < 5; index++) {
            const slot = findChild(this.node, 'formationPanel/formationSlot' + (index + 1));
            const label = slot?.getChildByName('Label')?.getComponent(Label) ?? null;
            const emptyArt = slot?.getChildByName('emptyArt') ?? null;
            if (slot && label && emptyArt) {
                this._slotLabels.push(label);
                this._slotEmptyArts.push(emptyArt);
                slot.on(Node.EventType.TOUCH_END, () => this.removeSlot(index), this);
            }
        }
        this._countLabel = findChild(this.node, 'formationPanel/count')?.getComponent(Label) ?? null;

        this._unitButtons.length = 0;
        for (let index = 0; index < PAGE_SIZE; index++) {
            const node = findChild(this.node, 'rolePanel/roleCard' + (index + 1));
            const state = node?.getChildByName('Label')?.getComponent(Label) ?? null;
            const level = node?.getChildByName('level')?.getComponent(Label) ?? null;
            const name = node?.getChildByName('name')?.getComponent(Label) ?? null;
            const stars = node?.getChildByName('stars')?.getComponent(Label) ?? null;
            const power = node?.getChildByName('power')?.getComponent(Label) ?? null;
            const elementIcon = node?.getChildByName('elementIcon')?.getComponent(Sprite) ?? null;
            if (node && state && level && name && stars && power && elementIcon) {
                this._unitButtons.push({ node, state, level, name, stars, power, elementIcon });
                node.on(Node.EventType.TOUCH_END, () => this.toggleUnit(index), this);
            }
        }

        findChild(this.node, 'pagination/btn_previous')?.on(
            Node.EventType.TOUCH_END,
            () => this.changePage(-1),
            this,
        );
        findChild(this.node, 'pagination/btn_next')?.on(
            Node.EventType.TOUCH_END,
            () => this.changePage(1),
            this,
        );
        this._pageLabel = findChild(this.node, 'pagination/page')?.getComponent(Label) ?? null;
        this._statusLabel = findChild(this.node, 'status')?.getComponent(Label) ?? null;
        findChild(this.node, 'actions/btn_auto')?.on(Node.EventType.TOUCH_END, () => this.autoDeploy(true), this);
        findChild(this.node, 'actions/btn_save')?.on(Node.EventType.TOUCH_END, this.save, this);
        findChild(this.node, 'actions/btn_battle')?.on(Node.EventType.TOUCH_END, this.startBattle, this);

        if (this._slotLabels.length !== 5
            || this._unitButtons.length !== PAGE_SIZE
            || !this._pageLabel
            || !this._statusLabel
            || !this._countLabel) {
            warn('[TeamMain] 编队 prefab 层级不完整，请重新生成或检查节点命名。');
        }
    }

    private render(): void {
        this._slotLabels.forEach((label, index) => {
            const unit = this._units.find((item) => item.instanceId === this._selectedIds[index]);
            label.string = unit
                ? unit.name + '\n' + unit.star + '星 · Lv.' + unit.level + '\n点击下阵'
                : '第' + (index + 1) + '位\n待上阵';
            this._slotEmptyArts[index].active = !unit;
            this.renderUnitIcon(label.node.parent, unit ?? null);
        });
        if (this._countLabel) this._countLabel.string = this._selectedIds.length + ' / 5';

        const start = this._page * PAGE_SIZE;
        this._unitButtons.forEach((button, index) => {
            const unit = this._units[start + index];
            button.node.active = !!unit;
            if (!unit) return;
            const selectedIndex = this._selectedIds.indexOf(unit.instanceId);
            button.level.string = unit.level + '级';
            button.name.string = unit.name;
            button.stars.string = '★'.repeat(unit.star);
            button.power.string = '战力 ' + unit.power;
            button.state.string = selectedIndex >= 0 ? '已上阵 ✓' : '未上阵';
            button.state.color = selectedIndex >= 0 ? new Color(235, 255, 218) : new Color(230, 242, 255);
            const cardSprite = button.node.getComponent(Sprite);
            if (cardSprite) {
                cardSprite.spriteFrame = selectedIndex >= 0
                    ? this._deployedCardFrame ?? this._normalCardFrame
                    : this._normalCardFrame;
            }
            this.renderUnitIcon(button.node, unit);
            this.renderElementIcon(button.elementIcon, unit.profession);
        });

        if (this._pageLabel) this._pageLabel.string = (this._page + 1) + ' / ' + this.pageCount();
        if (this._statusLabel && !this._units.length) {
            this._statusLabel.string = '暂无伙伴，请先前往召唤角色或怪物';
        }
    }

    private toggleUnit(localIndex: number): void {
        const unit = this._units[this._page * PAGE_SIZE + localIndex];
        if (!unit) return;
        const selectedIndex = this._selectedIds.indexOf(unit.instanceId);
        if (selectedIndex >= 0) {
            this._selectedIds.splice(selectedIndex, 1);
        } else if (this._selectedIds.length < 5) {
            this._selectedIds.push(unit.instanceId);
        } else if (this._statusLabel) {
            this._statusLabel.string = '最多上阵5名伙伴';
        }
        this.render();
    }

    private removeSlot(index: number): void {
        if (index < this._selectedIds.length) this._selectedIds.splice(index, 1);
        this.render();
    }

    private autoDeploy(showMessage: boolean): void {
        this._selectedIds = this._units.slice(0, 5).map((unit) => unit.instanceId);
        if (showMessage && this._statusLabel) {
            this._statusLabel.string = '已按星级和等级自动上阵';
        }
        this.render();
    }

    private save(): boolean {
        if (!this._selectedIds.length) {
            if (this._statusLabel) this._statusLabel.string = '请至少上阵1名伙伴';
            return false;
        }
        saveBattleFormation(this._selectedIds);
        this._tasks.report('formationSave');
        if (this._statusLabel) this._statusLabel.string = '阵容保存成功';
        return true;
    }

    private startBattle(): void {
        if (!this.save()) return;
        const ids = [...this._selectedIds];
        oops.gui.remove(UIID.Team, false);
        if (oops.gui.has(UIID.Battle)) return;
        oops.gui.open(UIID.Battle, { selectStage: true, allyInstanceIds: ids });
    }

    private changePage(offset: number): void {
        this._page = Math.max(0, Math.min(this.pageCount() - 1, this._page + offset));
        this.render();
    }

    private pageCount(): number {
        return Math.max(1, Math.ceil(this._units.length / PAGE_SIZE));
    }

    private loadCardFrames(): void {
        this._normalCardFrame = this._unitButtons[0]?.node.getComponent(Sprite)?.spriteFrame ?? null;
        const bundle = assetManager.getBundle('team');
        bundle?.load('texture/card_bg_deployed/spriteFrame', SpriteFrame, (error, frame) => {
            if (error || !frame || !this.node.isValid) return;
            this._deployedCardFrame = frame;
            this.render();
        });
    }

    private renderUnitIcon(container: Node | null, unit: FormationUnit | null): void {
        const iconNode = container?.getChildByName('roleIcon') ?? null;
        const sprite = iconNode?.getComponent(Sprite) ?? null;
        if (!iconNode || !sprite) return;
        const version = (this._iconVersions.get(iconNode) ?? 0) + 1;
        this._iconVersions.set(iconNode, version);
        sprite.spriteFrame = null;
        iconNode.active = !!unit;
        if (!unit) return;
        loadSpriteFrameCompat(unit.iconPath, (error, frame) => {
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
}
