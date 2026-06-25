/**
 * Computes horizontal hierarchy ranks for the soft depth-band layout.
 *
 * Semantic graph depth decides graph membership. Layout rank may add same-side
 * hierarchy where visible caller/callee chains benefit from extra horizontal
 * separation, capped by the selected depth.
 */
import type { LayoutNodeInput, LayoutRequest } from "./workerProtocol";

export type LayoutRanks = Map<string, number>;

export function signedLayoutRank(
  node: LayoutNodeInput,
  layoutRanks: LayoutRanks,
): number {
  const rank = layoutRanks.get(node.id) ?? Math.max(1, node.depth);
  if (node.role === "caller") {
    return -rank;
  }
  if (node.role === "callee") {
    return rank;
  }
  return 0;
}

/**
 * For callers A -> B means A belongs farther left than B. For callees A -> B
 * means B belongs farther right than A. Strongly connected nodes share one
 * rank so cycles cannot increase ranks indefinitely.
 */
export function calculateLayoutRanks(request: LayoutRequest): LayoutRanks {
  const ranks: LayoutRanks = new Map(
    request.nodes.map((node) => [
      node.id,
      node.role === "focus" ? 0 : Math.max(1, node.depth),
    ]),
  );
  const nodesById = new Map(request.nodes.map((node) => [node.id, node]));

  for (const role of ["caller", "callee"] as const) {
    const roleNodes = request.nodes.filter((node) => node.role === role);
    const roleNodeIds = new Set(roleNodes.map((node) => node.id));
    const fartherToNearer = new Map<string, Set<string>>(
      roleNodes.map((node) => [node.id, new Set<string>()]),
    );

    for (const edge of request.edges) {
      if (!roleNodeIds.has(edge.from) || !roleNodeIds.has(edge.to)) {
        continue;
      }
      const farther = role === "caller" ? edge.from : edge.to;
      const nearer = role === "caller" ? edge.to : edge.from;
      fartherToNearer.get(farther)?.add(nearer);
    }

    const rankLimit = layoutRankLimit(
      request.depths[role === "caller" ? "callers" : "callees"],
    );
    const components = stronglyConnectedComponents(roleNodes, fartherToNearer);
    const componentByNodeId = new Map<string, number>();
    components.forEach((component, index) => {
      component.forEach((nodeId) => componentByNodeId.set(nodeId, index));
    });
    const nearerComponents = components.map(() => new Set<number>());
    const baseRanks = components.map((component) =>
      Math.max(
        ...component.map((nodeId) =>
          Math.max(1, nodesById.get(nodeId)?.depth ?? 1),
        ),
      ),
    );

    for (const [fartherId, nearerIds] of fartherToNearer) {
      const fartherComponent = componentByNodeId.get(fartherId);
      if (fartherComponent === undefined) {
        continue;
      }
      for (const nearerId of nearerIds) {
        const nearerComponent = componentByNodeId.get(nearerId);
        if (
          nearerComponent !== undefined &&
          nearerComponent !== fartherComponent
        ) {
          nearerComponents[fartherComponent].add(nearerComponent);
        }
      }
    }

    const componentRanks = new Map<number, number>();
    const rankComponent = (component: number): number => {
      const existing = componentRanks.get(component);
      if (existing !== undefined) {
        return existing;
      }
      const rank = Math.min(
        rankLimit,
        Math.max(
          baseRanks[component],
          ...Array.from(
            nearerComponents[component],
            (nearer) => rankComponent(nearer) + 1,
          ),
        ),
      );
      componentRanks.set(component, rank);
      return rank;
    };

    components.forEach((component, index) => {
      const rank = rankComponent(index);
      component.forEach((nodeId) => ranks.set(nodeId, rank));
    });
  }

  return ranks;
}

function layoutRankLimit(depth: LayoutRequest["depths"]["callers"]): number {
  return depth === "max" ? Number.POSITIVE_INFINITY : depth;
}

function stronglyConnectedComponents(
  nodes: LayoutNodeInput[],
  edges: Map<string, Set<string>>,
): string[][] {
  let nextIndex = 0;
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  const visit = (nodeId: string): void => {
    indices.set(nodeId, nextIndex);
    lowLinks.set(nodeId, nextIndex);
    nextIndex += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const targetId of edges.get(nodeId) ?? []) {
      if (!indices.has(targetId)) {
        visit(targetId);
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId) ?? 0, lowLinks.get(targetId) ?? 0),
        );
      } else if (onStack.has(targetId)) {
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId) ?? 0, indices.get(targetId) ?? 0),
        );
      }
    }

    if (lowLinks.get(nodeId) !== indices.get(nodeId)) {
      return;
    }
    const component: string[] = [];
    let currentId: string | undefined;
    do {
      currentId = stack.pop();
      if (currentId !== undefined) {
        onStack.delete(currentId);
        component.push(currentId);
      }
    } while (currentId !== nodeId);
    component.sort((left, right) => left.localeCompare(right));
    components.push(component);
  };

  [...nodes]
    .sort((left, right) => left.id.localeCompare(right.id))
    .forEach((node) => {
      if (!indices.has(node.id)) {
        visit(node.id);
      }
    });
  return components;
}
