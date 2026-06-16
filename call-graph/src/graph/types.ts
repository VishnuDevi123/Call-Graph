export interface GraphNode {
	id: string;
	label: string;
	filePath: string;
	line: number;
	role: 'caller' | 'focus' | 'callee';
}

export interface GraphEdge {
	id: string;
	from: string;
	to: string;
	label: string;
}

export interface GraphModel {
	focusNodeId: string;
	nodes: GraphNode[];
	edges: GraphEdge[];
	unresolvedCalls: string[];
	externalCalls: string[];
}
