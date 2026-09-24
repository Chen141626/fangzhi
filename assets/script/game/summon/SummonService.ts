import { FairyScrollType, RoleProfession, RoleType } from '../../core/GameEnum';
import {
    SummonableRole,
    drawSummonStar,
    filterSummonableRoles,
} from '../../config/FairyScrollSummonConfig';
import { RoleStar, createRoleBaseAttribute } from '../../config/RoleBaseAttributeConfig';
import {
    PLAYER_MONSTER_STORAGE_KEY,
    PlayerMonsterData,
    PlayerMonsterInstance,
    loadPlayerMonsterData,
    savePlayerMonsterData,
} from '../../model/PlayerMonsterData';
import {
    PLAYER_ROLE_STORAGE_KEY,
    PlayerRoleData,
    PlayerRoleInstance,
    RoleConfigId,
    loadPlayerRoleData,
    savePlayerRoleData,
} from '../../model/PlayerRoleData';

export interface SummonRoleDefinition extends SummonableRole {
    roleId: RoleConfigId;
    roleType: RoleType;
    profession: RoleProfession;
    star: RoleStar;
}

export interface SummonMonsterDefinition extends SummonableRole {
    monsterId: string;
    roleType: RoleType;
    profession: RoleProfession;
    star: RoleStar;
}

export interface SummonResult {
    scrollType: FairyScrollType;
    star: RoleStar;
    role: PlayerRoleInstance;
}

export interface SummonMonsterResult {
    scrollType: FairyScrollType;
    star: RoleStar;
    monster: PlayerMonsterInstance;
}

let instanceSequence = 0;

function nextRandomIndex(length: number, random: () => number): number {
    const value = random();
    if (value < 0 || value >= 1) {
        throw new RangeError(`Random value must be in [0, 1), received: ${value}`);
    }
    return Math.floor(value * length);
}

function createUniqueInstanceId(existingIds: Set<string>, prefix: 'role' | 'monster'): string {
    let instanceId = '';
    do {
        instanceSequence++;
        instanceId = `${prefix}-${Date.now().toString(36)}-${instanceSequence.toString(36)}`;
    } while (existingIds.has(instanceId));
    existingIds.add(instanceId);
    return instanceId;
}

export function createSummonedRole(
    scrollType: FairyScrollType,
    rolePool: readonly SummonRoleDefinition[],
    existingIds: Set<string> = new Set<string>(),
    random: () => number = Math.random,
): SummonResult {
    const star = drawSummonStar(scrollType, random);
    const candidates = filterSummonableRoles(rolePool, scrollType, star);
    if (!candidates.length) throw new Error(`No summonable role for scroll type ${scrollType}, star ${star}.`);
    const definition = candidates[nextRandomIndex(candidates.length, random)];
    const role: PlayerRoleInstance = {
        instanceId: createUniqueInstanceId(existingIds, 'role'),
        roleId: definition.roleId,
        star: definition.star,
        roleType: definition.roleType,
        profession: definition.profession,
        level: 1,
        skillLevel: 1,
        baseAttribute: createRoleBaseAttribute(definition.star, definition.roleType, random),
        obtainedAt: Date.now(),
    };
    return { scrollType, star, role };
}

export function createSummonedMonster(
    scrollType: FairyScrollType,
    monsterPool: readonly SummonMonsterDefinition[],
    existingIds: Set<string> = new Set<string>(),
    random: () => number = Math.random,
): SummonMonsterResult {
    const star = drawSummonStar(scrollType, random);
    const candidates = filterSummonableRoles(monsterPool, scrollType, star);
    if (!candidates.length) throw new Error(`No summonable monster for scroll type ${scrollType}, star ${star}.`);
    const definition = candidates[nextRandomIndex(candidates.length, random)];
    const monster: PlayerMonsterInstance = {
        instanceId: createUniqueInstanceId(existingIds, 'monster'),
        monsterId: definition.monsterId,
        star: definition.star,
        roleType: definition.roleType,
        profession: definition.profession,
        level: 1,
        skillLevel: 1,
        baseAttribute: createRoleBaseAttribute(definition.star, definition.roleType, random),
        obtainedAt: Date.now(),
    };
    return { scrollType, star, monster };
}

export class PlayerSummonService {
    private _playerRoleData: PlayerRoleData;

    constructor(
        private readonly _rolePool: readonly SummonRoleDefinition[],
        private readonly _storageKey: string = PLAYER_ROLE_STORAGE_KEY,
    ) {
        this._playerRoleData = loadPlayerRoleData(_storageKey);
    }

    get roles(): readonly PlayerRoleInstance[] { return this._playerRoleData.roles; }
    get data(): Readonly<PlayerRoleData> { return this._playerRoleData; }

    summon(scrollType: FairyScrollType, random: () => number = Math.random): SummonResult {
        return this.summonMany(scrollType, 1, random)[0];
    }

    summonMany(scrollType: FairyScrollType, count: number, random: () => number = Math.random): SummonResult[] {
        if (!Number.isInteger(count) || count < 1) throw new RangeError(`Summon count must be positive: ${count}`);
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

    reload(): void { this._playerRoleData = loadPlayerRoleData(this._storageKey); }
}

export class PlayerMonsterSummonService {
    private _playerMonsterData: PlayerMonsterData;

    constructor(
        private readonly _monsterPool: readonly SummonMonsterDefinition[],
        private readonly _storageKey: string = PLAYER_MONSTER_STORAGE_KEY,
    ) {
        this._playerMonsterData = loadPlayerMonsterData(_storageKey);
    }

    get monsters(): readonly PlayerMonsterInstance[] { return this._playerMonsterData.monsters; }

    summonMany(scrollType: FairyScrollType, count: number, random: () => number = Math.random): SummonMonsterResult[] {
        if (!Number.isInteger(count) || count < 1) throw new RangeError(`Summon count must be positive: ${count}`);
        const existingIds = new Set(this._playerMonsterData.monsters.map((monster) => monster.instanceId));
        const results: SummonMonsterResult[] = [];
        for (let index = 0; index < count; index++) {
            results.push(createSummonedMonster(scrollType, this._monsterPool, existingIds, random));
        }
        this._playerMonsterData.monsters.push(...results.map((result) => result.monster));
        try {
            savePlayerMonsterData(this._playerMonsterData, this._storageKey);
        } catch (error) {
            this._playerMonsterData.monsters.splice(-results.length, results.length);
            throw error;
        }
        return results;
    }

    reload(): void { this._playerMonsterData = loadPlayerMonsterData(this._storageKey); }
}
