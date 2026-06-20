import * as assert from 'assert';
import type { GraphModel, GraphNode } from '../../graph/types';
import { createSceneGeometry } from '../../webview/sceneGeometry';

suite('webview scene geometry', () => {
	test('produces deterministic geometry for repeated graph renders', () => {
		const graph = sampleGraph();

		assert.deepStrictEqual(createSceneGeometry(graph), createSceneGeometry(graph));
	});

	test('keeps geometry deterministic when graph input order changes', () => {
		const graph = sampleGraph();
		const reordered = {
			...graph,
			nodes: [...graph.nodes].reverse(),
			edges: [...graph.edges].reverse(),
		};

		assert.deepStrictEqual(createSceneGeometry(graph), createSceneGeometry(reordered));
	});

	test('aligns edge endpoints with fixed node boundaries', () => {
		const scene = createSceneGeometry(sampleGraph());
		const nodes = new Map(scene.nodes.map(node => [node.id, node]));

		for (const edge of scene.edges) {
			const source = nodes.get(edge.id === 'caller-focus' ? 'caller' : 'focus');
			const target = nodes.get(edge.id === 'caller-focus' ? 'focus' : 'callee');
			assert.ok(source);
			assert.ok(target);
			assert.deepStrictEqual(edge.start, {
				x: source.x + source.width,
				y: source.y + source.height / 2,
			});
			assert.deepStrictEqual(edge.end, {
				x: target.x,
				y: target.y + target.height / 2,
			});
		}
	});

	test('keeps node dimensions stable when edges change', () => {
		const graph = sampleGraph();
		const withoutEdges = { ...graph, edges: [] };

		assert.deepStrictEqual(
			createSceneGeometry(graph).nodes,
			createSceneGeometry(withoutEdges).nodes,
		);
	});

	test('assigns each depth to its own horizontal level and stacks only within a level', () => {
		const graph = sampleGraph();
		graph.nodes.push(
			node('caller-two-a', 'caller-two-a', 'caller', 2),
			node('caller-two-b', 'caller-two-b', 'caller', 2),
			node('callee-two', 'callee-two', 'callee', 2),
		);
		const scene = createSceneGeometry(graph);
		const nodes = new Map(scene.nodes.map(candidate => [candidate.id, candidate]));
		const callerOne = requiredNode(nodes, 'caller');
		const callerTwoA = requiredNode(nodes, 'caller-two-a');
		const callerTwoB = requiredNode(nodes, 'caller-two-b');
		const focus = requiredNode(nodes, 'focus');
		const calleeOne = requiredNode(nodes, 'callee');
		const calleeTwo = requiredNode(nodes, 'callee-two');

		assert.strictEqual(callerOne.level, -1);
		assert.strictEqual(callerTwoA.level, -2);
		assert.strictEqual(focus.level, 0);
		assert.strictEqual(calleeOne.level, 1);
		assert.strictEqual(calleeTwo.level, 2);
		assert.notStrictEqual(callerOne.x, callerTwoA.x);
		assert.strictEqual(callerTwoA.x, callerTwoB.x);
		assert.notStrictEqual(callerTwoA.y, callerTwoB.y);
		assert.notStrictEqual(calleeOne.x, calleeTwo.x);
	});

	test('grows scene width only for the side with increased depth', () => {
		const base = sampleGraph();
		const deeperCaller = {
			...base,
			nodes: [...base.nodes, node('caller-two', 'caller-two', 'caller', 2)],
		};
		const deeperCallee = {
			...base,
			nodes: [...base.nodes, node('callee-two', 'callee-two', 'callee', 2)],
		};
		const baseScene = createSceneGeometry(base);
		const callerScene = createSceneGeometry(deeperCaller);
		const calleeScene = createSceneGeometry(deeperCallee);
		const baseFocus = requiredNode(new Map(baseScene.nodes.map(candidate => [candidate.id, candidate])), 'focus');
		const callerFocus = requiredNode(new Map(callerScene.nodes.map(candidate => [candidate.id, candidate])), 'focus');
		const calleeFocus = requiredNode(new Map(calleeScene.nodes.map(candidate => [candidate.id, candidate])), 'focus');

		assert.ok(callerScene.width > baseScene.width);
		assert.ok(calleeScene.width > baseScene.width);
		assert.ok(callerFocus.x > baseFocus.x);
		assert.strictEqual(calleeFocus.x, baseFocus.x);
		assert.strictEqual(callerScene.width - baseScene.width, calleeScene.width - baseScene.width);
	});

	test('keeps edge endpoints aligned across multiple depth columns', () => {
		const graph = sampleGraph();
		graph.nodes.push(
			node('caller-two', 'caller-two', 'caller', 2),
			node('callee-two', 'callee-two', 'callee', 2),
		);
		graph.edges.push(
			edge('caller-two-caller', 'caller-two', 'caller'),
			edge('callee-callee-two', 'callee', 'callee-two'),
		);
		const scene = createSceneGeometry(graph);
		const nodes = new Map(scene.nodes.map(candidate => [candidate.id, candidate]));

		for (const edge of scene.edges) {
			const graphEdge = graph.edges.find(candidate => candidate.id === edge.id);
			assert.ok(graphEdge);
			const source = requiredNode(nodes, graphEdge.from);
			const target = requiredNode(nodes, graphEdge.to);
			assert.deepStrictEqual(edge.start, {
				x: source.x + source.width,
				y: source.y + source.height / 2,
			});
			assert.deepStrictEqual(edge.end, {
				x: target.x,
				y: target.y + target.height / 2,
			});
		}
	});
});

function sampleGraph(): GraphModel {
	return {
		focusNodeId: 'focus',
		includeTests: true,
		nodes: [
			node('caller', 'caller', 'caller', 1),
			node('focus', 'focus', 'focus', 0),
			node('callee', 'callee', 'callee', 1),
		],
		edges: [
			edge('caller-focus', 'caller', 'focus'),
			edge('focus-callee', 'focus', 'callee'),
		],
		limitReached: false,
		omittedDirectRelationshipCount: 0,
		largeGraphWarning: false,
		callerDepth: 1,
		calleeDepth: 1,
		maxDepth: 8,
		nodeLimit: 30,
	};
}

function edge(id: string, from: string, to: string): GraphModel['edges'][number] {
	return {
		id,
		from,
		to,
		label: 'direct call',
		callCount: 1,
		callSites: [],
	};
}

function node(id: string, label: string, role: GraphNode['role'], depth: number): GraphNode {
	return {
		id,
		label,
		filePath: `${id}.py`,
		line: 1,
		role,
		depth,
	};
}

function requiredNode(
	nodes: Map<string, ReturnType<typeof createSceneGeometry>['nodes'][number]>,
	id: string,
): ReturnType<typeof createSceneGeometry>['nodes'][number] {
	const found = nodes.get(id);
	assert.ok(found);
	return found;
}
