import * as vscode from 'vscode';
import { emptyGraph } from '../graph/emptyGraph';
import type { GraphModel } from '../graph/types';
import { getWebviewHtml } from './html';

type WebviewMessage =
	| { type: 'nodeSelected'; nodeId: string }
	| { type: 'canvasSelected'; nodeId: string }
	| { type: 'refreshRequested' };

export class CallGraphPanel {
	public static currentPanel: CallGraphPanel | undefined;

	private readonly panel: vscode.WebviewPanel;
	private readonly disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
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

	public static open(context: vscode.ExtensionContext): void {
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

		CallGraphPanel.currentPanel = new CallGraphPanel(panel, context.extensionUri);
	}

	public updateGraph(graph: GraphModel): void {
		void this.panel.webview.postMessage({
			type: 'graphUpdated',
			graph,
		});
	}

	private handleMessage(message: WebviewMessage): void {
		switch (message.type) {
			case 'nodeSelected':
				void vscode.window.showInformationMessage(`Call Graph node selected: ${message.nodeId}`);
				return;
			case 'canvasSelected':
				void vscode.window.showInformationMessage(`Call Graph canvas selected: ${message.nodeId}`);
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
