/**
 * Deterministic soft-band layout for the focused call graph.
 *
 * This module orchestrates retry timing, horizontal band placement, edge
 * endpoint creation, and candidate scoring. Rank calculation, row preferences,
 * and obstruction repair live in focused helper modules.
 */
import {
	rectangleBoundaryIntersection,
	rectangleCenter,
	sceneBounds,
} from './geometry';
import {
	findObstructions,
	findRenderedObstructions,
	repairObstructions,
} from './layoutObstructions';
import { calculateLayoutRanks, signedLayoutRank, type LayoutRanks } from './layoutRanks';
import {
	calculateAdjacentAnchors,
	defaultVerticalCenter,
	orderBandNodes,
	relationshipPreferredCenter,
	separateVerticalCenters,
	softenedPreviousCenter,
	type CenterByNodeId,
} from './layoutRows';
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

interface LayoutClock {
	now(): number;
}

const SMALL_GRAPH_TIME_BUDGET_MS = 150;
const LARGE_GRAPH_TIME_BUDGET_MS = 750;
const LARGE_GRAPH_NODE_COUNT = 100;
const MAX_RETRY_COUNT = 160;
const SPACING_GROWTH_PER_RETRY = 0.04;
const MAX_SPACING_SCALE = 2.5;

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
		hasObstructedEdges: findRenderedObstructions(request, selected.nodes).length > 0,
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
	const adjacentAnchors = calculateAdjacentAnchors(request, layoutRanks);
	const nodeGap = request.settings.nodeGap * spacingScale;
	const horizontalFlex = Math.min(
		request.settings.bandGap * 0.18,
		48,
	) * Math.min(spacingScale, 1.75);
	const nodes: LayoutNodeResult[] = [];
	const placedCenters: CenterByNodeId = new Map();

	for (const bandKey of bandPlacementOrder(bands)) {
		const bandNodes = bands.get(bandKey);
		if (!bandNodes) {
			continue;
		}
		const orderedNodes = orderBandNodes(
			bandNodes,
			request,
			attempt,
			placedCenters,
			adjacentAnchors,
		);
		const preferredCenters = orderedNodes.map((node, index) => {
			const defaultCenter = defaultVerticalCenter(index, orderedNodes, nodeGap, request.viewport.height);
			const relationshipCenter = relationshipPreferredCenter(
				node.id,
				defaultCenter,
				placedCenters,
				adjacentAnchors,
			);
			const previous = request.previousPositions[node.id];
			return previous
				? softenedPreviousCenter(relationshipCenter, previous.y + node.height / 2)
				: relationshipCenter;
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
			const placedNode = {
				id: node.id,
				x: anchorCenterX + centerOffset - node.width / 2,
				y: yCenters[index] - node.height / 2,
				width: node.width,
				height: node.height,
			};
			nodes.push(placedNode);
			placedCenters.set(node.id, rectangleCenter(placedNode));
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

function bandPlacementOrder(bands: Map<number, LayoutNodeInput[]>): number[] {
	return [...bands.keys()].sort((left, right) => {
		const absolute = Math.abs(left) - Math.abs(right);
		return absolute || left - right;
	});
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

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
