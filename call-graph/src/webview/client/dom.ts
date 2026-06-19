export interface WebviewElements {
	canvas: HTMLElement;
	sceneStage: HTMLElement;
	viewport: HTMLElement;
	status: HTMLElement;
	includeTests: HTMLInputElement;
	depthLeft: HTMLSelectElement;
	depthRight: HTMLSelectElement;
	refresh: HTMLButtonElement;
	minimapContent: SVGGElement;
	minimapViewport: SVGRectElement;
}

export function getWebviewElements(document: Document): WebviewElements {
	return {
		canvas: requiredElement(document, 'canvas', HTMLElement),
		sceneStage: requiredElement(document, 'scene-stage', HTMLElement),
		viewport: requiredElement(document, 'viewport', HTMLElement),
		status: requiredElement(document, 'status', HTMLElement),
		includeTests: requiredElement(document, 'include-tests', HTMLInputElement),
		depthLeft: requiredElement(document, 'depth-left', HTMLSelectElement),
		depthRight: requiredElement(document, 'depth-right', HTMLSelectElement),
		refresh: requiredElement(document, 'refresh', HTMLButtonElement),
		minimapContent: requiredElement(document, 'minimap-content', SVGGElement),
		minimapViewport: requiredElement(document, 'minimap-viewport', SVGRectElement),
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
