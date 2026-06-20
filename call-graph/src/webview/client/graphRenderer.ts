import type { GraphModel, GraphNode } from '../../graph/types';
import type { GraphSceneGeometry } from '../sceneGeometry';
import { createEdgeOverlay, renderEdges } from './edges';
import type { WebviewElements } from './dom';
import type { VsCodeApi } from './types';

export function renderGraph(
	document: Document,
	elements: WebviewElements,
	graph: GraphModel,
	scene: GraphSceneGeometry,
	animateFocus: boolean,
	vscode: VsCodeApi,
	afterRender: () => void,
): void {
	elements.canvas.replaceChildren();
	elements.canvas.style.width = `${scene.width}px`;
	elements.canvas.style.height = `${scene.height}px`;
	elements.canvas.appendChild(createEdgeOverlay(document));
	if (graph.limitReached) {
		const limit = document.createElement('div');
		limit.className = 'limit';
		limit.textContent = graph.omittedDirectRelationshipCount > 0
			? `Graph limit reached. ${graph.omittedDirectRelationshipCount} direct relationship${graph.omittedDirectRelationshipCount === 1 ? '' : 's'} omitted.`
			: 'Graph limit reached. Reduce Depth Left or Depth Right to show fewer nodes.';
		limit.style.top = '8px';
		elements.canvas.appendChild(limit);
	}
	if (graph.largeGraphWarning) {
		const warning = document.createElement('div');
		warning.className = 'limit';
		warning.textContent = 'Graphs above 100 nodes may lay out slowly.';
		warning.style.top = graph.limitReached ? '36px' : '8px';
		elements.canvas.appendChild(warning);
	}
	renderGroup(document, elements.canvas, graph, scene, 'caller', animateFocus, vscode);
	renderGroup(document, elements.canvas, graph, scene, 'focus', animateFocus, vscode);
	renderGroup(document, elements.canvas, graph, scene, 'callee', animateFocus, vscode);
	requestAnimationFrame(() => {
		renderEdges(elements.canvas, scene);
		afterRender();
	});
}

export function fileName(filePath: string): string {
	const parts = filePath.replace(/\\/g, '/').split('/');
	return parts.at(-1) || filePath;
}

function renderGroup(
	document: Document,
	canvas: HTMLElement,
	graph: GraphModel,
	scene: GraphSceneGeometry,
	role: GraphNode['role'],
	animateFocus: boolean,
	vscode: VsCodeApi,
): void {
	const geometry = scene.groups.find(candidate => candidate.role === role);
	if (!geometry) {
		return;
	}
	const group = document.createElement('section');
	group.className = 'group';
	group.dataset.direction = role === 'caller' ? 'callers' : role === 'callee' ? 'callees' : 'focus';
	group.style.left = `${geometry.x}px`;
	group.style.top = `${geometry.y}px`;
	group.style.width = `${geometry.width}px`;
	group.setAttribute('aria-hidden', 'true');
	canvas.appendChild(group);
	const nodes = graph.nodes.filter(node => node.role === role);
	if (nodes.length === 0) {
		const empty = document.createElement('div');
		empty.className = 'empty-state';
		empty.textContent = 'None';
		empty.style.left = `${geometry.x}px`;
		empty.style.top = `${geometry.y + 50}px`;
		empty.style.width = `${role === 'focus' ? 280 : 240}px`;
		canvas.appendChild(empty);
		return;
	}
	for (const node of nodes) {
		const element = nodeElement(document, node, scene, animateFocus, vscode);
		if (element) {
			canvas.appendChild(element);
		}
	}
}

function nodeElement(
	document: Document,
	node: GraphNode,
	scene: GraphSceneGeometry,
	animateFocus: boolean,
	vscode: VsCodeApi,
): HTMLElement | undefined {
	const geometry = scene.nodes.find(candidate => candidate.id === node.id);
	if (!geometry) {
		return undefined;
	}
	const wrapper = document.createElement('div');
	wrapper.className = `node-wrap ${node.role}`;
	wrapper.dataset.nodeId = node.id;
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
