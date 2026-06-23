import type { GraphDepth, GraphExpansionDirection, GraphModel } from '../../graph/types';

export interface VsCodeApi {
	postMessage(message: ClientMessage): void;
}

export type ClientMessage =
	| { type: 'nodeSelected'; nodeId: string }
	| { type: 'refreshRequested' }
	| { type: 'depthChanged'; direction: GraphExpansionDirection; depth: GraphDepth };

export type HostMessage =
	| { type: 'graphUpdated'; graph: GraphModel }
	| { type: 'overlayUpdated'; message?: string; severity: 'warning' }
	| { type: 'revealDirection'; direction: GraphExpansionDirection };

declare global {
	function acquireVsCodeApi(): VsCodeApi;
}
