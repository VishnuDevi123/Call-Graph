import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileName } from '../../webview/client/graphRenderer';
import {
	crossedPanThreshold,
	PAN_EXCLUDED_TARGET_SELECTOR,
	PAN_START_THRESHOLD,
	shouldStartPan,
} from '../../webview/client/panning';

suite('webview canvas interaction and graph labels', () => {
	test('keeps tiny movement as no-op and starts panning at threshold', () => {
		assert.strictEqual(PAN_START_THRESHOLD, 5);
		assert.strictEqual(crossedPanThreshold(3, 3), false);
		assert.strictEqual(crossedPanThreshold(3, 4), true);
		assert.strictEqual(shouldStartPan(0, false), true);
		assert.strictEqual(shouldStartPan(1, false), false);
	});

	test('excludes interactive graph targets and minimap from pan starts', () => {
		for (const selector of ['button', 'input', 'select', 'details', 'summary', '.minimap']) {
			assert.ok(PAN_EXCLUDED_TARGET_SELECTOR.includes(selector));
		}
		assert.strictEqual(shouldStartPan(0, true), false);
	});

	test('uses pointer capture and local viewport scrolling without extension messages', () => {
		const source = clientSource('panning.ts');

		assert.ok(source.includes('viewport.setPointerCapture(event.pointerId)'));
		assert.ok(source.includes('viewport.releasePointerCapture(event.pointerId)'));
		assert.ok(source.includes("viewport.classList.add('panning')"));
		assert.ok(source.includes('viewport.scrollLeft = active.scrollLeft - deltaX'));
		assert.ok(source.includes('viewport.scrollTop = active.scrollTop - deltaY'));
		assert.strictEqual(source.includes('postMessage'), false);
	});

	test('formats node metadata with filename only', () => {
		assert.strictEqual(fileName('/workspace/pkg/service.py'), 'service.py');
		assert.strictEqual(fileName('C:\\workspace\\service.py'), 'service.py');
	});

	test('does not render edge reason labels', () => {
		const source = clientSource('edges.ts');

		assert.strictEqual(source.includes('edge-label'), false);
		assert.strictEqual(source.includes('graphEdge.label'), false);
	});
});

function clientSource(file: string): string {
	return fs.readFileSync(path.join(process.cwd(), 'src', 'webview', 'client', file), 'utf8');
}
