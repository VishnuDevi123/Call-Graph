import type { FunctionNode, ParsedFile } from '../analyzer';
import type { GraphModel, GraphNode } from './types';

export function buildFocusedGraph(parsedFile: ParsedFile, focusNode: FunctionNode): GraphModel {
	const nodesById = new Map(parsedFile.nodes.map(node => [node.id, node]));
	const callerEdges = parsedFile.edges.filter(edge => edge.toId === focusNode.id);
	const calleeEdges = parsedFile.edges.filter(edge => edge.fromId === focusNode.id);
	const graphNodes = new Map<string, GraphNode>();

	for (const edge of callerEdges) {
		const caller = nodesById.get(edge.fromId);
		if (caller) {
			graphNodes.set(caller.id, toGraphNode(caller, 'caller'));
		}
	}

	graphNodes.set(focusNode.id, toGraphNode(focusNode, 'focus'));

	for (const edge of calleeEdges) {
		const callee = nodesById.get(edge.toId);
		if (callee) {
			graphNodes.set(callee.id, toGraphNode(callee, 'callee'));
		}
	}

	return {
		focusNodeId: focusNode.id,
		nodes: [...graphNodes.values()],
		edges: [...callerEdges, ...calleeEdges].map(edge => ({
			id: edge.id,
			from: edge.fromId,
			to: edge.toId,
			label: edge.callSites.length > 1 ? `${edge.reason} (${edge.callSites.length} calls)` : edge.reason,
		})),
		unresolvedCalls: parsedFile.unresolvedCalls
			.filter(call => call.callerId === focusNode.id)
			.map(call => `${call.expression} - ${call.reason}`),
		externalCalls: parsedFile.externalCalls
			.filter(call => call.callerId === focusNode.id)
			.map(call => call.expression),
	};
}

function toGraphNode(node: FunctionNode, role: GraphNode['role']): GraphNode {
	return {
		id: node.id,
		label: node.qualifiedName,
		filePath: node.identity.filePath,
		line: node.selectionRange.start.line,
		role,
	};
}
