import { _decorator, SpriteFrame, Sprite, PageViewIndicator, PageView } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CustomPageViewIndicator')
export class CustomPageViewIndicator extends PageViewIndicator {
    @property({ type: SpriteFrame, tooltip: '选中时的图片' })
    selectedSpriteFrame: SpriteFrame = null!;

    @property({ type: SpriteFrame, tooltip: '未选中时的图片' })
    unselectedSpriteFrame: SpriteFrame = null!;

    _changedState() {
        // super._changedState();
        this._updateIndicatorSprites();
    }

    private _updateIndicatorSprites() {
        if (!this._pageView || !this.selectedSpriteFrame || !this.unselectedSpriteFrame) return;

        const indicators = this.node.children;
        const curPage = this._pageView.getCurrentPageIndex();

        for (let i = 0; i < indicators.length; i++) {
            const sprite = indicators[i].getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = i === curPage ? this.selectedSpriteFrame : this.unselectedSpriteFrame;
            }
        }
    }
}