'use strict';

const assert = require('assert');
const path = require('path');

const imageAssets = [
    { uuid: 'texture', url: 'db://assets/a.png', importer: 'image', isDirectory: false, readonly: false },
    { uuid: 'sprite', url: 'db://assets/b.png', importer: 'image', isDirectory: false, readonly: false },
    { uuid: 'internal', url: 'db://internal/c.png', importer: 'image', isDirectory: false, readonly: false },
    { uuid: 'readonly', url: 'db://assets/d.png', importer: 'image', isDirectory: false, readonly: true },
];

const metas = {
    texture: {
        importer: 'image',
        userData: { type: 'texture', hasAlpha: true },
        subMetas: {
            texture: {
                importer: 'texture',
                name: 'texture',
                userData: {
                    wrapModeS: 'repeat',
                    wrapModeT: 'repeat',
                    mipfilter: 'linear',
                },
            },
        },
    },
    sprite: { importer: 'image', userData: { type: 'sprite-frame' } },
};

const saved = [];
const dialogs = [];

global.Editor = {
    Message: {
        async request(channel, message, ...args) {
            assert.strictEqual(channel, 'asset-db');
            if (message === 'query-ready') return true;
            if (message === 'query-assets') return imageAssets;
            if (message === 'query-asset-meta') return JSON.parse(JSON.stringify(metas[args[0]]));
            if (message === 'save-asset-meta') {
                saved.push({ uuid: args[0], meta: JSON.parse(args[1]) });
                return { uuid: args[0] };
            }
            throw new Error(`Unexpected message: ${message}`);
        },
    },
    Dialog: {
        async warn(message, options) {
            dialogs.push({ type: 'warn', message, options });
            return { response: 0 };
        },
        async info(message, options) {
            dialogs.push({ type: 'info', message, options });
            return { response: 0 };
        },
        async error(message, options) {
            dialogs.push({ type: 'error', message, options });
            return { response: 0 };
        },
    },
};

async function run() {
    const extension = require(path.resolve(__dirname, '..', 'main.js'));
    await extension.methods.convertAll();

    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].uuid, 'texture');
    assert.strictEqual(saved[0].meta.userData.type, 'sprite-frame');
    assert.strictEqual(saved[0].meta.userData.hasAlpha, true);
    assert.strictEqual(saved[0].meta.subMetas.texture.userData.wrapModeS, 'clamp-to-edge');
    assert.strictEqual(saved[0].meta.subMetas.texture.userData.wrapModeT, 'clamp-to-edge');
    assert.strictEqual(saved[0].meta.subMetas.texture.userData.mipfilter, 'none');
    assert.strictEqual(dialogs.some((dialog) => dialog.type === 'error'), false);
    assert.strictEqual(dialogs.at(-1).type, 'info');
    console.log('image-to-sprite-frame tests passed');
}

run().catch((reason) => {
    console.error(reason);
    process.exitCode = 1;
});
