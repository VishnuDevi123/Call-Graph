import type { LayoutWorkerLike } from './layoutCoordinator';

/**
 * VS Code webviews only start workers from data/blob URLs. Fetch the allowed
 * local bundle, create a panel-lifetime blob URL, and revoke it on termination.
 */
export async function createLocalLayoutWorker(workerSourceUri: string): Promise<LayoutWorkerLike> {
	const response = await fetch(workerSourceUri);
	if (!response.ok) {
		throw new Error(`Unable to load layout worker (${response.status}).`);
	}
	const workerUrl = URL.createObjectURL(await response.blob());
	const worker = new Worker(workerUrl);

	return {
		addEventListener: (type, listener) => worker.addEventListener(type, listener as EventListener),
		postMessage: message => worker.postMessage(message),
		terminate: () => {
			worker.terminate();
			URL.revokeObjectURL(workerUrl);
		},
	};
}
