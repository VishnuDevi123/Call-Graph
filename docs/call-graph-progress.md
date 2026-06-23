# Call Graph Progress

Last updated: 2026-06-23

## Current Status

Slices 0–16 are implemented in `call-graph/`. Slice 17 is next.

Current extension capabilities:

- Python workspace indexing with Tree-sitter
- focused caller/callee graph
- conservative same-file, receiver, and import resolution
- source navigation and editor-driven focus
- save and active unsaved-file updates
- global caller/callee depth controls
- graph limits, deterministic truncation, zoom, pan, and minimap
- modular CSP-safe webview client
- approved V1 toolbar and centered operational-overlay shell
- explicit normal/reciprocal edge semantics
- local stateless layout worker with typed request/result contracts
- hidden DOM node measurement and pure geometry helpers
- deterministic soft depth-band placement with bounded obstacle-avoidance retries
- live measured-node rendering with straight vectors and reciprocal curves

The live UI now renders the worker-owned soft depth-band geometry with measured HTML nodes and SVG vector edges. Slice 17 will add full-graph fitting and graph navigation history. The approved replacement UI contract is in:

- `docs/python-call-graph-extension-prd.md`
- `docs/call-graph-ui-grill-session.md`

Do not restore the discarded ELK-based Slice 13 implementation. New layout work uses a local pure-TypeScript Web Worker with HTML nodes and SVG edges.

## Implemented Work

### Slices 0–4: Foundation

- Extension scaffold, commands, and editor webview
- Tree-sitter Python parser and analyzer types
- workspace indexing, refresh, progress, and cancellation
- active-editor function/module focus detection

### Slices 5–9: Graph Data

- same-file call edges and focused graph model
- source navigation from graph nodes
- save and unsaved active-file updates with last-good data
- conservative `self`, `cls`, construction, and annotation resolution
- high-confidence cross-file import resolution

### Slices 10–11: Expansion and Controls

- bounded recursive caller/callee traversal
- cycle safety and shared-node deduplication
- graph node limits
- reveal commands
- zoom, pan, minimap, and test relationship support

### Slices 11.5A–11.6C: Webview Stabilization

- fixed scene geometry and whole-scene zoom
- global `Depth Left` and `Depth Right`
- thresholded empty-canvas panning
- simplified node labels and hidden resolution labels
- dynamic depth columns
- modular browser client, stylesheet, and CSP-safe resource wiring

### Slice 12: Revised Graph Contract

- removed callerless fallback `<module>` nodes
- retained truthful file-scope module edges and module focus
- removed unresolved/external sections and role headings from primary UI
- preserved directional depth values across focus changes
- changed node-limit priority to focus, direct relationships, then deeper nodes
- made truncation deterministic and reported omitted direct relationships
- retained edge call-site metadata for future UI use

### Slice 13: UI Contract Cleanup

- removed the `Include Tests` control, messages, filtering option, and graph-session state
- kept test-file relationships included in the V1 graph by default
- replaced toolbar status text with a centered operational-overlay message seam
- added the approved Back, Forward, Refresh, Reset View, depth, minimap, and zoom toolbar shell
- kept Back and Forward disabled pending Slice 17 navigation history
- added explicit `normal` and `reciprocal` edge classification to focused graph data
- retained current fixed geometry while wiring baseline Reset View, minimap toggle, and zoom percentage behavior
- restored the direction-neutral `GraphSessionState.setDepth` method name after a partial rename caused a compile mismatch
- corrected zoom-bound normalization and stale zoom test inputs discovered during baseline verification

### Slice 14: Worker and Geometry Foundation

- added an independent, framework-free browser worker bundle with no runtime layout dependency
- added strict CSP/resource wiring that fetches the local worker bundle and starts it from a panel-lifetime blob URL as required by VS Code webviews
- defined typed layout request/result contracts with request IDs, measured dimensions, viewport size, directional depths, edge types, prior positions, settings, bounds, and obstruction status
- added hidden DOM measurement using the actual graph node classes and current VS Code theme/font styles
- added pure rectangle center, boundary-intersection, expansion, segment-obstruction, and scene-bounds helpers
- added panel-lifetime position memory while keeping the worker stateless
- added latest-request-wins coordination so stale worker results cannot replace current geometry
- kept `sceneGeometry.ts` and the fixed renderer active while the worker foundation runs alongside them
- added focused unit coverage for geometry, provisional worker output, worker lifecycle, stale-result rejection, bundle wiring, CSP, and blob-worker loading

### Slice 15: Soft Depth-Band Layout

- replaced provisional worker placement with deterministic caller-left, focus-center, and callee-right soft depth bands
- preserved depth order while allowing prior-position preference, vertical movement, and bounded horizontal movement inside each band
- guaranteed non-overlapping node placement through per-band separation and compaction
- treated padded unrelated nodes as obstacles for normal straight edges while allowing edge crossings and excluding reciprocal edges from straight-edge obstruction checks
- added bounded repair retries that grow node spacing, band spacing, and plot dimensions
- enforced graph-size time budgets from approximately 150 ms for small graphs to 750 ms for large graphs
- returned the best non-overlapping candidate with explicit obstruction status when no fully clear placement was found before the deadline
- added focused unit coverage for depth ordering, overlap prevention, prior-position preference, deterministic output, obstacle repair, and timeout fallback
- clarified soft-band placement after visual review: semantic shortest-path depth
  remains unchanged, while visible same-side call chains receive hierarchy-aware
  layout sub-ranks so upstream callers spread farther left and downstream
  callees spread farther right
- collapsed same-side cycles before assigning layout sub-ranks, keeping cyclic
  nodes stable without unbounded horizontal expansion

### Slice 16: Variable Nodes and Vector Edges

- made worker layout results the authoritative live-rendering geometry and removed host-generated scene data
- rendered HTML nodes at measured widths and heights with complete non-wrapping two-line labels
- applied the approved `12pt` function label, `9pt` file/line label, `4px` radius, and customizable caller/focus/callee role colors
- rendered normal SVG edges as straight boundary-to-boundary vectors using worker-provided endpoints
- added continuous `10pt` arrowheads whose tips share the exact edge endpoint
- rendered reciprocal directions as two solid quadratic curves on opposite sides of one shared node pair
- removed fixed node dimensions, fixed columns, role-group elements, fake `None` states, and normal cubic routing
- normalized worker coordinates into one shared positive HTML/SVG scene while retaining obstruction-warning state
- deleted obsolete `sceneGeometry.ts` and replaced its fixed-column tests with measured-node and vector-edge contract tests

## Next Planned Work

1. Slice 17: full-graph fit and navigation
2. Slice 18: toolbar, minimap, hover, overlays, and CSS polish
3. Slice 19: fallback, performance, and integration hardening

See `docs/python-call-graph-vertical-slices.md`.

## Verification Baseline

Run from `call-graph/`:

```sh
npm run compile
npm run test:unit
```

`npm test` also launches VS Code Electron and may require unsandboxed execution.

Existing browser behavior still needs manual or automated integration coverage for pointer delivery, zoom, minimap appearance, toolbar interaction, overlay presentation, and source-navigation interaction.

Verification completed on 2026-06-23 from `call-graph/`:

- `npm run compile-tests` passed.
- `npm run test:unit` passed with 73 tests.
- `npm run compile` passed, including type checking, linting, and all four esbuild bundles.
- VS Code Electron integration tests were not run; they are not required by the Slice 16 verification contract. Final visual validation of browser font metrics, theme contrast, and SVG arrowhead appearance remains an integration gap.

## Important Files

- `call-graph/src/extension.ts`
- `call-graph/src/graph/buildFocusedGraph.ts`
- `call-graph/src/graph/GraphSessionState.ts`
- `call-graph/src/graph/types.ts`
- `call-graph/src/webview/CallGraphPanel.ts`
- `call-graph/src/webview/html.ts`
- `call-graph/src/webview/renderGeometry.ts`
- `call-graph/src/webview/zoomGeometry.ts`
- `call-graph/src/webview/client/`
- `call-graph/src/webview/layout/`
- `call-graph/src/webview/layout/softDepthBandLayout.ts`
- `call-graph/src/webview/styles.css`
- `call-graph/src/test/analyzer/`
- `call-graph/src/test/webview/`

Worker layout and render geometry are now connected. Slice 17 should build complete-graph fit and navigation on this geometry without restoring host-side scene calculation.
