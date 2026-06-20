import type { GraphDepth, GraphExpansionDirection } from './types';

export class GraphSessionState {
	public callerDepth: GraphDepth = 1;
	public calleeDepth: GraphDepth = 1;
	public focusNodeId: string | undefined;

	public setFocusNode(nodeId: string): boolean {
		if (this.focusNodeId === nodeId) {
			return false;
		}
		this.focusNodeId = nodeId;
		return true;
	}

	public setDepth(direction: GraphExpansionDirection, depth: GraphDepth): boolean {
		const currentDepth = direction === 'callers' ? this.callerDepth : this.calleeDepth;
		if (currentDepth === depth) {
			return false;
		}

		if (direction === 'callers') {
			this.callerDepth = depth;
		} else {
			this.calleeDepth = depth;
		}
		return true;
	}
}
