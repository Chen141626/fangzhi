import fs from 'node:fs';
import crypto from 'node:crypto';

function readFrame(path) {
    const metadata = JSON.parse(fs.readFileSync(`${path}.meta`, 'utf8'));
    const uuid = metadata.subMetas?.f9941?.uuid;
    if (!uuid) throw new Error(`Missing SpriteFrame: ${path}`);
    return uuid;
}

function replaceArt(prefabText, name) {
    const oldFrame = readFrame(`assets/main/texture/${name}.png`);
    const newFrame = readFrame(`assets/resources/gui/home_fixed/${name}.png`);
    return prefabText.replaceAll(oldFrame, newFrame);
}

const imageNames = [
    'bg_home', 'character_cultivator',
    'event_daily_gift', 'event_encounter', 'event_growth_fund', 'event_limited',
    'event_recharge', 'event_server_rank', 'event_seven_day_login', 'event_value_pack',
    'hud_currency_jade', 'hud_currency_gold',
];
const mainPath = 'assets/main/prefab/main.prefab';
const buttonPath = 'assets/main/prefab/button.prefab';
let mainText = fs.readFileSync(mainPath, 'utf8');
let buttonText = fs.readFileSync(buttonPath, 'utf8');
for (const name of imageNames) {
    mainText = replaceArt(mainText, name);
    buttonText = replaceArt(buttonText, name);
}

const data = JSON.parse(mainText);
const nodeByName = (name) => data.findIndex((item) => item?.__type__ === 'cc.Node' && item._name === name);
const childByName = (parentId, name) => data[parentId]._children.map((child) => child.__id__).find((id) => data[id]._name === name);
const component = (node, type) => node._components.map((item) => data[item.__id__]).find((item) => item.__type__ === type);
function cloneNodeTree(sourceId, parentId, name) {
    const owned = new Set();
    function collect(nodeId) {
        const node = data[nodeId];
        owned.add(nodeId);
        if (node._prefab) owned.add(node._prefab.__id__);
        for (const reference of node._components) {
            const componentId = reference.__id__;
            owned.add(componentId);
            if (data[componentId].__prefab) owned.add(data[componentId].__prefab.__id__);
        }
        for (const child of node._children) collect(child.__id__);
    }
    collect(sourceId);
    const ids = [...owned].sort((a, b) => a - b);
    const remap = new Map(ids.map((id, index) => [id, data.length + index]));
    const rewrite = (value) => {
        if (!value || typeof value !== 'object') return;
        if (Number.isInteger(value.__id__) && remap.has(value.__id__)) value.__id__ = remap.get(value.__id__);
        for (const child of Object.values(value)) rewrite(child);
    };
    for (const id of ids) {
        const copy = structuredClone(data[id]);
        rewrite(copy);
        if (copy.fileId) copy.fileId = crypto.createHash('sha1').update(`main:${name}:${id}`).digest('base64').slice(0, 22);
        data.push(copy);
    }
    const copyId = remap.get(sourceId);
    const copy = data[copyId];
    copy._name = name;
    copy._parent = { __id__: parentId };
    return copyId;
}
function addSprite(name, parentId, framePath, x, y, width, height) {
    if (nodeByName(name) !== -1) return nodeByName(name);
    const id = cloneNodeTree(characterId, parentId, name);
    const node = data[id];
    node._lpos.x = x;
    node._lpos.y = y;
    node._lscale.x = 1;
    node._lscale.y = 1;
    component(node, 'cc.UITransform')._contentSize = { __type__: 'cc.Size', width, height };
    const sprite = component(node, 'cc.Sprite');
    sprite._spriteFrame.__uuid__ = readFrame(framePath);
    sprite._sizeMode = 0;
    data[parentId]._children.push({ __id__: id });
    return id;
}
function addLabel(name, parentId, value, x, y, width, height, fontSize, color) {
    if (nodeByName(name) !== -1) return nodeByName(name);
    const id = cloneNodeTree(275, parentId, name);
    const node = data[id];
    node._lpos.x = x;
    node._lpos.y = y;
    component(node, 'cc.UITransform')._contentSize = { __type__: 'cc.Size', width, height };
    const label = component(node, 'cc.Label');
    label._string = value;
    label._fontSize = fontSize;
    label._actualFontSize = fontSize;
    label._lineHeight = fontSize + 6;
    label._isBold = true;
    label._color = { __type__: 'cc.Color', ...color, a: 255 };
    label._outlineColor = { __type__: 'cc.Color', r: 255, g: 236, b: 177, a: 255 };
    label._outlineWidth = 1;
    data[parentId]._children.push({ __id__: id });
    return id;
}
const topId = nodeByName('top');
const bgId = nodeByName('bg');
const characterId = nodeByName('character_cultivator');
const character = data[characterId];
character._lscale.x = 0.94;
character._lscale.y = 0.94;
component(character, 'cc.UITransform')._contentSize.width = 330;
component(character, 'cc.UITransform')._contentSize.height = 465;
const bgWidget = component(data[bgId], 'cc.Widget');
bgWidget._originalWidth = 750;
bgWidget._originalHeight = 1600;
const hudHeadId = childByName(topId, 'head');
const portraitId = childByName(hudHeadId, 'head');
component(data[portraitId], 'cc.Sprite')._spriteFrame = {
    __uuid__: readFrame('assets/battleResult/texture/portrait_qingfeng_daotong.png'),
    __expectedType__: 'cc.SpriteFrame',
};
data[childByName(hudHeadId, 'name')]._lpos.x = 55;
const levelId = childByName(hudHeadId, 'lv');
data[levelId]._lpos.x = 26;
component(data[levelId], 'cc.Label')._string = '1级';
for (const name of ['Label', 'Label-001']) data[childByName(hudHeadId, name)]._active = false;
const powerId = childByName(hudHeadId, 'power');
data[powerId]._lpos.x = 52;
component(data[powerId], 'cc.UITransform')._contentSize.width = 190;
component(data[powerId], 'cc.Label')._string = '战力 0';

const taskId = nodeByName('task');
const taskNameId = childByName(taskId, 'name');
const taskDescriptionId = childByName(taskId, 'des');
data[taskNameId]._lpos.x = 22;
data[taskNameId]._lpos.y = 22;
data[taskDescriptionId]._lpos.x = 22;
data[taskDescriptionId]._lpos.y = -18;
component(data[taskNameId], 'cc.Label')._string = '修行任务';
const taskDescription = component(data[taskDescriptionId], 'cc.Label');
taskDescription._string = '挑战关卡\n0/1';
taskDescription._fontSize = 16;
taskDescription._actualFontSize = 16;
taskDescription._lineHeight = 18;

const bottomId = nodeByName('bottom');
for (const buttonName of ['btn_team', 'btn_role', 'btn_battle', 'btn_realm', 'btn_dao']) {
    const buttonId = childByName(bottomId, buttonName);
    data[childByName(buttonId, 'Label')]._active = true;
    if (buttonName === 'btn_dao') component(data[childByName(buttonId, 'Label')], 'cc.Label')._string = '召唤';
}

const moneyId = nodeByName('money');
const goldId = nodeByName('money-001');
data[moneyId]._lpos.x = 29;
data[goldId]._lpos.x = 154;

if (nodeByName('money-002') === -1) {
    const owned = new Set();
    function collect(nodeId) {
        const node = data[nodeId];
        owned.add(nodeId);
        if (node._prefab) owned.add(node._prefab.__id__);
        for (const reference of node._components) {
            const componentId = reference.__id__;
            owned.add(componentId);
            if (data[componentId].__prefab) owned.add(data[componentId].__prefab.__id__);
        }
        for (const child of node._children) collect(child.__id__);
    }
    collect(goldId);
    const ids = [...owned].sort((a, b) => a - b);
    const remap = new Map(ids.map((id, index) => [id, data.length + index]));
    const rewrite = (value) => {
        if (!value || typeof value !== 'object') return;
        if (Number.isInteger(value.__id__) && remap.has(value.__id__)) value.__id__ = remap.get(value.__id__);
        for (const child of Object.values(value)) rewrite(child);
    };
    for (const id of ids) {
        const copy = structuredClone(data[id]);
        rewrite(copy);
        if (copy.fileId) copy.fileId = crypto.createHash('sha1').update(`main:currency-crystal:${id}`).digest('base64').slice(0, 22);
        data.push(copy);
    }
    const crystalId = remap.get(goldId);
    const crystal = data[crystalId];
    crystal._name = 'money-002';
    crystal._lpos.x = 279;
    component(crystal, 'cc.Sprite')._spriteFrame.__uuid__ = readFrame('assets/resources/gui/home_fixed/hud_currency_crystal.png');
    const crystalNumber = data[crystal._children[0].__id__];
    component(crystalNumber, 'cc.Label')._string = '0';
    data[topId]._children.push({ __id__: crystalId });
}

const furnaceId = addSprite('furnaceDecoration', bgId, 'assets/main/texture/prop_furnace.png', 5, -95, 220, 244);
const children = data[bgId]._children;
const furnaceChildIndex = children.findIndex((child) => child.__id__ === furnaceId);
const characterChildIndex = children.findIndex((child) => child.__id__ === characterId);
if (furnaceChildIndex > characterChildIndex) {
    children.splice(furnaceChildIndex, 1);
    children.splice(characterChildIndex, 0, { __id__: furnaceId });
}
const refineId = addSprite('refineAction', bgId, 'assets/main/texture/btn_primary_refine.png', 12, -355, 245, 306);
addLabel('refineTitle', refineId, '炼器', 0, 5, 195, 80, 60, { r: 119, g: 59, b: 14 });
const challengeId = addSprite('challengeAction', bgId, 'assets/main/texture/panel_scroll_vertical.png', 260, -355, 207, 300);
addLabel('challengeTitle', challengeId, '去历练', 0, 76, 168, 60, 38, { r: 142, g: 65, b: 27 });
addLabel('challengeHint', challengeId, '挑战关卡\n获取修行资源', 0, -25, 175, 100, 24, { r: 57, g: 91, b: 106 });

fs.writeFileSync(mainPath, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(buttonPath, buttonText);
console.log('Main UI uses reimported art, three currencies, and separate center/challenge nodes.');
