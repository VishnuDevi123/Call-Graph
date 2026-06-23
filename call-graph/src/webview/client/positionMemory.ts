import type { Point } from '../layout/geometry';
import type { LayoutSuccessResult } from '../layout/workerProtocol';

/** Keeps panel-lifetime positions without placing state inside the layout worker. */
export class PositionMemory {
	private positions: Record<string, Point> = {};

	public snapshot(): Record<string, Point> {
		return { ...this.positions };
	}

	public update(result: LayoutSuccessResult): void {
		this.positions = Object.fromEntries(
			result.nodes.map(node => [node.id, { x: node.x, y: node.y }]),
		);
	}

	public clear(): void {
		this.positions = {};
	}
}
