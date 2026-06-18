import * as vscode from 'vscode';
import { emptyGraph } from '../graph/emptyGraph';
import type { GraphModel } from '../graph/types';
import { getWebviewHtml } from './html';

type WebviewMessage =
	| { type: 'nodeSelected'; nodeId: string }
	| { type: 'canvasSelected' }
	| { type: 'refreshRequested' };

export interface CallGraphPanelHandlers {
	onNodeSelected(nodeId: string): void | Promise<void>;
	onCanvasSelected(): void | Promise<void>;
}

export class CallGraphPanel {
	public static currentPanel: CallGraphPanel | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, private readonly handlers: CallGraphPanelHandlers) {
		this.panel = panel;
		this.panel.webview.options = {
			enableScripts: true,
			localResourceRoots: [extensionUri],
		};

		this.panel.webview.html = getWebviewHtml(this.panel.webview, emptyGraph);

		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			(message: WebviewMessage) => this.handleMessage(message),
			null,
			this.disposables,
		);
	}

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

	public updateGraph(graph: GraphModel): void {
		void this.panel.webview.postMessage({
			type: 'graphUpdated',
			graph,
		});
	}

	public updateStatus(message: string | undefined, severity: 'warning' = 'warning'): void {
		void this.panel.webview.postMessage({
			type: 'statusUpdated',
			message,
			severity,
		});
	}

	private handleMessage(message: WebviewMessage): void {
		switch (message.type) {
			case 'nodeSelected':
				void this.handlers.onNodeSelected(message.nodeId);
				return;
			case 'canvasSelected':
				void this.handlers.onCanvasSelected();
				return;
			case 'refreshRequested':
				void vscode.commands.executeCommand('call-graph.refreshIndex');
				return;
		}
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
