import * as assert from 'assert';
import type * as vscode from 'vscode';
import { depthChangeMessage, parseDepth } from '../../webview/client/messages';
import { getWebviewHtml } from '../../webview/html';

suite('webview directional depth controls', () => {
	test('renders global left and right controls with all supported values', () => {
		const html = webviewHtml();

		assert.ok(html.includes('id="depth-left"'));
		assert.ok(html.includes('id="depth-right"'));
		for (const value of ['1', '2', '3', '4', '5', 'max']) {
			assert.ok(html.includes(`<option value="${value}">`));
		}
	});

	test('creates directional depth messages', () => {
		assert.deepStrictEqual(depthChangeMessage('callers', '3'), {
			type: 'depthChanged',
			direction: 'callers',
			depth: 3,
		});
		assert.deepStrictEqual(depthChangeMessage('callees', 'max'), {
			type: 'depthChanged',
			direction: 'callees',
			depth: 'max',
		});
		assert.strictEqual(parseDepth('invalid'), 1);
	});

	test('contains no individual node expansion controls', () => {
		const html = webviewHtml();

		assert.strictEqual(html.includes('Expand callers'), false);
		assert.strictEqual(html.includes('Collapse callers'), false);
		assert.strictEqual(html.includes('Expand callees'), false);
		assert.strictEqual(html.includes('Collapse callees'), false);
	});
});

function webviewHtml(): string {
	return getWebviewHtml({ cspSource: 'test' } as vscode.Webview, {
		scriptUri: 'webview.js' as unknown as vscode.Uri,
		styleUri: 'webview.css' as unknown as vscode.Uri,
	});
}
