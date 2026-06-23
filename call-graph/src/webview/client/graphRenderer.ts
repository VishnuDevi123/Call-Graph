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
	if (scene.hasObstructedEdges) {
		messages.push('Some edges could not be routed clear of unrelated nodes.');
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
		vscode.postMessage({ type: 'nodeSelected', nodeId: node.id });
	});
	wrapper.appendChild(button);
	return wrapper;
}
