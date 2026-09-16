import { _decorator, BlockInputEvents, Component, EventTouch, Label, Node } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { RoleProfession, RoleType } from '../../core/GameEnum';
import {
    PlayerRoleInstance,
    getPlayerRoleCurrentAttribute,
    loadPlayerRoleData,
} from '../../model/PlayerRoleData';
import {
    SCROLL_HORIZONTAL,
    ScrollList,
} from '../common/VirtualList/ScrollList';

const { ccclass, menu } = _decorator;

const ROLE_TYPE_NAMES: Record<RoleType, string> = {
    [RoleType.Hp]: '血量型',
    [RoleType.Attack]: '攻击型',
    [RoleType.Defense]: '防御型',
    [RoleType.Assistance]: '辅助型',
};

const PROFESSION_NAMES: Record<RoleProfession, string> = {
    [RoleProfession.Water]: '水',
    [RoleProfession.Fire]: '火',
    [RoleProfession.Wind]: '风',
    [RoleProfession.Light]: '光',
    [RoleProfession.Dark]: '暗',
};

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

/** 角色主界面：读取玩家角色存档、渲染列表并展示选中角色属性。 */
@ccclass('RoleMain')
@menu('Game/Role/RoleMain')
export class RoleMain extends Component {
    private _roles: PlayerRoleInstance[] = [];
    private _selectedInstanceId = '';
    private _scrollList: ScrollList | null = null;
    private _roleItemTemplate: Node | null = null;
    private _backButton: Node | null = null;

    protected onLoad(): void {
        // 全屏页面拦截触摸，避免点击穿透到下方主界面。
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);
        const roleListNode = findChild(this.node, 'bg/roleList');
        this._scrollList = roleListNode?.getComponent(ScrollList) ?? null;
        this._roleItemTemplate = findChild(this.node, 'bg/roleList/view/content/roleItem');
        this._backButton = findChild(this.node, 'bg/btn_back');
        this._backButton?.on(Node.EventType.TOUCH_END, this.onBack, this);

        if (this._scrollList) {
            this._scrollList.setDelay(0, 0);
            this._scrollList.onItemRender = this.renderRoleItem.bind(this);
        }
    }

    protected onEnable(): void {
        this.refresh();
    }

    protected onDestroy(): void {
        this._backButton?.off(Node.EventType.TOUCH_END, this.onBack, this);
    }

    get roles(): readonly PlayerRoleInstance[] {
        return this._roles;
    }

    /** 重新读取角色存档并刷新界面。 */
    refresh(): void {
        this._roles = loadPlayerRoleData().roles.slice();

        if (this._scrollList && this._roleItemTemplate?.isValid) {
            this._scrollList.setDataList(
                this._roleItemTemplate,
                this._roles,
                SCROLL_HORIZONTAL,
            );
        }

        const selected = this._roles.find((role) => role.instanceId === this._selectedInstanceId)
            ?? this._roles[0]
            ?? null;
        this.showRole(selected);
    }

    /** 外部可按实例 ID 切换当前展示角色。 */
    selectRole(instanceId: string): boolean {
        const role = this._roles.find((item) => item.instanceId === instanceId);
        if (!role) {
            return false;
        }

        this.showRole(role);
        return true;
    }

    private renderRoleItem(node: Node, _index: number, role: PlayerRoleInstance): void {
        this.setNodeLabel(node, 'lv', `${role.level}级`);
        this.setStars(findChild(node, 'starLayout'), role.star);

        (node as any).__roleInstanceId = role.instanceId;
        node.off(Node.EventType.TOUCH_END, this.onRoleItemClicked, this);
        node.on(Node.EventType.TOUCH_END, this.onRoleItemClicked, this);
    }

    private onRoleItemClicked(event: EventTouch): void {
        const item = event.currentTarget as Node;
        const instanceId = (item as any).__roleInstanceId as string | undefined;
        if (instanceId) {
            this.selectRole(instanceId);
        }
    }

    private showRole(role: PlayerRoleInstance | null): void {
        if (!role) {
            this._selectedInstanceId = '';
            this.setLabel('bg/title/name', '暂无角色');
            this.setLabel('bg/title/lv', '--');
            this.setLabel('bg/title/power', '--');
            this.setLabel('bg/bg/roleType/Label', '--');
            this.setBaseAttributeLabels('--', '--', '--', '--');
            this.setStars(findChild(this.node, 'bg/title/starLayout'), 0);
            return;
        }

        this._selectedInstanceId = role.instanceId;
        const attribute = getPlayerRoleCurrentAttribute(role);
        const professionName = PROFESSION_NAMES[role.profession];

        // 角色静态表接入后，可将此处替换为配置中的角色名称。
        this.setLabel('bg/title/name', `${professionName}·角色${role.roleId}`);
        this.setLabel('bg/title/lv', `${role.level}级`);
        this.setLabel('bg/title/power', '--');
        this.setLabel('bg/bg/roleType/Label', ROLE_TYPE_NAMES[role.roleType]);
        this.setBaseAttributeLabels(
            String(attribute.hp),
            String(attribute.attack),
            String(attribute.defense),
            String(attribute.speed),
        );
        this.setStars(findChild(this.node, 'bg/title/starLayout'), role.star);
    }

    private setBaseAttributeLabels(
        hp: string,
        attack: string,
        defense: string,
        speed: string,
    ): void {
        this.setLabel('bg/bg/hp/num', hp);
        this.setLabel('bg/bg/attack/num', attack);
        this.setLabel('bg/bg/def/num', defense);
        this.setLabel('bg/bg/speed/num', speed);

        for (const key of ['hp', 'attack', 'def', 'speed']) {
            this.setLabel(`bg/bg/${key}/bonus`, '');
        }
        for (const key of ['crit', 'rate', 'reslst', 'accuracy']) {
            this.setLabel(`bg/bg/${key}/num`, '--');
            this.setLabel(`bg/bg/${key}/bonus`, '');
        }
    }

    private setLabel(path: string, value: string): void {
        this.setNodeLabel(this.node, path, value);
    }

    private setNodeLabel(root: Node, path: string, value: string): void {
        const label = findChild(root, path)?.getComponent(Label);
        if (label) {
            label.string = value;
        }
    }

    private setStars(starLayout: Node | null, star: number): void {
        starLayout?.children.forEach((child, index) => {
            child.active = index < star;
        });
    }

    private onBack(): void {
        oops.gui.remove(UIID.Role, false);
    }
}
