import * as assert from 'assert';
import {
	rectangleBoundaryIntersection,
	rectangleCenter,
	sceneBounds,
	segmentIntersectsRectangle,
} from '../../webview/layout/geometry';

suite('layout geometry foundation', () => {
	test('calculates rectangle centers and boundary intersections in any direction', () => {
		const rectangle = { x: 10, y: 20, width: 100, height: 60 };

		assert.deepStrictEqual(rectangleCenter(rectangle), { x: 60, y: 50 });
		assert.deepStrictEqual(
			rectangleBoundaryIntersection(rectangle, { x: 200, y: 50 }),
			{ x: 110, y: 50 },
		);
		assert.deepStrictEqual(
			rectangleBoundaryIntersection(rectangle, { x: 60, y: -100 }),
			{ x: 60, y: 20 },
		);
		assert.deepStrictEqual(
			rectangleBoundaryIntersection(rectangle, { x: 160, y: 110 }),
			{ x: 110, y: 80 },
		);
	});

	test('detects segment crossings and boundary contact', () => {
		const rectangle = { x: 20, y: 20, width: 40, height: 30 };

		assert.strictEqual(segmentIntersectsRectangle({
			start: { x: 0, y: 35 },
			end: { x: 100, y: 35 },
		}, rectangle), true);
		assert.strictEqual(segmentIntersectsRectangle({
			start: { x: 0, y: 20 },
			end: { x: 100, y: 20 },
		}, rectangle), true);
		assert.strictEqual(segmentIntersectsRectangle({
			start: { x: 0, y: 0 },
			end: { x: 10, y: 10 },
		}, rectangle), false);
	});

	test('computes complete scene bounds with optional padding', () => {
		assert.deepStrictEqual(sceneBounds([
			{ x: 40, y: 20, width: 30, height: 10 },
			{ x: -10, y: 50, width: 20, height: 40 },
		], 5), {
			left: -15,
			top: 15,
			right: 75,
			bottom: 95,
			width: 90,
			height: 80,
		});
		assert.deepStrictEqual(sceneBounds([]), {
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
			width: 0,
			height: 0,
		});
	});
});
