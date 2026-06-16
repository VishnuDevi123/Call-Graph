import * as vscode from 'vscode';
import { CallGraphPanel } from './webview/CallGraphPanel';

export function activate(context: vscode.ExtensionContext) {
	console.log('Call Graph extension active.');

	const openCommand = vscode.commands.registerCommand('call-graph.open', () => {
		CallGraphPanel.open(context);
	});

	context.subscriptions.push(openCommand);
}

export function deactivate() {}
