import type { FunctionNode, GraphEdge as AnalyzerGraphEdge, ParsedFile } from '../analyzer';
import type { GraphDepth, GraphEdge, GraphExpansionDirection, GraphModel, GraphNode } from './types';

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_NODE_LIMIT = 40;

interface BuildFocusedGraphOptions {
	callerDepth?: GraphDepth;
	calleeDepth?: GraphDepth;
	maxDepth?: number;
	nodeLimit?: number;
	includeTests?: boolean;
}

interface QueuedExpansion {
	nodeId: string;
	direction: GraphExpansionDirection;
	depth: number;
	seenPath: Set<string>;
}

interface TrackedNode {
	node: FunctionNode;
	role: GraphNode['role'];
	depth: number;
	isFileContext?: boolean;
}

export function buildFocusedGraph(parsedFiles: ParsedFile[], focusNode: FunctionNode, options: BuildFocusedGraphOptions = {}): GraphModel {
	const includeTests = options.includeTests ?? true;
	const allNodes = parsedFiles
		.flatMap(file => file.nodes)
		.filter(node => includeTests || node.id === focusNode.id || !isTestFile(node.identity.filePath));
	const visibleNodeIds = new Set(allNodes.map(node => node.id));
	const allEdges = parsedFiles
		.flatMap(file => file.edges)
		.filter(edge => visibleNodeIds.has(edge.fromId) && visibleNodeIds.has(edge.toId));
	const focusFile = parsedFiles.find(file => file.filePath === focusNode.identity.filePath);
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
	const queue: QueuedExpansion[] = [];
	let limitReached = false;

	addNode(focusNode, 'focus', 0);

	const directIncomingEdges = incomingEdges.get(focusNode.id) ?? [];
	for (const edge of directIncomingEdges) {
		if (!addEdgeAndNode(edge, edge.fromId, 'caller', 1)) {
			continue;
		}
		queue.push({ nodeId: edge.fromId, direction: 'callers', depth: 1, seenPath: new Set([focusNode.id, edge.fromId]) });
	}

	if (focusNode.kind !== 'module' && directIncomingEdges.length === 0) {
		const moduleNode = focusFile?.nodes.find(node => node.kind === 'module');
		if (moduleNode && moduleNode.id !== focusNode.id) {
			if (graphNodes.size < nodeLimit) {
				addNode(moduleNode, 'caller', 1, true);
			} else {
				limitReached = true;
			}
		}
	}

	for (const edge of outgoingEdges.get(focusNode.id) ?? []) {
		if (!addEdgeAndNode(edge, edge.toId, 'callee', 1)) {
			continue;
		}
		queue.push({ nodeId: edge.toId, direction: 'callees', depth: 1, seenPath: new Set([focusNode.id, edge.toId]) });
	}

	while (queue.length > 0) {
		const next = queue.shift();
		if (!next || next.depth >= directionDepths[next.direction]) {
			continue;
		}

		const candidateEdges = next.direction === 'callers'
			? incomingEdges.get(next.nodeId) ?? []
			: outgoingEdges.get(next.nodeId) ?? [];

		for (const edge of candidateEdges) {
			const neighborId = next.direction === 'callers' ? edge.fromId : edge.toId;
			const role: GraphNode['role'] = next.direction === 'callers' ? 'caller' : 'callee';
			const neighborDepth = next.depth + 1;

			if (!addEdgeAndNode(edge, neighborId, role, neighborDepth)) {
				continue;
			}

			if (next.seenPath.has(neighborId)) {
				continue;
			}

			const seenPath = new Set(next.seenPath);
			seenPath.add(neighborId);
			queue.push({ nodeId: neighborId, direction: next.direction, depth: neighborDepth, seenPath });
		}
	}

	return {
		focusNodeId: focusNode.id,
		includeTests,
		nodes: [...graphNodes.values()]
			.map(tracked => toGraphNode(tracked.node, tracked.role, tracked.depth, tracked.isFileContext))
			.sort(compareGraphNodes),
		edges: [...graphEdges.values()],
		unresolvedCalls: (focusFile?.unresolvedCalls ?? [])
			.filter(call => call.callerId === focusNode.id)
			.map(call => `${call.expression} - ${call.reason}`),
		externalCalls: (focusFile?.externalCalls ?? [])
			.filter(call => call.callerId === focusNode.id)
			.map(call => call.expression),
		limitReached,
		callerDepth,
		calleeDepth,
		maxDepth,
		nodeLimit,
	};

	function addEdgeAndNode(edge: AnalyzerGraphEdge, nodeId: string, role: GraphNode['role'], depth: number): boolean {
		const node = nodesById.get(nodeId);
		if (!node) {
			return false;
		}

		if (!graphNodes.has(node.id) && graphNodes.size >= nodeLimit) {
			limitReached = true;
			return false;
		}

		addNode(node, role, depth);
		graphEdges.set(edge.id, toGraphEdge(edge));
		return true;
	}

	function addNode(node: FunctionNode, role: GraphNode['role'], depth: number, isFileContext = false): void {
		const existing = graphNodes.get(node.id);
		if (!existing) {
			graphNodes.set(node.id, { node, role, depth, isFileContext });
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

function isTestFile(filePath: string): boolean {
	const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
	const segments = normalizedPath.split('/');
	const fileName = segments.at(-1) ?? '';
	return segments.slice(0, -1).some(segment => segment === 'test' || segment === 'tests')
		|| fileName.startsWith('test_')
		|| fileName.endsWith('_test.py');
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

function toGraphNode(
	node: FunctionNode,
	role: GraphNode['role'],
	depth: number,
	isFileContext?: boolean,
): GraphNode {
	return {
		id: node.id,
		label: node.qualifiedName,
		filePath: node.identity.filePath,
		line: node.selectionRange.start.line,
		role,
		depth,
		...(isFileContext ? { isFileContext: true } : {}),
	};
}

function toGraphEdge(edge: AnalyzerGraphEdge): GraphEdge {
	return {
		id: edge.id,
		from: edge.fromId,
		to: edge.toId,
		label: edge.callSites.length > 1 ? `${edge.reason} (${edge.callSites.length} calls)` : edge.reason,
	};
}

function compareGraphNodes(left: GraphNode, right: GraphNode): number {
	const roleOrder: Record<GraphNode['role'], number> = {
		caller: 0,
		focus: 1,
		callee: 2,
	};
	return roleOrder[left.role] - roleOrder[right.role]
		|| left.depth - right.depth
		|| left.label.localeCompare(right.label);
}
