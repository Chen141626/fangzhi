import { RoleProfession, RoleType } from '../core/GameEnum';
import { GameStorage } from '../core/GameStorage';
import {
    RoleBaseAttribute,
    RoleStar,
    calculateRoleAttributeAtLevel,
} from '../config/RoleBaseAttributeConfig';

/** 玩家通过召唤获得的怪物实例。 */
export interface PlayerMonsterInstance {
    instanceId: string;
    /** 对应 BattleSkillConfig 中的 enemy_xx 配置 ID。 */
    monsterId: string;
    star: RoleStar;
    roleType: RoleType;
    profession: RoleProfession;
    level: number;
    skillLevel?: number;
    baseAttribute: RoleBaseAttribute;
    obtainedAt: number;
}

export interface PlayerMonsterData {
    version: 1;
    monsters: PlayerMonsterInstance[];
}

export const PLAYER_MONSTER_STORAGE_KEY = 'fangzhi.player-monster-data';

export function createEmptyPlayerMonsterData(): PlayerMonsterData {
    return { version: 1, monsters: [] };
}

export function loadPlayerMonsterData(
    storageKey: string = PLAYER_MONSTER_STORAGE_KEY,
): PlayerMonsterData {
    const data = GameStorage.load<Partial<PlayerMonsterData>>(storageKey);
    if (!data || data.version !== 1 || !Array.isArray(data.monsters)) {
        return createEmptyPlayerMonsterData();
    }
    return data as PlayerMonsterData;
}

export function savePlayerMonsterData(
    data: PlayerMonsterData,
    storageKey: string = PLAYER_MONSTER_STORAGE_KEY,
): void {
    GameStorage.save(storageKey, data);
}

export function getPlayerMonsterCurrentAttribute(
    monster: PlayerMonsterInstance,
): RoleBaseAttribute {
    return calculateRoleAttributeAtLevel(monster.baseAttribute, monster.level);
}
