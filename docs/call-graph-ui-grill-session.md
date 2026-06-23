# Call Graph V1 UI Decisions

Status: Approved UI and architecture source

This document records the UI decisions from the new grill session. It replaces conflicting UI assumptions only after user approval.

## Graph Layout

- Callers appear left of the focused node; callees appear right.
- Focused node is visually dominant. Full-graph visibility takes priority over exact viewport centering.
- Initial placement follows call depth:
  - deeper callers move farther left
  - deeper callees move farther right
- Depths use soft horizontal bands, not rigid columns.
- Nodes may move vertically and slightly horizontally within their band.
- Layout priorities:
  1. no edge passes through an unrelated node
  2. no node overlap
  3. preserve depth order
  4. reduce edge crossings
  5. avoid wasted space
- Edge crossings are allowed.
- Layout may increase spacing and canvas size for complex graphs.
- Obstruction avoidance uses bounded attempts so layout cannot run forever.
- Refocusing preserves existing node positions where practical, then fits the complete graph, even if the focused functions moves to extreme left if there are no callers to it but only callees or extreme right if there are not callee but only callers

## Nodes

- Nodes are rectangular with a subtle `4px` corner radius.
- Role colors:
  - caller: indigo `#6366F1`
  - focus: rose `#F43F5E`
  - callee: teal `#14B8A6`
- Colors remain easy to customize.
- Node content uses two complete, single-line labels:
  1. qualified function name at `12pt`
  2. `filename.py:line` at `9pt`
- No wrapping or truncation.
- Node width fits the longer text line plus comfortable padding.
- Full labels may create wide nodes.

## Edges

- Normal edges are single straight vector lines.
- No cardinal, orthogonal, bent, or curved routing for normal edges.
- Each edge starts and ends where the center-to-center vector intersects the node boundaries.
- Attachment may occur anywhere on a node boundary.
- Arrowhead size defaults to `10pt`.
- Arrowhead and line must appear as one continuous component.
- Default edge style:
  - normal: `1.5px`, theme foreground at `55%` opacity
  - highlighted: `2px`, theme foreground at `90%` opacity
- These values remain easy to customize.

## Cycles

- A function involved on both caller and callee sides appears once.
- Reciprocal calls use two curved, solid, same-color edges.
- Curves separate into an oval-like loop with one arrowhead per direction.
- If caller and callee depth are equal, place the shared node on the callee/right side.

## Canvas and Viewport

- Canvas color follows `--vscode-editor-background`.
- Canvas color is exposed through a customizable CSS variable.
- Content bounds come from the outermost left, right, top, and bottom nodes.
- Pan space adds:
  - one viewport width on both left and right
  - one viewport height on both top and bottom
- Mouse wheel and trackpad zoom around the pointer.
- Manual zoom defaults to `50%–200%`; automatic full-graph fit may use a tunable floor near `10%`.
- Toolbar displays current zoom percentage.
- Reset View fits the complete graph without changing graph state.

## Toolbar

V1 toolbar controls:

- Back
- Forward
- Refresh
- Reset View
- Depth Left
- Depth Right
- Minimap toggle
- Zoom percentage

Buttons use polished styling with a background slightly lighter than the toolbar. Hover, active, disabled, and keyboard-focus states must remain clear.

The `Include Tests` control is removed from V1. Test relationships remain included by default. Filtering may return later.

## Minimap

- Visible by default at bottom-right.
- Toolbar button collapses and expands it.
- User can drag it smoothly within the graph viewport.
- A dedicated drag handle distinguishes minimap movement from canvas panning.
- Reset View and depth changes preserve its position.
- Its position lasts only for the current graph panel.
- Closing the panel resets it; a new panel starts at bottom-right.

## Interaction and Motion

- Hovering a node highlights directly connected nodes and edges.
- Unrelated graph elements dim subtly.
- Focus remains visually dominant.
- Focus and layout transitions use a tunable `200–300ms` duration.
- Node movement and viewport centering animate smoothly.
- Reduced-motion preference disables or simplifies movement.

## Operational States

Operational messages appear as centered overlays, not toolbar text.

- Updating/refocusing:
  - keep current graph visible
  - subtly dim background
  - show short text and a CSS-only throbber
- First load:
  - show centered loading overlay
- No relationships:
  - show focused node alone
  - do not add fake context nodes
- Temporary syntax error:
  - keep last valid graph
  - show centered stale-data warning
- No Python files or workspace:
  - show concise centered message with Refresh action
- Layout failure:
  - keep previous graph
  - show centered error with Retry or Refresh

Reduced-motion mode uses a static loading indicator. These overlays are lightweight and load only when the graph webview opens.

## CSS Organization

Keep webview CSS grouped and easy to edit:

- theme and color variables
- typography
- toolbar and buttons
- canvas and viewport
- nodes and role states
- edges and arrows
- minimap
- overlays and loading states
- hover, focus, and motion
- reduced-motion overrides

## Tunable Defaults

These are starting values, not permanent product constraints:

- role colors
- canvas color
- `4px` node radius
- `12pt` function text
- `9pt` file/line text
- node padding
- `10pt` arrowhead
- edge width and opacity
- zoom range
- animation duration
- layout spacing
- obstruction-attempt limit

## Implementation Architecture

### Rendering

- Use HTML for graph nodes, toolbar controls, and operational overlays.
- Use one SVG layer for:
  - straight normal edges
  - curved reciprocal-cycle edges
  - arrowheads
  - minimap content
- Use one CSS transform for whole-scene zoom.
- Do not use the Canvas API.

### Layout Worker

- Run layout in a dedicated local browser Web Worker.
- The worker uses pure TypeScript geometry.
- Do not use ELK, D3, Cytoscape, React, or another layout/UI framework.
- Consider `rbush` only if measured obstacle-check performance requires it.
- Keep the worker stateless.
- The main webview thread sends previous node positions with each request.
- Latest layout request wins; stale worker results are discarded.
- Closing the graph panel clears previous-position memory.

### Text Measurement

- Measure node labels in the main webview using hidden DOM elements.
- Measurements use the actual VS Code font, current theme, configured text sizes, and CSS padding.
- The longer of the two text lines determines node width.
- Send exact measured node dimensions to the worker.
- Remeasure after relevant font, theme, or style changes.

### Worker Input

Each layout request should include:

- graph nodes and edges
- caller/callee depth and role data
- explicit normal or reciprocal-cycle edge type
- measured node dimensions
- previous node positions
- viewport dimensions
- layout spacing and safety-padding settings
- request identifier

### Worker Output

Each successful result should include:

- node positions
- normal-edge boundary endpoints
- reciprocal-cycle curve geometry
- final content bounds
- obstruction status
- request identifier

## Layout Algorithm Contract

- Start from depth-based soft horizontal bands.
- Deeper callers remain generally farther left.
- Deeper callees remain generally farther right.
- Nodes may move vertically and slightly horizontally within their band.
- Previous positions are placement preferences, not hard constraints.
- Treat every node rectangle plus safety padding as an obstacle.
- A normal straight edge is valid only when it avoids every unrelated obstacle.
- Edge crossings are allowed.
- Expand band spacing, node spacing, and plot dimensions during retries.
- Stop immediately when a valid placement is found.
- Use a high bounded retry count, scaled by graph size.
- Apply a worker time budget:
  - small graph: approximately `150ms`
  - large graph: up to approximately `750ms`
- If time expires, return the best non-overlapping node placement.
- If some edges still intersect unrelated nodes, keep the graph usable and show a centered routing warning.
- Retry limits, time budgets, spacing growth, and safety padding remain tunable.

## Graph and UI Ownership

### Graph Builder

- Detect reciprocal and cyclic relationships before UI layout.
- Mark edge type explicitly.
- Keep graph semantics outside the layout worker.

### Main Webview Thread

- Measure node text.
- Own current zoom and viewport state.
- Own previous node positions.
- Own minimap position and collapsed state.
- Coordinate worker requests and reject stale results.
- Render HTML nodes, SVG edges, overlays, and controls.

### Extension Host

- Own Back/Forward navigation history while the panel is open.
- Clear Forward history after new node navigation.
- Do not add automatic editor-cursor focus changes to history.
- Clear Back/Forward history when the graph panel closes.

## Fit and Plot-Area Rules

- Initial display fits the complete graph.
- Every node refocus fits the complete new graph.
- Reset View fits the complete graph.
- Complete graph visibility has priority over exact focus centering.
- Center focus only when compatible with complete graph visibility.
- Auto-fit transitions animate over `200–300ms`.
- Reduced-motion mode applies fit immediately.
- Auto-fit may zoom below the normal manual range to a tunable floor near `10%`.
- Manual zoom defaults remain tunable around `50%–200%`.
- Plot bounds consider every node, including the focused node.
- The focused node may itself be the leftmost, rightmost, topmost, or bottommost node.
- Final pan space adds one viewport width left/right and one viewport height top/bottom around the complete content bounds.

## State Lifetime

- Previous layout positions last only while the panel is open.
- Back/Forward history lasts only while the panel is open.
- Minimap position and collapsed state last only while the panel is open.
- Reset View and depth changes do not reset minimap position.
- Closing and reopening the panel resets these UI states.



### Keep and Adapt

- `src/webview/html.ts`
  - retain secure CSP shell and resource wiring
  - add local worker resource support
- `src/webview/CallGraphPanel.ts`
  - retain extension/webview message bridge
  - add navigation-history and panel-lifetime behavior
- `src/webview/client/index.ts`
  - retain as webview coordinator
  - replace direct synchronous layout with worker coordination
- `src/webview/client/graphRenderer.ts`
  - rewrite for measured variable-size nodes and new states
- `src/webview/client/edges.ts`
  - rewrite for straight vectors, reciprocal curves, and continuous arrowheads
- `src/webview/client/controls.ts`
  - rewrite for approved toolbar
- `src/webview/client/minimap.ts`
  - extend for collapse and draggable placement
- `src/webview/client/panning.ts`
  - retain thresholded canvas panning
  - ensure minimap handle and all controls are excluded
- `src/webview/zoomGeometry.ts`
  - adapt for full-graph auto-fit, lower auto-fit floor, and generous pan margins
- `src/webview/styles.css`
  - reorganize into clearly labeled customizable sections
- `esbuild.js`
  - add an independent browser-worker bundle

### Replace

- Replace `src/webview/sceneGeometry.ts`.
- Remove its rigid fixed columns, fixed node sizes, role groups, and normal cubic Bézier routing.
- Split replacement geometry into focused pure modules, likely:
  - `src/webview/layout/types.ts`
  - `src/webview/layout/textMetrics.ts`
  - `src/webview/layout/depthBands.ts`
  - `src/webview/layout/placement.ts`
  - `src/webview/layout/edgeGeometry.ts`
  - `src/webview/layout/sceneBounds.ts`
  - `src/webview/layout/workerProtocol.ts`
  - `src/webview/layout/layoutWorker.ts`
  - `src/webview/client/layoutCoordinator.ts`
  - `src/webview/client/positionMemory.ts`

Exact filenames may change if a smaller structure remains clearer.

### Add

- Back/Forward control and history handling.
- Reset View and full-graph fit handling.
- Draggable/collapsible minimap behavior.
- Node hover connection highlighting.
- Centered operational overlays.
- Layout and auto-fit transitions.
- Worker failure and stale-result handling.

### Remove from V1

- `Include Tests` toolbar control, messages, and UI tests.
- Fake `None` caller/callee placeholders.
- Toolbar status messages.
- Fixed node widths and heights.
- Rigid depth columns.
- Normal curved or orthogonal edge routing.
- Fixed, non-draggable minimap positioning.
- Role-group reveal animation if it conflicts with the new layout.
- Any stashed Slice 13 ELK implementation; do not restore it.

Test relationships remain included by default. Only the V1 filter UI is removed.

## Dependency Policy

- Start with no new runtime UI or layout dependency.
- Use browser-native DOM, SVG, Web Worker, Pointer Events, and CSS APIs.
- Keep the worker locally bundled with no runtime network access.
- Add a geometry/spatial dependency only after profiling proves a need.
- If obstacle checks become a measured bottleneck, evaluate `rbush` as a small optional spatial index.

## Suggested Future Slice Boundaries


Each future slice should remove obsolete code only

- Propely link the editables values and files in the progress document after completion for each slice so that manual testing by the developer can be done.
