import {
    ApplyBuffSkillEffect,
    BattleBuffId,
    BattleSkillConfig,
    BattleSkillEffect,
    CleanseSkillEffect,
    DamageSkillEffect,
    DispelSkillEffect,
    HealSkillEffect,
    SkillKind,
    SkillTarget,
    SkillTrigger,
} from './BattleEffectTypes';

interface SkillSeed {
    name: string;
    description: string;
    effects: readonly BattleSkillEffect[];
    kind?: SkillKind;
    trigger?: SkillTrigger;
    cooldown?: number;
}

function damage(
    target: SkillTarget,
    attackScale: number,
    options: Partial<Omit<DamageSkillEffect, 'type' | 'target' | 'attackScale'>> = {},
): DamageSkillEffect {
    return { type: 'damage', target, attackScale, canCritical: true, ...options };
}

function heal(
    target: SkillTarget,
    attackScale: number,
    targetMaxHpRate = 0,
): HealSkillEffect {
    return { type: 'heal', target, attackScale, targetMaxHpRate };
}

function buff(
    target: SkillTarget,
    buffId: BattleBuffId,
    chance = 1,
    duration?: number,
    stacks = 1,
    potency = 1,
): ApplyBuffSkillEffect {
    return { type: 'applyBuff', target, buffId, chance, duration, stacks, potency };
}

function cleanse(target: SkillTarget, count: number): CleanseSkillEffect {
    return { type: 'cleanse', target, count };
}

function dispel(target: SkillTarget, count: number): DispelSkillEffect {
    return { type: 'dispel', target, count };
}

function defineUnit(
    unitId: string,
    unitName: string,
    seeds: readonly [SkillSeed, SkillSeed, SkillSeed, SkillSeed],
): readonly BattleSkillConfig[] {
    const category = unitId.startsWith('ally_') ? 'allies' : 'enemies';
    return seeds.map((seed, index) => {
        const slot = (index + 1) as 1 | 2 | 3 | 4;
        const kind: SkillKind = seed.kind ?? (
            slot === 1 ? 'basic' : slot === 2 ? 'active' : slot === 3 ? 'ultimate' : 'passive'
        );
        return {
            id: `${unitId}.skill_${String(slot).padStart(2, '0')}`,
            unitId,
            unitName,
            slot,
            name: seed.name,
            kind,
            trigger: seed.trigger ?? (kind === 'passive' ? 'battleStart' : 'active'),
            cooldown: seed.cooldown ?? (slot === 1 || slot === 4 ? 0 : slot === 2 ? 2 : 4),
            iconPath: `skills/texture/skill_icons/${category}/${unitId}/skill_${String(slot).padStart(2, '0')}`,
            description: seed.description,
            effects: seed.effects,
        };
    });
}

const UNIT_SKILL_LIST: readonly (readonly BattleSkillConfig[])[] = [
    defineUnit('ally_01_crystal_mage', '晶霜法师', [
        { name: '晶棱弹', description: '对单体造成100%攻击伤害，30%概率减速2回合。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_slow', 0.3, 2)] },
        { name: '星晶护体', description: '为生命最低的友方附加2回合星晶护盾与防御提升。', effects: [buff('lowestHpAlly', 'buff_shield', 1, 2), buff('lowestHpAlly', 'buff_defense_up', 1, 2)] },
        { name: '冰晶风暴', description: '对全体敌人造成125%攻击伤害，35%概率冰冻1回合。', effects: [damage('allEnemies', 1.25), buff('allEnemies', 'debuff_freeze', 0.35, 1)] },
        { name: '晶能共鸣', description: '战斗开始时，全体友方暴击率提升2回合。', effects: [buff('allAllies', 'buff_critical_up', 1, 2)] },
    ]),
    defineUnit('ally_02_blue_swordsman', '青锋剑客', [
        { name: '青锋斩', description: '对单体造成110%攻击伤害。', effects: [damage('singleEnemy', 1.1)] },
        { name: '流云突', description: '对单体造成145%攻击伤害，并降低防御2回合。', effects: [damage('singleEnemy', 1.45), buff('singleEnemy', 'debuff_defense_down', 1, 2)] },
        { name: '剑气纵横', description: '对全体敌人造成140%攻击伤害。', effects: [damage('allEnemies', 1.4)] },
        { name: '剑心通明', description: '战斗开始时获得攻击提升与攻速提升3回合。', effects: [buff('self', 'buff_attack_up', 1, 3), buff('self', 'buff_attack_speed_up', 1, 3)] },
    ]),
    defineUnit('ally_03_jade_healer', '碧玉医仙', [
        { name: '灵玉针', description: '对单体造成90%攻击伤害。', effects: [damage('singleEnemy', 0.9)] },
        { name: '青玉回春', description: '治疗生命最低友方，并附加3回合持续恢复。', effects: [heal('lowestHpAlly', 1.2, 0.08), buff('lowestHpAlly', 'buff_regeneration', 1, 3)] },
        { name: '莲华净世', description: '治疗全体友方，净化每人2个减益效果。', effects: [heal('allAllies', 0.85, 0.05), cleanse('allAllies', 2)] },
        { name: '玉脉生息', description: '战斗开始时，全体友方获得3回合持续恢复。', effects: [buff('allAllies', 'buff_regeneration', 1, 3)] },
    ]),
    defineUnit('ally_04_ice_mage', '寒冰术士', [
        { name: '寒冰箭', description: '对单体造成100%攻击伤害，并减速2回合。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_slow', 1, 2)] },
        { name: '霜寒之环', description: '对全体敌人造成75%攻击伤害，25%概率冰冻。', effects: [damage('allEnemies', 0.75), buff('allEnemies', 'debuff_freeze', 0.25, 1)] },
        { name: '极寒天幕', description: '对全体敌人造成130%攻击伤害，并减速3回合。', effects: [damage('allEnemies', 1.3), buff('allEnemies', 'debuff_slow', 1, 3)] },
        { name: '冰心凝神', description: '战斗开始时获得护盾与控制免疫2回合。', effects: [buff('self', 'buff_shield', 1, 2), buff('self', 'buff_control_immunity', 1, 2)] },
    ]),
    defineUnit('ally_05_guardian', '金盾守卫', [
        { name: '镇岳盾击', description: '造成90%攻击伤害，25%概率眩晕目标。', effects: [damage('singleEnemy', 0.9), buff('singleEnemy', 'debuff_stun', 0.25, 1)] },
        { name: '磐石守护', description: '自身获得护盾、防御提升与坚韧2回合。', effects: [buff('self', 'buff_shield', 1, 2, 1, 1.3), buff('self', 'buff_defense_up', 1, 2), buff('self', 'buff_tenacity', 1, 2)] },
        { name: '金钟镇岳', description: '全体友方获得2回合护盾。', effects: [buff('allAllies', 'buff_shield', 1, 2)] },
        { name: '不动如山', description: '生命首次低于50%时，获得反击、防御提升3回合。', trigger: 'healthBelow50', effects: [buff('self', 'buff_counter', 1, 3), buff('self', 'buff_defense_up', 1, 3)] },
    ]),
    defineUnit('ally_06_qingfeng_daotong', '清风道童', [
        { name: '清风刃', description: '对单体造成100%攻击伤害。', effects: [damage('singleEnemy', 1)] },
        { name: '御风诀', description: '全体友方获得迅捷2回合。', effects: [buff('allAllies', 'buff_haste', 1, 2)] },
        { name: '清风万象', description: '对全体敌人造成115%攻击伤害，并减速2回合。', effects: [damage('allEnemies', 1.15), buff('allEnemies', 'debuff_slow', 1, 2)] },
        { name: '风灵相随', description: '战斗开始时，全体友方获得攻速提升2回合。', effects: [buff('allAllies', 'buff_attack_speed_up', 1, 2)] },
    ]),
    defineUnit('ally_07_xuanyin_xianzi', '玄阴仙子', [
        { name: '月华刃', description: '对单体造成105%攻击伤害。', effects: [damage('singleEnemy', 1.05)] },
        { name: '玄阴缚', description: '造成120%攻击伤害，并沉默目标2回合。', effects: [damage('singleEnemy', 1.2), buff('singleEnemy', 'debuff_silence', 1, 2)] },
        { name: '太阴蚀月', description: '对全体敌人造成125%攻击伤害，并降低攻击2回合。', effects: [damage('allEnemies', 1.25), buff('allEnemies', 'debuff_attack_down', 1, 2)] },
        { name: '月魄', description: '战斗开始时获得吸血与暴击提升3回合。', effects: [buff('self', 'buff_lifesteal', 1, 3), buff('self', 'buff_critical_up', 1, 3)] },
    ]),
    defineUnit('ally_08_moyu_zhenren', '墨羽真人', [
        { name: '墨羽击', description: '对单体造成100%攻击伤害，30%概率致盲。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_blind', 0.3, 2)] },
        { name: '泼墨封灵', description: '造成115%攻击伤害，并沉默目标2回合。', effects: [damage('singleEnemy', 1.15), buff('singleEnemy', 'debuff_silence', 1, 2)] },
        { name: '万羽归玄', description: '随机攻击3名敌人，各造成150%攻击伤害并致盲。', effects: [damage('randomEnemies3', 1.5), buff('randomEnemies3', 'debuff_blind', 1, 2)] },
        { name: '墨韵', description: '战斗开始时获得迅捷和攻击提升2回合。', effects: [buff('self', 'buff_haste', 1, 2), buff('self', 'buff_attack_up', 1, 2)] },
    ]),
    defineUnit('ally_09_lieyan_qiangsheng', '烈焰枪圣', [
        { name: '炎枪突', description: '造成110%攻击伤害，并施加1层灼烧。', effects: [damage('singleEnemy', 1.1), buff('singleEnemy', 'debuff_burn')] },
        { name: '火龙横扫', description: '对全体敌人造成90%攻击伤害，施加1层灼烧。', effects: [damage('allEnemies', 0.9), buff('allEnemies', 'debuff_burn')] },
        { name: '烈焰贯日', description: '对单体造成230%攻击伤害，并施加2层灼烧。', effects: [damage('singleEnemy', 2.3), buff('singleEnemy', 'debuff_burn', 1, 2, 2)] },
        { name: '枪魂', description: '战斗开始时获得攻击与暴击提升3回合。', effects: [buff('self', 'buff_attack_up', 1, 3), buff('self', 'buff_critical_up', 1, 3)] },
    ]),
    defineUnit('ally_10_zixiao_xianji', '紫霄仙姬', [
        { name: '雷音', description: '造成100%攻击伤害，20%概率眩晕。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_stun', 0.2, 1)] },
        { name: '紫霄弦', description: '随机攻击2名敌人，各造成125%攻击伤害，30%概率眩晕。', effects: [damage('randomEnemies2', 1.25), buff('randomEnemies2', 'debuff_stun', 0.3, 1)] },
        { name: '九天雷曲', description: '对全体敌人造成135%攻击伤害，45%概率眩晕。', effects: [damage('allEnemies', 1.35), buff('allEnemies', 'debuff_stun', 0.45, 1)] },
        { name: '天音感应', description: '战斗开始时，全体友方获得迅捷2回合。', effects: [buff('allAllies', 'buff_haste', 1, 2)] },
    ]),
    defineUnit('ally_11_jinjia_tianjiang', '金甲天将', [
        { name: '破阵戟', description: '造成110%攻击伤害，并降低目标防御2回合。', effects: [damage('singleEnemy', 1.1), buff('singleEnemy', 'debuff_defense_down', 1, 2)] },
        { name: '金甲护体', description: '自身获得强化护盾和防御提升3回合。', effects: [buff('self', 'buff_shield', 1, 3, 1, 1.4), buff('self', 'buff_defense_up', 1, 3)] },
        { name: '天罡镇邪', description: '对全体敌人造成120%攻击伤害，30%概率眩晕。', effects: [damage('allEnemies', 1.2), buff('allEnemies', 'debuff_stun', 0.3, 1)] },
        { name: '神威', description: '战斗开始时获得控制免疫和坚韧3回合。', effects: [buff('self', 'buff_control_immunity', 1, 3), buff('self', 'buff_tenacity', 1, 3)] },
    ]),
    defineUnit('ally_12_hanshuang_xianzi', '寒霜仙子', [
        { name: '寒霜冰华', description: '造成100%攻击伤害，30%概率冰冻。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_freeze', 0.3, 1)] },
        { name: '霜镜', description: '生命最低友方获得护盾与控制免疫2回合。', effects: [buff('lowestHpAlly', 'buff_shield', 1, 2), buff('lowestHpAlly', 'buff_control_immunity', 1, 2)] },
        { name: '寒霜领域', description: '全体敌人受到110%攻击伤害，并被减速；40%概率冰冻。', effects: [damage('allEnemies', 1.1), buff('allEnemies', 'debuff_slow', 1, 2), buff('allEnemies', 'debuff_freeze', 0.4, 1)] },
        { name: '霜魄', description: '战斗开始时，全体友方获得防御提升2回合。', effects: [buff('allAllies', 'buff_defense_up', 1, 2)] },
    ]),
    defineUnit('ally_13_qinglian_yaozun', '青莲药尊', [
        { name: '药灵针', description: '造成85%攻击伤害，并驱散目标1个增益。', effects: [damage('singleEnemy', 0.85), dispel('singleEnemy', 1)] },
        { name: '青莲回春', description: '大量治疗生命最低友方，净化1个减益并持续恢复。', effects: [heal('lowestHpAlly', 1.45, 0.1), cleanse('lowestHpAlly', 1), buff('lowestHpAlly', 'buff_regeneration', 1, 3)] },
        { name: '百草济世', description: '治疗全体友方并净化2个减益。', effects: [heal('allAllies', 1, 0.06), cleanse('allAllies', 2)] },
        { name: '药灵护佑', description: '战斗开始时，全体友方获得持续恢复与坚韧3回合。', effects: [buff('allAllies', 'buff_regeneration', 1, 3), buff('allAllies', 'buff_tenacity', 1, 3)] },
    ]),
    defineUnit('ally_14_lingfeng_archer', '灵风弓使', [
        { name: '风矢', description: '造成105%攻击伤害。', effects: [damage('singleEnemy', 1.05)] },
        { name: '追风连射', description: '随机攻击2名敌人，各造成135%攻击伤害。', effects: [damage('randomEnemies2', 1.35)] },
        { name: '灵风贯日', description: '攻击生命最低敌人，造成220%伤害并施加2层流血。', effects: [damage('enemyLowestHp', 2.2, { executeBelowHpRate: 0.35, executeMultiplier: 1.5 }), buff('enemyLowestHp', 'debuff_bleed', 1, 3, 2)] },
        { name: '鹰眼', description: '战斗开始时获得暴击提升与迅捷3回合。', effects: [buff('self', 'buff_critical_up', 1, 3), buff('self', 'buff_haste', 1, 3)] },
    ]),
    defineUnit('ally_15_yeming_assassin', '夜冥刺客', [
        { name: '影刃', description: '造成110%攻击伤害，并施加1层流血。', effects: [damage('singleEnemy', 1.1), buff('singleEnemy', 'debuff_bleed')] },
        { name: '夜袭', description: '攻击生命最低敌人，造成175%攻击伤害并致盲。', effects: [damage('enemyLowestHp', 1.75), buff('enemyLowestHp', 'debuff_blind', 1, 2)] },
        { name: '幽冥绝杀', description: '造成260%攻击伤害；目标低于35%生命时伤害提高80%。', effects: [damage('enemyLowestHp', 2.6, { executeBelowHpRate: 0.35, executeMultiplier: 1.8 })] },
        { name: '隐匿', description: '战斗开始时获得迅捷、暴击提升与吸血2回合。', effects: [buff('self', 'buff_haste', 1, 2), buff('self', 'buff_critical_up', 1, 2), buff('self', 'buff_lifesteal', 1, 2)] },
    ]),
    defineUnit('ally_16_tianyin_qinshi', '天音琴师', [
        { name: '音刃', description: '造成90%攻击伤害，20%概率沉默。', effects: [damage('singleEnemy', 0.9), buff('singleEnemy', 'debuff_silence', 0.2, 1)] },
        { name: '清心曲', description: '治疗全体友方，净化1个减益并持续恢复2回合。', effects: [heal('allAllies', 0.65, 0.04), cleanse('allAllies', 1), buff('allAllies', 'buff_regeneration', 1, 2)] },
        { name: '天音镇魂', description: '对全体敌人造成95%攻击伤害，45%概率睡眠2回合。', effects: [damage('allEnemies', 0.95), buff('allEnemies', 'debuff_sleep', 0.45, 2)] },
        { name: '余韵', description: '战斗开始时，全体友方获得坚韧与攻击提升2回合。', effects: [buff('allAllies', 'buff_tenacity', 1, 2), buff('allAllies', 'buff_attack_up', 1, 2)] },
    ]),
    defineUnit('ally_17_xuanji_yanshi', '玄机偃师', [
        { name: '机弩', description: '造成105%攻击伤害，25%概率降低防御。', effects: [damage('singleEnemy', 1.05), buff('singleEnemy', 'debuff_defense_down', 0.25, 2)] },
        { name: '偃甲召来', description: '自身获得护盾、反击和防御提升2回合。', effects: [buff('self', 'buff_shield', 1, 2), buff('self', 'buff_counter', 1, 2), buff('self', 'buff_defense_up', 1, 2)] },
        { name: '千机齐发', description: '对全体敌人造成145%攻击伤害并降低防御2回合。', effects: [damage('allEnemies', 1.45), buff('allEnemies', 'debuff_defense_down', 1, 2)] },
        { name: '机关心', description: '战斗开始时获得攻击提升和控制免疫3回合。', effects: [buff('self', 'buff_attack_up', 1, 3), buff('self', 'buff_control_immunity', 1, 3)] },
    ]),
    defineUnit('ally_18_chiyan_luohan', '赤岩罗汉', [
        { name: '赤岩拳', description: '造成100%攻击伤害，20%概率眩晕。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_stun', 0.2, 1)] },
        { name: '罗汉金身', description: '自身获得防御提升、坚韧和护盾3回合。', effects: [buff('self', 'buff_defense_up', 1, 3), buff('self', 'buff_tenacity', 1, 3), buff('self', 'buff_shield', 1, 3)] },
        { name: '震地炎环', description: '对全体敌人造成115%攻击伤害，施加灼烧并有25%概率眩晕。', effects: [damage('allEnemies', 1.15), buff('allEnemies', 'debuff_burn'), buff('allEnemies', 'debuff_stun', 0.25, 1)] },
        { name: '不坏体', description: '生命首次低于50%时获得1回合无敌和3回合持续恢复。', trigger: 'healthBelow50', effects: [buff('self', 'buff_invincible', 1, 1), buff('self', 'buff_regeneration', 1, 3)] },
    ]),

    defineUnit('enemy_01_horned_swordsman', '角刃妖兵', [
        { name: '角刃斩', description: '造成100%攻击伤害，施加1层流血。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_bleed')] },
        { name: '蛮角突', description: '造成140%攻击伤害，25%概率眩晕。', effects: [damage('singleEnemy', 1.4), buff('singleEnemy', 'debuff_stun', 0.25, 1)] },
        { name: '旋刃', description: '对全体敌人造成105%攻击伤害并施加流血。', effects: [damage('allEnemies', 1.05), buff('allEnemies', 'debuff_bleed')] },
        { name: '凶性', description: '生命首次低于50%时，攻击与暴击提升3回合。', trigger: 'healthBelow50', effects: [buff('self', 'buff_attack_up', 1, 3), buff('self', 'buff_critical_up', 1, 3)] },
    ]),
    defineUnit('enemy_02_lion_warrior', '狮族战士', [
        { name: '裂爪', description: '造成110%攻击伤害。', effects: [damage('singleEnemy', 1.1)] },
        { name: '狮吼', description: '全体敌方攻击降低2回合，30%概率眩晕。', effects: [buff('allEnemies', 'debuff_attack_down', 1, 2), buff('allEnemies', 'debuff_stun', 0.3, 1)] },
        { name: '猛扑', description: '对生命最低敌人造成210%攻击伤害。', effects: [damage('enemyLowestHp', 2.1, { executeBelowHpRate: 0.3, executeMultiplier: 1.5 })] },
        { name: '狂怒', description: '生命首次低于50%时获得攻击提升与迅捷3回合。', trigger: 'healthBelow50', effects: [buff('self', 'buff_attack_up', 1, 3), buff('self', 'buff_haste', 1, 3)] },
    ]),
    defineUnit('enemy_03_fox_caster', '狐火术士', [
        { name: '狐火', description: '造成90%攻击伤害，并施加灼烧。', effects: [damage('singleEnemy', 0.9), buff('singleEnemy', 'debuff_burn')] },
        { name: '魅惑印', description: '造成80%攻击伤害，60%概率使目标睡眠2回合。', effects: [damage('singleEnemy', 0.8), buff('singleEnemy', 'debuff_sleep', 0.6, 2)] },
        { name: '妖焰雨', description: '对全体敌人造成110%攻击伤害，并施加灼烧。', effects: [damage('allEnemies', 1.1), buff('allEnemies', 'debuff_burn')] },
        { name: '狡黠', description: '战斗开始时获得迅捷和控制免疫2回合。', effects: [buff('self', 'buff_haste', 1, 2), buff('self', 'buff_control_immunity', 1, 2)] },
    ]),
    defineUnit('enemy_04_dark_swordsman', '暗影剑士', [
        { name: '暗斩', description: '造成105%攻击伤害，25%概率致盲。', effects: [damage('singleEnemy', 1.05), buff('singleEnemy', 'debuff_blind', 0.25, 2)] },
        { name: '影步', description: '自身获得迅捷、暴击提升2回合。', effects: [buff('self', 'buff_haste', 1, 2), buff('self', 'buff_critical_up', 1, 2)] },
        { name: '黑刃风暴', description: '对全体敌人造成135%攻击伤害并致盲。', effects: [damage('allEnemies', 1.35), buff('allEnemies', 'debuff_blind', 1, 2)] },
        { name: '嗜战', description: '战斗开始时获得吸血与攻击提升3回合。', effects: [buff('self', 'buff_lifesteal', 1, 3), buff('self', 'buff_attack_up', 1, 3)] },
    ]),
    defineUnit('enemy_05_red_sorcerer', '赤咒术士', [
        { name: '咒焰', description: '造成90%攻击伤害，并施加灼烧。', effects: [damage('singleEnemy', 0.9), buff('singleEnemy', 'debuff_burn')] },
        { name: '血印', description: '降低目标攻击和防御2回合，并施加流血。', effects: [buff('singleEnemy', 'debuff_attack_down', 1, 2), buff('singleEnemy', 'debuff_defense_down', 1, 2), buff('singleEnemy', 'debuff_bleed')] },
        { name: '炼狱火', description: '对全体敌人造成120%攻击伤害，施加灼烧和持续伤害。', effects: [damage('allEnemies', 1.2), buff('allEnemies', 'debuff_burn'), buff('allEnemies', 'debuff_damage_over_time')] },
        { name: '邪能', description: '战斗开始时获得攻击提升和控制免疫3回合。', effects: [buff('self', 'buff_attack_up', 1, 3), buff('self', 'buff_control_immunity', 1, 3)] },
    ]),
    defineUnit('enemy_06_shadow_wolf', '幽影狼妖', [
        { name: '影牙', description: '造成105%攻击伤害并施加流血。', effects: [damage('singleEnemy', 1.05), buff('singleEnemy', 'debuff_bleed')] },
        { name: '暗影扑杀', description: '攻击生命最低敌人，造成180%攻击伤害。', effects: [damage('enemyLowestHp', 1.8, { executeBelowHpRate: 0.3, executeMultiplier: 1.5 })] },
        { name: '月夜长啸', description: '全体友方攻击和攻速提升2回合。', effects: [buff('allAllies', 'buff_attack_up', 1, 2), buff('allAllies', 'buff_attack_speed_up', 1, 2)] },
        { name: '猎杀本能', description: '战斗开始时获得迅捷和暴击提升3回合。', effects: [buff('self', 'buff_haste', 1, 3), buff('self', 'buff_critical_up', 1, 3)] },
    ]),
    defineUnit('enemy_07_stone_guardian', '岩甲灵卫', [
        { name: '岩拳', description: '造成95%攻击伤害，20%概率眩晕。', effects: [damage('singleEnemy', 0.95), buff('singleEnemy', 'debuff_stun', 0.2, 1)] },
        { name: '石甲', description: '自身获得防御提升、护盾2回合。', effects: [buff('self', 'buff_defense_up', 1, 2), buff('self', 'buff_shield', 1, 2)] },
        { name: '裂地震', description: '对全体敌人造成105%攻击伤害，35%概率眩晕。', effects: [damage('allEnemies', 1.05), buff('allEnemies', 'debuff_stun', 0.35, 1)] },
        { name: '岩躯', description: '战斗开始时获得坚韧和反击3回合。', effects: [buff('self', 'buff_tenacity', 1, 3), buff('self', 'buff_counter', 1, 3)] },
    ]),
    defineUnit('enemy_08_bamboo_rat_demon', '青竹鼠妖', [
        { name: '竹刺', description: '造成100%攻击伤害。', effects: [damage('singleEnemy', 1)] },
        { name: '遁地', description: '自身获得迅捷与控制免疫2回合。', effects: [buff('self', 'buff_haste', 1, 2), buff('self', 'buff_control_immunity', 1, 2)] },
        { name: '青竹箭雨', description: '随机攻击3名敌人，各造成130%伤害并致盲。', effects: [damage('randomEnemies3', 1.3), buff('randomEnemies3', 'debuff_blind', 1, 2)] },
        { name: '灵巧', description: '战斗开始时获得攻速提升与暴击提升3回合。', effects: [buff('self', 'buff_attack_speed_up', 1, 3), buff('self', 'buff_critical_up', 1, 3)] },
    ]),
    defineUnit('enemy_09_talisman_lantern_ghost', '符灯鬼童', [
        { name: '鬼火', description: '造成85%攻击伤害，并施加持续伤害。', effects: [damage('singleEnemy', 0.85), buff('singleEnemy', 'debuff_damage_over_time')] },
        { name: '符灯封魂', description: '造成90%攻击伤害，并沉默目标2回合。', effects: [damage('singleEnemy', 0.9), buff('singleEnemy', 'debuff_silence', 1, 2)] },
        { name: '百灯夜行', description: '对全体敌人造成100%攻击伤害，35%概率睡眠并附加持续伤害。', effects: [damage('allEnemies', 1), buff('allEnemies', 'debuff_sleep', 0.35, 2), buff('allEnemies', 'debuff_damage_over_time')] },
        { name: '魂灯', description: '战斗开始时获得护盾和持续恢复3回合。', effects: [buff('self', 'buff_shield', 1, 3), buff('self', 'buff_regeneration', 1, 3)] },
    ]),
    defineUnit('enemy_10_jade_poison_toad', '碧毒蟾妖', [
        { name: '毒涎', description: '造成80%攻击伤害，并施加1层中毒。', effects: [damage('singleEnemy', 0.8), buff('singleEnemy', 'debuff_poison')] },
        { name: '碧毒泡', description: '造成105%攻击伤害，并施加2层中毒和减速。', effects: [damage('singleEnemy', 1.05), buff('singleEnemy', 'debuff_poison', 1, 3, 2), buff('singleEnemy', 'debuff_slow', 1, 2)] },
        { name: '万毒雾', description: '对全体敌人造成85%攻击伤害，并施加2层中毒。', effects: [damage('allEnemies', 0.85), buff('allEnemies', 'debuff_poison', 1, 3, 2)] },
        { name: '毒皮', description: '战斗开始时获得防御提升和反击3回合。', effects: [buff('self', 'buff_defense_up', 1, 3), buff('self', 'buff_counter', 1, 3)] },
    ]),
    defineUnit('enemy_11_ironclaw_falcon', '铁爪妖隼', [
        { name: '铁爪', description: '造成110%攻击伤害并施加流血。', effects: [damage('singleEnemy', 1.1), buff('singleEnemy', 'debuff_bleed')] },
        { name: '裂空铁羽', description: '随机攻击2名敌人，各造成140%攻击伤害。', effects: [damage('randomEnemies2', 1.4)] },
        { name: '凌空俯冲', description: '造成230%攻击伤害并降低目标防御2回合。', effects: [damage('enemyLowestHp', 2.3), buff('enemyLowestHp', 'debuff_defense_down', 1, 2)] },
        { name: '鹰眼', description: '战斗开始时获得暴击提升和迅捷3回合。', effects: [buff('self', 'buff_critical_up', 1, 3), buff('self', 'buff_haste', 1, 3)] },
    ]),
    defineUnit('enemy_12_withered_vine_spirit', '枯藤木魅', [
        { name: '藤鞭', description: '造成95%攻击伤害并减速。', effects: [damage('singleEnemy', 0.95), buff('singleEnemy', 'debuff_slow', 1, 2)] },
        { name: '枯藤缚灵', description: '造成85%攻击伤害，50%概率眩晕并附加持续伤害。', effects: [damage('singleEnemy', 0.85), buff('singleEnemy', 'debuff_stun', 0.5, 1), buff('singleEnemy', 'debuff_damage_over_time')] },
        { name: '根狱森罗', description: '对全体敌人造成100%攻击伤害，附加减速与持续伤害。', effects: [damage('allEnemies', 1), buff('allEnemies', 'debuff_slow', 1, 2), buff('allEnemies', 'debuff_damage_over_time')] },
        { name: '枯木回生', description: '生命首次低于50%时获得强化持续恢复和防御提升3回合。', trigger: 'healthBelow50', effects: [buff('self', 'buff_regeneration', 1, 3, 1, 1.5), buff('self', 'buff_defense_up', 1, 3)] },
    ]),
    defineUnit('enemy_13_frost_armor_spider', '寒甲冰蛛', [
        { name: '寒螯', description: '造成95%攻击伤害并减速。', effects: [damage('singleEnemy', 0.95), buff('singleEnemy', 'debuff_slow', 1, 2)] },
        { name: '寒丝冰网', description: '全体敌人减速2回合，30%概率冰冻。', effects: [buff('allEnemies', 'debuff_slow', 1, 2), buff('allEnemies', 'debuff_freeze', 0.3, 1)] },
        { name: '冰棘雨', description: '对全体敌人造成115%攻击伤害，35%概率冰冻。', effects: [damage('allEnemies', 1.15), buff('allEnemies', 'debuff_freeze', 0.35, 1)] },
        { name: '寒甲', description: '战斗开始时获得护盾与防御提升3回合。', effects: [buff('self', 'buff_shield', 1, 3), buff('self', 'buff_defense_up', 1, 3)] },
    ]),
    defineUnit('enemy_14_rust_armor_corpse', '锈甲尸兵', [
        { name: '锈钩', description: '造成100%攻击伤害，并施加流血。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_bleed')] },
        { name: '锈盾震击', description: '造成120%攻击伤害，35%概率眩晕。', effects: [damage('singleEnemy', 1.2), buff('singleEnemy', 'debuff_stun', 0.35, 1)] },
        { name: '腐甲旋风', description: '对全体敌人造成110%攻击伤害，降低防御并附加持续伤害。', effects: [damage('allEnemies', 1.1), buff('allEnemies', 'debuff_defense_down', 1, 2), buff('allEnemies', 'debuff_damage_over_time')] },
        { name: '尸躯', description: '战斗开始时获得坚韧、吸血和防御提升3回合。', effects: [buff('self', 'buff_tenacity', 1, 3), buff('self', 'buff_lifesteal', 1, 3), buff('self', 'buff_defense_up', 1, 3)] },
    ]),
    defineUnit('enemy_15_blackwater_tortoise_king', '黑水玄龟王', [
        { name: '玄龟噬', description: '获得1回合吸血后，对单体造成110%攻击伤害。', effects: [buff('self', 'buff_lifesteal', 1, 1), damage('singleEnemy', 1.1)] },
        { name: '山甲反击', description: '获得强化护盾、反击和防御提升3回合。', effects: [buff('self', 'buff_shield', 1, 3, 1, 1.5), buff('self', 'buff_counter', 1, 3), buff('self', 'buff_defense_up', 1, 3)] },
        { name: '玄水反潮', description: '对全体敌人造成125%攻击伤害，并恢复自身生命。', effects: [damage('allEnemies', 1.25), heal('self', 1.2, 0.08)] },
        { name: '玄岳龟壳', description: '战斗开始时获得防御提升、坚韧和控制免疫4回合。', effects: [buff('self', 'buff_defense_up', 1, 4), buff('self', 'buff_tenacity', 1, 4), buff('self', 'buff_control_immunity', 1, 4)] },
    ]),
    defineUnit('enemy_16_thunder_prison_kui_ox', '雷狱夔牛', [
        { name: '夔角冲', description: '造成120%攻击伤害，25%概率眩晕。', effects: [damage('singleEnemy', 1.2), buff('singleEnemy', 'debuff_stun', 0.25, 1)] },
        { name: '雷链', description: '随机攻击2名敌人，各造成140%伤害，35%概率眩晕。', effects: [damage('randomEnemies2', 1.4), buff('randomEnemies2', 'debuff_stun', 0.35, 1)] },
        { name: '雷狱震天', description: '对全体敌人造成150%攻击伤害，50%概率眩晕。', effects: [damage('allEnemies', 1.5), buff('allEnemies', 'debuff_stun', 0.5, 1)] },
        { name: '雷躯', description: '战斗开始时获得攻击提升、控制免疫和坚韧4回合。', effects: [buff('self', 'buff_attack_up', 1, 4), buff('self', 'buff_control_immunity', 1, 4), buff('self', 'buff_tenacity', 1, 4)] },
    ]),
    defineUnit('enemy_17_thousand_mask_nuo_king', '千面傩王', [
        { name: '傩面击', description: '造成100%攻击伤害并致盲。', effects: [damage('singleEnemy', 1), buff('singleEnemy', 'debuff_blind', 1, 2)] },
        { name: '唤魂', description: '全体友方获得攻击提升和持续恢复2回合。', effects: [buff('allAllies', 'buff_attack_up', 1, 2), buff('allAllies', 'buff_regeneration', 1, 2)] },
        { name: '百傩唤魂', description: '对全体敌人造成125%攻击伤害，40%概率睡眠并沉默。', effects: [damage('allEnemies', 1.25), buff('allEnemies', 'debuff_sleep', 0.4, 2), buff('allEnemies', 'debuff_silence', 1, 2)] },
        { name: '傩王敕令', description: '战斗开始时，全体友方获得攻击提升、坚韧和控制免疫3回合。', effects: [buff('allAllies', 'buff_attack_up', 1, 3), buff('allAllies', 'buff_tenacity', 1, 3), buff('allAllies', 'buff_control_immunity', 1, 3)] },
    ]),
];

function createSkillRecord(): Record<string, BattleSkillConfig> {
    const result: Record<string, BattleSkillConfig> = {};
    for (const skills of UNIT_SKILL_LIST) {
        for (const skill of skills) result[skill.id] = skill;
    }
    return result;
}

function createUnitSkillRecord(): Record<string, readonly BattleSkillConfig[]> {
    const result: Record<string, readonly BattleSkillConfig[]> = {};
    for (const skills of UNIT_SKILL_LIST) result[skills[0].unitId] = skills;
    return result;
}

export const BATTLE_SKILL_CONFIG: Readonly<Record<string, BattleSkillConfig>> = Object.freeze(
    createSkillRecord(),
);

export const BATTLE_UNIT_SKILL_CONFIG: Readonly<Record<string, readonly BattleSkillConfig[]>> = Object.freeze(
    createUnitSkillRecord(),
);

export function getBattleSkillConfig(id: string): BattleSkillConfig | undefined {
    return BATTLE_SKILL_CONFIG[id];
}

export function getUnitBattleSkills(unitId: string): readonly BattleSkillConfig[] {
    return BATTLE_UNIT_SKILL_CONFIG[unitId] ?? [];
}

/** 启动时或测试时调用，保证 35 个单位均有4个技能且 ID 不重复。 */
export function validateBattleSkillConfig(): void {
    const allSkills = Object.values(BATTLE_SKILL_CONFIG);
    if (allSkills.length !== 140) {
        throw new Error(`Expected 140 battle skills, received: ${allSkills.length}`);
    }
    if (Object.keys(BATTLE_UNIT_SKILL_CONFIG).length !== 35) {
        throw new Error('Expected skill loadouts for 35 battle units.');
    }
    for (const [unitId, skills] of Object.entries(BATTLE_UNIT_SKILL_CONFIG)) {
        if (skills.length !== 4 || skills.some((skill, index) => skill.slot !== index + 1)) {
            throw new Error(`Invalid four-skill loadout: ${unitId}`);
        }
    }
}
