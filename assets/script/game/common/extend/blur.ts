import { _decorator, CCFloat, Color, Component, Graphics, NodeEventType, UITransform } from "cc";
import { EDITOR } from "cc/env";

const { ccclass, property, executeInEditMode, requireComponent } = _decorator;

@ccclass("Blur")
@executeInEditMode()
@requireComponent(UITransform)
@requireComponent(Graphics)
export class Blur extends Component {
    @property({
        displayName: "模糊颜色",
        type: Color,
        tooltip: "纯色阴影颜色",
    })
    blurColor: Color = new Color(255, 255, 255, 255);

    @property({
        displayName: "模糊度",
        type: CCFloat,
        tooltip: "值越大越模糊（同 Rounded 的 blur）",
        min: 0,
        max: 60,
        slide: true,
    })
    blurStrength = 8;

    @property({
        displayName: "圆角半径",
        type: CCFloat,
        tooltip: "基础圆角半径",
        min: 0,
        max: 200,
        slide: true,
    })
    cornerRadius = 0;

    private _graphics: Graphics | null = null;
    private _sizeListenerBound = false;

    onEnable(): void {
        this.ensureGraphics();
        this.addSizeListener();
        this.redraw();
    }

    onDisable(): void {
        this.removeSizeListener();
    }

    update(): void {
        if (!EDITOR) return;
        this.redraw();
    }

    protected onValidate(): void {
        this.redraw();
    }

    private ensureGraphics(): void {
        if (this._graphics?.isValid) return;
        this._graphics = this.getComponent(Graphics) ?? this.addComponent(Graphics);
    }

    private addSizeListener(): void {
        if (this._sizeListenerBound) return;
        const ui = this.getComponent(UITransform);
        if (!ui) return;
        ui.node.on(NodeEventType.SIZE_CHANGED, this.redraw, this);
        this._sizeListenerBound = true;
    }

    private removeSizeListener(): void {
        if (!this._sizeListenerBound) return;
        const ui = this.getComponent(UITransform);
        ui?.node.off(NodeEventType.SIZE_CHANGED, this.redraw, this);
        this._sizeListenerBound = false;
    }

    private redraw(): void {
        if (!this._graphics) return;
        const ui = this.getComponent(UITransform);
        if (!ui || ui.width <= 0 || ui.height <= 0) return;

        this._graphics.clear();

        const blur = Math.max(0, this.blurStrength);
        const maxCorner = Math.min(ui.width, ui.height) * 0.5;
        const baseCorner = Math.min(Math.max(0, this.cornerRadius), maxCorner);

        if (blur <= 0.001) {
            this._graphics.fillColor = new Color(this.blurColor.r, this.blurColor.g, this.blurColor.b, this.blurColor.a);
            const r = Math.min(baseCorner, Math.min(ui.width, ui.height) * 0.5);
            const x = -ui.width * 0.5;
            const y = -ui.height * 0.5;
            if (r > 0) {
                this._graphics.roundRect(x, y, ui.width, ui.height, r);
            } else {
                this._graphics.rect(x, y, ui.width, ui.height);
            }
            this._graphics.fill();
            return;
        }

        // 提高采样层数并使用高斯权重，减少分层条带感。
        const passes = Math.max(16, Math.ceil(blur * 4));
        const sigma = 0.42;
        const sigma2 = 2 * sigma * sigma;
        let totalWeight = 0;
        for (let i = 0; i <= passes; i++) {
            const t = i / passes;
            totalWeight += Math.exp(-(t * t) / sigma2);
        }

        // 先画外层再画内层，中心区域更饱满，边缘过渡更平滑。
        for (let i = passes; i >= 0; i--) {
            const t = i / passes;
            const spread = blur * t;
            const weight = Math.exp(-(t * t) / sigma2);
            const passAlpha = Math.round((this.blurColor.a * weight) / totalWeight * 1.25);
            if (passAlpha <= 0) continue;

            this._graphics.fillColor = new Color(
                this.blurColor.r,
                this.blurColor.g,
                this.blurColor.b,
                Math.min(255, passAlpha)
            );

            const w = ui.width + spread * 2;
            const h = ui.height + spread * 2;
            const x = -w * 0.5;
            const y = -h * 0.5;
            const r = Math.min(baseCorner + spread, Math.min(w, h) * 0.5);
            if (r > 0) {
                this._graphics.roundRect(x, y, w, h, r);
            } else {
                this._graphics.rect(x, y, w, h);
            }
            this._graphics.fill();
        }
    }
}
