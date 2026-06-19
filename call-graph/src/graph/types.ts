export type GraphExpansionDirection = 'callers' | 'callees';
export type GraphDepth = 1 | 2 | 3 | 4 | 5 | 'max';

export interface GraphNode {
	id: string;
	label: string;
	filePath: string;
	line: number;
	role: 'caller' | 'focus' | 'callee';
	depth: number;
	isFileContext?: boolean;
}

export interface GraphEdge {
	id: string;
	from: string;
	to: string;
	label: string;
}

export interface GraphModel {
	focusNodeId: string;
	includeTests: boolean;
	nodes: GraphNode[];
	edges: GraphEdge[];
	unresolvedCalls: string[];
	externalCalls: string[];
	limitReached: boolean;
	callerDepth: GraphDepth;
	calleeDepth: GraphDepth;
	maxDepth: number;
	nodeLimit: number;
}
