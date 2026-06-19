export const PAN_START_THRESHOLD = 5;
export const PAN_EXCLUDED_TARGET_SELECTOR = 'button, input, select, details, summary, .minimap';

interface PanState {
	pointerId: number;
	startX: number;
	startY: number;
	scrollLeft: number;
	scrollTop: number;
}

export function crossedPanThreshold(deltaX: number, deltaY: number): boolean {
	return Math.hypot(deltaX, deltaY) >= PAN_START_THRESHOLD;
}

export function shouldStartPan(button: number, targetIsExcluded: boolean): boolean {
	return button === 0 && !targetIsExcluded;
}

export function installPanning(viewport: HTMLElement, onPan: () => void): void {
	let candidate: PanState | undefined;
	let active: PanState | undefined;

	viewport.addEventListener('pointerdown', event => {
		if (!shouldStartPan(event.button, isExcludedTarget(event.target))) {
			return;
		}
		candidate = panState(event, viewport);
	});

	viewport.addEventListener('pointermove', event => {
		const pan = active ?? candidate;
		if (!pan || pan.pointerId !== event.pointerId) {
			return;
		}
		const deltaX = event.clientX - pan.startX;
		const deltaY = event.clientY - pan.startY;
		if (!active && !crossedPanThreshold(deltaX, deltaY)) {
			return;
		}
		if (!active) {
			active = pan;
			candidate = undefined;
			viewport.setPointerCapture(event.pointerId);
			viewport.classList.add('panning');
		}
		event.preventDefault();
		viewport.scrollLeft = active.scrollLeft - deltaX;
		viewport.scrollTop = active.scrollTop - deltaY;
		onPan();
	});

	const endPan = (event: PointerEvent): void => {
		if (candidate?.pointerId === event.pointerId) {
			candidate = undefined;
		}
		if (active?.pointerId !== event.pointerId) {
			return;
		}
		if (viewport.hasPointerCapture(event.pointerId)) {
			viewport.releasePointerCapture(event.pointerId);
		}
		active = undefined;
		viewport.classList.remove('panning');
	};

	viewport.addEventListener('pointerup', endPan);
	viewport.addEventListener('pointercancel', endPan);
	viewport.addEventListener('lostpointercapture', event => {
		if (active?.pointerId === event.pointerId) {
			active = undefined;
			viewport.classList.remove('panning');
		}
	});
}

function isExcludedTarget(target: EventTarget | null): boolean {
	return target instanceof Element && Boolean(target.closest(PAN_EXCLUDED_TARGET_SELECTOR));
}

function panState(event: PointerEvent, viewport: HTMLElement): PanState {
	return {
		pointerId: event.pointerId,
		startX: event.clientX,
		startY: event.clientY,
		scrollLeft: viewport.scrollLeft,
		scrollTop: viewport.scrollTop,
	};
}
