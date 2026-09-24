import fs from 'node:fs';
import crypto from 'node:crypto';

const FONT_UUID = '14795b54-d353-4242-bb53-4d74b06fa88c';
const ROUND_RECT_TYPE = '0c642ae8t1G8oGNOOvlEI0M';
const TEAM_BACK_SPRITE = '7ec84c92-fc89-4408-9191-f30ad16fedf4@f9941';
const TEAM_AUTO_SPRITE = '0f811d64-2f1d-4975-8613-0f72420ea55a@f9941';
const TEAM_ADD_SLOT_SPRITE = 'cf63e3bf-200f-4dec-9da1-6170d8269afc@f9941';
const TEAM_CARD_NORMAL_SPRITE = '221f557b-4426-444e-aa3c-7f7f0ffc8eea@f9941';
const TEAM_BACKGROUND_SPRITE = 'b73156f4-dcce-4d9d-83a4-5ed59b4b33ad@f9941';
const SUMMON_BACKGROUND_SPRITE = 'fcbfc40f-b4e0-4a5f-b407-fc114a9916e8@f9941';
const SUMMON_TITLE_SPRITE = '9e3f7276-e160-42cc-bbc6-d060b1fb535b@f9941';
const SUMMON_TAB_SELECTED_SPRITE = 'aa28eca8-d9d3-4938-a1dd-aa22fd31b004@f9941';
const SUMMON_TAB_NORMAL_SPRITE = '1a871c3b-b37e-456e-9c0b-ae3843f1b428@f9941';
const SUMMON_PROBABILITY_SPRITE = '5a98fe82-aa62-438b-bf34-4638375f2c08@f9941';
const SUMMON_ONCE_SPRITE = '6ca317bb-e655-4361-872a-6bfc6dcdae36@f9941';
const SUMMON_TEN_SPRITE = '8a33c4f7-fe75-4833-82be-f5fdae7ec172@f9941';
const SUMMON_GALLERY_SPRITE = 'cda73d48-17b3-4f5d-b3c5-54ed6e426604@f9941';
const SUMMON_BANNER_SPRITE = '865dbe7d-131c-477d-a4c8-1d6cfeeb7ad2@f9941';
const SUMMON_ROLE_CARD_SPRITE = 'e817c26d-59b2-434c-b47b-a7500ccf8822@f9941';
const SUMMON_MONSTER_CARD_SPRITE = '9eea2b42-9cd3-4de2-9ab7-5659278dc107@f9941';
const SUMMON_TOKEN_SPRITE = 'dba789ec-c04c-46a5-bf35-6cbb8fa8c699@f9941';
const ELEMENT_SPRITES = {
    water: 'df2e0cc0-9d39-4531-b000-71f88a211dd9@f9941',
    fire: 'fefdab56-aba9-4c95-b889-1105aba016f2@f9941',
    wind: 'bbb5405c-858d-4603-b27e-5b3a6d780f1b@f9941',
    light: '5b88cb30-85ac-47cc-a91d-6697f05bbb7f@f9941',
    dark: '1e1e334f-d0df-4f4c-81fe-5836da4578cb@f9941',
};
const TEAM_MAIN_TYPE = compressUuid('dca5c62d-853d-4df8-b89f-3a0a193dc8e6');
const SUMMON_MAIN_TYPE = compressUuid('f48bf6ae-2449-4b84-8ec5-1509ab84d364');
const TASK_MAIN_TYPE = compressUuid('8bbd7489-df26-468b-acad-ec6db881ba44');
const SUMMON_SINGLE_COST = 100;
const SUMMON_TEN_COST = 900;

function compressUuid(uuid) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const value = uuid.replace(/-/g, '');
    let result = value.slice(0, 5);
    for (let index = 5; index < 32; index += 3) {
        const a = Number.parseInt(value[index], 16);
        const b = Number.parseInt(value[index + 1], 16);
        const c = Number.parseInt(value[index + 2], 16);
        result += chars[(a << 2) | (b >> 2)];
        result += chars[((b & 3) << 4) | c];
    }
    return result;
}

function fileId(key) {
    return crypto.createHash('sha1').update(key).digest('base64').slice(0, 22);
}

function ref(id) {
    return { __id__: id };
}

function color(value) {
    return { __type__: 'cc.Color', r: value[0], g: value[1], b: value[2], a: value[3] ?? 255 };
}

function createBuilder(prefabName) {
    const data = [{
        __type__: 'cc.Prefab',
        _name: prefabName,
        _objFlags: 0,
        __editorExtras__: {},
        _native: '',
        data: ref(1),
        optimizationPolicy: 0,
        persistent: false,
    }];
    let sequence = 0;
    const nextFileId = (kind) => fileId(`${prefabName}:${kind}:${sequence++}`);

    function push(value) {
        data.push(value);
        return data.length - 1;
    }

    function addComponent(nodeId, value, kind) {
        const componentId = push(value);
        const infoId = push({ __type__: 'cc.CompPrefabInfo', fileId: nextFileId(kind) });
        value.__prefab = ref(infoId);
        data[nodeId]._components.push(ref(componentId));
        return componentId;
    }

    function addNode(parentId, name, options = {}) {
        const nodeId = push({
            __type__: 'cc.Node',
            _name: name,
            _objFlags: 0,
            __editorExtras__: {},
            _parent: parentId == null ? null : ref(parentId),
            _children: [],
            _active: options.active ?? true,
            _components: [],
            _prefab: null,
            _lpos: { __type__: 'cc.Vec3', x: options.x ?? 0, y: options.y ?? 0, z: options.z ?? 0 },
            _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
            _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
            _mobility: 0,
            _layer: 33554432,
            _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 },
            _id: '',
        });
        if (parentId != null) data[parentId]._children.push(ref(nodeId));

        addComponent(nodeId, {
            __type__: 'cc.UITransform',
            _name: '',
            _objFlags: 0,
            __editorExtras__: {},
            node: ref(nodeId),
            _enabled: true,
            _prefab: null,
            _contentSize: { __type__: 'cc.Size', width: options.width ?? 100, height: options.height ?? 100 },
            _anchorPoint: { __type__: 'cc.Vec2', x: options.anchorX ?? 0.5, y: options.anchorY ?? 0.5 },
            _id: '',
        }, 'transform');

        if (options.spriteUuid !== undefined) addSprite(nodeId, options.spriteUuid, options.spriteColor);
        if (options.panelColor) addRoundedPanel(nodeId, options.width, options.height, options.panelColor, options.radius ?? 16, options.strokeColor);
        if (options.label != null) addLabel(nodeId, options);

        const prefabInfoId = push({
            __type__: 'cc.PrefabInfo',
            root: ref(1),
            asset: ref(0),
            fileId: nextFileId('node'),
            instance: null,
            targetOverrides: null,
            nestedPrefabInstanceRoots: null,
        });
        data[nodeId]._prefab = ref(prefabInfoId);
        return nodeId;
    }

    function addRoundedPanel(nodeId, width, height, fill, radius, stroke = [255, 255, 255, 0]) {
        const graphicsId = addComponent(nodeId, {
            __type__: 'cc.Graphics',
            _name: '',
            _objFlags: 0,
            __editorExtras__: {},
            node: ref(nodeId),
            _enabled: true,
            _prefab: null,
            _customMaterial: null,
            _srcBlendFactor: 2,
            _dstBlendFactor: 4,
            _color: color([255, 255, 255, 255]),
            _lineWidth: 0,
            _strokeColor: color(stroke),
            _lineJoin: 2,
            _lineCap: 0,
            _fillColor: color(fill),
            _miterLimit: 10,
            _id: '',
        }, 'graphics');
        addComponent(nodeId, {
            __type__: ROUND_RECT_TYPE,
            _name: '',
            _objFlags: 0,
            __editorExtras__: {},
            node: ref(nodeId),
            _enabled: true,
            _prefab: null,
            graphics: ref(graphicsId),
            _contentSize: { __type__: 'cc.Size', width, height },
            _cornerRadius: radius,
            _cornerMode: 0,
            _topLeftRadius: radius,
            _topRightRadius: radius,
            _bottomRightRadius: radius,
            _bottomLeftRadius: radius,
            _useGradient: false,
            _gradientDirection: 0,
            _gradientStartColor: color(fill),
            _gradientEndColor: color(fill),
            _lineWidth: 0,
            _useShadow: false,
            shadowLayers: [],
            _fillColor: color(fill),
            _strokeColor: color(stroke),
            _vertexConvexArcCenters: false,
            _concaveCorners: false,
            _segments: 10,
            _id: '',
        }, 'rounded');
    }

    function addSprite(nodeId, spriteUuid, tint = [255, 255, 255, 255]) {
        addComponent(nodeId, {
            __type__: 'cc.Sprite',
            _name: '',
            _objFlags: 0,
            __editorExtras__: {},
            node: ref(nodeId),
            _enabled: true,
            _prefab: null,
            _customMaterial: null,
            _srcBlendFactor: 2,
            _dstBlendFactor: 4,
            _color: color(tint),
            _spriteFrame: spriteUuid ? { __uuid__: spriteUuid, __expectedType__: 'cc.SpriteFrame' } : null,
            _type: 0,
            _fillType: 0,
            _sizeMode: 0,
            _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 },
            _fillStart: 0,
            _fillRange: 0,
            _isTrimmedMode: true,
            _useGrayscale: false,
            _atlas: null,
            _id: '',
        }, 'sprite');
    }

    function addLabel(nodeId, options) {
        addComponent(nodeId, {
            __type__: 'cc.Label',
            _name: '',
            _objFlags: 0,
            __editorExtras__: {},
            node: ref(nodeId),
            _enabled: true,
            _prefab: null,
            _customMaterial: null,
            _srcBlendFactor: 2,
            _dstBlendFactor: 4,
            _color: color(options.textColor ?? [255, 255, 255, 255]),
            _string: options.label,
            _horizontalAlign: options.horizontalAlign ?? 1,
            _verticalAlign: 1,
            _actualFontSize: options.fontSize ?? 24,
            _fontSize: options.fontSize ?? 24,
            _fontFamily: 'Arial',
            _lineHeight: options.lineHeight ?? Math.round((options.fontSize ?? 24) * 1.25),
            _overflow: options.overflow ?? 2,
            _enableWrapText: true,
            _font: { __uuid__: FONT_UUID, __expectedType__: 'cc.TTFFont' },
            _isSystemFontUsed: false,
            _spacingX: 0,
            _isItalic: false,
            _isBold: options.bold ?? false,
            _isUnderline: false,
            _underlineHeight: 2,
            _cacheMode: 0,
            _enableOutline: !!options.outlineColor,
            _outlineColor: color(options.outlineColor ?? [0, 0, 0, 255]),
            _outlineWidth: options.outlineWidth ?? 2,
            _enableShadow: !!options.shadowColor,
            _shadowColor: color(options.shadowColor ?? [0, 0, 0, 255]),
            _shadowOffset: { __type__: 'cc.Vec2', x: options.shadowX ?? 2, y: options.shadowY ?? 2 },
            _shadowBlur: options.shadowBlur ?? 2,
            _id: '',
        }, 'label');
    }

    function addWidget(nodeId) {
        addComponent(nodeId, {
            __type__: 'cc.Widget',
            _name: '',
            _objFlags: 0,
            __editorExtras__: {},
            node: ref(nodeId),
            _enabled: true,
            _prefab: null,
            _alignFlags: 45,
            _target: null,
            _left: 0,
            _right: 0,
            _top: 0,
            _bottom: 0,
            _horizontalCenter: 0,
            _verticalCenter: 0,
            _isAbsLeft: true,
            _isAbsRight: true,
            _isAbsTop: true,
            _isAbsBottom: true,
            _isAbsHorizontalCenter: true,
            _isAbsVerticalCenter: true,
            _originalWidth: 750,
            _originalHeight: 1600,
            _alignMode: 2,
            _lockFlags: 0,
            _id: '',
        }, 'widget');
    }

    function addScript(nodeId, type) {
        addComponent(nodeId, {
            __type__: type,
            _name: '',
            _objFlags: 0,
            __editorExtras__: {},
            node: ref(nodeId),
            _enabled: true,
            _prefab: null,
            _id: '',
        }, 'script');
    }

    return { data, addNode, addWidget, addScript };
}

function addButton(builder, parent, name, x, y, width, height, text, fill, spriteUuid) {
    const button = builder.addNode(parent, name, {
        x, y, width, height,
        panelColor: spriteUuid ? undefined : fill,
        spriteUuid,
        radius: 16,
    });
    builder.addNode(button, 'Label', { width: width - 18, height: height - 10, label: text, fontSize: 22 });
    return button;
}

function addArtButton(builder, parent, name, x, y, width, height, artUuid, artWidth, artHeight, text, fontSize = 22) {
    const button = builder.addNode(parent, name, { x, y, width, height });
    builder.addNode(button, 'art', { width: artWidth, height: artHeight, spriteUuid: artUuid });
    builder.addNode(button, 'Label', {
        width: width - 16, height: height - 10, label: text, fontSize, bold: true,
        textColor: [255, 244, 205], outlineColor: [57, 31, 11], outlineWidth: 2,
    });
    return button;
}

function buildTeamPrefab() {
    const b = createBuilder('team');
    const root = b.addNode(null, 'team', { width: 750, height: 1600 });
    b.addWidget(root);
    b.addScript(root, TEAM_MAIN_TYPE);
    b.addNode(root, 'background', { width: 750, height: 1600, spriteUuid: TEAM_BACKGROUND_SPRITE });

    const header = b.addNode(root, 'header', { y: 655, width: 720, height: 230 });
    b.addNode(header, 'titlePanel', {
        y: 78, width: 430, height: 82, panelColor: [247, 240, 213, 235], radius: 28,
        strokeColor: [215, 165, 72, 255],
    });
    b.addNode(header, 'title', {
        y: 78, width: 430, height: 82, label: '阵容编辑', fontSize: 48, bold: true,
        textColor: [31, 49, 67], outlineColor: [255, 245, 211], outlineWidth: 1,
    });
    b.addNode(header, 'tipPanel', { y: -32, width: 580, height: 86, panelColor: [245, 237, 210, 225], radius: 28, strokeColor: [215, 165, 72, 255] });
    b.addNode(header, 'tip', {
        y: -32, width: 540, height: 70, label: '角色和怪物伙伴均可上阵\n点击卡片调整上阵顺序', fontSize: 21,
        textColor: [36, 65, 81], outlineColor: [255, 248, 220], outlineWidth: 1,
    });
    addArtButton(b, header, 'btn_back', -314, 76, 105, 56, TEAM_BACK_SPRITE, 150, 57, '', 20);

    const formation = b.addNode(root, 'formationPanel', {
        y: 285, width: 710, height: 560, panelColor: [232, 245, 237, 225], radius: 28,
        strokeColor: [215, 165, 72, 245],
    });
    b.addNode(formation, 'sectionTitle', {
        y: 245, width: 300, height: 48, label: '当前阵容', fontSize: 28, bold: true,
        textColor: [30, 66, 80], outlineColor: [255, 247, 216], outlineWidth: 1,
    });
    b.addNode(formation, 'count', {
        x: 270, y: 245, width: 120, height: 44, label: '0 / 5', fontSize: 25, bold: true,
        textColor: [20, 113, 127], outlineColor: [255, 247, 216], outlineWidth: 1,
    });
    const slotPositions = [[-205, 100], [0, 135], [205, 100], [-105, -135], [105, -135]];
    for (let index = 0; index < 5; index++) {
        const [x, y] = slotPositions[index];
        const slot = b.addNode(formation, `formationSlot${index + 1}`, {
            x, y, width: 176, height: 214,
            panelColor: [226, 241, 239, 238], radius: 26, strokeColor: [252, 213, 90, 240],
        });
        b.addNode(slot, 'emptyArt', { y: 8, width: 176, height: 123, spriteUuid: TEAM_ADD_SLOT_SPRITE });
        b.addNode(slot, 'roleIcon', { y: 24, width: 142, height: 142, spriteUuid: null, active: false });
        b.addNode(slot, 'Label', {
            y: -69, width: 158, height: 62, label: `第${index + 1}位\n待上阵`, fontSize: 18, bold: true,
            textColor: [24, 62, 85], outlineColor: [255, 248, 220], outlineWidth: 1,
        });
    }

    const rolePanel = b.addNode(root, 'rolePanel', {
        y: -310, width: 720, height: 620, panelColor: [246, 241, 218, 248], radius: 28,
        strokeColor: [193, 139, 47, 240],
    });
    b.addNode(rolePanel, 'sectionTitle', {
        y: 286, width: 360, height: 48, label: '全部伙伴', fontSize: 29, bold: true,
        textColor: [28, 58, 91], outlineColor: [255, 247, 216], outlineWidth: 2,
    });
    for (let index = 0; index < 8; index++) {
        const column = index % 4;
        const actualRow = Math.floor(index / 4);
        const card = b.addNode(rolePanel, `roleCard${index + 1}`, {
            x: -258 + column * 172, y: 135 - actualRow * 270, width: 158, height: 258,
            spriteUuid: TEAM_CARD_NORMAL_SPRITE,
        });
        b.addNode(card, 'roleIcon', { y: 45, width: 132, height: 132, spriteUuid: null });
        b.addNode(card, 'elementIcon', { x: -53, y: 101, width: 36, height: 36, spriteUuid: ELEMENT_SPRITES.water });
        b.addNode(card, 'level', { x: 48, y: 105, width: 58, height: 28, label: '1级', fontSize: 17, bold: true, textColor: [255, 255, 255], outlineColor: [22, 53, 78], outlineWidth: 2 });
        b.addNode(card, 'name', { y: -28, width: 138, height: 32, label: '伙伴名称', fontSize: 18, bold: true, textColor: [31, 54, 72] });
        b.addNode(card, 'stars', { y: -59, width: 140, height: 28, label: '★★★★★', fontSize: 18, textColor: [235, 169, 35], outlineColor: [94, 60, 17], outlineWidth: 1 });
        b.addNode(card, 'power', { y: -88, width: 140, height: 28, label: '战力 0', fontSize: 16, textColor: [35, 60, 80] });
        b.addNode(card, 'Label', { y: -116, width: 140, height: 32, label: '未上阵', fontSize: 18, bold: true, textColor: [255, 255, 255], outlineColor: [15, 54, 91], outlineWidth: 2 });
    }

    const pagination = b.addNode(root, 'pagination', { y: -633, width: 500, height: 52 });
    addButton(b, pagination, 'btn_previous', -150, 0, 120, 48, '上一页', [116, 88, 55, 245]);
    b.addNode(pagination, 'page', { width: 130, height: 42, label: '1 / 1', fontSize: 20, bold: true, textColor: [91, 61, 26], outlineColor: [255, 247, 216], outlineWidth: 1 });
    addButton(b, pagination, 'btn_next', 150, 0, 120, 48, '下一页', [116, 88, 55, 245]);
    b.addNode(root, 'status', { y: -674, width: 620, height: 42, label: '', fontSize: 20, textColor: [105, 69, 25], outlineColor: [255, 247, 216], outlineWidth: 1 });

    b.addNode(root, 'actionPanel', {
        y: -733, width: 730, height: 134, panelColor: [242, 232, 202, 235], radius: 28,
        strokeColor: [193, 139, 47, 240],
    });
    const actions = b.addNode(root, 'actions', { y: -733, width: 720, height: 94 });
    addArtButton(b, actions, 'btn_auto', -235, 0, 205, 76, TEAM_AUTO_SPRITE, 212, 78, '', 20);
    addArtButton(b, actions, 'btn_save', 0, 0, 205, 76, SUMMON_ONCE_SPRITE, 480, 198, '保存阵容', 22);
    addArtButton(b, actions, 'btn_battle', 235, 0, 205, 76, SUMMON_TEN_SPRITE, 450, 125, '开始战斗', 22);
    return b.data;
}

function buildSummonPrefab() {
    const b = createBuilder('summon');
    const root = b.addNode(null, 'summon', { width: 750, height: 1600 });
    b.addWidget(root);
    b.addScript(root, SUMMON_MAIN_TYPE);
    b.addNode(root, 'background', { width: 750, height: 1600, spriteUuid: SUMMON_BACKGROUND_SPRITE });

    const header = b.addNode(root, 'header', { y: 662, width: 720, height: 250 });
    b.addNode(header, 'titlePlaque', { y: 42, width: 650, height: 190, spriteUuid: SUMMON_TITLE_SPRITE });
    b.addNode(header, 'title', {
        y: 47, width: 470, height: 76, label: '仙缘召唤', fontSize: 46, bold: true,
        textColor: [255, 235, 169], outlineColor: [74, 37, 70], outlineWidth: 3, shadowColor: [15, 12, 36, 180], shadowY: -3,
    });
    addArtButton(b, header, 'btn_back', -315, 65, 100, 54, TEAM_BACK_SPRITE, 145, 55, '', 18);
    const currency = b.addNode(header, 'currencyBar', { y: -77, width: 520, height: 56, panelColor: [47, 30, 55, 205], radius: 24, strokeColor: [238, 196, 86, 240] });
    b.addNode(currency, 'token', { x: -205, width: 46, height: 46, spriteUuid: SUMMON_TOKEN_SPRITE });
    b.addNode(header, 'currency', { y: -77, x: 25, width: 430, height: 50, label: '仙玉：0　角色：0　怪物：0', fontSize: 21, bold: true, textColor: [224, 239, 255], outlineColor: [20, 28, 68], outlineWidth: 2 });

    const tabs = b.addNode(root, 'poolTabs', { y: 515, width: 650, height: 84 });
    for (const [kind, x, text] of [['role', -155, '角色召唤'], ['monster', 155, '怪物召唤']]) {
        const tab = b.addNode(tabs, `${kind}Tab`, { x, width: 250, height: 72 });
        b.addNode(tab, 'normalArt', { width: 480, height: 132, spriteUuid: SUMMON_TAB_NORMAL_SPRITE, active: kind !== 'role' });
        b.addNode(tab, 'selectedArt', { width: 480, height: 132, spriteUuid: SUMMON_TAB_SELECTED_SPRITE, active: kind === 'role' });
        b.addNode(tab, 'elementIcon', { x: -82, width: 38, height: 38, spriteUuid: kind === 'role' ? ELEMENT_SPRITES.light : ELEMENT_SPRITES.dark });
        b.addNode(tab, 'Label', { x: 15, width: 180, height: 52, label: text, fontSize: 24, bold: true, textColor: kind === 'role' ? [255, 229, 145] : [201, 214, 233], outlineColor: [34, 28, 58], outlineWidth: 2 });
    }

    const probability = b.addNode(root, 'probability', { y: 441, width: 610, height: 80 });
    b.addNode(probability, 'art', { width: 1150, height: 90, spriteUuid: SUMMON_PROBABILITY_SPRITE });
    b.addNode(probability, 'Label', { width: 540, height: 56, label: '三星91.5% · 四星8% · 五星0.5%', fontSize: 20, textColor: [240, 227, 189], outlineColor: [29, 27, 61], outlineWidth: 2 });

    const resultPanel = b.addNode(root, 'resultPanel', { y: 70, width: 680, height: 670 });
    b.addNode(resultPanel, 'leftBanner', { x: -290, y: 20, width: 170, height: 390, spriteUuid: SUMMON_BANNER_SPRITE });
    b.addNode(resultPanel, 'bannerText', { x: -290, y: 33, width: 55, height: 210, label: '仙\n缘\n降\n临', fontSize: 28, bold: true, textColor: [49, 73, 85], outlineColor: [255, 245, 208], outlineWidth: 1 });
    b.addNode(resultPanel, 'results', { x: 42, width: 500, height: 300, label: '星门已启\n选择召唤次数，与新的伙伴结缘', fontSize: 27, bold: true, textColor: [245, 234, 201], outlineColor: [41, 35, 85], outlineWidth: 3, shadowColor: [12, 17, 48, 150], shadowY: -3 });
    for (let index = 0; index < 10; index++) {
        const column = index % 5;
        const row = Math.floor(index / 5);
        const card = b.addNode(resultPanel, `resultCard${index + 1}`, {
            x: -242 + column * 121, y: 145 - row * 265, width: 118, height: 232, active: false,
        });
        b.addNode(card, 'roleBg', { width: 118, height: 220, spriteUuid: SUMMON_ROLE_CARD_SPRITE });
        b.addNode(card, 'monsterBg', { width: 118, height: 220, spriteUuid: SUMMON_MONSTER_CARD_SPRITE, active: false });
        b.addNode(card, 'icon', { y: 34, width: 104, height: 122, spriteUuid: null });
        b.addNode(card, 'elementIcon', { x: -42, y: 83, width: 32, height: 32, spriteUuid: ELEMENT_SPRITES.water });
        b.addNode(card, 'stars', { y: -45, width: 104, height: 24, label: '★★★', fontSize: 16, textColor: [255, 196, 60], outlineColor: [71, 42, 20], outlineWidth: 1 });
        b.addNode(card, 'name', { y: -72, width: 104, height: 42, label: '伙伴名称', fontSize: 15, bold: true, textColor: [247, 241, 219], outlineColor: [20, 43, 66], outlineWidth: 2 });
        b.addNode(card, 'type', { y: -101, width: 104, height: 22, label: '角色', fontSize: 14, textColor: [179, 222, 247] });
    }
    b.addNode(root, 'status', { y: -342, width: 640, height: 58, label: '', fontSize: 23, bold: true, textColor: [255, 215, 111], outlineColor: [45, 31, 61], outlineWidth: 2 });

    const actions = b.addNode(root, 'actions', { y: -475, width: 720, height: 210 });
    const single = addArtButton(b, actions, 'btn_single', -205, 25, 220, 86, SUMMON_ONCE_SPRITE, 500, 210, '召唤1次', 22);
    b.addNode(single, 'cost', { y: -32, width: 180, height: 30, label: `仙玉×${SUMMON_SINGLE_COST}`, fontSize: 16, textColor: [210, 253, 255], outlineColor: [17, 68, 79], outlineWidth: 2 });
    const ten = addArtButton(b, actions, 'btn_ten', 55, 25, 240, 86, SUMMON_TEN_SPRITE, 520, 135, '召唤10次', 22);
    b.addNode(ten, 'cost', { y: -32, width: 190, height: 30, label: `仙玉×${SUMMON_TEN_COST}`, fontSize: 16, textColor: [255, 237, 182], outlineColor: [92, 48, 12], outlineWidth: 2 });
    addArtButton(b, actions, 'btn_roles', 270, 25, 150, 86, SUMMON_GALLERY_SPRITE, 400, 190, '阵容', 21);
    b.addNode(actions, 'tip', { y: -62, width: 640, height: 40, label: '十连召唤享九折 · 召唤结果立即加入伙伴列表', fontSize: 18, textColor: [225, 221, 246], outlineColor: [33, 30, 72], outlineWidth: 2 });
    return b.data;
}

function buildTaskPrefab() {
    const b = createBuilder('task');
    const root = b.addNode(null, 'task', { width: 750, height: 1600 });
    b.addWidget(root);
    b.addScript(root, TASK_MAIN_TYPE);
    b.addNode(root, 'background', { width: 750, height: 1600, panelColor: [13, 24, 42, 255], radius: 0 });

    const header = b.addNode(root, 'header', { y: 685, width: 700, height: 150 });
    b.addNode(header, 'title', { y: 24, width: 420, height: 70, label: '修行任务', fontSize: 42, bold: true, textColor: [255, 221, 132] });
    b.addNode(header, 'tip', { y: -40, width: 520, height: 42, label: '完成目标，领取修行资源', fontSize: 22, textColor: [180, 207, 235] });
    addButton(b, header, 'btn_back', -300, 24, 125, 58, '', [82, 78, 81, 255], TEAM_BACK_SPRITE);

    const tabs = b.addNode(root, 'tabs', { y: 555, width: 700, height: 80 });
    addButton(b, tabs, 'btn_main', -225, 0, 200, 64, '◆ 主线任务', [135, 91, 49, 255]);
    addButton(b, tabs, 'btn_daily', 0, 0, 200, 64, '每日任务', [49, 85, 119, 255]);
    addButton(b, tabs, 'btn_achievement', 225, 0, 200, 64, '成就', [49, 85, 119, 255]);
    b.addNode(root, 'summary', { y: 485, width: 650, height: 46, label: '主线任务　已领取 0/6　可领取 0', fontSize: 22, textColor: [255, 216, 128] });

    const list = b.addNode(root, 'list', { y: 25, width: 700, height: 880 });
    for (let index = 0; index < 5; index++) {
        const row = b.addNode(list, `taskRow${index + 1}`, {
            y: 350 - index * 175, width: 680, height: 158,
            panelColor: index % 2 === 0 ? [28, 52, 76, 250] : [24, 45, 68, 250], radius: 18,
        });
        b.addNode(row, 'title', { x: -205, y: 48, width: 310, height: 40, label: '任务标题', fontSize: 25, bold: true, textColor: [255, 225, 145], horizontalAlign: 0 });
        b.addNode(row, 'description', { x: -205, y: 8, width: 310, height: 36, label: '完成任务目标', fontSize: 20, textColor: [212, 225, 241], horizontalAlign: 0 });
        b.addNode(row, 'progress', { x: -205, y: -34, width: 310, height: 34, label: '进度 0/1', fontSize: 19, textColor: [123, 215, 255], horizontalAlign: 0 });
        b.addNode(row, 'reward', { x: 80, y: -43, width: 245, height: 55, label: '奖励：金币×1000', fontSize: 18, textColor: [255, 210, 112] });
        addButton(b, row, 'btn_claim', 265, 24, 130, 62, '进行中', [66, 104, 135, 255]);
    }

    const pagination = b.addNode(root, 'pagination', { y: -465, width: 500, height: 70 });
    addButton(b, pagination, 'btn_previous', -170, 0, 125, 56, '上一页', [54, 82, 110, 255]);
    b.addNode(pagination, 'page', { width: 140, height: 46, label: '1 / 1', fontSize: 21 });
    addButton(b, pagination, 'btn_next', 170, 0, 125, 56, '下一页', [54, 82, 110, 255]);

    const footer = b.addNode(root, 'footer', { y: -565, width: 700, height: 90 });
    addButton(b, footer, 'btn_claim_all', 0, 0, 260, 70, '一键领取', [151, 91, 43, 255]);
    b.addNode(root, 'status', { y: -655, width: 650, height: 58, label: '', fontSize: 21, textColor: [255, 215, 119] });
    return b.data;
}

function appendRoleGrowthPanel(roleData) {
    const root = roleData[1];
    const existingId = root._children.find((item) => roleData[item.__id__]?._name === 'growthPanel')?.__id__;
    const roleBackgroundId = root._children.find((item) => roleData[item.__id__]?._name === 'bg')?.__id__;
    const findDirectChild = (parentId, name) => roleData[parentId]?._children
        ?.map((item) => item.__id__)
        .find((id) => roleData[id]?._name === name);
    const findComponent = (nodeId, type) => roleData[nodeId]?._components
        ?.map((item) => roleData[item.__id__])
        .find((component) => component?.__type__ === type);

    if (roleBackgroundId != null) {
        const attributePanelId = findDirectChild(roleBackgroundId, 'bg');
        for (const name of ['crit', 'rate', 'reslst', 'accuracy']) {
            const nodeId = attributePanelId == null ? null : findDirectChild(attributePanelId, name);
            if (nodeId != null) roleData[nodeId]._active = false;
        }
        const roleListId = findDirectChild(roleBackgroundId, 'roleList');
        const roleListTransform = roleListId == null ? null : findComponent(roleListId, 'cc.UITransform');
        if (roleListTransform) roleListTransform._contentSize.height = 180;
    }

    if (existingId != null) {
        roleData[existingId]._lpos.y = -505;
        const panelTransform = findComponent(existingId, 'cc.UITransform');
        const panelController = findComponent(existingId, ROUND_RECT_TYPE);
        if (panelTransform) panelTransform._contentSize.height = 210;
        if (panelController) panelController._contentSize.height = 210;
        const growthInfoId = findDirectChild(existingId, 'growthInfo');
        const growthStatusId = findDirectChild(existingId, 'growthStatus');
        if (growthInfoId != null) roleData[growthInfoId]._lpos.y = 60;
        if (growthStatusId != null) roleData[growthStatusId]._lpos.y = -76;
        return roleData;
    }

    const prefabName = 'role-growth';
    let sequence = 0;
    const push = (value) => { roleData.push(value); return roleData.length - 1; };
    const addInfo = (kind) => push({ __type__: 'cc.CompPrefabInfo', fileId: fileId(`${prefabName}:${kind}:${sequence++}`) });
    const addComponent = (nodeId, value, kind) => {
        const componentId = push(value);
        const infoId = addInfo(kind);
        value.__prefab = ref(infoId);
        roleData[nodeId]._components.push(ref(componentId));
        return componentId;
    };
    const addNode = (parentId, name, options = {}) => {
        const nodeId = push({
            __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parentId),
            _children: [], _active: true, _components: [], _prefab: null,
            _lpos: { __type__: 'cc.Vec3', x: options.x ?? 0, y: options.y ?? 0, z: 0 },
            _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
            _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 }, _mobility: 0, _layer: 33554432,
            _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 }, _id: '',
        });
        roleData[parentId]._children.push(ref(nodeId));
        addComponent(nodeId, {
            __type__: 'cc.UITransform', _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(nodeId),
            _enabled: true, __prefab: null,
            _contentSize: { __type__: 'cc.Size', width: options.width, height: options.height },
            _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 }, _id: '',
        }, 'transform');
        if (options.panelColor) {
            const graphicsId = addComponent(nodeId, {
                __type__: 'cc.Graphics', _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(nodeId),
                _enabled: true, __prefab: null, _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
                _color: color([255, 255, 255]), _lineWidth: 0, _strokeColor: color([255, 255, 255, 0]),
                _lineJoin: 2, _lineCap: 0, _fillColor: color(options.panelColor), _miterLimit: 10, _id: '',
            }, 'graphics');
            addComponent(nodeId, {
                __type__: ROUND_RECT_TYPE, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(nodeId),
                _enabled: true, __prefab: null, graphics: ref(graphicsId),
                _contentSize: { __type__: 'cc.Size', width: options.width, height: options.height },
                _cornerRadius: options.radius ?? 16, _cornerMode: 0, _useGradient: false, _lineWidth: 0,
                _useShadow: false, shadowLayers: [], _fillColor: color(options.panelColor),
                _strokeColor: color([255, 255, 255, 0]), _vertexConvexArcCenters: false,
                _concaveCorners: false, _segments: 10, _id: '',
            }, 'rounded');
        }
        if (options.label != null) {
            addComponent(nodeId, {
                __type__: 'cc.Label', _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(nodeId),
                _enabled: true, __prefab: null, _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
                _color: color(options.textColor ?? [255, 255, 255]), _string: options.label,
                _horizontalAlign: 1, _verticalAlign: 1, _actualFontSize: options.fontSize ?? 22,
                _fontSize: options.fontSize ?? 22, _fontFamily: 'Arial',
                _lineHeight: Math.round((options.fontSize ?? 22) * 1.2), _overflow: 2, _enableWrapText: true,
                _font: { __uuid__: FONT_UUID, __expectedType__: 'cc.TTFFont' }, _isSystemFontUsed: false,
                _spacingX: 0, _isItalic: false, _isBold: false, _isUnderline: false, _underlineHeight: 2,
                _cacheMode: 0, _enableOutline: false, _outlineColor: color([0, 0, 0]), _outlineWidth: 2,
                _enableShadow: false, _shadowColor: color([0, 0, 0]),
                _shadowOffset: { __type__: 'cc.Vec2', x: 2, y: 2 }, _shadowBlur: 2, _id: '',
            }, 'label');
        }
        const prefabInfoId = push({
            __type__: 'cc.PrefabInfo', root: ref(1), asset: ref(0), fileId: fileId(`${prefabName}:node:${sequence++}`),
            instance: null, targetOverrides: null, nestedPrefabInstanceRoots: null,
        });
        roleData[nodeId]._prefab = ref(prefabInfoId);
        return nodeId;
    };

    const panel = addNode(1, 'growthPanel', { x: 0, y: -505, width: 700, height: 210, panelColor: [13, 31, 50, 245], radius: 22 });
    addNode(panel, 'growthInfo', { x: 0, y: 60, width: 650, height: 65, label: '等级 1/10　技能 Lv.1/2\n升级、升星与技能研习消耗\n持有资源', fontSize: 20, textColor: [214, 228, 245] });
    addNode(panel, 'growthStatus', { x: 0, y: -76, width: 650, height: 42, label: '', fontSize: 20, textColor: [255, 213, 112] });
    for (const [name, x, text] of [['btn_level_up', -225, '升级'], ['btn_star_up', 0, '升星'], ['btn_skill_up', 225, '技能研习']]) {
        const button = addNode(panel, name, { x, y: -5, width: 190, height: 72, panelColor: [58, 110, 151, 255], radius: 16 });
        addNode(button, 'Label', { x: 0, y: 0, width: 174, height: 62, label: text, fontSize: 23 });
    }
    return roleData;
}

fs.writeFileSync('assets/team/prefab/team.prefab', `${JSON.stringify(buildTeamPrefab(), null, 2)}\n`);
fs.writeFileSync('assets/team/prefab/summon.prefab', `${JSON.stringify(buildSummonPrefab(), null, 2)}\n`);
fs.writeFileSync('assets/team/prefab/task.prefab', `${JSON.stringify(buildTaskPrefab(), null, 2)}\n`);
const roleData = JSON.parse(fs.readFileSync('assets/role/prefab/role.prefab', 'utf8'));
fs.writeFileSync('assets/role/prefab/role.prefab', `${JSON.stringify(appendRoleGrowthPanel(roleData), null, 2)}\n`);
console.log('Generated team, summon, task and role growth prefab hierarchies.');
