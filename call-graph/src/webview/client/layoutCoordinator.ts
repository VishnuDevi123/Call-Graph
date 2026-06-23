import type {
	LayoutRequest,
	LayoutSuccessResult,
	LayoutWorkerResult,
} from '../layout/workerProtocol';

export interface LayoutWorkerLike {
	addEventListener(type: 'message', listener: (event: MessageEvent<LayoutWorkerResult>) => void): void;
	addEventListener(type: 'error', listener: (event: ErrorEvent) => void): void;
	postMessage(message: LayoutRequest): void;
	terminate(): void;
}

export type LayoutRequestInput = Omit<LayoutRequest, 'type' | 'requestId'>;

/**
 * Owns one stateless worker and accepts results only from the newest request.
 * Older worker responses may still arrive, but cannot replace current geometry.
 */
export class LayoutCoordinator {
	private latestRequestId = 0;

	public constructor(
		private readonly worker: LayoutWorkerLike,
		private readonly onResult: (result: LayoutSuccessResult) => void,
		private readonly onError: (message: string) => void,
	) {
		worker.addEventListener('message', event => this.handleResult(event.data));
		worker.addEventListener('error', event => this.onError(event.message || 'Layout worker failed.'));
	}

	public request(input: LayoutRequestInput): number {
		const requestId = this.latestRequestId + 1;
		this.latestRequestId = requestId;
		this.worker.postMessage({
			...input,
			type: 'layoutRequest',
			requestId,
		});
		return requestId;
	}

	public dispose(): void {
		this.worker.terminate();
	}

	private handleResult(result: LayoutWorkerResult): void {
		if (result.requestId !== this.latestRequestId) {
			return;
		}
		if (result.type === 'layoutError') {
			this.onError(result.message);
			return;
		}
		this.onResult(result);
	}
}
