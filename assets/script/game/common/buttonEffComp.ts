import { v3 } from 'cc';
import { Tween } from 'cc';
import { _decorator, Component, Node, tween, Vec3, Button } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('buttonEffComp')
export class buttonEffComp extends Component {

    /** 初始点击阈值 */
    private _defScale:number = 1.15;
    private _defTime:number = 0.15;
    private _tw!:Tween<Node>;

    protected start(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    private onTouchStart():void {
        if (!this.isValid)return;
        this.node.scale = v3(1,1,1);
        this._tw = tween(this.node)
        this._tw.to(0.02, { scale: new Vec3(.9, 0.9, 1) }, { easing: "expoOut" }).start();
    }

    private onTouchCancel():void {
        if (!this.isValid)return;
        this._tw&&this._tw.stop();
        this._tw = tween(this.node);
        let _curScale = this._defScale;
        let _curTime = this._defTime*0.75;

        while(_curScale != 1) {
            let curV3:Vec3 = v3(_curScale, _curScale, _curScale);
            this._tw.to(_curTime*(1 - Math.abs(_curScale-1)), {scale: curV3}, { easing: "circInOut" });
            _curTime = _curTime*0.8;
            if(Math.abs(1 - _curScale) < 0.02) {
                _curScale = 1;
            } else {
                _curScale = 1 + Math.abs(1 - _curScale) * (0.2 + 0.3*Math.random()) * (_curScale < 1 ? 1 : -1)
            }
            
        }
        this._tw.start();
    }
    
    private onTouchEnd():void {
        if (!this.isValid)return;
        this._tw&&this._tw.stop();
        this._tw = tween(this.node);
        let _curScale = this._defScale;
        let _curTime = this._defTime;
        while(_curScale != 1) {
            let curV3:Vec3 = v3(_curScale, _curScale, _curScale);
            this._tw.to(_curTime*(1 - Math.abs(_curScale-1)), {scale: curV3}, { easing: "circInOut" });
            _curTime = _curTime*0.8;
            if(Math.abs(1 - _curScale) < 0.02) {
                _curScale = 1;
            } else {
                _curScale = 1 + Math.abs(1 - _curScale) * (0.4 + 0.3*Math.random()) * (_curScale < 1 ? 1 : -1)
            }
            
        }
        this._tw.start();
    }
}


