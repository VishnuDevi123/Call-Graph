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

	test('keeps tiny unobstructed graphs aligned despite scattered prior positions', () => {
		const result = createSoftDepthBandLayout(tinyUnobstructedRequest());
		const nodes = byId(result.nodes);
		const focusY = center(nodes.get('focus')!).y;
		const callerY = center(nodes.get('caller')!).y;
		const calleeY = center(nodes.get('callee')!).y;

		assert.strictEqual(result.hasObstructedEdges, false);
		assert.ok(Math.abs(callerY - focusY) <= 60);
		assert.ok(Math.abs(calleeY - focusY) <= 60);
		assert.ok(nodes.get('caller')!.x < nodes.get('focus')!.x);
		assert.ok(nodes.get('focus')!.x < nodes.get('callee')!.x);
	});

	test('uses compact spacing while preserving depth differentiation', () => {
		const request = layoutRequest();
		request.settings.bandGap = 150;
		const nodes = byId(createSoftDepthBandLayout(request).nodes);
		const callerDistance = center(nodes.get('caller-1')!).x - center(nodes.get('caller-2')!).x;
		const calleeDistance = center(nodes.get('callee-2')!).x - center(nodes.get('callee-1')!).x;

		assert.ok(callerDistance > 0);
		assert.ok(calleeDistance > 0);
		assert.ok(callerDistance < 300);
		assert.ok(calleeDistance < 300);
	});

	test('spreads direct callers into hierarchy-aware sub-bands', () => {
		const request = hierarchicalFanInRequest();
		request.depths.callers = 3;
		const result = createSoftDepthBandLayout(request);
		const nodes = byId(result.nodes);

		assert.ok(nodes.get('entry')!.x < nodes.get('initialize')!.x);
		assert.ok(nodes.get('initialize')!.x < nodes.get('setup')!.x);
		assert.ok(nodes.get('setup')!.x < nodes.get('focus')!.x);
		assert.ok(nodes.get('independent')!.x > nodes.get('initialize')!.x);
		assertNoOverlaps(result.nodes);
	});

	test('aligns connected caller chains vertically when unobstructed', () => {
		const result = createSoftDepthBandLayout(callerRowAlignmentRequest());
		const nodes = byId(result.nodes);
		const outer = center(nodes.get('outer-caller')!);
		const connected = center(nodes.get('connected-caller')!);
		const unrelated = center(nodes.get('unrelated-caller')!);

		assert.ok(Math.abs(outer.y - connected.y) < Math.abs(outer.y - unrelated.y));
		assert.ok(Math.abs(outer.y - connected.y) <= 36);
		assert.ok(outer.x < connected.x);
		assert.ok(connected.x < center(nodes.get('focus')!).x);
		assertNoOverlaps(result.nodes);
	});

	test('spreads direct callees into hierarchy-aware sub-bands', () => {
		const request = hierarchicalFanInRequest();
		request.depths.callees = 3;
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

	test('aligns connected callee chains vertically when unobstructed', () => {
		const result = createSoftDepthBandLayout(calleeRowAlignmentRequest());
		const nodes = byId(result.nodes);
		const inner = center(nodes.get('connected-callee')!);
		const outer = center(nodes.get('outer-callee')!);
		const unrelated = center(nodes.get('unrelated-callee')!);

		assert.ok(Math.abs(outer.y - inner.y) < Math.abs(outer.y - unrelated.y));
		assert.ok(Math.abs(outer.y - inner.y) <= 36);
		assert.ok(center(nodes.get('focus')!).x < inner.x);
		assert.ok(inner.x < outer.x);
		assertNoOverlaps(result.nodes);
	});

	test('row alignment preserves horizontal depth ordering', () => {
		const callerNodes = byId(createSoftDepthBandLayout(callerRowAlignmentRequest()).nodes);
		const calleeNodes = byId(createSoftDepthBandLayout(calleeRowAlignmentRequest()).nodes);

		assert.ok(callerNodes.get('outer-caller')!.x < callerNodes.get('connected-caller')!.x);
		assert.ok(callerNodes.get('connected-caller')!.x < callerNodes.get('focus')!.x);
		assert.ok(calleeNodes.get('focus')!.x < calleeNodes.get('connected-callee')!.x);
		assert.ok(calleeNodes.get('connected-callee')!.x < calleeNodes.get('outer-callee')!.x);
	});

	test('caps hierarchy-aware sub-bands at the selected depth', () => {
		const request = hierarchicalFanInRequest();
		request.depths.callers = 2;
		const nodes = byId(createSoftDepthBandLayout(request).nodes);
		const callerCenters = [
			center(nodes.get('entry')!).x,
			center(nodes.get('initialize')!).x,
			center(nodes.get('setup')!).x,
			center(nodes.get('independent')!).x,
		];

		assert.ok(countHorizontalBands(callerCenters) <= 2);
		assert.ok(Math.min(...callerCenters) < center(nodes.get('setup')!).x);
		assert.ok(nodes.get('setup')!.x < nodes.get('focus')!.x);
	});

	test('keeps same-side cycles together without unbounded rank growth', () => {
		const request = hierarchicalFanInRequest();
		request.depths.callers = 3;
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

	test('does not warn when only the invisible safety padding is crossed', () => {
		const request = paddingOnlyObstructionRequest();
		const result = createSoftDepthBandLayout(request);

		assert.strictEqual(result.hasObstructedEdges, false);
	});

	test('does not warn for rendered edge boundary contact', () => {
		const request = boundaryOnlyRenderedContactRequest();
		const result = createSoftDepthBandLayout(request, expiredClock());

		assert.strictEqual(result.hasObstructedEdges, false);
	});

	test('warns only when a rendered edge crosses an unrelated visible node', () => {
		const request = actualRenderedObstructionRequest();
		const result = createSoftDepthBandLayout(request, expiredClock());

		assert.strictEqual(result.hasObstructedEdges, true);
	});

	test('keeps large measured labels non-overlapping and ordered by side', () => {
		const result = createSoftDepthBandLayout(largeLabelRequest());
		const nodes = byId(result.nodes);

		assert.ok(nodes.get('caller-long')!.x < nodes.get('focus')!.x);
		assert.ok(nodes.get('focus')!.x < nodes.get('callee-long')!.x);
		assertNoOverlaps(result.nodes);
		assert.strictEqual(result.hasObstructedEdges, false);
	});

	test('returns a bounded best result for dense graphs without overlap', () => {
		const result = createSoftDepthBandLayout(denseGraphRequest(), expiredClock());

		assert.strictEqual(result.nodes.length, 31);
		assertNoOverlaps(result.nodes);
		assert.ok(result.contentBounds.width > 0);
		assert.ok(result.contentBounds.height > 0);
	});

	test('keeps reciprocal cycles usable without routing warnings', () => {
		const result = createSoftDepthBandLayout(reciprocalCycleRequest());
		const reciprocalEdges = result.edges.filter(edge => edge.type === 'reciprocal');

		assert.strictEqual(reciprocalEdges.length, 2);
		assertNoOverlaps(result.nodes);
		assert.strictEqual(result.hasObstructedEdges, false);
	});

	test('allows the focus node to become an outermost bound when one side is empty', () => {
		const nodes = byId(createSoftDepthBandLayout(calleeOnlyRequest()).nodes);

		assert.ok(nodes.get('focus')!.x < nodes.get('callee-1')!.x);
		assert.ok(nodes.get('callee-1')!.x < nodes.get('callee-2')!.x);
		assertNoOverlaps([...nodes.values()]);
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

function tinyUnobstructedRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 17,
		focusNodeId: 'focus',
		nodes: [
			{ id: 'caller', role: 'caller', depth: 1, width: 120, height: 50 },
			{ id: 'focus', role: 'focus', depth: 0, width: 160, height: 70 },
			{ id: 'callee', role: 'callee', depth: 1, width: 120, height: 50 },
		],
		edges: [
			{ id: 'caller-focus', from: 'caller', to: 'focus', type: 'normal' },
			{ id: 'focus-callee', from: 'focus', to: 'callee', type: 'normal' },
		],
		viewport: { width: 800, height: 600 },
		depths: { callers: 1, callees: 1 },
		previousPositions: {
			caller: { x: 10, y: 40 },
			focus: { x: 320, y: 260 },
			callee: { x: 650, y: 500 },
		},
		settings: {
			nodeGap: 76,
			bandGap: 150,
			obstaclePadding: 12,
		},
	};
}

function paddingOnlyObstructionRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 19,
		focusNodeId: 'target',
		nodes: [
			{ id: 'source', role: 'caller', depth: 1, width: 100, height: 50 },
			{ id: 'obstacle', role: 'caller', depth: 1, width: 100, height: 50 },
			{ id: 'target', role: 'focus', depth: 0, width: 100, height: 50 },
		],
		edges: [{
			id: 'source-target',
			from: 'source',
			to: 'target',
			type: 'normal',
		}],
		viewport: { width: 800, height: 600 },
		depths: { callers: 1, callees: 1 },
		previousPositions: {
			source: { x: 120, y: 275 },
			obstacle: { x: 325, y: 330 },
			target: { x: 530, y: 275 },
		},
		settings: {
			nodeGap: 76,
			bandGap: 150,
			obstaclePadding: 28,
		},
	};
}

function callerRowAlignmentRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 21,
		focusNodeId: 'focus',
		nodes: [
			{ id: 'outer-caller', role: 'caller', depth: 2, width: 120, height: 50 },
			{ id: 'connected-caller', role: 'caller', depth: 1, width: 140, height: 50 },
			{ id: 'unrelated-caller', role: 'caller', depth: 1, width: 130, height: 50 },
			{ id: 'focus', role: 'focus', depth: 0, width: 180, height: 70 },
		],
		edges: [
			{ id: 'outer-connected', from: 'outer-caller', to: 'connected-caller', type: 'normal' },
			{ id: 'connected-focus', from: 'connected-caller', to: 'focus', type: 'normal' },
			{ id: 'unrelated-focus', from: 'unrelated-caller', to: 'focus', type: 'normal' },
		],
		viewport: { width: 1000, height: 700 },
		depths: { callers: 2, callees: 1 },
		previousPositions: {
			'connected-caller': { x: 300, y: 210 },
			'unrelated-caller': { x: 300, y: 410 },
		},
		settings: {
			nodeGap: 80,
			bandGap: 180,
			obstaclePadding: 12,
		},
	};
}

function calleeRowAlignmentRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 22,
		focusNodeId: 'focus',
		nodes: [
			{ id: 'focus', role: 'focus', depth: 0, width: 180, height: 70 },
			{ id: 'connected-callee', role: 'callee', depth: 1, width: 140, height: 50 },
			{ id: 'unrelated-callee', role: 'callee', depth: 1, width: 130, height: 50 },
			{ id: 'outer-callee', role: 'callee', depth: 2, width: 120, height: 50 },
		],
		edges: [
			{ id: 'focus-connected', from: 'focus', to: 'connected-callee', type: 'normal' },
			{ id: 'focus-unrelated', from: 'focus', to: 'unrelated-callee', type: 'normal' },
			{ id: 'connected-outer', from: 'connected-callee', to: 'outer-callee', type: 'normal' },
		],
		viewport: { width: 1000, height: 700 },
		depths: { callers: 1, callees: 2 },
		previousPositions: {
			'connected-callee': { x: 560, y: 210 },
			'unrelated-callee': { x: 560, y: 410 },
		},
		settings: {
			nodeGap: 80,
			bandGap: 180,
			obstaclePadding: 12,
		},
	};
}

function boundaryOnlyRenderedContactRequest(): LayoutRequest {
	const request = actualRenderedObstructionRequest();
	request.requestId = 23;
	request.nodes = request.nodes.map(node =>
		node.id === 'obstacle'
			? { ...node, height: 50 }
			: node,
	);
	request.previousPositions.obstacle = { x: 300, y: 225 };
	return request;
}

function actualRenderedObstructionRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 24,
		focusNodeId: 'target',
		nodes: [
			{ id: 'source', role: 'caller', depth: 2, width: 100, height: 50 },
			{ id: 'obstacle', role: 'caller', depth: 1, width: 120, height: 90 },
			{ id: 'target', role: 'focus', depth: 0, width: 160, height: 70 },
		],
		edges: [{
			id: 'source-target',
			from: 'source',
			to: 'target',
			type: 'normal',
		}],
		viewport: { width: 800, height: 700 },
		depths: { callers: 2, callees: 1 },
		previousPositions: {
			source: { x: 0, y: 325 },
			obstacle: { x: 300, y: 305 },
			target: { x: 650, y: 315 },
		},
		settings: {
			nodeGap: 60,
			bandGap: 180,
			obstaclePadding: 12,
		},
	};
}

function largeLabelRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 25,
		focusNodeId: 'focus',
		nodes: [
			{ id: 'caller-long', role: 'caller', depth: 1, width: 560, height: 58 },
			{ id: 'focus', role: 'focus', depth: 0, width: 640, height: 76 },
			{ id: 'callee-long', role: 'callee', depth: 1, width: 520, height: 58 },
		],
		edges: [
			{ id: 'caller-focus', from: 'caller-long', to: 'focus', type: 'normal' },
			{ id: 'focus-callee', from: 'focus', to: 'callee-long', type: 'normal' },
		],
		viewport: { width: 900, height: 600 },
		depths: { callers: 1, callees: 1 },
		previousPositions: {},
		settings: {
			nodeGap: 64,
			bandGap: 120,
			obstaclePadding: 10,
		},
	};
}

function denseGraphRequest(): LayoutRequest {
	const nodes: LayoutRequest['nodes'] = [
		{ id: 'focus', role: 'focus', depth: 0, width: 180, height: 70 },
	];
	const edges: LayoutRequest['edges'] = [];
	for (let index = 1; index <= 15; index += 1) {
		const callerId = `caller-${index}`;
		const calleeId = `callee-${index}`;
		nodes.push(
			{ id: callerId, role: 'caller', depth: index <= 8 ? 1 : 2, width: 128 + index, height: 48 },
			{ id: calleeId, role: 'callee', depth: index <= 8 ? 1 : 2, width: 132 + index, height: 48 },
		);
		edges.push(
			{ id: `${callerId}-focus`, from: callerId, to: 'focus', type: 'normal' },
			{ id: `focus-${calleeId}`, from: 'focus', to: calleeId, type: 'normal' },
		);
		if (index > 8) {
			edges.push(
				{ id: `${callerId}-caller-1`, from: callerId, to: 'caller-1', type: 'normal' },
				{ id: `callee-1-${calleeId}`, from: 'callee-1', to: calleeId, type: 'normal' },
			);
		}
	}
	return {
		type: 'layoutRequest',
		requestId: 26,
		focusNodeId: 'focus',
		nodes,
		edges,
		viewport: { width: 1200, height: 800 },
		depths: { callers: 2, callees: 2 },
		previousPositions: {},
		settings: {
			nodeGap: 46,
			bandGap: 140,
			obstaclePadding: 8,
		},
	};
}

function reciprocalCycleRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 27,
		focusNodeId: 'focus',
		nodes: [
			{ id: 'caller', role: 'caller', depth: 1, width: 130, height: 52 },
			{ id: 'focus', role: 'focus', depth: 0, width: 180, height: 70 },
			{ id: 'callee', role: 'callee', depth: 1, width: 130, height: 52 },
		],
		edges: [
			{ id: 'caller-focus', from: 'caller', to: 'focus', type: 'reciprocal' },
			{ id: 'focus-caller', from: 'focus', to: 'caller', type: 'reciprocal' },
			{ id: 'focus-callee', from: 'focus', to: 'callee', type: 'normal' },
		],
		viewport: { width: 900, height: 600 },
		depths: { callers: 1, callees: 1 },
		previousPositions: {},
		settings: {
			nodeGap: 76,
			bandGap: 160,
			obstaclePadding: 12,
		},
	};
}

function calleeOnlyRequest(): LayoutRequest {
	return {
		type: 'layoutRequest',
		requestId: 28,
		focusNodeId: 'focus',
		nodes: [
			{ id: 'focus', role: 'focus', depth: 0, width: 180, height: 70 },
			{ id: 'callee-1', role: 'callee', depth: 1, width: 130, height: 52 },
			{ id: 'callee-2', role: 'callee', depth: 2, width: 130, height: 52 },
		],
		edges: [
			{ id: 'focus-callee-1', from: 'focus', to: 'callee-1', type: 'normal' },
			{ id: 'callee-1-callee-2', from: 'callee-1', to: 'callee-2', type: 'normal' },
		],
		viewport: { width: 900, height: 600 },
		depths: { callers: 1, callees: 2 },
		previousPositions: {},
		settings: {
			nodeGap: 76,
			bandGap: 160,
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

function countHorizontalBands(centers: number[], tolerance = 96): number {
	return [...centers]
		.sort((left, right) => left - right)
		.reduce((bands, value) => {
			const lastBand = bands.at(-1);
			if (lastBand === undefined || Math.abs(value - lastBand) > tolerance) {
				bands.push(value);
			}
			return bands;
		}, [] as number[])
		.length;
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

function expiredClock(): { value: number; now(): number } {
	return {
		value: 0,
		now(): number {
			this.value += 1000;
			return this.value;
		},
	};
}
