import { Sprite } from "cc";
import { CCInteger } from "cc";
import { CCFloat } from "cc";
import { EffectAsset } from "cc";
import { resources } from "cc";
import { CCBoolean } from "cc";
import { Material } from "cc";
import { _decorator } from "cc";
import { Component } from "cc";
const { ccclass, property, executeInEditMode } = _decorator;
property
@ccclass('LightSweep')
// @executeInEditMode
export default class LightSweep extends Component {
    @property({ type: CCFloat, displayName: '扫光宽度' })
    wide: number = 0.2;
    @property({ type: CCFloat, displayName: '扫光速度' })
    speed: number = 1;
    @property({ type: CCFloat, displayName: '扫光亮度' })
    light: number = 1;

    @property({ displayName: '是否持续扫光' })
    sus = true;

    get sustain() {
        return this.sus
    }
    set sustain(val) {
        this.sus = val;
        this._material?.setProperty("sustain", this.sustain ? 1.0 : 0.0);
    }
    @property({ displayName: '是否是斜的' })
    isXie: boolean = true;

    private _time: number = 0.0;
    private _material: Material = null!;

    isonce = false;
    onLoad() {
        let sp = this.node.getComponent(Sprite)!
        // 获取材质
        if (sp) {
            this._material = sp.customMaterial! = new Material();
            this._material.initialize({ effectAsset: resources.get("common/extention/Shader/LShader", EffectAsset) })
            this._material.setProperty('wide', this.wide);
            this._material.setProperty('light', this.light);
            this._material.setProperty("useY", this.isXie ? 1.0 : 0.0)
            this._material.setProperty("sustain", this.sustain ? 1.0 : 0.0);
        }
    }
    startAni() {
        this._time = 0;
        this.sustain = true;
        this.isonce = true;
    }
    update(dt: number) {
        if (this.getComponent(Sprite)?.grayscale) {
            this._material.setProperty('grayscale', 1);
            return
        } else {
            this._material.setProperty('grayscale', 0);
        }
        if (!this.sustain) {
            return
        }
        if (this._time > 2) {
            this._time = 0.0;
            if (this.isonce) {
                this.sustain = false;
            }
        }
        this._material.setProperty('u_time', this._time);
        this._time += dt * this.speed;
    }

    /**
     * 重置材质
     */
    public resetMaterial() {
        if (this.node.getComponent(Sprite)) {
            this._material = this.node.getComponent(Sprite)?.customMaterial!;
            this._material.setProperty('wide', this.wide);
            this._material.setProperty('light', this.light);
        }
    }
}
