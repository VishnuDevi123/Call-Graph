import type { GraphNode } from '../../graph/types';
import type { LayoutNodeInput } from '../layout/workerProtocol';
import { fileName } from './graphRenderer';

/**
 * Measures labels in hidden DOM nodes that use the same node typography and padding.
 * The worker receives pixels rather than estimating text width in a different context.
 */
export function measureGraphNodes(
	document: Document,
	container: HTMLElement,
	nodes: GraphNode[],
): LayoutNodeInput[] {
	container.replaceChildren();
	const measurements = nodes.map(node => {
		const element = createMeasurementNode(document, node);
		container.appendChild(element);
		const bounds = element.getBoundingClientRect();
		return {
			id: node.id,
			role: node.role,
			depth: node.depth,
			width: Math.ceil(bounds.width),
			height: Math.ceil(bounds.height),
		};
	});
	container.replaceChildren();
	return measurements;
}

function createMeasurementNode(document: Document, node: GraphNode): HTMLButtonElement {
	const element = document.createElement('button');
	element.type = 'button';
	element.className = `node ${node.role} measurement-node`;
	const name = document.createElement('span');
	name.className = 'node-name';
	name.textContent = node.label;
	const meta = document.createElement('span');
	meta.className = 'node-meta';
	meta.textContent = `${fileName(node.filePath)}:${node.line}`;
	element.append(name, meta);
	return element;
}
