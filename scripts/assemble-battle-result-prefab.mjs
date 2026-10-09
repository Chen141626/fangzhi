import fs from 'node:fs';
import crypto from 'node:crypto';

// The battle screen already has its unit slots. Add only the result artwork and
// data placeholders so the result can be inspected and edited in Creator.
const prefabPath = 'assets/battle/prefab/battle.prefab';
const data = JSON.parse(fs.readFileSync(prefabPath, 'utf8'));
if (data.some((item) => item.__type__ === 'cc.Node' && item._name === 'resultLayer')) {
    console.log('battle result hierarchy already present');
    process.exit(0);
}

const ref = (id) => ({ __id__: id });
const color = ([r, g, b, a = 255]) => ({ __type__: 'cc.Color', r, g, b, a });
const id = (key) => crypto.createHash('sha1').update(`battle-result:${key}`).digest('base64').slice(0, 22);
const push = (value) => { data.push(value); return data.length - 1; };
const spriteUuid = (path) => {
    const meta = JSON.parse(fs.readFileSync(`${path}.meta`, 'utf8'));
    const uuid = meta.subMetas?.f9941?.uuid;
    if (!uuid) throw new Error(`Missing SpriteFrame: ${path}`);
    return uuid;
};
const art = (name) => `assets/battleResult/texture/${name}.png`;
const common = (name) => `assets/resources/gui/common/texture/${name}.png`;
const rewardIcon = (name) => `assets/resources/gui/common/home_popups/${name}.png`;

function component(nodeId, type, key, properties) {
    const index = push({
        __type__: type, _name: '', _objFlags: 0, __editorExtras__: {},
        node: ref(nodeId), _enabled: true, _prefab: null, ...properties, _id: '',
    });
    const info = push({ __type__: 'cc.CompPrefabInfo', fileId: id(`${key}:component:${type}`) });
    data[index].__prefab = ref(info);
    data[nodeId]._components.push(ref(index));
    return index;
}

function node(parent, name, x, y, width, height, active = true) {
    const key = `${data[parent]._name}/${name}:${data.length}`;
    const index = push({
        __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {},
        _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null,
        _lpos: { __type__: 'cc.Vec3', x, y, z: 0 },
        _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 },
        _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
        _mobility: 0, _layer: 33554432,
        _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 }, _id: '',
    });
    data[parent]._children.push(ref(index));
    component(index, 'cc.UITransform', key, {
        _contentSize: { __type__: 'cc.Size', width, height },
        _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 },
    });
    const prefabInfo = push({
        __type__: 'cc.PrefabInfo', root: ref(1), asset: ref(0), fileId: id(`${key}:node`),
        instance: null, targetOverrides: null, nestedPrefabInstanceRoots: null,
    });
    data[index]._prefab = ref(prefabInfo);
    return index;
}

function image(parent, name, path, x, y, width, height, active = true) {
    const index = node(parent, name, x, y, width, height, active);
    component(index, 'cc.Sprite', `${name}:${index}`, {
        _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
        _color: color([255, 255, 255]),
        _spriteFrame: { __uuid__: spriteUuid(path), __expectedType__: 'cc.SpriteFrame' },
        _type: 0, _fillType: 0, _sizeMode: 0,
        _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 },
        _fillStart: 0, _fillRange: 0, _isTrimmedMode: true,
        _useGrayscale: false, _atlas: null,
    });
    return index;
}

function label(parent, name, value, x, y, width, height, fontSize, tint, align = 1) {
    const index = node(parent, name, x, y, width, height);
    component(index, 'cc.Label', `${name}:${index}`, {
        _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4,
        _color: color(tint), _string: value,
        _horizontalAlign: align, _verticalAlign: 1,
        _actualFontSize: fontSize, _fontSize: fontSize,
        _fontFamily: 'Arial', _lineHeight: Math.round(fontSize * 1.2),
        _overflow: 2, _enableWrapText: true,
        _font: { __uuid__: '14795b54-d353-4242-bb53-4d74b06fa88c', __expectedType__: 'cc.TTFFont' },
        _isSystemFontUsed: false, _spacingX: 0,
        _isItalic: false, _isBold: false, _isUnderline: false, _underlineHeight: 2,
        _cacheMode: 0, _enableOutline: true, _outlineColor: color([42, 28, 21]), _outlineWidth: 2,
        _enableShadow: false, _shadowColor: color([0, 0, 0]),
        _shadowOffset: { __type__: 'cc.Vec2', x: 2, y: 2 }, _shadowBlur: 2,
    });
    return index;
}

function button(parent, name, artName, title, x, y, width, height, fontSize = 30) {
    const index = image(parent, name, art(artName), x, y, width, height);
    label(index, 'Label', title, 0, 1, width - 24, height - 18, fontSize, [255, 239, 186]);
    return index;
}

const result = node(1, 'resultLayer', 0, 0, 750, 1600, false);
const victory = node(result, 'victoryState', 0, 0, 750, 1600);
image(victory, 'background', art('result_victory_background_750x1600'), 0, 0, 750, 1600);
image(victory, 'timeChip', art('time_chip_defeat_empty'), 266, 748, 203, 54);
label(victory, 'battleTime', '历经 08 回合', 279, 748, 174, 40, 21, [255, 227, 155]);
image(victory, 'recordChip', art('best_record_chip_empty'), 266, 686, 203, 60);
label(victory, 'bestRecord', '最佳 08 回合', 278, 686, 174, 40, 20, [255, 227, 155]);
image(victory, 'header', art('header_victory_empty'), 0, 554, 554, 331);
label(victory, 'title', '战斗胜利', 0, 530, 480, 104, 76, [255, 211, 84]);
label(victory, 'stageName', '试炼·山门外阵', 0, 418, 430, 50, 31, [255, 234, 171]);
image(victory, 'stars', art('victory_stars_3'), 0, 323, 304, 97);
image(victory, 'rewardPanel', art('panel_rewards_empty'), 0, 50, 676, 418);
image(victory, 'rewardTitle', art('title_battle_rewards_empty'), 0, 248, 293, 63);
label(victory, 'rewardTitleText', '战斗奖励', 0, 248, 230, 52, 39, [255, 226, 153]);
const sampleRewards = [
    ['reward_gold_ingot_100x100', '120000'],
    ['reward_jade_100x100', '150'],
    ['reward_crystal_100x100', '20'],
    ['reward_chest_red_100x100', '1'],
];
for (let i = 0; i < 4; i++) {
    const slot = image(victory, `rewardSlot${i + 1}`, common('reward_item_slot'), -225 + i * 150, 83, 125, 125);
    image(slot, 'icon', rewardIcon(sampleRewards[i][0]), 0, 10, 86, 86);
    label(slot, 'amount', sampleRewards[i][1], 0, -43, 112, 31, 22, [255, 248, 215]);
}
label(victory, 'rewardNote', '首通奖励', 0, -98, 550, 43, 24, [106, 67, 34]);
image(victory, 'growthPanel', art('panel_rewards_empty'), 0, -398, 676, 418);
image(victory, 'growthTitle', art('title_team_growth_empty'), 0, -204, 289, 60);
label(victory, 'growthTitleText', '队伍表现', 0, -204, 250, 50, 36, [255, 226, 153]);
const portraits = [
    'portrait_qingfeng_daotong', 'portrait_qingxiao_swordsman',
    'portrait_xuanbing_dragon', 'portrait_jiuxiao_fairy', 'portrait_lingmeng_daotong',
];
for (let i = 0; i < 5; i++) {
    const row = node(victory, `allyRow${i + 1}`, 0, -265 - 69 * i, 614, 69);
    image(row, 'portrait', art(portraits[i]), -252, 0, 67, 67);
    label(row, 'name', `参战角色${i + 1}`, -140, 0, 155, 48, 23, [80, 47, 28], 0);
    label(row, 'stats', '伤害 0 · 治疗 0', 105, 0, 313, 48, 20, [85, 56, 36], 0);
}
button(victory, 'btn_battle_replay', 'btn_back_map_defeat_empty', '战斗回放', -206, -621, 190, 58, 24);
button(victory, 'btn_battle_log', 'btn_back_map_defeat_empty', '详细日志', 0, -621, 190, 58, 24);
button(victory, 'btn_next_stage', 'btn_retry_victory_empty', '下一关', 206, -621, 190, 58, 24);
button(victory, 'btn_restart', 'btn_retry_victory_empty', '再次挑战', -168, -719, 286, 95, 38);
button(victory, 'btn_back', 'btn_back_map_victory_empty', '返回首页', 168, -719, 284, 95, 38);

const defeat = node(result, 'defeatState', 0, 0, 750, 1600, false);
image(defeat, 'background', art('result_defeat_background_750x1600'), 0, 0, 750, 1600);
image(defeat, 'timeChip', art('time_chip_defeat_empty'), 266, 747, 203, 54);
label(defeat, 'battleTime', '历经 08 回合', 279, 747, 174, 40, 21, [255, 227, 155]);
image(defeat, 'header', art('header_defeat_empty'), 0, 581, 541, 251);
label(defeat, 'title', '战斗失败', 0, 592, 460, 97, 75, [228, 239, 255]);
label(defeat, 'stageName', '试炼·山门外阵', 0, 475, 420, 47, 30, [255, 236, 184]);
image(defeat, 'stars', art('defeat_stars_empty_3'), 0, 384, 279, 85);
image(defeat, 'statsPanel', art('panel_rewards_empty'), 0, 72, 676, 500);
image(defeat, 'statsTitle', art('title_battle_stats_empty'), 0, 310, 272, 56);
label(defeat, 'statsTitleText', '战斗统计', 0, 310, 250, 46, 37, [255, 226, 153]);
for (let i = 0; i < 5; i++) {
    const row = node(defeat, `allyRow${i + 1}`, 0, 227 - 83 * i, 614, 79);
    image(row, 'portrait', art(portraits[i]), -252, 0, 70, 70);
    label(row, 'name', `参战角色${i + 1}`, -125, 17, 160, 30, 22, [77, 47, 31], 0);
    label(row, 'hp', '0/0', 33, 17, 120, 28, 18, [82, 53, 36]);
    image(row, 'hpBar', art('hp_bar_empty'), -64, -20, 292, 18);
    label(row, 'stats', '伤害 0\n治疗 0', 210, 0, 180, 58, 18, [82, 53, 36], 0);
}
image(defeat, 'advicePanel', art('panel_rewards_empty'), 0, -383, 676, 376);
image(defeat, 'adviceTitle', art('title_improvement_advice_empty'), 0, -209, 283, 59);
label(defeat, 'adviceTitleText', '提升建议', 0, -209, 255, 49, 37, [255, 226, 153]);
const advice = [
    ['advice_strengthen_character', '强化角色', '提升角色等级，强化装备与神兵'],
    ['advice_upgrade_skills', '升级技能', '升级主动与被动技能，提升战斗效果'],
    ['advice_adjust_team', '调整阵容', '合理搭配阵容，激活更多羁绊效果'],
];
for (let i = 0; i < advice.length; i++) {
    const row = node(defeat, `adviceRow${i + 1}`, 0, -281 - i * 84, 614, 78);
    image(row, 'icon', art(advice[i][0]), -250, 0, 74, 74);
    label(row, 'title', advice[i][1], -88, 17, 255, 32, 24, [76, 44, 28], 0);
    label(row, 'description', advice[i][2], 30, -17, 480, 34, 20, [87, 55, 37], 0);
}
button(defeat, 'btn_battle_replay', 'btn_back_map_defeat_empty', '战斗回放', -119, -575, 205, 58, 24);
button(defeat, 'btn_battle_log', 'btn_back_map_defeat_empty', '详细日志', 119, -575, 205, 58, 24);
button(defeat, 'btn_restart', 'btn_retry_defeat_empty', '重新挑战', -166, -669, 276, 87, 36);
button(defeat, 'btn_power_up', 'btn_power_up_empty', '提升战力', 166, -669, 286, 87, 36);
button(defeat, 'btn_back', 'btn_back_map_defeat_empty', '返回首页', 0, -761, 228, 69, 29);

fs.writeFileSync(prefabPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(`battle result added: ${data.length} objects`);
