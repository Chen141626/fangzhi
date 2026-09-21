import { ItemAmount } from '../item/ItemService';
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

export interface BattleStageConfig {
    id: string;
    name: string;
    maxRounds: number;
    enemies: readonly BattleUnitConfig[];
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

export const BATTLE_STAGE_CONFIG: Readonly<Record<string, BattleStageConfig>> = {
    stage_001: {
        id: 'stage_001',
        name: '试炼·山门外阵',
        maxRounds: 30,
        enemies: [
            enemy('enemy_01_horned_swordsman', '角刃妖兵', { maxHp: 6000, attack: 700, defense: 235, speed: 104, critRate: 0.1 }, { sourceFacing: 'left' }),
            enemy('enemy_03_fox_caster', '狐火术士', { maxHp: 5400, attack: 750, defense: 205, speed: 111, dodgeRate: 0.08 }, { sourceFacing: 'left' }),
            enemy('enemy_07_stone_guardian', '岩甲灵卫', { maxHp: 7400, attack: 570, defense: 390, speed: 84, dodgeRate: 0.02 }, { sourceFacing: 'left' }),
            enemy('enemy_10_jade_poison_toad', '碧毒蟾妖', { maxHp: 6500, attack: 660, defense: 285, speed: 92, hitRate: 1 }, { sourceFacing: 'right' }),
            enemy('enemy_15_blackwater_tortoise_king', '黑水玄龟王', { maxHp: 4500, attack: 640, defense: 220, speed: 79, critRate: 0.08 }, {
                sourceFacing: 'right',
                facingOverrides: { action: { 3: 'left' } },
            }),
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
        enemies: [
            enemy('enemy_18_abyssal_spiral_shell_emperor', '深渊螺皇', { maxHp: 9000, attack: 760, defense: 440, speed: 86, hitRate: 1 }, { sourceFacing: 'left' }),
            enemy('enemy_19_molten_prison_centipede', '熔狱蜈皇', { maxHp: 7600, attack: 920, defense: 330, speed: 102, critRate: 0.12 }, { sourceFacing: 'left' }),
            enemy('enemy_20_cloud_wing_manta_demon', '云翼魟魔', { maxHp: 6900, attack: 880, defense: 280, speed: 124, dodgeRate: 0.12 }, { sourceFacing: 'left' }),
            enemy('enemy_21_radiant_crystal_stag_king', '曜晶鹿王', { maxHp: 8200, attack: 790, defense: 360, speed: 108, hitRate: 1 }, { sourceFacing: 'left' }),
            enemy('enemy_22_dream_eater_tapir_king', '食梦貘王', { maxHp: 9800, attack: 840, defense: 410, speed: 95, critRate: 0.1 }, { sourceFacing: 'left' }),
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
        if (!stage.enemies.length || stage.enemies.length > 5) {
            throw new Error(`[BattleStage] ${stage.id} 的敌方人数必须为1-5。`);
        }
        const unitIds = new Set<string>();
        for (const unit of stage.enemies) {
            if (unit.camp !== 'enemy' || unitIds.has(unit.configId)) {
                throw new Error(`[BattleStage] ${stage.id} 的敌人配置无效：${unit.configId}`);
            }
            unitIds.add(unit.configId);
            validateBattleAnimationConfig(unit.configId, unit.animation);
            if (getUnitBattleSkills(unit.configId).length !== 4) {
                throw new Error(`[BattleStage] ${unit.configId} 未配置完整技能。`);
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
