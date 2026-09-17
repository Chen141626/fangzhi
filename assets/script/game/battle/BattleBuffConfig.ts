import { BattleBuffConfig, BattleBuffId } from './BattleEffectTypes';

function icon(id: BattleBuffId): string {
    const directory = id.startsWith('buff_') ? 'buff' : 'debuff';
    return `buff/texture/${directory}/${id}`;
}

/**
 * 回合状态配置。
 * 百分比统一使用小数：0.2 表示提升 20%，-0.2 表示降低 20%。
 */
export const BATTLE_BUFF_CONFIG: Readonly<Record<BattleBuffId, BattleBuffConfig>> = {
    buff_attack_up: {
        id: 'buff_attack_up', name: '攻击提升', category: 'buff', kind: 'stat',
        description: '攻击提升20%。', iconPath: icon('buff_attack_up'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { attack: 0.2 },
    },
    buff_attack_speed_up: {
        id: 'buff_attack_speed_up', name: '攻速提升', category: 'buff', kind: 'stat',
        description: '速度提升20%。', iconPath: icon('buff_attack_speed_up'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { speed: 0.2 },
    },
    buff_defense_up: {
        id: 'buff_defense_up', name: '防御提升', category: 'buff', kind: 'stat',
        description: '防御提升25%。', iconPath: icon('buff_defense_up'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { defense: 0.25 },
    },
    buff_shield: {
        id: 'buff_shield', name: '护盾', category: 'buff', kind: 'shield',
        description: '吸收施法者80%攻击力加目标10%最大生命的伤害。', iconPath: icon('buff_shield'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'replace', dispellable: true,
        shield: { sourceAttackScale: 0.8, targetMaxHpRate: 0.1 },
    },
    buff_invincible: {
        id: 'buff_invincible', name: '无敌', category: 'buff', kind: 'special',
        description: '免疫所有伤害。', iconPath: icon('buff_invincible'),
        defaultDuration: 1, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        special: 'invincible',
    },
    buff_critical_up: {
        id: 'buff_critical_up', name: '暴击提升', category: 'buff', kind: 'stat',
        description: '暴击率提升25%。', iconPath: icon('buff_critical_up'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { critRate: 0.25 },
    },
    buff_haste: {
        id: 'buff_haste', name: '迅捷', category: 'buff', kind: 'stat',
        description: '速度提升30%，闪避率提升10%。', iconPath: icon('buff_haste'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { speed: 0.3, dodgeRate: 0.1 },
    },
    buff_regeneration: {
        id: 'buff_regeneration', name: '持续恢复', category: 'buff', kind: 'periodic',
        description: '每回合结束恢复施法者35%攻击力加自身3%最大生命。', iconPath: icon('buff_regeneration'),
        defaultDuration: 3, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        periodic: { type: 'heal', timing: 'turnEnd', attackScale: 0.35, targetMaxHpRate: 0.03 },
    },
    buff_lifesteal: {
        id: 'buff_lifesteal', name: '吸血', category: 'buff', kind: 'special',
        description: '造成直接伤害后恢复实际生命伤害的20%。', iconPath: icon('buff_lifesteal'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        special: 'lifesteal', specialRate: 0.2,
    },
    buff_control_immunity: {
        id: 'buff_control_immunity', name: '控制免疫', category: 'buff', kind: 'special',
        description: '免疫眩晕、冰冻、睡眠和沉默。', iconPath: icon('buff_control_immunity'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        special: 'controlImmunity',
    },
    buff_counter: {
        id: 'buff_counter', name: '反击', category: 'buff', kind: 'special',
        description: '受到直接伤害时，以40%攻击力反击攻击者。', iconPath: icon('buff_counter'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        special: 'counter', specialRate: 0.4,
    },
    buff_tenacity: {
        id: 'buff_tenacity', name: '坚韧', category: 'buff', kind: 'special',
        description: '控制效果持续时间降低35%，受到伤害降低10%。', iconPath: icon('buff_tenacity'),
        defaultDuration: 3, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        special: 'tenacity', specialRate: 0.35, modifiers: { damageTaken: -0.1 },
    },
    debuff_attack_down: {
        id: 'debuff_attack_down', name: '攻击降低', category: 'debuff', kind: 'stat',
        description: '攻击降低20%。', iconPath: icon('debuff_attack_down'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { attack: -0.2 },
    },
    debuff_defense_down: {
        id: 'debuff_defense_down', name: '防御降低', category: 'debuff', kind: 'stat',
        description: '防御降低25%。', iconPath: icon('debuff_defense_down'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { defense: -0.25 },
    },
    debuff_slow: {
        id: 'debuff_slow', name: '减速', category: 'debuff', kind: 'stat',
        description: '速度降低25%。', iconPath: icon('debuff_slow'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { speed: -0.25 },
    },
    debuff_stun: {
        id: 'debuff_stun', name: '眩晕', category: 'debuff', kind: 'control',
        description: '无法行动。', iconPath: icon('debuff_stun'),
        defaultDuration: 1, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        control: 'stun',
    },
    debuff_freeze: {
        id: 'debuff_freeze', name: '冰冻', category: 'debuff', kind: 'control',
        description: '无法行动，防御降低15%。', iconPath: icon('debuff_freeze'),
        defaultDuration: 1, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        control: 'freeze', modifiers: { defense: -0.15 },
    },
    debuff_sleep: {
        id: 'debuff_sleep', name: '催眠', category: 'debuff', kind: 'control',
        description: '无法行动，受到直接伤害后解除。', iconPath: icon('debuff_sleep'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        control: 'sleep',
    },
    debuff_poison: {
        id: 'debuff_poison', name: '中毒', category: 'debuff', kind: 'periodic',
        description: '每回合结束受到施加者30%攻击力伤害，最多3层。', iconPath: icon('debuff_poison'),
        defaultDuration: 3, maxStacks: 3, stackPolicy: 'stack', dispellable: true,
        periodic: { type: 'damage', timing: 'turnEnd', attackScale: 0.3, ignoreDefense: true },
    },
    debuff_burn: {
        id: 'debuff_burn', name: '灼烧', category: 'debuff', kind: 'periodic',
        description: '每回合结束受到施加者40%攻击力伤害，最多2层。', iconPath: icon('debuff_burn'),
        defaultDuration: 2, maxStacks: 2, stackPolicy: 'stack', dispellable: true,
        periodic: { type: 'damage', timing: 'turnEnd', attackScale: 0.4, ignoreDefense: true },
    },
    debuff_bleed: {
        id: 'debuff_bleed', name: '流血', category: 'debuff', kind: 'periodic',
        description: '每回合开始损失4%最大生命，最多3层。', iconPath: icon('debuff_bleed'),
        defaultDuration: 3, maxStacks: 3, stackPolicy: 'stack', dispellable: true,
        periodic: { type: 'damage', timing: 'turnStart', targetMaxHpRate: 0.04, ignoreDefense: true },
    },
    debuff_silence: {
        id: 'debuff_silence', name: '沉默', category: 'debuff', kind: 'control',
        description: '无法施放主动技能和绝技，但可以普通攻击。', iconPath: icon('debuff_silence'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        control: 'silence',
    },
    debuff_blind: {
        id: 'debuff_blind', name: '致盲', category: 'debuff', kind: 'stat',
        description: '命中率降低35%。', iconPath: icon('debuff_blind'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        modifiers: { hitRate: -0.35 },
    },
    debuff_damage_over_time: {
        id: 'debuff_damage_over_time', name: '持续伤害', category: 'debuff', kind: 'periodic',
        description: '每回合结束受到施加者50%攻击力伤害。', iconPath: icon('debuff_damage_over_time'),
        defaultDuration: 2, maxStacks: 1, stackPolicy: 'refresh', dispellable: true,
        periodic: { type: 'damage', timing: 'turnEnd', attackScale: 0.5, ignoreDefense: false },
    },
};

export function getBattleBuffConfig(id: BattleBuffId): BattleBuffConfig {
    return BATTLE_BUFF_CONFIG[id];
}
