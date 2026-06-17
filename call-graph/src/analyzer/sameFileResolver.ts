import type { CallSite, FunctionNode, GraphEdge, ParsedFile, UnresolvedCall } from './types';

const RESOLVABLE_KINDS = new Set<FunctionNode['kind']>([
	'function',
	'asyncFunction',
	'method',
	'asyncMethod',
	'nestedFunction',
	'asyncNestedFunction',
]);

export function resolveSameFileCalls(parsedFile: ParsedFile): ParsedFile {
	const nodesByName = groupResolvableNodesByName(parsedFile.nodes);
	const edgeGroups = new Map<string, GraphEdge>();
	const unresolvedCalls: UnresolvedCall[] = [];

	for (const callSite of parsedFile.callSites) {
		if (!isDirectCallExpression(callSite.expression)) {
			unresolvedCalls.push(toUnresolvedCall(callSite, 'Only direct same-file calls are resolved in this slice.'));
			continue;
		}

		const candidates = nodesByName.get(callSite.calleeName) ?? [];
		if (candidates.length !== 1) {
			unresolvedCalls.push(toUnresolvedCall(
				callSite,
				candidates.length === 0 ? 'No same-file function matches this call.' : 'Multiple same-file functions match this call.',
			));
			continue;
		}

		const target = candidates[0];
		const edgeId = `${callSite.callerId}->${target.id}:same-file-direct`;
		const existingEdge = edgeGroups.get(edgeId);
		if (existingEdge) {
			existingEdge.callSites.push(callSite);
			continue;
		}

		edgeGroups.set(edgeId, {
			id: edgeId,
			fromId: callSite.callerId,
			toId: target.id,
			callSites: [callSite],
			reason: 'same-file direct call',
		});
	}

	return {
		...parsedFile,
		edges: [...edgeGroups.values()],
		unresolvedCalls,
	};
}

function groupResolvableNodesByName(nodes: FunctionNode[]): Map<string, FunctionNode[]> {
	const nodesByName = new Map<string, FunctionNode[]>();
	for (const node of nodes) {
		if (!RESOLVABLE_KINDS.has(node.kind)) {
			continue;
		}

		const existingNodes = nodesByName.get(node.name) ?? [];
		existingNodes.push(node);
		nodesByName.set(node.name, existingNodes);
	}
	return nodesByName;
}

function isDirectCallExpression(expression: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(expression);
}

function toUnresolvedCall(callSite: CallSite, reason: string): UnresolvedCall {
	return {
		id: `${callSite.id}:unresolved`,
		callerId: callSite.callerId,
		expression: callSite.expression,
		range: callSite.range,
		reason,
	};
}
