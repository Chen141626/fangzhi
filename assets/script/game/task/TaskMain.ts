import { _decorator, BlockInputEvents, Component, director, Label, Node, warn } from 'cc';
import { oops } from 'db://oops-framework/core/Oops';
import { UIID } from '../../config/UIConfig';
import { GAME_EVENT_TASK_CHANGED } from '../../core/GameEvents';
import { formatTaskRewards, TASK_CATEGORY_NAMES, TaskCategory } from './TaskConfig';
import { TaskService, TaskViewData } from './TaskService';

const { ccclass, menu } = _decorator;
const PAGE_SIZE = 5;

function findChild(root: Node, path: string): Node | null {
    let current: Node | null = root;
    for (const name of path.split('/')) {
        current = current?.getChildByName(name) ?? null;
        if (!current) return null;
    }
    return current;
}

interface TaskRowBinding {
    node: Node;
    title: Label | null;
    description: Label | null;
    progress: Label | null;
    reward: Label | null;
    claimButton: Node | null;
    claimLabel: Label | null;
    taskId: string;
}

@ccclass('TaskMain')
@menu('Game/Task/TaskMain')
export class TaskMain extends Component {
    private readonly _service = new TaskService();
    private readonly _rows: TaskRowBinding[] = [];
    private _category: TaskCategory = 'main';
    private _page = 0;
    private _pageLabel: Label | null = null;
    private _summaryLabel: Label | null = null;
    private _statusLabel: Label | null = null;

    protected onLoad(): void {
        if (!this.getComponent(BlockInputEvents)) this.addComponent(BlockInputEvents);
        this.bindHierarchy();
        director.on(GAME_EVENT_TASK_CHANGED, this.render, this);
    }

    protected onEnable(): void {
        this.render();
    }

    protected onDestroy(): void {
        director.off(GAME_EVENT_TASK_CHANGED, this.render, this);
    }

    private bindHierarchy(): void {
        findChild(this.node, 'header/btn_back')?.on(Node.EventType.TOUCH_END, () => oops.gui.remove(UIID.Task, false), this);
        findChild(this.node, 'tabs/btn_main')?.on(Node.EventType.TOUCH_END, () => this.changeCategory('main'), this);
        findChild(this.node, 'tabs/btn_daily')?.on(Node.EventType.TOUCH_END, () => this.changeCategory('daily'), this);
        findChild(this.node, 'tabs/btn_achievement')?.on(Node.EventType.TOUCH_END, () => this.changeCategory('achievement'), this);
        findChild(this.node, 'pagination/btn_previous')?.on(Node.EventType.TOUCH_END, () => this.changePage(-1), this);
        findChild(this.node, 'pagination/btn_next')?.on(Node.EventType.TOUCH_END, () => this.changePage(1), this);
        findChild(this.node, 'footer/btn_claim_all')?.on(Node.EventType.TOUCH_END, this.claimAll, this);
        this._pageLabel = findChild(this.node, 'pagination/page')?.getComponent(Label) ?? null;
        this._summaryLabel = findChild(this.node, 'summary')?.getComponent(Label) ?? null;
        this._statusLabel = findChild(this.node, 'status')?.getComponent(Label) ?? null;

        for (let index = 0; index < PAGE_SIZE; index++) {
            const node = findChild(this.node, `list/taskRow${index + 1}`);
            if (!node) continue;
            const row: TaskRowBinding = {
                node,
                title: node.getChildByName('title')?.getComponent(Label) ?? null,
                description: node.getChildByName('description')?.getComponent(Label) ?? null,
                progress: node.getChildByName('progress')?.getComponent(Label) ?? null,
                reward: node.getChildByName('reward')?.getComponent(Label) ?? null,
                claimButton: node.getChildByName('btn_claim'),
                claimLabel: findChild(node, 'btn_claim/Label')?.getComponent(Label) ?? null,
                taskId: '',
            };
            row.claimButton?.on(Node.EventType.TOUCH_END, () => this.claim(row), this);
            this._rows.push(row);
        }
        if (this._rows.length !== PAGE_SIZE || !this._pageLabel || !this._summaryLabel || !this._statusLabel) {
            warn('[TaskMain] 任务 prefab 层级不完整，请重新生成或检查节点命名。');
        }
    }

    private changeCategory(category: TaskCategory): void {
        this._category = category;
        this._page = 0;
        if (this._statusLabel) this._statusLabel.string = '';
        this.render();
    }

    private changePage(offset: number): void {
        const pageCount = Math.max(1, Math.ceil(this._service.getTasks(this._category).length / PAGE_SIZE));
        this._page = Math.max(0, Math.min(pageCount - 1, this._page + offset));
        this.render();
    }

    private render(): void {
        const tasks = this._service.getTasks(this._category);
        const pageCount = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
        this._page = Math.min(this._page, pageCount - 1);
        const visibleTasks = tasks.slice(this._page * PAGE_SIZE, (this._page + 1) * PAGE_SIZE);
        const claimable = tasks.filter((task) => task.status === 'claimable').length;
        const completed = tasks.filter((task) => task.status === 'claimed').length;
        if (this._summaryLabel) {
            this._summaryLabel.string = `${TASK_CATEGORY_NAMES[this._category]}　已领取 ${completed}/${tasks.length}　可领取 ${claimable}`;
        }
        if (this._pageLabel) this._pageLabel.string = `${this._page + 1} / ${pageCount}`;
        this.updateTabLabels();
        this._rows.forEach((row, index) => this.renderRow(row, visibleTasks[index] ?? null));
    }

    private renderRow(row: TaskRowBinding, task: TaskViewData | null): void {
        row.node.active = !!task;
        row.taskId = task?.id ?? '';
        if (!task) return;
        if (row.title) row.title.string = task.title;
        if (row.description) row.description.string = task.description;
        if (row.progress) row.progress.string = `进度 ${task.progress}/${task.target}`;
        if (row.reward) row.reward.string = `奖励：${formatTaskRewards(task.rewards)}`;
        if (row.claimLabel) {
            row.claimLabel.string = task.status === 'claimed'
                ? '已领取'
                : task.status === 'claimable'
                    ? '领取'
                    : task.status === 'locked'
                        ? '未解锁'
                        : '进行中';
        }
        if (row.claimButton) row.claimButton.active = true;
    }

    private updateTabLabels(): void {
        const pairs: Array<[TaskCategory, string]> = [
            ['main', 'btn_main'], ['daily', 'btn_daily'], ['achievement', 'btn_achievement'],
        ];
        for (const [category, name] of pairs) {
            const label = findChild(this.node, `tabs/${name}/Label`)?.getComponent(Label);
            if (label) label.string = `${category === this._category ? '◆ ' : ''}${TASK_CATEGORY_NAMES[category]}`;
        }
    }

    private claim(row: TaskRowBinding): void {
        if (!row.taskId) return;
        const rewards = this._service.claim(row.taskId);
        if (this._statusLabel) {
            this._statusLabel.string = rewards
                ? `领取成功：${formatTaskRewards(rewards)}`
                : '任务尚未完成或奖励已领取';
        }
        this.render();
    }

    private claimAll(): void {
        const result = this._service.claimAll(this._category);
        if (this._statusLabel) {
            this._statusLabel.string = result.count
                ? `已领取${result.count}项：${formatTaskRewards(result.rewards)}`
                : '当前没有可领取的任务奖励';
        }
        this.render();
    }
}
