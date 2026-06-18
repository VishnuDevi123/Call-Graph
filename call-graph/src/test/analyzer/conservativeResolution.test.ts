import * as assert from 'assert';
import { PythonParser, resolveSameFileCalls } from '../../analyzer';

suite('conservative Python resolution', () => {
	let parser: PythonParser;

	suiteSetup(async () => {
		parser = await PythonParser.create();
	});

	test('resolves self and cls calls within the same class', () => {
		const parsed = resolve([
			'class Service:',
			'    def run(self):',
			'        self.send()',
			'',
			'    @classmethod',
			'    def create(cls):',
			'        cls.validate()',
			'',
			'    def send(self):',
			'        pass',
			'',
			'    @classmethod',
			'    def validate(cls):',
			'        pass',
		]);

		assert.deepStrictEqual(
			parsed.edges.map(edge => [nodeName(parsed, edge.fromId), nodeName(parsed, edge.toId), edge.reason]),
			[
				['Service.run', 'Service.send', 'same-class self call (Service)'],
				['Service.create', 'Service.validate', 'same-class cls call (Service)'],
			],
		);
	});

	test('resolves local construction and annotation receiver types', () => {
		const parsed = resolve([
			'class EmailService:',
			'    def send(self):',
			'        pass',
			'',
			'def constructed():',
			'    service = EmailService()',
			'    service.send()',
			'',
			'def annotated():',
			'    service: EmailService',
			'    service.send()',
		]);

		assert.deepStrictEqual(
			parsed.edges.map(edge => [nodeName(parsed, edge.fromId), nodeName(parsed, edge.toId), edge.reason]),
			[
				['constructed', 'EmailService.send', 'local construction inferred as EmailService'],
				['annotated', 'EmailService.send', 'local annotation inferred as EmailService'],
			],
		);
		assert.ok(parsed.unresolvedCalls.some(call => call.expression === 'EmailService'));
	});

	test('does not resolve dynamic, ambiguous, or reassigned receivers', () => {
		const parsed = resolve([
			'class EmailService:',
			'    def send(self):',
			'        pass',
			'',
			'def run(factory, injected):',
			'    service = EmailService()',
			'    service = factory()',
			'    service.send()',
			'    injected.send()',
			'    getattr(service, "send")()',
			'    other = EmailService()',
			'    other.send = patched',
			'    other.send()',
			'    service.send = patched',
			'',
			'def conditional_reassignment(flag):',
			'    service = EmailService()',
			'    if flag:',
			'        service = injected',
			'    service.send()',
		]);

		assert.strictEqual(parsed.edges.length, 0);
		assert.ok(parsed.unresolvedCalls.some(call => call.expression === 'service.send'));
		assert.ok(parsed.unresolvedCalls.some(call => call.expression === 'injected.send'));
		assert.ok(parsed.unresolvedCalls.some(call => call.expression === 'getattr(service, "send")'));
		assert.ok(parsed.unresolvedCalls.some(call => call.expression === 'other.send'));
		const conditional = parsed.nodes.find(node => node.qualifiedName === 'conditional_reassignment');
		assert.ok(parsed.unresolvedCalls.some(call => call.callerId === conditional?.id && call.expression === 'service.send'));
	});

	function resolve(lines: string[]) {
		return resolveSameFileCalls(parser.parse({
			filePath: 'service.py',
			source: `${lines.join('\n')}\n`,
		}));
	}
});

function nodeName(parsed: ReturnType<typeof resolveSameFileCalls>, nodeId: string): string | undefined {
	return parsed.nodes.find(node => node.id === nodeId)?.qualifiedName;
}
