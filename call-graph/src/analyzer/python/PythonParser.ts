import * as Parser from 'web-tree-sitter';
import type { ParseInput, SourceParser } from '../parser';
import type { CallSite, FunctionKind, FunctionNode, ParseDiagnostic, ParsedFile, SourceRange } from '../types';

type SyntaxNode = Parser.Node;

interface Scope {
	qualifiedName: string;
	nodeId: string;
	className?: string;
	isFunction: boolean;
}

export class PythonParser implements SourceParser {
	public readonly languageId = 'python';

	private readonly parser: Parser.Parser;

	private constructor(parser: Parser.Parser) {
		this.parser = parser;
	}

	public static async create(): Promise<PythonParser> {
		await Parser.Parser.init({
			locateFile: () => require.resolve('web-tree-sitter/web-tree-sitter.wasm'),
		});
		const language = await Parser.Language.load(require.resolve('tree-sitter-python/tree-sitter-python.wasm'));
		const parser = new Parser.Parser();
		parser.setLanguage(language);
		return new PythonParser(parser);
	}

	public parse(input: ParseInput): ParsedFile {
		const tree = this.parser.parse(input.source);
		if (!tree) {
			throw new Error('Python parser failed to produce a syntax tree');
		}
		const root = tree.rootNode;
		const nodes: FunctionNode[] = [];
		const callSites: CallSite[] = [];
		const moduleNode = this.createFunctionNode(input.filePath, '<module>', '<module>', 'module', root, root);

		nodes.push(moduleNode);
		this.walkStatements(root, input.filePath, [{ qualifiedName: '<module>', nodeId: moduleNode.id, isFunction: false }], nodes, callSites);

		return {
			languageId: this.languageId,
			filePath: input.filePath,
			nodes,
			callSites,
			edges: [],
			unresolvedCalls: [],
			externalCalls: [],
			diagnostics: this.collectDiagnostics(root),
		};
	}

	private walkStatements(node: SyntaxNode, filePath: string, scopes: Scope[], nodes: FunctionNode[], callSites: CallSite[]): void {
		for (const child of node.namedChildren) {
			const definition = this.unwrapDecoratedDefinition(child);

			if (definition?.type === 'class_definition') {
				this.visitClass(definition, filePath, scopes, nodes, callSites);
				continue;
			}

			if (definition?.type === 'function_definition') {
				this.visitFunction(definition, filePath, scopes, nodes, callSites);
				continue;
			}

			this.collectCalls(child, scopes.at(-1)?.nodeId, callSites);
			this.walkNestedDefinitions(child, filePath, scopes, nodes, callSites);
		}
	}

	private walkNestedDefinitions(node: SyntaxNode, filePath: string, scopes: Scope[], nodes: FunctionNode[], callSites: CallSite[]): void {
		for (const child of node.namedChildren) {
			const definition = this.unwrapDecoratedDefinition(child);

			if (definition?.type === 'class_definition') {
				this.visitClass(definition, filePath, scopes, nodes, callSites);
				continue;
			}

			if (definition?.type === 'function_definition') {
				this.visitFunction(definition, filePath, scopes, nodes, callSites);
				continue;
			}

			this.walkNestedDefinitions(child, filePath, scopes, nodes, callSites);
		}
	}

	private visitClass(node: SyntaxNode, filePath: string, scopes: Scope[], nodes: FunctionNode[], callSites: CallSite[]): void {
		const nameNode = node.childForFieldName('name');
		if (!nameNode) {
			return;
		}

		const qualifiedName = this.joinQualifiedName(scopes, nameNode.text);
		const classNode = this.createFunctionNode(filePath, nameNode.text, qualifiedName, 'class', node, nameNode);
		nodes.push(classNode);

		const body = node.childForFieldName('body');
		if (body) {
			this.walkStatements(body, filePath, [...scopes, { qualifiedName, nodeId: classNode.id, className: nameNode.text, isFunction: false }], nodes, callSites);
		}
	}

	private visitFunction(node: SyntaxNode, filePath: string, scopes: Scope[], nodes: FunctionNode[], callSites: CallSite[]): void {
		const nameNode = node.childForFieldName('name');
		if (!nameNode) {
			return;
		}

		const qualifiedName = this.joinQualifiedName(scopes, nameNode.text);
		const functionNode = this.createFunctionNode(filePath, nameNode.text, qualifiedName, this.getFunctionKind(node, scopes), node, nameNode);
		nodes.push(functionNode);

		const body = node.childForFieldName('body');
		if (body) {
			this.walkStatements(body, filePath, [...scopes, { qualifiedName, nodeId: functionNode.id, className: scopes.at(-1)?.className, isFunction: true }], nodes, callSites);
		}
	}

	private collectCalls(node: SyntaxNode, callerId: string | undefined, callSites: CallSite[]): void {
		if (!callerId) {
			return;
		}

		if (node.type === 'call') {
			const functionNode = node.childForFieldName('function');
			const expression = functionNode?.text ?? node.text;
			callSites.push({
				id: `${callerId}:call:${node.startPosition.row + 1}:${node.startPosition.column + 1}:${expression}`,
				callerId,
				expression,
				calleeName: this.lastName(expression),
				range: toRange(node),
			});
			return;
		}

		for (const child of node.namedChildren) {
			const definition = this.unwrapDecoratedDefinition(child);
			if (definition?.type === 'function_definition' || definition?.type === 'class_definition') {
				continue;
			}
			this.collectCalls(child, callerId, callSites);
		}
	}

	private collectDiagnostics(root: SyntaxNode): ParseDiagnostic[] {
		const diagnostics: ParseDiagnostic[] = [];
		this.walkAll(root, node => {
			if (node.isError || node.isMissing) {
				diagnostics.push({
					message: node.isMissing ? `Missing ${node.type}` : `Syntax error: ${node.type}`,
					range: toRange(node),
					severity: 'error',
				});
			}
		});
		return diagnostics;
	}

	private walkAll(node: SyntaxNode, visit: (node: SyntaxNode) => void): void {
		visit(node);
		for (const child of node.children) {
			this.walkAll(child, visit);
		}
	}

	private unwrapDecoratedDefinition(node: SyntaxNode): SyntaxNode | undefined {
		if (node.type !== 'decorated_definition') {
			return node;
		}
		return node.childForFieldName('definition') ?? undefined;
	}

	private getFunctionKind(node: SyntaxNode, scopes: Scope[]): FunctionKind {
		const isAsync = node.children.some(child => child.type === 'async');
		const parentScope = scopes.at(-1);
		const insideClass = Boolean(parentScope?.className && !parentScope.isFunction);
		const insideFunction = scopes.some(scope => scope.isFunction);

		if (insideClass) {
			return isAsync ? 'asyncMethod' : 'method';
		}
		if (insideFunction) {
			return isAsync ? 'asyncNestedFunction' : 'nestedFunction';
		}
		return isAsync ? 'asyncFunction' : 'function';
	}

	private createFunctionNode(filePath: string, name: string, qualifiedName: string, kind: FunctionKind, node: SyntaxNode, selectionNode: SyntaxNode): FunctionNode {
		const id = `${filePath}:${kind}:${qualifiedName}`;
		return {
			id,
			identity: {
				filePath,
				qualifiedName,
				kind,
			},
			name,
			qualifiedName,
			kind,
			range: toRange(node),
			selectionRange: toRange(selectionNode),
		};
	}

	private joinQualifiedName(scopes: Scope[], name: string): string {
		const parent = scopes.at(-1)?.qualifiedName;
		return parent && parent !== '<module>' ? `${parent}.${name}` : name;
	}

	private lastName(expression: string): string {
		return expression.split('.').at(-1) ?? expression;
	}
}

function toRange(node: SyntaxNode): SourceRange {
	return {
		start: {
			line: node.startPosition.row + 1,
			character: node.startPosition.column + 1,
		},
		end: {
			line: node.endPosition.row + 1,
			character: node.endPosition.column + 1,
		},
	};
}
