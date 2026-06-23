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

	test('retains obstruction status for the rendering warning', () => {
		const result = layoutResult();
		result.hasObstructedEdges = true;

		assert.strictEqual(createRenderScene(result).hasObstructedEdges, true);
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
