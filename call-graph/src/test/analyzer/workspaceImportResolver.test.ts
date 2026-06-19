import * as assert from 'assert';
import { PythonParser, resolveSameFileCalls, resolveWorkspaceImports } from '../../analyzer';
import type { FunctionNode, ParsedFile } from '../../analyzer';
import { buildFocusedGraph } from '../../graph/buildFocusedGraph';

suite('workspace import resolution', () => {
	let parser: PythonParser;

	suiteSetup(async () => {
		parser = await PythonParser.create();
	});

	test('resolves direct imports across workspace files', () => {
		const files = resolveWorkspaceImports([
			parse('pkg/app.py', [
				'from pkg.worker import run',
				'',
				'def main():',
				'    run()',
			]),
			parse('pkg/worker.py', [
				'def run():',
				'    pass',
			]),
		]);
		const app = file(files, 'pkg/app.py');

		assert.deepStrictEqual(edgeSummary(files), [
			['main', 'run', 'workspace direct import'],
		]);
		assert.strictEqual(app.unresolvedCalls.some(call => call.expression === 'run'), false);
	});

	test('resolves module imports and relative imports across workspace files', () => {
		const files = resolveWorkspaceImports([
			parse('pkg/app.py', [
				'import pkg.worker',
				'from .local import build',
				'',
				'def main():',
				'    pkg.worker.run()',
				'    build()',
			]),
			parse('pkg/worker.py', [
				'def run():',
				'    pass',
			]),
			parse('pkg/local.py', [
				'def build():',
				'    pass',
			]),
		]);

		assert.deepStrictEqual(edgeSummary(files), [
			['main', 'run', 'workspace module import'],
			['main', 'build', 'workspace direct import'],
		]);
	});

	test('classifies imports outside the workspace as external calls', () => {
		const files = resolveWorkspaceImports([
			parse('app.py', [
				'import requests',
				'from external_lib import send',
				'',
				'def main():',
				'    requests.get()',
				'    send()',
			]),
		]);
		const app = file(files, 'app.py');

		assert.deepStrictEqual(
			app.externalCalls.map(call => [call.expression, call.moduleName]),
			[
				['requests.get', 'requests'],
				['send', 'external_lib'],
			],
		);
		assert.strictEqual(app.edges.length, 0);
	});

	test('keeps wildcard and dynamic imports unresolved', () => {
		const files = resolveWorkspaceImports([
			parse('app.py', [
				'from pkg.worker import *',
				'',
				'def main():',
				'    run()',
				'    __import__("pkg.worker").run()',
			]),
			parse('pkg/worker.py', [
				'def run():',
				'    pass',
			]),
		]);
		const app = file(files, 'app.py');

		assert.strictEqual(app.edges.length, 0);
		assert.ok(app.unresolvedCalls.some(call => call.expression === 'run'));
		assert.ok(app.unresolvedCalls.some(call => call.expression === '__import__("pkg.worker").run'));
	});

	test('focused graph includes imported callees and cross-file callers', () => {
		const files = resolveWorkspaceImports([
			parse('pkg/app.py', [
				'from pkg.worker import run',
				'',
				'def main():',
				'    run()',
			]),
			parse('pkg/worker.py', [
				'def run():',
				'    pass',
			]),
		]);
		const appMain = node(files, 'pkg/app.py', 'main');
		const workerRun = node(files, 'pkg/worker.py', 'run');

		assert.deepStrictEqual(
			buildFocusedGraph(files, appMain).nodes.map(graphNode => [graphNode.label, graphNode.role]),
			[
				['<module>', 'caller'],
				['main', 'focus'],
				['run', 'callee'],
			],
		);
		assert.deepStrictEqual(
			buildFocusedGraph(files, workerRun).nodes.map(graphNode => [graphNode.label, graphNode.role]),
			[
				['main', 'caller'],
				['run', 'focus'],
			],
		);
	});

	function parse(filePath: string, lines: string[]): ParsedFile {
		return resolveSameFileCalls(parser.parse({
			filePath,
			source: `${lines.join('\n')}\n`,
		}));
	}
});

function edgeSummary(files: ParsedFile[]): Array<[string | undefined, string | undefined, string]> {
	const nodesById = new Map(files.flatMap(parsedFile => parsedFile.nodes).map(node => [node.id, node]));
	return files.flatMap(parsedFile => parsedFile.edges)
		.map(edge => [
			nodesById.get(edge.fromId)?.qualifiedName,
			nodesById.get(edge.toId)?.qualifiedName,
			edge.reason,
		]);
}

function file(files: ParsedFile[], filePath: string): ParsedFile {
	const parsedFile = files.find(file => file.filePath === filePath);
	assert.ok(parsedFile);
	return parsedFile;
}

function node(files: ParsedFile[], filePath: string, qualifiedName: string): FunctionNode {
	const foundNode = file(files, filePath).nodes.find(node => node.qualifiedName === qualifiedName);
	assert.ok(foundNode);
	return foundNode;
}
