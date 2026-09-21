import {
    assetManager,
    AssetManager,
    Color,
    HorizontalTextAlignment,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    tween,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    VerticalTextAlignment,
    warn,
    resources,
} from 'cc';
import {
    BattleAnimationSequence,
    BattleUnitAnimationConfig,
    resolveBattleFrameFacing,
} from './BattleAnimationConfig';
import { BattleCamp, BattleLogEntry } from './BattleEffectTypes';

const IDLE_FRAME_COUNT = 4;
const ATTACK_FRAME_COUNT = 6;
const ACTION_FRAME_COUNT = 6;
const HIT_FRAME_COUNT = 4;
const DEATH_FRAME_COUNT = 4;
const VFX_FRAME_COUNT = 6;
const ACTION_FRAME_TIMINGS_MS = [110, 85, 85, 95, 120, 140] as const;
const HIT_FRAME_TIMINGS_MS = [80, 70, 85, 110] as const;
const DEATH_FRAME_TIMINGS_MS = [125, 115, 140, 180] as const;
const UNIT_ANIMATION_CANVAS_SIZE = 640;

interface UnitAnimationFrames {
    idle: SpriteFrame[];
    attack: SpriteFrame[];
    action: SpriteFrame[];
    hit: SpriteFrame[];
    death: SpriteFrame[];
    skillVfx: SpriteFrame[];
}

interface UnitAnimationBinding {
    unitId: string;
    configId: string;
    camp: BattleCamp;
    animationConfig: BattleUnitAnimationConfig;
    item: Node;
    overlay: Node;
    sprite: Sprite;
    alive: boolean;
    basePosition: Vec3;
    baseScale: Vec3;
    animationVersion: number;
    deathState: 'alive' | 'pending' | 'playing' | 'complete';
}

export type BattleVfxStyle = 'basic' | 'skill' | 'none';

/** 统一管理战斗角色序列帧、命中特效、受击/死亡反馈和飘字。 */
export class BattleAnimationPlayer {
    private readonly _frames = new Map<string, UnitAnimationFrames>();
    private readonly _bindings = new Map<string, UnitAnimationBinding>();
    private readonly _lockedUnits = new Set<string>();
    private readonly _deathPromises = new Map<string, Promise<void>>();
    private readonly _transientNodes = new Set<Node>();
    private _skillBundle: AssetManager.Bundle | null = null;
    private _commonHitFrames: SpriteFrame[] = [];
    private _idleElapsed = 0;
    private _idleIndex = 0;
    private _playbackSpeed = 1;
    private _paused = false;

    setPlaybackSpeed(speed: number): void {
        this._playbackSpeed = Math.max(0.25, Math.min(4, Number.isFinite(speed) ? speed : 1));
    }

    setPaused(paused: boolean): void {
        this._paused = paused;
    }

    bind(
        unitId: string,
        configId: string,
        camp: BattleCamp,
        animationConfig: BattleUnitAnimationConfig,
        item: Node,
        overlay: Node,
        sprite: Sprite,
    ): void {
        // 角色动画素材统一使用正方形画布。固定为 CUSTOM，避免 RAW 模式随每帧原图尺寸重排节点。
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // 必须按原始画布计算顶点；若使用裁剪模式，不同帧会各自拉满节点，造成缩放和位置抖动。
        sprite.trim = false;
        sprite.node.getComponent(UITransform)?.setContentSize(
            UNIT_ANIMATION_CANVAS_SIZE,
            UNIT_ANIMATION_CANVAS_SIZE,
        );
        const prefabScale = sprite.node.scale.clone();
        const baseDirection = this.resolveLocalSpriteDirection(
            sprite.node,
            camp,
            animationConfig.sourceFacing,
        );
        const baseScale = new Vec3(
            Math.abs(prefabScale.x) * baseDirection,
            prefabScale.y,
            prefabScale.z,
        );
        sprite.node.setScale(baseScale);
        this._deathPromises.delete(unitId);
        this._bindings.set(unitId, {
            unitId,
            configId,
            camp,
            animationConfig,
            item,
            overlay,
            sprite,
            alive: true,
            basePosition: sprite.node.position.clone(),
            baseScale,
            animationVersion: 0,
            deathState: 'alive',
        });
    }

    setAlive(unitId: string, alive: boolean): void {
        const binding = this._bindings.get(unitId);
        if (!binding || binding.alive === alive) return;
        binding.alive = alive;
        if (!alive) {
            // 死亡由 defeated 日志驱动，保证伤害特效、受击、死亡按顺序播放并被战斗流程等待。
            binding.deathState = 'pending';
            binding.animationVersion++;
            this._lockedUnits.delete(unitId);
            if (binding.sprite.isValid) {
                Tween.stopAllByTarget(binding.sprite.node);
                binding.sprite.node.setPosition(binding.basePosition);
                binding.sprite.node.setScale(binding.baseScale);
            }
            return;
        }
        binding.deathState = 'alive';
        this._deathPromises.delete(unitId);
        binding.animationVersion++;
        this._lockedUnits.delete(unitId);
        if (!binding.sprite.isValid) return;
        Tween.stopAllByTarget(binding.sprite.node);
        binding.sprite.node.setPosition(binding.basePosition);
        binding.sprite.node.setScale(binding.baseScale);
        this.restoreIdleFrame(binding);
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
            const [idle, attack, action, hit, death, skillVfx] = await Promise.all([
                this.loadResourceSequence(`${root}/${configId}_idle_4f_frames`, IDLE_FRAME_COUNT),
                this.loadResourceSequence(`${root}/${configId}_attack_6f_frames`, ATTACK_FRAME_COUNT, false),
                this.loadResourceSequence(`${root}/${configId}_skill_6f_frames`, ACTION_FRAME_COUNT),
                this.loadResourceSequence(`${root}/${configId}_hit_4f_frames`, HIT_FRAME_COUNT),
                this.loadResourceSequence(
                    `${root}/${configId}_death_4f_frames`,
                    DEATH_FRAME_COUNT,
                    true,
                    true,
                ),
                this.loadUnitSkillVfx(configId),
            ]);
            this._frames.set(configId, { idle, attack, action, hit, death, skillVfx });
        }));

    }

    update(deltaTime: number): void {
        if (this._paused) return;
        this._idleElapsed += deltaTime * this._playbackSpeed;
        if (this._idleElapsed < 0.2) return;
        this._idleElapsed %= 0.2;
        this._idleIndex = (this._idleIndex + 1) % IDLE_FRAME_COUNT;

        for (const binding of this._bindings.values()) {
            if (!binding.alive || this._lockedUnits.has(binding.unitId) || !binding.sprite.isValid) continue;
            const idleFrames = this._frames.get(binding.configId)?.idle ?? [];
            if (idleFrames.length) {
                const frameIndex = this._idleIndex % idleFrames.length;
                this.applyUnitFrame(binding, idleFrames[frameIndex], 'idle', frameIndex + 1);
            }
        }
    }

    reset(): void {
        this._lockedUnits.clear();
        this._deathPromises.clear();
        this._idleElapsed = 0;
        this._idleIndex = 0;
        for (const node of this._transientNodes) {
            if (node.isValid) node.destroy();
        }
        this._transientNodes.clear();
        for (const binding of this._bindings.values()) {
            if (!binding.sprite.node.isValid) continue;
            binding.alive = true;
            binding.deathState = 'alive';
            binding.animationVersion++;
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
        if (!binding?.sprite.isValid || !binding.alive) return;
        const unitFrames = this._frames.get(binding.configId);
        const useIndependentAttack = isBasicAttack && !!unitFrames?.attack.length;
        const frames = useIndependentAttack
            ? unitFrames?.attack ?? []
            : unitFrames?.action ?? [];
        const sequence: BattleAnimationSequence = useIndependentAttack ? 'attack' : 'action';
        const animationVersion = ++binding.animationVersion;
        this._lockedUnits.add(unitId);
        const keepPlaying = () => isCurrent()
            && binding.alive
            && binding.animationVersion === animationVersion;
        if (frames.length) {
            // 序列帧本身已经包含前冲和蓄力，不再叠加节点位移/缩放，避免动作出现双重运动。
            await this.playUnitFrames(binding, frames, sequence, ACTION_FRAME_TIMINGS_MS, keepPlaying);
        }
        else {
            // 资源缺失时才使用节点 tween 作为兜底动作，并等待 tween 完成后再结算命中。
            this.playActionMotion(binding, isBasicAttack);
            await this.delay(300);
        }
        if (binding.animationVersion !== animationVersion) return;
        this._lockedUnits.delete(unitId);
        if (isCurrent() && binding.alive) this.restoreIdleFrame(binding);
    }

    /** 战斗界面的动画验收入口；调用前由界面重置单位状态。 */
    async previewAnimation(
        unitId: string,
        sequence: BattleAnimationSequence,
        isCurrent: () => boolean,
    ): Promise<void> {
        const binding = this._bindings.get(unitId);
        if (!binding?.sprite.isValid || !isCurrent()) return;
        if (sequence === 'idle') {
            this.restoreIdleFrame(binding);
            return;
        }
        if (sequence === 'attack' || sequence === 'action') {
            await this.playAction(unitId, sequence === 'attack', isCurrent);
            return;
        }
        if (sequence === 'hit') {
            await this.playHit(unitId, isCurrent);
            return;
        }
        this.setAlive(unitId, false);
        if (isCurrent()) await this.playDeath(unitId, isCurrent);
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
        const defeatedIds = new Set(logs
            .filter((log) => log.type === 'defeated')
            .map((log) => log.targetUnitId));
        const reactionIds = Array.from(new Set([...hitIds, ...defeatedIds]));

        const unitSkillVfx = casterConfigId
            ? this._frames.get(casterConfigId)?.skillVfx ?? []
            : [];
        const vfxFrames = style === 'skill'
            ? unitSkillVfx.length ? unitSkillVfx : this._commonHitFrames
            : style === 'basic' ? this._commonHitFrames : [];

        this.showFloatingValues(logs);
        await Promise.all([
            ...vfxTargetIds.map((unitId) => this.playVfx(unitId, vfxFrames, isCurrent)),
            ...reactionIds.map(async (unitId) => {
                const defeated = defeatedIds.has(unitId);
                if (hitIds.includes(unitId)) await this.playHit(unitId, isCurrent, defeated);
                if (defeated && isCurrent()) await this.playDeath(unitId, isCurrent);
            }),
        ]);
    }

    private playActionMotion(binding: UnitAnimationBinding, isBasicAttack: boolean): void {
        const node = binding.sprite.node;
        Tween.stopAllByTarget(node);
        const origin = binding.basePosition.clone();
        const scale = binding.baseScale.clone();
        if (isBasicAttack) {
            const localForward = this.resolveLocalForwardDirection(node, binding.camp);
            tween(node)
                .to(
                    0.12,
                    { position: new Vec3(origin.x + 34 * localForward, origin.y, origin.z) },
                    { easing: 'quadOut' },
                )
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

    private async playHit(
        unitId: string,
        isCurrent: () => boolean,
        allowDefeated = false,
    ): Promise<void> {
        const binding = this._bindings.get(unitId);
        if (!binding?.sprite.isValid) return;
        const canPlay = () => binding.alive || (
            allowDefeated && binding.deathState === 'pending'
        );
        if (!canPlay()) return;
        // 反击可能在施法者动作尚未播完时命中施法者，等待当前帧序列结束再播受击。
        while (this._lockedUnits.has(unitId) && canPlay() && isCurrent()) await this.delay(25);
        if (!isCurrent() || !binding.sprite.isValid || !canPlay()) return;
        const frames = this._frames.get(binding.configId)?.hit ?? [];
        const node = binding.sprite.node;
        const origin = binding.basePosition.clone();
        const animationVersion = ++binding.animationVersion;
        this._lockedUnits.add(unitId);
        Tween.stopAllByTarget(node);
        node.setPosition(origin);
        if (!frames.length && !allowDefeated) {
            // 只有缺少受击序列时才用节点震动兜底；素材已有后仰时叠加震动会显得发飘。
            tween(node)
                .to(0.05, { position: new Vec3(origin.x - 12, origin.y, origin.z) })
                .to(0.05, { position: new Vec3(origin.x + 10, origin.y, origin.z) })
                .to(0.05, { position: new Vec3(origin.x - 6, origin.y, origin.z) })
                .to(0.06, { position: origin })
                .start();
        }
        const keepPlaying = () => isCurrent()
            && canPlay()
            && binding.animationVersion === animationVersion;
        if (frames.length) {
            await this.playUnitFrames(binding, frames, 'hit', HIT_FRAME_TIMINGS_MS, keepPlaying);
        }
        else {
            await this.delay(210);
        }
        if (binding.animationVersion !== animationVersion) return;
        this._lockedUnits.delete(unitId);
        if (isCurrent() && binding.alive && !allowDefeated) this.restoreIdleFrame(binding);
    }

    private playDeath(unitId: string, isCurrent: () => boolean): Promise<void> {
        const current = this._deathPromises.get(unitId);
        if (current) return current;
        const tracked = this.runDeath(unitId, isCurrent).finally(() => {
            if (this._deathPromises.get(unitId) === tracked) this._deathPromises.delete(unitId);
        });
        this._deathPromises.set(unitId, tracked);
        return tracked;
    }

    private async runDeath(unitId: string, isCurrent: () => boolean): Promise<void> {
        const binding = this._bindings.get(unitId);
        if (!binding?.sprite.isValid || binding.deathState === 'complete' || !isCurrent()) return;
        binding.alive = false;
        binding.deathState = 'playing';
        const unitFrames = this._frames.get(binding.configId);
        // 旧单位还没有独立死亡资源时回退到受击序列，避免死亡瞬间直接静止。
        const frames = unitFrames?.death.length ? unitFrames.death : unitFrames?.hit ?? [];
        const animationVersion = ++binding.animationVersion;
        this._lockedUnits.add(unitId);
        const node = binding.sprite.node;
        Tween.stopAllByTarget(node);
        node.setPosition(binding.basePosition);
        node.setScale(binding.baseScale);
        await this.playUnitFrames(
            binding,
            frames,
            'death',
            DEATH_FRAME_TIMINGS_MS,
            () => isCurrent()
                && binding.deathState === 'playing'
                && binding.animationVersion === animationVersion,
        );
        if (binding.animationVersion === animationVersion) {
            binding.deathState = 'complete';
            this._lockedUnits.delete(unitId);
        }
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
        if (!binding.alive) return;
        const frames = this._frames.get(binding.configId)?.idle ?? [];
        if (binding.sprite.isValid && frames.length) {
            const frameIndex = this._idleIndex % frames.length;
            this.applyUnitFrame(binding, frames[frameIndex], 'idle', frameIndex + 1);
        }
    }

    private applyUnitFrame(
        binding: UnitAnimationBinding,
        frame: SpriteFrame,
        sequence: BattleAnimationSequence,
        frameNumber: number,
    ): void {
        binding.sprite.spriteFrame = frame;
        const node = binding.sprite.node;
        const currentScale = node.scale;
        const facing = resolveBattleFrameFacing(binding.animationConfig, sequence, frameNumber);
        const targetDirection = this.resolveLocalSpriteDirection(node, binding.camp, facing);
        const currentDirection = currentScale.x < 0 ? -1 : 1;
        if (currentDirection === targetDirection) return;
        // 只修正朝向符号，保留技能动作 tween 正在使用的缩放幅度。
        node.setScale(Math.abs(currentScale.x) * targetDirection, currentScale.y, currentScale.z);
    }

    private async playUnitFrames(
        binding: UnitAnimationBinding,
        frames: readonly SpriteFrame[],
        sequence: BattleAnimationSequence,
        intervalMs: number | readonly number[],
        isCurrent: () => boolean,
    ): Promise<void> {
        for (let index = 0; index < frames.length; index++) {
            if (!isCurrent() || !binding.sprite.isValid) return;
            this.applyUnitFrame(binding, frames[index], sequence, index + 1);
            const frameInterval = typeof intervalMs === 'number'
                ? intervalMs
                : intervalMs[Math.min(index, intervalMs.length - 1)] ?? 0;
            await this.delay(frameInterval);
        }
    }

    /** 把屏幕上的目标朝向换算为当前父层级坐标中的本地朝向。 */
    private resolveLocalSpriteDirection(
        node: Node,
        camp: BattleCamp,
        sourceFacing: 'left' | 'right',
    ): number {
        const desiredScreenDirection = camp === 'ally' ? 1 : -1;
        const sourceDirection = sourceFacing === 'right' ? 1 : -1;
        return desiredScreenDirection * sourceDirection * this.getAncestorHorizontalDirection(node);
    }

    /** 位移不受角色 Sprite 自身镜像影响，只需抵消父层级的镜像。 */
    private resolveLocalForwardDirection(node: Node, camp: BattleCamp): number {
        const desiredScreenDirection = camp === 'ally' ? 1 : -1;
        return desiredScreenDirection * this.getAncestorHorizontalDirection(node);
    }

    private getAncestorHorizontalDirection(node: Node): number {
        let direction = 1;
        let ancestor = node.parent;
        while (ancestor) {
            if (ancestor.scale.x < 0) direction *= -1;
            ancestor = ancestor.parent;
        }
        return direction;
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

    private async loadResourceSequence(
        root: string,
        count: number,
        reportMissing = true,
        allowTextureFallback = false,
    ): Promise<SpriteFrame[]> {
        const result: SpriteFrame[] = [];
        for (let index = 1; index <= count; index++) {
            const frameRoot = `${root}/frame_${String(index).padStart(2, '0')}`;
            const path = `${frameRoot}/spriteFrame`;
            const frame = await new Promise<SpriteFrame | null>((resolve) => {
                resources.load(path, SpriteFrame, (error, asset) => {
                    if (!error && asset) {
                        resolve(asset);
                        return;
                    }
                    if (!allowTextureFallback) {
                        if (reportMissing) warn(`[BattleAnimation] 序列帧加载失败：${path}`);
                        resolve(null);
                        return;
                    }
                    // 新导入的死亡帧目前是 Texture2D，运行时包装为完整画布 SpriteFrame。
                    resources.load(frameRoot, Texture2D, (textureError, texture) => {
                        if (textureError || !texture) {
                            if (reportMissing) warn(`[BattleAnimation] 序列帧加载失败：${frameRoot}`);
                            resolve(null);
                            return;
                        }
                        const generatedFrame = new SpriteFrame();
                        generatedFrame.texture = texture;
                        generatedFrame.name = `${frameRoot}/runtimeSpriteFrame`;
                        resolve(generatedFrame);
                    });
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
        return new Promise((resolve) => {
            let remaining = Math.max(0, milliseconds);
            let previous = Date.now();
            const tick = () => {
                const current = Date.now();
                if (!this._paused) remaining -= (current - previous) * this._playbackSpeed;
                previous = current;
                if (remaining <= 0) resolve();
                else setTimeout(tick, Math.min(16, remaining / this._playbackSpeed));
            };
            tick();
        });
    }
}
