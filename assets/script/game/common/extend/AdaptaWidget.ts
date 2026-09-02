import { _decorator, Component, NodeEventType, Sprite, UITransform, Widget } from 'cc';
const { ccclass, executeInEditMode, requireComponent } = _decorator;

@ccclass('AdaptaWidget')
@executeInEditMode()
@requireComponent(Sprite)
export class AdaptaWidget extends Component {
    private _sprite: Sprite | null = null;
    private _uiTransform: UITransform | null = null;
    private _widget: Widget | null = null;

    onEnable() {
        this.cacheComponents();
        this.bindEvents();
        this.refreshLayout();
    }

    onDisable() {
        this.unbindEvents();
    }

    private cacheComponents() {
        this._sprite = this.getComponent(Sprite);
        this._uiTransform = this.getComponent(UITransform);
        this._widget = this.getComponent(Widget);
    }

    private bindEvents() {
        this.node.on(NodeEventType.SIZE_CHANGED, this.refreshLayout, this);
        this.node.on(NodeEventType.PARENT_CHANGED, this.onParentChanged, this);
        this.node.parent?.on(NodeEventType.SIZE_CHANGED, this.refreshLayout, this);
    }

    private unbindEvents() {
        this.node.off(NodeEventType.SIZE_CHANGED, this.refreshLayout, this);
        this.node.off(NodeEventType.PARENT_CHANGED, this.onParentChanged, this);
        this.node.parent?.off(NodeEventType.SIZE_CHANGED, this.refreshLayout, this);
    }

    private onParentChanged() {
        this.unbindEvents();
        this.bindEvents();
        this.refreshLayout();
    }

    private refreshLayout() {
        if (!this._sprite || !this._uiTransform) return;
        const spriteFrame = this._sprite.spriteFrame;
        if (!spriteFrame) return;

        const parent = this.node.parent;
        const parentTransform = parent?.getComponent(UITransform);
        if (!parentTransform) return;

        const source = spriteFrame.originalSize;
        const sourceW = source.width;
        const sourceH = source.height;
        if (sourceW <= 0 || sourceH <= 0) return;

        let maxW = sourceW;
        let maxH = sourceH;

        if (this._widget) {
            if (this._widget.isAlignLeft && this._widget.isAlignRight) {
                maxW = Math.max(0, parentTransform.width - this._widget.left - this._widget.right);
            } else if (this._widget.isAlignLeft || this._widget.isAlignRight) {
                maxW = Math.max(0, parentTransform.width);
            }

            if (this._widget.isAlignTop && this._widget.isAlignBottom) {
                maxH = Math.max(0, parentTransform.height - this._widget.top - this._widget.bottom);
            } else if (this._widget.isAlignTop || this._widget.isAlignBottom) {
                maxH = Math.max(0, parentTransform.height);
            }
        } else {
            maxW = parentTransform.width;
            maxH = parentTransform.height;
        }

        if (maxW <= 0 || maxH <= 0) return;

        // 使用 cover 策略：等比放大到铺满可用区域，避免出现黑边
        const scale = Math.max(maxW / sourceW, maxH / sourceH);
        const width = sourceW * scale;
        const height = sourceH * scale;
        this._uiTransform.setContentSize(width, height);
    }
}
