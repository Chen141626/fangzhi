// RoundedRectangleController.ts
import { _decorator, Component, Graphics, Color, CCFloat, UITransform, Size, NodeEventType, Enum, Vec2 } from 'cc';
import { EDITOR } from 'cc/env';

const { ccclass, property, requireComponent, executeInEditMode } = _decorator;

enum CornerMode {
    统一圆角 = 0,
    四角圆角 = 1,
}

Enum(CornerMode);

enum GradientDirection {
    Vertical = 0,
    Horizontal = 1,
}

Enum(GradientDirection);

@ccclass('RoundedRectangleShadowLayer')
export class RoundedRectangleShadowLayer {
    @property({
        displayName: "启用阴影层",
    })
    enabled: boolean = true;

    @property({
        displayName: "阴影颜色",
        type: Color,
    })
    color: Color = new Color(0, 0, 0, 96);

    @property({
        displayName: "阴影偏移",
        type: Vec2,
    })
    offset: Vec2 = new Vec2(0, -4);

    @property({
        displayName: "阴影模糊度",
        type: CCFloat,
        range: [0, 60, 1],
    })
    blur: number = 8;
}

@ccclass('RoundedRectangleController')
@executeInEditMode()
@requireComponent(Graphics)
export class RoundedRectangleController extends Component {
    @property(Graphics)
    graphics: Graphics | null = null;
    private _sizeListenerBound = false;
    private _redrawScheduled = false;
    private _lastValidSize: Size = new Size(200, 100);
    private _lastObservedNodeSize: Size = new Size(-1, -1);
    private _lastObservedShadowSignature = "";

    @property({
        serializable: true
    })
    private _contentSize: Size = new Size(200, 100);

    @property({
        displayName: "矩形尺寸",
        type: Size,
    })
    get contentSize(): Size {
        return this._contentSize;
    }
    set contentSize(value: Size) {
        this._contentSize.set(value);
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.contentSize = value;
        }
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _cornerRadius: number = 20;

    @property({
        displayName: "圆角模式",
        type: Enum(CornerMode),
    })
    get cornerMode(): CornerMode {
        return this._cornerMode;
    }
    set cornerMode(value: CornerMode) {
        this._cornerMode = value;
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _cornerMode: CornerMode = CornerMode.统一圆角;

    @property({
        displayName: "圆角半径",
        type: CCFloat,
        range: [0, 100, 1],
        visible(this: RoundedRectangleController) {
            return this._cornerMode === CornerMode.统一圆角;
        }
    })
    get cornerRadius(): number {
        return this._cornerRadius;
    }
    set cornerRadius(value: number) {
        this._cornerRadius = Math.max(0, value);
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _topLeftRadius: number = 20;

    @property({
        serializable: true
    })
    private _topRightRadius: number = 20;

    @property({
        serializable: true
    })
    private _bottomRightRadius: number = 20;

    @property({
        serializable: true
    })
    private _bottomLeftRadius: number = 20;

    @property({
        displayName: "左上圆角",
        type: CCFloat,
        range: [0, 100, 1],
        visible(this: RoundedRectangleController) {
            return this._cornerMode === CornerMode.四角圆角;
        }
    })
    get topLeftRadius(): number {
        return this._topLeftRadius;
    }
    set topLeftRadius(value: number) {
        this._topLeftRadius = Math.max(0, value);
        this.drawRoundedRectangle();
    }

    @property({
        displayName: "右上圆角",
        type: CCFloat,
        range: [0, 100, 1],
        visible(this: RoundedRectangleController) {
            return this._cornerMode === CornerMode.四角圆角;
        }
    })
    get topRightRadius(): number {
        return this._topRightRadius;
    }
    set topRightRadius(value: number) {
        this._topRightRadius = Math.max(0, value);
        this.drawRoundedRectangle();
    }

    @property({
        displayName: "右下圆角",
        type: CCFloat,
        range: [0, 100, 1],
        visible(this: RoundedRectangleController) {
            return this._cornerMode === CornerMode.四角圆角;
        }
    })
    get bottomRightRadius(): number {
        return this._bottomRightRadius;
    }
    set bottomRightRadius(value: number) {
        this._bottomRightRadius = Math.max(0, value);
        this.drawRoundedRectangle();
    }

    @property({
        displayName: "左下圆角",
        type: CCFloat,
        range: [0, 100, 1],
        visible(this: RoundedRectangleController) {
            return this._cornerMode === CornerMode.四角圆角;
        }
    })
    get bottomLeftRadius(): number {
        return this._bottomLeftRadius;
    }
    set bottomLeftRadius(value: number) {
        this._bottomLeftRadius = Math.max(0, value);
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _useGradient: boolean = false;

    @property({
        displayName: "使用渐变填充",
    })
    get useGradient(): boolean {
        return this._useGradient;
    }
    set useGradient(value: boolean) {
        this._useGradient = value;
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _gradientDirection: GradientDirection = GradientDirection.Vertical;

    @property({
        displayName: "渐变方向",
        type: Enum(GradientDirection),
        visible(this: RoundedRectangleController) {
            return this._useGradient;
        }
    })
    get gradientDirection(): GradientDirection {
        return this._gradientDirection;
    }
    set gradientDirection(value: GradientDirection) {
        this._gradientDirection = value;
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _gradientStartColor: Color = new Color(255, 255, 255, 255);

    @property({
        serializable: true
    })
    private _gradientEndColor: Color = new Color(255, 255, 255, 64);

    @property({
        displayName: "渐变起始色",
        type: Color,
        visible(this: RoundedRectangleController) {
            return this._useGradient;
        }
    })
    get gradientStartColor(): Color {
        return this._gradientStartColor;
    }
    set gradientStartColor(value: Color) {
        this._gradientStartColor.set(value);
        this.drawRoundedRectangle();
    }

    @property({
        displayName: "渐变结束色",
        type: Color,
        visible(this: RoundedRectangleController) {
            return this._useGradient;
        }
    })
    get gradientEndColor(): Color {
        return this._gradientEndColor;
    }
    set gradientEndColor(value: Color) {
        this._gradientEndColor.set(value);
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _lineWidth: number = 2;

    @property({
        serializable: true
    })
    private _useShadow: boolean = false;

    @property({
        displayName: "使用阴影",
    })
    get useShadow(): boolean {
        return this._useShadow;
    }
    set useShadow(value: boolean) {
        this._useShadow = value;
        this.drawRoundedRectangle();
    }

    @property({
        displayName: "阴影层列表",
        type: [RoundedRectangleShadowLayer],
        visible(this: RoundedRectangleController) {
            return this._useShadow;
        }
    })
    shadowLayers: RoundedRectangleShadowLayer[] = [new RoundedRectangleShadowLayer()];

    @property({
        displayName: "线宽",
        type: CCFloat,
    })
    get lineWidth(): number {
        return this._lineWidth;
    }
    set lineWidth(value: number) {
        this._lineWidth = value;
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _fillColor: Color = new Color(255, 255, 255, 128);

    @property({
        displayName: "填充颜色",
        type: Color,
    })
    get fillColor(): Color {
        return this._fillColor;
    }
    set fillColor(value: Color) {
        this._fillColor.set(value);
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _strokeColor: Color = new Color(255, 255, 255, 255);

    @property({
        displayName: "描边颜色",
        type: Color,
    })
    get strokeColor(): Color {
        return this._strokeColor;
    }
    set strokeColor(value: Color) {
        this._strokeColor.set(value);
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _vertexConvexArcCenters: boolean = false;

    @property({
        displayName: "内凹弧圆心在角点",
        tooltip: "开启：内凹 90° 小弧的圆心落在矩形四个顶点（直角处）。关闭：圆心沿对角内移 (r,r)，与旧版一致。内凹模式与此无关，凹弧圆心必须内移，否则会穿出矩形。",
    })
    get vertexConvexArcCenters(): boolean {
        return this._vertexConvexArcCenters;
    }
    set vertexConvexArcCenters(value: boolean) {
        this._vertexConvexArcCenters = value;
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _concaveCorners: boolean = false;

    @property({
        displayName: "内凹圆角",
        tooltip: "圆角向矩形内部凹陷。凹弧圆心在对角内移（到角点距离 r√2），不能放在角顶，否则 270° 大弧会先穿出矩形底/侧边。开启时描边会先画再填充，减轻角部白斑。",
    })
    get concaveCorners(): boolean {
        return this._concaveCorners;
    }
    set concaveCorners(value: boolean) {
        this._concaveCorners = value;
        this.drawRoundedRectangle();
    }

    @property({
        serializable: true
    })
    private _segments: number = 10;

    @property({
        displayName: "圆角平滑度(线段数)",
        type: CCFloat,
        range: [1, 50, 1]
    })
    get segments(): number {
        return this._segments;
    }
    set segments(value: number) {
        this._segments = Math.max(1, Math.floor(value));
        this.drawRoundedRectangle();
    }

    start() {
        this.ensureGraphics();
        this.addNodeSizeListener();
        this.syncSizeFromNode();
        this.drawRoundedRectangle();
    }

    onEnable() {
        this.ensureGraphics();
        this.addNodeSizeListener();
        this.syncSizeFromNode();
        this.drawRoundedRectangle();
    }

    onDisable() {
        this.removeNodeSizeListener();
        this.ensureGraphics();
        this.graphics?.clear();
    }

    private ensureGraphics() {
        const graphics = this.getComponent(Graphics);
        if (this.graphics !== graphics) {
            this.graphics = graphics;
        }
    }

    private addNodeSizeListener() {
        if (this._sizeListenerBound) {
            return;
        }
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.node.on(NodeEventType.SIZE_CHANGED, this.onNodeSizeChanged, this);
            this._sizeListenerBound = true;
        }
    }

    private removeNodeSizeListener() {
        if (!this._sizeListenerBound) {
            return;
        }
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.node.off(NodeEventType.SIZE_CHANGED, this.onNodeSizeChanged, this);
        }
        this._sizeListenerBound = false;
    }

    private onNodeSizeChanged() {
        this.syncSizeFromNode();
        this.requestRedraw();
    }

    private syncSizeFromNode() {
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            const contentSize = uiTransform.contentSize;
            if (contentSize.width > 0 && contentSize.height > 0) {
                this._contentSize.set(contentSize.width, contentSize.height);
                this._lastValidSize.set(contentSize.width, contentSize.height);
            }
        }
    }

    private requestRedraw() {
        if (this._redrawScheduled) {
            return;
        }
        this._redrawScheduled = true;
        this.scheduleOnce(() => {
            this._redrawScheduled = false;
            this.drawRoundedRectangle();
        }, 0);
    }

    protected update() {
        if (!EDITOR) {
            return;
        }
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) {
            return;
        }
        const size = uiTransform.contentSize;
        if (size.width !== this._lastObservedNodeSize.width || size.height !== this._lastObservedNodeSize.height) {
            this._lastObservedNodeSize.set(size.width, size.height);
            this.syncSizeFromNode();
            this.requestRedraw();
        }

        const shadowSignature = this.buildShadowSignature();
        if (shadowSignature !== this._lastObservedShadowSignature) {
            this._lastObservedShadowSignature = shadowSignature;
            this.requestRedraw();
        }
    }

    private buildShadowSignature(): string {
        const layers = this.shadowLayers || [];
        const layersSignature = layers.map((layer) => {
            if (!layer) {
                return "null";
            }
            return [
                layer.enabled ? 1 : 0,
                layer.color.r,
                layer.color.g,
                layer.color.b,
                layer.color.a,
                layer.offset.x,
                layer.offset.y,
                layer.blur,
            ].join(",");
        }).join("|");

        return `${this._useShadow ? 1 : 0}#${layers.length}#${layersSignature}`;
    }

    protected onValidate() {
        this._lastObservedShadowSignature = this.buildShadowSignature();
        if (EDITOR) {
            // 删除/新增数组元素时，编辑器调度偶发不触发 scheduleOnce，直接重绘更稳定
            this.drawRoundedRectangle();
            return;
        }
        this.requestRedraw();
    }

    private drawRoundedRectangle() {
        this.ensureGraphics();
        if (!this.graphics) return;

        const uiTransform = this.node.getComponent(UITransform);
        const nodeSize = uiTransform?.contentSize;
        let width = (nodeSize && nodeSize.width > 0) ? nodeSize.width : this.contentSize.width;
        let height = (nodeSize && nodeSize.height > 0) ? nodeSize.height : this.contentSize.height;

        if (width > 0 && height > 0) {
            this._lastValidSize.set(width, height);
        } else {
            width = this._lastValidSize.width;
            height = this._lastValidSize.height;
        }

        // 如果宽高为0则不绘制
        if (width <= 0 || height <= 0) return;

        // 清除之前的绘制内容
        this.graphics.clear();

        // 设置绘制属性
        this.graphics.lineWidth = this.lineWidth;
        this.graphics.strokeColor.set(this.strokeColor);
        if (this._concaveCorners) {
            // 内凹大弧与直线衔接处用圆角连接，减轻斜接在角上像「白块」的错觉
            this.graphics.lineJoin = Graphics.LineJoin.ROUND;
        }

        // 获取节点的锚点并根据锚点计算矩形位置
        const anchorX = uiTransform ? uiTransform.anchorX : 0.5;
        const anchorY = uiTransform ? uiTransform.anchorY : 0.5;
        const x = -width * anchorX;  // 根据锚点计算x坐标
        const y = -height * anchorY; // 根据锚点计算y坐标

        const radii = this.getClampedCornerRadii(width, height);

        if (this.useShadow) {
            this.drawShadows(x, y, width, height, radii);
        }

        // 内凹时路径局部为顺时针弧，先描边再填充会让填充盖住线宽在形内的半边，避免默认白描边叠在黄底上像四个白圆
        const underStrokeConcave = this._concaveCorners && this.lineWidth > 1e-4;
        if (underStrokeConcave) {
            this.drawRoundedPath(x, y, width, height, radii);
            this.graphics.stroke();
        }

        if (this.useGradient) {
            this.drawGradientFill(x, y, width, height, radii, this._concaveCorners);
        } else {
            this.graphics.fillColor.set(this.fillColor);
            this.drawRoundedPath(x, y, width, height, radii);
            this.graphics.fill();
        }

        if (!underStrokeConcave) {
            this.drawRoundedPath(x, y, width, height, radii);
            this.graphics.stroke();
        }
    }

    private getClampedCornerRadii(width: number, height: number) {
        let topLeft = this._cornerMode === CornerMode.统一圆角 ? this.cornerRadius : this.topLeftRadius;
        let topRight = this._cornerMode === CornerMode.统一圆角 ? this.cornerRadius : this.topRightRadius;
        let bottomRight = this._cornerMode === CornerMode.统一圆角 ? this.cornerRadius : this.bottomRightRadius;
        let bottomLeft = this._cornerMode === CornerMode.统一圆角 ? this.cornerRadius : this.bottomLeftRadius;

        return this.clampCornerRadii(width, height, topLeft, topRight, bottomRight, bottomLeft);
    }

    private clampCornerRadii(
        width: number,
        height: number,
        topLeft: number,
        topRight: number,
        bottomRight: number,
        bottomLeft: number
    ) {
        if (width <= 0 || height <= 0) {
            return {
                topLeft: 0,
                topRight: 0,
                bottomRight: 0,
                bottomLeft: 0,
            };
        }

        const maxRadius = Math.min(width, height) / 2;
        topLeft = Math.min(topLeft, maxRadius);
        topRight = Math.min(topRight, maxRadius);
        bottomRight = Math.min(bottomRight, maxRadius);
        bottomLeft = Math.min(bottomLeft, maxRadius);

        const topScale = (topLeft + topRight) > width ? width / (topLeft + topRight) : 1;
        const bottomScale = (bottomLeft + bottomRight) > width ? width / (bottomLeft + bottomRight) : 1;
        const leftScale = (topLeft + bottomLeft) > height ? height / (topLeft + bottomLeft) : 1;
        const rightScale = (topRight + bottomRight) > height ? height / (topRight + bottomRight) : 1;
        const scale = Math.min(topScale, bottomScale, leftScale, rightScale, 1);

        return {
            topLeft: topLeft * scale,
            topRight: topRight * scale,
            bottomRight: bottomRight * scale,
            bottomLeft: bottomLeft * scale,
        };
    }

    private drawShadows(
        x: number,
        y: number,
        width: number,
        height: number,
        radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number; }
    ) {
        if (!this.graphics || !this.shadowLayers || this.shadowLayers.length === 0) {
            return;
        }

        for (const layer of this.shadowLayers) {
            if (!layer || !layer.enabled || layer.color.a <= 0) {
                continue;
            }
            this.drawSingleShadowLayer(x, y, width, height, radii, layer);
        }
    }

    private drawSingleShadowLayer(
        x: number,
        y: number,
        width: number,
        height: number,
        radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number; },
        layer: RoundedRectangleShadowLayer
    ) {
        if (!this.graphics) {
            return;
        }

        const blur = Math.max(0, layer.blur);
        if (blur <= 0.001) {
            this.graphics.fillColor.set(layer.color.r, layer.color.g, layer.color.b, layer.color.a);
            this.drawRoundedPath(
                x + layer.offset.x,
                y + layer.offset.y,
                width,
                height,
                radii
            );
            this.graphics.fill();
            return;
        }

        // 使用高采样 + 高斯权重，减少分层条带感
        const passes = Math.max(16, Math.ceil(blur * 4));
        const sigma = 0.42;
        const sigma2 = 2 * sigma * sigma;
        let totalWeight = 0;
        for (let i = 0; i <= passes; i++) {
            const t = i / passes;
            totalWeight += Math.exp(-(t * t) / sigma2);
        }

        for (let i = passes; i >= 0; i--) {
            const t = i / passes;
            const spread = blur * t;
            const layerX = x + layer.offset.x - spread;
            const layerY = y + layer.offset.y - spread;
            const layerWidth = width + spread * 2;
            const layerHeight = height + spread * 2;

            const layerRadii = this.clampCornerRadii(
                layerWidth,
                layerHeight,
                radii.topLeft + spread,
                radii.topRight + spread,
                radii.bottomRight + spread,
                radii.bottomLeft + spread
            );

            const weight = Math.exp(-(t * t) / sigma2);
            const passAlpha = Math.round((layer.color.a * weight) / totalWeight * 1.25);
            if (passAlpha <= 0) {
                continue;
            }
            this.graphics.fillColor.set(
                layer.color.r,
                layer.color.g,
                layer.color.b,
                Math.min(255, passAlpha)
            );
            this.drawRoundedPath(layerX, layerY, layerWidth, layerHeight, layerRadii);
            this.graphics.fill();
        }
    }

    private drawRoundedPath(
        x: number,
        y: number,
        width: number,
        height: number,
        radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number; }
    ) {
        const { topLeft, topRight, bottomRight, bottomLeft } = radii;
        const left = x;
        const right = x + width;
        const bottom = y;
        const top = y + height;

        this.graphics!.moveTo(left + bottomLeft, bottom);
        this.graphics!.lineTo(right - bottomRight, bottom);
        if (bottomRight > 0) {
            if (this._concaveCorners) {
                this.drawCornerArcSweep(
                    right - bottomRight,
                    bottom + bottomRight,
                    bottomRight,
                    -Math.PI / 2,
                    this.concaveInsetSweep(-Math.PI / 2, 0)
                );
            } else if (this._vertexConvexArcCenters) {
                this.drawCornerArcSweep(right, bottom, bottomRight, Math.PI, -Math.PI / 2);
            } else {
                this.drawCornerArcSweep(right - bottomRight, bottom + bottomRight, bottomRight, -Math.PI / 2, Math.PI / 2);
            }
        }

        this.graphics!.lineTo(right, top - topRight);
        if (topRight > 0) {
            if (this._concaveCorners) {
                this.drawCornerArcSweep(
                    right - topRight,
                    top - topRight,
                    topRight,
                    0,
                    this.concaveInsetSweep(0, Math.PI / 2)
                );
            } else if (this._vertexConvexArcCenters) {
                this.drawCornerArcSweep(right, top, topRight, Math.PI * 1.5, -Math.PI / 2);
            } else {
                this.drawCornerArcSweep(right - topRight, top - topRight, topRight, 0, Math.PI / 2);
            }
        }

        this.graphics!.lineTo(left + topLeft, top);
        if (topLeft > 0) {
            if (this._concaveCorners) {
                this.drawCornerArcSweep(
                    left + topLeft,
                    top - topLeft,
                    topLeft,
                    Math.PI / 2,
                    this.concaveInsetSweep(Math.PI / 2, Math.PI)
                );
            } else if (this._vertexConvexArcCenters) {
                this.drawCornerArcSweep(left, top, topLeft, 0, -Math.PI / 2);
            } else {
                this.drawCornerArcSweep(left + topLeft, top - topLeft, topLeft, Math.PI / 2, Math.PI / 2);
            }
        }

        this.graphics!.lineTo(left, bottom + bottomLeft);
        if (bottomLeft > 0) {
            if (this._concaveCorners) {
                this.drawCornerArcSweep(
                    left + bottomLeft,
                    bottom + bottomLeft,
                    bottomLeft,
                    Math.PI,
                    this.concaveInsetSweep(Math.PI, Math.PI * 1.5)
                );
            } else if (this._vertexConvexArcCenters) {
                this.drawCornerArcSweep(left, bottom, bottomLeft, Math.PI / 2, -Math.PI / 2);
            } else {
                this.drawCornerArcSweep(left + bottomLeft, bottom + bottomLeft, bottomLeft, Math.PI, Math.PI / 2);
            }
        }
        this.graphics!.close();
    }

    private drawGradientFill(
        x: number,
        y: number,
        width: number,
        height: number,
        radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number; },
        concaveCorners: boolean
    ) {
        if (!this.graphics) return;
        const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
        const overlap = 0.6 / pixelRatio;
        const outlineSeg = concaveCorners
            ? Math.max(24, Math.ceil(this.segments * 3))
            : this.segments;
        const concaveOutline = concaveCorners
            ? this.buildRoundedRectOutlinePolyline(x, y, width, height, radii, true, outlineSeg)
            : null;

        if (this.gradientDirection === GradientDirection.Vertical) {
            const steps = Math.max(8, Math.ceil(height * pixelRatio * 1.5));
            for (let i = 0; i < steps; i++) {
                const t0 = i / steps;
                const t1 = (i + 1) / steps;
                const rawY0 = y + height * t0;
                const rawY1 = y + height * t1;
                const y0 = Math.max(y, rawY0 - overlap);
                const y1 = Math.min(y + height, rawY1 + overlap);
                const sampleY = y + height * (t0 + t1) * 0.5;
                const spans = concaveOutline
                    ? this.horizontalLinePolygonSpans(sampleY, x, y, height, concaveOutline)
                    : (() => {
                        const s = this.getHorizontalSpanAtY(sampleY, x, y, width, height, radii);
                        return s ? [s] : [];
                    })();
                if (spans.length === 0) continue;
                this.graphics.fillColor.set(this.lerpColor(this.gradientStartColor, this.gradientEndColor, (t0 + t1) * 0.5));
                for (const span of spans) {
                    this.graphics.moveTo(span.left, y0);
                    this.graphics.lineTo(span.right, y0);
                    this.graphics.lineTo(span.right, y1);
                    this.graphics.lineTo(span.left, y1);
                    this.graphics.close();
                    this.graphics.fill();
                }
            }
            return;
        }

        const steps = Math.max(8, Math.ceil(width * pixelRatio * 1.5));
        for (let i = 0; i < steps; i++) {
            const t0 = i / steps;
            const t1 = (i + 1) / steps;
            const rawX0 = x + width * t0;
            const rawX1 = x + width * t1;
            const x0 = Math.max(x, rawX0 - overlap);
            const x1 = Math.min(x + width, rawX1 + overlap);
            const sampleX = x + width * (t0 + t1) * 0.5;
            const spans = concaveOutline
                ? this.verticalLinePolygonSpans(sampleX, x, y, width, concaveOutline)
                : (() => {
                    const s = this.getVerticalSpanAtX(sampleX, x, y, width, height, radii);
                    return s ? [s] : [];
                })();
            if (spans.length === 0) continue;
            this.graphics.fillColor.set(this.lerpColor(this.gradientStartColor, this.gradientEndColor, (t0 + t1) * 0.5));
            for (const span of spans) {
                this.graphics.moveTo(x0, span.top);
                this.graphics.lineTo(x1, span.top);
                this.graphics.lineTo(x1, span.bottom);
                this.graphics.lineTo(x0, span.bottom);
                this.graphics.close();
                this.graphics.fill();
            }
        }
    }

    /** 与 drawRoundedPath 一致的闭合轮廓（仅用于渐变扫描），不含重复首点 */
    private buildRoundedRectOutlinePolyline(
        x: number,
        y: number,
        width: number,
        height: number,
        radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number; },
        concave: boolean,
        arcSegments: number
    ): Vec2[] {
        const { topLeft, topRight, bottomRight, bottomLeft } = radii;
        const left = x;
        const right = x + width;
        const bottom = y;
        const top = y + height;
        const poly: Vec2[] = [];

        const pushArcSweep = (
            cx: number,
            cy: number,
            r: number,
            startAngle: number,
            sweep: number,
            skipFirst: boolean
        ) => {
            poly.push(...this.sampleArcToPolylineSweep(cx, cy, r, startAngle, sweep, arcSegments, skipFirst));
        };

        poly.push(new Vec2(left + bottomLeft, bottom));
        poly.push(new Vec2(right - bottomRight, bottom));
        if (bottomRight > 0) {
            if (concave) {
                pushArcSweep(
                    right - bottomRight,
                    bottom + bottomRight,
                    bottomRight,
                    -Math.PI / 2,
                    this.concaveInsetSweep(-Math.PI / 2, 0),
                    true
                );
            } else if (this._vertexConvexArcCenters) {
                pushArcSweep(right, bottom, bottomRight, Math.PI, -Math.PI / 2, true);
            } else {
                pushArcSweep(right - bottomRight, bottom + bottomRight, bottomRight, -Math.PI / 2, Math.PI / 2, true);
            }
        }
        poly.push(new Vec2(right, top - topRight));
        if (topRight > 0) {
            if (concave) {
                pushArcSweep(right - topRight, top - topRight, topRight, 0, this.concaveInsetSweep(0, Math.PI / 2), true);
            } else if (this._vertexConvexArcCenters) {
                pushArcSweep(right, top, topRight, Math.PI * 1.5, -Math.PI / 2, true);
            } else {
                pushArcSweep(right - topRight, top - topRight, topRight, 0, Math.PI / 2, true);
            }
        }
        poly.push(new Vec2(left + topLeft, top));
        if (topLeft > 0) {
            if (concave) {
                pushArcSweep(
                    left + topLeft,
                    top - topLeft,
                    topLeft,
                    Math.PI / 2,
                    this.concaveInsetSweep(Math.PI / 2, Math.PI),
                    true
                );
            } else if (this._vertexConvexArcCenters) {
                pushArcSweep(left, top, topLeft, 0, -Math.PI / 2, true);
            } else {
                pushArcSweep(left + topLeft, top - topLeft, topLeft, Math.PI / 2, Math.PI / 2, true);
            }
        }
        poly.push(new Vec2(left, bottom + bottomLeft));
        if (bottomLeft > 0) {
            if (concave) {
                pushArcSweep(
                    left + bottomLeft,
                    bottom + bottomLeft,
                    bottomLeft,
                    Math.PI,
                    this.concaveInsetSweep(Math.PI, Math.PI * 1.5),
                    true
                );
            } else if (this._vertexConvexArcCenters) {
                pushArcSweep(left, bottom, bottomLeft, Math.PI / 2, -Math.PI / 2, true);
            } else {
                pushArcSweep(left + bottomLeft, bottom + bottomLeft, bottomLeft, Math.PI, Math.PI / 2, true);
            }
        }
        const f = poly[0];
        const last = poly[poly.length - 1];
        if (poly.length > 1 && Vec2.distance(f, last) < 1e-3) {
            poly.pop();
        }
        return poly;
    }

    /** 内凹时沿用「内移圆心」两端角之间的逆时针小弧张角，对应顺时针大弧扫角 */
    private concaveInsetSweep(startAngle: number, endAngle: number): number {
        const minor = this.minorCCWArcSpan(startAngle, endAngle);
        return -(2 * Math.PI - minor);
    }

    private sampleArcToPolylineSweep(
        cx: number,
        cy: number,
        r: number,
        startAngle: number,
        sweep: number,
        segments: number,
        skipFirst: boolean
    ): Vec2[] {
        const arcLen = Math.abs(sweep);
        const arcSeg = Math.max(
            segments,
            Math.ceil(segments * arcLen / (Math.PI / 2))
        );
        const inc = sweep / arcSeg;
        const out: Vec2[] = [];
        const i0 = skipFirst ? 1 : 0;
        for (let i = i0; i <= arcSeg; i++) {
            const ang = startAngle + inc * i;
            out.push(new Vec2(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r));
        }
        return out;
    }

    private dedupeSorted(xs: number[], tol: number): number[] {
        const u: number[] = [];
        for (const v of xs) {
            if (u.length === 0 || Math.abs(v - u[u.length - 1]) > tol) {
                u.push(v);
            }
        }
        return u;
    }

    private segIntersectHorizontalY(x0: number, y0: number, x1: number, y1: number, sy: number): number | null {
        const dy = y1 - y0;
        if (Math.abs(dy) < 1e-12) {
            return null;
        }
        const t = (sy - y0) / dy;
        if (t < -1e-9 || t > 1 + 1e-9) {
            return null;
        }
        return x0 + t * (x1 - x0);
    }

    private segIntersectVerticalX(x0: number, y0: number, x1: number, y1: number, sx: number): number | null {
        const dx = x1 - x0;
        if (Math.abs(dx) < 1e-12) {
            return null;
        }
        const t = (sx - x0) / dx;
        if (t < -1e-9 || t > 1 + 1e-9) {
            return null;
        }
        return y0 + t * (y1 - y0);
    }

    private pointInPolygon(px: number, py: number, poly: Vec2[]): boolean {
        let inside = false;
        const n = poly.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = poly[i].x;
            const yi = poly[i].y;
            const xj = poly[j].x;
            const yj = poly[j].y;
            const intersect = ((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-20) + xi;
            if (intersect) {
                inside = !inside;
            }
        }
        return inside;
    }

    /** 水平线 y=sampleY 与多边形相交得到的若干 x 区间（形内），避免贴顶底数值用 y 夹紧 */
    private horizontalLinePolygonSpans(
        sampleY: number,
        x: number,
        y: number,
        height: number,
        poly: Vec2[]
    ): { left: number; right: number }[] {
        const bottom = y;
        const top = y + height;
        const sy = Math.min(top - 1e-4, Math.max(bottom + 1e-4, sampleY));
        const xs: number[] = [];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const p0 = poly[i];
            const p1 = poly[(i + 1) % n];
            const hit = this.segIntersectHorizontalY(p0.x, p0.y, p1.x, p1.y, sy);
            if (hit !== null) {
                xs.push(hit);
            }
        }
        xs.sort((a, b) => a - b);
        const uniq = this.dedupeSorted(xs, 1e-3);
        const spans: { left: number; right: number }[] = [];
        for (let i = 0; i < uniq.length - 1; i++) {
            const midx = (uniq[i] + uniq[i + 1]) * 0.5;
            if (this.pointInPolygon(midx, sy, poly)) {
                spans.push({ left: uniq[i], right: uniq[i + 1] });
            }
        }
        return spans;
    }

    private verticalLinePolygonSpans(
        sampleX: number,
        x: number,
        y: number,
        width: number,
        poly: Vec2[]
    ): { top: number; bottom: number }[] {
        const left = x;
        const right = x + width;
        const sx = Math.min(right - 1e-4, Math.max(left + 1e-4, sampleX));
        const ys: number[] = [];
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const p0 = poly[i];
            const p1 = poly[(i + 1) % n];
            const hit = this.segIntersectVerticalX(p0.x, p0.y, p1.x, p1.y, sx);
            if (hit !== null) {
                ys.push(hit);
            }
        }
        ys.sort((a, b) => a - b);
        const uniq = this.dedupeSorted(ys, 1e-3);
        const spans: { top: number; bottom: number }[] = [];
        for (let i = 0; i < uniq.length - 1; i++) {
            const midy = (uniq[i] + uniq[i + 1]) * 0.5;
            if (this.pointInPolygon(sx, midy, poly)) {
                spans.push({ bottom: uniq[i], top: uniq[i + 1] });
            }
        }
        return spans;
    }

    private getHorizontalSpanAtY(
        sampleY: number,
        x: number,
        y: number,
        width: number,
        height: number,
        radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number; }
    ) {
        const top = y + height;
        const bottom = y;
        if (sampleY < bottom || sampleY > top) {
            return null;
        }

        const { topLeft, topRight, bottomRight, bottomLeft } = radii;
        let left = x;
        let right = x + width;

        if (topLeft > 0 && sampleY > top - topLeft) {
            const dy = sampleY - (top - topLeft);
            left = x + topLeft - Math.sqrt(Math.max(0, topLeft * topLeft - dy * dy));
        } else if (bottomLeft > 0 && sampleY < bottom + bottomLeft) {
            const dy = sampleY - (bottom + bottomLeft);
            left = x + bottomLeft - Math.sqrt(Math.max(0, bottomLeft * bottomLeft - dy * dy));
        }

        if (topRight > 0 && sampleY > top - topRight) {
            const dy = sampleY - (top - topRight);
            right = x + width - (topRight - Math.sqrt(Math.max(0, topRight * topRight - dy * dy)));
        } else if (bottomRight > 0 && sampleY < bottom + bottomRight) {
            const dy = sampleY - (bottom + bottomRight);
            right = x + width - (bottomRight - Math.sqrt(Math.max(0, bottomRight * bottomRight - dy * dy)));
        }

        return { left, right };
    }

    private getVerticalSpanAtX(
        sampleX: number,
        x: number,
        y: number,
        width: number,
        height: number,
        radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number; }
    ) {
        const left = x;
        const right = x + width;
        const bottom = y;
        const top = y + height;
        if (sampleX < left || sampleX > right) {
            return null;
        }

        const { topLeft, topRight, bottomRight, bottomLeft } = radii;
        let spanTop = top;
        let spanBottom = bottom;

        if (topLeft > 0 && sampleX < left + topLeft) {
            const dx = sampleX - (left + topLeft);
            spanTop = top - topLeft + Math.sqrt(Math.max(0, topLeft * topLeft - dx * dx));
        } else if (topRight > 0 && sampleX > right - topRight) {
            const dx = sampleX - (right - topRight);
            spanTop = top - topRight + Math.sqrt(Math.max(0, topRight * topRight - dx * dx));
        }

        if (bottomLeft > 0 && sampleX < left + bottomLeft) {
            const dx = sampleX - (left + bottomLeft);
            spanBottom = bottom + bottomLeft - Math.sqrt(Math.max(0, bottomLeft * bottomLeft - dx * dx));
        } else if (bottomRight > 0 && sampleX > right - bottomRight) {
            const dx = sampleX - (right - bottomRight);
            spanBottom = bottom + bottomRight - Math.sqrt(Math.max(0, bottomRight * bottomRight - dx * dx));
        }

        return { top: spanTop, bottom: spanBottom };
    }

    private lerpColor(start: Color, end: Color, t: number): Color {
        const value = Math.min(1, Math.max(0, t));
        return new Color(
            Math.round(start.r + (end.r - start.r) * value),
            Math.round(start.g + (end.g - start.g) * value),
            Math.round(start.b + (end.b - start.b) * value),
            Math.round(start.a + (end.a - start.a) * value),
        );
    }

    /** 从 start 到 end 的逆时针小弧角（0, 2π） */
    private minorCCWArcSpan(startAngle: number, endAngle: number): number {
        const twoPi = Math.PI * 2;
        let d = endAngle - startAngle;
        d = ((d % twoPi) + twoPi) % twoPi;
        return d;
    }

    /**
     * 按给定圆心与张角（弧度，正为逆时针）离散圆弧并 lineTo。
     * 外凸：圆心在矩形角点，sweep = -π/2（顺时针 90° 小弧）；内凹：圆心内移，sweep 为负的大角。
     */
    private drawCornerArcSweep(
        centerX: number,
        centerY: number,
        radius: number,
        startAngle: number,
        sweep: number
    ) {
        const arcLen = Math.abs(sweep);
        const arcSegments = Math.max(
            this.segments,
            Math.ceil(this.segments * arcLen / (Math.PI / 2))
        );
        const inc = sweep / arcSegments;
        for (let i = 1; i <= arcSegments; i++) {
            const angle = startAngle + inc * i;
            const px = centerX + Math.cos(angle) * radius;
            const py = centerY + Math.sin(angle) * radius;
            this.graphics!.lineTo(px, py);
        }
    }

    // 设置矩形尺寸
    public setSize(width: number, height: number) {
        this.contentSize = new Size(width, height);
    }

    // 在尺寸改变时重新绘制以确保锚点位置正确
    protected onRestore() {
        this.scheduleOnce(() => {
            this.drawRoundedRectangle();
        }, 0);
    }

    // 设置圆角半径
    public setCornerRadius(radius: number) {
        this.cornerRadius = radius;
    }

    // 设置线宽
    public setLineWidth(width: number) {
        this.lineWidth = width;
    }

    // 设置填充颜色
    public setFillColor(color: Color) {
        this.fillColor.set(color);
    }

    // 设置描边颜色
    public setStrokeColor(color: Color) {
        this.strokeColor.set(color);
    }

    // 设置圆角平滑度(线段数)
    public setSegments(segments: number) {
        this.segments = segments;
    }
}
