/**
 * Detects and repairs straight-edge obstructions for the soft depth-band layout.
 *
 * Repair uses padded rectangles to create visual clearance. Final obstruction
 * status uses visible node interiors only, so padding and boundary tangency do
 * not count as rendered edge crossings.
 */
import {
  expandRectangle,
  rectangleBoundaryIntersection,
  rectangleCenter,
  segmentIntersectsRectangle,
} from "./geometry";
import type { Point, Rectangle } from "./geometry";
import { signedLayoutRank, type LayoutRanks } from "./layoutRanks";
import type { LayoutNodeResult, LayoutRequest } from "./workerProtocol";

interface Obstruction {
  edge: LayoutRequest["edges"][number];
  nodeId: string;
}

interface LayoutClock {
  now(): number;
}

const REPAIR_ROUNDS_PER_RETRY = 6;
const RENDERED_OBSTRUCTION_INSET = 1e-4;

export function repairObstructions(
  request: LayoutRequest,
  layoutRanks: LayoutRanks,
  nodes: LayoutNodeResult[],
  spacingScale: number,
  deadline: number,
  clock: LayoutClock,
): void {
  const nodeGap = request.settings.nodeGap * spacingScale;
  for (let round = 0; round < REPAIR_ROUNDS_PER_RETRY; round += 1) {
    if (clock.now() >= deadline) {
      return;
    }
    const obstructions = findObstructions(request, nodes);
    if (obstructions.length === 0) {
      return;
    }
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    for (const obstruction of obstructions) {
      const obstacle = nodesById.get(obstruction.nodeId);
      const source = nodesById.get(obstruction.edge.from);
      const target = nodesById.get(obstruction.edge.to);
      if (!obstacle || !source || !target) {
        continue;
      }

      const obstacleCenter = rectangleCenter(obstacle);
      const lineY = yOnCenterLine(source, target, obstacleCenter.x);
      const clearance =
        obstacle.height / 2 + request.settings.obstaclePadding + nodeGap / 2;
      const direction = obstacleCenter.y <= lineY ? -1 : 1;
      obstacle.y = lineY + direction * clearance - obstacle.height / 2;
    }

    compactNodeResultsByBand(request, layoutRanks, nodes, nodeGap);
  }
}

export function findObstructions(
  request: LayoutRequest,
  nodes: LayoutNodeResult[],
): Obstruction[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const obstructions: Obstruction[] = [];

  for (const edge of request.edges) {
    if (edge.type !== "normal") {
      continue;
    }
    const source = nodesById.get(edge.from);
    const target = nodesById.get(edge.to);
    if (!source || !target) {
      continue;
    }
    const segment = centerSegment(source, target);
    for (const node of nodes) {
      if (node.id === edge.from || node.id === edge.to) {
        continue;
      }
      if (
        segmentIntersectsRectangle(
          segment,
          expandRectangle(node, request.settings.obstaclePadding),
        )
      ) {
        obstructions.push({ edge, nodeId: node.id });
      }
    }
  }

  return obstructions;
}

export function findRenderedObstructions(
  request: LayoutRequest,
  nodes: LayoutNodeResult[],
): Obstruction[] {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const obstructions: Obstruction[] = [];

  for (const edge of request.edges) {
    if (edge.type !== "normal") {
      continue;
    }
    const source = nodesById.get(edge.from);
    const target = nodesById.get(edge.to);
    if (!source || !target) {
      continue;
    }
    const targetCenter = rectangleCenter(target);
    const sourceCenter = rectangleCenter(source);
    const segment = {
      start: rectangleBoundaryIntersection(source, targetCenter),
      end: rectangleBoundaryIntersection(target, sourceCenter),
    };
    for (const node of nodes) {
      if (node.id === edge.from || node.id === edge.to) {
        continue;
      }
      if (segmentIntersectsRectangleInterior(segment, node)) {
        obstructions.push({ edge, nodeId: node.id });
      }
    }
  }

  return obstructions;
}

/**
 * Obstruction repair can move a node a long way while changing its order.
 * Repack each band around its current center after every round so retries grow
 * the plot deliberately through spacing settings rather than accidental drift.
 */
function compactNodeResultsByBand(
  request: LayoutRequest,
  layoutRanks: LayoutRanks,
  nodes: LayoutNodeResult[],
  nodeGap: number,
): void {
  const inputsById = new Map(request.nodes.map((node) => [node.id, node]));
  const bands = new Map<number, LayoutNodeResult[]>();
  for (const node of nodes) {
    const input = inputsById.get(node.id);
    if (!input) {
      continue;
    }
    const key = signedLayoutRank(input, layoutRanks);
    const band = bands.get(key) ?? [];
    band.push(node);
    bands.set(key, band);
  }

  for (const band of bands.values()) {
    band.sort(
      (left, right) => left.y - right.y || left.id.localeCompare(right.id),
    );
    const originalCenter = average(
      band.map((node) => node.y + node.height / 2),
    );
    const totalHeight =
      band.reduce((sum, node) => sum + node.height, 0) +
      Math.max(0, band.length - 1) * nodeGap;
    let nextY = originalCenter - totalHeight / 2;
    for (const node of band) {
      node.y = nextY;
      nextY += node.height + nodeGap;
    }
  }
}

function segmentIntersectsRectangleInterior(
  segment: { start: Point; end: Point },
  rectangle: Rectangle,
): boolean {
  if (
    rectangle.width <= RENDERED_OBSTRUCTION_INSET * 2 ||
    rectangle.height <= RENDERED_OBSTRUCTION_INSET * 2
  ) {
    return false;
  }
  return segmentIntersectsRectangle(
    segment,
    expandRectangle(rectangle, -RENDERED_OBSTRUCTION_INSET),
  );
}

function centerSegment(
  source: Rectangle,
  target: Rectangle,
): { start: Point; end: Point } {
  return {
    start: rectangleCenter(source),
    end: rectangleCenter(target),
  };
}

function yOnCenterLine(
  source: Rectangle,
  target: Rectangle,
  x: number,
): number {
  const start = rectangleCenter(source);
  const end = rectangleCenter(target);
  if (Math.abs(end.x - start.x) < 1e-9) {
    return (start.y + end.y) / 2;
  }
  const ratio = (x - start.x) / (end.x - start.x);
  return start.y + (end.y - start.y) * ratio;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
