export type BattleSpriteFacing = 'left' | 'right';
export type BattleAnimationSequence = 'idle' | 'attack' | 'action' | 'hit' | 'death';

type FourFrameNumber = 1 | 2 | 3 | 4;
type SixFrameNumber = FourFrameNumber | 5 | 6;

export interface BattleAnimationFacingOverrides {
    idle?: Readonly<Partial<Record<FourFrameNumber, BattleSpriteFacing>>>;
    attack?: Readonly<Partial<Record<SixFrameNumber, BattleSpriteFacing>>>;
    action?: Readonly<Partial<Record<SixFrameNumber, BattleSpriteFacing>>>;
    hit?: Readonly<Partial<Record<FourFrameNumber, BattleSpriteFacing>>>;
    death?: Readonly<Partial<Record<FourFrameNumber, BattleSpriteFacing>>>;
}

/**
 * 序列帧原图的朝向信息。帧号采用美术文件中的 1-based 编号（frame_01、frame_02……）。
 * 新单位必须显式填写 sourceFacing；只有个别方向不一致的帧才需要 facingOverrides。
 */
export interface BattleUnitAnimationConfig {
    sourceFacing: BattleSpriteFacing;
    facingOverrides?: BattleAnimationFacingOverrides;
}

const SEQUENCE_FRAME_COUNTS: Readonly<Record<BattleAnimationSequence, number>> = {
    idle: 4,
    attack: 6,
    action: 6,
    hit: 4,
    death: 4,
};

export function resolveBattleFrameFacing(
    config: BattleUnitAnimationConfig,
    sequence: BattleAnimationSequence,
    frameNumber: number,
): BattleSpriteFacing {
    const overrides = config.facingOverrides?.[sequence] as
        | Readonly<Partial<Record<number, BattleSpriteFacing>>>
        | undefined;
    return overrides?.[frameNumber] ?? config.sourceFacing;
}

/** 对动态数据也做运行时校验，避免绕过 TypeScript 后把错误帧号带进战斗。 */
export function validateBattleAnimationConfig(
    configId: string,
    config: BattleUnitAnimationConfig,
): void {
    if (config.sourceFacing !== 'left' && config.sourceFacing !== 'right') {
        throw new Error(`[BattleAnimation] ${configId} 缺少有效的 sourceFacing。`);
    }
    for (const sequence of Object.keys(SEQUENCE_FRAME_COUNTS) as BattleAnimationSequence[]) {
        const overrides = config.facingOverrides?.[sequence];
        if (!overrides) continue;
        const maxFrame = SEQUENCE_FRAME_COUNTS[sequence];
        for (const [rawFrameNumber, facing] of Object.entries(overrides)) {
            const frameNumber = Number(rawFrameNumber);
            if (!Number.isInteger(frameNumber) || frameNumber < 1 || frameNumber > maxFrame) {
                throw new Error(
                    `[BattleAnimation] ${configId}.${sequence} 的朝向修正帧 ${rawFrameNumber} 越界，`
                    + `有效范围为 1-${maxFrame}。`,
                );
            }
            if (facing !== 'left' && facing !== 'right') {
                throw new Error(
                    `[BattleAnimation] ${configId}.${sequence}.frame_${rawFrameNumber} 的朝向无效。`,
                );
            }
        }
    }
}
