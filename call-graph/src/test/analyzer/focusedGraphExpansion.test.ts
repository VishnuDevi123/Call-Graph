import * as assert from 'assert';
import { PythonParser, resolveSameFileCalls } from '../../analyzer';
import type { FunctionNode, ParsedFile } from '../../analyzer';
import { buildFocusedGraph } from '../../graph/buildFocusedGraph';

suite('focused graph expansion', () => {
	let parser: PythonParser;

	suiteSetup(async () => {
		parser = await PythonParser.create();
	});

	test('starts with direct callers and callees only', () => {
		const parsed = parse([
			'def caller():',
			'    focus()',
			'',
			'def focus():',
			'    callee()',
			'',
			'def callee():',
			'    leaf()',
			'',
			'def leaf():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'));

		assert.deepStrictEqual(labelsByRole(graph.nodes), [
			['caller', 'caller', 1],
			['focus', 'focus', 0],
			['callee', 'callee', 1],
		]);
		assert.strictEqual(graph.callerDepth, 1);
		assert.strictEqual(graph.calleeDepth, 1);
		assert.strictEqual(graph.nodes.some(graphNode => graphNode.label === 'leaf'), false);
	});

	test('applies callee depth uniformly across all right-side paths', () => {
		const parsed = parse([
			'def focus():',
			'    first()',
			'    other()',
			'',
			'def first():',
			'    second()',
			'',
			'def other():',
			'    other_leaf()',
			'',
			'def second():',
			'    pass',
			'',
			'def other_leaf():',
			'    pass',
		]);
		const expanded = buildFocusedGraph([parsed], node(parsed, 'focus'), {
			calleeDepth: 2,
		});

		assert.deepStrictEqual(labelsByRole(expanded.nodes), [
			['<module>', 'caller', 1],
			['focus', 'focus', 0],
			['first', 'callee', 1],
			['other', 'callee', 1],
			['other_leaf', 'callee', 2],
			['second', 'callee', 2],
		]);
		assert.strictEqual(expanded.callerDepth, 1);
		assert.strictEqual(expanded.calleeDepth, 2);
	});

	test('changes one directional depth without expanding the opposite side', () => {
		const parsed = parse([
			'def root():',
			'    caller()',
			'',
			'def caller():',
			'    focus()',
			'',
			'def focus():',
			'    callee()',
			'',
			'def callee():',
			'    leaf()',
			'',
			'def leaf():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'), {
			callerDepth: 2,
			calleeDepth: 1,
		});

		assert.strictEqual(graph.nodes.some(graphNode => graphNode.label === 'root'), true);
		assert.strictEqual(graph.nodes.some(graphNode => graphNode.label === 'leaf'), false);
	});

	test('max caller depth detects cycles and avoids duplicate nodes', () => {
		const parsed = parse([
			'def focus():',
			'    upstream()',
			'',
			'def upstream():',
			'    focus()',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'), {
			callerDepth: 'max',
			maxDepth: 8,
		});

		assert.deepStrictEqual(labelsByRole(graph.nodes), [
			['upstream', 'caller', 1],
			['focus', 'focus', 0],
		]);
		assert.deepStrictEqual(edgeLabels(graph), [
			['upstream', 'focus'],
			['focus', 'upstream'],
		]);
	});

	test('deduplicates shared expanded descendants', () => {
		const parsed = parse([
			'def focus():',
			'    left()',
			'    right()',
			'',
			'def left():',
			'    shared()',
			'',
			'def right():',
			'    shared()',
			'',
			'def shared():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'), {
			calleeDepth: 2,
		});

		assert.strictEqual(graph.nodes.filter(graphNode => graphNode.label === 'shared').length, 1);
		assert.deepStrictEqual(edgeLabels(graph), [
			['focus', 'left'],
			['focus', 'right'],
			['left', 'shared'],
			['right', 'shared'],
		]);
	});

	test('honors maximum depth and node limit', () => {
		const parsed = parse([
			'def focus():',
			'    one()',
			'    side()',
			'',
			'def one():',
			'    two()',
			'',
			'def two():',
			'    three()',
			'',
			'def three():',
			'    pass',
			'',
			'def side():',
			'    pass',
		]);
		const depthLimited = buildFocusedGraph([parsed], node(parsed, 'focus'), {
			calleeDepth: 'max',
			maxDepth: 2,
		});
		const sizeLimited = buildFocusedGraph([parsed], node(parsed, 'focus'), {
			nodeLimit: 2,
		});

		assert.strictEqual(depthLimited.nodes.some(graphNode => graphNode.label === 'two'), true);
		assert.strictEqual(depthLimited.nodes.some(graphNode => graphNode.label === 'three'), false);
		assert.strictEqual(sizeLimited.limitReached, true);
		assert.strictEqual(sizeLimited.nodes.length, 2);
	});

	test('includes tests by default and hides test-file relationships on request', () => {
		const product = resolveSameFileCalls(parser.parse({
			filePath: 'src/service.py',
			source: 'def run():\n    pass\n',
		}));
		const tests = resolveSameFileCalls(parser.parse({
			filePath: 'tests/test_service.py',
			source: 'def test_run():\n    run()\n',
		}));
		const run = node(product, 'run');
		const testRun = node(tests, 'test_run');
		tests.edges.push({
			id: `${testRun.id}->${run.id}`,
			fromId: testRun.id,
			toId: run.id,
			callSites: [],
			reason: 'direct import',
		});

		const included = buildFocusedGraph([product, tests], run);
		const hidden = buildFocusedGraph([product, tests], run, { includeTests: false });

		assert.strictEqual(included.includeTests, true);
		assert.strictEqual(included.nodes.some(graphNode => graphNode.label === 'test_run'), true);
		assert.strictEqual(hidden.includeTests, false);
		assert.strictEqual(hidden.nodes.some(graphNode => graphNode.label === 'test_run'), false);
	});

	test('uses the existing module as callerless function file context without an edge', () => {
		const parsed = parse([
			'def focus():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'));
		const fileContext = graph.nodes.find(graphNode => graphNode.isFileContext);

		assert.ok(fileContext);
		assert.strictEqual(fileContext.label, '<module>');
		assert.strictEqual(fileContext.role, 'caller');
		assert.strictEqual(fileContext.depth, 1);
		assert.strictEqual(fileContext.filePath, 'graph.py');
		assert.strictEqual(graph.edges.some(edge => edge.from === fileContext.id || edge.to === fileContext.id), false);
	});

	test('does not add file context when a real direct caller exists', () => {
		const parsed = parse([
			'def caller():',
			'    focus()',
			'',
			'def focus():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'));

		assert.strictEqual(graph.nodes.some(graphNode => graphNode.isFileContext), false);
		assert.strictEqual(graph.nodes.some(graphNode => graphNode.label === 'caller'), true);
	});

	function parse(lines: string[]): ParsedFile {
		return resolveSameFileCalls(parser.parse({
			filePath: 'graph.py',
			source: `${lines.join('\n')}\n`,
		}));
	}
});

function node(parsed: ParsedFile, qualifiedName: string): FunctionNode {
	const foundNode = parsed.nodes.find(candidate => candidate.qualifiedName === qualifiedName);
	assert.ok(foundNode);
	return foundNode;
}

function labelsByRole(nodes: ReturnType<typeof buildFocusedGraph>['nodes']): Array<[string, string, number]> {
	return nodes.map(graphNode => [graphNode.label, graphNode.role, graphNode.depth]);
}

function edgeLabels(graph: ReturnType<typeof buildFocusedGraph>): Array<[string | undefined, string | undefined]> {
	const nodesById = new Map(graph.nodes.map(graphNode => [graphNode.id, graphNode.label]));
	return graph.edges.map(edge => [nodesById.get(edge.from), nodesById.get(edge.to)]);
}
