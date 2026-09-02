import { director } from 'cc';
import { UITransform } from 'cc';
import { CCInteger } from 'cc';
import { Director } from 'cc';
import { Layout } from 'cc';
import { _decorator, Component, Node } from 'cc';
const { ccclass, property, requireComponent, executeInEditMode } = _decorator;


@ccclass('LayoutHCentered')
@requireComponent(Layout)
@executeInEditMode()
export class LayoutHCentered extends Component {

    @property({ type: CCInteger })
    paddingLeft: number = 0;
    @property({ type: CCInteger })
    paddingRight: number = 0;


    protected onEnable(): void {
        this._addEventListeners()
    }
    protected onDisable(): void {
        this._removeEventListeners()
    }
    private _addEventListeners() {
        director.on(Director.EVENT_AFTER_UPDATE, this.updateLayout, this);
        this.node.on('childrenSiblingOrderChanged', this.updateLayout, this);
        this.node.on(Node.EventType.CHILD_ADDED, this.updateLayout, this)
        this.node.on(Node.EventType.CHILD_REMOVED, this.updateLayout, this)
    }
    private _removeEventListeners() {
        director.off(Director.EVENT_AFTER_UPDATE, this.updateLayout, this);
        this.node.off('childrenSiblingOrderChanged', this.updateLayout, this);
        this.node.off(Node.EventType.CHILD_ADDED, this.updateLayout, this)
        this.node.off(Node.EventType.CHILD_REMOVED, this.updateLayout, this)

    }
    updateLayout() {
        let layout = this.getComponent(Layout)!;
        layout.paddingLeft = this.paddingLeft;
        layout.paddingRight = this.paddingRight;
        layout.updateLayout()
        if (this.node.getComponent(UITransform)!.width <= this.node.parent!.getComponent(UITransform)!.width && layout.type == Layout.Type.HORIZONTAL && layout.resizeMode == Layout.ResizeMode.CONTAINER) {
            let w = this.node.parent!.getComponent(UITransform)!.width - (this.node.getComponent(UITransform)!.width - layout.paddingRight - layout.paddingLeft);
            layout.paddingLeft = w / 2
            layout.paddingRight = w / 2
        }
        layout.updateLayout()
    }
}

