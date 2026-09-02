import {
    _decorator, Component, instantiate, Node, Prefab, ScrollView, tween,
    UITransform, Vec2, Vec3, Widget, Layout,
    TransformBit
} from 'cc';
import { ScrollListItem } from './ScrollListItem';
/**横向排布拖动*/
export const SCROLL_HORIZONTAL: number = 1;
/**竖向排布拖动*/
export const SCROLL_VERTICAL: number = 2;

const { ccclass, property, menu, requireComponent } = _decorator;

@ccclass('ScrollList')
@menu('UI/ScrollList')
@requireComponent(ScrollView)
export class ScrollList extends Component {

    @property({
        displayName: "设置间隙",
    })
    openGap: boolean = false;

    @property({
        displayName: "Padding Left",
        tooltip: "左侧内边距",
        visible: function () {
            //@ts-ignore
            return this.openGap === true;
        }
    })
    paddingLeft: number = 0;

    @property({
        displayName: "Padding Right",
        tooltip: "右侧内边距",
        visible: function () {
            //@ts-ignore
            return this.openGap === true;
        }
    })
    paddingRight: number = 0;

    @property({
        displayName: "Spacing X",
        tooltip: "间距",
        visible: function () {
            //@ts-ignore
            return this.openGap === true;
        }
    })
    spacingX: number = 0;

    // /**item子节点预制体*/
    // @property({ type: Node, tooltip: "item子节点预制体" })
    itemPrefab: Node | Prefab = null!;

    itemPrefabPrototype: Node | Prefab = null!;

    /**单条记录高度*/
    private _itemSize!: number;

    /**需要多少个记录组件 在可视范围内+2条*/
    private _numItem: number = 0;

    private _numItemCopy: number = 0;

    private _itemArr: Array<Node> = [];

    /**当前最大节点下标*/
    private _itemIndex: number = 0;

    private _showSize: number = 0

    /**当前最大数据下标*/
    private _dataIndex: number = 0;

    /**数据源*/
    private _dataArr!: any[];
    public get dataArr(): any[] {
        return this._dataArr;
    }
    public set dataArr(value: any[]) {
        this._dataArr = value;
    }

    /**滚动方向*/
    private _direction: number = 0;

    /**间隙 0=开始边框，1=结束边框，2=间隙*/
    private _gapNum!: number[];

    /**子节点刷新绑定事件，或者使用item继承的模式*/
    public onItemRender!: Function;

    /** 准备滚动 */
    private _readyScroll: number = -1;
    /** 正在渲染 */
    private _isRender: boolean = false;
    /** 新数据来了，停止渲染，重新刷新 */
    private _newRender: boolean = false;
    /** item刷新间隔 */
    private _interval: number = 70;
    /** item渐隐时间 */
    private _showTime: number = 400;
    /** 生成item的方向是从上还是下 <true上false下> */
    private _upOrDown: boolean = true;
    /** 是否立刻停止创建 */
    public stopCreate: boolean = false;

    private _needCreateAll: boolean = true;

    private _isFirst: boolean = true;

    /**加载回调 */
    loadingCall: Function | null = null;
    start() {
        this.node.on('scrolling', this.scrollCheck, this);
        this.node.on("scroll-to-bottom", () => {
            this.loadingCall && this.loadingCall();
        }, this)
    }

    /**设置数据
     * @param dataArr : 数据源
     * @param direction : 滚动方向，默认上下
     * @param gap : [开始边框距离，结束边框距离，每个之间空隙]
    */
    public setDataList(itemPrefab: Node | Prefab, dataArr: any[], direction: number = SCROLL_VERTICAL, gap?: number[]) {
        if (!this._isFirst && this.checkItems() && dataArr.length === this._dataArr.length) {
            this.UpdateItems(dataArr);
            this.updateContentSize()
            this.scrollCheck();
            return
        }
        this._isFirst = false
        this.stopCreate = false;
        this.getComponent(Widget)?.updateAlignment()
        this._dataArr = dataArr ? [...dataArr] : [];
        this._direction = direction;
        if (itemPrefab instanceof Node) {
            itemPrefab.setParent(null);
            this.itemPrefab = instantiate(itemPrefab);
            // itemPrefab.destroy();
            this.itemPrefabPrototype = itemPrefab;
        } else {
            this.itemPrefab = itemPrefab;
        }
        if (this.itemPrefab instanceof Node && this.itemPrefab.getComponent(Widget)) {
            this.itemPrefab.getComponent(Widget)!.enabled = false;
            this.itemPrefab.getComponent(Widget)!.destroy();
        }
        if (this.node.getComponent(ScrollView)!.content?.getComponent(Layout)) this.node.getComponent(ScrollView)!.content!.getComponent(Layout)?.destroy();
        if (this.paddingLeft != 0 || this.paddingRight != 0 || this.spacingX != 0) {
            this._gapNum = [this.paddingLeft, this.paddingRight, this.spacingX];
        } else if (gap) {
            this._gapNum = gap;
        }
        this.resetScroll();
        if (this._isRender) {
            this._newRender = true;
            return;
        }
        this.createItem();
    }
    private checkItems() {
        let count = 0;
        const children = this.getComponent(ScrollView)!.content!.children;
        for (let index = 0; index < children.length; index++) {
            const child = children[index];
            if (!child.isValid) {
                return false
            }
            count++
        }
        if (count != this._numItem) {
            return false
        }
        return true;
    }
    /** item创建时间间隔, item渐显时间 */
    public setDelay(time: number, itemShowTime: number = 600): void {
        this._interval = time;
        this._showTime = itemShowTime;
    }

    public setGap(gap: number[]): void {
        this._gapNum = gap;
    }
    public setStopCreate() {
        this.stopCreate = true;
        this._isRender = false;
    }
    private resetScroll(): void {
        this._itemArr.forEach((node: Node) => {
            if (node.parent) {
                node.setParent(null);
                node.destroy();
            }
        })
        this.node.getComponent(ScrollView)!.content?.children.forEach((item: Node, index: number) => {
            item.setParent(null);
        })
        this._itemArr.length = 0;
        // this.scrollToIndex(0);
        this.getComponent(ScrollView)!.scrollToOffset(new Vec2(0, 0), 0);//滚动
    }

    private delay(time: number) {
        return new Promise(async (ok) => {
            setTimeout(() => {
                ok("");
            }, time);
        })
    }
    /**设置是否需要创建所有item */
    setNeedCreateAllItem(bool: boolean) {
        this._needCreateAll = bool;
    }
    /**获得数据后开始创建*/
    private async createItem() {
        this.getComponent(ScrollView)!.enabled = false;
        this._isRender = true;
        let _showSize = this.node.getComponent(UITransform)!.height;
        //获得预制体的高度
        if (!this._itemSize) {
            let pNode = instantiate(this.itemPrefab) as Node;
            if (this._direction == SCROLL_HORIZONTAL) {
                this._itemSize = pNode.getComponent(UITransform)!.contentSize.width;
                _showSize = this.node.getComponent(UITransform)!.width;
            }
            else {
                this._itemSize = pNode.getComponent(UITransform)!.contentSize.height;
            }
            pNode.destroy();
            // log("---_itemSize--", this._itemSize);
        }
        this._showSize = _showSize;
        //可视范围，对应可以创建多少个实体单例item
        if (this._gapNum) {
            this._numItem = Math.floor(_showSize / (this._itemSize + this._gapNum[2])) + 2;
        } else {
            this._numItem = Math.floor(_showSize / this._itemSize) + 2;
        }
        if (this._dataArr.length < this._numItem) {
            if (this._needCreateAll) {
                this._numItemCopy = this._dataArr.length;
            } else {
                this._numItem = this._dataArr.length;
            }
        }
        this.updateContentSize();
        this._itemArr.length = 0;
        let ts = this;
        for (let index = 0; index < ts._numItem; index++) {
            if (index != 0 && this._readyScroll <= 0 && this._interval > 0) {
                await this.delay(this._interval);
            }
            if (this._newRender) {
                this._newRender = false;
                this.createItem();
                return;
            }
            if (!ts.isValid || !ts.node || !ts.node.activeInHierarchy) {
                this._isRender = false;
                return;
            }
            if (!ts.itemPrefab.isValid || ts.stopCreate) {
                return;
            }
            let pNode: Node = instantiate(ts.itemPrefab) as Node;
            pNode.active = true;
            pNode.parent = ts.getComponent(ScrollView)!.content;
            ts._itemArr.splice(index, 0, pNode);
            if (index >= this._dataArr.length) {
                pNode.active = false;
            } else {
                this.itemRender(pNode, index);
            }

        }



        this._itemIndex = this._dataIndex = this._itemArr.length - 1;
        this._isRender = false;
        this.getComponent(ScrollView)!.enabled = true;
        if (this._readyScroll > 0) {
            this.scrollToIndex(this._readyScroll);
        }
    }
    updateDataArr(data: any[]) {
        this._dataArr = data;
        if (this._gapNum) {
            this._numItem = Math.floor(this._showSize / (this._itemSize + this._gapNum[2])) + 2;
        } else {
            this._numItem = Math.floor(this._showSize / this._itemSize) + 2;
        }
        if (this._dataArr.length < this._numItem) {
            this._numItemCopy = this._dataArr.length;
        } else {
            this._numItemCopy = 0
        }
        this.updateContentSize();
        this.scrollCheck();
    }
    updateContentSize() {
        //设置容器大小
        let contentSize = this._itemSize * this._dataArr.length;
        //前面距离边框
        if (this._gapNum && this._gapNum[0]) {
            contentSize += this._gapNum[0];
        }
        //后面距离边框
        if (this._gapNum && this._gapNum[1]) {
            contentSize += this._gapNum[1];
        }
        //间隙距离
        if (this._gapNum && this._gapNum[2]) {
            contentSize += this._gapNum[2] * (this._dataArr.length - 1);
        }

        if (this._direction == SCROLL_HORIZONTAL) {
            this.getComponent(ScrollView)!.content!.getComponent(UITransform)!.width = contentSize;
            if (contentSize < this.node.w) {
                this.scheduleOnce(() => {
                    this.loadingCall && this.loadingCall();
                })
            }
        }
        else {
            this.getComponent(ScrollView)!.content!.getComponent(UITransform)!.height = contentSize;
            if (contentSize < this.node.h) {
                this.scheduleOnce(() => {
                    this.loadingCall && this.loadingCall();
                })
            }
        }
    }

    private scrollCheck() {
        if (!this.node.isValid || !this.node.activeInHierarchy) {
            //界面关了
            return;
        }
        const numItem = this._numItem//this._numItemCopy && this._numItemCopy < this._numItem - 1 ? this._numItemCopy : this._numItem;
        let nowPos = this.getComponent(ScrollView)!.getScrollOffset().y;
        let topPos = (this._dataIndex + 1 - numItem) * this._itemSize;//当前屏幕中靠近最开始的坐标

        //前面边框
        if (this._gapNum && this._gapNum[0]) {
            topPos += this._gapNum[0];
        }
        //间隙距离
        if (this._gapNum && this._gapNum[2]) {
            topPos += this._gapNum[2] * (this._dataIndex + 1 - numItem);
        }

        // let topPos = this.countPosByIndex(this._dataIndex + 1 - this._numItem);
        let size = this._itemSize;
        if (this._direction == SCROLL_HORIZONTAL) {
            nowPos = this.getComponent(ScrollView)!.getScrollOffset().x;
            topPos = -topPos;
            size = -this._itemSize;
        }

        //判断向结束端滚动，滚动点和初始点对比
        if ((this._direction == SCROLL_VERTICAL && nowPos > size + topPos) ||
            (this._direction == SCROLL_HORIZONTAL && nowPos < size + topPos)) {
            let newIndex = this._dataIndex + 1;
            // log(this._dataIndex, "-判断向结束端滚动 1 --将头部item转移到最后---", nowPos, topPos);
            if (newIndex >= this._dataArr.length) {
                return; //如果滚动到底部最后一条数据，不再进行写入
            }

            this._dataIndex = newIndex;

            let topItemIndex = this._itemIndex + 1;
            if (topItemIndex >= numItem) {
                topItemIndex = 0;
            }

            let item = this._itemArr[topItemIndex];
            if (item) {
                this.itemRender(item, newIndex);
                // error(topItemIndex, "转移到最后", item.node.position);
            }

            this._itemIndex = topItemIndex;
        }

        //判断向开始端滚动
        else if ((this._direction == SCROLL_VERTICAL && nowPos < topPos) ||
            (this._direction == SCROLL_HORIZONTAL && nowPos > topPos)) {

            let newIndex = this._dataIndex + 1 - numItem - 1;
            // log(this._dataIndex, "-判断向上滚动 2 -将最后item转移到头部----", newIndex);
            if (newIndex < 0) {
                // warn("如果滚动到第一条数据，不再进行写入", newIndex)
                return; //如果滚动到第一条数据，不再进行写入
            }
            this._dataIndex--;
            // error(this._itemIndex, "将最后item转移到头部", this._dataIndex, newIndex, newIndex * -this._itemSize);
            // if (newIndex == 0) this._itemIndex = 0;
            let item = this._itemArr[this._itemIndex];
            if (item) {
                this._upOrDown = false;
                this.itemRender(item, newIndex);
                // error(this._itemIndex, "转移头部", item.node.position);
            }

            this._itemIndex--;
            if (this._itemIndex < 0) {
                this._itemIndex = numItem - 1;
            }
        }
    }


    /**刷新单项*/
    private itemRender(node: Node, newIndex: number, isUpdate: boolean = false) {
        if (newIndex >= this._dataArr.length) return;
        if (node.isValid) node.active = true;
        //设置有全局得刷新事件
        if (this.onItemRender) {
            this.onItemRender(node, newIndex, this._dataArr[newIndex], this._numItem);
        }
        //没有全局，使用继承的item
        else {
            const item = node.getComponent(ScrollListItem)
            if (item) {
                item.onItemRender(this._dataArr[newIndex], newIndex, this._dataArr.length, this._numItem);
            }
        }
        if (this._showTime > 0 && !isUpdate) {
            node.opacity = 0;
            tween(node).to(this._showTime / 1000, {
                opacity: 255
            }, { easing: "quadOut" })
                .start();
        }
        if (!isUpdate) {
            this.setPos(node, newIndex);
        }
    }

    /**设置坐标*/
    private setPos(node: Node, index: number) {
        let direction = this._upOrDown ? 1 : -1;
        this._upOrDown = true;
        let pos = this.countPosByIndex(index);
        if (this._direction == SCROLL_HORIZONTAL) {
            node.setPosition(new Vec3(pos, 0));
            //效果有bug，先去掉
            // node.setPosition(new Vec3(pos - 50 * direction, 0));
            // tween(node).to(this._showTime / 1000, {
            //     position: new Vec3(pos, 0)
            // }, { easing: "quadOut" })
            //     .start();
        }
        else {
            node.setPosition(new Vec3(0, -pos));
            //效果有bug，先去掉
            // node.setPosition(new Vec3(0, -pos - 50 * direction));
            // tween(node).to(this._showTime / 1000, {
            //     position: new Vec3(0, -pos)
            // }, { easing: "quadOut" })
            //     .start();
        }
    }

    /**根据下标计算坐标。 0 ~ length-1*/
    private countPosByIndex(index: number): number {
        let pos = (1 / 2 + index) * this._itemSize;
        //前面距离边框
        if (this._gapNum && this._gapNum[0]) {
            pos += this._gapNum[0];
        }
        //间隙距离
        if (this._gapNum && this._gapNum[2]) {
            pos += this._gapNum[2] * index;
        }
        return pos;
    }
    public scrollToBottom(timeInSecond?: number, attenuated?: boolean) {
        this.getComponent(ScrollView)?.scrollToBottom(timeInSecond, attenuated)
    }
    /**滚动到指定下标*/
    public scrollToIndex(index: number) {
        //太靠近结束点，需要回退屏幕显示数量
        if (!this._dataArr) return;
        const numItem = this._numItemCopy ? this._numItemCopy : this._numItem;
        if (index > this._dataArr.length - numItem + 1) {
            index = this._dataArr.length - numItem + 1;
        }
        if (index < 0) {
            index = 0;
        }
        this.getComponent(ScrollView)!.stopAutoScroll();
        if (this._isRender) {
            this._readyScroll = index;
            return;
        }

        /**设置滚动坐标*/
        let pos = this.countPosByIndex(index) - 1 / 2 * this._itemSize;
        let ve = new Vec2(0, pos);
        if (this._direction == SCROLL_HORIZONTAL) {
            ve = new Vec2(-pos, 0);
        }
        this.getComponent(ScrollView)!.scrollToOffset(ve, 0.5);//滚动

        for (let x = 0; x < this._itemArr.length; x++) {
            let nexIndex: number = index + x;
            if (nexIndex >= this._dataArr.length || nexIndex < 0) {
                continue;
            }
            this.itemRender(this._itemArr[x], nexIndex);
        }

        this._dataIndex = this._itemArr.length - 1 + index;//数据下标
        this._itemIndex = this._itemArr.length - 1;//重新赋值后节点下标为数组内当前最大
    }

    /** 直接更新item的itemRender */
    UpdateItems(dataArr?: any[], backToFirst: boolean = false): void {
        if (dataArr) {
            this._dataArr = dataArr;
        }
        if (backToFirst) {
            this.scrollToIndex(0);
        } else {
            let itemPool = this._itemArr.concat();
            itemPool.sort((a: Node, b: Node) => {
                // 首先按active状态排序，active为true的在前
                if (a.active !== b.active) {
                    return a.active ? -1 : 1;
                }
                // active状态相同时，按原有规则排序
                if (a.position.x !== b.position.x) {
                    return a.position.x - b.position.x;
                } else if (a.position.y !== b.position.y) {
                    return b.position.y - a.position.y;
                } else {
                    return 1;
                }
            })
            let index = this._dataIndex
            if (index < this._itemArr.length - 1) {
                index = this._itemArr.length - 1
            }
            let curFirstItemIndex = index + 1 - this._itemArr.length;
            for (let x = 0; x < itemPool.length; x++) {
                let nexIndex: number = curFirstItemIndex + x;
                if (nexIndex >= this._dataArr.length || nexIndex < 0) {
                    continue;
                }
                this.itemRender(itemPool[x], nexIndex, true);
            }
        }
    }

    /** 销毁list */
    reset(): void {
        this._isFirst = true;
        this._itemArr.forEach((node: Node) => {
            node.destroy();
        })
        this._itemArr = [];
        /**单条记录高度*/
        this._itemSize = 0;
        /**需要多少个记录组件 在可视范围内+2条*/
        this._numItem = 0;

        this._numItemCopy = 0;
        /**当前最大节点下标*/
        this._itemIndex = 0;
        /**当前最大数据下标*/
        this._dataIndex = 0;
        /**数据源*/
        this._dataArr = [];
        /** 正在渲染 */
        this._isRender = false;
        /** 新数据来了，停止渲染，重新刷新 */
        this._newRender = false;
        this.resetScroll();
    }

    protected onDestroy(): void {
        this.itemPrefabPrototype?.destroy()
        super.onDestroy && super.onDestroy();
        if (this.node) {
            this.node.off('scrolling', this.scrollCheck, this);
        }
        if (this.itemPrefab instanceof Node && this.itemPrefab.isValid && !(this.itemPrefab.parent)) {
            this.itemPrefab.destroy();
        }
        // this._nodePool.clear();
        /**单条记录高度*/
        this._itemSize = 0;
        /**需要多少个记录组件 在可视范围内+2条*/
        this._numItem = 0;
        this._numItemCopy = 0
        this._itemArr = [];
        /**当前最大节点下标*/
        this._itemIndex = 0;
        /**当前最大数据下标*/
        this._dataIndex = 0;
        /**数据源*/
        this._dataArr = [];
        /** 正在渲染 */
        this._isRender = false;
        /** 新数据来了，停止渲染，重新刷新 */
        this._newRender = false;
    }
}
