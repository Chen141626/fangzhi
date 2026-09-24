import { RoleStar } from '../../config/RoleBaseAttributeConfig';
import { PlayerRoleInstance, loadPlayerRoleData, savePlayerRoleData } from '../../model/PlayerRoleData';
import { ItemAmount, ItemService } from '../item/ItemService';

export interface RoleGrowthResult {
    success: boolean;
    message: string;
    role: PlayerRoleInstance | null;
}

export function getRoleLevelLimit(star: RoleStar): number {
    return star * 10;
}

export function getRoleLevelUpCost(role: PlayerRoleInstance): readonly ItemAmount[] {
    return [
        { itemId: 'currency.gold', amount: role.level * 120 },
        { itemId: 'consumable.qi-pill', amount: 1 },
    ];
}

export function getRoleStarUpCost(role: PlayerRoleInstance): readonly ItemAmount[] {
    return [
        { itemId: 'currency.gold', amount: role.star * 2500 },
        { itemId: 'currency.crystal', amount: role.star * 10 },
    ];
}

export function getRoleSkillUpCost(role: PlayerRoleInstance): readonly ItemAmount[] {
    const level = Math.max(1, role.skillLevel ?? 1);
    return [
        { itemId: 'currency.gold', amount: level * 600 },
        { itemId: 'currency.crystal', amount: Math.max(1, Math.ceil(level / 2)) },
    ];
}

/** 角色升级、升星的唯一写入口，负责角色存档与道具扣除回滚。 */
export class RoleGrowthService {
    private readonly _items = new ItemService();

    levelUp(instanceId: string): RoleGrowthResult {
        const data = loadPlayerRoleData();
        const role = data.roles.find((item) => item.instanceId === instanceId) ?? null;
        if (!role) return { success: false, message: '角色不存在', role: null };
        const limit = getRoleLevelLimit(role.star);
        if (role.level >= limit) {
            return { success: false, message: role.star >= 5 ? '角色已达到最高等级' : '请先升星突破等级上限', role };
        }
        const cost = getRoleLevelUpCost(role);
        this._items.reload();
        if (!this._items.subtractMany(cost)) return { success: false, message: '金币或聚气丹不足', role };
        role.level++;
        try {
            savePlayerRoleData(data);
        }
        catch (error) {
            this._items.addMany(cost);
            throw error;
        }
        return { success: true, message: `升级成功，当前${role.level}级`, role };
    }

    starUp(instanceId: string): RoleGrowthResult {
        const data = loadPlayerRoleData();
        const role = data.roles.find((item) => item.instanceId === instanceId) ?? null;
        if (!role) return { success: false, message: '角色不存在', role: null };
        if (role.star >= 5) return { success: false, message: '角色已达到五星', role };
        if (role.level < getRoleLevelLimit(role.star)) {
            return { success: false, message: `需要达到${getRoleLevelLimit(role.star)}级才能升星`, role };
        }
        const cost = getRoleStarUpCost(role);
        this._items.reload();
        if (!this._items.subtractMany(cost)) return { success: false, message: '金币或仙晶不足', role };
        role.star = (role.star + 1) as RoleStar;
        role.baseAttribute.hp = Math.ceil(role.baseAttribute.hp * 1.22);
        role.baseAttribute.attack = Math.ceil(role.baseAttribute.attack * 1.22);
        role.baseAttribute.defense = Math.ceil(role.baseAttribute.defense * 1.22);
        role.baseAttribute.speed = Math.ceil(role.baseAttribute.speed * 1.03);
        try {
            savePlayerRoleData(data);
        }
        catch (error) {
            this._items.addMany(cost);
            throw error;
        }
        return { success: true, message: `升星成功，当前${role.star}星`, role };
    }

    skillUp(instanceId: string): RoleGrowthResult {
        const data = loadPlayerRoleData();
        const role = data.roles.find((item) => item.instanceId === instanceId) ?? null;
        if (!role) return { success: false, message: '角色不存在', role: null };
        const current = Math.max(1, role.skillLevel ?? 1);
        const limit = role.star * 2;
        if (current >= limit) return { success: false, message: `技能已达到当前星级上限${limit}级`, role };
        const cost = getRoleSkillUpCost(role);
        this._items.reload();
        if (!this._items.subtractMany(cost)) return { success: false, message: '金币或仙晶不足', role };
        role.skillLevel = current + 1;
        try {
            savePlayerRoleData(data);
        }
        catch (error) {
            this._items.addMany(cost);
            throw error;
        }
        return { success: true, message: `技能研习成功，当前${role.skillLevel}级`, role };
    }
}
