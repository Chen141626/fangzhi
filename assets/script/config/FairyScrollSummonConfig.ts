import { FairyScrollType, RoleProfession } from '../core/GameEnum';
import { RoleStar } from './RoleBaseAttributeConfig';

/** 召唤权重总值，1000 代表 100%。 */
export const SUMMON_WEIGHT_TOTAL = 1000;

export interface SummonStarWeight {
    star: RoleStar;
    weight: number;
}

export interface FairyScrollSummonRule {
    starWeights: readonly SummonStarWeight[];
    professions: readonly RoleProfession[];
}

export interface SummonableRole {
    star: RoleStar;
    profession: RoleProfession;
}

const ALL_PROFESSIONS: readonly RoleProfession[] = [
    RoleProfession.Water,
    RoleProfession.Fire,
    RoleProfession.Wind,
    RoleProfession.Light,
    RoleProfession.Dark,
];

const LOW_STAR_WEIGHTS: readonly SummonStarWeight[] = [
    { star: 1, weight: 800 },
    { star: 2, weight: 190 },
    { star: 3, weight: 10 },
];

/** 各类召唤书的星级概率和可召唤属性。 */
export const FairyScrollSummonConfig: Record<FairyScrollType, FairyScrollSummonRule> = {
    [FairyScrollType.Ordinary]: {
        starWeights: LOW_STAR_WEIGHTS,
        professions: ALL_PROFESSIONS,
    },
    [FairyScrollType.Water]: {
        starWeights: LOW_STAR_WEIGHTS,
        professions: [RoleProfession.Water],
    },
    [FairyScrollType.Fire]: {
        starWeights: LOW_STAR_WEIGHTS,
        professions: [RoleProfession.Fire],
    },
    [FairyScrollType.Wind]: {
        starWeights: LOW_STAR_WEIGHTS,
        professions: [RoleProfession.Wind],
    },
    [FairyScrollType.LightAddDark]: {
        starWeights: [
            { star: 3, weight: 975 },
            { star: 4, weight: 20 },
            { star: 5, weight: 5 },
        ],
        professions: [RoleProfession.Light, RoleProfession.Dark],
    },
    [FairyScrollType.All]: {
        starWeights: [
            { star: 3, weight: 915 },
            { star: 4, weight: 80 },
            { star: 5, weight: 5 },
        ],
        professions: ALL_PROFESSIONS,
    },
    [FairyScrollType.Mythology]: {
        starWeights: [
            { star: 4, weight: 900 },
            { star: 5, weight: 100 },
        ],
        professions: ALL_PROFESSIONS,
    },
};

export function getFairyScrollSummonRule(scrollType: FairyScrollType): FairyScrollSummonRule {
    return FairyScrollSummonConfig[scrollType];
}

/** 按召唤书概率抽取星级。 */
export function drawSummonStar(
    scrollType: FairyScrollType,
    random: () => number = Math.random,
): RoleStar {
    const randomValue = random();
    if (randomValue < 0 || randomValue >= 1) {
        throw new RangeError(`Random value must be in [0, 1), received: ${randomValue}`);
    }

    const rule = getFairyScrollSummonRule(scrollType);
    const roll = Math.floor(randomValue * SUMMON_WEIGHT_TOTAL);
    let accumulatedWeight = 0;

    for (const item of rule.starWeights) {
        accumulatedWeight += item.weight;
        if (roll < accumulatedWeight) {
            return item.star;
        }
    }

    throw new Error(`Invalid summon weight config for scroll type: ${scrollType}`);
}

/** 检查某属性角色是否可被该召唤书召唤。 */
export function isProfessionAllowed(
    scrollType: FairyScrollType,
    profession: RoleProfession,
): boolean {
    return getFairyScrollSummonRule(scrollType).professions.includes(profession);
}

/** 根据抽到的星级和召唤书属性限制，过滤可召唤角色池。 */
export function filterSummonableRoles<T extends SummonableRole>(
    roles: readonly T[],
    scrollType: FairyScrollType,
    star: RoleStar,
): T[] {
    return roles.filter((role) => (
        role.star === star
        && isProfessionAllowed(scrollType, role.profession)
    ));
}
