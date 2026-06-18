import * as vscode from 'vscode';
import type { FocusController } from '../focus';
import { CallGraphPanel } from '../webview/CallGraphPanel';
import type { DocumentUpdateResult } from './WorkspaceIndexService';
import { WorkspaceIndexService } from './WorkspaceIndexService';

const UNSAVED_UPDATE_DELAY_MS = 450;

export class DocumentUpdateController implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private debounceTimer: ReturnType<typeof setTimeout> | undefined;
	private updateGeneration = 0;

	public constructor(
		private readonly workspaceIndex: WorkspaceIndexService,
		private readonly focusController: FocusController,
	) {
		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument(document => {
				if (!this.isPythonDocument(document)) {
					return;
				}
				this.cancelPendingUpdate();
				void this.updateDocument(document);
			}),
			vscode.workspace.onDidChangeTextDocument(event => {
				if (event.contentChanges.length === 0 || !event.document.isDirty || !this.isActivePythonDocument(event.document)) {
					return;
				}
				this.scheduleUnsavedUpdate();
			}),
			vscode.window.onDidChangeActiveTextEditor(() => {
				this.cancelPendingUpdate();
			}),
		);
	}

	public dispose(): void {
		this.cancelPendingUpdate();
		while (this.disposables.length > 0) {
			this.disposables.pop()?.dispose();
		}
	}

	private scheduleUnsavedUpdate(): void {
		this.cancelPendingUpdate();
		const generation = this.updateGeneration;
		this.debounceTimer = setTimeout(() => {
			this.debounceTimer = undefined;
			const document = vscode.window.activeTextEditor?.document;
			if (!document || !document.isDirty || !this.isPythonDocument(document)) {
				return;
			}
			void this.updateDocument(document, generation);
		}, UNSAVED_UPDATE_DELAY_MS);
	}

	private async updateDocument(document: vscode.TextDocument, generation = this.updateGeneration): Promise<void> {
		const result = await this.workspaceIndex.updateDocument(document);
		if (generation !== this.updateGeneration || vscode.window.activeTextEditor?.document.uri.toString() !== document.uri.toString()) {
			return;
		}

		this.publishDiagnosticState(result);
		if (result.status === 'updated') {
			await this.focusController.focusActiveEditor({
				refreshIfMissing: false,
				warnWhenOutsideFunction: false,
				forcePublish: true,
			});
		}
	}

	private publishDiagnosticState(result: DocumentUpdateResult): void {
		if (result.status === 'updated') {
			CallGraphPanel.currentPanel?.updateStatus(undefined);
			return;
		}

		const detail = result.retainedLastGood
			? 'Showing the last-good graph.'
			: 'No graph is available for this file yet.';
		CallGraphPanel.currentPanel?.updateStatus(`Python parse error. ${detail}`, 'warning');
	}

	private cancelPendingUpdate(): void {
		this.updateGeneration += 1;
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = undefined;
		}
	}

	private isActivePythonDocument(document: vscode.TextDocument): boolean {
		return vscode.window.activeTextEditor?.document === document && this.isPythonDocument(document);
	}

	private isPythonDocument(document: vscode.TextDocument): boolean {
		return document.languageId === 'python' || document.uri.fsPath.endsWith('.py');
	}
}
