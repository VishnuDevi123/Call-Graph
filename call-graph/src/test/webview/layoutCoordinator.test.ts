import * as assert from 'assert';
import { LayoutCoordinator, type LayoutWorkerLike } from '../../webview/client/layoutCoordinator';
import type {
	LayoutRequest,
	LayoutSuccessResult,
	LayoutWorkerResult,
} from '../../webview/layout/workerProtocol';

suite('layout worker coordinator', () => {
	test('assigns increasing request IDs and ignores stale results', () => {
		const worker = new FakeWorker();
		const accepted: number[] = [];
		const coordinator = new LayoutCoordinator(
			worker,
			result => accepted.push(result.requestId),
			message => assert.fail(message),
		);

		assert.strictEqual(coordinator.request(requestInput()), 1);
		assert.strictEqual(coordinator.request(requestInput()), 2);
		worker.emit(result(1));
		worker.emit(result(2));

		assert.deepStrictEqual(worker.requests.map(request => request.requestId), [1, 2]);
		assert.deepStrictEqual(accepted, [2]);
	});

	test('terminates its panel-lifetime worker', () => {
		const worker = new FakeWorker();
		const coordinator = new LayoutCoordinator(worker, () => undefined, () => undefined);

		coordinator.dispose();

		assert.strictEqual(worker.terminated, true);
	});
});

class FakeWorker implements LayoutWorkerLike {
	public readonly requests: LayoutRequest[] = [];
	public terminated = false;
	private messageListener: ((event: MessageEvent<LayoutWorkerResult>) => void) | undefined;

	public addEventListener(
		type: 'message' | 'error',
		listener: ((event: MessageEvent<LayoutWorkerResult>) => void) | ((event: ErrorEvent) => void),
	): void {
		if (type === 'message') {
			this.messageListener = listener as (event: MessageEvent<LayoutWorkerResult>) => void;
		}
	}

	public postMessage(message: LayoutRequest): void {
		this.requests.push(message);
	}

	public terminate(): void {
		this.terminated = true;
	}

	public emit(message: LayoutWorkerResult): void {
		this.messageListener?.({ data: message } as MessageEvent<LayoutWorkerResult>);
	}
}

function requestInput(): Parameters<LayoutCoordinator['request']>[0] {
	return {
		focusNodeId: 'focus',
		nodes: [],
		edges: [],
		viewport: { width: 800, height: 600 },
		depths: { callers: 1, callees: 1 },
		previousPositions: {},
		settings: {
			nodeGap: 120,
			bandGap: 300,
			obstaclePadding: 12,
		},
	};
}

function result(requestId: number): LayoutSuccessResult {
	return {
		type: 'layoutResult',
		requestId,
		nodes: [],
		edges: [],
		contentBounds: {
			left: 0,
			top: 0,
			right: 0,
			bottom: 0,
			width: 0,
			height: 0,
		},
		hasObstructedEdges: false,
	};
}
