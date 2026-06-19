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
		limit.textContent = 'Graph limit reached. Reduce Depth Left or Depth Right to show fewer nodes.';
		limit.style.top = `${scene.detailsY - 46}px`;
		elements.canvas.appendChild(limit);
	}
	renderGroup(document, elements.canvas, graph, scene, 'Callers', 'caller', animateFocus, vscode);
	renderGroup(document, elements.canvas, graph, scene, 'Focused Function', 'focus', animateFocus, vscode);
	renderGroup(document, elements.canvas, graph, scene, 'Callees', 'callee', animateFocus, vscode);
	const details = document.createElement('section');
	details.className = 'details';
	details.style.top = `${scene.detailsY}px`;
	details.appendChild(renderDetails(document, 'Unresolved calls', graph.unresolvedCalls));
	details.appendChild(renderDetails(document, 'External calls', graph.externalCalls));
	elements.canvas.appendChild(details);
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
	label: string,
	role: GraphNode['role'],
	animateFocus: boolean,
	vscode: VsCodeApi,
): void {
	const geometry = scene.groups.find(candidate => candidate.role === role);
	if (!geometry) {
		return;
	}
	const group = document.createElement('section');
	group.className = 'group group-label';
	group.dataset.direction = role === 'caller' ? 'callers' : role === 'callee' ? 'callees' : 'focus';
	group.style.left = `${geometry.x}px`;
	group.style.top = `${geometry.y}px`;
	group.style.width = `${geometry.width}px`;
	group.textContent = label;
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

function renderDetails(document: Document, title: string, calls: string[]): HTMLDetailsElement {
	const detail = document.createElement('details');
	const summary = document.createElement('summary');
	summary.textContent = `${title} (${calls.length})`;
	detail.appendChild(summary);
	const list = document.createElement('ul');
	for (const call of calls) {
		const item = document.createElement('li');
		item.textContent = call;
		list.appendChild(item);
	}
	detail.appendChild(list);
	return detail;
}
