import { resources, SpriteFrame, Texture2D } from 'cc';

type SpriteFrameCallback = (error: Error | null, frame: SpriteFrame | null) => void;

const runtimeFrameCache = new Map<string, SpriteFrame>();

/**
 * 兼容 Cocos 中两种 PNG 导入方式：优先读取 spriteFrame，若资源被导入为
 * Texture2D，则使用整张纹理即时生成 SpriteFrame。用于历史资源平滑迁移。
 */
export function loadSpriteFrameCompat(path: string, callback: SpriteFrameCallback): void {
    const cached = runtimeFrameCache.get(path);
    if (cached?.isValid) {
        callback(null, cached);
        return;
    }

    resources.load(path, SpriteFrame, (frameError, frame) => {
        if (!frameError && frame) {
            runtimeFrameCache.set(path, frame);
            callback(null, frame);
            return;
        }

        const texturePath = path.replace(/\/spriteFrame$/, '');
        resources.load(texturePath, Texture2D, (textureError, texture) => {
            if (textureError || !texture) {
                callback((textureError ?? frameError) as Error, null);
                return;
            }
            const runtimeFrame = new SpriteFrame();
            runtimeFrame.texture = texture;
            runtimeFrameCache.set(path, runtimeFrame);
            callback(null, runtimeFrame);
        });
    });
}
