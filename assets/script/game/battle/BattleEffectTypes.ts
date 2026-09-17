/** 战斗阵营。 */
export type BattleCamp = 'ally' | 'enemy';

/** 现有角色属性之上的战斗态属性；后三项有默认值，不要求角色存档提供。 */
export interface BattleAttributes {
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    critRate?: number;
    hitRate?: number;
    dodgeRate?: number;
}

export type BattleAttributeKey =
    | 'attack'
    | 'defense'
    | 'speed'
    | 'critRate'
    | 'hitRate'
    | 'dodgeRate'
    | 'damageDealt'
    | 'damageTaken';

export type BuffCategory = 'buff' | 'debuff';
export type BuffKind = 'stat' | 'periodic' | 'control' | 'shield' | 'special';
export type BuffStackPolicy = 'refresh' | 'stack' | 'replace';
export type BuffTickTiming = 'turnStart' | 'turnEnd';
export type ControlKind = 'stun' | 'freeze' | 'sleep' | 'silence';

/** 与 assets/buff/texture/status_icons_manifest.json 中的图标 ID 一一对应。 */
export type BattleBuffId =
    | 'buff_attack_up'
    | 'buff_attack_speed_up'
    | 'buff_defense_up'
    | 'buff_shield'
    | 'buff_invincible'
    | 'buff_critical_up'
    | 'buff_haste'
    | 'buff_regeneration'
    | 'buff_lifesteal'
    | 'buff_control_immunity'
    | 'buff_counter'
    | 'buff_tenacity'
    | 'debuff_attack_down'
    | 'debuff_defense_down'
    | 'debuff_slow'
    | 'debuff_stun'
    | 'debuff_freeze'
    | 'debuff_sleep'
    | 'debuff_poison'
    | 'debuff_burn'
    | 'debuff_bleed'
    | 'debuff_silence'
    | 'debuff_blind'
    | 'debuff_damage_over_time';

export interface PeriodicEffectConfig {
    type: 'damage' | 'heal';
    timing: BuffTickTiming;
    /** 施加者攻击力快照倍率。 */
    attackScale?: number;
    /** 目标最大生命倍率。 */
    targetMaxHpRate?: number;
    ignoreDefense?: boolean;
}

export interface ShieldEffectConfig {
    sourceAttackScale?: number;
    targetMaxHpRate?: number;
}

export interface BattleBuffConfig {
    id: BattleBuffId;
    name: string;
    description: string;
    category: BuffCategory;
    kind: BuffKind;
    iconPath: string;
    defaultDuration: number;
    maxStacks: number;
    stackPolicy: BuffStackPolicy;
    dispellable: boolean;
    modifiers?: Partial<Record<BattleAttributeKey, number>>;
    periodic?: PeriodicEffectConfig;
    shield?: ShieldEffectConfig;
    control?: ControlKind;
    special?: 'invincible' | 'lifesteal' | 'controlImmunity' | 'counter' | 'tenacity';
    /** 吸血、反击或韧性的比例。 */
    specialRate?: number;
}

export interface AppliedBattleBuff {
    instanceId: string;
    buffId: BattleBuffId;
    sourceUnitId: string;
    sourceAttackSnapshot: number;
    remainingTurns: number;
    stacks: number;
    potency: number;
    shieldRemaining: number;
}

export interface BattleUnitState {
    id: string;
    configId: string;
    name: string;
    camp: BattleCamp;
    attributes: BattleAttributes;
    currentHp: number;
    buffs: AppliedBattleBuff[];
    /** 每场战斗只触发一次的被动技能 ID。 */
    triggeredPassives: string[];
}

export type SkillKind = 'basic' | 'active' | 'ultimate' | 'passive';
export type SkillTrigger =
    | 'active'
    | 'battleStart'
    | 'turnStart'
    | 'turnEnd'
    | 'afterAttack'
    | 'afterDamaged'
    | 'healthBelow50';

export type SkillTarget =
    | 'self'
    | 'singleEnemy'
    | 'enemyLowestHp'
    | 'enemyHighestAttack'
    | 'randomEnemies2'
    | 'randomEnemies3'
    | 'allEnemies'
    | 'lowestHpAlly'
    | 'allAllies';

interface SkillEffectBase {
    target: SkillTarget;
    /** 0~1，省略表示必定生效。 */
    chance?: number;
}

export interface DamageSkillEffect extends SkillEffectBase {
    type: 'damage';
    attackScale: number;
    targetMaxHpRate?: number;
    ignoreDefense?: boolean;
    canCritical?: boolean;
    /** 目标生命低于该比例时，伤害乘以 executeMultiplier。 */
    executeBelowHpRate?: number;
    executeMultiplier?: number;
}

export interface HealSkillEffect extends SkillEffectBase {
    type: 'heal';
    attackScale?: number;
    targetMaxHpRate?: number;
}

export interface ApplyBuffSkillEffect extends SkillEffectBase {
    type: 'applyBuff';
    buffId: BattleBuffId;
    duration?: number;
    stacks?: number;
    potency?: number;
}

export interface CleanseSkillEffect extends SkillEffectBase {
    type: 'cleanse';
    count: number;
}

export interface DispelSkillEffect extends SkillEffectBase {
    type: 'dispel';
    count: number;
}

export type BattleSkillEffect =
    | DamageSkillEffect
    | HealSkillEffect
    | ApplyBuffSkillEffect
    | CleanseSkillEffect
    | DispelSkillEffect;

export interface BattleSkillConfig {
    id: string;
    unitId: string;
    unitName: string;
    slot: 1 | 2 | 3 | 4;
    name: string;
    kind: SkillKind;
    trigger: SkillTrigger;
    cooldown: number;
    iconPath: string;
    description: string;
    effects: readonly BattleSkillEffect[];
}

export type BattleLogType =
    | 'damage'
    | 'heal'
    | 'shield'
    | 'buffApplied'
    | 'buffRemoved'
    | 'controlResisted'
    | 'miss'
    | 'critical'
    | 'defeated'
    | 'skipTurn';

export interface BattleLogEntry {
    type: BattleLogType;
    sourceUnitId?: string;
    targetUnitId: string;
    skillId?: string;
    buffId?: BattleBuffId;
    value?: number;
    message: string;
}

