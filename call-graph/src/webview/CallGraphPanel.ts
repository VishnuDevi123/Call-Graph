import * as vscode from 'vscode';
import type { GraphDepth, GraphExpansionDirection, GraphModel } from '../graph/types';
import { getWebviewHtml } from './html';
import { NavigationHistory } from './NavigationHistory';

type WebviewMessage =
	| { type: 'nodeRevealed'; nodeId: string }
	| { type: 'nodeActivated'; nodeId: string }
	| { type: 'navigateBack' }
	| { type: 'navigateForward' }
	| { type: 'refreshRequested' }
	| { type: 'depthChanged'; direction: GraphExpansionDirection; depth: GraphDepth };

// handlers for messages sent from the webview to the extension
export interface CallGraphPanelHandlers {
	onNodeRevealed(nodeId: string): void | Promise<void>;
	onNodeActivated(nodeId: string): void | Promise<void>;
	onDepthChanged(direction: GraphExpansionDirection, depth: GraphDepth): void | Promise<void>;
}

// manages the call graph webview panel, including its lifecycle, communication with the extension,
// and updating the displayed graph and status
export class CallGraphPanel {
	public static currentPanel: CallGraphPanel | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly navigationHistory = new NavigationHistory();

// initilizes the webview panel, sets up message handling, and defines how to update the graph and status displayed in the webview
	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private readonly handlers: CallGraphPanelHandlers) {
		this.panel = panel;
		this.panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [extensionUri],
		};

		this.panel.webview.html = getWebviewHtml(this.panel.webview, {
			scriptUri: this.panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')),
			styleUri: this.panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css')),
			workerUri: this.panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'layoutWorker.js')),
		});

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			(message: WebviewMessage) => this.handleMessage(message),
			null,
			this.disposables,
		);
	}

	// opens the call graph panel
	public static open(context: vscode.ExtensionContext, handlers: CallGraphPanelHandlers): void {
		if (CallGraphPanel.currentPanel) {
			CallGraphPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'callGraph',
			'Call Graph',
			vscode.ViewColumn.Beside,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [context.extensionUri],
			},
		);

		CallGraphPanel.currentPanel = new CallGraphPanel(panel, context.extensionUri, handlers);
	}
	// updates the graph displayed in the webview by sending a message with the new graph data
	public updateGraph(graph: GraphModel): void {
		this.navigationHistory.observeCurrentNode(graph.focusNodeId);
		void this.panel.webview.postMessage({
			type: 'graphUpdated',
			graph,
		});
		this.postNavigationState();
	}

	// updates the status message displayed in the webview
	public updateStatus(message: string | undefined, severity: 'warning' = 'warning'): void {
		void this.panel.webview.postMessage({
			type: 'overlayUpdated',
			message,
			severity,
		});
	}

	public revealDirection(direction: GraphExpansionDirection): void {
		this.panel.reveal(vscode.ViewColumn.Beside);
		void this.panel.webview.postMessage({
			type: 'revealDirection',
			direction,
		});
	}

	// handles messages received from the webview and calls the appropriate handler based on the message type
	private handleMessage(message: WebviewMessage): void {
		switch (message.type) {
			case 'nodeRevealed':
				void this.handlers.onNodeRevealed(message.nodeId);
				return;
			case 'nodeActivated':
				this.navigateTo(this.navigationHistory.navigateTo(message.nodeId));
				return;
			case 'navigateBack':
				this.navigateTo(this.navigationHistory.back());
				return;
			case 'navigateForward':
				this.navigateTo(this.navigationHistory.forward());
				return;
			case 'refreshRequested':
				void vscode.commands.executeCommand('call-graph.refreshIndex');
				return;
			case 'depthChanged':
				void this.handlers.onDepthChanged(message.direction, message.depth);
				return;
		}
	}

	private navigateTo(nodeId: string | undefined): void {
		if (!nodeId) {
			return;
		}

		this.postNavigationState();
		void this.handlers.onNodeActivated(nodeId);
	}

	private postNavigationState(): void {
		void this.panel.webview.postMessage({
			type: 'navigationStateUpdated',
			...this.navigationHistory.state,
		});
	}

	private dispose(): void {
		CallGraphPanel.currentPanel = undefined;

		while (this.disposables.length > 0) {
			const disposable = this.disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}
}
