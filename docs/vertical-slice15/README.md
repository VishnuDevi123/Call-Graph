# Slice 15: Soft Depth-Band Layout

## Goal

Place nodes by depth while avoiding node overlap and straight-edge obstruction.

## Deliverables

- Put callers in left soft bands and callees in right soft bands.
- Refine semantic depth bands into hierarchy-aware sub-bands when visible
  same-side calls show that one direct relationship is upstream of another.
  Semantic depth remains the graph-expansion depth; layout rank only improves
  presentation.
- Allow vertical and limited horizontal movement inside each band.
- Use prior positions as preferences.
- Treat padded node rectangles as obstacles.
- Allow edge crossings but reject normal edges through unrelated nodes.
- Grow node spacing, band spacing, and plot dimensions during bounded retries.
- Stop on valid placement or size-based time budget.
- Return best non-overlapping result plus obstruction status on timeout.

## Acceptance

- Depth order remains readable.
- Same-depth caller/callee chains spread in call direction instead of collapsing
  into one tall column.
- Same-side cycles share a stable sub-band and do not inflate layout rank.
- Nodes never overlap.
- Valid results have no normal edge through unrelated nodes.
- Small graphs target about `150ms`; large graphs stop by about `750ms`.
- Identical requests produce stable results.

## Verification

```sh
npm run compile
npm run test:unit
```
