import { ItemAmount } from '../item/ItemService';

export type TaskCategory = 'main' | 'daily' | 'achievement';

/** 所有可驱动任务进度的玩法事件。 */
export type TaskEventType =
    | 'login'
    | 'summon'
    | 'formationSave'
    | 'battleWin'
    | 'stageClear'
    | 'roleLevelUp'
    | 'roleStarUp'
    | 'roleSkillUp';

export interface TaskDefinition {
    id: string;
    category: TaskCategory;
    title: string;
    description: string;
    event: TaskEventType;
    target: number;
    rewards: readonly ItemAmount[];
    /** 主线任务领取后才解锁下一环。 */
    prerequisiteId?: string;
}

export const TASK_CATEGORY_NAMES: Record<TaskCategory, string> = {
    main: '主线任务',
    daily: '每日任务',
    achievement: '成就',
};

export const TASK_DEFINITIONS: readonly TaskDefinition[] = [
    {
        id: 'main_summon_1', category: 'main', title: '初遇仙缘',
        description: '完成1次召唤', event: 'summon', target: 1,
        rewards: [{ itemId: 'currency.gold', amount: 1000 }, { itemId: 'consumable.qi-pill', amount: 3 }],
    },
    {
        id: 'main_team_1', category: 'main', title: '整装待发',
        description: '保存1次出战阵容', event: 'formationSave', target: 1,
        rewards: [{ itemId: 'currency.jade', amount: 100 }], prerequisiteId: 'main_summon_1',
    },
    {
        id: 'main_battle_1', category: 'main', title: '旗开得胜',
        description: '赢得1场战斗', event: 'battleWin', target: 1,
        rewards: [{ itemId: 'currency.gold', amount: 3000 }], prerequisiteId: 'main_team_1',
    },
    {
        id: 'main_level_3', category: 'main', title: '修为精进',
        description: '累计完成3次角色升级', event: 'roleLevelUp', target: 3,
        rewards: [{ itemId: 'currency.gold', amount: 3000 }, { itemId: 'consumable.qi-pill', amount: 5 }], prerequisiteId: 'main_battle_1',
    },
    {
        id: 'main_skill_1', category: 'main', title: '初窥门径',
        description: '完成1次技能研习', event: 'roleSkillUp', target: 1,
        rewards: [{ itemId: 'currency.crystal', amount: 15 }], prerequisiteId: 'main_level_3',
    },
    {
        id: 'main_battle_3', category: 'main', title: '再接再厉',
        description: '累计赢得3场战斗', event: 'battleWin', target: 3,
        rewards: [{ itemId: 'currency.jade', amount: 200 }, { itemId: 'currency.crystal', amount: 10 }], prerequisiteId: 'main_skill_1',
    },

    {
        id: 'daily_login', category: 'daily', title: '每日签到',
        description: '今日登录游戏', event: 'login', target: 1,
        rewards: [{ itemId: 'currency.gold', amount: 1000 }],
    },
    {
        id: 'daily_summon_1', category: 'daily', title: '广结仙缘',
        description: '今日完成1次召唤', event: 'summon', target: 1,
        rewards: [{ itemId: 'consumable.qi-pill', amount: 3 }],
    },
    {
        id: 'daily_level_3', category: 'daily', title: '勤修不辍',
        description: '今日完成3次角色升级', event: 'roleLevelUp', target: 3,
        rewards: [{ itemId: 'currency.gold', amount: 2000 }],
    },
    {
        id: 'daily_battle_2', category: 'daily', title: '日常试炼',
        description: '今日赢得2场战斗', event: 'battleWin', target: 2,
        rewards: [{ itemId: 'currency.jade', amount: 50 }],
    },
    {
        id: 'daily_team_1', category: 'daily', title: '临阵点兵',
        description: '今日保存1次阵容', event: 'formationSave', target: 1,
        rewards: [{ itemId: 'currency.crystal', amount: 5 }],
    },

    {
        id: 'achievement_summon_10', category: 'achievement', title: '十方来客',
        description: '累计召唤10名角色', event: 'summon', target: 10,
        rewards: [{ itemId: 'currency.crystal', amount: 20 }],
    },
    {
        id: 'achievement_win_10', category: 'achievement', title: '百战初成',
        description: '累计赢得10场战斗', event: 'battleWin', target: 10,
        rewards: [{ itemId: 'currency.jade', amount: 300 }],
    },
    {
        id: 'achievement_level_20', category: 'achievement', title: '桃李成蹊',
        description: '累计完成20次角色升级', event: 'roleLevelUp', target: 20,
        rewards: [{ itemId: 'currency.gold', amount: 20000 }],
    },
    {
        id: 'achievement_star_3', category: 'achievement', title: '星辉灿然',
        description: '累计完成3次角色升星', event: 'roleStarUp', target: 3,
        rewards: [{ itemId: 'currency.crystal', amount: 50 }],
    },
    {
        id: 'achievement_skill_5', category: 'achievement', title: '融会贯通',
        description: '累计完成5次技能研习', event: 'roleSkillUp', target: 5,
        rewards: [{ itemId: 'consumable.qi-pill', amount: 20 }],
    },
];

const ITEM_NAMES: Record<string, string> = {
    'currency.gold': '金币',
    'currency.jade': '仙玉',
    'currency.crystal': '仙晶',
    'consumable.qi-pill': '聚气丹',
};

export function formatTaskRewards(rewards: readonly ItemAmount[]): string {
    return rewards.map((reward) => `${ITEM_NAMES[String(reward.itemId)] ?? reward.itemId}×${reward.amount}`).join('、');
}
