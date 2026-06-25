import type { GraphModel } from '../../graph/types';
import type { WebviewElements } from './dom';
import { depthChangeMessage } from './messages';
import type { VsCodeApi } from './types';

export interface ControlActions {
	resetView(): void;
	retryLayout(): void;
	toggleMinimap(): void;
}

export function installControls(elements: WebviewElements, vscode: VsCodeApi, actions: ControlActions): void {
	elements.refresh.addEventListener('click', event => {
		event.stopPropagation();
		vscode.postMessage({ type: 'refreshRequested' });
	});
	elements.overlayRefresh.addEventListener('click', event => {
		event.stopPropagation();
		vscode.postMessage({ type: 'refreshRequested' });
	});
	elements.retryLayout.addEventListener('click', event => {
		event.stopPropagation();
		actions.retryLayout();
	});
	elements.back.addEventListener('click', event => {
		event.stopPropagation();
		vscode.postMessage({ type: 'navigateBack' });
	});
	elements.forward.addEventListener('click', event => {
		event.stopPropagation();
		vscode.postMessage({ type: 'navigateForward' });
	});
	elements.resetView.addEventListener('click', event => {
		event.stopPropagation();
		actions.resetView();
	});
	elements.minimapToggle.addEventListener('click', event => {
		event.stopPropagation();
		actions.toggleMinimap();
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
	elements.depthLeft.value = String(graph.callerDepth);
	elements.depthRight.value = String(graph.calleeDepth);
}

export function updateNavigationControls(
	elements: WebviewElements,
	state: { canGoBack: boolean; canGoForward: boolean },
): void {
	elements.back.disabled = !state.canGoBack;
	elements.forward.disabled = !state.canGoForward;
}
