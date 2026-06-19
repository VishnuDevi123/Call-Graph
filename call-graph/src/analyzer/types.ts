export type FunctionKind = 'module' | 'function' | 'asyncFunction' | 'class' | 'method' | 'asyncMethod' | 'nestedFunction' | 'asyncNestedFunction';

// represents a position of the souce code with line and character numbers
export interface SourcePosition {
	line: number;
	character: number;
}

// represents a range in the source code defined by a start and end position
export interface SourceRange {
	start: SourcePosition;
	end: SourcePosition;
}

// uniquely identifies a function in the codebase by its file path, qualified name, and kind
export interface FunctionIdentity {
	filePath: string;
	qualifiedName: string;
	kind: FunctionKind;
}

// represents a function node in the call graph, including its identity, name, qualified name, kind, and source code range
export interface FunctionNode {
	id: string;
	identity: FunctionIdentity;
	name: string;
	qualifiedName: string;
	kind: FunctionKind;
	range: SourceRange;
	selectionRange: SourceRange;
}

// represents a call site in the code, including its id, caller function id, the expression being called, the callee's name, and its source code range. It may also include information about the receiver of the call if applicable.
export interface CallSite {
	id: string;
	callerId: string;
	expression: string;
	calleeName: string;
	range: SourceRange;
	receiver?: {
		kind: 'self' | 'cls' | 'localConstruction' | 'localAnnotation';
		className: string;
	};
}

// represents an import binding in the code, which can be a module import, a direct import of a specific name from a module, or a wildcard import of all names from a module. Each binding includes information about the module being imported, the local name used in the importing file, and the source code range of the import statement.
export type ImportBinding =
	| {
		kind: 'module';
		moduleName: string;
		localName: string;
		range: SourceRange;
	}
	| {
		kind: 'direct';
		moduleName: string;
		importedName: string;
		localName: string;
		relativeLevel: number;
		range: SourceRange;
	}
	| {
		kind: 'wildcard';
		moduleName: string;
		relativeLevel: number;
		range: SourceRange;
	};

export interface GraphEdge {
	id: string;
	fromId: string;
	toId: string;
	callSites: CallSite[];
	reason: string;
}

export interface UnresolvedCall {
	id: string;
	callerId: string;
	expression: string;
	range: SourceRange;
	reason: string;
}

export interface ExternalCall {
	id: string;
	callerId: string;
	expression: string;
	range: SourceRange;
	moduleName?: string;
}

export interface ParseDiagnostic {
	message: string;
	range: SourceRange;
	severity: 'error' | 'warning';
}

export interface ParsedFile {
	languageId: string;
	filePath: string;
	nodes: FunctionNode[];
	callSites: CallSite[];
	imports: ImportBinding[];
	edges: GraphEdge[];
	unresolvedCalls: UnresolvedCall[];
	externalCalls: ExternalCall[];
	diagnostics: ParseDiagnostic[];
}
