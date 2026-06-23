import type { FunctionNode, GraphEdge as AnalyzerGraphEdge, ParsedFile } from '../analyzer';
import type { GraphDepth, GraphEdge, GraphExpansionDirection, GraphModel, GraphNode } from './types';

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_NODE_LIMIT = 30;
const LARGE_GRAPH_WARNING_THRESHOLD = 100;

interface BuildFocusedGraphOptions {
	callerDepth?: GraphDepth;
	calleeDepth?: GraphDepth;
	maxDepth?: number;
	nodeLimit?: number;
}

interface ExpansionCandidate {
	edge: AnalyzerGraphEdge;
	nodeId: string;
	direction: GraphExpansionDirection;
	depth: number;
	seenPath: Set<string>;
}

interface TrackedNode {
	node: FunctionNode;
	role: GraphNode['role'];
	depth: number;
}

export function buildFocusedGraph(parsedFiles: ParsedFile[], focusNode: FunctionNode, options: BuildFocusedGraphOptions = {}): GraphModel {
	// Test files are part of the workspace graph in V1. Filtering remains outside
	// the graph-session contract until a future product slice reintroduces it.
	const allNodes = parsedFiles.flatMap(file => file.nodes);
	const visibleNodeIds = new Set(allNodes.map(node => node.id));
	const allEdges = parsedFiles
		.flatMap(file => file.edges)
		.filter(edge => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId));
	const nodesById = new Map(allNodes.map(node => [node.id, node]));
	const incomingEdges = groupEdges(allEdges, 'toId');
	const outgoingEdges = groupEdges(allEdges, 'fromId');
	const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
	const callerDepth = options.callerDepth ?? 1;
	const calleeDepth = options.calleeDepth ?? 1;
	const directionDepths: Record<GraphExpansionDirection, number> = {
		callers: resolveDepth(callerDepth, maxDepth),
		callees: resolveDepth(calleeDepth, maxDepth),
	};
	const nodeLimit = options.nodeLimit ?? DEFAULT_NODE_LIMIT;
	const graphNodes = new Map<string, TrackedNode>();
	const graphEdges = new Map<string, GraphEdge>();
	const queue: ExpansionCandidate[] = [];
	let limitReached = false;
	let omittedDirectRelationshipCount = 0;

	addNode(focusNode, 'focus', 0);
	queue.push(
		...createCandidates(incomingEdges.get(focusNode.id) ?? [], 'callers', 1, focusNode.id),
		...createCandidates(outgoingEdges.get(focusNode.id) ?? [], 'callees', 1, focusNode.id),
	);

	while (queue.length > 0) {
		queue.sort(compareCandidates);
		const next = queue.shift();
		if (!next || next.depth > directionDepths[next.direction]) {
			continue;
		}

		const role: GraphNode['role'] = next.direction === 'callers' ? 'caller' : 'callee';
		const node = nodesById.get(next.nodeId);
		if (!node) {
			continue;
		}

		if (!graphNodes.has(node.id) && graphNodes.size >= nodeLimit) {
			limitReached = true;
			if (next.depth === 1) {
				omittedDirectRelationshipCount += 1;
			}
			continue;
		}

		addNode(node, role, next.depth);
		graphEdges.set(next.edge.id, toGraphEdge(next.edge, nodesById));

		if (next.depth >= directionDepths[next.direction] || next.seenPath.has(next.nodeId)) {
			continue;
		}

		const candidateEdges = next.direction === 'callers'
			? incomingEdges.get(next.nodeId) ?? []
			: outgoingEdges.get(next.nodeId) ?? [];
		const seenPath = new Set(next.seenPath);
		seenPath.add(next.nodeId);
		queue.push(...createCandidates(candidateEdges, next.direction, next.depth + 1, next.nodeId, seenPath));
	}

	return {
		focusNodeId: focusNode.id,
		nodes: [...graphNodes.values()]
			.map(tracked => toGraphNode(tracked.node, tracked.role, tracked.depth))
			.sort(compareGraphNodes),
		edges: classifyReciprocalEdges([...graphEdges.values()])
			.sort((left, right) => left.id.localeCompare(right.id)),
		limitReached,
		omittedDirectRelationshipCount,
		largeGraphWarning: nodeLimit > LARGE_GRAPH_WARNING_THRESHOLD,
		callerDepth,
		calleeDepth,
		maxDepth,
		nodeLimit,
	};

	function addNode(node: FunctionNode, role: GraphNode['role'], depth: number): void {
		const existing = graphNodes.get(node.id);
		if (!existing) {
			graphNodes.set(node.id, { node, role, depth });
			return;
		}

		if (depth < existing.depth) {
			existing.depth = depth;
			if (existing.role !== 'focus') {
				existing.role = role;
			}
		}
	}
}

function createCandidates(
	edges: AnalyzerGraphEdge[],
	direction: GraphExpansionDirection,
	depth: number,
	sourceNodeId: string,
	seenPath = new Set([sourceNodeId]),
): ExpansionCandidate[] {
	return edges.map(edge => ({
		edge,
		nodeId: direction === 'callers' ? edge.fromId : edge.toId,
		direction,
		depth,
		seenPath,
	}));
}

function compareCandidates(left: ExpansionCandidate, right: ExpansionCandidate): number {
	return left.depth - right.depth
		|| left.nodeId.localeCompare(right.nodeId)
		|| directionOrder(left.direction) - directionOrder(right.direction)
		|| left.edge.id.localeCompare(right.edge.id);
}

function directionOrder(direction: GraphExpansionDirection): number {
	return direction === 'callers' ? 0 : 1;
}

function groupEdges(edges: AnalyzerGraphEdge[], key: 'fromId' | 'toId'): Map<string, AnalyzerGraphEdge[]> {
	const grouped = new Map<string, AnalyzerGraphEdge[]>();
	for (const edge of edges) {
		const existing = grouped.get(edge[key]) ?? [];
		existing.push(edge);
		grouped.set(edge[key], existing);
	}
	return grouped;
}

function resolveDepth(depth: GraphDepth, maxDepth: number): number {
	return depth === 'max' ? maxDepth : Math.min(depth, maxDepth);
}

function toGraphNode(node: FunctionNode, role: GraphNode['role'], depth: number): GraphNode {
	return {
		id: node.id,
		label: node.qualifiedName,
		filePath: node.identity.filePath,
		line: node.selectionRange.start.line,
		role,
		depth,
	};
}

function toGraphEdge(edge: AnalyzerGraphEdge, nodesById: Map<string, FunctionNode>): GraphEdge {
	const sourceFilePath = nodesById.get(edge.fromId)?.identity.filePath ?? '';
	return {
		id: edge.id,
		from: edge.fromId,
		to: edge.toId,
		type: 'normal',
		label: edge.reason,
		callCount: edge.callSites.length,
		callSites: edge.callSites.map(callSite => ({
			id: callSite.id,
			expression: callSite.expression,
			filePath: sourceFilePath,
			range: callSite.range,
		})),
	};
}

/**
 * Marks both directions of a rendered A↔B relationship for reciprocal routing.
 * Self-recursive edges stay normal because they do not form a two-node pair.
 */
function classifyReciprocalEdges(edges: GraphEdge[]): GraphEdge[] {
	const directedPairs = new Set(edges.map(edge => `${edge.from}\u0000${edge.to}`));
	return edges.map(edge => ({
		...edge,
		type: edge.from !== edge.to && directedPairs.has(`${edge.to}\u0000${edge.from}`)
			? 'reciprocal'
			: 'normal',
	}));
}

function compareGraphNodes(left: GraphNode, right: GraphNode): number {
	const roleOrder: Record<GraphNode['role'], number> = {
		caller: 0,
		focus: 1,
		callee: 2,
	};
	return roleOrder[left.role] - roleOrder[right.role]
		|| left.depth - right.depth
		|| left.label.localeCompare(right.label)
		|| left.id.localeCompare(right.id);
}
