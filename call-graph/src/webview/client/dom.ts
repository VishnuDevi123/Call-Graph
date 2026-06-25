export interface WebviewElements {
	canvas: HTMLElement;
	sceneStage: HTMLElement;
	viewport: HTMLElement;
	operationalOverlay: HTMLElement;
	operationalOverlayMessage: HTMLElement;
	operationalOverlayActions: HTMLElement;
	retryLayout: HTMLButtonElement;
	overlayRefresh: HTMLButtonElement;
	depthLeft: HTMLSelectElement;
	depthRight: HTMLSelectElement;
	back: HTMLButtonElement;
	forward: HTMLButtonElement;
	refresh: HTMLButtonElement;
	resetView: HTMLButtonElement;
	minimap: HTMLElement;
	minimapHandle: HTMLElement;
	minimapToggle: HTMLButtonElement;
	zoomPercentage: HTMLOutputElement;
	minimapContent: SVGGElement;
	minimapViewport: SVGRectElement;
	nodeMeasurements: HTMLElement;
	layoutWorkerUri: string;
}

export function getWebviewElements(document: Document): WebviewElements {
	return {
		canvas: requiredElement(document, 'canvas', HTMLElement),
		sceneStage: requiredElement(document, 'scene-stage', HTMLElement),
		viewport: requiredElement(document, 'viewport', HTMLElement),
		operationalOverlay: requiredElement(document, 'operational-overlay', HTMLElement),
		operationalOverlayMessage: requiredElement(document, 'operational-overlay-message', HTMLElement),
		operationalOverlayActions: requiredElement(document, 'operational-overlay-actions', HTMLElement),
		retryLayout: requiredElement(document, 'retry-layout', HTMLButtonElement),
		overlayRefresh: requiredElement(document, 'overlay-refresh', HTMLButtonElement),
		depthLeft: requiredElement(document, 'depth-left', HTMLSelectElement),
		depthRight: requiredElement(document, 'depth-right', HTMLSelectElement),
		back: requiredElement(document, 'back', HTMLButtonElement),
		forward: requiredElement(document, 'forward', HTMLButtonElement),
		refresh: requiredElement(document, 'refresh', HTMLButtonElement),
		resetView: requiredElement(document, 'reset-view', HTMLButtonElement),
		minimap: requiredElement(document, 'minimap', HTMLElement),
		minimapHandle: requiredElement(document, 'minimap-handle', HTMLElement),
		minimapToggle: requiredElement(document, 'minimap-toggle', HTMLButtonElement),
		zoomPercentage: requiredElement(document, 'zoom-percentage', HTMLOutputElement),
		minimapContent: requiredElement(document, 'minimap-content', SVGGElement),
		minimapViewport: requiredElement(document, 'minimap-viewport', SVGRectElement),
		nodeMeasurements: requiredElement(document, 'node-measurements', HTMLElement),
		layoutWorkerUri: requiredValue(document.body.dataset.layoutWorkerUri, 'layout worker URI'),
	};
}

function requiredElement<T extends Element>(
	document: Document,
	id: string,
	constructor: { new(): T },
): T {
	const element = document.getElementById(id);
	if (!(element instanceof constructor)) {
		throw new Error(`Missing webview element: ${id}`);
	}
	return element;
}

function requiredValue(value: string | undefined, name: string): string {
	if (!value) {
		throw new Error(`Missing webview resource: ${name}`);
	}
	return value;
}
