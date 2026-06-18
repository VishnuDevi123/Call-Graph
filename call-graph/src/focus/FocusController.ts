import * as vscode from 'vscode';
import type { FunctionNode, ParsedFile, SourceRange } from '../analyzer';
import { buildFocusedGraph } from '../graph/buildFocusedGraph';
import { WorkspaceIndexService } from '../indexing';
import { CallGraphPanel } from '../webview/CallGraphPanel';

const FOCUS_UPDATE_DELAY_MS = 250;
const FUNCTION_LIKE_KINDS = new Set<FunctionNode['kind']>([
	'function',
	'asyncFunction',
	'method',
	'asyncMethod',
	'nestedFunction',
	'asyncNestedFunction',
]);

export interface FocusUpdate {
	node: FunctionNode;
	parsedFile: ParsedFile;
	source: 'function' | 'module';
}

export class FocusController implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private debounceTimer: ReturnType<typeof setTimeout> | undefined;
	private lastFocusedNodeId: string | undefined;

	public constructor(private readonly workspaceIndex: WorkspaceIndexService) {
		this.disposables.push(
			vscode.window.onDidChangeTextEditorSelection(event => {
				if (event.textEditor === vscode.window.activeTextEditor) {
					this.scheduleFocusUpdate();
				}
			}),
			vscode.window.onDidChangeActiveTextEditor(() => {
				this.scheduleFocusUpdate();
			}),
		);
	}

	public async focusActiveEditor(options: { refreshIfMissing: boolean; warnWhenOutsideFunction: boolean; forcePublish?: boolean }): Promise<FocusUpdate | undefined> {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !this.isPythonDocument(editor.document)) {
			if (options.warnWhenOutsideFunction) {
				void vscode.window.showInformationMessage('Open a Python file and place the cursor inside a function or method before focusing the Call Graph.');
			}
			return undefined;
		}

		let parsedFile = this.workspaceIndex.getParsedFile(editor.document.uri);
		if (!parsedFile && options.refreshIfMissing) {
			await this.workspaceIndex.refresh();
			parsedFile = this.workspaceIndex.getParsedFile(editor.document.uri);
		}

		if (!parsedFile) {
			if (options.warnWhenOutsideFunction) {
				void vscode.window.showInformationMessage('Refresh the Call Graph index before focusing this Python file.');
			}
			return undefined;
		}

		const focus = this.findFocus(parsedFile, editor.selection.active);
		if (!focus) {
			return undefined;
		}

		if (options.warnWhenOutsideFunction && focus.source !== 'function') {
			void vscode.window.showInformationMessage('Place the cursor inside a function or method body/name to open a focused Call Graph.');
		}

		this.publishFocus(focus, Boolean(options.forcePublish));
		return focus;
	}

	public async navigateToNode(nodeId: string): Promise<void> {
		const indexedNode = this.workspaceIndex.getNode(nodeId);
		if (!indexedNode) {
			void vscode.window.showWarningMessage('The selected Call Graph node is no longer available. Refresh the index and try again.');
			return;
		}

		await this.revealSource(indexedNode.uri, indexedNode.node);
		this.publishFocus({
			node: indexedNode.node,
			parsedFile: indexedNode.parsedFile,
			source: indexedNode.node.kind === 'module' ? 'module' : 'function',
		}, true);
	}

	public async revealCurrentFocus(): Promise<void> {
		if (!this.lastFocusedNodeId) {
			return;
		}

		const indexedNode = this.workspaceIndex.getNode(this.lastFocusedNodeId);
		if (!indexedNode) {
			void vscode.window.showWarningMessage('The focused Call Graph node is no longer available. Refresh the index and try again.');
			return;
		}

		await this.revealSource(indexedNode.uri, indexedNode.node);
	}

	public dispose(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = undefined;
		}

		while (this.disposables.length > 0) {
			const disposable = this.disposables.pop();
			if (disposable) {
				disposable.dispose();
			}
		}
	}

	private scheduleFocusUpdate(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = undefined;
			void this.focusActiveEditor({
				refreshIfMissing: false,
				warnWhenOutsideFunction: false,
			});
		}, FOCUS_UPDATE_DELAY_MS);
	}

	private publishFocus(focus: FocusUpdate, forcePublish: boolean): void {
		if (!CallGraphPanel.currentPanel) {
			return;
		}

		if (!forcePublish && focus.node.id === this.lastFocusedNodeId) {
			return;
		}

		this.lastFocusedNodeId = focus.node.id;
		CallGraphPanel.currentPanel?.updateGraph(buildFocusedGraph(focus.parsedFile, focus.node));
	}

	private async revealSource(uri: vscode.Uri, node: FunctionNode): Promise<void> {
		const document = await vscode.workspace.openTextDocument(uri);
		const selectionRange = toVsCodeRange(node.selectionRange);
		const editor = await vscode.window.showTextDocument(document, {
			viewColumn: vscode.ViewColumn.One,
			preserveFocus: false,
			preview: true,
			selection: node.kind === 'module'
				? new vscode.Range(selectionRange.start, selectionRange.start)
				: selectionRange,
		});
		editor.revealRange(toVsCodeRange(node.range), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
	}

	private findFocus(parsedFile: ParsedFile, position: vscode.Position): FocusUpdate | undefined {
		const functionNode = parsedFile.nodes
			.filter(node => FUNCTION_LIKE_KINDS.has(node.kind))
			.filter(node => containsPosition(node.range, position))
			.sort((left, right) => rangeSize(left.range) - rangeSize(right.range))[0];

		if (functionNode) {
			return {
				node: functionNode,
				parsedFile,
				source: 'function',
			};
		}

		const moduleNode = parsedFile.nodes.find(node => node.kind === 'module');
		if (!moduleNode) {
			return undefined;
		}

		return {
			node: moduleNode,
			parsedFile,
			source: 'module',
		};
	}

	private isPythonDocument(document: vscode.TextDocument): boolean {
		return document.languageId === 'python' || document.uri.fsPath.endsWith('.py');
	}
}

function containsPosition(range: SourceRange, position: vscode.Position): boolean {
	const line = position.line + 1;
	const character = position.character + 1;

	if (line < range.start.line || line > range.end.line) {
		return false;
	}
	if (line === range.start.line && character < range.start.character) {
		return false;
	}
	if (line === range.end.line && character > range.end.character) {
		return false;
	}
	return true;
}

function rangeSize(range: SourceRange): number {
	const lineSpan = range.end.line - range.start.line;
	const characterSpan = range.end.character - range.start.character;
	return lineSpan * 10000 + characterSpan;
}

function toVsCodeRange(range: SourceRange): vscode.Range {
	return new vscode.Range(
		Math.max(0, range.start.line - 1),
		Math.max(0, range.start.character - 1),
		Math.max(0, range.end.line - 1),
		Math.max(0, range.end.character - 1),
	);
}
