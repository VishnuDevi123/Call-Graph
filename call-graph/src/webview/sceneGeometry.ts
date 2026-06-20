// this file

import type { GraphEdge, GraphModel, GraphNode } from '../graph/types';

// constants defining the layout and sizing of the call graph scene
const SCENE_PADDING_X = 40;
const SCENE_PADDING_TOP = 30;
const NODE_START_Y = SCENE_PADDING_TOP + 16;
const NODE_SLOT_HEIGHT = 150;
const SIDE_NODE_WIDTH = 240;
const SIDE_NODE_HEIGHT = 86;
const FOCUS_NODE_WIDTH = 280;
const FOCUS_NODE_HEIGHT = 112;
const COLUMN_GAP = 112;
const COLUMN_STEP = SIDE_NODE_WIDTH + COLUMN_GAP;

export interface ScenePoint {
	x: number;
	y: number;
}

export interface SceneNodeGeometry {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	level: number;
}

export interface SceneGroupGeometry {
	role: GraphNode['role'];
	label: string;
	x: number;
	y: number;
	width: number;
}

export interface SceneEdgeGeometry {
	id: string;
	path: string;
	start: ScenePoint;
	end: ScenePoint;
	label: ScenePoint;
}

export interface GraphSceneGeometry {
	width: number;
	height: number;
	nodes: SceneNodeGeometry[];
	groups: SceneGroupGeometry[];
	edges: SceneEdgeGeometry[];
}

export function createSceneGeometry(graph: GraphModel): GraphSceneGeometry {
	const nodesByColumn = groupNodesByLevel(graph.nodes);
	const callerDepth = deepestLevel(nodesByColumn, 'caller');
	const calleeDepth = deepestLevel(nodesByColumn, 'callee');
	const visibleCallerColumns = Math.max(1, callerDepth);
	const visibleCalleeColumns = Math.max(1, calleeDepth);
	const focusX = SCENE_PADDING_X + visibleCallerColumns * COLUMN_STEP;
	const largestColumnSize = Math.max(1, ...[...nodesByColumn.values()].map(nodes => nodes.length));
	const graphHeight = largestColumnSize * NODE_SLOT_HEIGHT;
	const nodes = [...nodesByColumn.entries()]
		.sort(([left], [right]) => left - right)
		.flatMap(([level, columnNodes]) => positionColumn(columnNodes, level, focusX, graphHeight));
	const nodeGeometryById = new Map(nodes.map(node => [node.id, node]));
	const width = focusX + FOCUS_NODE_WIDTH + visibleCalleeColumns * COLUMN_STEP + SCENE_PADDING_X;

	return {
		width,
		height: NODE_START_Y + graphHeight + SCENE_PADDING_TOP,
		nodes,
		groups: [
			{
				role: 'caller',
				label: 'Callers',
				x: SCENE_PADDING_X,
				y: SCENE_PADDING_TOP,
				width: visibleCallerColumns * COLUMN_STEP - COLUMN_GAP,
			},
			{ role: 'focus', label: 'Focused Function', x: focusX, y: SCENE_PADDING_TOP, width: FOCUS_NODE_WIDTH },
			{
				role: 'callee',
				label: 'Callees',
				x: focusX + FOCUS_NODE_WIDTH + COLUMN_GAP,
				y: SCENE_PADDING_TOP,
				width: visibleCalleeColumns * COLUMN_STEP - COLUMN_GAP,
			},
		],
		edges: [...graph.edges]
			.sort((left, right) => left.id.localeCompare(right.id))
			.flatMap(edge => edgeGeometry(edge, nodeGeometryById)),
	};
}

function groupNodesByLevel(nodes: GraphNode[]): Map<number, GraphNode[]> {
	const grouped = new Map<number, GraphNode[]>();
	for (const node of nodes) {
		const level = nodeLevel(node);
		const column = grouped.get(level) ?? [];
		column.push(node);
		grouped.set(level, column);
	}
	for (const column of grouped.values()) {
		column.sort((left, right) =>
			left.label.localeCompare(right.label)
			|| left.id.localeCompare(right.id),
		);
	}
	return grouped;
}

function deepestLevel(nodesByColumn: Map<number, GraphNode[]>, role: 'caller' | 'callee'): number {
	const levels = [...nodesByColumn.keys()]
		.filter(level => role === 'caller' ? level < 0 : level > 0)
		.map(Math.abs);
	return Math.max(0, ...levels);
}

function nodeLevel(node: GraphNode): number {
	if (node.role === 'caller') {
		return -node.depth;
	}
	if (node.role === 'callee') {
		return node.depth;
	}
	return 0;
}

function positionColumn(
	nodes: GraphNode[],
	level: number,
	focusX: number,
	graphHeight: number,
): SceneNodeGeometry[] {
	const totalHeight = nodes.length * NODE_SLOT_HEIGHT;
	const startY = NODE_START_Y + (graphHeight - totalHeight) / 2;

	return nodes.map((node, index) => {
		const width = node.role === 'focus' ? FOCUS_NODE_WIDTH : SIDE_NODE_WIDTH;
		const height = node.role === 'focus' ? FOCUS_NODE_HEIGHT : SIDE_NODE_HEIGHT;
		const slotY = startY + index * NODE_SLOT_HEIGHT;
		return {
			id: node.id,
			x: columnX(level, focusX),
			y: slotY + (NODE_SLOT_HEIGHT - height) / 2,
			width,
			height,
			level,
		};
	});
}

function columnX(level: number, focusX: number): number {
	if (level < 0) {
		return focusX + level * COLUMN_STEP;
	}
	if (level > 0) {
		return focusX + FOCUS_NODE_WIDTH + COLUMN_GAP + (level - 1) * COLUMN_STEP;
	}
	return focusX;
}

function edgeGeometry(
	edge: GraphEdge,
	nodesById: Map<string, SceneNodeGeometry>,
): SceneEdgeGeometry[] {
	const from = nodesById.get(edge.from);
	const to = nodesById.get(edge.to);
	if (!from || !to) {
		return [];
	}

	const travelsRight = centerX(to) >= centerX(from);
	const start = {
		x: travelsRight ? from.x + from.width : from.x,
		y: from.y + from.height / 2,
	};
	const end = {
		x: travelsRight ? to.x : to.x + to.width,
		y: to.y + to.height / 2,
	};
	const distance = Math.abs(end.x - start.x);
	const curve = Math.max(40, distance * 0.45);
	const firstControlX = start.x + (travelsRight ? curve : -curve);
	const secondControlX = end.x + (travelsRight ? -curve : curve);

	return [{
		id: edge.id,
		path: `M ${start.x} ${start.y} C ${firstControlX} ${start.y}, ${secondControlX} ${end.y}, ${end.x} ${end.y}`,
		start,
		end,
		label: {
			x: (start.x + end.x) / 2,
			y: (start.y + end.y) / 2 - 8,
		},
	}];
}

function centerX(node: SceneNodeGeometry): number {
	return node.x + node.width / 2;
}
