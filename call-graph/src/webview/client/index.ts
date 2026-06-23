import { emptyGraph } from '../../graph/emptyGraph';
import type { GraphExpansionDirection, GraphModel } from '../../graph/types';
import { createRenderScene, emptyRenderScene, type RenderSceneGeometry } from '../renderGeometry';
import { calculateZoomTransition, normalizeZoom, scaledSceneSize, sceneTransform } from '../zoomGeometry';
import { installControls, updateControls } from './controls';
import { getWebviewElements } from './dom';
import { renderGraph } from './graphRenderer';
import { LayoutCoordinator } from './layoutCoordinator';
import { createLocalLayoutWorker } from './localLayoutWorker';
import { renderMinimap } from './minimap';
import { installPanning } from './panning';
import { PositionMemory } from './positionMemory';
import { measureGraphNodes } from './textMeasurement';
import type { HostMessage } from './types';

const vscode = acquireVsCodeApi();
const elements = getWebviewElements(document);
let graph: GraphModel = emptyGraph;
let scene: RenderSceneGeometry = emptyRenderScene();
let zoom = 1;
let minimapVisible = true;
const positionMemory = new PositionMemory();
let layoutCoordinator: LayoutCoordinator | undefined;
let webviewDisposed = false;

installControls(elements, vscode, {
	resetView,
	toggleMinimap,
});
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
window.addEventListener('beforeunload', () => {
	webviewDisposed = true;
	layoutCoordinator?.dispose();
}, { once: true });

renderCurrentScene();
void initializeLayoutWorker();

async function initializeLayoutWorker(): Promise<void> {
	try {
		const worker = await createLocalLayoutWorker(elements.layoutWorkerUri);
		if (webviewDisposed) {
			worker.terminate();
			return;
		}
		layoutCoordinator = new LayoutCoordinator(
			worker,
			result => {
				positionMemory.update(result);
				scene = createRenderScene(result);
				renderCurrentScene();
			},
			message => console.error(`Call Graph layout worker: ${message}`),
		);
		requestLayout();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to start layout worker.';
		console.error(`Call Graph layout worker: ${message}`);
	}
}

function handleHostMessage(message: HostMessage): void {
	switch (message.type) {
		case 'graphUpdated': {
			const animateFocus = Boolean(graph.focusNodeId && graph.focusNodeId !== message.graph.focusNodeId);
			graph = message.graph;
			pendingFocusAnimation = animateFocus;
			updateControls(elements, graph);
			requestLayout();
			return;
		}
		case 'overlayUpdated':
			updateOperationalOverlay(message.message, message.severity);
			return;
		case 'revealDirection':
			revealDirection(message.direction);
			return;
	}
}

let pendingFocusAnimation = false;

function renderCurrentScene(): void {
	updateControls(elements, graph);
	applySceneTransform();
	renderGraph(document, elements, graph, scene, pendingFocusAnimation, vscode);
	pendingFocusAnimation = false;
	scheduleMinimap();
}

function requestLayout(): void {
	layoutCoordinator?.request({
		focusNodeId: graph.focusNodeId,
		nodes: measureGraphNodes(document, elements.nodeMeasurements, graph.nodes),
		edges: graph.edges.map(edge => ({
			id: edge.id,
			from: edge.from,
			to: edge.to,
			type: edge.type,
		})),
		viewport: {
			width: elements.viewport.clientWidth,
			height: elements.viewport.clientHeight,
		},
		depths: {
			callers: graph.callerDepth,
			callees: graph.calleeDepth,
		},
		previousPositions: positionMemory.snapshot(),
		settings: {
			nodeGap: 150,
			bandGap: 352,
			obstaclePadding: 12,
		},
	});
}

function applySceneTransform(): void {
	const size = scaledSceneSize(scene, zoom);
	elements.canvas.style.transform = sceneTransform(zoom);
	elements.sceneStage.style.width = `${size.width}px`;
	elements.sceneStage.style.height = `${size.height}px`;
	elements.zoomPercentage.value = `${Math.round(zoom * 100)}%`;
}

function scheduleMinimap(): void {
	if (!minimapVisible) {
		return;
	}
	requestAnimationFrame(() => renderMinimap(elements, graph, scene, normalizeZoom(zoom)));
}

function resetView(): void {
	zoom = 1;
	applySceneTransform();
	elements.viewport.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
	scheduleMinimap();
}

function toggleMinimap(): void {
	minimapVisible = !minimapVisible;
	elements.minimap.classList.toggle('is-hidden', !minimapVisible);
	elements.minimap.setAttribute('aria-hidden', String(!minimapVisible));
	elements.minimapToggle.setAttribute('aria-pressed', String(minimapVisible));
	if (minimapVisible) {
		scheduleMinimap();
	}
}

function updateOperationalOverlay(message: string | undefined, severity: 'warning'): void {
	elements.operationalOverlayMessage.textContent = message ?? '';
	elements.operationalOverlay.dataset.severity = severity;
	elements.operationalOverlay.hidden = !message;
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
