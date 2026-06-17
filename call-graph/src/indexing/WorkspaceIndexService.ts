import * as vscode from 'vscode';
import { PythonParser, resolveSameFileCalls } from '../analyzer';
import type { ParsedFile, ParseDiagnostic } from '../analyzer';

const PYTHON_FILE_GLOB = '**/*.py';
const IGNORED_FOLDER_GLOB = '{**/.venv/**,**/venv/**,**/.tox/**,**/__pycache__/**,**/site-packages/**,**/build/**,**/dist/**}';

export interface WorkspaceIndexSnapshot {
	files: ParsedFile[];
	diagnostics: WorkspaceIndexDiagnostic[];
	indexedFileCount: number;
	discoveredFileCount: number;
	updatedAt: Date | undefined;
}

export interface WorkspaceIndexDiagnostic {
	filePath: string;
	diagnostic: ParseDiagnostic;
}

interface IndexFileResult {
	parsed: ParsedFile;
	hasErrors: boolean;
}

export class WorkspaceIndexService implements vscode.Disposable {
	private readonly lastGoodFiles = new Map<string, ParsedFile>();
	private readonly latestDiagnostics = new Map<string, WorkspaceIndexDiagnostic[]>();
	private parser: PythonParser | undefined;
	private currentRun: Promise<WorkspaceIndexSnapshot> | undefined;
	private updatedAt: Date | undefined;

	public async refresh(): Promise<WorkspaceIndexSnapshot> {
		if (this.currentRun) {
			return this.currentRun;
		}

		this.currentRun = Promise.resolve(
			vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Refreshing Call Graph index',
					cancellable: true,
				},
				async (progress, token) => this.refreshWithProgress(progress, token),
			),
		);

		try {
			return await this.currentRun;
		} finally {
			this.currentRun = undefined;
		}
	}

	public getSnapshot(): WorkspaceIndexSnapshot {
		return {
			files: [...this.lastGoodFiles.values()],
			diagnostics: [...this.latestDiagnostics.values()].flat(),
			indexedFileCount: this.lastGoodFiles.size,
			discoveredFileCount: this.lastGoodFiles.size,
			updatedAt: this.updatedAt,
		};
	}

	public getParsedFile(file: vscode.Uri): ParsedFile | undefined {
		return this.lastGoodFiles.get(file.toString());
	}

	public dispose(): void {
		this.lastGoodFiles.clear();
		this.latestDiagnostics.clear();
		this.parser = undefined;
		this.currentRun = undefined;
	}

	private async refreshWithProgress(progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken): Promise<WorkspaceIndexSnapshot> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders || workspaceFolders.length === 0) {
			void vscode.window.showInformationMessage('Open a workspace folder before refreshing the Call Graph index.');
			return this.getSnapshot();
		}

		progress.report({ message: 'Finding Python files' });
		const files = await vscode.workspace.findFiles(PYTHON_FILE_GLOB, IGNORED_FOLDER_GLOB, undefined, token);
		if (token.isCancellationRequested) {
			return this.reportCancelled(files.length);
		}

		let processedCount = 0;
		let parseErrorFileCount = 0;
		const increment = files.length > 0 ? 100 / files.length : 100;

		for (const file of files) {
			if (token.isCancellationRequested) {
				return this.reportCancelled(files.length);
			}

			processedCount += 1;
			const relativePath = vscode.workspace.asRelativePath(file, false);
			progress.report({
				message: `${processedCount}/${files.length} ${relativePath}`,
				increment,
			});

			try {
				const result = await this.indexFile(file, relativePath);
				this.updateDiagnostics(file, result.parsed);

				if (result.hasErrors) {
					parseErrorFileCount += 1;
					continue;
				}

				this.lastGoodFiles.set(file.toString(), result.parsed);
			} catch (error) {
				parseErrorFileCount += 1;
				this.latestDiagnostics.set(file.toString(), [
					{
						filePath: relativePath,
						diagnostic: {
							message: error instanceof Error ? error.message : String(error),
							range: {
								start: { line: 1, character: 1 },
								end: { line: 1, character: 1 },
							},
							severity: 'error',
						},
					},
				]);
			}
		}

		this.removeDeletedFiles(files);
		this.updatedAt = new Date();
		const snapshot = this.createSnapshot(files.length);

		if (parseErrorFileCount > 0) {
			void vscode.window.showWarningMessage(`Call Graph index refreshed with parse errors in ${parseErrorFileCount} Python file${parseErrorFileCount === 1 ? '' : 's'}. Last-good data was kept where available.`);
		} else {
			void vscode.window.showInformationMessage(`Call Graph index refreshed: ${snapshot.indexedFileCount} Python file${snapshot.indexedFileCount === 1 ? '' : 's'} indexed.`);
		}

		return snapshot;
	}

	private async indexFile(file: vscode.Uri, relativePath: string): Promise<IndexFileResult> {
		const parser = await this.getParser();
		const bytes = await vscode.workspace.fs.readFile(file);
		const source = Buffer.from(bytes).toString('utf8');
		const parsed = resolveSameFileCalls(parser.parse({
			filePath: relativePath,
			source,
		}));

		return {
			parsed,
			hasErrors: parsed.diagnostics.some(diagnostic => diagnostic.severity === 'error'),
		};
	}

	private async getParser(): Promise<PythonParser> {
		if (!this.parser) {
			this.parser = await PythonParser.create();
		}
		return this.parser;
	}

	private updateDiagnostics(file: vscode.Uri, parsed: ParsedFile): void {
		const diagnostics = parsed.diagnostics.map(diagnostic => ({
			filePath: parsed.filePath,
			diagnostic,
		}));
		this.latestDiagnostics.set(file.toString(), diagnostics);
	}

	private removeDeletedFiles(files: vscode.Uri[]): void {
		const liveKeys = new Set(files.map(file => file.toString()));
		for (const key of this.lastGoodFiles.keys()) {
			if (!liveKeys.has(key)) {
				this.lastGoodFiles.delete(key);
			}
		}
		for (const key of this.latestDiagnostics.keys()) {
			if (!liveKeys.has(key)) {
				this.latestDiagnostics.delete(key);
			}
		}
	}

	private reportCancelled(discoveredFileCount: number): WorkspaceIndexSnapshot {
		void vscode.window.showInformationMessage('Call Graph index refresh cancelled.');
		return this.createSnapshot(discoveredFileCount);
	}

	private createSnapshot(discoveredFileCount: number): WorkspaceIndexSnapshot {
		return {
			files: [...this.lastGoodFiles.values()],
			diagnostics: [...this.latestDiagnostics.values()].flat(),
			indexedFileCount: this.lastGoodFiles.size,
			discoveredFileCount,
			updatedAt: this.updatedAt,
		};
	}
}
