import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import { getWebviewHtml } from '../../webview/html';
import type { RenderSceneGeometry } from '../../webview/renderGeometry';
import {
	calculateZoomTransition,
	createMinimapGeometry,
	MAX_ZOOM,
	MIN_ZOOM,
	scaledSceneSize,
	sceneTransform,
} from '../../webview/zoomGeometry';

suite('webview whole-scene zoom geometry', () => {
	test('renders one scene transform without CSS zoom or edge relayout', () => {
		const html = getWebviewHtml({ cspSource: 'test' } as vscode.Webview, {
			scriptUri: 'webview.js' as unknown as vscode.Uri,
			styleUri: 'webview.css' as unknown as vscode.Uri,
			workerUri: 'layoutWorker.js' as unknown as vscode.Uri,
		});
		const client = fs.readFileSync(path.join(process.cwd(), 'src', 'webview', 'client', 'index.ts'), 'utf8');
		const transformAssignments = client.match(/canvas\.style\.transform/g) ?? [];

		assert.strictEqual(transformAssignments.length, 1);
		assert.strictEqual(client.includes('.style.zoom'), false);
		assert.strictEqual(client.includes('renderEdges'), false);
		assert.ok(html.includes('id="scene-stage"'));
	});

	test('uses one bounded scene transform and scaled stage size', () => {
		const scene = sampleScene();

		assert.strictEqual(sceneTransform(1.34), 'scale(1.34)');
		assert.strictEqual(sceneTransform(10), `scale(${MAX_ZOOM})`);
		assert.strictEqual(sceneTransform(0), `scale(${MIN_ZOOM})`);
		assert.deepStrictEqual(scaledSceneSize(scene, 0.54), {
			width: scene.width * 0.54,
			height: scene.height * 0.54,
		});
	});

	test('keeps pointer scene coordinate fixed while zoom changes', () => {
		const input = {
			currentZoom: 1,
			nextZoom: 1.5,
			scrollLeft: 160,
			scrollTop: 90,
			pointerX: 240,
			pointerY: 180,
		};
		const transition = calculateZoomTransition(input);

		assert.strictEqual(
			(input.scrollLeft + input.pointerX) / input.currentZoom,
			(transition.scrollLeft + input.pointerX) / transition.zoom,
		);
		assert.strictEqual(
			(input.scrollTop + input.pointerY) / input.currentZoom,
			(transition.scrollTop + input.pointerY) / transition.zoom,
		);
	});

	test('returns to original scroll position without geometry drift', () => {
		const initial = {
			zoom: 1,
			scrollLeft: 125,
			scrollTop: 70,
		};
		const pointer = { pointerX: 260, pointerY: 140 };
		const zoomed = calculateZoomTransition({
			currentZoom: initial.zoom,
			nextZoom: 1.7,
			scrollLeft: initial.scrollLeft,
			scrollTop: initial.scrollTop,
			...pointer,
		});
		const restored = calculateZoomTransition({
			currentZoom: zoomed.zoom,
			nextZoom: 1,
			scrollLeft: zoomed.scrollLeft,
			scrollTop: zoomed.scrollTop,
			...pointer,
		});

		assert.strictEqual(restored.zoom, 1);
		assert.ok(Math.abs(restored.scrollLeft - initial.scrollLeft) < 1e-9);
		assert.ok(Math.abs(restored.scrollTop - initial.scrollTop) < 1e-9);
	});

	test('does not mutate fixed scene geometry during zoom', () => {
		const scene = sampleScene();
		const before = structuredClone(scene);

		calculateZoomTransition({
			currentZoom: 1,
			nextZoom: 0.55,
			scrollLeft: 0,
			scrollTop: 0,
			pointerX: 100,
			pointerY: 100,
		});
		scaledSceneSize(scene, 0.55);
		createMinimapGeometry(scene, 0.55, 0, 0, 800, 500);

		assert.deepStrictEqual(scene, before);
	});

	test('maps transformed viewport back into fixed minimap scene coordinates', () => {
		const scene = sampleScene();
		const atOne = createMinimapGeometry(scene, 1, 120, 60, 600, 300);
		const atScaled = createMinimapGeometry(scene, 1.6, 192, 96, 960, 480);

		assert.deepStrictEqual(atScaled.viewport, atOne.viewport);
		assert.deepStrictEqual(atScaled.nodes, scene.nodes);
	});

	test('fits dynamic multi-depth scene bounds into the minimap', () => {
		const baseScene = sampleScene();
		const expandedScene = sampleScene({
			width: 1800,
			nodes: [
				{ id: 'caller-two', x: 40, y: 220, width: 180, height: 58 },
				{ id: 'caller-three', x: 300, y: 60, width: 210, height: 58 },
				{ id: 'callee-two', x: 1500, y: 180, width: 220, height: 58 },
			],
		});
		const minimap = createMinimapGeometry(expandedScene, 1, 0, 0, 800, 500);

		assert.ok(expandedScene.width > baseScene.width);
		assert.ok(minimap.scale < createMinimapGeometry(baseScene, 1, 0, 0, 800, 500).scale);
		for (const geometry of minimap.nodes) {
			assert.ok(minimap.offsetX + geometry.x * minimap.scale >= 0);
			assert.ok(minimap.offsetX + (geometry.x + geometry.width) * minimap.scale <= 176);
		}
		assert.ok(minimap.viewport.x >= 0);
		assert.ok(minimap.viewport.x + minimap.viewport.width <= 176);
	});
});

function sampleScene(overrides: Partial<RenderSceneGeometry> = {}): RenderSceneGeometry {
	const base: RenderSceneGeometry = {
		width: 1000,
		height: 500,
		nodes: [
			{ id: 'caller', x: 40, y: 180, width: 180, height: 58 },
			{ id: 'focus', x: 400, y: 170, width: 220, height: 78 },
			{ id: 'callee', x: 780, y: 180, width: 180, height: 58 },
		],
		edges: [
			{
				id: 'caller-focus',
				type: 'normal',
				start: { x: 220, y: 209 },
				end: { x: 400, y: 209 },
			},
			{
				id: 'focus-callee',
				type: 'normal',
				start: { x: 620, y: 209 },
				end: { x: 780, y: 209 },
			},
		],
		hasObstructedEdges: false,
	};
	return {
		...base,
		...overrides,
		nodes: overrides.nodes ? [...base.nodes, ...overrides.nodes] : base.nodes,
	};
}
