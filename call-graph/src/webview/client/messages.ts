import type { GraphDepth, GraphExpansionDirection } from '../../graph/types';
import type { ClientMessage } from './types';

export function depthChangeMessage(direction: GraphExpansionDirection, value: string): ClientMessage {
	return {
		type: 'depthChanged',
		direction,
		depth: parseDepth(value),
	};
}

export function parseDepth(value: string): GraphDepth {
	if (value === 'max') {
		return 'max';
	}
	const depth = Number(value);
	if (depth === 1 || depth === 2 || depth === 3 || depth === 4 || depth === 5) {
		return depth;
	}
	return 1;
}
