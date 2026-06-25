/** Panel-lifetime history for explicit graph-node navigation. */
export class NavigationHistory {
	private readonly backStack: string[] = [];
	private readonly forwardStack: string[] = [];
	private displayedNodeId: string | undefined;
	private historyNodeId: string | undefined;

	/**
	 * Tracks the graph currently shown without adding automatic editor focus
	 * changes to history.
	 */
	public observeCurrentNode(nodeId: string): void {
		this.displayedNodeId = nodeId;
		this.historyNodeId ??= nodeId;
	}

	/** Records an explicit node click and clears abandoned forward history. */
	public navigateTo(nodeId: string): string | undefined {
		if (nodeId === this.displayedNodeId) {
			return nodeId;
		}

		if (this.displayedNodeId) {
			this.backStack.push(this.displayedNodeId);
		}
		this.displayedNodeId = nodeId;
		this.historyNodeId = nodeId;
		this.forwardStack.length = 0;
		return nodeId;
	}

	public back(): string | undefined {
		const targetNodeId = this.backStack.pop();
		if (!targetNodeId) {
			return undefined;
		}

		if (this.historyNodeId) {
			this.forwardStack.push(this.historyNodeId);
		}
		this.displayedNodeId = targetNodeId;
		this.historyNodeId = targetNodeId;
		return targetNodeId;
	}

	public forward(): string | undefined {
		const targetNodeId = this.forwardStack.pop();
		if (!targetNodeId) {
			return undefined;
		}

		if (this.historyNodeId) {
			this.backStack.push(this.historyNodeId);
		}
		this.displayedNodeId = targetNodeId;
		this.historyNodeId = targetNodeId;
		return targetNodeId;
	}

	public get state(): { canGoBack: boolean; canGoForward: boolean } {
		return {
			canGoBack: this.backStack.length > 0,
			canGoForward: this.forwardStack.length > 0,
		};
	}
}
