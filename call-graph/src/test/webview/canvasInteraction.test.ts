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

	test('does not render graph role headings or unresolved and external sections', () => {
		const source = clientSource('graphRenderer.ts');

		assert.strictEqual(source.includes("'Callers'"), false);
		assert.strictEqual(source.includes("'Focused Function'"), false);
		assert.strictEqual(source.includes("'Callees'"), false);
		assert.strictEqual(source.includes("'Unresolved calls'"), false);
		assert.strictEqual(source.includes("'External calls'"), false);
		assert.strictEqual(source.includes('renderDetails'), false);
	});

	test('renders measured complete labels without role groups or fake empty states', () => {
		const renderer = clientSource('graphRenderer.ts');
		const measurement = clientSource('textMeasurement.ts');
		const styles = fs.readFileSync(path.join(process.cwd(), 'src', 'webview', 'styles.css'), 'utf8');

		assert.ok(renderer.includes('geometry.width'));
		assert.ok(renderer.includes('geometry.height'));
		assert.ok(renderer.includes('name.textContent = node.label'));
		assert.ok(renderer.includes('`${fileName(node.filePath)}:${node.line}`'));
		assert.ok(measurement.includes('getBoundingClientRect()'));
		assert.ok(styles.includes('font-size: 12pt'));
		assert.ok(styles.includes('font-size: 9pt'));
		assert.ok(styles.includes('--call-graph-node-radius: 4px'));
		assert.ok(styles.includes('white-space: nowrap'));
		assert.ok(styles.includes('--call-graph-caller: #6366f1'));
		assert.ok(styles.includes('--call-graph-focus: #f43f5e'));
		assert.ok(styles.includes('--call-graph-callee: #14b8a6'));
		assert.strictEqual(renderer.includes('empty-state'), false);
		assert.strictEqual(renderer.includes("textContent = 'None'"), false);
		assert.strictEqual(renderer.includes("className = 'group'"), false);
	});

	test('uses straight normal vectors, reciprocal curves, and endpoint-joined ten-point arrows', () => {
		const edges = clientSource('edges.ts');

		assert.ok(edges.includes("return `M ${edge.start.x} ${edge.start.y} L ${edge.end.x} ${edge.end.y}`"));
		assert.ok(edges.includes(' Q '));
		assert.ok(edges.includes("marker.setAttribute('refX', '10')"));
		assert.ok(edges.includes("marker.setAttribute('markerWidth', '10')"));
		assert.ok(edges.includes("marker.setAttribute('markerHeight', '10')"));
		assert.strictEqual(edges.includes(' C '), false);
	});
});

function clientSource(file: string): string {
	return fs.readFileSync(path.join(process.cwd(), 'src', 'webview', 'client', file), 'utf8');
}
