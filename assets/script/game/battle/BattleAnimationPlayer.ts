import {
    assetManager,
    AssetManager,
    Color,
    HorizontalTextAlignment,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    tween,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    VerticalTextAlignment,
    warn,
    resources,
} from 'cc';
import { BattleCamp, BattleLogEntry } from './BattleEffectTypes';

const IDLE_FRAME_COUNT = 4;
const ACTION_FRAME_COUNT = 6;
const HIT_FRAME_COUNT = 4;
const VFX_FRAME_COUNT = 6;
const FRAME_INTERVAL_MS = 85;
const UNIT_ANIMATION_CANVAS_SIZE = 640;

interface UnitAnimationFrames {
    idle: SpriteFrame[];
    action: SpriteFrame[];
    hit: SpriteFrame[];
    skillVfx: SpriteFrame[];
}

interface UnitAnimationBinding {
    unitId: string;
    configId: string;
    camp: BattleCamp;
    item: Node;
    overlay: Node;
    sprite: Sprite;
    alive: boolean;
    basePosition: Vec3;
    baseScale: Vec3;
}

export type BattleVfxStyle = 'basic' | 'skill' | 'none';

/** 统一管理战斗角色序列帧、命中特效、受击震动和飘字。 */
export class BattleAnimationPlayer {
    private readonly _frames = new Map<string, UnitAnimationFrames>();
    private readonly _bindings = new Map<string, UnitAnimationBinding>();
    private readonly _lockedUnits = new Set<string>();
    private readonly _transientNodes = new Set<Node>();
    private _skillBundle: AssetManager.Bundle | null = null;
    private _commonHitFrames: SpriteFrame[] = [];
    private _idleElapsed = 0;
    private _idleIndex = 0;

    bind(
        unitId: string,
        configId: string,
        camp: BattleCamp,
        item: Node,
        overlay: Node,
        sprite: Sprite,
    ): void {
        // 角色动画素材统一使用正方形画布。固定为 CUSTOM，避免 RAW 模式随每帧原图尺寸重排节点。
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.node.getComponent(UITransform)?.setContentSize(
            UNIT_ANIMATION_CANVAS_SIZE,
            UNIT_ANIMATION_CANVAS_SIZE,
        );
        this._bindings.set(unitId, {
            unitId,
            configId,
            camp,
            item,
            overlay,
            sprite,
            alive: true,
            basePosition: sprite.node.position.clone(),
            baseScale: sprite.node.scale.clone(),
        });
    }

    setAlive(unitId: string, alive: boolean): void {
        const binding = this._bindings.get(unitId);
        if (binding) binding.alive = alive;
    }

    /** 提前加载演示阵容需要的帧，避免战斗中途第一次施法卡顿。 */
    async preload(configIds: readonly string[]): Promise<void> {
        const uniqueIds = Array.from(new Set(configIds));
        this._skillBundle = await this.loadSkillBundle();
        if (this._skillBundle && !this._commonHitFrames.length) {
            this._commonHitFrames = await this.loadBundleSequence(
                this._skillBundle,
                'texture/skin_anim/common_hit_flash/common_hit_flash_4f_frames',
                HIT_FRAME_COUNT,
            );
        }

        await Promise.all(uniqueIds.map(async (configId) => {
            if (this._frames.has(configId)) return;
            const root = `gui/common/anim/${configId}_animations`;
            const [idle, action, hit, skillVfx] = await Promise.all([
                this.loadResourceSequence(`${root}/${configId}_idle_4f_frames`, IDLE_FRAME_COUNT),
                this.loadResourceSequence(`${root}/${configId}_skill_6f_frames`, ACTION_FRAME_COUNT),
                this.loadResourceSequence(`${root}/${configId}_hit_4f_frames`, HIT_FRAME_COUNT),
                this.loadUnitSkillVfx(configId),
            ]);
            this._frames.set(configId, { idle, action, hit, skillVfx });
        }));

    }

    update(deltaTime: number): void {
        this._idleElapsed += deltaTime;
        if (this._idleElapsed < 0.2) return;
        this._idleElapsed %= 0.2;
        this._idleIndex = (this._idleIndex + 1) % IDLE_FRAME_COUNT;

        for (const binding of this._bindings.values()) {
            if (!binding.alive || this._lockedUnits.has(binding.unitId) || !binding.sprite.isValid) continue;
            const idleFrames = this._frames.get(binding.configId)?.idle ?? [];
            if (idleFrames.length) binding.sprite.spriteFrame = idleFrames[this._idleIndex % idleFrames.length];
        }
    }

    reset(): void {
        this._lockedUnits.clear();
        this._idleElapsed = 0;
        this._idleIndex = 0;
        for (const node of this._transientNodes) {
            if (node.isValid) node.destroy();
        }
        this._transientNodes.clear();
        for (const binding of this._bindings.values()) {
            if (!binding.sprite.node.isValid) continue;
            Tween.stopAllByTarget(binding.sprite.node);
            binding.sprite.node.setPosition(binding.basePosition);
            binding.sprite.node.setScale(binding.baseScale);
            this.restoreIdleFrame(binding);
        }
    }

    async playAction(
        unitId: string,
        isBasicAttack: boolean,
        isCurrent: () => boolean,
    ): Promise<void> {
        const binding = this._bindings.get(unitId);
        if (!binding?.sprite.isValid) return;
        const frames = this._frames.get(binding.configId)?.action ?? [];
        this._lockedUnits.add(unitId);
        this.playActionMotion(binding, isBasicAttack);
        await this.playFrames(binding.sprite, frames, FRAME_INTERVAL_MS, isCurrent);
        this._lockedUnits.delete(unitId);
        if (isCurrent()) this.restoreIdleFrame(binding);
    }

    async playImpacts(
        logs: readonly BattleLogEntry[],
        style: BattleVfxStyle,
        casterConfigId: string | null,
        fallbackTargetId: string | null,
        isCurrent: () => boolean,
    ): Promise<void> {
        if (!isCurrent()) return;
        const vfxTargetIds = this.collectVfxTargets(logs);
        if (!vfxTargetIds.length && fallbackTargetId) vfxTargetIds.push(fallbackTargetId);
        const hitIds = Array.from(new Set(logs
            .filter((log) => log.type === 'damage' && (log.value ?? 0) > 0)
            .map((log) => log.targetUnitId)));

        const unitSkillVfx = casterConfigId
            ? this._frames.get(casterConfigId)?.skillVfx ?? []
            : [];
        const vfxFrames = style === 'skill'
            ? unitSkillVfx.length ? unitSkillVfx : this._commonHitFrames
            : style === 'basic' ? this._commonHitFrames : [];

        this.showFloatingValues(logs);
        await Promise.all([
            ...vfxTargetIds.map((unitId) => this.playVfx(unitId, vfxFrames, isCurrent)),
            ...hitIds.map((unitId) => this.playHit(unitId, isCurrent)),
        ]);
    }

    private playActionMotion(binding: UnitAnimationBinding, isBasicAttack: boolean): void {
        const node = binding.sprite.node;
        Tween.stopAllByTarget(node);
        const origin = binding.basePosition.clone();
        const scale = binding.baseScale.clone();
        if (isBasicAttack) {
            tween(node)
                .to(0.12, { position: new Vec3(origin.x + 34, origin.y, origin.z) }, { easing: 'quadOut' })
                .to(0.16, { position: origin }, { easing: 'quadIn' })
                .start();
        }
        else {
            tween(node)
                .to(0.12, { scale: new Vec3(scale.x * 1.06, scale.y * 1.06, scale.z) })
                .to(0.18, { scale })
                .start();
        }
    }

    private async playHit(unitId: string, isCurrent: () => boolean): Promise<void> {
        const binding = this._bindings.get(unitId);
        if (!binding?.sprite.isValid) return;
        // 反击可能在施法者动作尚未播完时命中施法者，等待当前帧序列结束再播受击。
        while (this._lockedUnits.has(unitId) && isCurrent()) await this.delay(25);
        if (!isCurrent() || !binding.sprite.isValid) return;
        const frames = this._frames.get(binding.configId)?.hit ?? [];
        const node = binding.sprite.node;
        const origin = binding.basePosition.clone();
        this._lockedUnits.add(unitId);
        Tween.stopAllByTarget(node);
        tween(node)
            .to(0.05, { position: new Vec3(origin.x - 12, origin.y, origin.z) })
            .to(0.05, { position: new Vec3(origin.x + 10, origin.y, origin.z) })
            .to(0.05, { position: new Vec3(origin.x - 6, origin.y, origin.z) })
            .to(0.06, { position: origin })
            .start();
        await this.playFrames(binding.sprite, frames, 75, isCurrent);
        this._lockedUnits.delete(unitId);
        if (isCurrent()) this.restoreIdleFrame(binding);
    }

    private async playVfx(
        unitId: string,
        frames: readonly SpriteFrame[],
        isCurrent: () => boolean,
    ): Promise<void> {
        const binding = this._bindings.get(unitId);
        if (!binding?.item.isValid || !frames.length || !isCurrent()) return;
        const node = new Node('battleVfx');
        node.layer = binding.item.layer;
        node.setPosition(0, 15);
        node.addComponent(UITransform).setContentSize(260, 260);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        binding.item.addChild(node);
        this._transientNodes.add(node);
        node.setSiblingIndex(Math.min(1, binding.item.children.length - 1));
        await this.playFrames(sprite, frames, 70, isCurrent);
        if (node.isValid) node.destroy();
        this._transientNodes.delete(node);
    }

    private showFloatingValues(logs: readonly BattleLogEntry[]): void {
        const damageByTarget = new Map<string, number>();
        const healByTarget = new Map<string, number>();
        for (const log of logs) {
            const value = Math.max(0, Math.round(log.value ?? 0));
            if (log.type === 'damage' && value > 0) {
                damageByTarget.set(log.targetUnitId, (damageByTarget.get(log.targetUnitId) ?? 0) + value);
            }
            if (log.type === 'heal' && value > 0) {
                healByTarget.set(log.targetUnitId, (healByTarget.get(log.targetUnitId) ?? 0) + value);
            }
        }
        for (const [unitId, value] of damageByTarget) {
            this.createFloatingText(unitId, `-${value}`, new Color(255, 102, 92));
        }
        for (const [unitId, value] of healByTarget) {
            this.createFloatingText(unitId, `+${value}`, new Color(99, 244, 137));
        }
    }

    private createFloatingText(unitId: string, text: string, color: Color): void {
        const binding = this._bindings.get(unitId);
        if (!binding?.overlay.isValid) return;
        const node = new Node('floatingValue');
        node.layer = binding.overlay.layer;
        node.setPosition(0, 245);
        node.addComponent(UITransform).setContentSize(180, 50);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = 32;
        label.lineHeight = 38;
        label.color = color;
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        const opacity = node.addComponent(UIOpacity);
        binding.overlay.addChild(node);
        this._transientNodes.add(node);
        tween(node)
            .by(0.58, { position: new Vec3(0, 75, 0) }, { easing: 'quadOut' })
            .call(() => {
                this._transientNodes.delete(node);
                if (node.isValid) node.destroy();
            })
            .start();
        tween(opacity).delay(0.28).to(0.3, { opacity: 0 }).start();
    }

    private collectVfxTargets(logs: readonly BattleLogEntry[]): string[] {
        // 混合型技能优先把技能特效放在攻击目标上，吸血/自愈只显示飘字，避免攻击特效打到自己。
        const offensiveTypes = new Set(['damage', 'controlResisted', 'miss']);
        const supportiveTypes = new Set(['heal', 'shield', 'buffApplied']);
        const offensiveTargets = Array.from(new Set(logs
            .filter((log) => offensiveTypes.has(log.type))
            .map((log) => log.targetUnitId)
            .filter((unitId) => this._bindings.has(unitId))));
        if (offensiveTargets.length) return offensiveTargets;
        return Array.from(new Set(logs
            .filter((log) => supportiveTypes.has(log.type))
            .map((log) => log.targetUnitId)
            .filter((unitId) => this._bindings.has(unitId))));
    }

    private restoreIdleFrame(binding: UnitAnimationBinding): void {
        const frames = this._frames.get(binding.configId)?.idle ?? [];
        if (binding.sprite.isValid && frames.length) binding.sprite.spriteFrame = frames[this._idleIndex % frames.length];
    }

    private async playFrames(
        sprite: Sprite,
        frames: readonly SpriteFrame[],
        intervalMs: number,
        isCurrent: () => boolean,
    ): Promise<void> {
        for (const frame of frames) {
            if (!isCurrent() || !sprite.isValid) return;
            sprite.spriteFrame = frame;
            await this.delay(intervalMs);
        }
    }

    private async loadUnitSkillVfx(configId: string): Promise<SpriteFrame[]> {
        if (!this._skillBundle) return [];
        const root = `texture/skin_anim/${configId}_skill/${configId}_skill_vfx_6f_frames`;
        return this.loadBundleSequence(this._skillBundle, root, VFX_FRAME_COUNT, false);
    }

    private async loadResourceSequence(root: string, count: number): Promise<SpriteFrame[]> {
        const result: SpriteFrame[] = [];
        for (let index = 1; index <= count; index++) {
            const path = `${root}/frame_${String(index).padStart(2, '0')}/spriteFrame`;
            const frame = await new Promise<SpriteFrame | null>((resolve) => {
                resources.load(path, SpriteFrame, (error, asset) => {
                    if (error || !asset) {
                        warn(`[BattleAnimation] 序列帧加载失败：${path}`);
                        resolve(null);
                        return;
                    }
                    resolve(asset);
                });
            });
            if (frame) result.push(frame);
        }
        return result;
    }

    private async loadBundleSequence(
        bundle: AssetManager.Bundle,
        root: string,
        count: number,
        reportMissing = true,
    ): Promise<SpriteFrame[]> {
        const result: SpriteFrame[] = [];
        for (let index = 1; index <= count; index++) {
            const path = `${root}/frame_${String(index).padStart(2, '0')}/spriteFrame`;
            const frame = await new Promise<SpriteFrame | null>((resolve) => {
                bundle.load(path, SpriteFrame, (error, asset) => {
                    if (error || !asset) {
                        if (reportMissing) warn(`[BattleAnimation] 特效帧加载失败：${path}`);
                        resolve(null);
                        return;
                    }
                    resolve(asset);
                });
            });
            if (frame) result.push(frame);
        }
        return result;
    }

    private loadSkillBundle(): Promise<AssetManager.Bundle | null> {
        const cached = assetManager.getBundle('skills');
        if (cached) return Promise.resolve(cached);
        return new Promise((resolve) => {
            assetManager.loadBundle('skills', (error, bundle) => {
                if (error || !bundle) {
                    warn('[BattleAnimation] skills bundle 加载失败，将只播放角色动作。');
                    resolve(null);
                    return;
                }
                resolve(bundle);
            });
        });
    }

    private delay(milliseconds: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
}
