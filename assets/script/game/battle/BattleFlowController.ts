import { BattleDemoUnitConfig, BATTLE_DEMO_ROSTER } from './BattleDemoConfig';
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
    logs: BattleLogEntry[];
    status: BattleFlowStatus;
    winner: BattleWinner;
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
        private readonly _maxRounds = 30,
    ) {
        this.engine = new BattleEffectEngine(random);
    }

    start(roster: readonly BattleDemoUnitConfig[] = BATTLE_DEMO_ROSTER): BattleStartResult {
        this.round = 0;
        this.status = 'running';
        this.winner = null;
        this._turnQueue.length = 0;
        this._cooldowns.clear();
        this.units = roster.map((config, index) => this.engine.createUnit(
            `${config.camp}_${index + 1}`,
            config.configId,
            config.name,
            config.camp,
            config.attributes,
        ));

        for (const unit of this.units) this._cooldowns.set(unit.id, new Map<string, number>());
        const logs = this.engine.initializeBattle(this.units);
        this.resolveWinner();
        return { round: this.round, logs, status: this.status };
    }

    step(): BattleStepResult {
        if (this.status !== 'running') return this.emptyStep();
        if (!this._turnQueue.length) this.beginRound();
        if (this.status !== 'running') return this.emptyStep();

        const actorId = this._turnQueue.shift() ?? null;
        const actor = this.units.find((unit) => unit.id === actorId);
        if (!actor || actor.currentHp <= 0) {
            this.resolveWinner();
            return { ...this.emptyStep(), actorId };
        }

        this.reduceCooldowns(actor.id);
        const turnStart = this.engine.resolveTurnStart(actor.id, this.units);
        const logs = [...turnStart.logs];
        this.resolveWinner();

        let skill: BattleSkillConfig | null = null;
        if (this.status === 'running' && turnStart.canAct) {
            skill = this.selectSkill(actor, turnStart.canCastActiveSkill);
            if (skill) {
                const target = this.selectPrimaryTarget(actor.camp);
                logs.push(...this.engine.executeSkill(skill.id, actor.id, this.units, {
                    primaryTargetId: target?.id,
                }));
                if (skill.cooldown > 0) {
                    // 回合开始会先减1，因此多存1可确保完整等待配置的冷却回合。
                    this._cooldowns.get(actor.id)?.set(skill.id, skill.cooldown + 1);
                }
            }
        }

        this.resolveWinner();
        if (this.status === 'running' && actor.currentHp > 0) {
            logs.push(...this.engine.resolveTurnEnd(actor.id, this.units));
            this.resolveWinner();
        }

        return {
            round: this.round,
            actorId: actor.id,
            skill,
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

    private selectSkill(unit: BattleUnitState, canCastActiveSkill: boolean): BattleSkillConfig | null {
        const cooldowns = this._cooldowns.get(unit.id);
        const available = getUnitBattleSkills(unit.configId)
            .filter((skill) => skill.kind !== 'passive')
            .filter((skill) => canCastActiveSkill || skill.kind === 'basic')
            .filter((skill) => (cooldowns?.get(skill.id) ?? 0) <= 0)
            .sort((a, b) => b.slot - a.slot);
        return available[0] ?? null;
    }

    private selectPrimaryTarget(camp: BattleCamp): BattleUnitState | null {
        return this.units
            .filter((unit) => unit.camp !== camp && unit.currentHp > 0)
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
        return {
            round: this.round,
            actorId: null,
            skill: null,
            logs: [],
            status: this.status,
            winner: this.winner,
        };
    }
}
