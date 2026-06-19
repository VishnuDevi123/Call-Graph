import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import { getWebviewHtml } from '../../webview/html';

suite('modular webview client shell', () => {
	test('loads external bundled script and stylesheet under strict CSP', () => {
		const html = getWebviewHtml({ cspSource: 'test-source' } as vscode.Webview, {
			scriptUri: 'webview.js' as unknown as vscode.Uri,
			styleUri: 'webview.css' as unknown as vscode.Uri,
		});

		assert.ok(html.includes('default-src \'none\''));
		assert.ok(html.includes('style-src test-source'));
		assert.ok(html.includes('script-src \'nonce-'));
		assert.ok(html.includes('<link rel="stylesheet" href="webview.css">'));
		assert.match(html, /<script nonce="[^"]+" src="webview\.js"><\/script>/);
		assert.strictEqual(html.includes('<style'), false);
		assert.strictEqual(html.includes('acquireVsCodeApi'), false);
		assert.strictEqual(html.includes('unsafe-inline'), false);
	});

	test('keeps html shell small and browser responsibilities in focused modules', () => {
		const htmlSource = source('src/webview/html.ts');
		const clientFiles = [
			'controls.ts',
			'dom.ts',
			'edges.ts',
			'graphRenderer.ts',
			'index.ts',
			'messages.ts',
			'minimap.ts',
			'panning.ts',
			'types.ts',
		];

		assert.ok(htmlSource.split('\n').length < 120);
		for (const file of clientFiles) {
			assert.ok(fs.existsSync(path.join(process.cwd(), 'src', 'webview', 'client', file)));
		}
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src', 'webview', 'styles.css')));
	});

	test('build config defines independent extension, browser, and style bundles', () => {
		const build = source('esbuild.js');

		assert.ok(build.includes("platform: 'node'"));
		assert.ok(build.includes("platform: 'browser'"));
		assert.ok(build.includes("'src/webview/client/index.ts'"));
		assert.ok(build.includes("'src/webview/styles.css'"));
	});
});

function source(relativePath: string): string {
	return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
