import { warn } from 'cc';
import { GameStorage } from '../../core/GameStorage';
import { ItemAmount, ItemService } from '../item/ItemService';
import { TaskService } from '../task/TaskService';
import { BattleStageConfig, DEFAULT_BATTLE_STAGE_ID } from './BattleStageConfig';

export interface BattleStageProgress {
    clearCount: number;
    bestRounds: number;
    firstClearedAt: number;
}

export interface BattleProgressData {
    version: 1;
    stages: Record<string, BattleStageProgress>;
    unlockedStageIds: string[];
    /** 防止同一场战斗因重复回调而重复发奖，只保留最近记录。 */
    settledBattleIds: string[];
}

export interface BattleSettlement {
    granted: boolean;
    victory: boolean;
    firstClear: boolean;
    duplicate: boolean;
    rewards: readonly ItemAmount[];
}

export const BATTLE_PROGRESS_STORAGE_KEY = 'fangzhi.battle-progress-data';
const MAX_SETTLED_BATTLE_IDS = 100;

function createEmptyProgress(): BattleProgressData {
    return {
        version: 1,
        stages: {},
        unlockedStageIds: [DEFAULT_BATTLE_STAGE_ID],
        settledBattleIds: [],
    };
}

function aggregateRewards(items: readonly ItemAmount[]): ItemAmount[] {
    const amounts = new Map<string, number>();
    for (const item of items) {
        const id = String(item.itemId);
        amounts.set(id, (amounts.get(id) ?? 0) + item.amount);
    }
    return Array.from(amounts, ([itemId, amount]) => ({ itemId, amount }));
}

export class BattleRewardService {
    private readonly _items: ItemService;
    private readonly _tasks: TaskService;

    constructor(
        private readonly _storageKey = BATTLE_PROGRESS_STORAGE_KEY,
        itemStorageKey?: string,
    ) {
        this._items = new ItemService(itemStorageKey);
        this._tasks = new TaskService(undefined, itemStorageKey);
    }

    getProgress(): Readonly<BattleProgressData> {
        return this.load();
    }

    settle(
        stage: BattleStageConfig,
        winner: 'ally' | 'enemy' | 'draw' | null,
        battleId: string,
        rounds: number,
    ): BattleSettlement {
        if (winner !== 'ally') {
            return { granted: false, victory: false, firstClear: false, duplicate: false, rewards: [] };
        }
        if (!battleId) throw new Error('[BattleReward] battleId 不能为空。');

        const progress = this.load();
        if (progress.settledBattleIds.includes(battleId)) {
            return { granted: false, victory: true, firstClear: false, duplicate: true, rewards: [] };
        }

        const previous = progress.stages[stage.id];
        const firstClear = !previous;
        const rewards = aggregateRewards([
            ...stage.rewards.repeat,
            ...(firstClear ? stage.rewards.firstClear : []),
        ]);
        const now = Date.now();
        progress.stages[stage.id] = {
            clearCount: (previous?.clearCount ?? 0) + 1,
            bestRounds: previous ? Math.min(previous.bestRounds, rounds) : rounds,
            firstClearedAt: previous?.firstClearedAt ?? now,
        };
        if (stage.nextStageId && !progress.unlockedStageIds.includes(stage.nextStageId)) {
            progress.unlockedStageIds.push(stage.nextStageId);
        }
        progress.settledBattleIds.push(battleId);
        progress.settledBattleIds = progress.settledBattleIds.slice(-MAX_SETTLED_BATTLE_IDS);

        this._items.reload();
        this._items.addMany(rewards);
        try {
            GameStorage.save(this._storageKey, progress);
        }
        catch (error) {
            // 两份本地存档无法原子提交，进度保存失败时撤销刚发放的奖励。
            this._items.subtractMany(rewards);
            throw error;
        }

        try {
            this._tasks.reportMany([
                { event: 'battleWin', amount: 1 },
                { event: 'stageClear', amount: 1 },
            ]);
        }
        catch (error) {
            // 战斗奖励已经落盘，任务统计失败不应让结算界面误判整场战斗失败。
            warn(`[BattleReward] 任务进度上报失败：${String(error)}`);
        }

        return { granted: true, victory: true, firstClear, duplicate: false, rewards };
    }

    private load(): BattleProgressData {
        const saved = GameStorage.load<Partial<BattleProgressData>>(this._storageKey);
        if (!saved || saved.version !== 1 || !saved.stages || typeof saved.stages !== 'object') {
            return createEmptyProgress();
        }
        const unlockedStageIds = Array.isArray(saved.unlockedStageIds)
            ? saved.unlockedStageIds.filter((id): id is string => typeof id === 'string')
            : [DEFAULT_BATTLE_STAGE_ID];
        if (!unlockedStageIds.includes(DEFAULT_BATTLE_STAGE_ID)) {
            unlockedStageIds.unshift(DEFAULT_BATTLE_STAGE_ID);
        }
        const settledBattleIds = Array.isArray(saved.settledBattleIds)
            ? saved.settledBattleIds.filter((id): id is string => typeof id === 'string')
            : [];
        return {
            version: 1,
            stages: saved.stages as Record<string, BattleStageProgress>,
            unlockedStageIds,
            settledBattleIds: settledBattleIds.slice(-MAX_SETTLED_BATTLE_IDS),
        };
    }
}
