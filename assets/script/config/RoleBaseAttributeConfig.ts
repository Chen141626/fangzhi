import { RoleType } from '../core/GameEnum';

/** 角色初始星级。 */
export type RoleStar = 1 | 2 | 3 | 4 | 5;

/** 每升一级，除速度外的基础属性成长倍率。 */
export const ROLE_LEVEL_GROWTH_RATE = 1.38;

/** 包含最小值和最大值的闭区间。 */
export interface AttributeRange {
    min: number;
    max: number;
}

/** 某星级、某类型角色的基础属性区间。 */
export interface RoleBaseAttributeRange {
    hp: AttributeRange;
    speed: AttributeRange;
    attack: AttributeRange;
    defense: AttributeRange;
}

/** 已经根据区间生成的角色基础属性。 */
export interface RoleBaseAttribute {
    hp: number;
    speed: number;
    attack: number;
    defense: number;
}

type RoleTypeAttributeConfig = Record<RoleType, RoleBaseAttributeRange>;

export const RoleBaseAttributeConfig: Record<RoleStar, RoleTypeAttributeConfig> = {
    1: {
        [RoleType.Hp]: {
            hp: { min: 900, max: 1100 },
            speed: { min: 85, max: 90 },
            attack: { min: 50, max: 65 },
            defense: { min: 45, max: 55 },
        },
        [RoleType.Attack]: {
            hp: { min: 700, max: 900 },
            speed: { min: 85, max: 90 },
            attack: { min: 65, max: 90 },
            defense: { min: 45, max: 65 },
        },
        [RoleType.Defense]: {
            hp: { min: 800, max: 1000 },
            speed: { min: 85, max: 90 },
            attack: { min: 50, max: 60 },
            defense: { min: 55, max: 75 },
        },
        [RoleType.Assistance]: {
            hp: { min: 800, max: 950 },
            speed: { min: 90, max: 100 },
            attack: { min: 55, max: 70 },
            defense: { min: 50, max: 60 },
        },
    },
    2: {
        [RoleType.Hp]: {
            hp: { min: 1500, max: 1700 },
            speed: { min: 90, max: 95 },
            attack: { min: 80, max: 105 },
            defense: { min: 70, max: 85 },
        },
        [RoleType.Attack]: {
            hp: { min: 1100, max: 1500 },
            speed: { min: 90, max: 95 },
            attack: { min: 105, max: 145 },
            defense: { min: 70, max: 105 },
        },
        [RoleType.Defense]: {
            hp: { min: 1300, max: 1550 },
            speed: { min: 90, max: 95 },
            attack: { min: 85, max: 100 },
            defense: { min: 90, max: 120 },
        },
        [RoleType.Assistance]: {
            hp: { min: 1300, max: 1500 },
            speed: { min: 95, max: 105 },
            attack: { min: 90, max: 110 },
            defense: { min: 80, max: 100 },
        },
    },
    3: {
        [RoleType.Hp]: {
            hp: { min: 2300, max: 2600 },
            speed: { min: 95, max: 100 },
            attack: { min: 120, max: 160 },
            defense: { min: 110, max: 130 },
        },
        [RoleType.Attack]: {
            hp: { min: 1700, max: 2300 },
            speed: { min: 95, max: 100 },
            attack: { min: 160, max: 220 },
            defense: { min: 110, max: 160 },
        },
        [RoleType.Defense]: {
            hp: { min: 2000, max: 2400 },
            speed: { min: 95, max: 100 },
            attack: { min: 130, max: 150 },
            defense: { min: 140, max: 180 },
        },
        [RoleType.Assistance]: {
            hp: { min: 2000, max: 2300 },
            speed: { min: 100, max: 115 },
            attack: { min: 140, max: 170 },
            defense: { min: 120, max: 150 },
        },
    },
    4: {
        [RoleType.Hp]: {
            hp: { min: 3900, max: 4300 },
            speed: { min: 100, max: 110 },
            attack: { min: 240, max: 260 },
            defense: { min: 190, max: 210 },
        },
        [RoleType.Attack]: {
            hp: { min: 3400, max: 3900 },
            speed: { min: 100, max: 110 },
            attack: { min: 280, max: 320 },
            defense: { min: 180, max: 200 },
        },
        [RoleType.Defense]: {
            hp: { min: 3800, max: 4100 },
            speed: { min: 100, max: 110 },
            attack: { min: 170, max: 200 },
            defense: { min: 220, max: 250 },
        },
        [RoleType.Assistance]: {
            hp: { min: 3600, max: 4000 },
            speed: { min: 110, max: 125 },
            attack: { min: 190, max: 230 },
            defense: { min: 180, max: 210 },
        },
    },
    5: {
        [RoleType.Hp]: {
            hp: { min: 8000, max: 10000 },
            speed: { min: 120, max: 130 },
            attack: { min: 480, max: 520 },
            defense: { min: 500, max: 550 },
        },
        [RoleType.Attack]: {
            hp: { min: 7000, max: 9000 },
            speed: { min: 120, max: 130 },
            attack: { min: 560, max: 640 },
            defense: { min: 400, max: 450 },
        },
        [RoleType.Defense]: {
            hp: { min: 8500, max: 9500 },
            speed: { min: 120, max: 130 },
            attack: { min: 450, max: 500 },
            defense: { min: 550, max: 600 },
        },
        [RoleType.Assistance]: {
            hp: { min: 8000, max: 9000 },
            speed: { min: 130, max: 145 },
            attack: { min: 490, max: 530 },
            defense: { min: 450, max: 500 },
        },
    },
};

/** 获取对应星级与类型的属性区间。 */
export function getRoleBaseAttributeRange(
    star: RoleStar,
    roleType: RoleType,
): RoleBaseAttributeRange {
    return RoleBaseAttributeConfig[star][roleType];
}

function randomInteger(range: AttributeRange, random: () => number): number {
    return Math.floor(random() * (range.max - range.min + 1)) + range.min;
}

/**
 * 生成对应星级与类型的初始属性，区间的最小值和最大值均可取到。
 * 可传入自定义 random 方法，便于测试或使用固定随机种子。
 */
export function createRoleBaseAttribute(
    star: RoleStar,
    roleType: RoleType,
    random: () => number = Math.random,
): RoleBaseAttribute {
    const config = getRoleBaseAttributeRange(star, roleType);

    return {
        hp: randomInteger(config.hp, random),
        speed: randomInteger(config.speed, random),
        attack: randomInteger(config.attack, random),
        defense: randomInteger(config.defense, random),
    };
}

/**
 * 根据 1 级基础属性计算指定等级属性。
 * 血量、攻击、防御每级均在上一级结果上乘 1.38 并向上取整，速度不成长。
 */
export function calculateRoleAttributeAtLevel(
    baseAttribute: RoleBaseAttribute,
    level: number,
): RoleBaseAttribute {
    if (!Number.isInteger(level) || level < 1) {
        throw new RangeError(`Role level must be a positive integer, received: ${level}`);
    }

    const result: RoleBaseAttribute = { ...baseAttribute };
    for (let currentLevel = 1; currentLevel < level; currentLevel++) {
        result.hp = Math.ceil(result.hp * ROLE_LEVEL_GROWTH_RATE);
        result.attack = Math.ceil(result.attack * ROLE_LEVEL_GROWTH_RATE);
        result.defense = Math.ceil(result.defense * ROLE_LEVEL_GROWTH_RATE);
    }

    return result;
}

/** 随机生成 1 级基础属性，并计算到指定等级。 */
export function createRoleAttributeAtLevel(
    star: RoleStar,
    roleType: RoleType,
    level: number,
    random: () => number = Math.random,
): RoleBaseAttribute {
    const baseAttribute = createRoleBaseAttribute(star, roleType, random);
    return calculateRoleAttributeAtLevel(baseAttribute, level);
}

//const attribute = createRoleBaseAttribute(5, RoleType.Attack);
