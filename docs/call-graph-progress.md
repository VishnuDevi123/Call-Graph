# Call Graph Progress

Last updated: 2026-06-24

## Current Status

Slices 0–19 are implemented in `call-graph/`.

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
- complete-graph fitting with viewport-sized pan space
- panel-lifetime Back/Forward graph navigation
- polished toolbar, minimap, hover emphasis, centered overlays, and organized tunable CSS
- layout failure fallback with centered Retry/Refresh actions and offline packaging checks

The live UI now fits the complete worker-owned graph after initial layout, refocus, depth changes, and Reset View. Explicit node-click exploration supports panel-lifetime Back/Forward history without recording automatic cursor refocus. Slice 19 hardened the layout path: stale worker results and stale worker errors cannot replace current geometry, worker timeout fallback remains bounded and non-overlapping, layout failures keep the previous graph visible with centered Retry/Refresh recovery actions, and packaging checks confirm the production webview/worker require no runtime network access. The approved replacement UI contract is in:

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

### Slice 17: Full-Graph Fit and Navigation

- fit the complete scene after initial layout, refocus, depth changes, and Reset View
- separated manual pointer-centered zoom limits of `50%–200%` from the automatic fit floor of `10%`
- added one current viewport of pan space on every side of graph content
- kept pointer-centered manual zoom stable after adding viewport pan margins
- added a `240ms` fit transform and smooth viewport transition with reduced-motion handling
- added panel-lifetime Back/Forward history for explicit graph-node navigation across files
- kept automatic editor cursor refocus out of navigation history and Forward destinations
- cleared Forward history when a new node is selected after navigating Back
- enabled and disabled Back/Forward toolbar controls from extension-host history state
- added focused unit coverage for fit bounds, automatic/manual zoom limits, pan margins, pointer stability, and navigation-history invariants

### Pre-Slice-18 Cleanup: Zoom and Layout Tuning

- kept the normal manual wheel zoom floor at `50%` while allowing wheel zoom-out to return to the current auto-fit scale when a complete-graph fit lands below `50%`
- preserved the automatic fit floor near `10%`
- softened prior-position vertical influence in `softDepthBandLayout.ts` so previous coordinates reduce motion without scattering tiny unobstructed graphs
- tuned default webview layout spacing to more compact depth bands while preserving caller-left, focus-center, callee-right placement and deeper outward ordering
- capped hierarchy-aware layout sub-bands at the selected depth so depth 2 does not visually present as an extra outward level
- limited the user-facing routing warning to actual rendered edge intersections with unrelated node rectangles instead of invisible safety-padding near misses
- added focused unit coverage for the fitted-scale wheel floor, tiny graph vertical coherence, compact depth differentiation, selected-depth band caps, and padding-only routing near misses

### Pre-Slice-18 Layout Tuning: Relationship-Aware Rows

- kept semantic graph depth and horizontal soft-band assignment intact while adding row preferences for connected nodes across adjacent depth bands
- aligned unobstructed caller and callee chains vertically where that reduces edge steepness without overriding overlap separation or obstruction repair
- kept prior positions as secondary soft preferences so refocus stability does not scatter tiny graphs or overpower relationship clarity
- preserved horizontal depth ordering and selected-depth band caps, including the depth-2 cap that prevents an extra outward visual band
- tightened the routing warning so rendered-edge boundary contact does not count; warnings require an actual straight-edge intersection through an unrelated visible node rectangle
- added focused unit coverage for connected caller/callee row alignment, horizontal ordering during row alignment, no-overlap preservation, tiny graph coherence, selected-depth caps, padding-only near misses, boundary-only contact, and actual edge-through-node warning cases

### Pre-Slice-18 Layout Refactor: Focused Helpers

- split `softDepthBandLayout.ts` into an orchestration layer plus focused helper modules for rank calculation, row placement preferences, and obstruction repair/detection
- moved hierarchy-aware rank calculation and same-side cycle collapse into `layoutRanks.ts`
- moved relationship-aware row ordering, previous-position softness, and vertical separation into `layoutRows.ts`
- moved padded obstruction repair and strict rendered-edge warning checks into `layoutObstructions.ts`
- preserved existing layout behavior and test coverage while avoiding the corridor-scoring experiment that made deeper graphs visually unstable

### Slice 18: UI Controls and Polish

- polished toolbar button, disabled, hover, active, and keyboard-focus styling while keeping zoom percentage visible in the toolbar
- made the minimap visible by default, collapsible from the toolbar, and draggable only by a distinct handle so canvas panning and minimap movement are not confused
- preserved minimap position across depth changes, graph redraws, and Reset View for the current panel lifetime; closing the panel resets the position naturally with the webview
- added hover emphasis for connected nodes and edges with subtle dimming for unrelated graph elements, while retaining focus-node priority and full node tooltips
- added centered operational overlays for first load, updating/refocus, stale-data host warnings, empty graph/workspace, routing warnings, and layout-worker failures
- added reduced-motion handling for fit transitions, hover/focus transitions, reveal animations, and the CSS-only loading throbber
- reorganized `styles.css` into documented sections for theme variables, toolbar, canvas, nodes, edges, minimap, overlays, motion, and reduced-motion overrides
- kept the canvas background tied to `--vscode-editor-background` through a tunable `--bg` CSS variable
- added focused unit coverage for Slice 18 browser-module wiring, minimap drag separation, overlay states, hover classes, and tunable CSS sections

### Slice 19: Layout Hardening

- kept previous rendered graph geometry visible when the layout worker reports a failure
- added centered Retry and Refresh actions to layout/error overlays; Retry reruns layout against the current graph, while Refresh requests a host-side index rebuild
- verified latest-request-wins behavior for rapid request changes, including stale layout errors
- expanded layout coverage for timeout best-result fallback, large measured labels, dense graphs, reciprocal cycles, one-sided graphs with an outermost focus node, and uneven render bounds
- reviewed obsolete UI and dependency surface with tests that reject test-filter remnants, fixed-scene ownership, `rbush`, and runtime network APIs in the production webview/worker path
- kept the layout dependency-free; `rbush` was not added because the bounded obstacle checks pass the current dense-graph and timeout coverage without profiling evidence that an index is needed

## Next Planned Work

No additional vertical slice is currently listed in `docs/python-call-graph-vertical-slices.md`.

See `docs/python-call-graph-vertical-slices.md`.

## Verification Baseline

Run from `call-graph/`:

```sh
npm run compile
npm run test:unit
```

`npm test` also launches VS Code Electron and may require unsandboxed execution.

Existing browser behavior still needs manual or automated integration coverage for pointer delivery, zoom, minimap appearance, toolbar interaction, overlay presentation, and source-navigation interaction.

Verification completed on 2026-06-24 from `call-graph/`:

- `npm run compile` passed, including type checking, linting, and all four esbuild bundles.
- `npm run compile-tests` passed.
- `npm run test:unit` passed with 102 tests after adding Slice 19 layout hardening coverage.
- VS Code Electron integration tests were not run; they are not required by the Slice 19 verification contract. Browser-level validation of pointer delivery, minimap dragging feel, overlay action presentation, hover behavior, and source-navigation interaction remains an integration gap.

## Important Files

- `call-graph/src/extension.ts`
- `call-graph/src/graph/buildFocusedGraph.ts`
- `call-graph/src/graph/GraphSessionState.ts`
- `call-graph/src/graph/types.ts`
- `call-graph/src/webview/CallGraphPanel.ts`
- `call-graph/src/webview/NavigationHistory.ts`
- `call-graph/src/webview/html.ts`
- `call-graph/src/webview/renderGeometry.ts`
- `call-graph/src/webview/zoomGeometry.ts`
- `call-graph/src/webview/client/`
- `call-graph/src/webview/layout/`
- `call-graph/src/webview/layout/softDepthBandLayout.ts`
- `call-graph/src/webview/layout/layoutObstructions.ts`
- `call-graph/src/webview/layout/layoutRanks.ts`
- `call-graph/src/webview/layout/layoutRows.ts`
- `call-graph/src/webview/styles.css`
- `call-graph/src/test/analyzer/`
- `call-graph/src/test/webview/`

Worker layout, render geometry, full-graph fit, panel navigation, UI polish, and Slice 19 hardening are connected. Future work should preserve the dependency-free local worker path and avoid expanding V1 graph semantics unless a new approved slice requires it.
