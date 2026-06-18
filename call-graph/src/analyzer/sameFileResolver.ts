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
		if (callSite.receiver) {
			const target = findReceiverTarget(parsedFile.nodes, callSite.receiver.className, callSite.calleeName);
			if (!target) {
				unresolvedCalls.push(toUnresolvedCall(
					callSite,
					`No same-file method matches inferred receiver type ${callSite.receiver.className}.`,
				));
				continue;
			}

			addEdge(edgeGroups, callSite, target, receiverResolutionReason(callSite));
			continue;
		}

		if (!isDirectCallExpression(callSite.expression)) {
			unresolvedCalls.push(toUnresolvedCall(callSite, 'Receiver type is dynamic, ambiguous, or unsupported.'));
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

		addEdge(edgeGroups, callSite, candidates[0], 'same-file direct call');
	}

	return {
		...parsedFile,
		edges: [...edgeGroups.values()],
		unresolvedCalls,
	};
}

function findReceiverTarget(nodes: FunctionNode[], className: string, methodName: string): FunctionNode | undefined {
	const qualifiedName = `${className}.${methodName}`;
	const candidates = nodes.filter(node =>
		(node.kind === 'method' || node.kind === 'asyncMethod')
		&& node.qualifiedName === qualifiedName,
	);
	return candidates.length === 1 ? candidates[0] : undefined;
}

function receiverResolutionReason(callSite: CallSite): string {
	switch (callSite.receiver?.kind) {
		case 'self':
			return `same-class self call (${callSite.receiver.className})`;
		case 'cls':
			return `same-class cls call (${callSite.receiver.className})`;
		case 'localConstruction':
			return `local construction inferred as ${callSite.receiver.className}`;
		case 'localAnnotation':
			return `local annotation inferred as ${callSite.receiver.className}`;
		default:
			return 'same-file receiver call';
	}
}

function addEdge(edgeGroups: Map<string, GraphEdge>, callSite: CallSite, target: FunctionNode, reason: string): void {
	const edgeId = `${callSite.callerId}->${target.id}:${reason}`;
	const existingEdge = edgeGroups.get(edgeId);
	if (existingEdge) {
		existingEdge.callSites.push(callSite);
		return;
	}

	edgeGroups.set(edgeId, {
		id: edgeId,
		fromId: callSite.callerId,
		toId: target.id,
		callSites: [callSite],
		reason,
	});
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
