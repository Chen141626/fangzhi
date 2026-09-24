import { director } from 'cc';
import { GAME_EVENT_RESOURCE_CHANGED, GAME_EVENT_TASK_CHANGED } from '../../core/GameEvents';
import { GameStorage } from '../../core/GameStorage';
import { ItemAmount, ItemService } from '../item/ItemService';
import { TASK_DEFINITIONS, TaskCategory, TaskDefinition, TaskEventType } from './TaskConfig';

export const TASK_STORAGE_KEY = 'fangzhi.task-progress-data';

export type TaskStatus = 'locked' | 'inProgress' | 'claimable' | 'claimed';

export interface TaskViewData extends TaskDefinition {
    progress: number;
    status: TaskStatus;
}

interface TaskProgressData {
    version: 1;
    lifetimeCounters: Partial<Record<TaskEventType, number>>;
    claimed: string[];
    dailyDate: string;
    dailyCounters: Partial<Record<TaskEventType, number>>;
    dailyClaimed: string[];
    lastLoginDate: string;
}

export interface TaskSummary {
    claimableCount: number;
    activeMain: TaskViewData | null;
}

function localDateKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createDefaultData(): TaskProgressData {
    const today = localDateKey();
    return {
        version: 1,
        lifetimeCounters: {},
        claimed: [],
        dailyDate: today,
        dailyCounters: {},
        dailyClaimed: [],
        lastLoginDate: '',
    };
}

function normalizeCounterRecord(value: unknown): Partial<Record<TaskEventType, number>> {
    if (!value || typeof value !== 'object') return {};
    const result: Partial<Record<TaskEventType, number>> = {};
    for (const [key, amount] of Object.entries(value as Record<string, unknown>)) {
        if (Number.isSafeInteger(amount) && (amount as number) >= 0) {
            result[key as TaskEventType] = amount as number;
        }
    }
    return result;
}

function normalizeStringArray(value: unknown): string[] {
    return Array.isArray(value)
        ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string')))
        : [];
}

/** 任务存档、进度和奖励的唯一业务入口。 */
export class TaskService {
    private readonly _items: ItemService;
    private _data: TaskProgressData;

    constructor(
        private readonly _storageKey = TASK_STORAGE_KEY,
        itemStorageKey?: string,
    ) {
        this._items = new ItemService(itemStorageKey);
        this._data = createDefaultData();
        this.reload();
    }

    /** 上报玩法事件；同一次成功操作应只调用一次。 */
    report(event: TaskEventType, amount = 1): boolean {
        return this.reportMany([{ event, amount }]);
    }

    /** 同一玩法结算可一次写入多个统计，避免中途状态不一致。 */
    reportMany(events: readonly { event: TaskEventType; amount?: number }[]): boolean {
        for (const item of events) {
            const amount = item.amount ?? 1;
            if (!Number.isSafeInteger(amount) || amount < 1) {
                throw new RangeError(`Task event amount must be a positive safe integer: ${amount}`);
            }
        }
        this.reload();
        const today = localDateKey();
        let changed = false;
        for (const item of events) {
            if (item.event === 'login' && this._data.lastLoginDate === today) continue;
            if (item.event === 'login') this._data.lastLoginDate = today;
            const amount = item.amount ?? 1;
            this.increment(this._data.lifetimeCounters, item.event, amount);
            this.increment(this._data.dailyCounters, item.event, amount);
            changed = true;
        }
        if (!changed) return false;
        this.save();
        director.emit(GAME_EVENT_TASK_CHANGED);
        return true;
    }

    getTasks(category: TaskCategory): TaskViewData[] {
        this.reload();
        return TASK_DEFINITIONS
            .filter((definition) => definition.category === category)
            .map((definition) => this.toViewData(definition));
    }

    getSummary(): TaskSummary {
        this.reload();
        const all = TASK_DEFINITIONS.map((definition) => this.toViewData(definition));
        return {
            claimableCount: all.filter((task) => task.status === 'claimable').length,
            activeMain: all.find((task) => task.category === 'main' && task.status !== 'claimed') ?? null,
        };
    }

    claim(taskId: string): readonly ItemAmount[] | null {
        this.reload();
        const definition = TASK_DEFINITIONS.find((task) => task.id === taskId);
        if (!definition || this.toViewData(definition).status !== 'claimable') return null;

        this._items.reload();
        this._items.addMany(definition.rewards);
        const claimed = definition.category === 'daily' ? this._data.dailyClaimed : this._data.claimed;
        claimed.push(definition.id);
        try {
            this.save();
        }
        catch (error) {
            claimed.splice(claimed.indexOf(definition.id), 1);
            this._items.subtractMany(definition.rewards);
            throw error;
        }
        director.emit(GAME_EVENT_RESOURCE_CHANGED);
        director.emit(GAME_EVENT_TASK_CHANGED);
        return definition.rewards;
    }

    claimAll(category: TaskCategory): { count: number; rewards: ItemAmount[] } {
        const aggregated = new Map<string, number>();
        let count = 0;
        // 主线领取上一环后可能立即解锁下一环，因此循环重新计算可领取项。
        for (let guard = 0; guard < TASK_DEFINITIONS.length; guard++) {
            const task = this.getTasks(category).find((item) => item.status === 'claimable');
            if (!task) break;
            const rewards = this.claim(task.id);
            if (!rewards) continue;
            count++;
            for (const reward of rewards) {
                const id = String(reward.itemId);
                aggregated.set(id, (aggregated.get(id) ?? 0) + reward.amount);
            }
        }
        return {
            count,
            rewards: Array.from(aggregated, ([itemId, amount]) => ({ itemId, amount })),
        };
    }

    private toViewData(definition: TaskDefinition): TaskViewData {
        const claimed = definition.category === 'daily'
            ? this._data.dailyClaimed.includes(definition.id)
            : this._data.claimed.includes(definition.id);
        const counter = definition.category === 'daily'
            ? this._data.dailyCounters[definition.event] ?? 0
            : this._data.lifetimeCounters[definition.event] ?? 0;
        const progress = Math.min(counter, definition.target);
        let status: TaskStatus = progress >= definition.target ? 'claimable' : 'inProgress';
        if (claimed) status = 'claimed';
        else if (definition.prerequisiteId && !this._data.claimed.includes(definition.prerequisiteId)) status = 'locked';
        return { ...definition, progress, status };
    }

    private increment(target: Partial<Record<TaskEventType, number>>, event: TaskEventType, amount: number): void {
        const current = target[event] ?? 0;
        target[event] = Math.min(Number.MAX_SAFE_INTEGER, current + amount);
    }

    private reload(): void {
        const saved = GameStorage.load<Partial<TaskProgressData>>(this._storageKey);
        if (!saved || saved.version !== 1) {
            this._data = createDefaultData();
        }
        else {
            this._data = {
                version: 1,
                lifetimeCounters: normalizeCounterRecord(saved.lifetimeCounters),
                claimed: normalizeStringArray(saved.claimed),
                dailyDate: typeof saved.dailyDate === 'string' ? saved.dailyDate : '',
                dailyCounters: normalizeCounterRecord(saved.dailyCounters),
                dailyClaimed: normalizeStringArray(saved.dailyClaimed),
                lastLoginDate: typeof saved.lastLoginDate === 'string' ? saved.lastLoginDate : '',
            };
        }
        if (this._data.dailyDate !== localDateKey()) {
            this._data.dailyDate = localDateKey();
            this._data.dailyCounters = {};
            this._data.dailyClaimed = [];
            this.save();
        }
    }

    private save(): void {
        GameStorage.save(this._storageKey, this._data);
    }
}
