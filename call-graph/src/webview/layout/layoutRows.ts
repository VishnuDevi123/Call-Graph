/**
 * Owns vertical row intent for depth bands.
 *
 * Rows prefer connected adjacent-band neighbors, then prior positions, then a
 * deterministic stable order. Final non-overlap separation still happens after
 * those preferences are calculated.
 */
import type { Point } from "./geometry";
import { signedLayoutRank, type LayoutRanks } from "./layoutRanks";
import type { LayoutNodeInput, LayoutRequest } from "./workerProtocol";

export type CenterByNodeId = Map<string, Point>;

const PREVIOUS_Y_PREFERENCE_WEIGHT = 0.25;
const MAX_PREVIOUS_Y_NUDGE = 56;

export function calculateAdjacentAnchors(
  request: LayoutRequest,
  layoutRanks: LayoutRanks,
): Map<string, Set<string>> {
  const nodesById = new Map(request.nodes.map((node) => [node.id, node]));
  const anchors = new Map<string, Set<string>>(
    request.nodes.map((node) => [node.id, new Set<string>()]),
  );

  for (const edge of request.edges) {
    const source = nodesById.get(edge.from);
    const target = nodesById.get(edge.to);
    if (!source || !target) {
      continue;
    }
    const sourceRank = signedLayoutRank(source, layoutRanks);
    const targetRank = signedLayoutRank(target, layoutRanks);
    if (Math.abs(sourceRank - targetRank) !== 1) {
      continue;
    }
    const sourceIsNearer = Math.abs(sourceRank) < Math.abs(targetRank);
    const nearerId = sourceIsNearer ? source.id : target.id;
    const fartherId = sourceIsNearer ? target.id : source.id;
    anchors.get(fartherId)?.add(nearerId);
  }

  return anchors;
}

export function orderBandNodes(
  nodes: LayoutNodeInput[],
  request: LayoutRequest,
  attempt: number,
  placedCenters: CenterByNodeId,
  adjacentAnchors: Map<string, Set<string>>,
): LayoutNodeInput[] {
  return [...nodes].sort((left, right) => {
    const leftRelationshipCenter = averageOrUndefined(
      placedAdjacentCenters(left.id, placedCenters, adjacentAnchors),
    );
    const rightRelationshipCenter = averageOrUndefined(
      placedAdjacentCenters(right.id, placedCenters, adjacentAnchors),
    );
    if (
      leftRelationshipCenter !== undefined &&
      rightRelationshipCenter !== undefined &&
      leftRelationshipCenter !== rightRelationshipCenter
    ) {
      return leftRelationshipCenter - rightRelationshipCenter;
    }
    if (
      leftRelationshipCenter !== undefined ||
      rightRelationshipCenter !== undefined
    ) {
      return leftRelationshipCenter !== undefined ? -1 : 1;
    }

    const leftPrevious = request.previousPositions[left.id];
    const rightPrevious = request.previousPositions[right.id];
    if (leftPrevious && rightPrevious && leftPrevious.y !== rightPrevious.y) {
      return leftPrevious.y - rightPrevious.y;
    }
    if (leftPrevious !== undefined || rightPrevious !== undefined) {
      return leftPrevious ? -1 : 1;
    }

    const leftRank = stableHash(left.id, attempt > 0 ? attempt % 3 : 0);
    const rightRank = stableHash(right.id, attempt > 0 ? attempt % 3 : 0);
    return leftRank - rightRank || left.id.localeCompare(right.id);
  });
}

export function defaultVerticalCenter(
  index: number,
  nodes: LayoutNodeInput[],
  nodeGap: number,
  viewportHeight: number,
): number {
  const totalHeight =
    nodes.reduce((sum, node) => sum + node.height, 0) +
    Math.max(0, nodes.length - 1) * nodeGap;
  let center = viewportHeight / 2 - totalHeight / 2;
  for (let current = 0; current <= index; current += 1) {
    center += nodes[current].height / 2;
    if (current < index) {
      center += nodes[current].height / 2 + nodeGap;
    }
  }
  return center;
}

export function relationshipPreferredCenter(
  nodeId: string,
  defaultCenter: number,
  placedCenters: CenterByNodeId,
  adjacentAnchors: Map<string, Set<string>>,
): number {
  const connectedCenters = placedAdjacentCenters(
    nodeId,
    placedCenters,
    adjacentAnchors,
  );
  if (connectedCenters.length === 0) {
    return defaultCenter;
  }
  // Relationship rows should be visible, but remain a preference so dense
  // bands can still compact and obstruction repair can move nodes later.
  return defaultCenter * 0.2 + average(connectedCenters) * 0.8;
}

/**
 * Previous positions reduce motion during refocus, but they should not turn a
 * simple graph into a vertically scattered one. Keep only a bounded fraction
 * of the old offset from the natural band-centered placement.
 */
export function softenedPreviousCenter(
  defaultCenter: number,
  previousCenter: number,
): number {
  const nudge = clamp(
    (previousCenter - defaultCenter) * PREVIOUS_Y_PREFERENCE_WEIGHT,
    -MAX_PREVIOUS_Y_NUDGE,
    MAX_PREVIOUS_Y_NUDGE,
  );
  return defaultCenter + nudge;
}

/**
 * Finds the closest non-overlapping vertical sequence to the preferred
 * centers while preserving deterministic band order.
 */
export function separateVerticalCenters(
  nodes: LayoutNodeInput[],
  preferredCenters: number[],
  nodeGap: number,
): number[] {
  const centers: number[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const minimum =
      index === 0
        ? Number.NEGATIVE_INFINITY
        : centers[index - 1] +
          nodes[index - 1].height / 2 +
          nodeGap +
          nodes[index].height / 2;
    centers.push(Math.max(preferredCenters[index], minimum));
  }

  // Shift the whole band toward its preferred vertical center. A uniform
  // shift preserves all separation established above.
  if (centers.length > 0) {
    const preferredAverage = average(preferredCenters);
    const actualAverage = average(centers);
    const shift = preferredAverage - actualAverage;
    return centers.map((center) => center + shift);
  }
  return centers;
}

function placedAdjacentCenters(
  nodeId: string,
  placedCenters: CenterByNodeId,
  adjacentAnchors: Map<string, Set<string>>,
): number[] {
  return [...(adjacentAnchors.get(nodeId) ?? [])]
    .map((anchorId) => placedCenters.get(anchorId)?.y)
    .filter((center): center is number => center !== undefined);
}

function stableHash(value: string, seed: number): number {
  let hash = 2166136261 ^ seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageOrUndefined(values: number[]): number | undefined {
  return values.length === 0 ? undefined : average(values);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
