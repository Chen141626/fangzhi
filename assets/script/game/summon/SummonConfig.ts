import { RoleProfession, RoleType } from '../../core/GameEnum';
import { RoleStar } from '../../config/RoleBaseAttributeConfig';
import { SummonMonsterDefinition, SummonRoleDefinition } from './SummonService';

const ROLE_TYPES = [RoleType.Hp, RoleType.Attack, RoleType.Defense, RoleType.Assistance] as const;

/** 28 名角色全部进入召唤池，并覆盖五种星级与五种属性。 */
export const DEFAULT_SUMMON_ROLE_POOL: readonly SummonRoleDefinition[] = Array.from(
    { length: 28 },
    (_, index) => {
        const star = ((index % 5) + 1) as RoleStar;
        const profession = (Math.floor(index / 5) % 5) as RoleProfession;
        return {
            roleId: index + 1,
            star,
            profession,
            roleType: ROLE_TYPES[(index + star) % ROLE_TYPES.length],
        };
    },
);

export const MONSTER_CONFIG_IDS = [
    'enemy_01_horned_swordsman',
    'enemy_02_lion_warrior',
    'enemy_03_fox_caster',
    'enemy_04_dark_swordsman',
    'enemy_05_red_sorcerer',
    'enemy_06_shadow_wolf',
    'enemy_07_stone_guardian',
    'enemy_08_bamboo_rat_demon',
    'enemy_09_talisman_lantern_ghost',
    'enemy_10_jade_poison_toad',
    'enemy_11_ironclaw_falcon',
    'enemy_12_withered_vine_spirit',
    'enemy_13_frost_armor_spider',
    'enemy_14_rust_armor_corpse',
    'enemy_15_blackwater_tortoise_king',
    'enemy_16_thunder_prison_kui_ox',
    'enemy_17_thousand_mask_nuo_king',
    'enemy_18_abyssal_spiral_shell_emperor',
    'enemy_19_molten_prison_centipede',
    'enemy_20_cloud_wing_manta_demon',
    'enemy_21_radiant_crystal_stag_king',
    'enemy_22_dream_eater_tapir_king',
] as const;

/** 22 种怪物使用与角色相同的星级概率，写入独立怪物存档。 */
export const DEFAULT_SUMMON_MONSTER_POOL: readonly SummonMonsterDefinition[] = MONSTER_CONFIG_IDS.map(
    (monsterId, index) => {
        const star = ((index % 5) + 1) as RoleStar;
        return {
            monsterId,
            star,
            profession: ((index * 2 + Math.floor(index / 5)) % 5) as RoleProfession,
            roleType: ROLE_TYPES[(index + 2) % ROLE_TYPES.length],
        };
    },
);

export const SUMMON_SINGLE_COST = 100;
export const SUMMON_TEN_COST = 900;
