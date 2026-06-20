import type { SourceRange } from '../analyzer';

export type GraphExpansionDirection = 'callers' | 'callees';
export type GraphDepth = 1 | 2 | 3 | 4 | 5 | 'max';

export interface GraphNode {
	id: string;
	label: string;
	filePath: string;
	line: number;
	role: 'caller' | 'focus' | 'callee';
	depth: number;
}

export interface GraphEdgeCallSite {
	id: string;
	expression: string;
	filePath: string;
	range: SourceRange;
}

export interface GraphEdge {
	id: string;
	from: string;
	to: string;
	label: string;
	callCount: number;
	callSites: GraphEdgeCallSite[];
}

export interface GraphModel {
	focusNodeId: string;
	includeTests: boolean;
	nodes: GraphNode[];
	edges: GraphEdge[];
	limitReached: boolean;
	omittedDirectRelationshipCount: number;
	largeGraphWarning: boolean;
	callerDepth: GraphDepth;
	calleeDepth: GraphDepth;
	maxDepth: number;
	nodeLimit: number;
}
