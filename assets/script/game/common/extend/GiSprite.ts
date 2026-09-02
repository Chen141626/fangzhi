/*******************************************************************************
 * 创建: 2024年08月28日
 * 作者: 水煮肉片饭(27185709@qq.com)
 * 版本: 适配CocosCreator3.8及以上
 * 描述: 对官方Sprite做了功能扩展、性能提升
 *       自变换，位移、旋转、缩放、修改透明度都不影响子节点
 *       调色板，调节色相、暗度
 * 类型支持: 
 *       经典: 普通图
 *       圆角: 圆角矩形，可以设置圆角平滑度、大小、可见性
 *       填充: 支持横向、纵向、径向，对填充参数做了优化
 *       九宫格: 原版功能，对图片宽度小于宫格宽度的情况做了优化
 *       3D旋转: 以锚点为中心3D透视旋转，支持水平、垂直两个方向
 *       纹理循环: 图片位置不变的前提下，纹理循环移动，例如: 地图背景无限循环
*******************************************************************************/
import { _decorator, assetManager, builtinResMgr, CCInteger, clamp, Director, director, Enum, lerp, log, Material, Node, NodeEventType, SpriteAtlas, SpriteFrame, UIRenderer, UITransform, Vec2 } from 'cc';
import { EDITOR, JSB } from 'cc/env';
enum SizeMode { 'CUSTOM: 自定义尺寸', 'TRIMMED: 原始尺寸裁剪透明像素', 'RAW: 图片原始尺寸' }
enum SpriteType { 'SIMPLE: 经典', 'ROUND: 圆角', 'FILLED: 填充', 'SLICED: 九宫格', 'ROTATE: 3D旋转', 'OFFSET: 纹理循环' }
enum FillDir { 'HORIZONTAL: 横向', 'VERTICAL: 纵向', 'RADIAL: 径向' }
const PI180 = Math.PI / 180;
const { ccclass, property, menu } = _decorator;
@ccclass('SelfTransform')
class SelfTransform {
    @property
    private _position: Vec2 = new Vec2(0, 0);
    @property({ displayName: '······位移' })
    get position() { return this._position; }
    set position(val) {
        this._position = val;
        this.sprite.flush();
    }
    @property
    private _angle: number = 0;
    @property({ displayName: '······旋转' })
    get angle() { return this._angle; }
    set angle(val) {
        this._angle = val;
        this.sprite.flush();
    }
    @property
    private _scale: Vec2 = new Vec2(1, 1);
    @property({ displayName: '······缩放' })
    get scale() { return this._scale; }
    set scale(val) {
        this._scale = val;
        this.sprite.flush();
    }
    @property
    private _opacity: number = 1;
    @property({ range: [0, 1], step: 0.01, slide: true, displayName: '······透明度' })
    get opacity() { return this._opacity; }
    set opacity(val) {
        this._opacity = clamp(val, 0, 1);
        this.sprite.updateColor();
    }
    private sprite: Sprite = null!;
}
@ccclass('Corner')
class Corner {
    @property({ displayName: '↙ 左下' })
    leftBottom: boolean = true;
    @property({ displayName: '↘ 右下' })
    rightBottom: boolean = true;
    @property({ displayName: '↖ 左上' })
    leftTop: boolean = true;
    @property({ displayName: '↗ 右上' })
    rightTop: boolean = true;
    visible: boolean[] = null!;
}
@ccclass
@menu('Gi/Sprite')
class Sprite extends UIRenderer {
    @property({ type: SpriteAtlas, readonly: true, editorOnly: true, serializable: false })
    private atlas: SpriteAtlas = null!;
    @property
    private _spriteFrame: SpriteFrame = null!;
    @property({ type: SpriteFrame })
    get spriteFrame() { return this._spriteFrame; }
    set spriteFrame(val) {
        this._spriteFrame = val;
        this.updateSpriteFrame();
        this._spriteType === SpriteType['SLICED: 九宫格'] && this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _sizeMode: SizeMode = SizeMode['TRIMMED: 原始尺寸裁剪透明像素'];
    @property({ type: Enum(SizeMode) })
    get sizeMode() { return this._sizeMode; }
    set sizeMode(val) {
        this._sizeMode = val;
        this.updateSizeMode();
    }
    @property
    private _hueRatio: number = 1;
    @property({ range: [0, 1], step: 0.01, slide: true, displayName: '🌈 色相' })
    get hueRatio() { return this._hueRatio; }
    set hueRatio(val) {
        this._hueRatio = clamp(val, 0, 1);
        this.updateHueRatio();
        this.updateColor();
    }
    @property
    private _brightness: number = 1;
    @property({ range: [0, 1], step: 0.01, slide: true, displayName: '🌞 暗度' })
    get brightness() { return this._brightness; }
    set brightness(val) {
        this._brightness = clamp(val, 0, 1);
        this.updateColor();
    }
    @property({ type: SelfTransform, displayName: '自变换：不影响子节点' })
    selfTrans: SelfTransform = new SelfTransform();
    @property
    private _spriteType: SpriteType = SpriteType['SIMPLE: 经典'];
    @property({ type: Enum(SpriteType), displayName: '🎯 类型' })
    get spriteType() { return this._spriteType; }
    set spriteType(val) {
        this._spriteType = val;
        this.updateSpriteType();
        this.createBuffer();
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property({ displayName: '顶点数 / 三角形数', readonly: true, editorOnly: true, serializable: false })
    private vertexTriangle: Vec2 = new Vec2(0, 0);
    @property
    private _roundSegment: number = 5;
    @property({ type: CCInteger, displayName: '······线段数量', visible(this: Sprite) { return this._spriteType === SpriteType['ROUND: 圆角'] } })
    get roundSegment() { return this._roundSegment; }
    set roundSegment(val) {
        this._roundSegment = Math.max(val, 1);
        this.createBuffer();
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _roundRadius: number = 100;
    @property({ displayName: '······圆角半径', visible(this: Sprite) { return this._spriteType === SpriteType['ROUND: 圆角'] } })
    get roundRadius() { return this._roundRadius; }
    set roundRadius(val) {
        this._roundRadius = Math.max(val, 0);
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _roundCorner: Corner = new Corner();
    @property({ displayName: '······圆角可见性', visible(this: Sprite) { return this._spriteType === SpriteType['ROUND: 圆角'] } })
    private get roundCorner() { return this._roundCorner; }
    private set roundCorner(val) {
        this._roundCorner = val;
        this.updateCorner();
        this.createBuffer();
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _fillDir: FillDir = FillDir['HORIZONTAL: 横向'];
    @property({ type: Enum(FillDir), displayName: '填充方向', visible(this: Sprite) { return this._spriteType === SpriteType['FILLED: 填充'] } })
    get fillDir() { return this._fillDir; }
    set fillDir(val) {
        this._fillDir = val;
        this.createBuffer();
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _fillCenter: Vec2 = new Vec2(0.5, 0.5);
    @property({ displayName: '······中心点', visible(this: Sprite) { return this._spriteType === SpriteType['FILLED: 填充'] && this._fillDir === FillDir['RADIAL: 径向'] } })
    get fillCenter() { return this._fillCenter; }
    set fillCenter(val) {
        this._fillCenter.x = clamp(val.x, 0, 1);
        this._fillCenter.y = clamp(val.y, 0, 1);
        this.updateFillCenter();
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _fillStart: number = 0;
    @property({ range: [0, 1], slide: true, step: 0.01, displayName: '······起始位置', visible(this: Sprite) { return this._spriteType === SpriteType['FILLED: 填充'] && this._fillDir !== FillDir['RADIAL: 径向'] } })
    get fillStart() { return this._fillStart; }
    set fillStart(val) {
        this._fillStart = clamp(val, 0, 1);
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _fillEnd: number = 1;
    @property({ range: [0, 1], slide: true, step: 0.01, displayName: '······结束位置', visible(this: Sprite) { return this._spriteType === SpriteType['FILLED: 填充'] && this._fillDir !== FillDir['RADIAL: 径向'] } })
    get fillEnd() { return this._fillEnd; }
    set fillEnd(val) {
        this._fillEnd = clamp(val, 0, 1);
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _fillStartAngle: number = 0;
    @property({ range: [0, 360], slide: true, step: 1, displayName: '······起始角度', visible(this: Sprite) { return this._spriteType === SpriteType['FILLED: 填充'] && this._fillDir === FillDir['RADIAL: 径向'] } })
    get fillStartAngle() { return this._fillStartAngle; }
    set fillStartAngle(val) {
        this._fillStartAngle = clamp(val, 0, 360);
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _fillEndAngle: number = 360;
    @property({ range: [0, 360], slide: true, step: 1, displayName: '······结束角度', visible(this: Sprite) { return this._spriteType === SpriteType['FILLED: 填充'] && this._fillDir === FillDir['RADIAL: 径向'] } })
    get fillEndAngle() { return this._fillEndAngle; }
    set fillEndAngle(val) {
        this._fillEndAngle = clamp(val, 0, 360);
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _fillRange: number = 0.5;
    @property({ range: [0, 1], slide: true, step: 0.01, displayName: '······填充范围', visible(this: Sprite) { return this._spriteType === SpriteType['FILLED: 填充'] } })
    get fillRange() { return this._fillRange; }
    set fillRange(val) {
        this._fillRange = clamp(val, 0, 1);
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property({ displayName: '······左边距', readonly: true, editorOnly: true, serializable: false, visible(this: Sprite) { return this._spriteType === SpriteType['SLICED: 九宫格'] } })
    private sliceLeft: number = 0;
    @property({ displayName: '······右边距', readonly: true, editorOnly: true, serializable: false, visible(this: Sprite) { return this._spriteType === SpriteType['SLICED: 九宫格'] } })
    private sliceRight: number = 0;
    @property({ displayName: '······下边距', readonly: true, editorOnly: true, serializable: false, visible(this: Sprite) { return this._spriteType === SpriteType['SLICED: 九宫格'] } })
    private sliceBottom: number = 0;
    @property({ displayName: '······上边距', readonly: true, editorOnly: true, serializable: false, visible(this: Sprite) { return this._spriteType === SpriteType['SLICED: 九宫格'] } })
    private sliceTop: number = 0;
    @property
    private _rotateGrid: Vec2 = new Vec2(3, 3);
    @property({ displayName: '······网格', tooltip: '网格越多图像越保真，但性能消耗也越大', visible(this: Sprite) { return this._spriteType === SpriteType['ROTATE: 3D旋转'] } })
    get rotateGrid() { return this._rotateGrid; }
    set rotateGrid(val) {
        this._rotateGrid = new Vec2(Math.max(~~val.x, 1), Math.max(~~val.y, 1));
        this.createBuffer();
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    @property
    private _rotateAngle: Vec2 = new Vec2(0, 0);
    @property({ displayName: '······旋转角度', visible(this: Sprite) { return this._spriteType === SpriteType['ROTATE: 3D旋转'] } })
    get rotateAngle() { return this._rotateAngle; }
    set rotateAngle(val) {
        this._rotateAngle = val;
        this.flush();
    }
    @property
    private _rotateObRatio: number = 0.5;
    @property({ range: [0, 1], step: 0.1, slide: true, displayName: '······透视程度', tooltip: '0代表不透视，1代表极限透视\n透视程度较大时会失真\n建议增加网格提升保真度', visible(this: Sprite) { return this._spriteType === SpriteType['ROTATE: 3D旋转'] } })
    get rotateObRatio() { return this._rotateObRatio; }
    set rotateObRatio(val) {
        this._rotateObRatio = clamp(val, 0, 1);
        this.updateRotateObRatio();
        this.updateLocal();
        this.flush();
    }
    @property
    private _offset: Vec2 = new Vec2(0, 0);
    @property({ displayName: '······偏移距离', visible(this: Sprite) { return this._spriteType === SpriteType['OFFSET: 纹理循环'] } })
    get offset() { return this._offset; }
    set offset(val) {
        this._offset = val;
        this.updateUVOffset();
        this.updateLocal();
        this.updateUV();
        this.flush();
    }
    uiTrans: UITransform = null!;
    private prevOpacity: number = 255;      //预存透明度，用来判断透明度是否发生改变
    private cascadeOpacity: number = 1;     //级联透明度，用来计算子节点透明度
    private left: number = 0;               //左边缘本地坐标
    private bottom: number = 0;             //下边缘本地坐标
    private right: number = 0;              //右边缘本地坐标
    private top: number = 0;                //上边缘本地坐标
    private hue: number[] = [1, 1, 1];      //色相分量
    private rotateObDis: number = 0;        //3D旋转模式，观察者与图片的距离
    private fillSectors: number[][] = [];   //填充模式，径向填充的扇区
    private offsetUV: number[] = [];        //纹理偏移模式，偏移的UV值
    private locals: number[][] = [];        //顶点本地坐标
    __preload(): void {
        super.__preload();
        this._assembler = {         //定制assembler
            updateColor: this.updateColor.bind(this),
            updateRenderData: this.onFlushed.bind(this),
            fillBuffers: this.fillBuffer.bind(this),
        };
        this.selfTrans['sprite'] = this;
        this._useVertexOpacity = true;
        this.uiTrans = this.node._uiProps.uiTransformComp!;
        this.measure();
        this.updateHueRatio();
    }
    onLoad(): void {
        super.onLoad();
        this.updateSpriteFrame();
        this.updateSpriteType();
        this.createBuffer(false);
        this.updateLocal();
        this.updateUV();
        director.once(Director.EVENT_AFTER_DRAW, this.updateColor, this);
        this.node.on(NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
        this.node.on(NodeEventType.ANCHOR_CHANGED, this.onAnchorChanged, this);
    }
    onDestroy(): void {
        super.onDestroy();
        this.node.off(NodeEventType.SIZE_CHANGED, this.onSizeChanged, this);
        this.node.off(NodeEventType.ANCHOR_CHANGED, this.onAnchorChanged, this);
    }
    updateSpriteType(): void {
        switch (this._spriteType) {
            case SpriteType['ROUND: 圆角']: this.updateCorner(); break;
            case SpriteType['FILLED: 填充']: this.updateFillCenter(); break;
            case SpriteType['ROTATE: 3D旋转']: this.updateRotateObRatio(); break;
            case SpriteType['OFFSET: 纹理循环']: this.updateUVOffset(); break;
        }
    }
    updateHueRatio(): void {
        const step = 1 / 7;
        let hueRatio = this._hueRatio;
        if (hueRatio < step) this.hue = [1, hueRatio / step, 0];
        else if (hueRatio < step * 2) this.hue = [2 - hueRatio / step, 1, 0];
        else if (hueRatio < step * 3) this.hue = [0, 1, hueRatio / step - 2];
        else if (hueRatio < step * 4) this.hue = [0, 4 - hueRatio / step, 1];
        else if (hueRatio < 5 * step) this.hue = [hueRatio / step - 4, 0, 1];
        else if (hueRatio < 6 * step) this.hue = [1, 0, 6 - hueRatio / step];
        else { this.hue = [1, hueRatio / step - 6, hueRatio / step - 6]; }
    }
    updateCorner(): void {
        let corner = this._roundCorner;
        corner.visible = [corner.leftBottom, corner.rightBottom, corner.rightTop, corner.leftTop];
    }
    updateFillCenter(): void {
        let cw = this.uiTrans.width, ch = this.uiTrans.height;
        let ox = cw * this._fillCenter.x, oy = ch * this._fillCenter.y;
        const PIx2 = Math.PI * 2;
        let rt = Math.atan2(ch - oy, cw - ox);
        let lt = Math.atan2(ch - oy, -ox);
        let lb = Math.atan2(-oy, -ox) + PIx2;
        let rb = Math.atan2(-oy, cw - ox) + PIx2;
        this.fillSectors[0] = [0, rt];
        this.fillSectors[1] = [rt, lt];
        this.fillSectors[2] = [lt, lb];
        this.fillSectors[3] = [lb, rb];
        this.fillSectors[4] = [rb, PIx2];
    }
    updateRotateObRatio(): void {
        let cw = this.uiTrans.width, ch = this.uiTrans.height;
        let ax = this.uiTrans.anchorX, ay = this.uiTrans.anchorY;
        let obDisRatio = this._rotateObRatio;
        let disX = cw * (ax > 0.5 ? ax : 1 - ax) * (obDisRatio === 0 ? 1e8 : Math.pow(2, 3 * (1 - obDisRatio)));
        let disY = ch * (ay > 0.5 ? ay : 1 - ay) * (obDisRatio === 0 ? 1e8 : Math.pow(2, 3 * (1 - obDisRatio)));
        this.rotateObDis = Math.max(disX, disY);
    }
    updateUVOffset(): void {
        let cw = this.uiTrans.width, ch = this.uiTrans.height;
        let offX = this._offset.x, offY = this._offset.y;
        this.offsetUV = [(offX % cw + (offX < 0 ? cw : 0)) / cw, (offY % ch + (offY < 0 ? ch : 0)) / ch];
    }
    //设置顶点数和三角形数
    createBuffer(isUpdateColor: boolean = true): void {
        this.destroyRenderData();
        let renderData = this._renderData = this.requestRenderData();
        let vertexTriangle = [4, 2];
        switch (this._spriteType) {
            case SpriteType['ROUND: 圆角']:
                let cornerCnt = 0;
                for (let i = 0, visible = this._roundCorner.visible; i < 4; visible[i++] && ++cornerCnt);
                vertexTriangle = [12 + (this.roundSegment - 1) * cornerCnt, 6 + this.roundSegment * cornerCnt];
                break;
            case SpriteType['FILLED: 填充']: this._fillDir === FillDir['RADIAL: 径向'] && (vertexTriangle = [11, 5]); break;
            case SpriteType['SLICED: 九宫格']: vertexTriangle = [16, 18]; break;
            case SpriteType['ROTATE: 3D旋转']: vertexTriangle = [(this._rotateGrid.x + 1) * (this._rotateGrid.y + 1), this._rotateGrid.x * this._rotateGrid.y << 1]; break;
            case SpriteType['OFFSET: 纹理循环']: vertexTriangle = [16, 8]; break;
        }
        renderData.dataLength = vertexTriangle[0];
        renderData.resize(vertexTriangle[0], 3 * vertexTriangle[1]);
        EDITOR && ([this.vertexTriangle.x, this.vertexTriangle.y] = vertexTriangle);
        isUpdateColor && this.updateColor();
        this.updateIData();
    }
    //计算顶点索引
    updateIData(): void {
        let gridIndices = (col: number): void => {
            ++col;
            for (let i = 0, len = ib.length, id = 0; i < len; ++id) {
                (id + 1) % col === 0 && ++id;
                ib[i++] = id;
                ib[i++] = id + 1;
                ib[i++] = id + col;
                ib[i++] = id + col;
                ib[i++] = id + 1;
                ib[i++] = id + col + 1;
            }
        }
        // 修复第一处报错：使用可选链和类型检查
        const renderData = this._renderData;
        if (!renderData || !renderData.chunk) return;
        // 获取索引缓冲区的正确方式
        const chunk = renderData.chunk;
        let ib: Uint16Array | number[] = [];
        if ('indexBuffer' in chunk) {
            ib = (chunk as any).indexBuffer || [];
        } else if ('_indexBuffer' in chunk) {
            ib = (chunk as any)._indexBuffer || [];
        } else if ('ib' in chunk) {
            ib = (chunk as any).ib || [];
        }
        switch (this._spriteType) {
            case SpriteType['SIMPLE: 经典']: gridIndices(1); break;
            case SpriteType['ROUND: 圆角']:
                const ROUND_IB = [0, 9, 11, 0, 11, 1, 2, 8, 10, 2, 4, 8, 3, 5, 7, 3, 7, 6];
                for (let i = ROUND_IB.length - 1; i > -1; ib[i] = ROUND_IB[i--]);
                for (let i = 0, offset = ROUND_IB.length, id = 36, visible = this._roundCorner.visible; i < 4; ++i) {
                    if (!visible[i]) continue;
                    let o = 3 * i;
                    let a = o + 1;
                    let b = id / 3;
                    for (let j = 0, len = this._roundSegment - 1; j < len; ++j) {
                        ib[offset++] = o;
                        ib[offset++] = a;
                        ib[offset++] = b;
                        a = b++;
                        id += 3;
                    }
                    ib[offset++] = o;
                    ib[offset++] = a;
                    ib[offset++] = o + 2;
                }
                break;
            case SpriteType['FILLED: 填充']:
                switch (this._fillDir) {
                    case FillDir['HORIZONTAL: 横向']:
                    case FillDir['VERTICAL: 纵向']: gridIndices(1); break;
                    case FillDir['RADIAL: 径向']:
                        for (let i = 0, len = ib.length, id = 0; i < len; id += 2) {
                            ib[i++] = 0;
                            ib[i++] = id + 1;
                            ib[i++] = id + 2;
                        }
                        break;
                }
                break;
            case SpriteType['SLICED: 九宫格']: gridIndices(3); break;
            case SpriteType['ROTATE: 3D旋转']: gridIndices(this._rotateGrid.x); break;
            case SpriteType['OFFSET: 纹理循环']:
                const OFFSET_IB = [0, 1, 4, 4, 1, 5, 2, 3, 6, 6, 3, 7, 8, 9, 12, 12, 9, 13, 10, 11, 14, 14, 11, 15];
                for (let i = OFFSET_IB.length - 1; i > -1; ib[i] = OFFSET_IB[i--]);
                break;
        }
        JSB && this._renderData!.chunk.setIndexBuffer(ib);
    }
    //计算本地坐标
    updateLocal(): void {
        let spriteFrame = this._spriteFrame;
        if (!spriteFrame) return;
        let cw = this.uiTrans.width, ch = this.uiTrans.height;
        let l = this.left, b = this.bottom, r = this.right, t = this.top;
        let locals = this.locals = [] as number[][];
        switch (this._spriteType) {
            case SpriteType['SIMPLE: 经典']:
                locals[0] = [l, b];
                locals[1] = [r, b];
                locals[2] = [l, t];
                locals[3] = [r, t];
                break;
            case SpriteType['ROUND: 圆角']:
                let radius = Math.min(this._roundRadius, Math.min(cw, ch) / 2);
                let lo = l + radius;
                let bo = b + radius;
                let ro = r - radius;
                let to = t - radius;
                let corner = this._roundCorner;
                locals[0] = [lo, corner.leftBottom ? bo : b];
                locals[1] = [l, locals[0][1]];
                locals[2] = [lo, b];
                locals[3] = [ro, corner.rightBottom ? bo : b];
                locals[4] = [ro, b];
                locals[5] = [r, locals[3][1]];
                locals[6] = [ro, corner.rightTop ? to : t];
                locals[7] = [r, locals[6][1]];
                locals[8] = [ro, t];
                locals[9] = [lo, corner.leftTop ? to : t];
                locals[10] = [lo, t];
                locals[11] = [l, locals[9][1]];
                let radian = Math.PI / (this._roundSegment << 1);
                let sin = Math.sin(radian), cos = Math.cos(radian);
                for (let i = 0, offset = 12, visible = corner.visible; i < 4; ++i) {
                    if (!visible[i]) continue;
                    let id = i * 3;
                    let ox = locals[id][0];
                    let oy = locals[id][1];
                    let deltX = locals[id + 1][0] - ox;
                    let deltY = locals[id + 1][1] - oy;
                    for (let j = 0, len = this._roundSegment - 1; j < len; ++j) {
                        locals[offset] = [ox + deltX * cos - deltY * sin, oy + deltY * cos + deltX * sin];
                        deltX = locals[offset][0] - ox;
                        deltY = locals[offset][1] - oy;
                        ++offset;
                    }
                }
                break;
            case SpriteType['FILLED: 填充']:
                let start = 0, end = 0;
                switch (this._fillDir) {
                    case FillDir['HORIZONTAL: 横向']:
                        if (this._fillStart > this._fillEnd) {
                            start = l + cw * lerp(this._fillStart, this._fillEnd, this._fillRange);
                            end = l + cw * this._fillStart;
                        } else {
                            start = l + cw * this._fillStart;
                            end = l + cw * lerp(this._fillStart, this._fillEnd, this._fillRange);
                        }
                        locals[0] = [start, b];
                        locals[1] = [end, b];
                        locals[2] = [start, t];
                        locals[3] = [end, t];
                        break;
                    case FillDir['VERTICAL: 纵向']:
                        if (this._fillStart > this._fillEnd) {
                            start = b + ch * lerp(this._fillStart, this._fillEnd, this._fillRange);
                            end = b + ch * this._fillStart;
                        } else {
                            start = b + ch * this._fillStart;
                            end = b + ch * lerp(this._fillStart, this._fillEnd, this._fillRange);
                        }
                        locals[0] = [l, start];
                        locals[1] = [r, start];
                        locals[2] = [l, end];
                        locals[3] = [r, end];
                        break;
                    case FillDir['RADIAL: 径向']: {
                        let getIntersection = (sector: number, radian: number): number[] => {
                            let tan = Math.tan(radian);
                            switch (sector) {
                                case 0: return [r, b + oy + (cw - ox) * tan];
                                case 1: return [l + ox + (ch - oy) / tan, t];
                                case 2: return [l, b + oy - ox * tan];
                                case 3: return [l + ox - oy / tan, b];
                                case 4: return [r, b + oy + (cw - ox) * tan];
                            }
                            return []
                        }
                        start = this._fillStartAngle * PI180, end = lerp(this._fillStartAngle, this._fillEndAngle, this._fillRange) * PI180;
                        let ox = cw * this._fillCenter.x, oy = ch * this._fillCenter.y;
                        locals[0] = [l + ox, b + oy];
                        for (let i = 0, id = 0, sectors = this.fillSectors; i < 5; ++i) {
                            let sector = sectors[i];
                            locals[++id] = getIntersection(i, clamp(start, sector[0], sector[1]));
                            locals[++id] = getIntersection(i, clamp(end, sector[0], sector[1]));
                        }
                    } break;
                }
                break;
            case SpriteType['SLICED: 九宫格']: {
                let ow = spriteFrame.originalSize.width, oh = spriteFrame.originalSize.height;
                let scaleX = cw > ow ? 1 : cw / ow, scaleY = ch > oh ? 1 : ch / oh;
                let xList = [l, l + spriteFrame.insetLeft * scaleX, r - spriteFrame.insetRight * scaleX, r];
                let yList = [b, b + spriteFrame.insetBottom * scaleY, t - spriteFrame.insetTop * scaleY, t];
                for (let i = 0; i < 16; ++i) {
                    locals[i] = [xList[i & 3], yList[i >> 2]];
                }
            } break;
            case SpriteType['ROTATE: 3D旋转']:
                let col = this._rotateGrid.x, row = this._rotateGrid.y;
                for (let i = 0, rowSize = row + 1; i < rowSize; ++i) {
                    for (let j = 0, colSize = col + 1; j < colSize; ++j) {
                        locals[colSize * i + j] = [l + (r - l) * j / col, b + (t - b) * i / row];
                    }
                }
                break;
            case SpriteType['OFFSET: 纹理循环']: {
                let ox = l + cw * (1 - this.offsetUV[0]);
                let oy = b + ch * (1 - this.offsetUV[1]);
                let xList = [l, ox, ox, r], yList = [b, oy, oy, t];
                for (let i = 0, rowSize = 4; i < rowSize; ++i) {
                    for (let j = 0, colSize = 4; j < colSize; ++j) {
                        locals[colSize * i + j] = [xList[j], yList[i]];
                    }
                }
            } break;
        }
    }
    //根据本地坐标，计算XY坐标
    updateXY(): void {
        let data = this._renderData!.data;
        let locals = this.locals;
        switch (this._spriteType) {
            default:
                for (let i = locals.length - 1; i > -1; --i) {
                    let local = this.locals[i];
                    data[i].x = local[0];
                    data[i].y = local[1];
                }
                break;
            case SpriteType['ROTATE: 3D旋转']:
                let obDis = this.rotateObDis;
                let radianX = this._rotateAngle.x * PI180;
                let cosX = Math.cos(radianX), sinX = Math.sin(radianX);
                let radianY = this._rotateAngle.y * PI180;
                let cosY = Math.cos(radianY), sinY = Math.sin(radianY);
                for (let i = data.length - 1; i > -1; --i) {
                    let local = locals[i], ratio = obDis * obDis / ((obDis - local[1] * sinX) * (obDis + local[0] * sinY));
                    data[i].x = local[0] * ratio * cosY;
                    data[i].y = local[1] * ratio * cosX;
                }
                break;
        }
        let selfTrans = this.selfTrans;
        let radian = selfTrans.angle * PI180;
        let s = Math.sin(radian), c = Math.cos(radian);
        let lx = selfTrans['_position'].x, ly = selfTrans['_position'].y;
        let lsx = selfTrans['_scale'].x, lsy = selfTrans['_scale'].y;
        for (let i = 0, len = data.length; i < len; ++i) {
            let point = data[i], px = point.x * lsx, py = point.y * lsy;
            point.x = (px * c - py * s) + lx;
            point.y = (py * c + px * s) + ly;
        }
    }
    //计算UV坐标
    updateUV(): void {
        let spriteFrame = this._spriteFrame;
        if (!spriteFrame) return;
        let renderData = this._renderData!;
        let vb = renderData.chunk.vb;
        let locals = this.locals;
        let ut = this.uiTrans, l = this.left, b = this.bottom;
        let cw = ut.width, ch = ut.height;
        switch (this._spriteType) {
            default:
                for (let i = 3, len = vb.length, step = renderData.floatStride, id = 0; i < len; i += step, ++id) {
                    let local = locals[id];
                    vb[i] = (local[0] - l) / cw;
                    vb[i + 1] = (local[1] - b) / ch;
                }
                break;
            case SpriteType['SLICED: 九宫格']: {
                let ow = spriteFrame.originalSize.width, oh = spriteFrame.originalSize.height;
                let uList = [0, spriteFrame.insetLeft / ow, 1 - spriteFrame.insetRight / ow, 1];
                let vList = [0, spriteFrame.insetBottom / oh, 1 - spriteFrame.insetTop / oh, 1];
                for (let i = 3, len = vb.length, step = renderData.floatStride, id = 0; i < len; i += step, ++id) {
                    vb[i] = uList[id & 3];
                    vb[i + 1] = vList[id >> 2];
                }
            } break;
            case SpriteType['OFFSET: 纹理循环']: {
                let uList = [this.offsetUV[0], 1, 0, this.offsetUV[0]];
                let vList = [this.offsetUV[1], 1, 0, this.offsetUV[1]];
                for (let i = 3, len = vb.length, step = renderData.floatStride, id = 0; i < len; i += step, ++id) {
                    vb[i] = uList[id & 3];
                    vb[i + 1] = vList[id >> 2];
                }
            } break;
        }
        let uv = spriteFrame.uv;
        if (spriteFrame['_rotated']) {
            let uvL = uv[0], uvB = uv[1], uvW = uv[4] - uvL, uvH = uv[3] - uvB;
            for (let i = 3, len = vb.length, step = this._renderData!.floatStride; i < len; i += step) {
                let tmp = vb[i];
                vb[i] = uvL + vb[i + 1] * uvW;
                vb[i + 1] = uvB + tmp * uvH;
            }
        } else {
            let uvL = uv[0], uvB = uv[1], uvW = uv[2] - uvL, uvH = uv[5] - uvB;
            for (let i = 3, len = vb.length, step = this._renderData!.floatStride; i < len; i += step) {
                vb[i] = uvL + vb[i] * uvW;
                vb[i + 1] = uvB + vb[i + 1] * uvH;
            }
        }
    }
    //计算顶点颜色
    updateColor(): void {
        let renderData = this._renderData!, vb = renderData!.chunk.vb;
        let color = this._color, brightRatio = this._brightness / 255, hue = this.hue;
        let r = color.r * brightRatio * hue[0], g = color.g * brightRatio * hue[1], b = color.b * brightRatio * hue[2];
        let cascadeOpa = color.a * this.cascadeOpacity / 255, a = cascadeOpa * this.selfTrans['_opacity'];
        for (let i = 5, len = vb.length, step = renderData!.floatStride; i < len; i += step) {
            vb[i] = r;
            vb[i + 1] = g;
            vb[i + 2] = b;
            vb[i + 3] = a;
        }
        if (this.prevOpacity !== color.a) {//如果节点透明度发生改变，则更新所有子节点透明度
            this.prevOpacity = color.a;
            let updateChildrenOpa = (node: Node, cascadeOpa: number): void => {
                for (let children = node.children, i = children.length - 1; i > -1; --i) {
                    let spt = children[i].getComponent(Sprite);
                    if (spt) {
                        let renderData = spt._renderData!, vb = renderData.chunk.vb;
                        let opa = spt._color.a * cascadeOpa / 255;
                        let a = opa * spt.selfTrans.opacity;
                        for (let i = 5, len = vb.length, step = renderData.floatStride; i < len; i += step) {
                            vb[i + 3] = a;
                        }
                        spt.cascadeOpacity = cascadeOpa;
                        updateChildrenOpa(children[i], opa);
                    } else {
                        updateChildrenOpa(children[i], cascadeOpa);
                    }
                }
            }
            updateChildrenOpa(this.node, cascadeOpa);
        }
    }
    //如果材质为空，则设置为默认材质
    updateMaterial(): void {
        this._customMaterial ??= <Material>builtinResMgr['_resources']['ui-sprite-material'];
        //@ts-ignore
        super['updateMaterial']();
    }
    //测量锚点与4条边的本地间距
    measure(): void {
        let ut = this.uiTrans, cw = ut.width, ch = ut.height, ax = ut.anchorX, ay = ut.anchorY;
        this.left = -cw * ax;
        this.bottom = -ch * ay;
        this.right = cw * (1 - ax);
        this.top = ch * (1 - ay);
        this._spriteType === SpriteType['ROTATE: 3D旋转'] && this.updateRotateObRatio();
    }
    //修改节点尺寸后，更新顶点数据，并根据sizeMode设置图片宽高
    onSizeChanged(): void {
        if (!this._spriteFrame) return;
        this.measure();
        this.updateLocal();
        switch (this._sizeMode) {
            case SizeMode['TRIMMED: 原始尺寸裁剪透明像素']:
                let rect = this._spriteFrame['_rect'];
                if (this.uiTrans.width === rect.width && this.uiTrans.height === rect.height) return;
                break;
            case SizeMode['RAW: 图片原始尺寸']:
                let size = this._spriteFrame['_originalSize'];
                if (this.uiTrans.width === size.width && this.uiTrans.height === size.height) return;
                break;
        }
        this._sizeMode = SizeMode['CUSTOM: 自定义尺寸'];
    }
    onAnchorChanged(): void {
        this.measure();
        this.updateLocal();
    }
    //可以传入cc.SpriteFrame图集帧（支持合批，推荐），或单张图片cc.Texture2D
    updateSpriteFrame(): void {
        let spriteFrame = this._spriteFrame;
        if (!spriteFrame) { this.atlas = null!; return; }
        this._renderData && (this._renderData.textureDirty = true);
        this.updateSizeMode();
        if (EDITOR) {
            this.sliceLeft = spriteFrame.insetLeft; this.sliceRight = spriteFrame.insetRight;
            this.sliceBottom = spriteFrame.insetBottom; this.sliceTop = spriteFrame.insetTop;
            if (!spriteFrame['_atlasUuid']) { this.atlas = null!; return; }
            assetManager.loadAny(spriteFrame['_atlasUuid'], (err: Error, asset: SpriteAtlas) => {
                if (err) { this.atlas = null!; return; }
                this.atlas = asset;
            });
        }
    }
    //根据尺寸模式，修改节点尺寸
    updateSizeMode(): void {
        if (!this._spriteFrame) return;
        let ut = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        switch (this._sizeMode) {
            case SizeMode['TRIMMED: 原始尺寸裁剪透明像素']: ut.setContentSize(this._spriteFrame['_rect'].size); break;
            case SizeMode['RAW: 图片原始尺寸']: ut.setContentSize(this._spriteFrame['_originalSize']); break;
        }
    }
    //更新渲染数据
    flush: (enable?: boolean) => void = this.markForUpdateRenderData;
    //调用flush后该函数会被动触发
    onFlushed(): void {
        if (!this._spriteFrame) return;
        this.updateXY();
        this._renderData!.updateRenderData(this, this._spriteFrame);
    }
    _render(render: any): void {
        render.commitComp(this, this._renderData, this._spriteFrame, this._assembler, null);
    }
    _canRender(): boolean {
        return super._canRender() && !!(this._spriteFrame?.texture);
    }
    //Web平台，将renderData的数据提交给GPU渲染，renderData.data使用世界坐标
    //原生平台并不会执行该函数，引擎另外实现了渲染函数，renderData.data使用本地坐标
    fillBuffer(): void {
        let renderData = this._renderData!;
        let chunk = renderData.chunk;
        if (this.node.hasChangedFlags || renderData.vertDirty) {
            let vb = chunk.vb;
            let data = renderData.data;
            let m = this.node.worldMatrix;
            let m00 = m.m00, m01 = m.m01, m04 = m.m04, m05 = m.m05, m12 = m.m12, m13 = m.m13;
            for (let i = 0, id = 0, len = vb.length, step = renderData.floatStride; i < len; i += step, ++id) {
                let x = data[id].x, y = data[id].y;
                vb[i] = m00 * x + m04 * y + m12;
                vb[i + 1] = m01 * x + m05 * y + m13;
            }
            renderData.vertDirty = false;
        }
        let vid = chunk.vertexOffset;
        let meshBuffer = chunk.meshBuffer;
        let iData = meshBuffer.iData;
        let ib = chunk.ib;
        for (let i = 0, len = renderData.indexCount, offset = meshBuffer.indexOffset; i < len; iData[offset++] = vid + ib[i++]);
        meshBuffer.indexOffset += renderData.indexCount;
    }
}
declare global {
    module gi {
        class Sprite extends UIRenderer {
            static SizeMode: typeof SizeMode;
            static SpriteType: typeof SpriteType;
            static FillDir: typeof FillDir;
            spriteFrame: SpriteFrame;
            sizeMode: SizeMode;
            selfTrans: SelfTransform;
            brightness: number;
            spriteType: SpriteType;
            roundSegment: number;
            roundRadius: number;
            fillDir: FillDir;
            fillCenter: Vec2;
            fillStart: number;
            fillEnd: number;
            fillStartAngle: number;
            fillEndAngle: number;
            fillRange: number;
            rotateGrid: Vec2;
            rotateAngle: Vec2;
            rotateObRatio: number;
            offset: Vec2;
            uiTrans: UITransform;
        }
    }
}
((globalThis as any).gi ||= {}).Sprite ||= Object.assign(Sprite, { SizeMode: SizeMode, SpriteType: SpriteType, FillDir: FillDir });