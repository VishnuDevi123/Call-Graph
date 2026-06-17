import type { GraphModel } from './types';

export const emptyGraph: GraphModel = {
	focusNodeId: '',
	nodes: [],
	edges: [],
	unresolvedCalls: [],
	externalCalls: [],
};
