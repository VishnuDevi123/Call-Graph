import type { GraphModel } from '../../graph/types';
import type { RenderSceneGeometry } from '../renderGeometry';
import { createMinimapGeometry } from '../zoomGeometry';
import type { WebviewElements } from './dom';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MINIMAP_MARGIN = 14;

interface MinimapDragState {
	pointerId: number;
	startX: number;
	startY: number;
	startLeft: number;
	startTop: number;
}

export function renderMinimap(
	elements: WebviewElements,
	graph: GraphModel,
	scene: RenderSceneGeometry,
	zoom: number,
): void {
	const geometry = createMinimapGeometry(
		scene,
		zoom,
		elements.viewport.scrollLeft,
		elements.viewport.scrollTop,
		elements.viewport.clientWidth,
		elements.viewport.clientHeight,
		176,
		112,
		4,
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

/**
 * Allows the minimap to move only from its handle so pointer gestures over the
 * canvas keep their normal pan behavior and minimap content remains inspectable.
 */
export function installMinimapDrag(elements: WebviewElements): void {
	let drag: MinimapDragState | undefined;

	elements.minimapHandle.addEventListener('pointerdown', event => {
		if (event.button !== 0) {
			return;
		}
		const rect = elements.minimap.getBoundingClientRect();
		drag = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			startLeft: rect.left,
			startTop: rect.top,
		};
		elements.minimapHandle.setPointerCapture(event.pointerId);
		elements.minimap.classList.add('is-dragging');
		event.preventDefault();
		event.stopPropagation();
	});

	elements.minimapHandle.addEventListener('pointermove', event => {
		if (!drag || drag.pointerId !== event.pointerId) {
			return;
		}
		event.preventDefault();
		positionMinimap(
			elements,
			drag.startLeft + event.clientX - drag.startX,
			drag.startTop + event.clientY - drag.startY,
		);
	});

	const endDrag = (event: PointerEvent): void => {
		if (drag?.pointerId !== event.pointerId) {
			return;
		}
		if (elements.minimapHandle.hasPointerCapture(event.pointerId)) {
			elements.minimapHandle.releasePointerCapture(event.pointerId);
		}
		drag = undefined;
		elements.minimap.classList.remove('is-dragging');
	};
	elements.minimapHandle.addEventListener('pointerup', endDrag);
	elements.minimapHandle.addEventListener('pointercancel', endDrag);
	elements.minimapHandle.addEventListener('lostpointercapture', event => {
		if (drag?.pointerId === event.pointerId) {
			drag = undefined;
			elements.minimap.classList.remove('is-dragging');
		}
	});

	window.addEventListener('resize', () => {
		const rect = elements.minimap.getBoundingClientRect();
		positionMinimap(elements, rect.left, rect.top);
	});
}

function positionMinimap(elements: WebviewElements, left: number, top: number): void {
	const maxLeft = Math.max(MINIMAP_MARGIN, window.innerWidth - elements.minimap.offsetWidth - MINIMAP_MARGIN);
	const maxTop = Math.max(MINIMAP_MARGIN, window.innerHeight - elements.minimap.offsetHeight - MINIMAP_MARGIN);
	const nextLeft = clamp(left, MINIMAP_MARGIN, maxLeft);
	const nextTop = clamp(top, MINIMAP_MARGIN, maxTop);
	elements.minimap.style.left = `${nextLeft}px`;
	elements.minimap.style.top = `${nextTop}px`;
	elements.minimap.style.right = 'auto';
	elements.minimap.style.bottom = 'auto';
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
