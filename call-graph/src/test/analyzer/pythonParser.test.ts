import * as assert from 'assert';
import { PythonParser } from '../../analyzer';

suite('PythonParser', () => {
	let parser: PythonParser;

	suiteSetup(async () => {
		parser = await PythonParser.create();
	});

	test('returns stable module and function identities', () => {
		const parsed = parser.parse({
			filePath: 'pkg/example.py',
			source: [
				'def first():',
				'    return second()',
				'',
				'def second():',
				'    return 1',
				'',
			].join('\n'),
		});

		assert.deepStrictEqual(
			parsed.nodes.map(node => [node.qualifiedName, node.kind, node.id]),
			[
				['<module>', 'module', 'pkg/example.py:module:<module>'],
				['first', 'function', 'pkg/example.py:function:first'],
				['second', 'function', 'pkg/example.py:function:second'],
			],
		);
		assert.deepStrictEqual(parsed.nodes[1].range.start, { line: 1, character: 1 });
		assert.deepStrictEqual(parsed.nodes[1].selectionRange.start, { line: 1, character: 5 });
	});

	test('parses async functions, classes, methods, and nested functions', () => {
		const parsed = parser.parse({
			filePath: 'pkg/service.py',
			source: [
				'async def load():',
				'    pass',
				'',
				'class Service:',
				'    def send(self):',
				'        def build_payload():',
				'            return load()',
				'        return build_payload()',
				'',
				'    async def flush(self):',
				'        pass',
				'',
			].join('\n'),
		});

		assert.deepStrictEqual(
			parsed.nodes.map(node => [node.qualifiedName, node.kind]),
			[
				['<module>', 'module'],
				['load', 'asyncFunction'],
				['Service', 'class'],
				['Service.send', 'method'],
				['Service.send.build_payload', 'nestedFunction'],
				['Service.flush', 'asyncMethod'],
			],
		);
		assert.deepStrictEqual(
			parsed.callSites.map(site => [site.callerId, site.expression, site.calleeName]),
			[
				['pkg/service.py:nestedFunction:Service.send.build_payload', 'load', 'load'],
				['pkg/service.py:method:Service.send', 'build_payload', 'build_payload'],
			],
		);
	});

	test('attaches top-level calls to module node', () => {
		const parsed = parser.parse({
			filePath: 'script.py',
			source: [
				'def main():',
				'    pass',
				'',
				'main()',
				'',
			].join('\n'),
		});

		assert.deepStrictEqual(
			parsed.callSites.map(site => [site.callerId, site.expression]),
			[['script.py:module:<module>', 'main']],
		);
	});

	test('collects import bindings for direct, module, relative, and wildcard imports', () => {
		const parsed = parser.parse({
			filePath: 'pkg/feature.py',
			source: [
				'import helpers',
				'import pkg.service as service',
				'from pkg.worker import run as run_worker',
				'from .local import build',
				'from .plugins import *',
				'',
			].join('\n'),
		});

		assert.deepStrictEqual(
			parsed.imports.map(binding => {
				if (binding.kind === 'module') {
					return [binding.kind, binding.moduleName, binding.localName];
				}
				if (binding.kind === 'direct') {
					return [binding.kind, binding.moduleName, binding.importedName, binding.localName, binding.relativeLevel];
				}
				return [binding.kind, binding.moduleName, binding.relativeLevel];
			}),
			[
				['module', 'helpers', 'helpers'],
				['module', 'pkg.service', 'service'],
				['direct', 'pkg.worker', 'run', 'run_worker', 0],
				['direct', 'local', 'build', 'build', 1],
				['wildcard', 'plugins', 1],
			],
		);
	});

	test('reports syntax diagnostics without throwing', () => {
		const parsed = parser.parse({
			filePath: 'broken.py',
			source: 'def broken(:\n    pass\n',
		});

		assert.ok(parsed.nodes.some(node => node.qualifiedName === '<module>'));
		assert.ok(parsed.diagnostics.length > 0);
		assert.ok(parsed.diagnostics.every(diagnostic => diagnostic.severity === 'error'));
	});
});
