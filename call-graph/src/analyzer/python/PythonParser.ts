import * as Parser from 'web-tree-sitter';
import type { ParseInput, SourceParser } from '../parser';
import type { CallSite, FunctionKind, FunctionNode, ImportBinding, ParseDiagnostic, ParsedFile, SourceRange } from '../types';

type SyntaxNode = Parser.Node;

interface Scope {
	qualifiedName: string;
	nodeId: string;
	className?: string;
	isFunction: boolean;
	localTypes?: Map<string, LocalTypeBinding>;
	receiverClassName?: string;
	allowsClsReceiver?: boolean;
}

interface LocalTypeBinding {
	className: string;
	kind: 'localConstruction' | 'localAnnotation';
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
		const imports: ImportBinding[] = [];
		const moduleNode = this.createFunctionNode(input.filePath, '<module>', '<module>', 'module', root, root);

		nodes.push(moduleNode);
		this.walkStatements(root, input.filePath, [{ qualifiedName: '<module>', nodeId: moduleNode.id, isFunction: false }], nodes, callSites, imports);

		return {
			languageId: this.languageId,
			filePath: input.filePath,
			nodes,
			callSites,
			imports,
			edges: [],
			unresolvedCalls: [],
			externalCalls: [],
			diagnostics: this.collectDiagnostics(root),
		};
	}

	private walkStatements(node: SyntaxNode, filePath: string, scopes: Scope[], nodes: FunctionNode[], callSites: CallSite[], imports: ImportBinding[]): void {
		for (const child of node.namedChildren) {
			const definition = this.unwrapDecoratedDefinition(child);

			if (definition?.type === 'class_definition') {
				this.visitClass(definition, filePath, scopes, nodes, callSites, imports);
				continue;
			}

			if (definition?.type === 'function_definition') {
				this.visitFunction(definition, child, filePath, scopes, nodes, callSites, imports);
				continue;
			}

			if (child.type === 'import_statement' || child.type === 'import_from_statement') {
				imports.push(...this.parseImportBindings(child));
				continue;
			}

			this.invalidateNestedLocalBindings(child, scopes.at(-1));
			this.updateLocalTypeBindings(child, scopes.at(-1));
			this.collectCalls(child, scopes.at(-1), callSites);
			this.walkNestedDefinitions(child, filePath, scopes, nodes, callSites, imports);
		}
	}

	private walkNestedDefinitions(node: SyntaxNode, filePath: string, scopes: Scope[], nodes: FunctionNode[], callSites: CallSite[], imports: ImportBinding[]): void {
		for (const child of node.namedChildren) {
			const definition = this.unwrapDecoratedDefinition(child);

			if (definition?.type === 'class_definition') {
				this.visitClass(definition, filePath, scopes, nodes, callSites, imports);
				continue;
			}

			if (definition?.type === 'function_definition') {
				this.visitFunction(definition, child, filePath, scopes, nodes, callSites, imports);
				continue;
			}

			this.walkNestedDefinitions(child, filePath, scopes, nodes, callSites, imports);
		}
	}

	private visitClass(node: SyntaxNode, filePath: string, scopes: Scope[], nodes: FunctionNode[], callSites: CallSite[], imports: ImportBinding[]): void {
		const nameNode = node.childForFieldName('name');
		if (!nameNode) {
			return;
		}

		const qualifiedName = this.joinQualifiedName(scopes, nameNode.text);
		const classNode = this.createFunctionNode(filePath, nameNode.text, qualifiedName, 'class', node, nameNode);
		nodes.push(classNode);

		const body = node.childForFieldName('body');
		if (body) {
			this.walkStatements(body, filePath, [...scopes, { qualifiedName, nodeId: classNode.id, className: nameNode.text, isFunction: false }], nodes, callSites, imports);
		}
	}

	private visitFunction(node: SyntaxNode, declarationNode: SyntaxNode, filePath: string, scopes: Scope[], nodes: FunctionNode[], callSites: CallSite[], imports: ImportBinding[]): void {
		const nameNode = node.childForFieldName('name');
		if (!nameNode) {
			return;
		}

		const qualifiedName = this.joinQualifiedName(scopes, nameNode.text);
		const kind = this.getFunctionKind(node, scopes);
		const functionNode = this.createFunctionNode(filePath, nameNode.text, qualifiedName, kind, node, nameNode);
		nodes.push(functionNode);

		const body = node.childForFieldName('body');
		if (body) {
			this.walkStatements(body, filePath, [...scopes, {
				qualifiedName,
				nodeId: functionNode.id,
				className: scopes.at(-1)?.className,
				isFunction: true,
				localTypes: new Map(),
				receiverClassName: kind === 'method' || kind === 'asyncMethod' ? scopes.at(-1)?.className : undefined,
				allowsClsReceiver: this.hasDecorator(declarationNode, 'classmethod'),
			}], nodes, callSites, imports);
		}
	}

	private parseImportBindings(node: SyntaxNode): ImportBinding[] {
		const text = node.text.trim();
		if (node.type === 'import_statement') {
			const match = /^import\s+(.+)$/.exec(text);
			if (!match) {
				return [];
			}
			return match[1].split(',')
				.map(part => /^([A-Za-z_][A-Za-z0-9_.]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/.exec(part.trim()))
				.filter((match): match is RegExpExecArray => Boolean(match))
				.map(match => ({
					kind: 'module',
					moduleName: match[1],
					localName: match[2] ?? match[1].split('.')[0],
					range: toRange(node),
				}));
		}

		const match = /^from\s+([.A-Za-z_][A-Za-z0-9_.]*)\s+import\s+(.+)$/.exec(text);
		if (!match) {
			return [];
		}

		const moduleExpression = match[1];
		const relativeLevel = moduleExpression.match(/^\.+/)?.[0].length ?? 0;
		const moduleName = moduleExpression.slice(relativeLevel);
		const bindings: ImportBinding[] = [];
		for (const part of match[2].split(',').map(part => part.trim())) {
			if (part === '*') {
				bindings.push({
					kind: 'wildcard',
					moduleName,
					relativeLevel,
					range: toRange(node),
				});
				continue;
			}

			const importMatch = /^([A-Za-z_][A-Za-z0-9_]*)(?:\s+as\s+([A-Za-z_][A-Za-z0-9_]*))?$/.exec(part);
			if (importMatch) {
				bindings.push({
					kind: 'direct',
					moduleName,
					importedName: importMatch[1],
					localName: importMatch[2] ?? importMatch[1],
					relativeLevel,
					range: toRange(node),
				});
			}
		}
		return bindings;
	}

	private collectCalls(node: SyntaxNode, scope: Scope | undefined, callSites: CallSite[]): void {
		if (!scope) {
			return;
		}

		if (node.type === 'call') {
			const functionNode = node.childForFieldName('function');
			const expression = functionNode?.text ?? node.text;
			callSites.push({
				id: `${scope.nodeId}:call:${node.startPosition.row + 1}:${node.startPosition.column + 1}:${expression}`,
				callerId: scope.nodeId,
				expression,
				calleeName: this.lastName(expression),
				range: toRange(node),
				receiver: this.getReceiverHint(functionNode, scope),
			});
			return;
		}

		for (const child of node.namedChildren) {
			const definition = this.unwrapDecoratedDefinition(child);
			if (definition?.type === 'function_definition' || definition?.type === 'class_definition') {
				continue;
			}
			this.collectCalls(child, scope, callSites);
		}
	}

	private updateLocalTypeBindings(node: SyntaxNode, scope: Scope | undefined): void {
		if (!scope?.isFunction || !scope.localTypes) {
			return;
		}

		if (node.type === 'expression_statement') {
			const expression = node.namedChildren[0];
			if (expression) {
				this.updateLocalTypeBindings(expression, scope);
			}
			return;
		}

		if (node.type === 'assignment') {
			const target = node.childForFieldName('left');
			const value = node.childForFieldName('right');
			if (!target) {
				return;
			}

			if (target.type === 'attribute') {
				const receiver = target.childForFieldName('object');
				if (receiver?.type === 'identifier') {
					scope.localTypes.delete(receiver.text);
				}
				return;
			}

			if (target.type !== 'identifier') {
				return;
			}

			const className = this.getConstructedClassName(value);
			if (className) {
				scope.localTypes.set(target.text, { className, kind: 'localConstruction' });
			} else if (!value) {
				const annotationName = this.getSimpleTypeName(node.childForFieldName('type'));
				if (annotationName) {
					scope.localTypes.set(target.text, { className: annotationName, kind: 'localAnnotation' });
				} else {
					scope.localTypes.delete(target.text);
				}
			} else {
				scope.localTypes.delete(target.text);
			}
			return;
		}

		if (node.type === 'typed_parameter' || node.type === 'typed_default_parameter') {
			return;
		}

		if (node.type === 'annotated_assignment') {
			const target = node.childForFieldName('left');
			const annotation = node.childForFieldName('type');
			const value = node.childForFieldName('right');
			if (!target || target.type !== 'identifier') {
				return;
			}

			if (value) {
				const constructedClass = this.getConstructedClassName(value);
				if (!constructedClass) {
					scope.localTypes.delete(target.text);
					return;
				}
				scope.localTypes.set(target.text, { className: constructedClass, kind: 'localConstruction' });
				return;
			}

			const annotationName = this.getSimpleTypeName(annotation);
			if (annotationName) {
				scope.localTypes.set(target.text, { className: annotationName, kind: 'localAnnotation' });
			} else {
				scope.localTypes.delete(target.text);
			}
		}
	}

	private invalidateNestedLocalBindings(node: SyntaxNode, scope: Scope | undefined): void {
		if (!scope?.localTypes || node.type === 'assignment' || node.type === 'annotated_assignment') {
			return;
		}

		for (const child of node.namedChildren) {
			if (child.type === 'function_definition' || child.type === 'class_definition' || child.type === 'decorated_definition') {
				continue;
			}
			if (child.type === 'assignment' || child.type === 'annotated_assignment') {
				const target = child.childForFieldName('left');
				if (target?.type === 'identifier') {
					scope.localTypes.delete(target.text);
				} else if (target?.type === 'attribute') {
					const receiver = target.childForFieldName('object');
					if (receiver?.type === 'identifier') {
						scope.localTypes.delete(receiver.text);
					}
				}
			}
			this.invalidateNestedLocalBindings(child, scope);
		}
	}

	private getConstructedClassName(node: SyntaxNode | null): string | undefined {
		if (node?.type !== 'call') {
			return undefined;
		}
		const functionNode = node.childForFieldName('function');
		return functionNode?.type === 'identifier' && /^[A-Z][A-Za-z0-9_]*$/.test(functionNode.text)
			? functionNode.text
			: undefined;
	}

	private getSimpleTypeName(node: SyntaxNode | null): string | undefined {
		if (node?.type === 'identifier') {
			return node.text;
		}
		const identifier = node?.namedChildren.length === 1 ? node.namedChildren[0] : undefined;
		return identifier?.type === 'identifier' ? identifier.text : undefined;
	}

	private getReceiverHint(functionNode: SyntaxNode | null, scope: Scope): CallSite['receiver'] {
		if (functionNode?.type !== 'attribute') {
			return undefined;
		}

		const receiverNode = functionNode.childForFieldName('object');
		if (receiverNode?.type !== 'identifier') {
			return undefined;
		}

		if (receiverNode.text === 'self' && scope.receiverClassName) {
			return {
				kind: 'self',
				className: scope.receiverClassName,
			};
		}

		if (receiverNode.text === 'cls' && scope.receiverClassName && scope.allowsClsReceiver) {
			return {
				kind: 'cls',
				className: scope.receiverClassName,
			};
		}

		const localType = scope.localTypes?.get(receiverNode.text);
		return localType ? { kind: localType.kind, className: localType.className } : undefined;
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

	private hasDecorator(node: SyntaxNode, decoratorName: string): boolean {
		if (node.type !== 'decorated_definition') {
			return false;
		}
		return node.namedChildren.some(child =>
			child.type === 'decorator'
			&& child.namedChildren.length === 1
			&& child.namedChildren[0].type === 'identifier'
			&& child.namedChildren[0].text === decoratorName,
		);
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
