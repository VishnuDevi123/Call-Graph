import type * as vscode from 'vscode';

export interface WebviewResources {
	scriptUri: vscode.Uri;
	styleUri: vscode.Uri;
	workerUri: vscode.Uri;
}

export function getWebviewHtml(webview: vscode.Webview, resources: WebviewResources): string {
	const nonce = getNonce();

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; connect-src ${webview.cspSource}; worker-src blob:;">
	<title>Call Graph</title>
	<link rel="stylesheet" href="${resources.styleUri}">
</head>
<body data-layout-worker-uri="${resources.workerUri}">
	<header class="toolbar">
		<div class="title">Call Graph</div>
		<div class="toolbar-actions">
			<div class="toolbar-group" aria-label="Graph navigation">
				<button id="back" type="button" disabled aria-label="Back">Back</button>
				<button id="forward" type="button" disabled aria-label="Forward">Forward</button>
			</div>
			<div class="toolbar-group">
				<button id="refresh" type="button">Refresh</button>
				<button id="reset-view" type="button">Reset View</button>
			</div>
			<label class="depth-control">
				<span>Depth Left</span>
				<select id="depth-left" aria-label="Caller depth">
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3">3</option>
					<option value="4">4</option>
					<option value="5">5</option>
					<option value="max">Max</option>
				</select>
			</label>
			<label class="depth-control">
				<span>Depth Right</span>
				<select id="depth-right" aria-label="Callee depth">
					<option value="1">1</option>
					<option value="2">2</option>
					<option value="3">3</option>
					<option value="4">4</option>
					<option value="5">5</option>
					<option value="max">Max</option>
				</select>
			</label>
			<div class="toolbar-group">
				<button id="minimap-toggle" type="button" aria-pressed="true">Minimap</button>
				<output id="zoom-percentage" class="zoom-percentage" aria-label="Current zoom">100%</output>
			</div>
		</div>
	</header>
	<div id="viewport" class="viewport">
		<div id="scene-stage" class="scene-stage">
			<main id="canvas" class="canvas" aria-label="Call graph canvas"></main>
		</div>
		<div id="operational-overlay" class="operational-overlay" role="status" aria-live="polite" hidden>
			<span class="operational-throbber" aria-hidden="true"></span>
			<span id="operational-overlay-message"></span>
			<div id="operational-overlay-actions" class="operational-overlay-actions" hidden>
				<button id="retry-layout" type="button">Retry</button>
				<button id="overlay-refresh" type="button">Refresh</button>
			</div>
		</div>
	</div>
	<aside id="minimap" class="minimap" aria-label="Graph overview">
		<div id="minimap-handle" class="minimap-handle" role="button" tabindex="0" aria-label="Move minimap"></div>
		<svg id="minimap-svg" class="minimap-svg" viewBox="0 0 176 112" aria-hidden="true">
			<g id="minimap-content"></g>
			<rect id="minimap-viewport" class="minimap-viewport" x="0" y="0" width="176" height="112" rx="2"></rect>
		</svg>
	</aside>
	<div id="node-measurements" class="measurement-root" aria-hidden="true"></div>
	<script nonce="${nonce}" src="${resources.scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let text = '';
	for (let index = 0; index < 32; index += 1) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
}
