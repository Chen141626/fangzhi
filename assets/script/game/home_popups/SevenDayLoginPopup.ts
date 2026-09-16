import {
    _decorator,
    BlockInputEvents,
    Color,
    Component,
    EventTouch,
    Node,
    Sprite,
    warn,
} from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';

const { ccclass, menu } = _decorator;

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

/** 七日登录弹窗：负责背景绘制、关闭和首日奖励的演示交互。 */
@ccclass('SevenDayLoginPopup')
@menu('Game/Home Popups/SevenDayLoginPopup')
export class SevenDayLoginPopup extends Component {
    private _closeButton: Node | null = null;
    private _claimButton: Node | null = null;
    private _claimState: Node | null = null;
    private _claimed = false;

    protected onLoad(): void {
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);

        this._closeButton = findChild(this.node, 'panel/header/btn_close');
        this._claimButton = findChild(this.node, 'panel/footer/btn_claim');
        this._claimState = findChild(this.node, 'panel/footer/claim_state');

        if (!this._closeButton || !this._claimButton || !this._claimState) {
            warn('[SevenDayLoginPopup] 弹窗节点结构不完整。');
        }

        this._closeButton?.on(Node.EventType.TOUCH_END, this.onClose, this);
        this._claimButton?.on(Node.EventType.TOUCH_END, this.onClaim, this);
        this.refreshClaimState();
    }

    protected onDestroy(): void {
        this._closeButton?.off(Node.EventType.TOUCH_END, this.onClose, this);
        this._claimButton?.off(Node.EventType.TOUCH_END, this.onClaim, this);
    }

    private onClaim(event: EventTouch): void {
        event.propagationStopped = true;
        if (this._claimed) return;

        this._claimed = true;
        this.refreshClaimState();
    }

    private refreshClaimState(): void {
        if (this._claimState) this._claimState.active = this._claimed;

        const sprite = this._claimButton?.getComponent(Sprite);
        if (sprite) {
            sprite.color = this._claimed
                ? new Color(135, 145, 158, 255)
                : Color.WHITE;
        }
    }

    private onClose(event: EventTouch): void {
        event.propagationStopped = true;
        oops.gui.remove(UIID.SevenDayLogin, false);
    }
}
