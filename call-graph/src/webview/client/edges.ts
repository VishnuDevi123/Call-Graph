import type { LayoutEdgeResult } from '../layout/workerProtocol';
import type { RenderSceneGeometry } from '../renderGeometry';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const RECIPROCAL_CURVE_OFFSET = 54;

export function createEdgeOverlay(document: Document): SVGSVGElement {
	const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
	svg.classList.add('edge-overlay');
	svg.setAttribute('aria-hidden', 'true');
	const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
	const marker = document.createElementNS(SVG_NAMESPACE, 'marker');
	marker.setAttribute('id', 'arrowhead');
	marker.setAttribute('viewBox', '0 0 10 10');
	// The marker tip and path endpoint share the same coordinate, preventing a
	// visible gap at any edge angle.
	marker.setAttribute('refX', '10');
	marker.setAttribute('refY', '5');
	marker.setAttribute('markerWidth', '10');
	marker.setAttribute('markerHeight', '10');
	marker.setAttribute('markerUnits', 'userSpaceOnUse');
	marker.setAttribute('orient', 'auto');
	const markerPath = document.createElementNS(SVG_NAMESPACE, 'path');
	markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
	markerPath.classList.add('edge-arrowhead');
	marker.appendChild(markerPath);
	defs.appendChild(marker);
	svg.appendChild(defs);
	return svg;
}

export function renderEdges(
	document: Document,
	canvas: HTMLElement,
	scene: RenderSceneGeometry,
): void {
	const overlay = canvas.querySelector<SVGSVGElement>('.edge-overlay');
	if (!overlay) {
		return;
	}
	for (const path of Array.from(overlay.querySelectorAll('.edge-path'))) {
		path.remove();
	}
	overlay.setAttribute('viewBox', `0 0 ${scene.width} ${scene.height}`);
	for (const edge of scene.edges) {
		const path = document.createElementNS(SVG_NAMESPACE, 'path');
		path.classList.add('edge-path', edge.type);
		path.dataset.edgeId = edge.id;
		path.setAttribute('d', edgePath(edge));
		path.setAttribute('marker-end', 'url(#arrowhead)');
		overlay.appendChild(path);
	}
}

/** Returns a straight vector or one side of a reciprocal oval-like pair. */
export function edgePath(edge: LayoutEdgeResult): string {
	if (edge.type === 'normal') {
		return `M ${edge.start.x} ${edge.start.y} L ${edge.end.x} ${edge.end.y}`;
	}

	const deltaX = edge.end.x - edge.start.x;
	const deltaY = edge.end.y - edge.start.y;
	const length = Math.max(1, Math.hypot(deltaX, deltaY));
	// Reversing an edge reverses this perpendicular automatically, so the two
	// directions occupy opposite sides without relying on input ordering.
	const perpendicularX = -deltaY / length * RECIPROCAL_CURVE_OFFSET;
	const perpendicularY = deltaX / length * RECIPROCAL_CURVE_OFFSET;
	const midpointX = (edge.start.x + edge.end.x) / 2 + perpendicularX;
	const midpointY = (edge.start.y + edge.end.y) / 2 + perpendicularY;
	return `M ${edge.start.x} ${edge.start.y} Q ${midpointX} ${midpointY} ${edge.end.x} ${edge.end.y}`;
}
