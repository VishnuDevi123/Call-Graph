import { createSoftDepthBandLayout } from './softDepthBandLayout';
import type { LayoutRequest, LayoutWorkerResult } from './workerProtocol';

interface LayoutWorkerScope {
	addEventListener(type: 'message', listener: (event: MessageEvent<LayoutRequest>) => void): void;
	postMessage(result: LayoutWorkerResult): void;
}

const workerScope = self as unknown as LayoutWorkerScope;

workerScope.addEventListener('message', event => {
	const request = event.data;
	if (request.type !== 'layoutRequest') {
		return;
	}

	let result: LayoutWorkerResult;
	try {
		result = createSoftDepthBandLayout(request);
	} catch (error) {
		result = {
			type: 'layoutError',
			requestId: request.requestId,
			message: error instanceof Error ? error.message : 'Layout worker failed.',
		};
	}
	workerScope.postMessage(result);
});
