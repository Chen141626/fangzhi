import { CCBoolean, Label, UITransform } from 'cc';
import { Enum } from 'cc';
import { _decorator, assetManager, CCInteger, color, Color, Component, EffectAsset, Material, Node, Sprite } from 'cc';
import { EDITOR } from 'cc/env';
const { ccclass, property, executeInEditMode, type } = _decorator;

enum Direction {
    "水平渐变" = 0,
    "垂直渐变" = 1
}

@ccclass('Gradient')
@executeInEditMode()
export class GradientComp extends Component {
    @property({
        type: CCBoolean,
        tooltip: "是否使用多重渐变色",
        serializable: true
    })

    isMultipleGradient: boolean = false;
    @property({
        type: Color,
        visible(this: GradientComp) {
            return !this.isMultipleGradient;
        }
    })
    startColor: Color = color(255, 255, 255, 255);

    @property({
        type: Color,
        visible(this: GradientComp) {
            return !this.isMultipleGradient;
        }
    })
    endColor: Color = color(255, 255, 255, 255);

    @property({
        type: [Color],
        visible(this: GradientComp) {
            return this.isMultipleGradient;
        },
        serializable: true
    })
    multipleColors: Color[] = [];

    @property(EffectAsset)
    effect: EffectAsset = null!;

    @property({
        type: Enum(Direction)
    })
    direction: number = 0;
    isFrist = true;
    async start() {
        if (EDITOR) {
            //@ts-ignore
            const uuid = await Editor.Message.request("asset-db", "query-uuid", `db://assets/resources/shader/Gradient/Gradient.effect`);
            console.log("uuid:", uuid)
            //@ts-ignore
            assetManager.loadAny({ uuid: uuid }, (err: Error | null, effect: EffectAsset) => {
                if (err) {
                    console.error(err);
                    return;
                }
                this.effect = effect
                this.updateMaterial()
            })
        } else {
            this.updateMaterial()
        }
    }
    protected async onEnable() {
        if (EDITOR) {
            //@ts-ignore
            const uuid = await Editor.Message.request("asset-db", "query-uuid", `db://assets/resources/shader/Gradient/Gradient.effect`);
            console.log("uuid:", uuid)
            //@ts-ignore
            assetManager.loadAny({ uuid: uuid }, (err: Error | null, effect: EffectAsset) => {
                if (err) {
                    console.error(err);
                    return;
                }
                this.effect = effect
                this.updateMaterial()
            })
        } else {
            this.updateMaterial()
        }
    }
    protected onDisable(): void {
        this.isFrist = true;
    }
    updateColor(startColor: Color, endColor: Color) {
        this.isMultipleGradient = false;
        this.startColor = startColor
        this.endColor = endColor
        this.updateMaterial()
    }
    updateMultipleColors(colors: Color[]) {
        this.isMultipleGradient = true;
        this.multipleColors = colors;
        this.updateMaterial();
    }
    getFilledColor() {
        let colors = []
        for (let i = 0; i < 4; i++) {
            if (this.multipleColors[i]) {
                colors.push(this.multipleColors[i])
            } else {
                colors[i] = new Color(0, 0, 0, 0);
            }
        }
        return colors
    }
    updateMaterial() {
        let material = new Material()
        material.initialize({ effectAsset: this.effect });
        material.setProperty('startColor', this.startColor);
        material.setProperty('endColor', this.endColor);
        material.setProperty('direction', this.direction);
        material.setProperty('isMultiple', this.isMultipleGradient ? 1.0 : 0.0);
        material.setProperty('colors', this.getFilledColor())

        if (this.getComponent(Sprite)) {
            this.getComponent(Sprite)!.material = material
        }
        if (this.getComponent(Label)) {
            this.getComponent(Label)!.material = material
        }
    }
    update(deltaTime: number) {
        if (this.isFrist) {
            this.isFrist = false;
            this.updateMaterial()
        }
        if (EDITOR)
            this.updateMaterial()
    }
}


