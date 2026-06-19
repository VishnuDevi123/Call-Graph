import type { GraphModel } from '../../graph/types';
import type { GraphSceneGeometry } from '../sceneGeometry';
import { createMinimapGeometry } from '../zoomGeometry';
import type { WebviewElements } from './dom';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export function renderMinimap(
	elements: WebviewElements,
	graph: GraphModel,
	scene: GraphSceneGeometry,
	zoom: number,
): void {
	const geometry = createMinimapGeometry(
		scene,
		zoom,
		elements.viewport.scrollLeft,
		elements.viewport.scrollTop,
		elements.viewport.clientWidth,
		elements.viewport.clientHeight,
	);
	elements.minimapContent.replaceChildren();
	for (const node of geometry.nodes) {
		const rect = document.createElementNS(SVG_NAMESPACE, 'rect');
		rect.classList.add('minimap-node');
		if (node.id === graph.focusNodeId) {
			rect.classList.add('focus');
		}
		rect.setAttribute('x', String(geometry.offsetX + node.x * geometry.scale));
		rect.setAttribute('y', String(geometry.offsetY + node.y * geometry.scale));
		rect.setAttribute('width', String(Math.max(3, node.width * geometry.scale)));
		rect.setAttribute('height', String(Math.max(3, node.height * geometry.scale)));
		rect.setAttribute('rx', '1');
		elements.minimapContent.appendChild(rect);
	}
	elements.minimapViewport.setAttribute('x', String(geometry.viewport.x));
	elements.minimapViewport.setAttribute('y', String(geometry.viewport.y));
	elements.minimapViewport.setAttribute('width', String(geometry.viewport.width));
	elements.minimapViewport.setAttribute('height', String(geometry.viewport.height));
}
