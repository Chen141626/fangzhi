import { _decorator, Component, EffectAsset, Label, Material, UIRenderer, assetManager, Vec4 } from "cc";
import { EDITOR } from "cc/env";

const { ccclass, property, executeInEditMode } = _decorator;

/** 统一通过 shader 的 speed 参数驱动滚动，不修改节点坐标。 */
@ccclass("LoopMoveTexture")
@executeInEditMode()
export class LoopMoveTexture extends Component {
    @property(EffectAsset)
    effect: EffectAsset = null!;

    @property
    speedUniform: string = "speed";

    @property
    speedX: number = 1;

    @property
    speedY: number = 0;

    @property
    autoPlay: boolean = true;

    @property
    resetOnEnable: boolean = false;

    private _isPlaying = true;
    private _renderer: UIRenderer | null = null;
    private _material: Material | null = null;
    private _needLateRebind = false;
    private _label: Label | null = null;
    private _lastLabelString = "";

    onLoad(): void {
        this._renderer = this.getComponent(UIRenderer);
        this._label = this.getComponent(Label);
        if (this._label) {
            this._lastLabelString = this._label.string || "";
        }
        if (this._renderer) {
            const rendererAny = this._renderer as any;
            this._material = rendererAny.customMaterial || this._renderer.sharedMaterial;
        }
    }

    async onEnable(): Promise<void> {
        await this.bindEffect();
        this._needLateRebind = true;
        this._isPlaying = this.autoPlay;
        if (this.resetOnEnable) this.applySpeed();
    }

    /**
     * 开启/关闭纹理循环移动（便于外部直接调用）。
     */
    loopMoveTexture(enable: boolean): void {
        this._isPlaying = enable;
        this.applySpeed();
    }

    private applySpeed(): void {
        if (!this._material) return;
        if (!this._isPlaying) {
            this._material.setProperty(this.speedUniform, new Vec4(0, 0, 0, 0));
            return;
        }
        this._material.setProperty(this.speedUniform, new Vec4(this.speedX, this.speedY, 0, 0));
    }

    private async bindEffect(): Promise<void> {
        if (!this._renderer) return;
        if (this.effect) {
            this.applyMaterial(this.effect);
            return;
        }

        if (EDITOR) {
            const dbPath = "db://assets/resources/shader/loopTexture/loopMoveTexture.effect";
            const uuid = await Editor.Message.request("asset-db", "query-uuid", dbPath);
            if (!uuid) return;
            assetManager.loadAny({ uuid }, (err: Error | null, effectAsset: EffectAsset) => {
                if (err || !effectAsset || !this.isValid) return;
                this.effect = effectAsset;
                this.applyMaterial(effectAsset);
            });
            return;
        }

        // 运行时从 resources 加载
        assetManager.resources?.load("shader/loopTexture/loopMoveTexture", EffectAsset, (err, effectAsset) => {
            if (err || !effectAsset || !this.isValid) return;
            this.effect = effectAsset;
            this.applyMaterial(effectAsset);
        });
    }

    private applyMaterial(effectAsset: EffectAsset): void {
        if (!this._renderer) return;
        const material = new Material();
        material.initialize({
            effectAsset,
            defines: {
                USE_TEXTURE: true,
            },
        });
        const rendererAny = this._renderer as any;
        rendererAny.customMaterial = material;
        if ("material" in rendererAny) {
            rendererAny.material = material;
        }
        this._renderer.setSharedMaterial(material, 0);
        this._material = material;
        this.applySpeed();
    }

    lateUpdate(): void {
        // Label/Sprite 在部分渲染流程里会在启用后的后续帧重置材质，这里再覆盖一次确保生效。
        if (!this._needLateRebind || !this.effect) return;
        this._needLateRebind = false;
        this.applyMaterial(this.effect);
    }

    update(dt: number): void {
        // Label 文本变化后，强制刷新并下一帧重绑材质，避免旧字符串残留。
        if (this._label) {
            const cur = this._label.string || "";
            if (cur !== this._lastLabelString) {
                this._lastLabelString = cur;
                (this._label as any).markForUpdateRenderData?.(true);
                this._needLateRebind = true;
            }
        }
        // 在编辑器下可实时响应速度改动；运行时也保持参数与面板同步
        this.applySpeed();
    }
}

