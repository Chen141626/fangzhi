import {
    PlayerMonsterInstance,
    getPlayerMonsterCurrentAttribute,
    loadPlayerMonsterData,
} from '../../model/PlayerMonsterData';
import {
    PlayerRoleInstance,
    getPlayerRoleCurrentAttribute,
    loadPlayerRoleData,
} from '../../model/PlayerRoleData';
import { GameStorage } from '../../core/GameStorage';
import { BattleUnitConfig, BATTLE_DEMO_ALLIES } from './BattleDemoConfig';
import {
    BattleStageConfig,
    DEFAULT_BATTLE_STAGE_ID,
    getBattleStageConfig,
} from './BattleStageConfig';
import { getUnitBattleSkills } from './BattleSkillConfig';

export interface BattleOpenArgs {
    stageId?: string;
    /** 从主界面进入时先展示关卡选择，而不是直接开战。 */
    selectStage?: boolean;
    /** 阵容界面传入角色或怪物实例 ID，顺序即站位顺序，最多5名。 */
    allyInstanceIds?: readonly string[];
    /** 调试、剧情或服务器下发时可直接覆盖玩家阵容。 */
    allies?: readonly BattleUnitConfig[];
}

export interface ResolvedBattleSession {
    stage: BattleStageConfig;
    allies: readonly BattleUnitConfig[];
    enemies: readonly BattleUnitConfig[];
    waves: readonly (readonly BattleUnitConfig[])[];
    roster: readonly BattleUnitConfig[];
    usingFallbackAllies: boolean;
}

export interface PlayerBattleFormationData {
    version: 1;
    allyInstanceIds: string[];
}

type OwnedFormationUnit =
    | { kind: 'role'; instance: PlayerRoleInstance }
    | { kind: 'monster'; instance: PlayerMonsterInstance };

export const BATTLE_FORMATION_STORAGE_KEY = 'fangzhi.battle-formation-data';

const ALLY_CONFIG_IDS = [
    'ally_01_crystal_mage',
    'ally_02_blue_swordsman',
    'ally_03_jade_healer',
    'ally_04_ice_mage',
    'ally_05_guardian',
    'ally_06_qingfeng_daotong',
    'ally_07_xuanyin_xianzi',
    'ally_08_moyu_zhenren',
    'ally_09_lieyan_qiangsheng',
    'ally_10_zixiao_xianji',
    'ally_11_jinjia_tianjiang',
    'ally_12_hanshuang_xianzi',
    'ally_13_qinglian_yaozun',
    'ally_14_lingfeng_archer',
    'ally_15_yeming_assassin',
    'ally_16_tianyin_qinshi',
    'ally_17_xuanji_yanshi',
    'ally_18_chiyan_luohan',
    'ally_19_xuanchao_chain_warden',
    'ally_20_red_furnace_smith',
    'ally_21_fuyou_parasol_envoy',
    'ally_22_solar_scripture_keeper',
    'ally_23_ink_pact_chess_master',
    'ally_24_frost_whale_conch_herald',
    'ally_25_vermilion_bell_dancer',
    'ally_26_azure_luan_paper_artisan',
    'ally_27_celestial_mirror_magistrate',
    'ally_28_soul_stitch_embroiderer',
] as const;

const ALLY_CONFIG_ID_SET = new Set<string>(ALLY_CONFIG_IDS);

export function resolveRoleConfigId(role: PlayerRoleInstance): string | null {
    const rawId = String(role.roleId);
    if (ALLY_CONFIG_ID_SET.has(rawId)) return rawId;
    if (!/^\d+$/.test(rawId)) return null;
    const index = Number(rawId) - 1;
    return ALLY_CONFIG_IDS[index] ?? null;
}

function createOwnedRoleUnit(role: PlayerRoleInstance): BattleUnitConfig | null {
    const configId = resolveRoleConfigId(role);
    if (!configId) return null;
    const skills = getUnitBattleSkills(configId);
    if (skills.length !== 4) return null;
    const current = getPlayerRoleCurrentAttribute(role);
    const skillLevel = Math.max(1, role.skillLevel ?? 1);
    const skillPowerRate = 1 + (skillLevel - 1) * 0.03;
    const slug = configId.replace(/^ally_\d+_/, '');
    return {
        configId,
        name: skills[0].unitName,
        camp: 'ally',
        iconPath: 'gui/common/roleIcon/character_' + slug + '/spriteFrame',
        animation: { sourceFacing: 'right' },
        attributes: {
            maxHp: current.hp,
            attack: Math.round(current.attack * skillPowerRate),
            defense: current.defense,
            speed: current.speed,
            critRate: Math.min(0.2, 0.03 + role.star * 0.025),
            hitRate: 1,
        },
    };
}

function createOwnedMonsterUnit(monster: PlayerMonsterInstance): BattleUnitConfig | null {
    const configId = monster.monsterId;
    const skills = getUnitBattleSkills(configId);
    if (!configId.startsWith('enemy_') || skills.length !== 4) return null;
    const current = getPlayerMonsterCurrentAttribute(monster);
    const skillLevel = Math.max(1, monster.skillLevel ?? 1);
    const skillPowerRate = 1 + (skillLevel - 1) * 0.03;
    return {
        configId,
        name: skills[0].unitName,
        camp: 'ally',
        iconPath: 'gui/common/roleIcon/' + configId.replace(/^enemy_/, 'monster_') + '/spriteFrame',
        animation: { sourceFacing: 'right' },
        attributes: {
            maxHp: current.hp,
            attack: Math.round(current.attack * skillPowerRate),
            defense: current.defense,
            speed: current.speed,
            critRate: Math.min(0.2, 0.03 + monster.star * 0.025),
            hitRate: 1,
        },
    };
}

export function loadBattleFormation(): PlayerBattleFormationData {
    const saved = GameStorage.load<Partial<PlayerBattleFormationData>>(BATTLE_FORMATION_STORAGE_KEY);
    if (!saved || saved.version !== 1 || !Array.isArray(saved.allyInstanceIds)) {
        return { version: 1, allyInstanceIds: [] };
    }
    const used = new Set<string>();
    const allyInstanceIds = saved.allyInstanceIds
        .filter((id): id is string => typeof id === 'string' && !!id)
        .filter((id) => {
            if (used.has(id)) return false;
            used.add(id);
            return true;
        })
        .slice(0, 5);
    return { version: 1, allyInstanceIds };
}

/** 阵容界面保存站位时调用；战斗入口未显式传阵容时会读取这里。 */
export function saveBattleFormation(allyInstanceIds: readonly string[]): void {
    const used = new Set<string>();
    const normalized = allyInstanceIds
        .filter((id) => typeof id === 'string' && !!id)
        .filter((id) => {
            if (used.has(id)) return false;
            used.add(id);
            return true;
        });
    if (!normalized.length || normalized.length > 5) {
        throw new Error('[BattleRoster] 阵容人数必须为1-5。');
    }
    GameStorage.save<PlayerBattleFormationData>(BATTLE_FORMATION_STORAGE_KEY, {
        version: 1,
        allyInstanceIds: normalized,
    });
}

function selectOwnedUnits(instanceIds?: readonly string[]): OwnedFormationUnit[] {
    const units: OwnedFormationUnit[] = [
        ...loadPlayerRoleData().roles.map((instance): OwnedFormationUnit => ({ kind: 'role', instance })),
        ...loadPlayerMonsterData().monsters.map((instance): OwnedFormationUnit => ({ kind: 'monster', instance })),
    ];
    const selectedIds = instanceIds?.length
        ? instanceIds
        : loadBattleFormation().allyInstanceIds;
    if (selectedIds.length) {
        const byId = new Map(units.map((unit) => [unit.instance.instanceId, unit]));
        const used = new Set<string>();
        const selected = selectedIds
            .filter((id) => {
                if (used.has(id)) return false;
                used.add(id);
                return true;
            })
            .map((id) => byId.get(id))
            .filter((unit): unit is OwnedFormationUnit => !!unit)
            .slice(0, 5);
        if (selected.length) return selected;
    }
    return units
        .slice()
        .sort((a, b) => (
            b.instance.star - a.instance.star
            || b.instance.level - a.instance.level
            || a.instance.obtainedAt - b.instance.obtainedAt
            || a.instance.instanceId.localeCompare(b.instance.instanceId)
        ))
        .slice(0, 5);
}

function resolveAllies(args: BattleOpenArgs): {
    allies: readonly BattleUnitConfig[];
    usingFallback: boolean;
} {
    if (args.allies?.length) {
        const allies = args.allies.slice(0, 5);
        if (allies.some((unit) => unit.camp !== 'ally')) {
            throw new Error('[BattleRoster] 外部阵容中包含非友方单位。');
        }
        return { allies, usingFallback: false };
    }

    const owned = selectOwnedUnits(args.allyInstanceIds)
        .map((unit) => unit.kind === 'role'
            ? createOwnedRoleUnit(unit.instance)
            : createOwnedMonsterUnit(unit.instance))
        .filter((unit): unit is BattleUnitConfig => !!unit);
    if (owned.length) return { allies: owned, usingFallback: false };

    return { allies: BATTLE_DEMO_ALLIES, usingFallback: true };
}

export function resolveBattleSession(args: BattleOpenArgs = {}): ResolvedBattleSession {
    const stage = getBattleStageConfig(args.stageId ?? DEFAULT_BATTLE_STAGE_ID);
    const { allies, usingFallback } = resolveAllies(args);
    const waves = stage.waves?.length
        ? stage.waves.map((wave) => wave.enemies)
        : [stage.enemies];
    if (!allies.length || allies.length > 5) {
        throw new Error('[BattleRoster] 友方阵容人数必须为1-5。');
    }
    for (const unit of allies) {
        if (getUnitBattleSkills(unit.configId).length !== 4) {
            throw new Error('[BattleRoster] ' + unit.configId + ' 未配置完整技能。');
        }
    }
    return {
        stage,
        allies,
        enemies: waves[0],
        waves,
        roster: [...allies, ...waves[0]],
        usingFallbackAllies: usingFallback,
    };
}
