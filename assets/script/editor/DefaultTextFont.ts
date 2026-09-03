import { Label, Node, RichText, TTFFont, assetManager, isValid, warn } from 'cc';
import { EDITOR } from 'cc/env';

const GENERAL_FONT_UUID = '14795b54-d353-4242-bb53-4d74b06fa88c';
const HOOK_KEY = '__fangzhiDefaultTextFontHook__';
const RETRY_INTERVAL_MS = 250;

type TextComponent = Label | RichText;
type EditorManager = {
    on?: (event: string, callback: (...args: unknown[]) => void) => void;
    off?: (event: string, callback: (...args: unknown[]) => void) => void;
};

type HookState = {
    dispose: () => void;
};

function installDefaultTextFontHook(): HookState {
    const pending = new Set<TextComponent>();
    let font: TTFFont | null = null;
    let nodeManager: EditorManager | null = null;
    let componentManager: EditorManager | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const notifyChanged = (component: TextComponent): void => {
        const editorExtends = (globalThis as any).EditorExtends;
        editorExtends?.Node?.emit?.('change', component.node.uuid, component.node);
    };

    const applyFont = (component: TextComponent): void => {
        if (!font || !isValid(component, true) || !isValid(component.node, true)) {
            return;
        }

        // Keep fonts that were deliberately assigned by the user.
        if (!component.useSystemFont && component.font) {
            return;
        }

        component.font = font;
        notifyChanged(component);
    };

    const queueOrApply = (component: TextComponent): void => {
        if (!isValid(component, true)) {
            return;
        }

        if (font) {
            applyFont(component);
        } else {
            pending.add(component);
        }
    };

    const findArgument = <T>(args: unknown[], ctor: new (...ctorArgs: any[]) => T): T | null => {
        for (let index = args.length - 1; index >= 0; index--) {
            if (args[index] instanceof ctor) {
                return args[index] as T;
            }
        }
        return null;
    };

    const onComponentAdded = (...args: unknown[]): void => {
        const component = findArgument(args, Label) ?? findArgument(args, RichText);
        if (component) {
            queueOrApply(component);
        }
    };

    const onNodeAdded = (...args: unknown[]): void => {
        const node = findArgument(args, Node);
        if (!node || !isValid(node, true)) {
            return;
        }

        node.getComponentsInChildren(Label).forEach(queueOrApply);
        node.getComponentsInChildren(RichText).forEach(queueOrApply);
    };

    const subscribe = (): void => {
        if (disposed || (nodeManager && componentManager)) {
            return;
        }

        const cce = (globalThis as any).cce;
        const nextNodeManager = cce?.Node as EditorManager | undefined;
        const nextComponentManager = cce?.Component as EditorManager | undefined;

        if (!nodeManager && nextNodeManager?.on) {
            nextNodeManager.on('add', onNodeAdded);
            nodeManager = nextNodeManager;
        }
        if (!componentManager && nextComponentManager?.on) {
            nextComponentManager.on('add', onComponentAdded);
            componentManager = nextComponentManager;
        }

        if (!nodeManager || !componentManager) {
            retryTimer = setTimeout(subscribe, RETRY_INTERVAL_MS);
        }
    };

    assetManager.loadAny({ uuid: GENERAL_FONT_UUID }, (error, asset) => {
        if (disposed) {
            return;
        }
        if (error || !(asset instanceof TTFFont)) {
            warn(`[DefaultTextFont] 无法加载 font/general.ttf: ${error ?? '资源类型不是 TTFFont'}`);
            return;
        }

        font = asset;
        pending.forEach(applyFont);
        pending.clear();
    });

    subscribe();

    return {
        dispose(): void {
            disposed = true;
            if (retryTimer) {
                clearTimeout(retryTimer);
                retryTimer = null;
            }
            nodeManager?.off?.('add', onNodeAdded);
            componentManager?.off?.('add', onComponentAdded);
            pending.clear();
        },
    };
}

if (EDITOR) {
    const scope = globalThis as any;
    (scope[HOOK_KEY] as HookState | undefined)?.dispose();
    scope[HOOK_KEY] = installDefaultTextFontHook();
}
