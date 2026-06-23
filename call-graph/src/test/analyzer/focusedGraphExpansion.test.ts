import * as assert from 'assert';
import { PythonParser, resolveSameFileCalls } from '../../analyzer';
import type { FunctionNode, ParsedFile } from '../../analyzer';
import { buildFocusedGraph } from '../../graph/buildFocusedGraph';
import { GraphSessionState } from '../../graph/GraphSessionState';

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
		assert.strictEqual(graph.nodeLimit, 30);
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
			['focus', 'upstream'],
			['upstream', 'focus'],
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
		assert.strictEqual(sizeLimited.omittedDirectRelationshipCount, 1);
	});

	test('always includes test-file relationships in the V1 graph', () => {
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

		const graph = buildFocusedGraph([product, tests], run);

		assert.strictEqual(graph.nodes.some(graphNode => graphNode.label === 'test_run'), true);
	});

	test('does not add module context to a callerless function', () => {
		const parsed = parse([
			'def focus():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'));

		assert.deepStrictEqual(labelsByRole(graph.nodes), [
			['focus', 'focus', 0],
		]);
	});

	test('keeps truthful module relationships and supports module focus', () => {
		const parsed = parse([
			'focus()',
			'',
			'def caller():',
			'    focus()',
			'',
			'def focus():',
			'    callee()',
			'',
			'def callee():',
			'    pass',
		]);
		const focusedFunction = buildFocusedGraph([parsed], node(parsed, 'focus'));
		const focusedModule = buildFocusedGraph([parsed], node(parsed, '<module>'));

		assert.deepStrictEqual(labelsByRole(focusedFunction.nodes), [
			['<module>', 'caller', 1],
			['caller', 'caller', 1],
			['focus', 'focus', 0],
			['callee', 'callee', 1],
		]);
		assert.deepStrictEqual(labelsByRole(focusedModule.nodes), [
			['<module>', 'focus', 0],
			['focus', 'callee', 1],
		]);
	});

	test('prioritizes every direct relationship before deeper nodes', () => {
		const parsed = parse([
			'def focus():',
			'    first()',
			'    second()',
			'',
			'def first():',
			'    deeper()',
			'',
			'def second():',
			'    pass',
			'',
			'def deeper():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'), {
			calleeDepth: 2,
			nodeLimit: 3,
		});

		assert.strictEqual(graph.nodes.some(graphNode => graphNode.label === 'first'), true);
		assert.strictEqual(graph.nodes.some(graphNode => graphNode.label === 'second'), true);
		assert.strictEqual(graph.nodes.some(graphNode => graphNode.label === 'deeper'), false);
		assert.strictEqual(graph.omittedDirectRelationshipCount, 0);
	});

	test('truncates direct relationships deterministically and reports omissions', () => {
		const parsed = parse([
			'def caller():',
			'    focus()',
			'',
			'def focus():',
			'    first()',
			'    second()',
			'',
			'def first():',
			'    pass',
			'',
			'def second():',
			'    pass',
		]);
		const reordered = {
			...parsed,
			nodes: [...parsed.nodes].reverse(),
			edges: [...parsed.edges].reverse(),
		};
		const options = { nodeLimit: 3 };
		const normal = buildFocusedGraph([parsed], node(parsed, 'focus'), options);
		const reversed = buildFocusedGraph([reordered], node(reordered, 'focus'), options);

		assert.deepStrictEqual(normal.nodes, reversed.nodes);
		assert.deepStrictEqual(normal.edges, reversed.edges);
		assert.strictEqual(normal.nodes.length, 3);
		assert.strictEqual(normal.omittedDirectRelationshipCount, 1);
	});

	test('retains edge call count and source locations', () => {
		const parsed = parse([
			'def focus():',
			'    callee()',
			'    callee()',
			'',
			'def callee():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'));
		const edge = graph.edges[0];

		assert.ok(edge);
		assert.strictEqual(edge.callCount, 2);
		assert.strictEqual(edge.callSites.length, 2);
		assert.deepStrictEqual(edge.callSites.map(callSite => callSite.expression), ['callee', 'callee']);
		assert.deepStrictEqual(edge.callSites.map(callSite => callSite.filePath), ['graph.py', 'graph.py']);
		assert.deepStrictEqual(edge.callSites.map(callSite => callSite.range.start.line), [2, 3]);
	});

	test('classifies both directions of a reciprocal relationship explicitly', () => {
		const parsed = parse([
			'def focus():',
			'    peer()',
			'',
			'def peer():',
			'    focus()',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'), {
			callerDepth: 2,
			calleeDepth: 2,
		});

		assert.deepStrictEqual(graph.edges.map(edge => edge.type), ['reciprocal', 'reciprocal']);
	});

	test('keeps one-way and self-recursive relationships normal', () => {
		const parsed = parse([
			'def focus():',
			'    focus()',
			'    callee()',
			'',
			'def callee():',
			'    pass',
		]);
		const graph = buildFocusedGraph([parsed], node(parsed, 'focus'));

		assert.deepStrictEqual(graph.edges.map(edge => edge.type), ['normal', 'normal']);
	});

	test('preserves directional depths across focus changes within a graph session', () => {
		const state = new GraphSessionState();

		assert.strictEqual(state.callerDepth, 1);
		assert.strictEqual(state.calleeDepth, 1);
		assert.strictEqual(state.setDepth('callers', 4), true);
		assert.strictEqual(state.setDepth('callees', 'max'), true);
		assert.strictEqual(state.setFocusNode('first'), true);
		assert.deepStrictEqual([state.callerDepth, state.calleeDepth], [4, 'max']);
		assert.strictEqual(state.setFocusNode('second'), true);
		assert.deepStrictEqual([state.callerDepth, state.calleeDepth], [4, 'max']);
	});

	test('warns when configured graph requests exceed one hundred nodes', () => {
		const parsed = parse([
			'def focus():',
			'    pass',
		]);

		assert.strictEqual(buildFocusedGraph([parsed], node(parsed, 'focus'), { nodeLimit: 100 }).largeGraphWarning, false);
		assert.strictEqual(buildFocusedGraph([parsed], node(parsed, 'focus'), { nodeLimit: 101 }).largeGraphWarning, true);
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
	return graph.edges
		.map(edge => [nodesById.get(edge.from), nodesById.get(edge.to)] as [string | undefined, string | undefined])
		.sort((left, right) => `${left[0]}:${left[1]}`.localeCompare(`${right[0]}:${right[1]}`));
}
