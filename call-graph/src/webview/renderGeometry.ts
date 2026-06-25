/**
 * Converts worker coordinates into positive browser-scene coordinates.
 *
 * Layout may extend left or above the viewport origin. Rendering applies one
 * uniform translation so HTML nodes and SVG endpoints share an exact space.
 */
import type {
	LayoutEdgeResult,
	LayoutNodeResult,
	LayoutSuccessResult,
} from './layout/workerProtocol';

export interface RenderSceneGeometry {
	width: number;
	height: number;
	nodes: LayoutNodeResult[];
	edges: LayoutEdgeResult[];
}

// Reciprocal curves bow by 54px, so 64px keeps their control area inside the
// scene even when an endpoint node is itself an outermost node.
const SCENE_PADDING = 64;

export function emptyRenderScene(): RenderSceneGeometry {
	return {
		width: 1,
		height: 1,
		nodes: [],
		edges: [],
	};
}

export function createRenderScene(
	result: LayoutSuccessResult,
	padding = SCENE_PADDING,
): RenderSceneGeometry {
	if (result.nodes.length === 0) {
		return emptyRenderScene();
	}

	const offsetX = padding - result.contentBounds.left;
	const offsetY = padding - result.contentBounds.top;
	return {
		width: Math.max(1, result.contentBounds.width + padding * 2),
		height: Math.max(1, result.contentBounds.height + padding * 2),
		nodes: result.nodes.map(node => ({
			...node,
			x: node.x + offsetX,
			y: node.y + offsetY,
		})),
		edges: result.edges.map(edge => ({
			...edge,
			start: {
				x: edge.start.x + offsetX,
				y: edge.start.y + offsetY,
			},
			end: {
				x: edge.end.x + offsetX,
				y: edge.end.y + offsetY,
			},
		})),
	};
}
