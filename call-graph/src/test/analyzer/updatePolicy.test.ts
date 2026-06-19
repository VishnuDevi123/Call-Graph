import * as assert from 'assert';
import type { ParsedFile } from '../../analyzer';
import { chooseParsedFileUpdate } from '../../indexing/updatePolicy';

suite('chooseParsedFileUpdate', () => {
	test('accepts a parsed file without errors', () => {
		const candidate = parsedFile('current.py');
		const result = chooseParsedFileUpdate(parsedFile('previous.py'), candidate);

		assert.strictEqual(result.accepted, true);
		assert.strictEqual(result.parsedFile, candidate);
		assert.strictEqual(result.retainedLastGood, false);
	});

	test('retains the previous parsed file when the candidate has errors', () => {
		const previous = parsedFile('current.py');
		const candidate = parsedFile('current.py', true);
		const result = chooseParsedFileUpdate(previous, candidate);

		assert.strictEqual(result.accepted, false);
		assert.strictEqual(result.parsedFile, previous);
		assert.strictEqual(result.retainedLastGood, true);
	});

	test('reports no retained graph when the first parse has errors', () => {
		const result = chooseParsedFileUpdate(undefined, parsedFile('new.py', true));

		assert.strictEqual(result.accepted, false);
		assert.strictEqual(result.parsedFile, undefined);
		assert.strictEqual(result.retainedLastGood, false);
	});
});

function parsedFile(filePath: string, hasError = false): ParsedFile {
	return {
		languageId: 'python',
		filePath,
		nodes: [],
		callSites: [],
		imports: [],
		edges: [],
		unresolvedCalls: [],
		externalCalls: [],
		diagnostics: hasError
			? [{
				message: 'syntax error',
				range: {
					start: { line: 1, character: 1 },
					end: { line: 1, character: 1 },
				},
				severity: 'error',
			}]
			: [],
	};
}
