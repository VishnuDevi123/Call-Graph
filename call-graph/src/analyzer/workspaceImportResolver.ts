import * as path from 'path';
import type { CallSite, FunctionNode, GraphEdge, ImportBinding, ParsedFile, UnresolvedCall } from './types';

const IMPORT_RESOLUTION_REASONS = new Set([
	'workspace direct import',
	'workspace module import',
]);

export function resolveWorkspaceImports(files: ParsedFile[]): ParsedFile[] {
	const moduleIndex = buildModuleIndex(files);
	const filesByPath = new Map(files.map(file => [file.filePath, file]));
	const importEdgesByFile = new Map<string, GraphEdge[]>();
	const resolvedCallIdsByFile = new Map<string, Set<string>>();
	const externalCallsByFile = new Map<string, ParsedFile['externalCalls']>();

	for (const file of files) {
		const directImports = file.imports.filter((binding): binding is Extract<ImportBinding, { kind: 'direct' }> => binding.kind === 'direct');
		const moduleImports = file.imports.filter((binding): binding is Extract<ImportBinding, { kind: 'module' }> => binding.kind === 'module');

		for (const callSite of file.callSites) {
			const directImport = directImports.find(binding => binding.localName === callSite.expression);
			if (directImport) {
				const moduleName = resolveImportModuleName(file.filePath, directImport.moduleName, directImport.relativeLevel);
				const moduleFile = moduleIndex.get(moduleName);
				if (!moduleFile) {
					addExternal(externalCallsByFile, file.filePath, callSite, moduleName);
					addResolvedCall(resolvedCallIdsByFile, file.filePath, callSite.id);
					continue;
				}

				const target = findTopLevelTarget(moduleFile, directImport.importedName);
				if (target) {
					addImportEdge(importEdgesByFile, file.filePath, callSite, target, 'workspace direct import');
					addResolvedCall(resolvedCallIdsByFile, file.filePath, callSite.id);
				}
				continue;
			}

			const moduleImport = moduleImports
				.map(binding => ({ binding, importedName: getImportedMemberName(callSite.expression, binding) }))
				.find(match => Boolean(match.importedName));
			if (!moduleImport || !moduleImport.importedName) {
				continue;
			}

			const moduleFile = moduleIndex.get(moduleImport.binding.moduleName);
			if (!moduleFile) {
				addExternal(externalCallsByFile, file.filePath, callSite, moduleImport.binding.moduleName);
				addResolvedCall(resolvedCallIdsByFile, file.filePath, callSite.id);
				continue;
			}

			const target = findTopLevelTarget(moduleFile, moduleImport.importedName);
			if (target) {
				addImportEdge(importEdgesByFile, file.filePath, callSite, target, 'workspace module import');
				addResolvedCall(resolvedCallIdsByFile, file.filePath, callSite.id);
			}
		}
	}

	return files.map(file => {
		const resolvedCallIds = resolvedCallIdsByFile.get(file.filePath) ?? new Set<string>();
		const importEdges = importEdgesByFile.get(file.filePath) ?? [];
		const externalCalls = externalCallsByFile.get(file.filePath) ?? [];
		const ownNodes = file.nodes.filter(node => node.identity.filePath === file.filePath);
		const importedNodes = new Map<string, FunctionNode>();
		for (const edge of importEdges) {
			const node = findNode(filesByPath, edge.toId);
			if (node && node.identity.filePath !== file.filePath) {
				importedNodes.set(node.id, node);
			}
		}
		return {
			...file,
			edges: [
				...file.edges.filter(edge => !IMPORT_RESOLUTION_REASONS.has(edge.reason)),
				...importEdges,
			],
			unresolvedCalls: file.unresolvedCalls.filter(call => !resolvedCallIds.has(call.id.replace(/:unresolved$/, ''))),
			externalCalls: [
				...file.externalCalls.filter(call => !call.id.endsWith(':external')),
				...externalCalls,
			],
			nodes: [
				...ownNodes,
				...importedNodes.values(),
			],
		};
	});
}

function buildModuleIndex(files: ParsedFile[]): Map<string, ParsedFile> {
	const moduleIndex = new Map<string, ParsedFile>();
	for (const file of files) {
		for (const moduleName of getModuleNames(file.filePath)) {
			moduleIndex.set(moduleName, file);
		}
	}
	return moduleIndex;
}

function getModuleNames(filePath: string): string[] {
	const withoutExtension = filePath.replace(/\.py$/, '');
	const normalized = withoutExtension.split(path.sep).join('/');
	if (normalized.endsWith('/__init__')) {
		return [normalized.slice(0, -'/__init__'.length).replace(/\//g, '.')];
	}
	return [normalized.replace(/\//g, '.')];
}

function resolveImportModuleName(filePath: string, moduleName: string, relativeLevel: number): string {
	if (relativeLevel === 0) {
		return moduleName;
	}

	const packageParts = currentPackageParts(filePath);
	const baseParts = packageParts.slice(0, Math.max(0, packageParts.length - relativeLevel + 1));
	return [...baseParts, ...moduleName.split('.').filter(Boolean)].join('.');
}

function currentPackageParts(filePath: string): string[] {
	const moduleName = getModuleNames(filePath)[0] ?? '';
	const parts = moduleName.split('.').filter(Boolean);
	if (filePath.endsWith('__init__.py')) {
		return parts;
	}
	return parts.slice(0, -1);
}

function findTopLevelTarget(parsedFile: ParsedFile, name: string): FunctionNode | undefined {
	const candidates = parsedFile.nodes.filter(node =>
		(node.kind === 'function' || node.kind === 'asyncFunction' || node.kind === 'class')
		&& node.qualifiedName === name,
	);
	return candidates.length === 1 ? candidates[0] : undefined;
}

function getImportedMemberName(expression: string, binding: Extract<ImportBinding, { kind: 'module' }>): string | undefined {
	if (!expression.startsWith(`${binding.localName}.`)) {
		return undefined;
	}

	let memberPath = expression.slice(binding.localName.length + 1);
	const boundSuffix = binding.moduleName.split('.').slice(1).join('.');
	if (boundSuffix && memberPath.startsWith(`${boundSuffix}.`)) {
		memberPath = memberPath.slice(boundSuffix.length + 1);
	}
	return /^[A-Za-z_][A-Za-z0-9_]*$/.test(memberPath) ? memberPath : undefined;
}

function addImportEdge(edgeGroups: Map<string, GraphEdge[]>, filePath: string, callSite: CallSite, target: FunctionNode, reason: string): void {
	const edges = edgeGroups.get(filePath) ?? [];
	const edgeId = `${callSite.callerId}->${target.id}:${reason}`;
	const existingEdge = edges.find(edge => edge.id === edgeId);
	if (existingEdge) {
		existingEdge.callSites.push(callSite);
	} else {
		edges.push({
			id: edgeId,
			fromId: callSite.callerId,
			toId: target.id,
			callSites: [callSite],
			reason,
		});
	}
	edgeGroups.set(filePath, edges);
}

function addResolvedCall(resolvedCallIdsByFile: Map<string, Set<string>>, filePath: string, callSiteId: string): void {
	const callIds = resolvedCallIdsByFile.get(filePath) ?? new Set<string>();
	callIds.add(callSiteId);
	resolvedCallIdsByFile.set(filePath, callIds);
}

function addExternal(externalCallsByFile: Map<string, ParsedFile['externalCalls']>, filePath: string, callSite: CallSite, moduleName: string): void {
	const externalCalls = externalCallsByFile.get(filePath) ?? [];
	externalCalls.push({
		id: `${callSite.id}:external`,
		callerId: callSite.callerId,
		expression: callSite.expression,
		range: callSite.range,
		moduleName,
	});
	externalCallsByFile.set(filePath, externalCalls);
}

function findNode(filesByPath: Map<string, ParsedFile>, nodeId: string): FunctionNode | undefined {
	for (const file of filesByPath.values()) {
		const node = file.nodes.find(candidate => candidate.id === nodeId);
		if (node) {
			return node;
		}
	}
	return undefined;
}
