
import { _decorator, Component } from 'cc';

const { ccclass, property, menu } = _decorator;

@ccclass('ScrollListItem')
@menu('UI/ScrollListItem')
export class ScrollListItem extends Component {

    /**滚动列表数据变更*/
    onItemRender(data: any, ...param: any[]) { }

    reset():void {}

}
