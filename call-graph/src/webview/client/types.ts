import type { GraphDepth, GraphExpansionDirection, GraphModel } from '../../graph/types';
import type { GraphSceneGeometry } from '../sceneGeometry';

export interface VsCodeApi {
	postMessage(message: ClientMessage): void;
}

export type ClientMessage =
	| { type: 'nodeSelected'; nodeId: string }
	| { type: 'refreshRequested' }
	| { type: 'includeTestsChanged'; includeTests: boolean }
	| { type: 'depthChanged'; direction: GraphExpansionDirection; depth: GraphDepth };

export type HostMessage =
	| { type: 'graphUpdated'; graph: GraphModel; scene: GraphSceneGeometry }
	| { type: 'statusUpdated'; message?: string }
	| { type: 'revealDirection'; direction: GraphExpansionDirection };

declare global {
	function acquireVsCodeApi(): VsCodeApi;
}
