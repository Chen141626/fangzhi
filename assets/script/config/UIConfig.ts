import { LayerType, UIConfig } from 'db://oops-framework/core/gui/layer/LayerManager';

/** 项目界面的唯一编号。新增界面在此注册。 */
export enum UIID {
    Main = 1,
    Role = 2,
    SevenDayLogin = 3,
    DailyWelfare = 4,
    LimitedTimeEvents = 5,
    ServerOpeningRanking = 6,
    BestValueGiftPacks = 7,
    ImmortalFateEncounter = 8,
    GrowthFund = 9,
    CumulativeRechargeRewards = 10,
    Battle = 11,
}

/** 路径相对于对应的 Asset Bundle，关闭时保留页面供下次复用。 */
export const UIConfigData: Record<number, UIConfig> = {
    [UIID.Main]: { layer: LayerType.UI, bundle: 'main', prefab: 'prefab/main', destroy: false },
    [UIID.Role]: { layer: LayerType.UI, bundle: 'role', prefab: 'prefab/role', destroy: false },
    [UIID.SevenDayLogin]: {
        layer: LayerType.PopUp,
        bundle: 'home_popups',
        prefab: 'prefab/sevenDayLogin',
        destroy: false,
        mask: true,
    },
    [UIID.DailyWelfare]: popupConfig('dailyWelfare'),
    [UIID.LimitedTimeEvents]: popupConfig('limitedTimeEvents'),
    [UIID.ServerOpeningRanking]: popupConfig('serverOpeningRanking'),
    [UIID.BestValueGiftPacks]: popupConfig('bestValueGiftPacks'),
    [UIID.ImmortalFateEncounter]: popupConfig('immortalFateEncounter'),
    [UIID.GrowthFund]: popupConfig('growthFund'),
    [UIID.CumulativeRechargeRewards]: popupConfig('cumulativeRechargeRewards'),
    [UIID.Battle]: { layer: LayerType.UI, bundle: 'battle', prefab: 'prefab/battle', destroy: false },
};

function popupConfig(prefab: string): UIConfig {
    return {
        layer: LayerType.PopUp,
        bundle: 'home_popups',
        prefab: `prefab/${prefab}`,
        destroy: false,
        mask: true,
    };
}
