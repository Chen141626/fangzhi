import { RoleProfession, RoleType } from '../core/GameEnum';
import { GameStorage } from '../core/GameStorage';
import {
    RoleBaseAttribute,
    RoleStar,
    calculateRoleAttributeAtLevel,
} from '../config/RoleBaseAttributeConfig';

export type RoleConfigId = string | number;

/** 玩家真正拥有的角色实例；同一 roleId 可以存在多个实例。 */
export interface PlayerRoleInstance {
    /** 每次召唤生成的唯一实例 ID。 */
    instanceId: string;
    /** 角色静态配置 ID，允许重复。 */
    roleId: RoleConfigId;
    star: RoleStar;
    roleType: RoleType;
    profession: RoleProfession;
    level: number;
    /** 召唤时生成并永久保存的 1 级基础属性。 */
    baseAttribute: RoleBaseAttribute;
    /** 获得时间，Unix 毫秒时间戳。 */
    obtainedAt: number;
}

export interface PlayerRoleData {
    version: 1;
    roles: PlayerRoleInstance[];
}

export const PLAYER_ROLE_STORAGE_KEY = 'fangzhi.player-role-data';

export function createEmptyPlayerRoleData(): PlayerRoleData {
    return {
        version: 1,
        roles: [],
    };
}

/** 读取已保存的玩家角色，存档不存在或损坏时返回空数据。 */
export function loadPlayerRoleData(
    storageKey: string = PLAYER_ROLE_STORAGE_KEY,
): PlayerRoleData {
    const data = GameStorage.load<Partial<PlayerRoleData>>(storageKey);
    if (!data) {
        return createEmptyPlayerRoleData();
    }

    if (data.version !== 1 || !Array.isArray(data.roles)) {
        return createEmptyPlayerRoleData();
    }

    return data as PlayerRoleData;
}

export function savePlayerRoleData(
    data: PlayerRoleData,
    storageKey: string = PLAYER_ROLE_STORAGE_KEY,
): void {
    GameStorage.save(storageKey, data);
}

/** 使用已保存的基础属性计算角色当前等级属性。 */
export function getPlayerRoleCurrentAttribute(role: PlayerRoleInstance): RoleBaseAttribute {
    return calculateRoleAttributeAtLevel(role.baseAttribute, role.level);
}
