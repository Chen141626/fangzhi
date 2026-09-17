import { BattleAttributes, BattleCamp } from './BattleEffectTypes';

/** 演示战斗中的固定单位。之后接阵容/关卡配置时只需替换这层数据来源。 */
export interface BattleDemoUnitConfig {
    configId: string;
    name: string;
    camp: BattleCamp;
    iconPath: string;
    attributes: BattleAttributes;
}

export const BATTLE_DEMO_ALLIES: readonly BattleDemoUnitConfig[] = [
    {
        configId: 'ally_01_crystal_mage',
        name: '晶霜法师',
        camp: 'ally',
        iconPath: 'gui/common/roleIcon/character_crystal_mage/spriteFrame',
        attributes: { maxHp: 5600, attack: 760, defense: 220, speed: 112, critRate: 0.12 },
    },
    {
        configId: 'ally_03_jade_healer',
        name: '碧玉医仙',
        camp: 'ally',
        iconPath: 'gui/common/roleIcon/character_jade_healer/spriteFrame',
        attributes: { maxHp: 6100, attack: 620, defense: 250, speed: 105, hitRate: 1 },
    },
    {
        configId: 'ally_05_guardian',
        name: '金盾守卫',
        camp: 'ally',
        iconPath: 'gui/common/roleIcon/character_guardian/spriteFrame',
        attributes: { maxHp: 7600, attack: 560, defense: 380, speed: 88, dodgeRate: 0.03 },
    },
    {
        configId: 'ally_09_lieyan_qiangsheng',
        name: '烈焰枪圣',
        camp: 'ally',
        iconPath: 'gui/common/roleIcon/character_lieyan_qiangsheng/spriteFrame',
        attributes: { maxHp: 6300, attack: 820, defense: 260, speed: 101, critRate: 0.15 },
    },
    {
        configId: 'ally_16_tianyin_qinshi',
        name: '天音琴师',
        camp: 'ally',
        iconPath: 'gui/common/roleIcon/character_tianyin_qinshi/spriteFrame',
        attributes: { maxHp: 5900, attack: 650, defense: 235, speed: 109, hitRate: 1 },
    },
];

export const BATTLE_DEMO_ENEMIES: readonly BattleDemoUnitConfig[] = [
    {
        configId: 'enemy_01_horned_swordsman',
        name: '角刃妖兵',
        camp: 'enemy',
        iconPath: 'gui/common/roleIcon/monster_01_horned_swordsman/spriteFrame',
        attributes: { maxHp: 6000, attack: 700, defense: 235, speed: 104, critRate: 0.1 },
    },
    {
        configId: 'enemy_03_fox_caster',
        name: '狐火术士',
        camp: 'enemy',
        iconPath: 'gui/common/roleIcon/monster_03_fox_caster/spriteFrame',
        attributes: { maxHp: 5400, attack: 750, defense: 205, speed: 111, dodgeRate: 0.08 },
    },
    {
        configId: 'enemy_07_stone_guardian',
        name: '岩甲灵卫',
        camp: 'enemy',
        iconPath: 'gui/common/roleIcon/monster_07_stone_guardian/spriteFrame',
        attributes: { maxHp: 7400, attack: 570, defense: 390, speed: 84, dodgeRate: 0.02 },
    },
    {
        configId: 'enemy_10_jade_poison_toad',
        name: '碧毒蟾妖',
        camp: 'enemy',
        iconPath: 'gui/common/roleIcon/monster_10_jade_poison_toad/spriteFrame',
        attributes: { maxHp: 6500, attack: 660, defense: 285, speed: 92, hitRate: 1 },
    },
    {
        configId: 'enemy_15_blackwater_tortoise_king',
        name: '黑水玄龟王',
        camp: 'enemy',
        iconPath: 'gui/common/roleIcon/monster_15_blackwater_tortoise_king/spriteFrame',
        // 演示关降低 Boss 面板，保证自动战斗能在回合上限前完整走到击败结算。
        attributes: { maxHp: 4500, attack: 640, defense: 220, speed: 79, critRate: 0.08 },
    },
];

export const BATTLE_DEMO_ROSTER: readonly BattleDemoUnitConfig[] = [
    ...BATTLE_DEMO_ALLIES,
    ...BATTLE_DEMO_ENEMIES,
];
