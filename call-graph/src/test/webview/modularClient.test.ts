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
			'minimap-handle',
			'zoom-percentage',
			'operational-overlay',
			'operational-overlay-message',
			'operational-overlay-actions',
			'retry-layout',
			'overlay-refresh',
			'node-measurements',
		]) {
			assert.ok(html.includes(`id="${id}"`), `missing ${id}`);
		}
		assert.ok(html.includes('id="back" type="button" disabled'));
		assert.ok(html.includes('id="forward" type="button" disabled'));
		assert.ok(html.includes('class="operational-overlay"'));
		assert.ok(html.includes('class="operational-throbber"'));
		assert.ok(html.includes('<button id="retry-layout" type="button">Retry</button>'));
		assert.ok(html.includes('<button id="overlay-refresh" type="button">Refresh</button>'));
		assert.ok(html.includes('aria-label="Move minimap"'));
		assert.strictEqual(html.includes('include-tests'), false);
		assert.strictEqual(html.includes('Include tests'), false);
		assert.strictEqual(html.includes('id="status"'), false);
	});

	test('keeps slice 18 UI polish in browser modules and tunable CSS sections', () => {
		const client = source('src/webview/client/index.ts');
		const renderer = source('src/webview/client/graphRenderer.ts');
		const minimap = source('src/webview/client/minimap.ts');
		const styles = source('src/webview/styles.css');

		assert.ok(client.includes("showOperationalOverlay('Loading call graph...', 'loading')"));
		assert.ok(client.includes("'Some edges could not avoid unrelated nodes"));
		assert.ok(client.includes("'No Python call graph data is available"));
		assert.ok(client.includes('function retryLayout()'));
		assert.ok(client.includes("showOperationalOverlay('Retrying layout...', 'loading')"));
		assert.ok(client.includes('updateOverlayActions'));
		assert.ok(renderer.includes('applyHoverState'));
		assert.ok(renderer.includes('is-connected'));
		assert.ok(renderer.includes('is-dimmed'));
		assert.ok(minimap.includes('installMinimapDrag'));
		assert.ok(minimap.includes('elements.minimapHandle.setPointerCapture'));
		for (const section of [
			'/* Theme and tunable graph variables */',
			'/* Toolbar and controls */',
			'/* Canvas and viewport */',
			'/* Edges and arrows */',
			'/* Nodes and role states */',
			'/* Notices and operational overlays */',
			'/* Minimap */',
			'/* Reduced-motion overrides */',
		]) {
			assert.ok(styles.includes(section), section);
		}
		assert.ok(styles.includes('--bg:'));
		assert.ok(styles.includes('--call-graph-motion-duration'));
	});

	test('wires panel-lifetime navigation and full-graph fit behavior', () => {
		const panel = source('src/webview/CallGraphPanel.ts');
		const controls = source('src/webview/client/controls.ts');
		const client = source('src/webview/client/index.ts');
		const extension = source('src/extension.ts');
		const focusController = source('src/focus/FocusController.ts');

		assert.ok(panel.includes('NavigationHistory'));
		assert.ok(panel.includes("case 'nodeRevealed'"));
		assert.ok(panel.includes("case 'nodeActivated'"));
		assert.ok(controls.includes("type: 'navigateBack'"));
		assert.ok(controls.includes("type: 'navigateForward'"));
		assert.ok(client.includes('fitCompleteGraph(hasCompletedLayout)'));
		assert.ok(client.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
		assert.ok(extension.includes('onNodeRevealed'));
		assert.ok(extension.includes('onNodeActivated'));
		assert.ok(focusController.includes('revealNodeSource'));
		assert.ok(focusController.includes('suppressNextEditorFocusUpdate'));
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

	test('keeps production webview and worker packaging offline-only', () => {
		const packageJson = JSON.parse(source('package.json')) as { dependencies?: Record<string, string> };
		const webviewFiles = [
			'src/webview/client/index.ts',
			'src/webview/client/localLayoutWorker.ts',
			'src/webview/layout/layoutWorker.ts',
			'src/webview/layout/softDepthBandLayout.ts',
			'src/webview/html.ts',
		];
		const combinedWebviewSource = webviewFiles.map(source).join('\n');

		assert.strictEqual(packageJson.dependencies?.rbush, undefined);
		assert.strictEqual(/https?:\/\//.test(combinedWebviewSource), false);
		assert.strictEqual(combinedWebviewSource.includes('importScripts'), false);
		assert.strictEqual(combinedWebviewSource.includes('WebSocket'), false);
		assert.strictEqual(combinedWebviewSource.includes('XMLHttpRequest'), false);
		assert.ok(combinedWebviewSource.includes('fetch(workerSourceUri)'));
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
