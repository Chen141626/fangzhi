import { GameStorage } from '../../core/GameStorage';

export const HOME_POPUP_STATE_STORAGE_KEY = 'fangzhi.home-popup-state';

export const HOME_POPUP_ACTION_EVENT = 'home-popup-action';

export interface HomePopupAction {
    uiId: number;
    action: 'purchase' | 'recharge' | 'claim' | 'navigate' | 'open-event';
    target: string;
}

interface HomePopupStateData {
    version: 1;
    /** 永久领取状态，例如累充档位、成长基金档位与已完成奇遇。 */
    claimed: Record<string, true>;
    /** 每日领取记录，值为最近一次领取的本地日期。 */
    dailyClaims: Record<string, string>;
    /** 每日领取历史，用于七日登录进度。 */
    dailyHistory: Record<string, string[]>;
    /** 轻量界面状态，例如奇遇选项和限时活动页签。 */
    values: Record<string, string>;
}

function createDefaultState(): HomePopupStateData {
    return {
        version: 1,
        claimed: {},
        dailyClaims: {},
        dailyHistory: {},
        values: {},
    };
}

function localDateKey(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 主界面活动弹窗的轻量本地状态仓库。
 *
 * 这里只保存界面演示与离线玩法需要的状态。充值、支付等真实业务仍由外部系统处理，
 * 弹窗通过 HOME_POPUP_ACTION_EVENT 发出请求，不在本地伪造交易结果。
 */
export class HomePopupState {
    private _data: HomePopupStateData;

    constructor() {
        this._data = createDefaultState();
        this.reload();
    }

    isClaimed(key: string): boolean {
        this.reload();
        return this._data.claimed[key] === true;
    }

    /** 首次领取返回 true；重复领取不写存档并返回 false。 */
    claim(key: string): boolean {
        if (this.isClaimed(key)) return false;
        this._data.claimed[key] = true;
        this.save();
        return true;
    }

    isClaimedToday(key: string, today: string = localDateKey()): boolean {
        this.reload();
        return this._data.dailyClaims[key] === today;
    }

    /** 每个自然日只能领取一次，并记录历史领取日期。 */
    claimToday(key: string, today: string = localDateKey()): boolean {
        if (this.isClaimedToday(key, today)) return false;

        this._data.dailyClaims[key] = today;
        const history = this._data.dailyHistory[key] ?? [];
        if (!history.includes(today)) history.push(today);
        this._data.dailyHistory[key] = history.slice(-30);
        this.save();
        return true;
    }

    getDailyClaimCount(key: string): number {
        this.reload();
        return this._data.dailyHistory[key]?.length ?? 0;
    }

    getValue(key: string, fallback = ''): string {
        this.reload();
        return this._data.values[key] ?? fallback;
    }

    setValue(key: string, value: string): void {
        this.reload();
        if (this._data.values[key] === value) return;
        this._data.values[key] = value;
        this.save();
    }

    private normalize(saved: Partial<HomePopupStateData> | null): HomePopupStateData {
        if (!saved || saved.version !== 1) return createDefaultState();
        return {
            version: 1,
            claimed: this.recordOfTrue(saved.claimed),
            dailyClaims: this.recordOfStrings(saved.dailyClaims),
            dailyHistory: this.recordOfStringArrays(saved.dailyHistory),
            values: this.recordOfStrings(saved.values),
        };
    }

    private recordOfTrue(value: unknown): Record<string, true> {
        if (!value || typeof value !== 'object') return {};
        const result: Record<string, true> = {};
        for (const [key, claimed] of Object.entries(value as Record<string, unknown>)) {
            if (claimed === true) result[key] = true;
        }
        return result;
    }

    private recordOfStrings(value: unknown): Record<string, string> {
        if (!value || typeof value !== 'object') return {};
        const result: Record<string, string> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            if (typeof item === 'string') result[key] = item;
        }
        return result;
    }

    private recordOfStringArrays(value: unknown): Record<string, string[]> {
        if (!value || typeof value !== 'object') return {};
        const result: Record<string, string[]> = {};
        for (const [key, items] of Object.entries(value as Record<string, unknown>)) {
            if (Array.isArray(items)) {
                result[key] = items.filter((item): item is string => typeof item === 'string');
            }
        }
        return result;
    }

    private save(): void {
        GameStorage.save(HOME_POPUP_STATE_STORAGE_KEY, this._data);
    }

    /** 多个缓存弹窗会持有各自实例，操作前同步最新存档以避免互相覆盖。 */
    private reload(): void {
        const saved = GameStorage.load<Partial<HomePopupStateData>>(HOME_POPUP_STATE_STORAGE_KEY);
        this._data = this.normalize(saved);
    }
}
