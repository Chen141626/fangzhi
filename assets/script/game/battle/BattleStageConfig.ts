import type { ItemAmount } from '../item/ItemService';
import { BattleAttributes } from './BattleEffectTypes';
import { BattleUnitAnimationConfig, validateBattleAnimationConfig } from './BattleAnimationConfig';
import { BattleUnitConfig } from './BattleDemoConfig';
import { getUnitBattleSkills } from './BattleSkillConfig';

export interface BattleStageRewardConfig {
    /** 每次胜利均可获得。 */
    repeat: readonly ItemAmount[];
    /** 只在第一次通关时追加。 */
    firstClear: readonly ItemAmount[];
}

export interface BattleStageWaveConfig {
    id: string;
    name: string;
    enemies: readonly BattleUnitConfig[];
    /** 本波回合上限；省略时使用关卡上限。 */
    maxRounds?: number;
    /** 进入下一波前，存活友方按最大生命恢复的比例。 */
    recoveryAfterClear?: number;
}

export interface BattleStageConfig {
    id: string;
    name: string;
    maxRounds: number;
    /** 兼容旧入口，始终等于第一波敌人。 */
    enemies: readonly BattleUnitConfig[];
    waves?: readonly BattleStageWaveConfig[];
    rewards: BattleStageRewardConfig;
    nextStageId?: string;
}

function enemy(
    configId: string,
    name: string,
    attributes: BattleAttributes,
    animation: BattleUnitAnimationConfig,
): BattleUnitConfig {
    return {
        configId,
        name,
        camp: 'enemy',
        iconPath: `gui/common/roleIcon/${configId.replace(/^enemy_/, 'monster_')}/spriteFrame`,
        animation,
        attributes,
    };
}

export const DEFAULT_BATTLE_STAGE_ID = 'stage_001';

const STAGE_001_WAVE_1 = [
    enemy('enemy_01_horned_swordsman', '巡山角刃妖兵', { maxHp: 3800, attack: 520, defense: 180, speed: 103 }, { sourceFacing: 'left' }),
    enemy('enemy_03_fox_caster', '巡山狐火术士', { maxHp: 3500, attack: 560, defense: 155, speed: 110 }, { sourceFacing: 'left' }),
    enemy('enemy_07_stone_guardian', '巡山岩甲灵卫', { maxHp: 4600, attack: 450, defense: 280, speed: 82 }, { sourceFacing: 'left' }),
];

const STAGE_001_WAVE_2 = [
    enemy('enemy_01_horned_swordsman', '角刃妖兵', { maxHp: 6000, attack: 700, defense: 235, speed: 104, critRate: 0.1 }, { sourceFacing: 'left' }),
    enemy('enemy_03_fox_caster', '狐火术士', { maxHp: 5400, attack: 750, defense: 205, speed: 111, dodgeRate: 0.08 }, { sourceFacing: 'left' }),
    enemy('enemy_07_stone_guardian', '岩甲灵卫', { maxHp: 7400, attack: 570, defense: 390, speed: 84, dodgeRate: 0.02 }, { sourceFacing: 'left' }),
    enemy('enemy_10_jade_poison_toad', '碧毒蟾妖', { maxHp: 6500, attack: 660, defense: 285, speed: 92, hitRate: 1 }, { sourceFacing: 'right' }),
    enemy('enemy_15_blackwater_tortoise_king', '黑水玄龟王', { maxHp: 4500, attack: 640, defense: 220, speed: 79, critRate: 0.08 }, {
        sourceFacing: 'right', facingOverrides: { action: { 3: 'left' } },
    }),
];

const STAGE_002_WAVE_1 = [
    enemy('enemy_18_abyssal_spiral_shell_emperor', '螺皇幻影', { maxHp: 5200, attack: 610, defense: 310, speed: 86 }, { sourceFacing: 'left' }),
    enemy('enemy_20_cloud_wing_manta_demon', '云翼魟影', { maxHp: 4500, attack: 650, defense: 210, speed: 121 }, { sourceFacing: 'left' }),
    enemy('enemy_21_radiant_crystal_stag_king', '曜晶鹿影', { maxHp: 5000, attack: 600, defense: 270, speed: 105 }, { sourceFacing: 'left' }),
];

const STAGE_002_WAVE_2 = [
    enemy('enemy_18_abyssal_spiral_shell_emperor', '深渊螺皇', { maxHp: 8200, attack: 720, defense: 410, speed: 86, hitRate: 1 }, { sourceFacing: 'left' }),
    enemy('enemy_19_molten_prison_centipede', '熔狱蜈皇', { maxHp: 6800, attack: 840, defense: 300, speed: 102, critRate: 0.12 }, { sourceFacing: 'left' }),
    enemy('enemy_20_cloud_wing_manta_demon', '云翼魟魔', { maxHp: 6200, attack: 800, defense: 255, speed: 124, dodgeRate: 0.12 }, { sourceFacing: 'left' }),
    enemy('enemy_21_radiant_crystal_stag_king', '曜晶鹿王', { maxHp: 7400, attack: 730, defense: 330, speed: 108, hitRate: 1 }, { sourceFacing: 'left' }),
    enemy('enemy_22_dream_eater_tapir_king', '食梦貘王', { maxHp: 8800, attack: 770, defense: 375, speed: 95, critRate: 0.1 }, { sourceFacing: 'left' }),
];

export const BATTLE_STAGE_CONFIG: Readonly<Record<string, BattleStageConfig>> = {
    stage_001: {
        id: 'stage_001',
        name: '试炼·山门外阵',
        maxRounds: 30,
        enemies: STAGE_001_WAVE_1,
        waves: [
            { id: 'stage_001_wave_1', name: '山门巡守', enemies: STAGE_001_WAVE_1, maxRounds: 18, recoveryAfterClear: 0.25 },
            { id: 'stage_001_wave_2', name: '玄龟压阵', enemies: STAGE_001_WAVE_2, maxRounds: 30 },
        ],
        rewards: {
            repeat: [
                { itemId: 'currency.gold', amount: 800 },
                { itemId: 'consumable.qi-pill', amount: 1 },
            ],
            firstClear: [{ itemId: 'currency.jade', amount: 50 }],
        },
        nextStageId: 'stage_002',
    },
    stage_002: {
        id: 'stage_002',
        name: '试炼·万象妖境',
        maxRounds: 35,
        enemies: STAGE_002_WAVE_1,
        waves: [
            { id: 'stage_002_wave_1', name: '万象幻影', enemies: STAGE_002_WAVE_1, maxRounds: 18, recoveryAfterClear: 0.3 },
            { id: 'stage_002_wave_2', name: '五王真身', enemies: STAGE_002_WAVE_2, maxRounds: 35 },
        ],
        rewards: {
            repeat: [
                { itemId: 'currency.gold', amount: 1500 },
                { itemId: 'currency.crystal', amount: 10 },
            ],
            firstClear: [
                { itemId: 'currency.jade', amount: 100 },
                { itemId: 'item.reward-chest', amount: 1 },
            ],
        },
    },
};

export function getBattleStageConfig(stageId = DEFAULT_BATTLE_STAGE_ID): BattleStageConfig {
    const stage = BATTLE_STAGE_CONFIG[stageId];
    if (!stage) throw new Error(`[BattleStage] 未知关卡：${stageId}`);
    return stage;
}

export function validateBattleStageConfig(): void {
    const stageIds = new Set(Object.keys(BATTLE_STAGE_CONFIG));
    for (const stage of Object.values(BATTLE_STAGE_CONFIG)) {
        if (!stage.id || !stageIds.has(stage.id)) throw new Error('[BattleStage] 关卡 ID 配置不一致。');
        if (!Number.isInteger(stage.maxRounds) || stage.maxRounds < 1) {
            throw new Error(`[BattleStage] ${stage.id} 的最大回合数无效。`);
        }
        const waves = stage.waves?.length
            ? stage.waves
            : [{ id: `${stage.id}_wave_1`, name: stage.name, enemies: stage.enemies }];
        if (!waves.length) throw new Error(`[BattleStage] ${stage.id} 至少需要一波敌人。`);
        const waveIds = new Set<string>();
        for (const wave of waves) {
            if (!wave.id || waveIds.has(wave.id)) throw new Error(`[BattleStage] ${stage.id} 的波次 ID 无效。`);
            waveIds.add(wave.id);
            if (!wave.enemies.length || wave.enemies.length > 5) {
                throw new Error(`[BattleStage] ${wave.id} 的敌方人数必须为1-5。`);
            }
            if (wave.maxRounds !== undefined && (!Number.isInteger(wave.maxRounds) || wave.maxRounds < 1)) {
                throw new Error(`[BattleStage] ${wave.id} 的回合上限无效。`);
            }
            if (wave.recoveryAfterClear !== undefined && (wave.recoveryAfterClear < 0 || wave.recoveryAfterClear > 1)) {
                throw new Error(`[BattleStage] ${wave.id} 的波次恢复比例无效。`);
            }
            const unitIds = new Set<string>();
            for (const unit of wave.enemies) {
            if (unit.camp !== 'enemy' || unitIds.has(unit.configId)) {
                    throw new Error(`[BattleStage] ${wave.id} 的敌人配置无效：${unit.configId}`);
            }
            unitIds.add(unit.configId);
            validateBattleAnimationConfig(unit.configId, unit.animation);
            if (getUnitBattleSkills(unit.configId).length !== 4) {
                throw new Error(`[BattleStage] ${unit.configId} 未配置完整技能。`);
            }
            }
        }
        if (stage.nextStageId && !stageIds.has(stage.nextStageId)) {
            throw new Error(`[BattleStage] ${stage.id} 的下一关不存在：${stage.nextStageId}`);
        }
        for (const reward of [...stage.rewards.repeat, ...stage.rewards.firstClear]) {
            if (!Number.isSafeInteger(reward.amount) || reward.amount < 1) {
                throw new Error(`[BattleStage] ${stage.id} 的奖励数量无效。`);
            }
        }
    }
}
