import type { GraphDepth, GraphExpansionDirection, GraphModel } from '../../graph/types';

export interface VsCodeApi {
	postMessage(message: ClientMessage): void;
}

export type ClientMessage =
	| { type: 'nodeRevealed'; nodeId: string }
	| { type: 'nodeActivated'; nodeId: string }
	| { type: 'navigateBack' }
	| { type: 'navigateForward' }
	| { type: 'refreshRequested' }
	| { type: 'depthChanged'; direction: GraphExpansionDirection; depth: GraphDepth };

export type HostMessage =
	| { type: 'graphUpdated'; graph: GraphModel }
	| { type: 'navigationStateUpdated'; canGoBack: boolean; canGoForward: boolean }
	| { type: 'overlayUpdated'; message?: string; severity: 'loading' | 'warning' | 'error' | 'empty' }
	| { type: 'revealDirection'; direction: GraphExpansionDirection };

declare global {
	function acquireVsCodeApi(): VsCodeApi;
}
