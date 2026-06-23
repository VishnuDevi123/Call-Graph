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
			workerUri: 'layoutWorker.js' as unknown as vscode.Uri,
		});

		assert.ok(html.includes('default-src \'none\''));
		assert.ok(html.includes('style-src test-source'));
		assert.ok(html.includes('script-src \'nonce-'));
		assert.ok(html.includes('connect-src test-source'));
		assert.ok(html.includes('worker-src blob:'));
		assert.ok(html.includes('<link rel="stylesheet" href="webview.css">'));
		assert.match(html, /<script nonce="[^"]+" src="webview\.js"><\/script>/);
		assert.ok(html.includes('data-layout-worker-uri="layoutWorker.js"'));
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
			'layoutCoordinator.ts',
			'localLayoutWorker.ts',
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

	test('renders the approved toolbar and centered overlay contract', () => {
		const html = getWebviewHtml({ cspSource: 'test-source' } as vscode.Webview, {
			scriptUri: 'webview.js' as unknown as vscode.Uri,
			styleUri: 'webview.css' as unknown as vscode.Uri,
			workerUri: 'layoutWorker.js' as unknown as vscode.Uri,
		});

		for (const id of [
			'back',
			'forward',
			'refresh',
			'reset-view',
			'depth-left',
			'depth-right',
			'minimap-toggle',
			'zoom-percentage',
			'operational-overlay',
			'operational-overlay-message',
			'node-measurements',
		]) {
			assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
		}
		assert.ok(html.includes('id="back" type="button" disabled'));
		assert.ok(html.includes('id="forward" type="button" disabled'));
		assert.ok(html.includes('class="operational-overlay"'));
		assert.strictEqual(html.includes('include-tests'), false);
		assert.strictEqual(html.includes('Include tests'), false);
		assert.strictEqual(html.includes('id="status"'), false);
	});

	test('contains no obsolete test-filter messages or controls', () => {
		for (const relativePath of [
			'src/extension.ts',
			'src/focus/FocusController.ts',
			'src/graph/types.ts',
			'src/webview/CallGraphPanel.ts',
			'src/webview/client/controls.ts',
			'src/webview/client/dom.ts',
			'src/webview/client/types.ts',
		]) {
			const fileSource = source(relativePath);
			assert.strictEqual(fileSource.includes('includeTests'), false, relativePath);
			assert.strictEqual(fileSource.includes('includeTestsChanged'), false, relativePath);
		}
	});

	test('build config defines independent extension, browser, worker, and style bundles', () => {
		const build = source('esbuild.js');

		assert.ok(build.includes("platform: 'node'"));
		assert.ok(build.includes("platform: 'browser'"));
		assert.ok(build.includes("'src/webview/client/index.ts'"));
		assert.ok(build.includes("'src/webview/layout/layoutWorker.ts'"));
		assert.ok(build.includes("'src/webview/styles.css'"));
	});

	test('loads the worker bundle through a panel-lifetime blob URL', () => {
		const workerLoader = source('src/webview/client/localLayoutWorker.ts');

		assert.ok(workerLoader.includes('fetch(workerSourceUri)'));
		assert.ok(workerLoader.includes('URL.createObjectURL'));
		assert.ok(workerLoader.includes('URL.revokeObjectURL'));
		assert.ok(workerLoader.includes('new Worker(workerUrl)'));
	});

	test('keeps layout and rendering geometry in the webview', () => {
		const panel = source('src/webview/CallGraphPanel.ts');
		const client = source('src/webview/client/index.ts');

		assert.strictEqual(panel.includes('createSceneGeometry'), false);
		assert.strictEqual(panel.includes('scene:'), false);
		assert.ok(client.includes('createRenderScene(result)'));
		assert.ok(client.includes('measureGraphNodes'));
		assert.strictEqual(fs.existsSync(path.join(process.cwd(), 'src', 'webview', 'sceneGeometry.ts')), false);
	});
});

function source(relativePath: string): string {
	return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
