import { director } from 'cc';
import { UITransform } from 'cc';
import { Director } from 'cc';
import { Layout } from 'cc';
import { _decorator, Component, Node } from 'cc';
const { ccclass, property, requireComponent, executeInEditMode } = _decorator;


@ccclass('LayoutGridCentered')
@requireComponent(Layout)
@executeInEditMode
export class LayoutGridCentered extends Component {
    protected onEnable(): void {
        this._addEventListeners()
    }
    protected onDisable(): void {
        this._removeEventListeners()
    }
    private _addEventListeners() {
        director.on(Director.EVENT_AFTER_UPDATE, this.updateLayout, this);
        this.node.on('childrenSiblingOrderChanged', this.updateLayout, this);
    }
    private _removeEventListeners() {
        director.off(Director.EVENT_AFTER_UPDATE, this.updateLayout, this);
        this.node.off('childrenSiblingOrderChanged', this.updateLayout, this);
    }
    updateLayout() {
        let layout = this.getComponent(Layout)!;
        if (layout.type == Layout.Type.GRID && layout.resizeMode == Layout.ResizeMode.CONTAINER) {
            if (layout.startAxis == Layout.AxisDirection.HORIZONTAL) {
                this.updateH()
            } else if (layout.startAxis == Layout.AxisDirection.VERTICAL) {
                this.updateV()
            }
        }
    }
    updateH() {
        let layout = this.getComponent(Layout)!;
        let childrenW = 0
        for (let child of layout.node.children) {
            if (child.active == false) {
                continue
            }
            if (layout.affectedByScale) {
                childrenW += child.getComponent(UITransform)!.width * child.getScale().x + layout.spacingX
            } else {
                childrenW += child.getComponent(UITransform)!.width + layout.spacingX
            }
            if (childrenW - layout.spacingX > this.node.getComponent(UITransform)!.width) {
                if (layout.affectedByScale) {
                    childrenW -= child.getComponent(UITransform)!.width * child.getScale().x + layout.spacingX
                } else {
                    childrenW -= child.getComponent(UITransform)!.width + layout.spacingX
                }
                break
            }
        }
        childrenW -= layout.spacingX;
        layout.paddingLeft = (this.node.getComponent(UITransform)!.width - childrenW) / 2
        layout.paddingRight = layout.paddingLeft;
    }
    updateV() {
        let layout = this.getComponent(Layout)!;
        let childrenH = 0
        for (let child of layout.node.children) {
            if (child.active == false) {
                continue
            }
            if (layout.affectedByScale) {
                childrenH += child.getComponent(UITransform)!.height * child.getScale().y + layout.spacingY
            } else {
                childrenH += child.getComponent(UITransform)!.height + layout.spacingY
            }
            if (childrenH - layout.spacingY > this.node.getComponent(UITransform)!.height) {
                if (layout.affectedByScale) {
                    childrenH -= child.getComponent(UITransform)!.height * child.getScale().y + layout.spacingY
                } else {
                    childrenH -= child.getComponent(UITransform)!.height + layout.spacingY
                }
                break
            }
        }
        childrenH -= layout.spacingY;
        layout.paddingTop = (this.node.getComponent(UITransform)!.height - childrenH) / 2
        layout.paddingBottom = layout.paddingTop;
    }
}

