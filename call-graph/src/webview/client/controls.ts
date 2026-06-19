import type { GraphModel } from '../../graph/types';
import type { WebviewElements } from './dom';
import { depthChangeMessage } from './messages';
import type { VsCodeApi } from './types';

export function installControls(elements: WebviewElements, vscode: VsCodeApi): void {
	elements.refresh.addEventListener('click', event => {
		event.stopPropagation();
		vscode.postMessage({ type: 'refreshRequested' });
	});
	elements.includeTests.addEventListener('change', event => {
		event.stopPropagation();
		vscode.postMessage({
			type: 'includeTestsChanged',
			includeTests: elements.includeTests.checked,
		});
	});
	elements.depthLeft.addEventListener('change', event => {
		event.stopPropagation();
		vscode.postMessage(depthChangeMessage('callers', elements.depthLeft.value));
	});
	elements.depthRight.addEventListener('change', event => {
		event.stopPropagation();
		vscode.postMessage(depthChangeMessage('callees', elements.depthRight.value));
	});
}

export function updateControls(elements: WebviewElements, graph: GraphModel): void {
	elements.includeTests.checked = graph.includeTests;
	elements.depthLeft.value = String(graph.callerDepth);
	elements.depthRight.value = String(graph.calleeDepth);
}
