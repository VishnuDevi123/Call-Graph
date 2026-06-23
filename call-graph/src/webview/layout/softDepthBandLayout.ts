/**
 * Deterministic soft-band layout for the focused call graph.
 *
 * Nodes stay in depth-ordered horizontal bands, but prior positions and
 * obstruction repair may move them vertically and slightly within a band.
 * Retries grow spacing until every normal edge clears unrelated padded nodes,
 * or the graph-size time budget expires.
 */
import {
	expandRectangle,
	rectangleBoundaryIntersection,
	rectangleCenter,
	sceneBounds,
	segmentIntersectsRectangle,
} from './geometry';
import type { Point, Rectangle } from './geometry';
import type {
	LayoutEdgeResult,
	LayoutNodeInput,
	LayoutNodeResult,
	LayoutRequest,
	LayoutSuccessResult,
} from './workerProtocol';

interface LayoutCandidate {
	nodes: LayoutNodeResult[];
	obstructionCount: number;
	displacement: number;
}

interface Obstruction {
	edge: LayoutRequest['edges'][number];
	nodeId: string;
}

interface LayoutClock {
	now(): number;
}

type LayoutRanks = Map<string, number>;

const SMALL_GRAPH_TIME_BUDGET_MS = 150;
const LARGE_GRAPH_TIME_BUDGET_MS = 750;
const LARGE_GRAPH_NODE_COUNT = 100;
const MAX_RETRY_COUNT = 160;
const SPACING_GROWTH_PER_RETRY = 0.08;
const MAX_SPACING_SCALE = 4;
const REPAIR_ROUNDS_PER_RETRY = 6;

/**
 * Places measured nodes and returns boundary-attached straight edge geometry.
 * The optional clock exists so deadline behavior can be verified without
 * making production timing policy dependent on tests.
 */
export function createSoftDepthBandLayout(
	request: LayoutRequest,
	clock: LayoutClock = performance,
): LayoutSuccessResult {
	const startedAt = clock.now();
	const deadline = startedAt + timeBudgetForNodeCount(request.nodes.length);
	const retryCount = retryCountForNodeCount(request.nodes.length);
	const layoutRanks = calculateLayoutRanks(request);
	let best: LayoutCandidate | undefined;

	for (let attempt = 0; attempt < retryCount; attempt += 1) {
		if (attempt > 0 && clock.now() >= deadline) {
			break;
		}

		const spacingScale = Math.min(
			MAX_SPACING_SCALE,
			1 + attempt * SPACING_GROWTH_PER_RETRY,
		);
		const nodes = placeNodes(request, layoutRanks, spacingScale, attempt);
		repairObstructions(request, layoutRanks, nodes, spacingScale, deadline, clock);
		const obstructionCount = findObstructions(request, nodes).length;
		const candidate = {
			nodes,
			obstructionCount,
			displacement: previousPositionDisplacement(request, nodes),
		};

		if (!best || isBetterCandidate(candidate, best)) {
			best = candidate;
		}
		if (obstructionCount === 0) {
			break;
		}
	}

	// At least the first attempt always runs, even when a supplied clock has
	// already exhausted the budget.
	const selected = best ?? {
		nodes: placeNodes(request, layoutRanks, 1, 0),
		obstructionCount: 0,
		displacement: 0,
	};
	const edges = createEdgeResults(request, selected.nodes);

	return {
		type: 'layoutResult',
		requestId: request.requestId,
		nodes: selected.nodes,
		edges,
		contentBounds: sceneBounds(selected.nodes),
		hasObstructedEdges: selected.obstructionCount > 0,
	};
}

function placeNodes(
	request: LayoutRequest,
	layoutRanks: LayoutRanks,
	spacingScale: number,
	attempt: number,
): LayoutNodeResult[] {
	const bands = groupNodesByBand(request.nodes, layoutRanks);
	const bandCenters = calculateBandCenters(request, bands, spacingScale);
	const nodeGap = request.settings.nodeGap * spacingScale;
	const horizontalFlex = Math.min(
		request.settings.bandGap * 0.18,
		48,
	) * Math.min(spacingScale, 1.75);
	const nodes: LayoutNodeResult[] = [];

	for (const [bandKey, bandNodes] of bands) {
		const orderedNodes = orderBandNodes(bandNodes, request, attempt);
		const preferredCenters = orderedNodes.map((node, index) => {
			const previous = request.previousPositions[node.id];
			return previous
				? previous.y + node.height / 2
				: defaultVerticalCenter(index, orderedNodes, nodeGap, request.viewport.height);
		});
		const yCenters = separateVerticalCenters(orderedNodes, preferredCenters, nodeGap);

		orderedNodes.forEach((node, index) => {
			const anchorCenterX = bandCenters.get(bandKey) ?? request.viewport.width / 2;
			const previous = request.previousPositions[node.id];
			const previousOffset = previous
				? previous.x + node.width / 2 - anchorCenterX
				: 0;
			const retryOffset = attempt === 0
				? 0
				: deterministicHorizontalOffset(node.id, attempt, horizontalFlex);
			const centerOffset = clamp(previousOffset + retryOffset, -horizontalFlex, horizontalFlex);
			nodes.push({
				id: node.id,
				x: anchorCenterX + centerOffset - node.width / 2,
				y: yCenters[index] - node.height / 2,
				width: node.width,
				height: node.height,
			});
		});
	}

	return nodes;
}

function groupNodesByBand(
	nodes: LayoutNodeInput[],
	layoutRanks: LayoutRanks,
): Map<number, LayoutNodeInput[]> {
	const bands = new Map<number, LayoutNodeInput[]>();
	for (const node of nodes) {
		const key = signedLayoutRank(node, layoutRanks);
		const band = bands.get(key) ?? [];
		band.push(node);
		bands.set(key, band);
	}
	return new Map([...bands.entries()].sort(([left], [right]) => left - right));
}

function signedLayoutRank(node: LayoutNodeInput, layoutRanks: LayoutRanks): number {
	const rank = layoutRanks.get(node.id) ?? Math.max(1, node.depth);
	if (node.role === 'caller') {
		return -rank;
	}
	if (node.role === 'callee') {
		return rank;
	}
	return 0;
}

/**
 * Semantic depth is the shortest path used to decide graph membership. Layout
 * rank may be deeper when visible same-side calls form a useful hierarchy.
 *
 * For callers A -> B means A belongs farther left than B. For callees A -> B
 * means B belongs farther right than A. Strongly connected nodes share one
 * rank so cycles cannot increase ranks indefinitely.
 */
function calculateLayoutRanks(request: LayoutRequest): LayoutRanks {
	const ranks: LayoutRanks = new Map(request.nodes.map(node => [
		node.id,
		node.role === 'focus' ? 0 : Math.max(1, node.depth),
	]));
	const nodesById = new Map(request.nodes.map(node => [node.id, node]));

	for (const role of ['caller', 'callee'] as const) {
		const roleNodes = request.nodes.filter(node => node.role === role);
		const roleNodeIds = new Set(roleNodes.map(node => node.id));
		const fartherToNearer = new Map<string, Set<string>>(
			roleNodes.map(node => [node.id, new Set<string>()]),
		);

		for (const edge of request.edges) {
			if (!roleNodeIds.has(edge.from) || !roleNodeIds.has(edge.to)) {
				continue;
			}
			const farther = role === 'caller' ? edge.from : edge.to;
			const nearer = role === 'caller' ? edge.to : edge.from;
			fartherToNearer.get(farther)?.add(nearer);
		}

		const components = stronglyConnectedComponents(roleNodes, fartherToNearer);
		const componentByNodeId = new Map<string, number>();
		components.forEach((component, index) => {
			component.forEach(nodeId => componentByNodeId.set(nodeId, index));
		});
		const nearerComponents = components.map(() => new Set<number>());
		const baseRanks = components.map(component => Math.max(
			...component.map(nodeId => Math.max(1, nodesById.get(nodeId)?.depth ?? 1)),
		));

		for (const [fartherId, nearerIds] of fartherToNearer) {
			const fartherComponent = componentByNodeId.get(fartherId);
			if (fartherComponent === undefined) {
				continue;
			}
			for (const nearerId of nearerIds) {
				const nearerComponent = componentByNodeId.get(nearerId);
				if (nearerComponent !== undefined && nearerComponent !== fartherComponent) {
					nearerComponents[fartherComponent].add(nearerComponent);
				}
			}
		}

		const componentRanks = new Map<number, number>();
		const rankComponent = (component: number): number => {
			const existing = componentRanks.get(component);
			if (existing !== undefined) {
				return existing;
			}
			const rank = Math.max(
				baseRanks[component],
				...Array.from(nearerComponents[component], nearer => rankComponent(nearer) + 1),
			);
			componentRanks.set(component, rank);
			return rank;
		};

		components.forEach((component, index) => {
			const rank = rankComponent(index);
			component.forEach(nodeId => ranks.set(nodeId, rank));
		});
	}

	return ranks;
}

function stronglyConnectedComponents(
	nodes: LayoutNodeInput[],
	edges: Map<string, Set<string>>,
): string[][] {
	let nextIndex = 0;
	const indices = new Map<string, number>();
	const lowLinks = new Map<string, number>();
	const stack: string[] = [];
	const onStack = new Set<string>();
	const components: string[][] = [];

	const visit = (nodeId: string): void => {
		indices.set(nodeId, nextIndex);
		lowLinks.set(nodeId, nextIndex);
		nextIndex += 1;
		stack.push(nodeId);
		onStack.add(nodeId);

		for (const targetId of edges.get(nodeId) ?? []) {
			if (!indices.has(targetId)) {
				visit(targetId);
				lowLinks.set(nodeId, Math.min(
					lowLinks.get(nodeId) ?? 0,
					lowLinks.get(targetId) ?? 0,
				));
			} else if (onStack.has(targetId)) {
				lowLinks.set(nodeId, Math.min(
					lowLinks.get(nodeId) ?? 0,
					indices.get(targetId) ?? 0,
				));
			}
		}

		if (lowLinks.get(nodeId) !== indices.get(nodeId)) {
			return;
		}
		const component: string[] = [];
		let currentId: string | undefined;
		do {
			currentId = stack.pop();
			if (currentId !== undefined) {
				onStack.delete(currentId);
				component.push(currentId);
			}
		} while (currentId !== nodeId);
		component.sort((left, right) => left.localeCompare(right));
		components.push(component);
	};

	[...nodes]
		.sort((left, right) => left.id.localeCompare(right.id))
		.forEach(node => {
			if (!indices.has(node.id)) {
				visit(node.id);
			}
		});
	return components;
}

function calculateBandCenters(
	request: LayoutRequest,
	bands: Map<number, LayoutNodeInput[]>,
	spacingScale: number,
): Map<number, number> {
	const centers = new Map<number, number>([[0, request.viewport.width / 2]]);
	const widths = new Map<number, number>();
	for (const [key, nodes] of bands) {
		widths.set(key, Math.max(...nodes.map(node => node.width)));
	}
	const focusWidth = widths.get(0) ?? 0;
	const bandGap = request.settings.bandGap * spacingScale;

	for (const direction of [-1, 1] as const) {
		const directionalKeys = [...bands.keys()]
			.filter(key => Math.sign(key) === direction)
			.sort((left, right) => Math.abs(left) - Math.abs(right));
		let previousKey = 0;
		let previousCenter = request.viewport.width / 2;
		let previousWidth = focusWidth;

		for (const key of directionalKeys) {
			const width = widths.get(key) ?? 0;
			const depthGap = Math.max(1, Math.abs(key) - Math.abs(previousKey));
			const center = previousCenter + direction * (
				previousWidth / 2
				+ bandGap * depthGap
				+ width / 2
			);
			centers.set(key, center);
			previousKey = key;
			previousCenter = center;
			previousWidth = width;
		}
	}

	return centers;
}

function orderBandNodes(
	nodes: LayoutNodeInput[],
	request: LayoutRequest,
	attempt: number,
): LayoutNodeInput[] {
	return [...nodes].sort((left, right) => {
		const leftPrevious = request.previousPositions[left.id];
		const rightPrevious = request.previousPositions[right.id];
		if (leftPrevious && rightPrevious && leftPrevious.y !== rightPrevious.y) {
			return leftPrevious.y - rightPrevious.y;
		}
		if (leftPrevious !== undefined || rightPrevious !== undefined) {
			return leftPrevious ? -1 : 1;
		}

		const leftRank = stableHash(left.id, attempt > 0 ? attempt % 3 : 0);
		const rightRank = stableHash(right.id, attempt > 0 ? attempt % 3 : 0);
		return leftRank - rightRank || left.id.localeCompare(right.id);
	});
}

function defaultVerticalCenter(
	index: number,
	nodes: LayoutNodeInput[],
	nodeGap: number,
	viewportHeight: number,
): number {
	const totalHeight = nodes.reduce((sum, node) => sum + node.height, 0)
		+ Math.max(0, nodes.length - 1) * nodeGap;
	let center = viewportHeight / 2 - totalHeight / 2;
	for (let current = 0; current <= index; current += 1) {
		center += nodes[current].height / 2;
		if (current < index) {
			center += nodes[current].height / 2 + nodeGap;
		}
	}
	return center;
}

/**
 * Finds the closest non-overlapping vertical sequence to the preferred
 * centers while preserving deterministic band order.
 */
function separateVerticalCenters(
	nodes: LayoutNodeInput[],
	preferredCenters: number[],
	nodeGap: number,
): number[] {
	const centers: number[] = [];
	for (let index = 0; index < nodes.length; index += 1) {
		const minimum = index === 0
			? Number.NEGATIVE_INFINITY
			: centers[index - 1] + nodes[index - 1].height / 2 + nodeGap + nodes[index].height / 2;
		centers.push(Math.max(preferredCenters[index], minimum));
	}

	// Shift the whole band toward its preferred vertical center. A uniform
	// shift preserves all separation established above.
	if (centers.length > 0) {
		const preferredAverage = average(preferredCenters);
		const actualAverage = average(centers);
		const shift = preferredAverage - actualAverage;
		return centers.map(center => center + shift);
	}
	return centers;
}

function repairObstructions(
	request: LayoutRequest,
	layoutRanks: LayoutRanks,
	nodes: LayoutNodeResult[],
	spacingScale: number,
	deadline: number,
	clock: LayoutClock,
): void {
	const nodeGap = request.settings.nodeGap * spacingScale;
	for (let round = 0; round < REPAIR_ROUNDS_PER_RETRY; round += 1) {
		if (clock.now() >= deadline) {
			return;
		}
		const obstructions = findObstructions(request, nodes);
		if (obstructions.length === 0) {
			return;
		}
		const nodesById = new Map(nodes.map(node => [node.id, node]));

		for (const obstruction of obstructions) {
			const obstacle = nodesById.get(obstruction.nodeId);
			const source = nodesById.get(obstruction.edge.from);
			const target = nodesById.get(obstruction.edge.to);
			if (!obstacle || !source || !target) {
				continue;
			}

			const obstacleCenter = rectangleCenter(obstacle);
			const lineY = yOnCenterLine(source, target, obstacleCenter.x);
			const clearance = obstacle.height / 2
				+ request.settings.obstaclePadding
				+ nodeGap / 2;
			const direction = obstacleCenter.y <= lineY ? -1 : 1;
			obstacle.y = lineY + direction * clearance - obstacle.height / 2;
		}

		compactNodeResultsByBand(request, layoutRanks, nodes, nodeGap);
	}
}

/**
 * Obstruction repair can move a node a long way while changing its order.
 * Repack each band around its current center after every round so retries grow
 * the plot deliberately through spacing settings rather than accidental drift.
 */
function compactNodeResultsByBand(
	request: LayoutRequest,
	layoutRanks: LayoutRanks,
	nodes: LayoutNodeResult[],
	nodeGap: number,
): void {
	const inputsById = new Map(request.nodes.map(node => [node.id, node]));
	const bands = new Map<number, LayoutNodeResult[]>();
	for (const node of nodes) {
		const input = inputsById.get(node.id);
		if (!input) {
			continue;
		}
		const key = signedLayoutRank(input, layoutRanks);
		const band = bands.get(key) ?? [];
		band.push(node);
		bands.set(key, band);
	}

	for (const band of bands.values()) {
		band.sort((left, right) => left.y - right.y || left.id.localeCompare(right.id));
		const originalCenter = average(band.map(node => node.y + node.height / 2));
		const totalHeight = band.reduce((sum, node) => sum + node.height, 0)
			+ Math.max(0, band.length - 1) * nodeGap;
		let nextY = originalCenter - totalHeight / 2;
		for (const node of band) {
			node.y = nextY;
			nextY += node.height + nodeGap;
		}
	}
}

function findObstructions(
	request: LayoutRequest,
	nodes: LayoutNodeResult[],
): Obstruction[] {
	const nodesById = new Map(nodes.map(node => [node.id, node]));
	const obstructions: Obstruction[] = [];

	for (const edge of request.edges) {
		if (edge.type !== 'normal') {
			continue;
		}
		const source = nodesById.get(edge.from);
		const target = nodesById.get(edge.to);
		if (!source || !target) {
			continue;
		}
		const segment = centerSegment(source, target);
		for (const node of nodes) {
			if (node.id === edge.from || node.id === edge.to) {
				continue;
			}
			if (segmentIntersectsRectangle(
				segment,
				expandRectangle(node, request.settings.obstaclePadding),
			)) {
				obstructions.push({ edge, nodeId: node.id });
			}
		}
	}

	return obstructions;
}

function centerSegment(source: Rectangle, target: Rectangle): { start: Point; end: Point } {
	return {
		start: rectangleCenter(source),
		end: rectangleCenter(target),
	};
}

function yOnCenterLine(source: Rectangle, target: Rectangle, x: number): number {
	const start = rectangleCenter(source);
	const end = rectangleCenter(target);
	if (Math.abs(end.x - start.x) < 1e-9) {
		return (start.y + end.y) / 2;
	}
	const ratio = (x - start.x) / (end.x - start.x);
	return start.y + (end.y - start.y) * ratio;
}

function createEdgeResults(
	request: LayoutRequest,
	nodes: LayoutNodeResult[],
): LayoutEdgeResult[] {
	const nodesById = new Map(nodes.map(node => [node.id, node]));
	return request.edges.flatMap(edge => {
		const source = nodesById.get(edge.from);
		const target = nodesById.get(edge.to);
		if (!source || !target) {
			return [];
		}
		const sourceCenter = rectangleCenter(source);
		const targetCenter = rectangleCenter(target);
		return [{
			id: edge.id,
			type: edge.type,
			start: rectangleBoundaryIntersection(source, targetCenter),
			end: rectangleBoundaryIntersection(target, sourceCenter),
		}];
	});
}

function previousPositionDisplacement(
	request: LayoutRequest,
	nodes: LayoutNodeResult[],
): number {
	return nodes.reduce((total, node) => {
		const previous = request.previousPositions[node.id];
		if (!previous) {
			return total;
		}
		return total + Math.abs(node.x - previous.x) + Math.abs(node.y - previous.y);
	}, 0);
}

function isBetterCandidate(candidate: LayoutCandidate, current: LayoutCandidate): boolean {
	return candidate.obstructionCount < current.obstructionCount
		|| candidate.obstructionCount === current.obstructionCount
			&& candidate.displacement < current.displacement;
}

function timeBudgetForNodeCount(nodeCount: number): number {
	const progress = clamp(nodeCount / LARGE_GRAPH_NODE_COUNT, 0, 1);
	return SMALL_GRAPH_TIME_BUDGET_MS
		+ (LARGE_GRAPH_TIME_BUDGET_MS - SMALL_GRAPH_TIME_BUDGET_MS) * progress;
}

function retryCountForNodeCount(nodeCount: number): number {
	return Math.min(MAX_RETRY_COUNT, Math.max(12, nodeCount * 2));
}

function deterministicHorizontalOffset(id: string, attempt: number, limit: number): number {
	const unit = (stableHash(id, attempt) % 2001) / 1000 - 1;
	return unit * limit;
}

function stableHash(value: string, seed: number): number {
	let hash = 2166136261 ^ seed;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function average(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
