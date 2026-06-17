export type FunctionKind = 'module' | 'function' | 'asyncFunction' | 'class' | 'method' | 'asyncMethod' | 'nestedFunction' | 'asyncNestedFunction';

export interface SourcePosition {
	line: number;
	character: number;
}

export interface SourceRange {
	start: SourcePosition;
	end: SourcePosition;
}

export interface FunctionIdentity {
	filePath: string;
	qualifiedName: string;
	kind: FunctionKind;
}

export interface FunctionNode {
	id: string;
	identity: FunctionIdentity;
	name: string;
	qualifiedName: string;
	kind: FunctionKind;
	range: SourceRange;
	selectionRange: SourceRange;
}

export interface CallSite {
	id: string;
	callerId: string;
	expression: string;
	calleeName: string;
	range: SourceRange;
}

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
	edges: GraphEdge[];
	unresolvedCalls: UnresolvedCall[];
	externalCalls: ExternalCall[];
	diagnostics: ParseDiagnostic[];
}
