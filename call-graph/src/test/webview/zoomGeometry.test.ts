import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import type { GraphModel, GraphNode } from '../../graph/types';
import { getWebviewHtml } from '../../webview/html';
import { createSceneGeometry } from '../../webview/sceneGeometry';
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
		});
		const client = fs.readFileSync(path.join(process.cwd(), 'src', 'webview', 'client', 'index.ts'), 'utf8');
		const transformAssignments = client.match(/canvas\.style\.transform/g) ?? [];

		assert.strictEqual(transformAssignments.length, 1);
		assert.strictEqual(client.includes('.style.zoom'), false);
		assert.strictEqual(client.includes('renderEdges'), false);
		assert.ok(html.includes('id="scene-stage"'));
	});

	test('uses one bounded scene transform and scaled stage size', () => {
		const scene = createSceneGeometry(sampleGraph());

		assert.strictEqual(sceneTransform(1.35), 'scale(1.35)');
		assert.strictEqual(sceneTransform(10), `scale(${MAX_ZOOM})`);
		assert.strictEqual(sceneTransform(0), `scale(${MIN_ZOOM})`);
		assert.deepStrictEqual(scaledSceneSize(scene, 0.55), {
			width: scene.width * 0.55,
			height: scene.height * 0.55,
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
		const scene = createSceneGeometry(sampleGraph());
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
		const scene = createSceneGeometry(sampleGraph());
		const atOne = createMinimapGeometry(scene, 1, 120, 60, 600, 300);
		const atScaled = createMinimapGeometry(scene, 1.8, 216, 108, 1080, 540);

		assert.deepStrictEqual(atScaled.viewport, atOne.viewport);
		assert.deepStrictEqual(atScaled.nodes, scene.nodes);
	});

	test('fits dynamic multi-depth scene bounds into the minimap', () => {
		const graph = sampleGraph();
		graph.nodes.push(
			node('caller-two', 'caller-two', 'caller', 2),
			node('caller-three', 'caller-three', 'caller', 3),
			node('callee-two', 'callee-two', 'callee', 2),
		);
		const baseScene = createSceneGeometry(sampleGraph());
		const expandedScene = createSceneGeometry(graph);
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

function sampleGraph(): GraphModel {
	return {
		focusNodeId: 'focus',
		includeTests: true,
		nodes: [
			node('caller', 'caller', 'caller', 1),
			node('focus', 'focus', 'focus', 0),
			node('callee', 'callee', 'callee', 1),
		],
		edges: [
			{ id: 'caller-focus', from: 'caller', to: 'focus', label: 'direct call' },
			{ id: 'focus-callee', from: 'focus', to: 'callee', label: 'direct call' },
		],
		unresolvedCalls: [],
		externalCalls: [],
		limitReached: false,
		callerDepth: 1,
		calleeDepth: 1,
		maxDepth: 8,
		nodeLimit: 40,
	};
}

function node(id: string, label: string, role: GraphNode['role'], depth: number): GraphNode {
	return {
		id,
		label,
		filePath: `${id}.py`,
		line: 1,
		role,
		depth,
	};
}
