import type { GraphModel } from './types';

export const emptyGraph: GraphModel = {
	focusNodeId: '',
	includeTests: true,
	nodes: [],
	edges: [],
	unresolvedCalls: [],
	externalCalls: [],
	limitReached: false,
	callerDepth: 1,
	calleeDepth: 1,
	maxDepth: 8,
	nodeLimit: 40,
};
