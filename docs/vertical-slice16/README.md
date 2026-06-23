# Slice 16: Variable Nodes and Vector Edges

## Goal

Switch live rendering to approved node and edge geometry.

## Deliverables

- Render measured HTML nodes with complete two-line labels.
- Use `12pt` function text, `9pt` file/line text, and `4px` radius defaults.
- Render caller/focus/callee role colors through CSS variables.
- Render normal SVG edges as straight target-facing vectors.
- Join `10pt` arrowheads continuously to edge endpoints.
- Render reciprocal calls as two solid curved edges around one node occurrence.
- Remove fixed widths, fixed columns, role groups, fake `None` states, and normal cubic routing.
- Delete `sceneGeometry.ts` only after replacement is connected and tested.

## Acceptance

- Full labels do not wrap or truncate.
- Normal edges are straight and avoid unrelated nodes.
- Reciprocal edges form a readable oval-like pair.
- Arrowheads do not appear detached.
- Old geometry tests are replaced by new contract tests.

## Verification

```sh
npm run compile
npm run test:unit
```
