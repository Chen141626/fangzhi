import { BattleUnitConfig, BATTLE_DEMO_ROSTER } from './BattleDemoConfig';
import { BattleEffectEngine } from './BattleEffectEngine';
import { BattleCamp, BattleLogEntry, BattleSkillConfig, BattleUnitState } from './BattleEffectTypes';
import { getUnitBattleSkills } from './BattleSkillConfig';

export type BattleFlowStatus = 'idle' | 'running' | 'finished';
export type BattleWinner = BattleCamp | 'draw' | null;

export interface BattleStartResult {
    round: number;
    logs: BattleLogEntry[];
    status: BattleFlowStatus;
}

export interface BattleStepResult {
    round: number;
    actorId: string | null;
    skill: BattleSkillConfig | null;
    /** 本次行动开始前，以及三个结算阶段结束后的只读状态快照。 */
    beforeUnits: BattleUnitState[];
    turnStartUnits: BattleUnitState[];
    actionUnits: BattleUnitState[];
    turnEndUnits: BattleUnitState[];
    turnStartLogs: BattleLogEntry[];
    actionLogs: BattleLogEntry[];
    turnEndLogs: BattleLogEntry[];
    logs: BattleLogEntry[];
    status: BattleFlowStatus;
    winner: BattleWinner;
}

export interface BattleActionDecision {
    skillId?: string;
    targetId?: string;
}

export interface BattleSkillState {
    skill: BattleSkillConfig;
    cooldown: number;
    available: boolean;
    reason: '' | 'cooldown' | 'energy';
}

export interface BattleTurnPreview {
    round: number;
    actor: BattleUnitState;
    skills: BattleSkillState[];
    targets: BattleUnitState[];
    upcomingUnitIds: string[];
}

/** UI 播放过程中不能直接读取已结算到回合末的实时对象，因此统一生成深拷贝快照。 */
export function cloneBattleUnits(units: readonly BattleUnitState[]): BattleUnitState[] {
    return units.map((unit) => ({
        ...unit,
        attributes: { ...unit.attributes },
        buffs: unit.buffs.map((buff) => ({ ...buff })),
        triggeredPassives: [...unit.triggeredPassives],
    }));
}

/**
 * 单机演示回合驱动。它只负责排速、冷却、自动选技和胜负，不依赖任何 Cocos UI。
 */
export class BattleFlowController {
    readonly engine: BattleEffectEngine;
    units: BattleUnitState[] = [];
    round = 0;
    status: BattleFlowStatus = 'idle';
    winner: BattleWinner = null;

    private _turnQueue: string[] = [];
    private readonly _cooldowns = new Map<string, Map<string, number>>();

    constructor(
        random: () => number = Math.random,
        private _maxRounds = 30,
    ) {
        this.engine = new BattleEffectEngine(random);
    }

    start(
        roster: readonly BattleUnitConfig[] = BATTLE_DEMO_ROSTER,
        maxRounds = this._maxRounds,
        carriedUnits: readonly BattleUnitState[] = [],
    ): BattleStartResult {
        if (!Number.isInteger(maxRounds) || maxRounds < 1) {
            throw new RangeError(`Battle max rounds must be a positive integer, received: ${maxRounds}`);
        }
        const allyCount = roster.filter((unit) => unit.camp === 'ally').length;
        const enemyCount = roster.filter((unit) => unit.camp === 'enemy').length;
        if (allyCount < 1 || allyCount > 5 || enemyCount < 1 || enemyCount > 5) {
            throw new Error(`Battle roster must contain 1-5 units per camp, received: ${allyCount} vs ${enemyCount}`);
        }
        this._maxRounds = maxRounds;
        this.round = 0;
        this.status = 'running';
        this.winner = null;
        this._turnQueue.length = 0;
        this._cooldowns.clear();
        const campSequence: Record<BattleCamp, number> = { ally: 0, enemy: 0 };
        this.units = roster.map((config) => {
            const campIndex = ++campSequence[config.camp];
            return this.engine.createUnit(
                `${config.camp}_${campIndex}`,
                config.configId,
                config.name,
                config.camp,
                config.attributes,
            );
        });

        const carriedById = new Map(carriedUnits.map((unit) => [unit.id, unit]));
        for (const unit of this.units) {
            const carried = carriedById.get(unit.id);
            if (!carried || carried.camp !== unit.camp || carried.configId !== unit.configId) continue;
            unit.currentHp = Math.max(0, Math.min(unit.attributes.maxHp, carried.currentHp));
            unit.energy = Math.max(0, Math.min(unit.maxEnergy, carried.energy));
            unit.buffs = carried.buffs.map((buff) => ({ ...buff }));
            unit.triggeredPassives = [...carried.triggeredPassives];
        }

        for (const unit of this.units) this._cooldowns.set(unit.id, new Map<string, number>());
        const logs = this.engine.initializeBattle(this.units);
        this.resolveWinner();
        return { round: this.round, logs, status: this.status };
    }

    /** 为手动操作和行动条准备下一位行动者；不会结算该单位的回合。 */
    previewNextTurn(): BattleTurnPreview | null {
        if (this.status !== 'running') return null;
        if (!this._turnQueue.length) this.beginRound();
        while (this._turnQueue.length) {
            const actor = this.units.find((unit) => unit.id === this._turnQueue[0]);
            if (actor && actor.currentHp > 0) {
                return {
                    round: this.round,
                    actor: cloneBattleUnits([actor])[0],
                    skills: this.getSkillStates(actor, true),
                    targets: cloneBattleUnits(this.getLivingEnemies(actor.camp)),
                    upcomingUnitIds: this.getUpcomingUnitIds(),
                };
            }
            this._turnQueue.shift();
        }
        return this.previewNextTurn();
    }

    getUpcomingUnitIds(limit = 6): string[] {
        return this._turnQueue
            .filter((id) => (this.units.find((unit) => unit.id === id)?.currentHp ?? 0) > 0)
            .slice(0, Math.max(0, limit));
    }

    step(decision: BattleActionDecision = {}): BattleStepResult {
        if (this.status !== 'running') return this.emptyStep();
        if (!this._turnQueue.length) this.beginRound();
        if (this.status !== 'running') return this.emptyStep();

        const beforeUnits = cloneBattleUnits(this.units);
        const actorId = this._turnQueue.shift() ?? null;
        const actor = this.units.find((unit) => unit.id === actorId);
        if (!actor || actor.currentHp <= 0) {
            this.resolveWinner();
            return { ...this.emptyStep(), actorId };
        }

        this.reduceCooldowns(actor.id);
        const turnStart = this.engine.resolveTurnStart(actor.id, this.units);
        const turnStartLogs = [...turnStart.logs];
        const actionLogs: BattleLogEntry[] = [];
        const turnEndLogs: BattleLogEntry[] = [];
        this.resolveWinner();
        const turnStartUnits = cloneBattleUnits(this.units);

        let skill: BattleSkillConfig | null = null;
        if (this.status === 'running' && turnStart.canAct) {
            skill = this.selectSkill(actor, turnStart.canCastActiveSkill, decision.skillId);
            if (skill) {
                const target = this.selectPrimaryTarget(actor.camp, decision.targetId);
                actionLogs.push(...this.engine.executeSkill(skill.id, actor.id, this.units, {
                    primaryTargetId: target?.id,
                }));
                actor.energy = skill.kind === 'ultimate'
                    ? 0
                    : Math.min(actor.maxEnergy, actor.energy + (skill.kind === 'basic' ? 30 : 20));
                const damagedIds = new Set(actionLogs
                    .filter((log) => log.type === 'damage' && (log.value ?? 0) > 0)
                    .map((log) => log.targetUnitId));
                for (const targetId of damagedIds) {
                    const damaged = this.units.find((unit) => unit.id === targetId);
                    if (damaged?.currentHp && damaged.id !== actor.id) {
                        damaged.energy = Math.min(damaged.maxEnergy, damaged.energy + 10);
                    }
                }
                if (skill.cooldown > 0) {
                    // 回合开始会先减1，因此多存1可确保完整等待配置的冷却回合。
                    this._cooldowns.get(actor.id)?.set(skill.id, skill.cooldown + 1);
                }
            }
        }

        this.resolveWinner();
        const actionUnits = cloneBattleUnits(this.units);
        if (this.status === 'running' && actor.currentHp > 0) {
            turnEndLogs.push(...this.engine.resolveTurnEnd(actor.id, this.units));
            this.resolveWinner();
        }
        const turnEndUnits = cloneBattleUnits(this.units);

        const logs = [...turnStartLogs, ...actionLogs, ...turnEndLogs];

        return {
            round: this.round,
            actorId: actor.id,
            skill,
            beforeUnits,
            turnStartUnits,
            actionUnits,
            turnEndUnits,
            turnStartLogs,
            actionLogs,
            turnEndLogs,
            logs,
            status: this.status,
            winner: this.winner,
        };
    }

    private beginRound(): void {
        if (this.round >= this._maxRounds) {
            this.finishByRemainingHp();
            return;
        }
        this.round++;
        this._turnQueue = this.units
            .filter((unit) => unit.currentHp > 0)
            .sort((a, b) => (
                this.engine.getEffectiveAttributes(b).speed - this.engine.getEffectiveAttributes(a).speed
                || a.id.localeCompare(b.id)
            ))
            .map((unit) => unit.id);
    }

    private selectSkill(
        unit: BattleUnitState,
        canCastActiveSkill: boolean,
        preferredSkillId?: string,
    ): BattleSkillConfig | null {
        const available = this.getSkillStates(unit, false)
            .filter((state) => state.available)
            .map((state) => state.skill)
            .filter((skill) => canCastActiveSkill || skill.kind === 'basic');
        const preferred = available.find((skill) => skill.id === preferredSkillId);
        return preferred ?? available.sort((a, b) => b.slot - a.slot)[0] ?? null;
    }

    private getSkillStates(unit: BattleUnitState, beforeTurnStart: boolean): BattleSkillState[] {
        const cooldowns = this._cooldowns.get(unit.id);
        return getUnitBattleSkills(unit.configId)
            .filter((skill) => skill.kind !== 'passive')
            .sort((a, b) => a.slot - b.slot)
            .map((skill) => {
                const stored = cooldowns?.get(skill.id) ?? 0;
                const cooldown = beforeTurnStart ? Math.max(0, stored - 1) : stored;
                const lacksEnergy = skill.kind === 'ultimate' && unit.energy < unit.maxEnergy;
                return {
                    skill,
                    cooldown,
                    available: cooldown <= 0 && !lacksEnergy,
                    reason: cooldown > 0 ? 'cooldown' : lacksEnergy ? 'energy' : '',
                };
            });
    }

    private getLivingEnemies(camp: BattleCamp): BattleUnitState[] {
        return this.units.filter((unit) => unit.camp !== camp && unit.currentHp > 0);
    }

    private selectPrimaryTarget(camp: BattleCamp, preferredTargetId?: string): BattleUnitState | null {
        const enemies = this.getLivingEnemies(camp);
        const preferred = enemies.find((unit) => unit.id === preferredTargetId);
        if (preferred) return preferred;
        return enemies
            .sort((a, b) => (
                a.currentHp / a.attributes.maxHp - b.currentHp / b.attributes.maxHp
                || a.currentHp - b.currentHp
            ))[0] ?? null;
    }

    private reduceCooldowns(unitId: string): void {
        const cooldowns = this._cooldowns.get(unitId);
        if (!cooldowns) return;
        for (const [skillId, turns] of cooldowns) {
            cooldowns.set(skillId, Math.max(0, turns - 1));
        }
    }

    private resolveWinner(): void {
        const allyAlive = this.units.some((unit) => unit.camp === 'ally' && unit.currentHp > 0);
        const enemyAlive = this.units.some((unit) => unit.camp === 'enemy' && unit.currentHp > 0);
        if (allyAlive && enemyAlive) return;
        this.status = 'finished';
        this.winner = allyAlive ? 'ally' : enemyAlive ? 'enemy' : 'draw';
        this._turnQueue.length = 0;
    }

    private finishByRemainingHp(): void {
        const hpRate = (camp: BattleCamp) => this.units
            .filter((unit) => unit.camp === camp)
            .reduce((total, unit) => total + unit.currentHp / unit.attributes.maxHp, 0);
        const allyRate = hpRate('ally');
        const enemyRate = hpRate('enemy');
        this.status = 'finished';
        this.winner = allyRate === enemyRate ? 'draw' : allyRate > enemyRate ? 'ally' : 'enemy';
        this._turnQueue.length = 0;
    }

    private emptyStep(): BattleStepResult {
        const units = cloneBattleUnits(this.units);
        return {
            round: this.round,
            actorId: null,
            skill: null,
            beforeUnits: cloneBattleUnits(units),
            turnStartUnits: cloneBattleUnits(units),
            actionUnits: cloneBattleUnits(units),
            turnEndUnits: units,
            turnStartLogs: [],
            actionLogs: [],
            turnEndLogs: [],
            logs: [],
            status: this.status,
            winner: this.winner,
        };
    }
}
