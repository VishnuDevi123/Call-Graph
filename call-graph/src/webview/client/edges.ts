import type { GraphSceneGeometry } from '../sceneGeometry';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export function createEdgeOverlay(document: Document): SVGSVGElement {
	const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
	svg.classList.add('edge-overlay');
	svg.setAttribute('aria-hidden', 'true');
	const defs = document.createElementNS(SVG_NAMESPACE, 'defs');
	const marker = document.createElementNS(SVG_NAMESPACE, 'marker');
	marker.setAttribute('id', 'arrowhead');
	marker.setAttribute('viewBox', '0 0 10 10');
	marker.setAttribute('refX', '9');
	marker.setAttribute('refY', '5');
	marker.setAttribute('markerWidth', '7');
	marker.setAttribute('markerHeight', '7');
	marker.setAttribute('orient', 'auto-start-reverse');
	const markerPath = document.createElementNS(SVG_NAMESPACE, 'path');
	markerPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
	markerPath.setAttribute('fill', 'var(--accent)');
	markerPath.setAttribute('fill-opacity', '0.72');
	marker.appendChild(markerPath);
	defs.appendChild(marker);
	svg.appendChild(defs);
	return svg;
}

export function renderEdges(canvas: HTMLElement, scene: GraphSceneGeometry): void {
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
		path.classList.add('edge-path');
		path.setAttribute('d', edge.path);
		path.setAttribute('marker-end', 'url(#arrowhead)');
		overlay.appendChild(path);
	}
}
