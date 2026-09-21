import { BATTLE_BUFF_CONFIG } from './BattleBuffConfig';
import {
    AppliedBattleBuff,
    ApplyBuffSkillEffect,
    BattleAttributes,
    BattleBuffConfig,
    BattleBuffId,
    BattleLogEntry,
    BattleSkillConfig,
    BattleSkillEffect,
    BattleUnitState,
    DamageSkillEffect,
    SkillTarget,
    SkillTrigger,
} from './BattleEffectTypes';
import { getBattleSkillConfig, getUnitBattleSkills } from './BattleSkillConfig';

const DEFAULT_CRIT_RATE = 0.05;
const DEFAULT_HIT_RATE = 1;
const DEFAULT_DODGE_RATE = 0.05;
const CRITICAL_DAMAGE_MULTIPLIER = 1.5;

export interface ExecuteSkillOptions {
    primaryTargetId?: string;
}

export interface TurnStartResult {
    canAct: boolean;
    canCastActiveSkill: boolean;
    logs: BattleLogEntry[];
}

interface DamageOptions {
    attackScale: number;
    targetMaxHpRate?: number;
    ignoreDefense?: boolean;
    canCritical?: boolean;
    canMiss?: boolean;
    direct?: boolean;
    skillId?: string;
    executeBelowHpRate?: number;
    executeMultiplier?: number;
    allowCounter?: boolean;
}

/**
 * 纯数据战斗效果执行器，不依赖 Cocos 节点。
 * UI 只消费 BattleLogEntry 播放飘字、状态图标和动画，便于之后接自动战斗或服务器校验。
 */
export class BattleEffectEngine {
    private _buffSequence = 0;

    constructor(private readonly _random: () => number = Math.random) {}

    createUnit(
        id: string,
        configId: string,
        name: string,
        camp: BattleUnitState['camp'],
        attributes: BattleAttributes,
    ): BattleUnitState {
        this.validateAttributes(attributes);
        return {
            id,
            configId,
            name,
            camp,
            attributes: { ...attributes },
            currentHp: attributes.maxHp,
            energy: 0,
            maxEnergy: 100,
            buffs: [],
            triggeredPassives: [],
        };
    }

    getEffectiveAttributes(unit: BattleUnitState): Required<BattleAttributes> & {
        damageDealt: number;
        damageTaken: number;
    } {
        const result = {
            maxHp: unit.attributes.maxHp,
            attack: unit.attributes.attack,
            defense: unit.attributes.defense,
            speed: unit.attributes.speed,
            critRate: unit.attributes.critRate ?? DEFAULT_CRIT_RATE,
            hitRate: unit.attributes.hitRate ?? DEFAULT_HIT_RATE,
            dodgeRate: unit.attributes.dodgeRate ?? DEFAULT_DODGE_RATE,
            damageDealt: 1,
            damageTaken: 1,
        };

        for (const applied of unit.buffs) {
            const config = BATTLE_BUFF_CONFIG[applied.buffId];
            if (!config.modifiers) continue;
            const multiplier = applied.stacks * applied.potency;
            for (const [key, value] of Object.entries(config.modifiers)) {
                const amount = (value ?? 0) * multiplier;
                switch (key) {
                    case 'attack': result.attack *= 1 + amount; break;
                    case 'defense': result.defense *= 1 + amount; break;
                    case 'speed': result.speed *= 1 + amount; break;
                    case 'critRate': result.critRate += amount; break;
                    case 'hitRate': result.hitRate += amount; break;
                    case 'dodgeRate': result.dodgeRate += amount; break;
                    case 'damageDealt': result.damageDealt *= 1 + amount; break;
                    case 'damageTaken': result.damageTaken *= 1 + amount; break;
                }
            }
        }

        result.attack = Math.max(1, Math.round(result.attack));
        result.defense = Math.max(0, Math.round(result.defense));
        result.speed = Math.max(1, Math.round(result.speed));
        result.critRate = this.clamp(result.critRate, 0, 0.75);
        result.hitRate = this.clamp(result.hitRate, 0.05, 1);
        result.dodgeRate = this.clamp(result.dodgeRate, 0, 0.75);
        result.damageDealt = Math.max(0, result.damageDealt);
        result.damageTaken = Math.max(0, result.damageTaken);
        return result;
    }

    executeSkill(
        skillId: string,
        casterId: string,
        units: BattleUnitState[],
        options: ExecuteSkillOptions = {},
    ): BattleLogEntry[] {
        const skill = getBattleSkillConfig(skillId);
        if (!skill) throw new Error(`Unknown battle skill: ${skillId}`);
        const caster = this.requireUnit(units, casterId);
        if (!this.isAlive(caster)) return [];
        if (skill.kind === 'passive') {
            throw new Error(`Passive skill cannot be cast directly: ${skillId}`);
        }
        if (skill.kind !== 'basic' && this.hasControl(caster, 'silence')) {
            return [{
                type: 'skipTurn', sourceUnitId: caster.id, targetUnitId: caster.id,
                skillId, message: `${caster.name}处于沉默状态，无法施放${skill.name}`,
            }];
        }

        const logs = this.executeEffects(skill, caster, units, options);
        logs.push(...this.triggerPassives(caster.id, 'afterAttack', units, options));

        const damagedIds = new Set(
            logs.filter((log) => log.type === 'damage' && (log.value ?? 0) > 0)
                .map((log) => log.targetUnitId),
        );
        for (const targetId of damagedIds) {
            const target = units.find((unit) => unit.id === targetId);
            if (!target || !this.isAlive(target)) continue;
            logs.push(...this.triggerPassives(target.id, 'afterDamaged', units, options));
            if (target.currentHp / target.attributes.maxHp <= 0.5) {
                logs.push(...this.triggerPassives(target.id, 'healthBelow50', units, options));
            }
        }
        return logs;
    }

    /** 统一触发双方所有“战斗开始”被动。 */
    initializeBattle(units: BattleUnitState[]): BattleLogEntry[] {
        const logs: BattleLogEntry[] = [];
        for (const unit of units) {
            if (this.isAlive(unit)) logs.push(...this.triggerPassives(unit.id, 'battleStart', units));
        }
        return logs;
    }

    triggerPassives(
        unitId: string,
        trigger: SkillTrigger,
        units: BattleUnitState[],
        options: ExecuteSkillOptions = {},
    ): BattleLogEntry[] {
        const unit = this.requireUnit(units, unitId);
        if (!this.isAlive(unit)) return [];

        const passives = getUnitBattleSkills(unit.configId).filter((skill) => (
            skill.kind === 'passive' && skill.trigger === trigger
        ));
        const logs: BattleLogEntry[] = [];
        for (const passive of passives) {
            const oneShot = trigger === 'battleStart' || trigger === 'healthBelow50';
            if (oneShot && unit.triggeredPassives.includes(passive.id)) continue;
            if (oneShot) unit.triggeredPassives.push(passive.id);
            logs.push(...this.executeEffects(passive, unit, units, options));
        }
        return logs;
    }

    resolveTurnStart(unitId: string, units: BattleUnitState[]): TurnStartResult {
        const unit = this.requireUnit(units, unitId);
        const logs = this.resolvePeriodicEffects(unit, units, 'turnStart');
        if (!this.isAlive(unit)) {
            return { canAct: false, canCastActiveSkill: false, logs };
        }

        if (unit.currentHp / unit.attributes.maxHp <= 0.5) {
            logs.push(...this.triggerPassives(unit.id, 'healthBelow50', units));
        }
        logs.push(...this.triggerPassives(unit.id, 'turnStart', units));
        const blocked = this.hasAnyControl(unit, ['stun', 'freeze', 'sleep']);
        if (blocked) {
            logs.push({
                type: 'skipTurn', targetUnitId: unit.id,
                message: `${unit.name}受到控制，本回合无法行动`,
            });
        }
        return {
            canAct: !blocked,
            canCastActiveSkill: !blocked && !this.hasControl(unit, 'silence'),
            logs,
        };
    }

    resolveTurnEnd(unitId: string, units: BattleUnitState[]): BattleLogEntry[] {
        const unit = this.requireUnit(units, unitId);
        const logs = this.resolvePeriodicEffects(unit, units, 'turnEnd');
        if (this.isAlive(unit)) {
            if (unit.currentHp / unit.attributes.maxHp <= 0.5) {
                logs.push(...this.triggerPassives(unit.id, 'healthBelow50', units));
            }
            logs.push(...this.triggerPassives(unit.id, 'turnEnd', units));
        }

        for (const buff of [...unit.buffs]) {
            buff.remainingTurns--;
            if (buff.remainingTurns <= 0) {
                this.removeBuffInstance(unit, buff, logs, '持续时间结束');
            }
        }
        return logs;
    }

    applyBuff(
        source: BattleUnitState,
        target: BattleUnitState,
        effect: ApplyBuffSkillEffect,
        skillId?: string,
    ): BattleLogEntry[] {
        const config = BATTLE_BUFF_CONFIG[effect.buffId];
        if (!config) throw new Error(`Unknown battle buff: ${effect.buffId}`);
        if (!this.isAlive(target)) return [];

        if (config.control && this.hasSpecial(target, 'controlImmunity')) {
            return [{
                type: 'controlResisted', sourceUnitId: source.id, targetUnitId: target.id,
                skillId, buffId: config.id, message: `${target.name}免疫了${config.name}`,
            }];
        }

        let duration = effect.duration ?? config.defaultDuration;
        if (config.control) {
            const tenacity = this.getSpecialRate(target, 'tenacity');
            duration = Math.max(1, Math.ceil(duration * (1 - tenacity)));
        }
        const stacks = Math.max(1, effect.stacks ?? 1);
        const potency = Math.max(0, effect.potency ?? 1);
        const existing = target.buffs.find((item) => item.buffId === config.id);
        const sourceAttack = this.getEffectiveAttributes(source).attack;

        if (existing) {
            existing.remainingTurns = Math.max(existing.remainingTurns, duration);
            existing.sourceUnitId = source.id;
            existing.sourceAttackSnapshot = sourceAttack;
            existing.potency = potency;
            if (config.stackPolicy === 'stack') {
                existing.stacks = Math.min(config.maxStacks, existing.stacks + stacks);
            }
            else {
                existing.stacks = Math.min(config.maxStacks, stacks);
            }
            if (config.shield) {
                existing.shieldRemaining = this.calculateShield(config, sourceAttack, target, potency);
            }
        }
        else {
            target.buffs.push({
                instanceId: `buff-${++this._buffSequence}`,
                buffId: config.id,
                sourceUnitId: source.id,
                sourceAttackSnapshot: sourceAttack,
                remainingTurns: duration,
                stacks: Math.min(config.maxStacks, stacks),
                potency,
                shieldRemaining: config.shield
                    ? this.calculateShield(config, sourceAttack, target, potency)
                    : 0,
            });
        }

        const applied = target.buffs.find((item) => item.buffId === config.id)!;
        const logs: BattleLogEntry[] = [{
            type: config.shield ? 'shield' : 'buffApplied',
            sourceUnitId: source.id, targetUnitId: target.id, skillId, buffId: config.id,
            value: config.shield ? applied.shieldRemaining : applied.stacks,
            message: `${target.name}获得${config.name}${applied.stacks > 1 ? `×${applied.stacks}` : ''}`,
        }];
        return logs;
    }

    cleanse(target: BattleUnitState, count: number, skillId?: string): BattleLogEntry[] {
        return this.removeByCategory(target, 'debuff', count, skillId);
    }

    dispel(target: BattleUnitState, count: number, skillId?: string): BattleLogEntry[] {
        return this.removeByCategory(target, 'buff', count, skillId);
    }

    getTotalShield(unit: BattleUnitState): number {
        return unit.buffs.reduce((total, buff) => total + Math.max(0, buff.shieldRemaining), 0);
    }

    private executeEffects(
        skill: BattleSkillConfig,
        caster: BattleUnitState,
        units: BattleUnitState[],
        options: ExecuteSkillOptions,
    ): BattleLogEntry[] {
        const logs: BattleLogEntry[] = [];
        const targetCache = new Map<SkillTarget, BattleUnitState[]>();
        const hitTargets = new Map<SkillTarget, Set<string>>();
        const targetTypesWithDamage = new Set(
            skill.effects.filter((effect) => effect.type === 'damage').map((effect) => effect.target),
        );
        for (const effect of skill.effects) {
            let targets = targetCache.get(effect.target);
            if (!targets) {
                targets = this.selectTargets(effect.target, caster, units, options.primaryTargetId);
                targetCache.set(effect.target, targets);
            }
            for (const target of targets) {
                if (
                    (effect.type === 'applyBuff' || effect.type === 'dispel')
                    && targetTypesWithDamage.has(effect.target)
                    && !hitTargets.get(effect.target)?.has(target.id)
                ) {
                    continue;
                }
                if ((effect.chance ?? 1) < this._random()) continue;
                switch (effect.type) {
                    case 'damage': {
                        const damageLogs = this.dealDamage(caster, target, {
                            ...effect,
                            skillId: skill.id,
                            direct: true,
                            canMiss: true,
                            allowCounter: true,
                        });
                        logs.push(...damageLogs);
                        if (damageLogs.some((log) => log.type === 'damage')) {
                            const hitSet = hitTargets.get(effect.target) ?? new Set<string>();
                            hitSet.add(target.id);
                            hitTargets.set(effect.target, hitSet);
                        }
                        break;
                    }
                    case 'heal':
                        logs.push(this.heal(
                            caster,
                            target,
                            (effect.attackScale ?? 0) * this.getEffectiveAttributes(caster).attack
                                + (effect.targetMaxHpRate ?? 0) * target.attributes.maxHp,
                            skill.id,
                        ));
                        break;
                    case 'applyBuff':
                        logs.push(...this.applyBuff(caster, target, effect, skill.id));
                        break;
                    case 'cleanse':
                        logs.push(...this.cleanse(target, effect.count, skill.id));
                        break;
                    case 'dispel':
                        logs.push(...this.dispel(target, effect.count, skill.id));
                        break;
                }
            }
        }
        return logs;
    }

    private dealDamage(
        source: BattleUnitState,
        target: BattleUnitState,
        options: DamageOptions,
    ): BattleLogEntry[] {
        if (!this.isAlive(source) || !this.isAlive(target)) return [];
        if (this.hasSpecial(target, 'invincible')) {
            return [{
                type: 'damage', sourceUnitId: source.id, targetUnitId: target.id,
                skillId: options.skillId, value: 0, message: `${target.name}免疫了伤害`,
            }];
        }

        const sourceStats = this.getEffectiveAttributes(source);
        const targetStats = this.getEffectiveAttributes(target);
        if (options.canMiss !== false) {
            const hitChance = this.clamp(sourceStats.hitRate - targetStats.dodgeRate, 0.05, 1);
            if (this._random() > hitChance) {
                return [{
                    type: 'miss', sourceUnitId: source.id, targetUnitId: target.id,
                    skillId: options.skillId, message: `${source.name}的攻击被${target.name}闪避`,
                }];
            }
        }

        let rawDamage = sourceStats.attack * options.attackScale
            + target.attributes.maxHp * (options.targetMaxHpRate ?? 0);
        if (options.executeBelowHpRate && options.executeMultiplier) {
            const hpRate = target.currentHp / target.attributes.maxHp;
            if (hpRate <= options.executeBelowHpRate) rawDamage *= options.executeMultiplier;
        }

        let critical = false;
        if (options.canCritical !== false && this._random() < sourceStats.critRate) {
            rawDamage *= CRITICAL_DAMAGE_MULTIPLIER;
            critical = true;
        }
        if (!options.ignoreDefense) rawDamage *= 100 / (100 + targetStats.defense);
        rawDamage *= sourceStats.damageDealt * targetStats.damageTaken;
        let pending = Math.max(1, Math.round(rawDamage));

        pending = this.absorbWithShields(target, pending);

        const hpDamage = Math.min(target.currentHp, pending);
        target.currentHp -= hpDamage;
        const logs: BattleLogEntry[] = [{
            type: 'damage', sourceUnitId: source.id, targetUnitId: target.id,
            skillId: options.skillId, value: hpDamage,
            message: `${source.name}对${target.name}造成${hpDamage}点伤害`,
        }];
        if (critical) {
            logs.push({
                type: 'critical', sourceUnitId: source.id, targetUnitId: target.id,
                skillId: options.skillId, value: hpDamage, message: '暴击',
            });
        }

        if (hpDamage > 0 && options.direct) this.removeSleep(target, logs);
        const lifestealRate = this.getSpecialRate(source, 'lifesteal');
        if (hpDamage > 0 && options.direct && lifestealRate > 0) {
            logs.push(this.heal(source, source, hpDamage * lifestealRate, options.skillId));
        }
        if (target.currentHp <= 0) {
            logs.push({
                type: 'defeated', sourceUnitId: source.id, targetUnitId: target.id,
                skillId: options.skillId, message: `${target.name}被击败`,
            });
        }
        else if (hpDamage > 0 && options.direct && options.allowCounter !== false) {
            const counterRate = this.getSpecialRate(target, 'counter');
            if (counterRate > 0 && this.isAlive(source)) {
                logs.push(...this.dealDamage(target, source, {
                    attackScale: counterRate,
                    canCritical: false,
                    canMiss: false,
                    direct: true,
                    allowCounter: false,
                }));
            }
        }
        return logs;
    }

    private heal(
        source: BattleUnitState,
        target: BattleUnitState,
        rawValue: number,
        skillId?: string,
    ): BattleLogEntry {
        const missing = Math.max(0, target.attributes.maxHp - target.currentHp);
        const value = Math.min(missing, Math.max(0, Math.round(rawValue)));
        target.currentHp += value;
        return {
            type: 'heal', sourceUnitId: source.id, targetUnitId: target.id,
            skillId, value, message: `${target.name}恢复${value}点生命`,
        };
    }

    private resolvePeriodicEffects(
        target: BattleUnitState,
        units: BattleUnitState[],
        timing: 'turnStart' | 'turnEnd',
    ): BattleLogEntry[] {
        const logs: BattleLogEntry[] = [];
        for (const applied of [...target.buffs]) {
            if (!this.isAlive(target)) break;
            const config = BATTLE_BUFF_CONFIG[applied.buffId];
            const periodic = config.periodic;
            if (!periodic || periodic.timing !== timing) continue;

            const rawValue = (
                applied.sourceAttackSnapshot * (periodic.attackScale ?? 0)
                + target.attributes.maxHp * (periodic.targetMaxHpRate ?? 0)
            ) * applied.stacks * applied.potency;
            const source = units.find((unit) => unit.id === applied.sourceUnitId) ?? target;
            if (periodic.type === 'heal') {
                logs.push(this.heal(source, target, rawValue, undefined));
                continue;
            }

            if (this.hasSpecial(target, 'invincible')) {
                logs.push({
                    type: 'damage', sourceUnitId: applied.sourceUnitId, targetUnitId: target.id,
                    buffId: applied.buffId, value: 0,
                    message: `${target.name}免疫了${config.name}伤害`,
                });
                continue;
            }

            let damage = rawValue;
            if (!periodic.ignoreDefense) {
                damage *= 100 / (100 + this.getEffectiveAttributes(target).defense);
            }
            damage *= this.getEffectiveAttributes(target).damageTaken;
            const pending = this.absorbWithShields(target, Math.max(1, Math.round(damage)));
            const value = Math.min(target.currentHp, pending);
            target.currentHp -= value;
            logs.push({
                type: 'damage', sourceUnitId: applied.sourceUnitId, targetUnitId: target.id,
                buffId: applied.buffId, value,
                message: `${target.name}受到${config.name}伤害${value}点`,
            });
            if (target.currentHp <= 0) {
                logs.push({
                    type: 'defeated', sourceUnitId: applied.sourceUnitId, targetUnitId: target.id,
                    buffId: applied.buffId, message: `${target.name}被${config.name}击败`,
                });
            }
        }
        return logs;
    }

    private absorbWithShields(target: BattleUnitState, rawDamage: number): number {
        let pending = Math.max(0, rawDamage);
        for (const shield of target.buffs.filter((buff) => buff.shieldRemaining > 0)) {
            const absorbed = Math.min(shield.shieldRemaining, pending);
            shield.shieldRemaining -= absorbed;
            pending -= absorbed;
            if (shield.shieldRemaining <= 0) {
                const index = target.buffs.indexOf(shield);
                if (index >= 0) target.buffs.splice(index, 1);
            }
            if (pending <= 0) break;
        }
        return pending;
    }

    private selectTargets(
        targetType: SkillTarget,
        caster: BattleUnitState,
        units: BattleUnitState[],
        primaryTargetId?: string,
    ): BattleUnitState[] {
        const allies = units.filter((unit) => unit.camp === caster.camp && this.isAlive(unit));
        const enemies = units.filter((unit) => unit.camp !== caster.camp && this.isAlive(unit));
        const primaryEnemy = enemies.find((unit) => unit.id === primaryTargetId) ?? enemies[0];

        switch (targetType) {
            case 'self': return [caster];
            case 'singleEnemy': return primaryEnemy ? [primaryEnemy] : [];
            case 'enemyLowestHp': return this.lowestHp(enemies);
            case 'enemyHighestAttack': return [...enemies]
                .sort((a, b) => this.getEffectiveAttributes(b).attack - this.getEffectiveAttributes(a).attack)
                .slice(0, 1);
            case 'randomEnemies2': return this.randomTargets(enemies, 2);
            case 'randomEnemies3': return this.randomTargets(enemies, 3);
            case 'allEnemies': return enemies;
            case 'lowestHpAlly': return this.lowestHp(allies);
            case 'allAllies': return allies;
        }
    }

    private lowestHp(units: BattleUnitState[]): BattleUnitState[] {
        return [...units].sort((a, b) => (
            a.currentHp / a.attributes.maxHp - b.currentHp / b.attributes.maxHp
        )).slice(0, 1);
    }

    private randomTargets(units: BattleUnitState[], count: number): BattleUnitState[] {
        const pool = [...units];
        const result: BattleUnitState[] = [];
        while (pool.length && result.length < count) {
            const index = Math.min(pool.length - 1, Math.floor(this._random() * pool.length));
            result.push(pool.splice(index, 1)[0]);
        }
        return result;
    }

    private removeByCategory(
        target: BattleUnitState,
        category: 'buff' | 'debuff',
        count: number,
        skillId?: string,
    ): BattleLogEntry[] {
        const removable = target.buffs.filter((applied) => {
            const config = BATTLE_BUFF_CONFIG[applied.buffId];
            return config.category === category && config.dispellable;
        }).slice(0, Math.max(0, count));
        const logs: BattleLogEntry[] = [];
        for (const applied of removable) {
            this.removeBuffInstance(target, applied, logs, category === 'buff' ? '驱散' : '净化', skillId);
        }
        return logs;
    }

    private removeSleep(target: BattleUnitState, logs: BattleLogEntry[]): void {
        const sleep = target.buffs.find((buff) => buff.buffId === 'debuff_sleep');
        if (sleep) this.removeBuffInstance(target, sleep, logs, '受到伤害');
    }

    private removeBuffInstance(
        target: BattleUnitState,
        applied: AppliedBattleBuff,
        logs: BattleLogEntry[],
        reason: string,
        skillId?: string,
    ): void {
        const index = target.buffs.indexOf(applied);
        if (index < 0) return;
        target.buffs.splice(index, 1);
        const config = BATTLE_BUFF_CONFIG[applied.buffId];
        logs.push({
            type: 'buffRemoved', targetUnitId: target.id, skillId, buffId: applied.buffId,
            message: `${target.name}的${config.name}因${reason}解除`,
        });
    }

    private calculateShield(
        config: BattleBuffConfig,
        sourceAttack: number,
        target: BattleUnitState,
        potency: number,
    ): number {
        return Math.max(1, Math.round((
            sourceAttack * (config.shield?.sourceAttackScale ?? 0)
            + target.attributes.maxHp * (config.shield?.targetMaxHpRate ?? 0)
        ) * potency));
    }

    private hasControl(unit: BattleUnitState, control: NonNullable<BattleBuffConfig['control']>): boolean {
        return unit.buffs.some((buff) => BATTLE_BUFF_CONFIG[buff.buffId].control === control);
    }

    private hasAnyControl(
        unit: BattleUnitState,
        controls: Array<NonNullable<BattleBuffConfig['control']>>,
    ): boolean {
        return controls.some((control) => this.hasControl(unit, control));
    }

    private hasSpecial(unit: BattleUnitState, special: NonNullable<BattleBuffConfig['special']>): boolean {
        return unit.buffs.some((buff) => BATTLE_BUFF_CONFIG[buff.buffId].special === special);
    }

    private getSpecialRate(
        unit: BattleUnitState,
        special: NonNullable<BattleBuffConfig['special']>,
    ): number {
        return unit.buffs.reduce((total, buff) => {
            const config = BATTLE_BUFF_CONFIG[buff.buffId];
            if (config.special !== special) return total;
            return Math.max(total, (config.specialRate ?? 0) * buff.potency);
        }, 0);
    }

    private requireUnit(units: BattleUnitState[], id: string): BattleUnitState {
        const unit = units.find((item) => item.id === id);
        if (!unit) throw new Error(`Unknown battle unit: ${id}`);
        return unit;
    }

    private isAlive(unit: BattleUnitState): boolean {
        return unit.currentHp > 0;
    }

    private validateAttributes(attributes: BattleAttributes): void {
        for (const key of ['maxHp', 'attack', 'defense', 'speed'] as const) {
            if (!Number.isFinite(attributes[key]) || attributes[key] <= 0) {
                throw new RangeError(`${key} must be greater than 0, received: ${attributes[key]}`);
            }
        }
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
    }
}
