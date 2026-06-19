import type * as vscode from 'vscode';

export interface WebviewResources {
	scriptUri: vscode.Uri;
	styleUri: vscode.Uri;
}

export function getWebviewHtml(webview: vscode.Webview, resources: WebviewResources): string {
	const nonce = getNonce();

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
	<title>Call Graph</title>
	<link rel="stylesheet" href="${resources.styleUri}">
</head>
<body>
	<header class="toolbar">
		<div class="title">Call Graph</div>
		<div id="status" class="status" role="status" aria-live="polite"></div>
		<div class="toolbar-actions">
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
			<label class="filter">
				<input id="include-tests" type="checkbox" checked>
				<span>Include tests</span>
			</label>
			<button id="refresh" type="button">Refresh</button>
		</div>
	</header>
	<div id="viewport" class="viewport">
		<div id="scene-stage" class="scene-stage">
			<main id="canvas" class="canvas" aria-label="Call graph canvas"></main>
		</div>
	</div>
	<svg id="minimap" class="minimap" viewBox="0 0 176 112" aria-label="Graph overview">
		<g id="minimap-content"></g>
		<rect id="minimap-viewport" class="minimap-viewport" x="0" y="0" width="176" height="112" rx="2"></rect>
	</svg>
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
