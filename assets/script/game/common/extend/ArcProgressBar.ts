import { Component } from "cc";
import { EffectAsset } from "cc";
import { Widget } from "cc";
import { color } from "cc";
import { CCBoolean } from "cc";
import { CCInteger } from "cc";
import { view } from "cc";
import { Color } from "cc";
import { Graphics } from "cc";
import { _decorator } from "cc";
import { CCClass } from "cc";

// const { ccclass, property, requireComponent, executeInEditMode, help, menu } = cc._decorator;
const { ccclass, property, requireComponent, executeInEditMode, help, menu } = _decorator;
@ccclass
@requireComponent(Graphics)
@executeInEditMode
@menu('弧形进度条/ArcProgressBar')
export default class ArcProgressBar extends Component {

    @property(Graphics)
    protected graphics: Graphics = null!;

    @property(CCInteger)
    protected _radius: number = 100;
    @property({ type: CCInteger, tooltip: '半径' })
    public get radius() {
        return this._radius;
    }
    public set radius(value: number) {
        this._radius = value;
        this.updateProperties();
    }
    @property(CCBoolean)
    protected _clockwise: boolean = true;
    @property({ type: CCBoolean, tooltip: '顺时针方向' })
    public get clockwise() {
        return this._clockwise;
    }
    public set clockwise(value: boolean) {
        this._clockwise = value;
        this.updateProperties();
    }
    @property(CCInteger)
    protected _startAngle: number = 90;
    @property({ type: CCInteger, tooltip: '开始角度 (基于 y 轴)' })
    public get startAngle() {
        return this._startAngle;
    }
    public set startAngle(value: number) {
        this._startAngle = value;
        this.updateProperties();
    }

    @property(CCInteger)
    protected _range: number = 180;
    @property({ tooltip: '范围 (角度)' })
    public get range() {
        return this._range;
    }
    public set range(value: number) {
        this._range = value;
        this.updateProperties();
    }

    @property(CCInteger)
    protected _progress: number = 0.4;
    @property({ range: [0, 1], step: 0.01, tooltip: '进度 (0 ~ 1)' })
    public get progress() {
        return this._progress;
    }
    public set progress(value: number) {
        this.updateProgress(value);
    }

    /**
     * 预计算的开始角度
     */
    protected curStartAngle: number = 0;

    /**
     * 预计算的开始弧度
     */
    protected curStartRadians: number = 0;

    /**
     * 预计算的结束弧度
     */
    protected curEndRadians: number = 0;



    /**
     * 生命周期：加载
     */
    protected onLoad() {
        // if (!Editor) {
        //     view.on("canvas-resize", this.updateMaterial.bind(this), this)
        // }
        this.alignment()
        this.scheduleOnce(() => {
            this.alignment()
        })
    }
    alignment() {
        this.getComponent(Widget)?.updateAlignment()
        this.init();
    }
    /**
     * 编辑器回调：重置
     */
    public resetInEditor() {
        this.init();
    }
    protected onDestroy(): void {
        view.off("canvas-resize", this.updateMaterial.bind(this), this)
    }
    /**
     * 初始化
     */
    protected init() {
        if (!this.graphics) {
            this.graphics = this.getComponent(Graphics)!;
        }
        this.updateMaterial();

    }
    updateMaterial() {

        this.updateProperties();
    }

    /**
     * 更新属性
     */
    protected updateProperties() {
        // 设置样式
        // const graphics = this.graphics;

        // 预计算角度
        this.curStartAngle = this._startAngle + 90;
        this.curStartRadians = this.angleToRadians(this.curStartAngle);
        const endAngle = this.curStartAngle + (this._clockwise ? -this._range : this._range);
        this.curEndRadians = this.angleToRadians(endAngle);
        // 重新绘制进度条
        this.updateProgress(this._progress);
    }

    /**
     * 更新进度
     * @param value 进度值（0~1）
     */
    public updateProgress(value: number) {
        // 处理并保存值
        if (value < 0) {
            value = 0;
        } else if (value > 1) {
            value = 1;
        }
        this._progress = value;

        // 清空画布
        const graphics = this.graphics;
        graphics.clear();

        // 计算并画出进度
        const offset = this._clockwise ? -this._range : this._range,
            angle = this.curStartAngle + (offset * value),
            radians = this.angleToRadians(angle);
        // graphics.strokeColor = color(255, 255, 255, 255);
        graphics.arc(0, 0, this._radius, this.curStartRadians, radians, !this._clockwise);
        graphics.stroke();
    }



    /**
     * 角度转弧度
     * @param angle 角度
     */
    public angleToRadians(angle: number) {
        return (Math.PI / 180) * angle;
    }
}
