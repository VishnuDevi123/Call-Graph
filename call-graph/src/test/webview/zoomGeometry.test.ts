import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import { getWebviewHtml } from '../../webview/html';
import type { RenderSceneGeometry } from '../../webview/renderGeometry';
import {
	calculateZoomTransition,
	calculateFitTransition,
	createMinimapGeometry,
	AUTO_FIT_MIN_ZOOM,
	MANUAL_MIN_ZOOM,
	MAX_ZOOM,
	normalizeZoom,
	scaledSceneSize,
	sceneTransform,
	stageSizeWithPanSpace,
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
		assert.strictEqual(sceneTransform(0), `scale(${AUTO_FIT_MIN_ZOOM})`);
		assert.deepStrictEqual(scaledSceneSize(scene, 0.54), {
			width: scene.width * 0.54,
			height: scene.height * 0.54,
		});
	});

	test('fits the complete graph below the manual zoom floor when necessary', () => {
		const scene = sampleScene({ width: 6000, height: 3000 });
		const fit = calculateFitTransition(scene, 800, 500);

		assert.ok(fit.zoom < MANUAL_MIN_ZOOM);
		assert.ok(fit.zoom >= AUTO_FIT_MIN_ZOOM);
		assert.ok(scene.width * fit.zoom <= 800);
		assert.ok(scene.height * fit.zoom <= 500);
	});

	test('keeps the default manual zoom floor unless a smaller fit floor is supplied', () => {
		assert.strictEqual(normalizeZoom(0.3), MANUAL_MIN_ZOOM);
		assert.strictEqual(normalizeZoom(0.3, 0.22), 0.3);
		assert.strictEqual(normalizeZoom(0.1, 0.22), 0.22);
		assert.strictEqual(normalizeZoom(0.01, 0.01), AUTO_FIT_MIN_ZOOM);
	});

	test('allows wheel zoom-out to return to the current fitted scale', () => {
		const fitFloor = 0.24;
		const transition = calculateZoomTransition({
			currentZoom: 0.56,
			nextZoom: 0.46,
			minZoom: fitFloor,
			scrollLeft: 820,
			scrollTop: 510,
			pointerX: 240,
			pointerY: 180,
			canvasLeft: 800,
			canvasTop: 500,
		});
		const floorTransition = calculateZoomTransition({
			currentZoom: transition.zoom,
			nextZoom: 0.1,
			minZoom: fitFloor,
			scrollLeft: transition.scrollLeft,
			scrollTop: transition.scrollTop,
			pointerX: 240,
			pointerY: 180,
			canvasLeft: 800,
			canvasTop: 500,
		});

		assert.strictEqual(transition.zoom, 0.46);
		assert.strictEqual(floorTransition.zoom, fitFloor);
	});

	test('adds one viewport of pan space on every side of the scene', () => {
		const scene = sampleScene();

		assert.deepStrictEqual(stageSizeWithPanSpace(scene, 0.5, 800, 500), {
			width: scene.width * 0.5 + 1600,
			height: scene.height * 0.5 + 1000,
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

	test('keeps pointer scene coordinate fixed with viewport pan margins', () => {
		const input = {
			currentZoom: 0.25,
			nextZoom: 0.6,
			scrollLeft: 920,
			scrollTop: 560,
			pointerX: 240,
			pointerY: 180,
			canvasLeft: 800,
			canvasTop: 500,
		};
		const transition = calculateZoomTransition(input);
		const beforeX = (input.scrollLeft + input.pointerX - input.canvasLeft) / input.currentZoom;
		const beforeY = (input.scrollTop + input.pointerY - input.canvasTop) / input.currentZoom;
		const afterX = (transition.scrollLeft + input.pointerX - input.canvasLeft) / transition.zoom;
		const afterY = (transition.scrollTop + input.pointerY - input.canvasTop) / transition.zoom;

		assert.strictEqual(afterX, beforeX);
		assert.strictEqual(afterY, beforeY);
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
	};
	return {
		...base,
		...overrides,
		nodes: overrides.nodes ? [...base.nodes, ...overrides.nodes] : base.nodes,
	};
}
