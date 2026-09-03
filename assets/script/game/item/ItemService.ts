import { GameStorage } from '../../core/GameStorage';

export type ItemConfigId = string | number;

export interface ItemAmount {
    itemId: ItemConfigId;
    amount: number;
}

export interface PlayerItemData {
    version: 1;
    /** 键为道具配置 ID 转换后的字符串，值为当前持有数量。 */
    amounts: Record<string, number>;
}

export const PLAYER_ITEM_STORAGE_KEY = 'fangzhi.player-item-data';

function createEmptyPlayerItemData(): PlayerItemData {
    return {
        version: 1,
        amounts: {},
    };
}

function normalizeItemId(itemId: ItemConfigId): string {
    if (typeof itemId === 'number') {
        if (!Number.isFinite(itemId)) {
            throw new TypeError(`Item ID must be finite, received: ${itemId}`);
        }
        return String(itemId);
    }

    if (!itemId) {
        throw new TypeError('Item ID cannot be empty.');
    }
    return itemId;
}

function validateAmount(amount: number, name = 'Item amount'): void {
    if (!Number.isSafeInteger(amount) || amount < 1) {
        throw new RangeError(`${name} must be a positive safe integer, received: ${amount}`);
    }
}

function aggregateItems(items: readonly ItemAmount[]): Map<string, number> {
    const result = new Map<string, number>();
    for (const item of items) {
        validateAmount(item.amount);
        const itemId = normalizeItemId(item.itemId);
        const amount = (result.get(itemId) ?? 0) + item.amount;
        if (!Number.isSafeInteger(amount)) {
            throw new RangeError(`Item amount exceeds the safe integer range: ${itemId}`);
        }
        result.set(itemId, amount);
    }
    return result;
}

/**
 * 道具唯一读写入口。
 * 业务脚本不应直接修改 PlayerItemData，应调用本类的增加、扣除等方法。
 */
export class ItemService {
    private readonly _storageKey: string;
    private _data: PlayerItemData;

    constructor(storageKey: string = PLAYER_ITEM_STORAGE_KEY) {
        this._storageKey = storageKey;
        this._data = this.load();
    }

    get data(): Readonly<PlayerItemData> {
        return this._data;
    }

    getAmount(itemId: ItemConfigId): number {
        return this._data.amounts[normalizeItemId(itemId)] ?? 0;
    }

    has(itemId: ItemConfigId, amount = 1): boolean {
        validateAmount(amount);
        return this.getAmount(itemId) >= amount;
    }

    /** 增加道具并返回增加后数量。 */
    add(itemId: ItemConfigId, amount = 1): number {
        validateAmount(amount);
        const key = normalizeItemId(itemId);
        const nextAmount = this.getAmount(key) + amount;
        if (!Number.isSafeInteger(nextAmount)) {
            throw new RangeError(`Item amount exceeds the safe integer range: ${key}`);
        }

        this._data.amounts[key] = nextAmount;
        this.save();
        return nextAmount;
    }

    /** 扣除道具；数量不足时不修改数据并返回 false。 */
    subtract(itemId: ItemConfigId, amount = 1): boolean {
        validateAmount(amount);
        const key = normalizeItemId(itemId);
        const currentAmount = this.getAmount(key);
        if (currentAmount < amount) {
            return false;
        }

        const nextAmount = currentAmount - amount;
        if (nextAmount === 0) {
            delete this._data.amounts[key];
        } else {
            this._data.amounts[key] = nextAmount;
        }
        this.save();
        return true;
    }

    /** delta 为正数时增加，为负数时扣除；扣除失败时返回 false。 */
    change(itemId: ItemConfigId, delta: number): boolean {
        if (!Number.isSafeInteger(delta) || delta === 0) {
            throw new RangeError(`Item delta must be a non-zero safe integer, received: ${delta}`);
        }

        if (delta > 0) {
            this.add(itemId, delta);
            return true;
        }
        return this.subtract(itemId, -delta);
    }

    /** 批量增加道具，整批只保存一次。 */
    addMany(items: readonly ItemAmount[]): void {
        const aggregated = aggregateItems(items);
        for (const [itemId, amount] of aggregated) {
            const nextAmount = this.getAmount(itemId) + amount;
            if (!Number.isSafeInteger(nextAmount)) {
                throw new RangeError(`Item amount exceeds the safe integer range: ${itemId}`);
            }
        }
        for (const [itemId, amount] of aggregated) {
            this._data.amounts[itemId] = this.getAmount(itemId) + amount;
        }
        this.save();
    }

    /** 批量扣除道具；任意一种不足时整批不扣除。 */
    subtractMany(items: readonly ItemAmount[]): boolean {
        const aggregated = aggregateItems(items);
        for (const [itemId, amount] of aggregated) {
            if (this.getAmount(itemId) < amount) {
                return false;
            }
        }
        for (const [itemId, amount] of aggregated) {
            const nextAmount = this.getAmount(itemId) - amount;
            if (nextAmount === 0) {
                delete this._data.amounts[itemId];
            } else {
                this._data.amounts[itemId] = nextAmount;
            }
        }
        this.save();
        return true;
    }

    reload(): void {
        this._data = this.load();
    }

    private load(): PlayerItemData {
        const data = GameStorage.load<Partial<PlayerItemData>>(this._storageKey);
        if (!data || data.version !== 1 || !data.amounts || typeof data.amounts !== 'object') {
            return createEmptyPlayerItemData();
        }

        const amounts: Record<string, number> = {};
        for (const [itemId, amount] of Object.entries(data.amounts)) {
            if (Number.isSafeInteger(amount) && amount > 0) {
                amounts[itemId] = amount;
            }
        }
        return { version: 1, amounts };
    }

    private save(): void {
        GameStorage.save(this._storageKey, this._data);
    }
}
