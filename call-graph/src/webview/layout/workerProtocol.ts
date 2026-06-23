import type { GraphDepth, GraphEdge, GraphNode } from '../../graph/types';
import type { Point, Rectangle, SceneBounds } from './geometry';

export interface LayoutNodeInput {
	id: string;
	role: GraphNode['role'];
	depth: number;
	width: number;
	height: number;
}

export interface LayoutEdgeInput {
	id: string;
	from: string;
	to: string;
	type: GraphEdge['type'];
}

export interface LayoutViewport {
	width: number;
	height: number;
}

export interface LayoutSettings {
	nodeGap: number;
	bandGap: number;
	obstaclePadding: number;
}

export interface LayoutRequest {
	type: 'layoutRequest';
	requestId: number;
	focusNodeId: string;
	nodes: LayoutNodeInput[];
	edges: LayoutEdgeInput[];
	viewport: LayoutViewport;
	depths: {
		callers: GraphDepth;
		callees: GraphDepth;
	};
	previousPositions: Record<string, Point>;
	settings: LayoutSettings;
}

export interface LayoutNodeResult extends Rectangle {
	id: string;
}

export interface LayoutEdgeResult {
	id: string;
	type: GraphEdge['type'];
	start: Point;
	end: Point;
}

export interface LayoutSuccessResult {
	type: 'layoutResult';
	requestId: number;
	nodes: LayoutNodeResult[];
	edges: LayoutEdgeResult[];
	contentBounds: SceneBounds;
	hasObstructedEdges: boolean;
}

export interface LayoutFailureResult {
	type: 'layoutError';
	requestId: number;
	message: string;
}

export type LayoutWorkerResult = LayoutSuccessResult | LayoutFailureResult;
