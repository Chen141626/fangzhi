import { CCInteger } from 'cc';
import { EffectAsset } from 'cc';
import { CCFloat } from 'cc';
import { Vec4 } from 'cc';
import { SpriteFrame } from 'cc';
import { NodeEventType } from 'cc';
import { renderer } from 'cc';
import { UITransform } from 'cc';
import { Sprite } from 'cc';
import { Material } from 'cc';
import { assetManager } from 'cc';
import { _decorator, Component, Node } from 'cc';
import { EDITOR } from 'cc/env';
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass('roundedcorners')
@executeInEditMode()
export class roundedcorners extends Component {
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
        this.updateMaterial()
    }

    @property({
        serializable: true
    })
    _scale: Vec4 = new Vec4(1, 1, 1, 1)

    @property({
        displayName: "四个角圆角缩放倍率",
        type: Vec4
    })
    get scale() {
        return this._scale
    }
    set scale(val: Vec4) {
        this._scale = val;
        this.updateMaterial()
    }


    @property(EffectAsset)
    effect: EffectAsset = null!;
    @property({
        serializable: true
    })
    _changeBaidi = false;
    @property({
        displayName: "切换为白底图",
        serializable: true
    })
    get changeBaidi() {
        return this._changeBaidi
    }
    set changeBaidi(val: boolean) {
        if (val) {
            this.changeSpriteFrame()
        }
        this._changeBaidi = val
    }
    isFrist = true;
    protected start(): void {
        this.node.on(NodeEventType.SIZE_CHANGED, () => {
            this.updateMaterial()
            this.changeSpriteFrame();
        })
    }
    async changeSpriteFrame() {
        if (EDITOR) {
            const uuid = await Editor.Message.request("asset-db", "query-uuid", `db://assets/resources/gui/common/texture/baidi.png/spriteFrame`);
            assetManager.loadAny({ uuid: uuid || "" }, (err: Error | null, spr: SpriteFrame) => {
                if (err) {
                    console.error(err);
                    return;
                }
                this.getComponent(Sprite)!.spriteFrame = spr
            })
        }
    }
    async onEnable() {
        if (EDITOR) {
            const uuid = await Editor.Message.request("asset-db", "query-uuid", `db://assets/resources/shader/roundedcorners/roundedcorners.effect`);
            assetManager.loadAny({ uuid: uuid || "" }, (err: Error | null, effect: EffectAsset) => {
                if (err) {
                    console.error(err);
                    return;
                }
                this.effect = effect
                this.updateMaterial()
            })
        }
    }
    protected onDisable(): void {
        this.isFrist = true;
    }
    protected lateUpdate(dt: number): void {
        if (this.isFrist) {
            this.isFrist = false;
            this.updateMaterial()
        }
    }
    updateMaterial() {
        let material = new Material()
        material!.initialize({
            effectAsset: this.effect,
            defines: {
                USE_TEXTURE: true
            }
        });
        this.getComponent(Sprite)!.material = material;
        material!.setProperty("width", this.node.getComponent(UITransform)!.width)
        material!.setProperty("height", this.node.getComponent(UITransform)!.height)
        material!.setProperty('roundedType', this.scale);
        material!.setProperty("rounded", this.pixel);
    }
}

