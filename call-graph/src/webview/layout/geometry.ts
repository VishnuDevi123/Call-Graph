/**
 * Pure geometry primitives shared by the layout worker and unit tests.
 * Rectangles use top-left coordinates and non-negative dimensions.
 */
export interface Point {
	x: number;
	y: number;
}

export interface Rectangle {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Segment {
	start: Point;
	end: Point;
}

export interface SceneBounds {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
}

const GEOMETRY_EPSILON = 1e-9;

export function rectangleCenter(rectangle: Rectangle): Point {
	return {
		x: rectangle.x + rectangle.width / 2,
		y: rectangle.y + rectangle.height / 2,
	};
}

/**
 * Finds where a ray from the rectangle center toward `target` exits the rectangle.
 * A coincident target has no direction, so the center is returned unchanged.
 */
export function rectangleBoundaryIntersection(rectangle: Rectangle, target: Point): Point {
	const center = rectangleCenter(rectangle);
	const deltaX = target.x - center.x;
	const deltaY = target.y - center.y;
	if (Math.abs(deltaX) < GEOMETRY_EPSILON && Math.abs(deltaY) < GEOMETRY_EPSILON) {
		return center;
	}

	const horizontalScale = Math.abs(deltaX) < GEOMETRY_EPSILON
		? Number.POSITIVE_INFINITY
		: rectangle.width / 2 / Math.abs(deltaX);
	const verticalScale = Math.abs(deltaY) < GEOMETRY_EPSILON
		? Number.POSITIVE_INFINITY
		: rectangle.height / 2 / Math.abs(deltaY);
	const scale = Math.min(horizontalScale, verticalScale);

	return {
		x: center.x + deltaX * scale,
		y: center.y + deltaY * scale,
	};
}

export function expandRectangle(rectangle: Rectangle, padding: number): Rectangle {
	return {
		x: rectangle.x - padding,
		y: rectangle.y - padding,
		width: rectangle.width + padding * 2,
		height: rectangle.height + padding * 2,
	};
}

/**
 * Reports whether a closed segment touches or enters a rectangle.
 * Boundary contact counts as an intersection, which is required for obstacle clearance.
 */
export function segmentIntersectsRectangle(segment: Segment, rectangle: Rectangle): boolean {
	if (pointInsideRectangle(segment.start, rectangle) || pointInsideRectangle(segment.end, rectangle)) {
		return true;
	}

	const topLeft = { x: rectangle.x, y: rectangle.y };
	const topRight = { x: rectangle.x + rectangle.width, y: rectangle.y };
	const bottomRight = { x: rectangle.x + rectangle.width, y: rectangle.y + rectangle.height };
	const bottomLeft = { x: rectangle.x, y: rectangle.y + rectangle.height };

	return segmentsIntersect(segment, { start: topLeft, end: topRight })
		|| segmentsIntersect(segment, { start: topRight, end: bottomRight })
		|| segmentsIntersect(segment, { start: bottomRight, end: bottomLeft })
		|| segmentsIntersect(segment, { start: bottomLeft, end: topLeft });
}

export function sceneBounds(rectangles: Rectangle[], padding = 0): SceneBounds {
	if (rectangles.length === 0) {
		return {
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
			width: 0,
			height: 0,
		};
	}

	const left = Math.min(...rectangles.map(rectangle => rectangle.x)) - padding;
	const top = Math.min(...rectangles.map(rectangle => rectangle.y)) - padding;
	const right = Math.max(...rectangles.map(rectangle => rectangle.x + rectangle.width)) + padding;
	const bottom = Math.max(...rectangles.map(rectangle => rectangle.y + rectangle.height)) + padding;

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function pointInsideRectangle(point: Point, rectangle: Rectangle): boolean {
	return point.x >= rectangle.x - GEOMETRY_EPSILON
		&& point.x <= rectangle.x + rectangle.width + GEOMETRY_EPSILON
		&& point.y >= rectangle.y - GEOMETRY_EPSILON
		&& point.y <= rectangle.y + rectangle.height + GEOMETRY_EPSILON;
}

function segmentsIntersect(left: Segment, right: Segment): boolean {
	const first = orientation(left.start, left.end, right.start);
	const second = orientation(left.start, left.end, right.end);
	const third = orientation(right.start, right.end, left.start);
	const fourth = orientation(right.start, right.end, left.end);

	if (first !== second && third !== fourth) {
		return true;
	}

	return first === 0 && pointOnSegment(right.start, left)
		|| second === 0 && pointOnSegment(right.end, left)
		|| third === 0 && pointOnSegment(left.start, right)
		|| fourth === 0 && pointOnSegment(left.end, right);
}

function orientation(first: Point, second: Point, third: Point): -1 | 0 | 1 {
	const crossProduct = (second.y - first.y) * (third.x - second.x)
		- (second.x - first.x) * (third.y - second.y);
	if (Math.abs(crossProduct) < GEOMETRY_EPSILON) {
		return 0;
	}
	return crossProduct > 0 ? 1 : -1;
}

function pointOnSegment(point: Point, segment: Segment): boolean {
	return point.x >= Math.min(segment.start.x, segment.end.x) - GEOMETRY_EPSILON
		&& point.x <= Math.max(segment.start.x, segment.end.x) + GEOMETRY_EPSILON
		&& point.y >= Math.min(segment.start.y, segment.end.y) - GEOMETRY_EPSILON
		&& point.y <= Math.max(segment.start.y, segment.end.y) + GEOMETRY_EPSILON;
}
