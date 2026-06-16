import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('registers Open Call Graph command', async () => {
		await vscode.commands.executeCommand('call-graph.open');
		const commands = await vscode.commands.getCommands(true);

		assert.ok(commands.includes('call-graph.open'));
		assert.ok(!commands.includes('call-graph.helloWorld'));
	});

	test('opens Call Graph webview command without throwing', async () => {
		await vscode.commands.executeCommand('call-graph.open');
	});
});
