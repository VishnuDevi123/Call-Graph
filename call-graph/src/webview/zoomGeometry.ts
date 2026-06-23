import type { LayoutNodeResult } from './layout/workerProtocol';
import type { RenderSceneGeometry } from './renderGeometry';

export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 1.6;
export const ZOOM_STEP = 0.02;

export interface ZoomTransitionInput {
	currentZoom: number;
	nextZoom: number;
	scrollLeft: number;
	scrollTop: number;
	pointerX: number;
	pointerY: number;
}

export interface ZoomTransition {
	zoom: number;
	scrollLeft: number;
	scrollTop: number;
	transform: string;
}

export interface MinimapGeometry {
	scale: number;
	offsetX: number;
	offsetY: number;
	nodes: LayoutNodeResult[];
	viewport: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

export function normalizeZoom(zoom: number): number {
	if (zoom <= MIN_ZOOM) {
		return MIN_ZOOM;
	}
	if (zoom >= MAX_ZOOM) {
		return MAX_ZOOM;
	}
	const stepped = Math.round(zoom / ZOOM_STEP) * ZOOM_STEP;
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, stepped));
}

export function sceneTransform(zoom: number): string {
	return `scale(${normalizeZoom(zoom)})`;
}

export function scaledSceneSize(scene: RenderSceneGeometry, zoom: number): { width: number; height: number } {
	const normalizedZoom = normalizeZoom(zoom);
	return {
		width: scene.width * normalizedZoom,
		height: scene.height * normalizedZoom,
	};
}

export function calculateZoomTransition(input: ZoomTransitionInput): ZoomTransition {
	const currentZoom = normalizeZoom(input.currentZoom);
	const zoom = normalizeZoom(input.nextZoom);
	const sceneX = (input.scrollLeft + input.pointerX) / currentZoom;
	const sceneY = (input.scrollTop + input.pointerY) / currentZoom;

	return {
		zoom,
		scrollLeft: sceneX * zoom - input.pointerX,
		scrollTop: sceneY * zoom - input.pointerY,
		transform: sceneTransform(zoom),
	};
}

export function createMinimapGeometry(
	scene: RenderSceneGeometry,
	zoom: number,
	scrollLeft: number,
	scrollTop: number,
	viewportWidth: number,
	viewportHeight: number,
	minimapWidth = 176,
	minimapHeight = 112,
	padding = 4,
): MinimapGeometry {
	const normalizedZoom = normalizeZoom(zoom);
	const contentWidth = Math.max(1, scene.width);
	const contentHeight = Math.max(1, scene.height);
	const availableWidth = Math.max(1, minimapWidth - padding * 2);
	const availableHeight = Math.max(1, minimapHeight - padding * 2);
	const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
	const offsetX = (minimapWidth - contentWidth * scale) / 2;
	const offsetY = (minimapHeight - contentHeight * scale) / 2;
	const sceneViewportX = Math.max(0, scrollLeft / normalizedZoom);
	const sceneViewportY = Math.max(0, scrollTop / normalizedZoom);
	const sceneViewportWidth = Math.min(contentWidth, viewportWidth / normalizedZoom);
	const sceneViewportHeight = Math.min(contentHeight, viewportHeight / normalizedZoom);

	return {
		scale,
		offsetX,
		offsetY,
		nodes: scene.nodes,
		viewport: {
			x: offsetX + sceneViewportX * scale,
			y: offsetY + sceneViewportY * scale,
			width: sceneViewportWidth * scale,
			height: sceneViewportHeight * scale,
		},
	};
}
