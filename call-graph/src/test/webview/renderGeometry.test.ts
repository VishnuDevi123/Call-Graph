import * as assert from 'assert';
import { edgePath } from '../../webview/client/edges';
import { createRenderScene } from '../../webview/renderGeometry';
import type { LayoutSuccessResult } from '../../webview/layout/workerProtocol';

suite('webview variable node and vector edge geometry', () => {
	test('translates measured nodes and edge endpoints into one positive scene', () => {
		const scene = createRenderScene(layoutResult());

		assert.deepStrictEqual(scene.nodes, [
			{ id: 'caller', x: 64, y: 74, width: 143, height: 54 },
			{ id: 'focus', x: 444, y: 64, width: 211, height: 72 },
		]);
		assert.deepStrictEqual(scene.edges[0].start, { x: 207, y: 101 });
		assert.deepStrictEqual(scene.edges[0].end, { x: 444, y: 100 });
		assert.strictEqual(scene.width, 719);
		assert.strictEqual(scene.height, 200);
	});

	test('renders normal edges as one straight target-facing vector', () => {
		assert.strictEqual(edgePath({
			id: 'normal',
			type: 'normal',
			start: { x: 20, y: 30 },
			end: { x: 220, y: 90 },
		}), 'M 20 30 L 220 90');
	});

	test('renders reciprocal directions on opposite sides as an oval-like pair', () => {
		const forward = edgePath({
			id: 'forward',
			type: 'reciprocal',
			start: { x: 100, y: 100 },
			end: { x: 300, y: 100 },
		});
		const reverse = edgePath({
			id: 'reverse',
			type: 'reciprocal',
			start: { x: 300, y: 100 },
			end: { x: 100, y: 100 },
		});

		assert.strictEqual(forward, 'M 100 100 Q 200 154 300 100');
		assert.strictEqual(reverse, 'M 300 100 Q 200 46 100 100');
	});

	test('keeps uneven outer bounds positive when the focus is outermost', () => {
		const scene = createRenderScene({
			type: 'layoutResult',
			requestId: 29,
			nodes: [
				{ id: 'focus', x: -420, y: 40, width: 180, height: 70 },
				{ id: 'callee', x: 260, y: -180, width: 220, height: 58 },
			],
			edges: [{
				id: 'focus-callee',
				type: 'normal',
				start: { x: -240, y: 75 },
				end: { x: 260, y: -151 },
			}],
			contentBounds: {
				left: -420,
				top: -180,
				right: 480,
				bottom: 110,
				width: 900,
				height: 290,
			},
			hasObstructedEdges: false,
		});

		assert.deepStrictEqual(scene.nodes[0], { id: 'focus', x: 64, y: 284, width: 180, height: 70 });
		assert.deepStrictEqual(scene.nodes[1], { id: 'callee', x: 744, y: 64, width: 220, height: 58 });
		assert.deepStrictEqual(scene.edges[0].start, { x: 244, y: 319 });
		assert.deepStrictEqual(scene.edges[0].end, { x: 744, y: 93 });
		assert.strictEqual(scene.width, 1028);
		assert.strictEqual(scene.height, 418);
	});

});

function layoutResult(): LayoutSuccessResult {
	return {
		type: 'layoutResult',
		requestId: 2,
		nodes: [
			{ id: 'caller', x: -100, y: 10, width: 143, height: 54 },
			{ id: 'focus', x: 280, y: 0, width: 211, height: 72 },
		],
		edges: [{
			id: 'caller-focus',
			type: 'normal',
			start: { x: 43, y: 37 },
			end: { x: 280, y: 36 },
		}],
		contentBounds: {
			left: -100,
			top: 0,
			right: 491,
			bottom: 72,
			width: 591,
			height: 72,
		},
		hasObstructedEdges: false,
	};
}
