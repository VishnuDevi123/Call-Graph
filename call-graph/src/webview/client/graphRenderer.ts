import type { GraphModel, GraphNode } from '../../graph/types';
import type { LayoutNodeResult } from '../layout/workerProtocol';
import type { RenderSceneGeometry } from '../renderGeometry';
import { createEdgeOverlay, renderEdges } from './edges';
import type { WebviewElements } from './dom';
import type { VsCodeApi } from './types';

/** Renders worker-owned geometry without introducing role groups or placeholders. */
export function renderGraph(
	document: Document,
	elements: WebviewElements,
	graph: GraphModel,
	scene: RenderSceneGeometry,
	animateFocus: boolean,
	vscode: VsCodeApi,
): void {
	elements.canvas.replaceChildren();
	elements.canvas.dataset.graphEdges = JSON.stringify(graph.edges.map(edge => ({
		id: edge.id,
		from: edge.from,
		to: edge.to,
	})));
	elements.canvas.style.width = `${scene.width}px`;
	elements.canvas.style.height = `${scene.height}px`;
	elements.canvas.appendChild(createEdgeOverlay(document));
	renderNotices(document, elements.canvas, graph, scene);

	const geometryById = new Map(scene.nodes.map(node => [node.id, node]));
	for (const node of graph.nodes) {
		const geometry = geometryById.get(node.id);
		if (geometry) {
			elements.canvas.appendChild(nodeElement(document, node, geometry, animateFocus, vscode));
		}
	}
	renderEdges(document, elements.canvas, scene);
}

export function fileName(filePath: string): string {
	const parts = filePath.replace(/\\/g, '/').split('/');
	return parts.at(-1) || filePath;
}

function renderNotices(
	document: Document,
	canvas: HTMLElement,
	graph: GraphModel,
	scene: RenderSceneGeometry,
): void {
	const messages: string[] = [];
	if (graph.limitReached) {
		messages.push(graph.omittedDirectRelationshipCount > 0
			? `Graph limit reached. ${graph.omittedDirectRelationshipCount} direct relationship${graph.omittedDirectRelationshipCount === 1 ? '' : 's'} omitted.`
			: 'Graph limit reached. Reduce Depth Left or Depth Right to show fewer nodes.');
	}
	if (graph.largeGraphWarning) {
		messages.push('Graphs above 100 nodes may lay out slowly.');
	}
	messages.forEach((message, index) => {
		const notice = document.createElement('div');
		notice.className = 'limit';
		notice.textContent = message;
		notice.style.top = `${8 + index * 44}px`;
		canvas.appendChild(notice);
	});
}

function nodeElement(
	document: Document,
	node: GraphNode,
	geometry: LayoutNodeResult,
	animateFocus: boolean,
	vscode: VsCodeApi,
): HTMLElement {
	const wrapper = document.createElement('div');
	wrapper.className = `node-wrap ${node.role}`;
	wrapper.dataset.nodeId = node.id;
	wrapper.dataset.direction = node.role === 'caller'
		? 'callers'
		: node.role === 'callee'
			? 'callees'
			: 'focus';
	wrapper.style.left = `${geometry.x}px`;
	wrapper.style.top = `${geometry.y}px`;
	wrapper.style.width = `${geometry.width}px`;
	wrapper.style.height = `${geometry.height}px`;
	const button = document.createElement('button');
	button.type = 'button';
	button.className = `node ${node.role}`;
	button.title = `${node.label} (${fileName(node.filePath)}:${node.line})`;
	if (node.role === 'focus' && animateFocus) {
		button.classList.add('focus-transition');
	}
	const name = document.createElement('span');
	name.className = 'node-name';
	name.textContent = node.label;
	const meta = document.createElement('span');
	meta.className = 'node-meta';
	meta.textContent = `${fileName(node.filePath)}:${node.line}`;
	button.append(name, meta);
	button.addEventListener('click', event => {
		event.stopPropagation();
		vscode.postMessage({ type: 'nodeRevealed', nodeId: node.id });
	});
	button.addEventListener('dblclick', event => {
		event.stopPropagation();
		vscode.postMessage({ type: 'nodeActivated', nodeId: node.id });
	});
	button.addEventListener('keydown', event => {
		if (event.key !== 'Enter') {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		vscode.postMessage({ type: 'nodeActivated', nodeId: node.id });
	});
	wrapper.addEventListener('mouseenter', () => applyHoverState(wrapper, node.id));
	wrapper.addEventListener('focusin', () => applyHoverState(wrapper, node.id));
	wrapper.addEventListener('mouseleave', () => clearHoverState(wrapper));
	wrapper.addEventListener('focusout', () => clearHoverState(wrapper));
	wrapper.appendChild(button);
	return wrapper;
}

function applyHoverState(wrapper: HTMLElement, nodeId: string): void {
	const canvas = wrapper.closest<HTMLElement>('.canvas');
	if (!canvas) {
		return;
	}
	const connectedNodeIds = new Set([nodeId]);
	const connectedEdgeIds = new Set<string>();
	for (const edge of currentGraphEdges(canvas)) {
		if (edge.from === nodeId || edge.to === nodeId) {
			connectedNodeIds.add(edge.from);
			connectedNodeIds.add(edge.to);
			connectedEdgeIds.add(edge.id);
		}
	}
	canvas.classList.add('has-hover');
	for (const element of Array.from(canvas.querySelectorAll<HTMLElement>('.node-wrap'))) {
		const connected = connectedNodeIds.has(element.dataset.nodeId ?? '');
		element.classList.toggle('is-connected', connected);
		element.classList.toggle('is-dimmed', !connected);
	}
	for (const edge of Array.from(canvas.querySelectorAll<SVGPathElement>('.edge-path'))) {
		const connected = connectedEdgeIds.has(edge.dataset.edgeId ?? '');
		edge.classList.toggle('is-connected', connected);
		edge.classList.toggle('is-dimmed', !connected);
	}
}

function clearHoverState(wrapper: HTMLElement): void {
	const canvas = wrapper.closest<HTMLElement>('.canvas');
	if (!canvas) {
		return;
	}
	canvas.classList.remove('has-hover');
	for (const element of Array.from(canvas.querySelectorAll<HTMLElement>('.node-wrap.is-connected, .node-wrap.is-dimmed'))) {
		element.classList.remove('is-connected', 'is-dimmed');
	}
	for (const edge of Array.from(canvas.querySelectorAll<SVGPathElement>('.edge-path.is-connected, .edge-path.is-dimmed'))) {
		edge.classList.remove('is-connected', 'is-dimmed');
	}
}

function currentGraphEdges(canvas: HTMLElement): Array<{ id: string; from: string; to: string }> {
	const encodedEdges = canvas.dataset.graphEdges;
	if (!encodedEdges) {
		return [];
	}
	try {
		return JSON.parse(encodedEdges) as Array<{ id: string; from: string; to: string }>;
	} catch {
		return [];
	}
}
