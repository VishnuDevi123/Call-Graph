import type * as vscode from 'vscode';
import type { GraphModel } from '../graph/types';

export function getWebviewHtml(webview: vscode.Webview, graph: GraphModel): string {
	const nonce = getNonce();
	const graphJson = JSON.stringify(graph).replace(/</g, '\\u003c');

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
	<title>Call Graph</title>
	<style nonce="${nonce}">
		:root {
			color-scheme: light dark;
			--bg: var(--vscode-editor-background);
			--fg: var(--vscode-editor-foreground);
			--muted: var(--vscode-descriptionForeground);
			--panel: var(--vscode-sideBar-background);
			--border: var(--vscode-panel-border);
			--accent: var(--vscode-focusBorder);
			--button: var(--vscode-button-background);
			--button-fg: var(--vscode-button-foreground);
		}

		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			background: var(--bg);
			color: var(--fg);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		}

		.toolbar {
			height: 44px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 16px;
			padding: 0 16px;
			border-bottom: 1px solid var(--border);
			background: var(--panel);
		}

		.title {
			font-weight: 600;
			white-space: nowrap;
		}

		button {
			border: 0;
			border-radius: 4px;
			background: var(--button);
			color: var(--button-fg);
			padding: 5px 10px;
			cursor: pointer;
			font: inherit;
		}

		button:hover {
			filter: brightness(1.08);
		}

		.canvas {
			min-height: calc(100vh - 44px);
			padding: 28px;
			display: grid;
			grid-template-columns: minmax(180px, 1fr) minmax(240px, 1.1fr) minmax(180px, 1fr);
			gap: 28px;
			align-items: center;
		}

		.group {
			display: grid;
			gap: 14px;
			align-content: center;
			min-height: 300px;
		}

		.group-label {
			color: var(--muted);
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: 0;
		}

		.node {
			width: 100%;
			min-height: 74px;
			text-align: left;
			border: 1px solid var(--border);
			border-radius: 6px;
			background: var(--panel);
			color: var(--fg);
			padding: 12px;
			display: grid;
			gap: 6px;
			box-shadow: none;
		}

		.node:hover,
		.node:focus-visible {
			outline: 1px solid var(--accent);
			outline-offset: 2px;
		}

		.node.focus {
			min-height: 112px;
			border-color: var(--accent);
			border-width: 2px;
			font-size: 1.08em;
		}

		.node-name {
			font-weight: 650;
			overflow-wrap: anywhere;
		}

		.node-meta {
			color: var(--muted);
			font-size: 12px;
			overflow-wrap: anywhere;
		}

		.edge-label {
			color: var(--muted);
			font-size: 12px;
			padding-inline: 6px;
		}

		.details {
			grid-column: 1 / -1;
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px;
			align-self: end;
		}

		details {
			border: 1px solid var(--border);
			border-radius: 6px;
			padding: 10px 12px;
			background: var(--panel);
		}

		summary {
			cursor: pointer;
			font-weight: 600;
		}

		ul {
			margin: 10px 0 0;
			padding-left: 18px;
			color: var(--muted);
		}

		@media (max-width: 760px) {
			.canvas,
			.details {
				grid-template-columns: 1fr;
			}

			.details {
				grid-column: 1;
			}
		}
	</style>
</head>
<body>
	<header class="toolbar">
		<div class="title">Call Graph</div>
		<button id="refresh" type="button">Refresh</button>
	</header>
	<main id="canvas" class="canvas" aria-label="Call graph canvas"></main>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const graph = ${graphJson};
		const canvas = document.getElementById('canvas');

		function nodeButton(node) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'node ' + node.role;
			button.dataset.nodeId = node.id;
			button.innerHTML = '<span class="node-name"></span><span class="node-meta"></span>';
			button.querySelector('.node-name').textContent = node.label;
			button.querySelector('.node-meta').textContent = node.filePath + ':' + node.line;
			button.addEventListener('click', (event) => {
				event.stopPropagation();
				vscode.postMessage({ type: 'nodeSelected', nodeId: node.id });
			});
			return button;
		}

		function renderGroup(label, nodes) {
			const group = document.createElement('section');
			group.className = 'group';
			const heading = document.createElement('div');
			heading.className = 'group-label';
			heading.textContent = label;
			group.appendChild(heading);
			for (const node of nodes) {
				group.appendChild(nodeButton(node));
				const edge = graph.edges.find((candidate) => candidate.from === node.id || candidate.to === node.id);
				if (edge) {
					const edgeLabel = document.createElement('div');
					edgeLabel.className = 'edge-label';
					edgeLabel.textContent = edge.label;
					group.appendChild(edgeLabel);
				}
			}
			return group;
		}

		function renderDetails(title, calls) {
			const detail = document.createElement('details');
			const summary = document.createElement('summary');
			summary.textContent = title + ' (' + calls.length + ')';
			detail.appendChild(summary);
			const list = document.createElement('ul');
			for (const call of calls) {
				const item = document.createElement('li');
				item.textContent = call;
				list.appendChild(item);
			}
			detail.appendChild(list);
			return detail;
		}

		function render() {
			const callers = graph.nodes.filter((node) => node.role === 'caller');
			const focus = graph.nodes.filter((node) => node.role === 'focus');
			const callees = graph.nodes.filter((node) => node.role === 'callee');
			canvas.appendChild(renderGroup('Callers', callers));
			canvas.appendChild(renderGroup('Focused Function', focus));
			canvas.appendChild(renderGroup('Callees', callees));
			const details = document.createElement('section');
			details.className = 'details';
			details.appendChild(renderDetails('Unresolved calls', graph.unresolvedCalls));
			details.appendChild(renderDetails('External calls', graph.externalCalls));
			canvas.appendChild(details);
		}

		canvas.addEventListener('click', () => {
			vscode.postMessage({ type: 'canvasSelected', nodeId: graph.focusNodeId });
		});

		document.getElementById('refresh').addEventListener('click', (event) => {
			event.stopPropagation();
			vscode.postMessage({ type: 'refreshRequested' });
		});

		render();
	</script>
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
