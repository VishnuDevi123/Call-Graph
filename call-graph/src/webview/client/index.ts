import { emptyGraph } from '../../graph/emptyGraph';
import type { GraphExpansionDirection, GraphModel } from '../../graph/types';
import { createSceneGeometry, type GraphSceneGeometry } from '../sceneGeometry';
import { calculateZoomTransition, normalizeZoom, scaledSceneSize, sceneTransform } from '../zoomGeometry';
import { installControls, updateControls } from './controls';
import { getWebviewElements } from './dom';
import { renderGraph } from './graphRenderer';
import { renderMinimap } from './minimap';
import { installPanning } from './panning';
import type { HostMessage } from './types';

const vscode = acquireVsCodeApi();
const elements = getWebviewElements(document);
let graph: GraphModel = emptyGraph;
let scene: GraphSceneGeometry = createSceneGeometry(graph);
let zoom = 1;

installControls(elements, vscode);
installPanning(elements.viewport, scheduleMinimap);
elements.viewport.addEventListener('wheel', event => {
	event.preventDefault();
	const bounds = elements.viewport.getBoundingClientRect();
	const transition = calculateZoomTransition({
		currentZoom: zoom,
		nextZoom: zoom + (event.deltaY < 0 ? 0.1 : -0.1),
		scrollLeft: elements.viewport.scrollLeft,
		scrollTop: elements.viewport.scrollTop,
		pointerX: event.clientX - bounds.left,
		pointerY: event.clientY - bounds.top,
	});
	if (transition.zoom === zoom) {
		return;
	}
	zoom = transition.zoom;
	applySceneTransform();
	elements.viewport.scrollLeft = transition.scrollLeft;
	elements.viewport.scrollTop = transition.scrollTop;
	scheduleMinimap();
}, { passive: false });
elements.viewport.addEventListener('scroll', scheduleMinimap);
window.addEventListener('resize', scheduleMinimap);
window.addEventListener('message', event => handleHostMessage(event.data as HostMessage));

render(false);

function handleHostMessage(message: HostMessage): void {
	switch (message.type) {
		case 'graphUpdated': {
			const animateFocus = Boolean(graph.focusNodeId && graph.focusNodeId !== message.graph.focusNodeId);
			graph = message.graph;
			scene = message.scene;
			render(animateFocus);
			return;
		}
		case 'statusUpdated':
			elements.status.textContent = message.message ?? '';
			return;
		case 'revealDirection':
			revealDirection(message.direction);
			return;
	}
}

function render(animateFocus: boolean): void {
	updateControls(elements, graph);
	applySceneTransform();
	renderGraph(document, elements, graph, scene, animateFocus, vscode, scheduleMinimap);
}

function applySceneTransform(): void {
	const size = scaledSceneSize(scene, zoom);
	elements.canvas.style.transform = sceneTransform(zoom);
	elements.sceneStage.style.width = `${size.width}px`;
	elements.sceneStage.style.height = `${size.height}px`;
}

function scheduleMinimap(): void {
	requestAnimationFrame(() => renderMinimap(elements, graph, scene, normalizeZoom(zoom)));
}

function revealDirection(direction: GraphExpansionDirection): void {
	const group = elements.canvas.querySelector<HTMLElement>(`[data-direction="${direction}"]`);
	if (!group) {
		return;
	}
	group.scrollIntoView({
		behavior: 'smooth',
		block: 'center',
		inline: direction === 'callers' ? 'start' : 'end',
	});
	group.classList.remove('revealed');
	requestAnimationFrame(() => group.classList.add('revealed'));
}
