import * as vscode from 'vscode';
import { FocusController } from './focus';
import { DocumentUpdateController, WorkspaceIndexService } from './indexing';
import { CallGraphPanel } from './webview/CallGraphPanel';

// starts the extension, registers commands, and sets up necessary services and controllers
export function activate(context: vscode.ExtensionContext) {
	console.log('Call Graph extension active.');

	const workspaceIndex = new WorkspaceIndexService();
	const focusController = new FocusController(workspaceIndex);
	const documentUpdates = new DocumentUpdateController(workspaceIndex, focusController);
	const panelHandlers = {
		onNodeSelected: (nodeId: string) => focusController.navigateToNode(nodeId),
		onDepthChanged: (direction: 'callers' | 'callees', depth: 1 | 2 | 3 | 4 | 5 | 'max') =>
			focusController.setDirectionalDepth(direction, depth),
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

	const revealCallersCommand = vscode.commands.registerCommand('call-graph.revealCallers', async () => {
		CallGraphPanel.open(context, panelHandlers);
		await focusController.focusActiveEditor({
			refreshIfMissing: true,
			warnWhenOutsideFunction: true,
			forcePublish: true,
		});
		CallGraphPanel.currentPanel?.revealDirection('callers');
	});

	const revealCalleesCommand = vscode.commands.registerCommand('call-graph.revealCallees', async () => {
		CallGraphPanel.open(context, panelHandlers);
		await focusController.focusActiveEditor({
			refreshIfMissing: true,
			warnWhenOutsideFunction: true,
			forcePublish: true,
		});
		CallGraphPanel.currentPanel?.revealDirection('callees');
	});

	context.subscriptions.push(
		workspaceIndex,
		focusController,
		documentUpdates,
		openCommand,
		refreshCommand,
		focusCommand,
		revealCallersCommand,
		revealCalleesCommand,
	);
}

export function deactivate() {}
