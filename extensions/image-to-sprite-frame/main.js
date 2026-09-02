'use strict';

const ASSET_ROOT = 'db://assets/';
const TARGET_TYPE = 'sprite-frame';
const LOG_PREFIX = '[image-to-sprite-frame]';

let converting = false;

function log(message) {
    console.log(`${LOG_PREFIX} ${message}`);
}

function warn(message) {
    console.warn(`${LOG_PREFIX} ${message}`);
}

function error(message, reason) {
    console.error(`${LOG_PREFIX} ${message}`, reason || '');
}

async function queryProjectImages() {
    const assets = await Editor.Message.request('asset-db', 'query-assets', {
        importer: 'image',
    });

    return assets
        .filter((asset) => !asset.isDirectory)
        .filter((asset) => !asset.readonly)
        .filter((asset) => typeof asset.url === 'string' && asset.url.startsWith(ASSET_ROOT));
}

async function collectTargets(images) {
    const targets = [];
    const failures = [];

    for (const asset of images) {
        try {
            const meta = await Editor.Message.request('asset-db', 'query-asset-meta', asset.uuid);
            if (!meta) {
                failures.push(`${asset.url}：无法读取 meta`);
                continue;
            }

            if (!meta.userData || meta.userData.type !== TARGET_TYPE) {
                targets.push({ asset, meta });
            }
        } catch (reason) {
            failures.push(`${asset.url}：${formatReason(reason)}`);
        }
    }

    return { targets, failures };
}

async function saveTargets(targets) {
    const failures = [];
    let converted = 0;

    for (let index = 0; index < targets.length; index += 1) {
        const { asset, meta } = targets[index];

        try {
            prepareMetaForSpriteFrame(meta);

            const result = await Editor.Message.request(
                'asset-db',
                'save-asset-meta',
                asset.uuid,
                JSON.stringify(meta),
            );

            if (!result) {
                failures.push(`${asset.url}：资源数据库未返回保存结果`);
                continue;
            }

            converted += 1;
        } catch (reason) {
            failures.push(`${asset.url}：${formatReason(reason)}`);
        }

        const processed = index + 1;
        if (processed % 25 === 0 || processed === targets.length) {
            log(`进度 ${processed}/${targets.length}`);
        }
    }

    return { converted, failures };
}

function prepareMetaForSpriteFrame(meta) {
    meta.userData = meta.userData || {};
    meta.userData.type = TARGET_TYPE;

    // Match Creator 3.8's Inspector behavior when the image type is changed
    // manually: sprite frames use Clamp and do not use mipmaps by default.
    const textureMeta = getTextureSubMeta(meta);
    if (!textureMeta) {
        return;
    }

    textureMeta.userData = textureMeta.userData || {};
    textureMeta.userData.wrapModeS = 'clamp-to-edge';
    textureMeta.userData.wrapModeT = 'clamp-to-edge';
    textureMeta.userData.mipfilter = 'none';
}

function getTextureSubMeta(meta) {
    meta.subMetas = meta.subMetas || {};

    const existing = Object.values(meta.subMetas).find((subMeta) => {
        return subMeta && (subMeta.name === 'texture' || subMeta.importer === 'texture');
    });
    if (existing) {
        return existing;
    }

    // Creator's own image Inspector uses this helper when the texture sub-meta
    // has not been generated yet. Keep the fallback optional for testability.
    const nameToSubId = Editor.Utils
        && Editor.Utils.UUID
        && Editor.Utils.UUID.nameToSubId;
    if (typeof nameToSubId !== 'function') {
        return null;
    }

    const textureKey = nameToSubId('texture');
    meta.subMetas[textureKey] = meta.subMetas[textureKey] || { userData: {} };
    return meta.subMetas[textureKey];
}

function formatReason(reason) {
    if (reason instanceof Error) {
        return reason.message;
    }
    return String(reason);
}

function formatFailureDetail(failures) {
    if (failures.length === 0) {
        return '';
    }

    const shown = failures.slice(0, 10);
    const remaining = failures.length - shown.length;
    const suffix = remaining > 0 ? `\n……另有 ${remaining} 项，请查看 Creator 控制台。` : '';
    return `${shown.join('\n')}${suffix}`;
}

async function showAlreadyRunning() {
    await Editor.Dialog.info('图片类型转换正在进行中，请等待当前任务完成。', {
        title: '图片转 sprite-frame',
    });
}

async function convertAll() {
    if (converting) {
        await showAlreadyRunning();
        return;
    }

    converting = true;

    try {
        const ready = await Editor.Message.request('asset-db', 'query-ready');
        if (!ready) {
            await Editor.Dialog.warn('资源数据库尚未就绪，请稍后重试。', {
                title: '图片转 sprite-frame',
            });
            return;
        }

        log('开始扫描 assets 下的图片资源……');
        const images = await queryProjectImages();
        const scan = await collectTargets(images);

        if (scan.targets.length === 0) {
            const detail = scan.failures.length > 0
                ? `扫描失败 ${scan.failures.length} 张：\n${formatFailureDetail(scan.failures)}`
                : `已检查 ${images.length} 张图片，无需修改。`;
            await Editor.Dialog.info('所有可处理图片都已经是 sprite-frame。', {
                title: '图片转 sprite-frame',
                detail,
            });
            return;
        }

        const confirmation = await Editor.Dialog.warn(
            `发现 ${scan.targets.length} 张图片需要改为 sprite-frame。`,
            {
                title: '确认批量修改',
                detail: [
                    `扫描到 ${images.length} 张项目图片；已是 sprite-frame 的图片会自动跳过。`,
                    '操作会由 Cocos Creator 资源数据库更新并重新导入相关资源。',
                    '执行前请先保存属性检查器中尚未应用的修改。',
                ].join('\n'),
                buttons: ['开始转换', '取消'],
                default: 0,
                cancel: 1,
            },
        );

        if (confirmation.response !== 0) {
            log('用户取消转换。');
            return;
        }

        log(`开始转换 ${scan.targets.length} 张图片……`);
        const saved = await saveTargets(scan.targets);
        const failures = [...scan.failures, ...saved.failures];

        failures.forEach((item) => warn(item));

        if (failures.length === 0) {
            await Editor.Dialog.info(`转换完成，共修改 ${saved.converted} 张图片。`, {
                title: '图片转 sprite-frame',
                detail: `扫描总数：${images.length}\n已修改：${saved.converted}\n失败：0`,
            });
            log(`转换完成，共修改 ${saved.converted} 张图片。`);
            return;
        }

        await Editor.Dialog.warn('转换完成，但有部分图片处理失败。', {
            title: '图片转 sprite-frame',
            detail: [
                `扫描总数：${images.length}`,
                `已修改：${saved.converted}`,
                `失败：${failures.length}`,
                '',
                formatFailureDetail(failures),
            ].join('\n'),
        });
    } catch (reason) {
        error('批量转换失败。', reason);
        await Editor.Dialog.error('批量转换失败，请查看 Cocos Creator 控制台。', {
            title: '图片转 sprite-frame',
            detail: formatReason(reason),
        });
    } finally {
        converting = false;
    }
}

exports.methods = {
    convertAll,
};

exports.load = function load() {
    log('扩展已加载。');
};

exports.unload = function unload() {
    converting = false;
};
