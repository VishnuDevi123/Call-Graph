import type { GraphModel } from './types';

export const emptyGraph: GraphModel = {
	focusNodeId: '',
	includeTests: true,
	nodes: [],
	edges: [],
	limitReached: false,
	omittedDirectRelationshipCount: 0,
	largeGraphWarning: false,
	callerDepth: 1,
	calleeDepth: 1,
	maxDepth: 8,
	nodeLimit: 30,
};
