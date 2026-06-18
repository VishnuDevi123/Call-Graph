import * as vscode from 'vscode';
import { FocusController } from './focus';
import { DocumentUpdateController, WorkspaceIndexService } from './indexing';
import { CallGraphPanel } from './webview/CallGraphPanel';

export function activate(context: vscode.ExtensionContext) {
	console.log('Call Graph extension active.');

	const workspaceIndex = new WorkspaceIndexService();
	const focusController = new FocusController(workspaceIndex);
	const documentUpdates = new DocumentUpdateController(workspaceIndex, focusController);
	const panelHandlers = {
		onNodeSelected: (nodeId: string) => focusController.navigateToNode(nodeId),
		onCanvasSelected: () => focusController.revealCurrentFocus(),
	};

	const openCommand = vscode.commands.registerCommand('call-graph.open', async () => {
		CallGraphPanel.open(context, panelHandlers);
		await focusController.focusActiveEditor({
			refreshIfMissing: true,
			warnWhenOutsideFunction: true,
			forcePublish: true,
		});
	});

	const refreshCommand = vscode.commands.registerCommand('call-graph.refreshIndex', async () => {
		await workspaceIndex.refresh();
		await focusController.focusActiveEditor({
			refreshIfMissing: false,
			warnWhenOutsideFunction: false,
			forcePublish: true,
		});
	});

	const focusCommand = vscode.commands.registerCommand('call-graph.focusCurrentFunction', async () => {
		CallGraphPanel.open(context, panelHandlers);
		await focusController.focusActiveEditor({
			refreshIfMissing: true,
			warnWhenOutsideFunction: true,
			forcePublish: true,
		});
	});

	context.subscriptions.push(workspaceIndex, focusController, documentUpdates, openCommand, refreshCommand, focusCommand);
}

export function deactivate() {}
