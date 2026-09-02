// EllipseController.ts
import { _decorator, Component, Graphics, Vec2, Color, CCFloat, UITransform, Size, NodeEventType } from 'cc';

const { ccclass, property, requireComponent, executeInEditMode } = _decorator;

@ccclass('EllipseController')
@executeInEditMode()
@requireComponent(Graphics)
export class EllipseController extends Component {
    @property(Graphics)
    graphics: Graphics | null = null;

    @property({
        serializable: true
    })
    private _ellipseSize: Vec2 = new Vec2(100, 60);

    @property({
        displayName: "椭圆尺寸",
        type: Vec2,
    })
    get ellipseSize(): Vec2 {
        return this._ellipseSize;
    }
    set ellipseSize(value: Vec2) {
        this._ellipseSize.set(value);
        this.updateNodeSize();
        this.drawEllipse();
    }

    @property({
        serializable: true
    })
    private _lineWidth: number = 2;

    @property({
        displayName: "线宽",
        type: CCFloat,
    })
    get lineWidth(): number {
        return this._lineWidth;
    }
    set lineWidth(value: number) {
        this._lineWidth = value;
        this.drawEllipse();
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
        this.drawEllipse();
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
        this.drawEllipse();
    }

    @property({
        serializable: true
    })
    private _segments: number = 64;

    @property({
        displayName: "平滑度(线段数)",
        type: CCFloat,
        range: [8, 128, 1]
    })
    get segments(): number {
        return this._segments;
    }
    set segments(value: number) {
        this._segments = value;
        this.drawEllipse();
    }

    start() {
        if (!this.graphics) {
            this.graphics = this.getComponent(Graphics);
        }

        // 监听节点尺寸变化
        this.addNodeSizeListener();

        // 初始化 ellipseSize
        this.syncSizeFromNode();

        this.drawEllipse();
    }

    onEnable() {
        this.addNodeSizeListener();
    }

    onDisable() {
        this.removeNodeSizeListener();
    }

    private addNodeSizeListener() {
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.node.on(NodeEventType.SIZE_CHANGED, this.onNodeSizeChanged, this);
        }
    }

    private removeNodeSizeListener() {
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.node.off(NodeEventType.SIZE_CHANGED, this.onNodeSizeChanged, this);
        }
    }

    private onNodeSizeChanged() {
        this.syncSizeFromNode();
        this.drawEllipse();
    }

    private syncSizeFromNode() {
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            const contentSize = uiTransform.contentSize;
            // 节点尺寸直接等于 ellipseSize
            this._ellipseSize.set(contentSize.width, contentSize.height);
        }
    }

    private updateNodeSize() {
        const uiTransform = this.node.getComponent(UITransform);
        if (uiTransform) {
            // 节点尺寸直接等于 ellipseSize
            uiTransform.contentSize = new Size(this.ellipseSize.x, this.ellipseSize.y);
        }
    }

    private drawEllipse() {
        if (!this.graphics) return;

        // 清除之前的绘制内容
        this.graphics.clear();

        // 设置绘制属性
        this.graphics.lineWidth = this.lineWidth;
        this.graphics.fillColor.set(this.fillColor);
        this.graphics.strokeColor.set(this.strokeColor);

        // 手动绘制平滑椭圆，使用 ellipseSize 的一半作为椭圆的半轴长度
        const { x: a, y: b } = this.ellipseSize;
        const segments = this.segments;
        const centerX = 0;
        const centerY = 0;

        // 椭圆的半轴是 ellipseSize 的一半
        this.graphics.moveTo(centerX + a / 2, centerY);

        for (let i = 1; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const dx = (a / 2) * Math.cos(angle);
            const dy = (b / 2) * Math.sin(angle);
            this.graphics.lineTo(centerX + dx, centerY + dy);
        }

        this.graphics.close(); // 闭合路径
        this.graphics.fill();  // 填充
        this.graphics.stroke(); // 描边
    }

    // 设置椭圆大小
    public setEllipseSize(width: number, height: number) {
        this.ellipseSize.set(width, height);
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
}