import { FairyScrollType, RoleProfession, RoleType } from '../../core/GameEnum';
import {
    SummonableRole,
    drawSummonStar,
    filterSummonableRoles,
} from '../../config/FairyScrollSummonConfig';
import { RoleStar, createRoleBaseAttribute } from '../../config/RoleBaseAttributeConfig';
import {
    PLAYER_ROLE_STORAGE_KEY,
    PlayerRoleData,
    PlayerRoleInstance,
    RoleConfigId,
    loadPlayerRoleData,
    savePlayerRoleData,
} from '../../model/PlayerRoleData';

/** 角色静态表中召唤系统所需的字段。 */
export interface SummonRoleDefinition extends SummonableRole {
    roleId: RoleConfigId;
    roleType: RoleType;
    profession: RoleProfession;
    star: RoleStar;
}

export interface SummonResult {
    scrollType: FairyScrollType;
    star: RoleStar;
    role: PlayerRoleInstance;
}

let instanceSequence = 0;

function nextRandomIndex(length: number, random: () => number): number {
    const value = random();
    if (value < 0 || value >= 1) {
        throw new RangeError(`Random value must be in [0, 1), received: ${value}`);
    }
    return Math.floor(value * length);
}

function createUniqueInstanceId(existingIds: Set<string>): string {
    let instanceId = '';
    do {
        instanceSequence++;
        instanceId = `role-${Date.now().toString(36)}-${instanceSequence.toString(36)}`;
    } while (existingIds.has(instanceId));

    existingIds.add(instanceId);
    return instanceId;
}

/**
 * 完成一次角色召唤，但不自动写入本地存档。
 * 外部可用于服务器结算，或由 PlayerSummonService 负责记录。
 */
export function createSummonedRole(
    scrollType: FairyScrollType,
    rolePool: readonly SummonRoleDefinition[],
    existingIds: Set<string> = new Set<string>(),
    random: () => number = Math.random,
): SummonResult {
    const star = drawSummonStar(scrollType, random);
    const candidates = filterSummonableRoles(rolePool, scrollType, star);
    if (candidates.length === 0) {
        throw new Error(`No summonable role for scroll type ${scrollType}, star ${star}.`);
    }

    const definition = candidates[nextRandomIndex(candidates.length, random)];
    const role: PlayerRoleInstance = {
        instanceId: createUniqueInstanceId(existingIds),
        roleId: definition.roleId,
        star: definition.star,
        roleType: definition.roleType,
        profession: definition.profession,
        level: 1,
        baseAttribute: createRoleBaseAttribute(definition.star, definition.roleType, random),
        obtainedAt: Date.now(),
    };

    return {
        scrollType,
        star,
        role,
    };
}

/**
 * 玩家召唤服务：自动读取角色存档，召唤成功后追加实例并立即保存。
 * 不按 roleId 去重，因此同一角色可被重复获得。
 */
export class PlayerSummonService {
    private readonly _rolePool: readonly SummonRoleDefinition[];
    private readonly _storageKey: string;
    private _playerRoleData: PlayerRoleData;

    constructor(
        rolePool: readonly SummonRoleDefinition[],
        storageKey: string = PLAYER_ROLE_STORAGE_KEY,
    ) {
        this._rolePool = rolePool;
        this._storageKey = storageKey;
        this._playerRoleData = loadPlayerRoleData(storageKey);
    }

    get roles(): readonly PlayerRoleInstance[] {
        return this._playerRoleData.roles;
    }

    get data(): Readonly<PlayerRoleData> {
        return this._playerRoleData;
    }

    summon(
        scrollType: FairyScrollType,
        random: () => number = Math.random,
    ): SummonResult {
        return this.summonMany(scrollType, 1, random)[0];
    }

    summonMany(
        scrollType: FairyScrollType,
        count: number,
        random: () => number = Math.random,
    ): SummonResult[] {
        if (!Number.isInteger(count) || count < 1) {
            throw new RangeError(`Summon count must be a positive integer, received: ${count}`);
        }

        const existingIds = new Set(this._playerRoleData.roles.map((role) => role.instanceId));
        const results: SummonResult[] = [];
        for (let index = 0; index < count; index++) {
            results.push(createSummonedRole(scrollType, this._rolePool, existingIds, random));
        }

        this._playerRoleData.roles.push(...results.map((result) => result.role));
        try {
            savePlayerRoleData(this._playerRoleData, this._storageKey);
        } catch (error) {
            this._playerRoleData.roles.splice(-results.length, results.length);
            throw error;
        }

        return results;
    }

    reload(): void {
        this._playerRoleData = loadPlayerRoleData(this._storageKey);
    }
}
