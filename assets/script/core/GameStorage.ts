import { sys, warn } from 'cc';

/**
 * 项目统一本地存储入口。
 * 角色、背包、货币、任务等可序列化数据都应通过此类读写。
 */
export class GameStorage {
    /** 将数据 JSON 序列化后保存。 */
    static save<T>(key: string, data: T): void {
        sys.localStorage.setItem(key, JSON.stringify(data));
    }

    /** 读取并解析 JSON；数据不存在或损坏时返回 null。 */
    static load<T>(key: string): T | null {
        const content = sys.localStorage.getItem(key);
        if (!content) {
            return null;
        }

        try {
            return JSON.parse(content) as T;
        } catch (error) {
            warn(`[GameStorage] 数据读取失败 key=${key}: ${error}`);
            return null;
        }
    }

    /** 读取数据；未找到时使用工厂方法创建默认值。 */
    static loadOrCreate<T>(key: string, createDefault: () => T): T {
        return this.load<T>(key) ?? createDefault();
    }

    static exists(key: string): boolean {
        return sys.localStorage.getItem(key) !== null;
    }

    static remove(key: string): void {
        sys.localStorage.removeItem(key);
    }
}
