/*
 * @Author: dgflash
 * @Date: 2023-01-30 14:00:41
 * @LastEditors: dgflash
 * @LastEditTime: 2023-02-09 10:54:28
 */
import { Animation, AnimationClip, EventTouch, Node, Sprite, Tween, Vec3, _decorator, tween } from "cc";
import { oops } from "../../../core/Oops";
import ButtonSimple from "./ButtonSimple";

const { ccclass, property, menu } = _decorator;

/** 有特效短按按钮 */
@ccclass("ButtonEffect")
@menu('ui/button/ButtonEffect')
export default class ButtonEffect extends ButtonSimple {
    @property({
        tooltip: "是否开启"
    })
    disabledEffect: boolean = false;

    private anim: Animation | null = null;
    private startClipName = "";
    private endClipName = "";
    private baseScale = new Vec3(1, 1, 1);
    private scaleTween: Tween<Node> | null = null;

    /** 按钮禁用效果 */
    get grayscale(): boolean {
        return this.node.getComponent(Sprite)!.grayscale;
    }
    set grayscale(value: boolean) {
        if (this.node.getComponent(Sprite)) {
            this.node.getComponent(Sprite)!.grayscale = value;
        }
    }

    onLoad() {
        this.baseScale.set(this.node.scale);
        const ac_start = oops.res.get("common/anim/button_scale_start", AnimationClip);
        const ac_end = oops.res.get("common/anim/button_scale_end", AnimationClip);
        if (ac_start || ac_end) {
            this.anim = this.node.getComponent(Animation) ?? this.node.addComponent(Animation);
            if (ac_start) {
                this.startClipName = ac_start.name;
                this.anim.defaultClip = ac_start;
                this.anim.createState(ac_start, this.startClipName);
            }
            if (ac_end) {
                this.endClipName = ac_end.name;
                this.anim.createState(ac_end, this.endClipName);
            }
        }

        this.node.on(Node.EventType.TOUCH_START, this.onTouchtStart, this);

        super.onLoad();
    }

    protected onTouchtStart(event: EventTouch) {
        if (!this.disabledEffect) {
            if (this.anim && this.startClipName) this.anim.play(this.startClipName);
            else this.playScaleFallback(0.94, 0.06);
        }
    }

    protected onTouchEnd(event: EventTouch) {
        if (!this.disabledEffect) {
            if (this.anim && this.endClipName) this.anim.play(this.endClipName);
            else this.playScaleFallback(1, 0.08);
        }

        super.onTouchEnd(event);
    }


    onDestroy() {
        this.scaleTween?.stop();
        this.scaleTween = null;
        this.node.off(Node.EventType.TOUCH_START, this.onTouchtStart, this);
        super.onDestroy();
    }

    private playScaleFallback(scale: number, duration: number) {
        this.scaleTween?.stop();
        const target = new Vec3(
            this.baseScale.x * scale,
            this.baseScale.y * scale,
            this.baseScale.z,
        );
        this.scaleTween = tween(this.node)
            .to(duration, { scale: target }, { easing: "quadOut" })
            .call(() => { this.scaleTween = null; })
            .start();
    }
}
