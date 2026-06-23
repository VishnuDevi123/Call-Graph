import * as assert from 'assert';
import { expandRectangle, segmentIntersectsRectangle } from '../../webview/layout/geometry';
import { createSoftDepthBandLayout } from '../../webview/layout/softDepthBandLayout';
import type {
	LayoutNodeResult,
	LayoutRequest,
} from '../../webview/layout/workerProtocol';

suite('soft depth-band layout', () => {
	test('keeps readable depth order and separates nodes within each band', () => {
		const result = createSoftDepthBandLayout(layoutRequest());
		const nodes = byId(result.nodes);

		assert.ok(nodes.get('caller-2')!.x < nodes.get('caller-1')!.x);
		assert.ok(nodes.get('caller-1')!.x < nodes.get('focus')!.x);
		assert.ok(nodes.get('focus')!.x < nodes.get('callee-1')!.x);
		assert.ok(nodes.get('callee-1')!.x < nodes.get('callee-2')!.x);
		assertNoOverlaps(result.nodes);
	});

	test('uses prior positions as preferences without leaving the soft band', () => {
		const request = layoutRequest();
		request.previousPositions['caller-1'] = { x: 5, y: 40 };
		request.previousPositions['caller-peer'] = { x: 5000, y: 420 };

		const first = createSoftDepthBandLayout(request);
		const second = createSoftDepthBandLayout(request);
		const nodes = byId(first.nodes);

		assert.ok(nodes.get('caller-1')!.y < nodes.get('caller-peer')!.y);
		assert.ok(Math.abs(nodes.get('caller-1')!.x - nodes.get('caller-peer')!.x) < 100);
		assert.deepStrictEqual(first, second);
	});

	test('spreads direct callers into hierarchy-aware sub-bands', () => {
		const result = createSoftDepthBandLayout(hierarchicalFanInRequest());
		const nodes = byId(result.nodes);

		assert.ok(nodes.get('entry')!.x < nodes.get('initialize')!.x);
		assert.ok(nodes.get('initialize')!.x < nodes.get('setup')!.x);
		assert.ok(nodes.get('setup')!.x < nodes.get('focus')!.x);
		assert.ok(nodes.get('independent')!.x > nodes.get('initialize')!.x);
		assertNoOverlaps(result.nodes);
	});

	test('spreads direct callees into hierarchy-aware sub-bands', () => {
		const request = hierarchicalFanInRequest();
		request.nodes = [
			{ id: 'focus', role: 'focus', depth: 0, width: 180, height: 70 },
			{ id: 'first', role: 'callee', depth: 1, width: 120, height: 50 },
			{ id: 'second', role: 'callee', depth: 1, width: 120, height: 50 },
			{ id: 'third', role: 'callee', depth: 1, width: 120, height: 50 },
		];
		request.edges = [
			{ id: 'focus-first', from: 'focus', to: 'first', type: 'normal' },
			{ id: 'focus-second', from: 'focus', to: 'second', type: 'normal' },
			{ id: 'focus-third', from: 'focus', to: 'third', type: 'normal' },
			{ id: 'first-second', from: 'first', to: 'second', type: 'normal' },
			{ id: 'second-third', from: 'second', to: 'third', type: 'normal' },
		];

		const nodes = byId(createSoftDepthBandLayout(request).nodes);

		assert.ok(nodes.get('focus')!.x < nodes.get('first')!.x);
		assert.ok(nodes.get('first')!.x < nodes.get('second')!.x);
		assert.ok(nodes.get('second')!.x < nodes.get('third')!.x);
	});

	test('keeps same-side cycles together without unbounded rank growth', () => {
		const request = hierarchicalFanInRequest();
		request.edges.push({
			id: 'setup-initialize',
			from: 'setup',
			to: 'initialize',
			type: 'reciprocal',
		});
		request.edges = request.edges.map(edge =>
			edge.id === 'initialize-setup' ? { ...edge, type: 'reciprocal' } : edge,
		);

		const nodes = byId(createSoftDepthBandLayout(request).nodes);

		assert.ok(Math.abs(center(nodes.get('initialize')!).x - center(nodes.get('setup')!).x) < 100);
		assert.ok(nodes.get('entry')!.x < nodes.get('initialize')!.x);
	});

	test('moves an unrelated node away from a normal straight edge', () => {
		const request = obstructionRequest();
		const result = createSoftDepthBandLayout(request);
		const nodes = byId(result.nodes);
		const source = nodes.get('source')!;
		const target = nodes.get('target')!;
		const obstacle = nodes.get('obstacle')!;

		assert.strictEqual(result.hasObstructedEdges, false);
		assert.strictEqual(segmentIntersectsRectangle(
			{
				start: center(source),
				end: center(target),
			},
			expandRectangle(obstacle, request.settings.obstaclePadding),
		), false);
		assertNoOverlaps(result.nodes);
	});

	test('returns the best non-overlapping result when the deadline expires', () => {
		const clock = {
			value: 0,
			now(): number {
				this.value += 1000;
				return this.value;
			},
		};

		const result = createSoftDepthBandLayout(obstructionRequest(), clock);

		assertNoOverlaps(result.nodes);
		assert.strictEqual(result.requestId, 7);
	});
});

function layoutRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 7,
		focusNodeId: 'focus',
		nodes: [
			{ id: 'caller-2', role: 'caller', depth: 2, width: 120, height: 60 },
			{ id: 'caller-1', role: 'caller', depth: 1, width: 140, height: 60 },
			{ id: 'caller-peer', role: 'caller', depth: 1, width: 100, height: 50 },
			{ id: 'focus', role: 'focus', depth: 0, width: 180, height: 80 },
			{ id: 'callee-1', role: 'callee', depth: 1, width: 130, height: 60 },
			{ id: 'callee-2', role: 'callee', depth: 2, width: 120, height: 60 },
		],
		edges: [
			{ id: 'caller-2-1', from: 'caller-2', to: 'caller-1', type: 'normal' },
			{ id: 'caller-focus', from: 'caller-1', to: 'focus', type: 'normal' },
			{ id: 'focus-callee', from: 'focus', to: 'callee-1', type: 'normal' },
			{ id: 'callee-1-2', from: 'callee-1', to: 'callee-2', type: 'normal' },
		],
		viewport: { width: 800, height: 600 },
		depths: { callers: 2, callees: 2 },
		previousPositions: {},
		settings: {
			nodeGap: 80,
			bandGap: 180,
			obstaclePadding: 12,
		},
	};
}

function obstructionRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 7,
		focusNodeId: 'target',
		nodes: [
			{ id: 'source', role: 'caller', depth: 2, width: 100, height: 50 },
			{ id: 'obstacle', role: 'caller', depth: 1, width: 120, height: 70 },
			{ id: 'target', role: 'focus', depth: 0, width: 160, height: 70 },
		],
		edges: [{
			id: 'source-target',
			from: 'source',
			to: 'target',
			type: 'normal',
		}],
		viewport: { width: 800, height: 600 },
		depths: { callers: 2, callees: 1 },
		previousPositions: {
			source: { x: 0, y: 250 },
			obstacle: { x: 300, y: 240 },
			target: { x: 650, y: 240 },
		},
		settings: {
			nodeGap: 60,
			bandGap: 180,
			obstaclePadding: 12,
		},
	};
}

function hierarchicalFanInRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 11,
		focusNodeId: 'focus',
		nodes: [
			{ id: 'entry', role: 'caller', depth: 1, width: 120, height: 50 },
			{ id: 'initialize', role: 'caller', depth: 1, width: 140, height: 50 },
			{ id: 'setup', role: 'caller', depth: 1, width: 120, height: 50 },
			{ id: 'independent', role: 'caller', depth: 1, width: 130, height: 50 },
			{ id: 'focus', role: 'focus', depth: 0, width: 180, height: 70 },
		],
		edges: [
			{ id: 'entry-focus', from: 'entry', to: 'focus', type: 'normal' },
			{ id: 'initialize-focus', from: 'initialize', to: 'focus', type: 'normal' },
			{ id: 'setup-focus', from: 'setup', to: 'focus', type: 'normal' },
			{ id: 'independent-focus', from: 'independent', to: 'focus', type: 'normal' },
			{ id: 'entry-initialize', from: 'entry', to: 'initialize', type: 'normal' },
			{ id: 'initialize-setup', from: 'initialize', to: 'setup', type: 'normal' },
		],
		viewport: { width: 1000, height: 700 },
		depths: { callers: 1, callees: 1 },
		previousPositions: {},
		settings: {
			nodeGap: 80,
			bandGap: 180,
			obstaclePadding: 12,
		},
	};
}

function byId(nodes: LayoutNodeResult[]): Map<string, LayoutNodeResult> {
	return new Map(nodes.map(node => [node.id, node]));
}

function center(node: LayoutNodeResult): { x: number; y: number } {
	return {
		x: node.x + node.width / 2,
		y: node.y + node.height / 2,
	};
}

function assertNoOverlaps(nodes: LayoutNodeResult[]): void {
	for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
			const left = nodes[leftIndex];
			const right = nodes[rightIndex];
			const overlaps = left.x < right.x + right.width
				&& left.x + left.width > right.x
				&& left.y < right.y + right.height
				&& left.y + left.height > right.y;
			assert.strictEqual(overlaps, false, `${left.id} overlaps ${right.id}`);
		}
	}
}
