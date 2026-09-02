import { __private } from 'cc';
import { CCInteger } from 'cc';
import { Vec3 } from 'cc';
import { Mask } from 'cc';
import { _decorator, Component, Node } from 'cc';
const { ccclass, property, executeInEditMode, requireComponent } = _decorator;

@ccclass('roundedMask')
@executeInEditMode()
@requireComponent(Mask)
export class roundedMask extends Component {
    mask: Mask = null!;
    @property({
        serializable: true
    })
    _pixel: number = 10;
    @property({
        displayName: "圆角像素",
        type: CCInteger,
    })
    get pixel() {
        return this._pixel
    }
    set pixel(val: number) {
        this._pixel = val;
        this._updateGraphics()
    }
    onLoad() {

        let mask = this.getComponent(Mask)!;
        this.mask = mask;
        if (0 === this.mask.type) {
            //@ts-ignore
            this.mask._updateGraphics = this._updateGraphics.bind(this);
        }
    }
    _updateGraphics() {
        let mask = this.mask;
        //@ts-ignore
        if (!mask._graphics || (mask.type !== 0 && mask.type !== 1)) {
            return;
        }

        const uiTrans = mask.node._uiProps.uiTransformComp!;
        //@ts-ignore
        const graphics = mask._graphics;

        graphics.clear();
        const size = uiTrans.contentSize;
        const width = size.width;
        const height = size.height;
        const ap = uiTrans.anchorPoint;
        const x = -width * ap.x;
        const y = -height * ap.y;

        graphics.roundRect(x, y, width, height, this.pixel);
        graphics.fill();

    }

}

