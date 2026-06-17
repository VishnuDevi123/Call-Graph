import * as vscode from 'vscode';
import { FocusController } from './focus';
import { WorkspaceIndexService } from './indexing';
import { CallGraphPanel } from './webview/CallGraphPanel';

export function activate(context: vscode.ExtensionContext) {
	console.log('Call Graph extension active.');

	const workspaceIndex = new WorkspaceIndexService();
	const focusController = new FocusController(workspaceIndex);

	const openCommand = vscode.commands.registerCommand('call-graph.open', async () => {
		CallGraphPanel.open(context);
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
		CallGraphPanel.open(context);
		await focusController.focusActiveEditor({
			refreshIfMissing: true,
			warnWhenOutsideFunction: true,
			forcePublish: true,
		});
	});

	context.subscriptions.push(workspaceIndex, focusController, openCommand, refreshCommand, focusCommand);
}

export function deactivate() {}
