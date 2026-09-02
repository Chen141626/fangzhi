import { UITransform } from 'cc';
import { Layout } from 'cc';
import { Prefab } from 'cc';
import { tween } from 'cc';
import { Tween } from 'cc';
import { instantiate } from 'cc';
import { Widget } from 'cc';
import { Rect } from 'cc';
import { ScrollView } from 'cc';
import { _decorator, Component, Node } from 'cc';
const { ccclass, property, requireComponent } = _decorator;

function getSelfBoundingBoxToWorld(transform: UITransform): Rect {
    const { width, height } = transform.contentSize;
    const { x, y } = transform.anchorPoint;
    const rect = new Rect(-x * width, -y * height, width, height);
    rect.transformMat4(transform.node.worldMatrix);
    return rect;
}


@ccclass('ScrollViewDC')
@requireComponent(ScrollView)
export class ScrollViewDC extends Component {
    box: Rect = null!;
    onLoad() {
        this.getComponent(Widget)?.updateAlignment()
        this.getComponentInChildren(Widget)?.updateAlignment()
        //提前获取
        this.box = this.node.getComponent(UITransform)!.getBoundingBoxToWorld()
        //滑动过程中刷新
        this.node.on(ScrollView.EventType.SCROLLING, this.updateOpacity, this)
        this.getComponent(ScrollView)?.content?.on(Node.EventType.CHILD_ADDED, this.updateOpacity, this)
    }
    updateOpacity() {
        this.box = getSelfBoundingBoxToWorld(this.node.getComponent(UITransform)!)
        let children = this.getComponent(ScrollView)?.content?.children!
        this.getComponent(ScrollView)?.content?.getComponent(Layout)?.updateLayout()
        for (let child of children) {
            let rect = getSelfBoundingBoxToWorld(child.getComponent(UITransform)!)
            child.opacity = rect.intersects(this.box) ? 255 : 0;
        }
    }
    setList<T>(item: Node | Prefab, infos: T[], func?: (item: Node, info: T) => void, delay = 0) {
        this.getComponent(Widget)?.updateAlignment()
        let content = this.getComponent(ScrollView)?.content!
        if (item instanceof Node && item.parent == content) {
            item.removeFromParent()
        }
        content.destroyAllChildren()
        Tween.stopAllByTarget(content);
        let index = 0
        for (let info of infos) {
            if (delay) {
                tween(content).delay(delay * index).call(() => {
                    this.setitem(item, content, info, func)
                }).start()
            } else {
                this.setitem(item, content, info, func)
            }
            index++
        }
    }
    stopAll() {
        let content = this.getComponent(ScrollView)?.content!
        Tween.stopAllByTarget(content)
    }
    setitem(item: Node | Prefab, content: Node, info: any, func?: (item: Node, info: any) => void) {
        let node = instantiate(item as Prefab)
        node.active = true
        node.parent = content
        if (func) {
            func(node, info)
        }
    }
}
