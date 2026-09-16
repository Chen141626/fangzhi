import { _decorator, Prefab, warn } from 'cc';
import { Root } from 'db://oops-framework/core/Root';
import { oops } from 'db://oops-framework/core/Oops';
import { UIConfigData, UIID } from '../config/UIConfig';

const { ccclass } = _decorator;

/** 主场景入口：框架完成初始化后注册界面，再打开主界面。 */
@ccclass('GameRoot')
export class GameRoot extends Root {
    protected initGui(): void {
        oops.gui.init(UIConfigData);
    }

    protected async run(): Promise<void> {
        // 框架的等待提示与弹窗遮罩从缓存创建，必须先加载再打开业务页面。
        const [wait, mask] = await Promise.all([
            oops.res.loadAsync('resources', 'common/prefab/wait', Prefab),
            oops.res.loadAsync('resources', 'common/prefab/mask', Prefab),
        ]);
        if (!wait || !mask) {
            warn('[GameRoot] 加载公共界面资源失败，请检查 resources/common/prefab。');
            return;
        }
        oops.gui.open(UIID.Main, null, {
            onLoadFailure: () => warn('[GameRoot] 主界面加载失败，请检查 main bundle。'),
        });
    }
}
