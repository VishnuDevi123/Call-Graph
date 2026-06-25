import { emptyGraph } from '../../graph/emptyGraph';
import type { GraphExpansionDirection, GraphModel } from '../../graph/types';
import { createRenderScene, emptyRenderScene, type RenderSceneGeometry } from '../renderGeometry';
import {
	calculateFitTransition,
	calculateZoomTransition,
	MANUAL_MIN_ZOOM,
	normalizeDisplayZoom,
	sceneTransform,
	stageSizeWithPanSpace,
} from '../zoomGeometry';
import { installControls, updateControls, updateNavigationControls } from './controls';
import { getWebviewElements } from './dom';
import { renderGraph } from './graphRenderer';
import { LayoutCoordinator } from './layoutCoordinator';
import { createLocalLayoutWorker } from './localLayoutWorker';
import { installMinimapDrag, renderMinimap } from './minimap';
import { installPanning } from './panning';
import { PositionMemory } from './positionMemory';
import { measureGraphNodes } from './textMeasurement';
import type { HostMessage } from './types';

const vscode = acquireVsCodeApi();
const elements = getWebviewElements(document);
let graph: GraphModel = emptyGraph;
let scene: RenderSceneGeometry = emptyRenderScene();
let zoom = 1;
let wheelZoomFloor = MANUAL_MIN_ZOOM;
let minimapVisible = true;
const positionMemory = new PositionMemory();
let layoutCoordinator: LayoutCoordinator | undefined;
let layoutWorkerReady = false;
let webviewDisposed = false;
let hasCompletedLayout = false;
let hasReceivedGraph = false;
let latestLayoutHasObstructedEdges = false;
let hostOverlay: { message?: string; severity: OverlaySeverity } | undefined;
let transientOverlayTimer: number | undefined;

type OverlaySeverity = 'loading' | 'warning' | 'error' | 'empty';
const TRANSIENT_OVERLAY_MS = 2400;

installControls(elements, vscode, {
	resetView,
	retryLayout,
	toggleMinimap,
});
installMinimapDrag(elements);
installPanning(elements.viewport, scheduleMinimap);
elements.viewport.addEventListener('wheel', event => {
	event.preventDefault();
	const bounds = elements.viewport.getBoundingClientRect();
	const transition = calculateZoomTransition({
		currentZoom: zoom,
		nextZoom: zoom + (event.deltaY < 0 ? 0.1 : -0.1),
		minZoom: wheelZoomFloor,
		scrollLeft: elements.viewport.scrollLeft,
		scrollTop: elements.viewport.scrollTop,
		pointerX: event.clientX - bounds.left,
		pointerY: event.clientY - bounds.top,
		canvasLeft: elements.viewport.clientWidth,
		canvasTop: elements.viewport.clientHeight,
	});
	if (transition.zoom === zoom) {
		return;
	}
	zoom = transition.zoom;
	elements.canvas.classList.remove('fit-transition');
	applySceneTransform();
	elements.viewport.scrollLeft = transition.scrollLeft;
	elements.viewport.scrollTop = transition.scrollTop;
	scheduleMinimap();
}, { passive: false });
elements.viewport.addEventListener('scroll', scheduleMinimap);
window.addEventListener('resize', () => {
	applySceneTransform();
	scheduleMinimap();
});
window.addEventListener('message', event => handleHostMessage(event.data as HostMessage));
window.addEventListener('beforeunload', () => {
	webviewDisposed = true;
	layoutCoordinator?.dispose();
}, { once: true });

renderCurrentScene();
showOperationalOverlay('Loading call graph...', 'loading');
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
				fitCompleteGraph(hasCompletedLayout);
				hasCompletedLayout = true;
				latestLayoutHasObstructedEdges = result.hasObstructedEdges;
				updatePresentationOverlay();
			},
			message => {
				console.error(`Call Graph layout worker: ${message}`);
				showOperationalOverlay(`Layout failed. ${message}`, 'error');
			},
		);
		layoutWorkerReady = true;
		requestLayout();
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unable to start layout worker.';
		console.error(`Call Graph layout worker: ${message}`);
		showOperationalOverlay(`Layout failed. ${message}`, 'error');
	}
}

function handleHostMessage(message: HostMessage): void {
	switch (message.type) {
		case 'graphUpdated': {
			const animateFocus = Boolean(graph.focusNodeId && graph.focusNodeId !== message.graph.focusNodeId);
			graph = message.graph;
			hasReceivedGraph = true;
			pendingFocusAnimation = animateFocus;
			updateControls(elements, graph);
			latestLayoutHasObstructedEdges = false;
			if (!hostOverlay?.message && graph.nodes.length > 0) {
				showOperationalOverlay(animateFocus ? 'Updating focused graph...' : 'Updating graph...', 'loading');
			}
			requestLayout();
			return;
		}
		case 'overlayUpdated':
			hostOverlay = message.message ? { message: message.message, severity: message.severity } : undefined;
			updatePresentationOverlay();
			return;
		case 'navigationStateUpdated':
			updateNavigationControls(elements, message);
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
	if (!layoutCoordinator) {
		updatePresentationOverlay();
		return;
	}
	if (graph.nodes.length === 0) {
		scene = emptyRenderScene();
		renderCurrentScene();
		updatePresentationOverlay();
		return;
	}
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
			// The node gap is the vertical space between nodes in the same depth band.
			nodeGap: 32,
			// The band gap is the horizontal space between depth bands. It is multiplied by the depth gap to determine the total space between bands.
			bandGap: 67,
			// The obstacle padding is the minimum distance that edges must maintain from unrelated nodes. It is used to avoid edges crossing over unrelated nodes.
			obstaclePadding: 6.5,
		},
	});
}

function applySceneTransform(): void {
	const size = stageSizeWithPanSpace(
		scene,
		zoom,
		elements.viewport.clientWidth,
		elements.viewport.clientHeight,
	);
	elements.canvas.style.transform = sceneTransform(zoom);
	elements.canvas.style.left = `${elements.viewport.clientWidth}px`;
	elements.canvas.style.top = `${elements.viewport.clientHeight}px`;
	elements.sceneStage.style.width = `${size.width}px`;
	elements.sceneStage.style.height = `${size.height}px`;
	elements.zoomPercentage.value = `${Math.round(zoom * 100)}%`;
}

function scheduleMinimap(): void {
	if (!minimapVisible) {
		return;
	}
	requestAnimationFrame(() => renderMinimap(elements, graph, scene, normalizeDisplayZoom(zoom)));
}

function resetView(): void {
	fitCompleteGraph(true);
}

function retryLayout(): void {
	if (graph.nodes.length === 0) {
		vscode.postMessage({ type: 'refreshRequested' });
		return;
	}
	showOperationalOverlay('Retrying layout...', 'loading');
	requestLayout();
}

function fitCompleteGraph(animate: boolean): void {
	const transition = calculateFitTransition(
		scene,
		elements.viewport.clientWidth,
		elements.viewport.clientHeight,
	);
	zoom = transition.zoom;
	wheelZoomFloor = Math.min(MANUAL_MIN_ZOOM, transition.zoom);
	const shouldAnimate = animate && !prefersReducedMotion();
	elements.canvas.classList.toggle('fit-transition', shouldAnimate);
	if (shouldAnimate) {
		// Commit the old transform before setting the fit scale so the browser
		// can interpolate instead of coalescing both style changes.
		void elements.canvas.offsetWidth;
	}
	applySceneTransform();
	elements.viewport.scrollTo({
		left: transition.scrollLeft,
		top: transition.scrollTop,
		behavior: shouldAnimate ? 'smooth' : 'auto',
	});
	if (shouldAnimate) {
		window.setTimeout(() => elements.canvas.classList.remove('fit-transition'), 260);
	}
	scheduleMinimap();
}

function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

function updatePresentationOverlay(): void {
	const hasGraphData = graph.nodes.length > 0;
	const hasRenderedGraph = hasGraphData && scene.nodes.length > 0;

	if (hostOverlay?.message) {
		if (hasRenderedGraph && hostOverlay.severity === 'warning') {
			showTransientOperationalOverlay(hostOverlay.message, hostOverlay.severity);
			return;
		}
		showOperationalOverlay(hostOverlay.message, hostOverlay.severity);
		return;
	}
	if (hasRenderedGraph) {
		if (latestLayoutHasObstructedEdges) {
			showTransientOperationalOverlay('Some edges could not avoid unrelated nodes. The graph remains usable; try Reset View or reduce depth.', 'warning');
			return;
		}
		hideOperationalOverlay();
		return;
	}
	if (!layoutWorkerReady && hasGraphData) {
		showOperationalOverlay('Loading layout worker...', 'loading');
		return;
	}
	if (hasReceivedGraph && !hasGraphData) {
		showOperationalOverlay('No Python call graph data is available. Use Refresh after opening a workspace with Python files.', 'empty');
		return;
	}
	if (!hasReceivedGraph) {
		showOperationalOverlay('Loading call graph...', 'loading');
		return;
	}
	hideOperationalOverlay();
}

function showOperationalOverlay(message: string, severity: OverlaySeverity): void {
	clearTransientOverlayTimer();
	elements.operationalOverlayMessage.textContent = message;
	elements.operationalOverlay.dataset.severity = severity;
	updateOverlayActions(severity);
	elements.operationalOverlay.hidden = false;
}

function showTransientOperationalOverlay(message: string, severity: OverlaySeverity): void {
	elements.operationalOverlayMessage.textContent = message;
	elements.operationalOverlay.dataset.severity = severity;
	elements.operationalOverlayActions.hidden = true;
	elements.operationalOverlay.hidden = false;
	clearTransientOverlayTimer();
	transientOverlayTimer = window.setTimeout(() => {
		transientOverlayTimer = undefined;
		hideOperationalOverlay();
	}, TRANSIENT_OVERLAY_MS);
}

function hideOperationalOverlay(): void {
	clearTransientOverlayTimer();
	elements.operationalOverlayMessage.textContent = '';
	elements.operationalOverlay.removeAttribute('data-severity');
	elements.operationalOverlayActions.hidden = true;
	elements.operationalOverlay.hidden = true;
}

function updateOverlayActions(severity: OverlaySeverity): void {
	const canRetryLayout = severity === 'error' && graph.nodes.length > 0 && Boolean(layoutCoordinator);
	const canRefresh = severity === 'error' || severity === 'empty';
	elements.retryLayout.hidden = !canRetryLayout;
	elements.overlayRefresh.hidden = !canRefresh;
	elements.operationalOverlayActions.hidden = !canRetryLayout && !canRefresh;
}

function clearTransientOverlayTimer(): void {
	if (transientOverlayTimer) {
		clearTimeout(transientOverlayTimer);
		transientOverlayTimer = undefined;
	}
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
