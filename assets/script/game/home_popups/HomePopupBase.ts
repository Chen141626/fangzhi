import { _decorator, BlockInputEvents, CCInteger, Component, EventTouch, Node, warn } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';

const { ccclass, menu, property } = _decorator;

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

/** 主界面活动弹窗的通用关闭控制器。 */
@ccclass('HomePopupBase')
@menu('Game/Home Popups/HomePopupBase')
export class HomePopupBase extends Component {
    @property({ type: CCInteger, tooltip: 'UIConfig 中注册的 UIID' })
    uiId = 0;

    private _closeButton: Node | null = null;

    protected onLoad(): void {
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);

        this._closeButton = findChild(this.node, 'panel/header/btn_close');
        if (!this._closeButton) {
            warn(`[HomePopupBase] ${this.node.name} 缺少 panel/header/btn_close。`);
            return;
        }
        this._closeButton.on(Node.EventType.TOUCH_END, this.onClose, this);
    }

    protected onDestroy(): void {
        this._closeButton?.off(Node.EventType.TOUCH_END, this.onClose, this);
    }

    private onClose(event: EventTouch): void {
        event.propagationStopped = true;
        if (this.uiId > 0) oops.gui.remove(this.uiId, false);
    }
}
