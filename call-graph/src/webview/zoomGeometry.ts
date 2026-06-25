import type { LayoutNodeResult } from './layout/workerProtocol';
import type { RenderSceneGeometry } from './renderGeometry';

export const MANUAL_MIN_ZOOM = 0.5;
export const AUTO_FIT_MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;
export const ZOOM_STEP = 0.02;
export const FIT_PADDING = 24;

export interface ZoomTransitionInput {
	currentZoom: number;
	nextZoom: number;
	minZoom?: number;
	scrollLeft: number;
	scrollTop: number;
	pointerX: number;
	pointerY: number;
	canvasLeft?: number;
	canvasTop?: number;
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

export interface FitTransition {
	zoom: number;
	scrollLeft: number;
	scrollTop: number;
}

export function normalizeZoom(zoom: number, minZoom = MANUAL_MIN_ZOOM): number {
	const lowerBound = Math.min(MANUAL_MIN_ZOOM, Math.max(AUTO_FIT_MIN_ZOOM, minZoom));
	if (zoom <= lowerBound) {
		return lowerBound;
	}
	if (zoom >= MAX_ZOOM) {
		return MAX_ZOOM;
	}
	const stepped = Math.round(zoom / ZOOM_STEP) * ZOOM_STEP;
	return Math.min(MAX_ZOOM, Math.max(lowerBound, stepped));
}

export function normalizeDisplayZoom(zoom: number): number {
	return Math.min(MAX_ZOOM, Math.max(AUTO_FIT_MIN_ZOOM, zoom));
}

export function sceneTransform(zoom: number): string {
	return `scale(${normalizeDisplayZoom(zoom)})`;
}

export function scaledSceneSize(scene: RenderSceneGeometry, zoom: number): { width: number; height: number } {
	const normalizedZoom = normalizeDisplayZoom(zoom);
	return {
		width: scene.width * normalizedZoom,
		height: scene.height * normalizedZoom,
	};
}

export function calculateZoomTransition(input: ZoomTransitionInput): ZoomTransition {
	const currentZoom = normalizeDisplayZoom(input.currentZoom);
	const zoom = normalizeZoom(input.nextZoom, input.minZoom);
	const canvasLeft = input.canvasLeft ?? 0;
	const canvasTop = input.canvasTop ?? 0;
	const sceneX = (input.scrollLeft + input.pointerX - canvasLeft) / currentZoom;
	const sceneY = (input.scrollTop + input.pointerY - canvasTop) / currentZoom;

	return {
		zoom,
		scrollLeft: canvasLeft + sceneX * zoom - input.pointerX,
		scrollTop: canvasTop + sceneY * zoom - input.pointerY,
		transform: sceneTransform(zoom),
	};
}

/**
 * Fits the complete rendered scene and centers it inside viewport-sized pan
 * margins. The automatic floor is intentionally lower than manual zoom.
 */
export function calculateFitTransition(
	scene: RenderSceneGeometry,
	viewportWidth: number,
	viewportHeight: number,
	padding = FIT_PADDING,
): FitTransition {
	const availableWidth = Math.max(1, viewportWidth - padding * 2);
	const availableHeight = Math.max(1, viewportHeight - padding * 2);
	const zoom = normalizeDisplayZoom(Math.min(
		availableWidth / Math.max(1, scene.width),
		availableHeight / Math.max(1, scene.height),
		MAX_ZOOM,
	));
	const scaledWidth = scene.width * zoom;
	const scaledHeight = scene.height * zoom;

	return {
		zoom,
		// The canvas starts after one full viewport of pan space.
		scrollLeft: viewportWidth + scaledWidth / 2 - viewportWidth / 2,
		scrollTop: viewportHeight + scaledHeight / 2 - viewportHeight / 2,
	};
}

export function stageSizeWithPanSpace(
	scene: RenderSceneGeometry,
	zoom: number,
	viewportWidth: number,
	viewportHeight: number,
): { width: number; height: number } {
	const scaled = scaledSceneSize(scene, zoom);
	return {
		width: scaled.width + viewportWidth * 2,
		height: scaled.height + viewportHeight * 2,
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
	canvasLeft = 0,
	canvasTop = 0,
): MinimapGeometry {
	const normalizedZoom = normalizeDisplayZoom(zoom);
	const contentWidth = Math.max(1, scene.width);
	const contentHeight = Math.max(1, scene.height);
	const availableWidth = Math.max(1, minimapWidth - padding * 2);
	const availableHeight = Math.max(1, minimapHeight - padding * 2);
	const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
	const offsetX = (minimapWidth - contentWidth * scale) / 2;
	const offsetY = (minimapHeight - contentHeight * scale) / 2;
	const sceneViewportX = Math.max(0, (scrollLeft - canvasLeft) / normalizedZoom);
	const sceneViewportY = Math.max(0, (scrollTop - canvasTop) / normalizedZoom);
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
