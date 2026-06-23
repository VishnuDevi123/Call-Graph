## Problem Statement

Python developers using VS Code need a precise, clean way to understand how functions and methods relate across a project. Today, finding callers, callees, and call paths often requires jumping through text search, language server references, or mental tracing across files. This is especially painful when a developer is focused on one function and wants to quickly see what calls it, what it calls, and where each relationship comes from.

The user needs a VS Code extension that presents Python caller/callee relationships in a dynamic graphical view while staying trustworthy. The graph should prioritize precision over completeness, avoid guessed edges, and keep the currently focused function visually primary.

## Solution

Build Call Graph as a Python-first VS Code extension that indexes the entire workspace using Tree-sitter-based static parsing and renders a focused call graph inside VS Code using an editor webview panel. The graph must appear in the VS Code editor workspace itself, not in an external browser window or separately launched web app.

The extension will maintain a workspace-wide index of user-defined Python functions, methods, async functions, nested functions, and per-file `<module>` pseudo-nodes. The first parser target is Python, but the parsing layer should be designed around Tree-sitter grammars so future versions can add JavaScript, TypeScript, or other languages without replacing the extension architecture. The UI will focus on the active editor function when the cursor is inside or on a function body/name. If the cursor is outside any function, the UI will focus the active file's `<module>` node.

The graph will use a focus-relative directional layout:

`Callers -> Focused Function -> Callees`

The focused function is visually dominant. Direct callers and direct callees receive priority within the configured graph safety limit; if direct relationships alone exceed that limit, deterministic truncation and an omitted count keep the view bounded. Logical depth uses flexible horizontal bands: callers progress left and callees progress right, while nodes may shift within their bands to avoid overlap and keep straight edges from crossing unrelated nodes. A local TypeScript Web Worker performs layout without ELK or another UI/layout framework.

External and unresolved calls remain analyzer classifications but are not shown as graph sections in the primary UI. Clicking a function node navigates to its source and makes it the new focus while retaining caller and callee depths. Initial load, refocus, and Reset View fit the complete graph; complete visibility takes priority over exact focus centering. Clicking empty graph space does nothing. Dragging empty graph space pans without changing source focus.

While the graph is visible, the extension will update affected index data on save and manual refresh. When the graph is closed or hidden, it records lightweight dirty-file state and reconciles those changes when the graph becomes visible again. The active unsaved file will be reparsed in memory after an adaptive debounce so newly implemented functions can appear quickly without requiring a full workspace reindex.

## User Stories

1. As a Python developer, I want to open a call graph for my current workspace, so that I can understand function relationships across the project.
2. As a Python developer, I want the graph to focus on the function under my cursor, so that I can inspect the code I am actively working on.
3. As a Python developer, I want the focused function to be visually dominant, so that I can immediately orient myself in the graph.
4. As a Python developer, I want direct callers prioritized around the focused function, so that I can understand who depends on it without creating an unbounded graph.
5. As a Python developer, I want direct callees prioritized around the focused function, so that I can understand what it depends on without creating an unbounded graph.
6. As a Python developer, I want callers on the left and callees on the right, so that call direction is easy to read.
7. As a Python developer, I want the graph to include functions from the whole workspace, so that cross-file relationships are visible.
8. As a Python developer, I want the active file to update while I am editing, so that newly written functions can appear without a full refresh.
9. As a Python developer, I want the workspace index to update on save, so that the graph stays aligned with the project.
10. As a Python developer using auto-save, I want save-based updates to work with my editor settings, so that I do not need a separate workflow.
11. As a Python developer, I want a manual refresh command, so that I can force the index to rebuild when needed.
12. As a Python developer, I want unresolved calls retained as analyzer data without cluttering the graph UI, so that precision and diagnostics remain possible.
13. As a Python developer, I want external library calls classified internally without rendering them as graph nodes or primary UI sections.
14. As a Python developer, I want wrong or guessed edges excluded from the main graph, so that I can trust what I see.
15. As a Python developer, I want method calls resolved when the receiver type is clear locally, so that common object-oriented code is represented accurately.
16. As a Python developer, I want `self.method()` calls resolved within a class, so that class internals are easy to inspect.
17. As a Python developer, I want locally constructed objects such as `service = EmailService()` resolved conservatively, so that obvious method calls are connected.
18. As a Python developer, I want annotated local variables resolved when clear, so that typed Python code produces better graphs.
19. As a Python developer, I want dynamic or ambiguous calls excluded from the graph, so that the graph does not mislead me.
20. As a Python developer, I want file-scope calls represented by a `<module>` node, so that scripts and import-time behavior are visible.
21. As a Python developer, I want `if __name__ == "__main__"` calls represented under the module node, so that entrypoints are easy to inspect.
22. As a Python developer, I want top-level functions shown as graph nodes, so that procedural code is supported.
23. As a Python developer, I want class methods and static methods shown as graph nodes, so that object-oriented code is supported.
24. As a Python developer, I want async functions and async methods shown as graph nodes, so that async Python projects are supported.
25. As a Python developer, I want nested functions indexed as user-defined functions, so that locally defined behavior is not lost.
26. As a Python developer, I want function identity to survive line shifts, so that the graph remains stable after edits.
27. As a Python developer, I want graph nodes to navigate to source code on click, so that the graph is useful for code navigation.
28. As a Python developer, I want clicking a caller or callee to refocus the graph, so that I can traverse relationships naturally.
29. As a Python developer, I want to drag the graph background to pan the viewport, so that I can inspect a graph larger than the visible editor area without changing source focus.
30. As a Python developer, I want cursor movement to refocus the graph after a debounce, so that the view follows my work without flickering.
31. As a Python developer, I want smooth animation when the focused function changes, so that graph movement is understandable.
32. As a Python developer, I want commands for opening and focusing the graph, so that the extension fits normal VS Code workflows.
33. As a Python developer, I want commands for revealing callers and callees, so that I can quickly inspect one side of the relationship.
34. As a Python developer, I want reveal commands to open the graph if needed, so that commands behave predictably from any editor state.
35. As a Python developer, I want test files included by default, so that callers from tests are visible.
36. As a Python developer, I want test relationships included in V1 without an extra graph filter.
37. As a Python developer, I want syntax errors to avoid wiping the existing graph, so that temporary broken code does not destroy context.
38. As a Python developer, I want parse errors shown non-blockingly, so that I understand why some data is stale or unavailable.
39. As a Python developer, I want common virtual environment and build folders ignored, so that indexing is fast and relevant.
40. As a Python developer, I want indexing progress feedback, so that I understand what the extension is doing on larger projects.
41. As a Python developer, I want large workspace indexing to be cancellable, so that the extension does not trap me in a long operation.
42. As a Python developer, I want multiple call sites aggregated into one edge, so that the graph remains readable.
43. As a Python developer, I want aggregated edges to retain all call sites as metadata, so that every occurrence remains available for diagnostics without cluttering the main graph.
44. As a Python developer, I want resolution reasons retained as analyzer metadata, so that relationships remain explainable without adding visual noise to the main graph.
45. As a Python developer, I want import-based calls resolved precisely, so that cross-file call relationships are useful.
46. As a Python developer, I want relative imports resolved when clear, so that package-local modules work correctly.
47. As a Python developer, I want wildcard imports and dynamic imports treated as unresolved, so that the graph stays precise.
48. As a Python developer, I want files outside the workspace treated as external, so that indexing remains bounded.
49. As a Python developer, I want the graph to work well for small-to-medium projects, so that it is useful for real projects from v1.
50. As a Python developer, I want the graph UI to be neat and clean, so that it helps me reason instead of creating visual noise.
51. As a Python developer, I want flexible depth bands and straight vector edges that avoid unrelated nodes.
52. As a Python developer, I want caller and callee depth settings preserved when focus changes, so that navigation does not repeatedly reset my exploration scope.
53. As a Python developer, I want Back and Forward graph navigation across files, so that I can retrace node-click exploration.
54. As a Python developer, I want Reset View to fit the complete graph without changing graph state.
55. As a Python developer, I want connected nodes and edges highlighted on hover, so that dense relationships are easier to inspect.
56. As a Python developer, I want repeated call sites represented by one edge with an optional count, so that density remains manageable.
57. As a Python developer, I want the extension to consume effectively no CPU while its graph is closed or hidden.
58. As a Python developer, I want indexing and layout work to remain cancellable and non-blocking, so that Call Graph does not make VS Code unresponsive.
59. As a Python developer, I want large active files handled conservatively, so that live analysis does not introduce typing latency.
60. As a privacy-conscious developer, I want performance diagnostics to exclude source code and file contents and to run only when explicitly requested.

## Implementation Decisions

- The generated extension project lives in `call-graph/` under this workspace.
- The extension package identifier is `call-graph`.
- The public display name is `Call Graph`.
- The generated extension uses TypeScript, npm, and esbuild.
- The extension host entrypoint is bundled to `call-graph/dist/extension.js` from `call-graph/src/extension.ts`.
- The generated scaffold recommends `dbaeumer.vscode-eslint`, `connor4312.esbuild-problem-matchers`, and `ms-vscode.extension-test-runner` for local development.
- Local setup requires a VS Code version compatible with `call-graph/package.json` `engines.vscode`; updating VS Code resolved the initial Extension Development Host command visibility issue.
- `call-graph/tsconfig.json` includes `DOM` in `compilerOptions.lib`, which is useful as the project adds webview/browser-facing code.
- The first supported language is Python.
- Analysis will use Tree-sitter-based static parsing owned by the extension.
- Python is the first supported grammar, but the parser abstraction should allow future Tree-sitter grammars for languages such as JavaScript and TypeScript.
- The extension will not depend on Pylance internals for v1.
- The index scope is the entire VS Code workspace.
- The graph focus scope is the active file and current function or method.
- All user-defined workspace functions and methods are indexable nodes.
- Graph nodes include top-level functions, instance methods, class methods, static methods, async functions, async methods, nested functions, and per-file `<module>` pseudo-nodes.
- External/library functions are not primary graph nodes in v1.
- The main graph prioritizes precision over recall.
- Only high-confidence call edges are rendered in the graph.
- Unresolved and external calls remain internal analyzer classifications and are not drawn as graph edges, primary graph nodes, or primary UI sections.
- Multiple call sites between the same source and target are aggregated into one graph edge.
- Edge data retains source call sites, call expressions, and the reason the relationship was resolved.
- Resolution reasons are analyzer/debug metadata and are not rendered as labels in the main graph.
- Function node identity is based on workspace-relative file path, qualified name, and node kind.
- Line ranges are metadata for navigation, not primary identity.
- The resolver supports high-confidence imports, including direct imports, module imports, relative imports, same-file calls, and clear class references.
- The resolver avoids dynamic imports, wildcard imports, monkey-patching, dependency-injected types, and ambiguous calls in the main graph.
- The resolver supports conservative local inference only.
- Conservative local inference includes local construction like `x = ClassName()`.
- Conservative local inference includes `self.method()` inside the same class.
- Conservative local inference includes clear `cls.method()` class method references.
- Conservative local inference includes local annotations such as `service: EmailService`.
- The default graph view prioritizes direct callers and direct callees of the focused node within the configured graph-size limit.
- Recursive caller and callee expansion is controlled by two global, whole-side controls: `Depth Left` applies one caller depth to every caller path, and `Depth Right` applies one callee depth to every callee path.
- Recursive expansion is bounded by configurable depth, cycle detection, deduplication, and a graph-size limit.
- Deeper relationships are shown when the user changes `Depth Left` or `Depth Right` from the default depth of `1`.
- Both directional depths initialize to `1` when a graph session starts.
- A directional depth value applies uniformly to all visible and discoverable paths on that side; depth is not configured per node or per branch.
- Recursive expansion is not part of the default view.
- Caller and callee depth values persist across focus changes until the user changes them.
- The layout is directional: callers on the left, focused node in the center, callees on the right.
- Logical caller depth progresses farther left and logical callee depth progresses farther right, but nodes are not forced onto one exact X-coordinate per depth.
- Logical depth defines a soft horizontal band. Nodes may move vertically and slightly horizontally inside their band.
- Layout priorities are: avoid edge-through-node intersections, avoid node overlap, preserve depth order, reduce edge crossings, then reduce wasted space.
- Edge crossings are allowed.
- The layout may increase node spacing, band spacing, and plot size as graph complexity grows.
- Every node rectangle plus configurable safety padding is an obstacle for unrelated normal edges.
- A source identity involved on both sides through a reciprocal call appears once. Equal-depth ties place it on the callee/right side.
- Node dimensions come from hidden DOM measurement using the actual rendered font and CSS.
- Nodes show two complete single-line labels: qualified function name at `12pt`, then `filename.py:line` at `9pt`.
- Labels do not wrap or truncate. Node width fits the longer line plus padding.
- Nodes use rectangular role styling with a subtle `4px` corner radius.
- Default role colors are caller indigo `#6366F1`, focus rose `#F43F5E`, and callee teal `#14B8A6`; CSS variables keep them customizable.
- Normal edges are single straight vectors. They attach where the center-to-center vector intersects each rectangle boundary.
- Normal edges do not bend, curve, or use orthogonal/cardinal routing.
- Reciprocal calls use two solid, same-color curved edges that separate into an oval-like loop.
- Arrowheads default to `10pt` and visually join their edge line without a gap.
- Default edge styling is `1.5px` at `55%` opacity and `2px` at `90%` when highlighted.
- Plot bounds include every node, including a focus node that may be any outermost node.
- The plot adds one viewport width left/right and one viewport height top/bottom beyond content bounds.
- Initial load, refocus, and Reset View fit the complete graph. Complete visibility takes priority over exact focus centering.
- Auto-fit may zoom to a tunable floor near `10%`; normal manual zoom defaults to `50%–200%`.
- Caller, focused, and callee nodes use distinct customizable colors.
- The canvas defaults to `--vscode-editor-background` through a customizable CSS variable.
- Large `CALLERS`, `FOCUSED FUNCTION`, and `CALLEES` headings are not rendered.
- `<module>` nodes use distinct file/module treatment.
- `<module>` nodes appear when actual file-scope calls participate in the visible graph or when the editor focus itself is the active file module. A callerless function does not receive a fallback module-context node.
- Method nodes use class-qualified labels such as `Class.method`.
- Function and method nodes render exactly two primary text lines: the qualified function name, then `filename.py:line`.
- Main graph edges render without resolution-reason text labels.
- The graph opens inside the VS Code editor workspace as a `WebviewPanel`, not in the user's external browser.
- The webview is a minimal graph-focused surface with nodes, edges, Back, Forward, Refresh, Reset View, depth controls, zoom percentage, and a minimap toggle.
- Single-clicking a function node navigates the editor to that function and makes it the focused graph node.
- Single-clicking the current focused node navigates the editor to that function without changing graph focus.
- Node-click focus changes are recorded in workspace-session Back/Forward history, including navigation across files.
- Automatic editor-cursor focus changes do not enter Back/Forward history.
- Back and Forward controls are disabled and visually subdued when unavailable.
- Navigating to a new node after moving Back clears the Forward stack.
- Navigation history resets when the graph panel closes.
- Single-clicking empty graph space does nothing.
- Pressing and dragging empty graph space pans the viewport horizontally and vertically.
- Canvas panning starts only after a small movement threshold; pressing and releasing without movement remains a no-op.
- Canvas panning uses pointer capture so dragging continues when the pointer leaves the graph canvas.
- Canvas panning does not begin from nodes, toolbar controls, popovers, or the minimap.
- Canvas panning works at every supported zoom level and updates the minimap viewport without rebuilding or refocusing the graph.
- The canvas uses `grab` icon when user holds left click and starts moving the cursor.
- Single-clicking an edge does not navigate in v1.
- Editor cursor changes auto-refocus the graph after a debounce.
- Refocus only occurs when the cursor enters a different function, method, or module node.
- A focus change keeps the existing graph visible while a centered overlay shows updating state with subtle background dimming and a lightweight throbber.
- Shared node positions are preserved where practical before the complete new graph is fitted.
- Focus and auto-fit transitions use a tunable `200–300ms` duration.
- Motion honors the reduced-motion preference.
- The extension should avoid rebuilding the entire webview for focus-only changes.
- Reset View smoothly fits the complete graph while preserving focus, caller/callee depth, minimap state, and navigation history.
- Zoom must transform the graph as one fixed scene containing nodes, labels, edges, and arrowheads.
- Zoom must not independently resize text, reflow nodes, or recalculate edge geometry on each wheel event.
- `Depth Left` globally controls all caller paths and `Depth Right` globally controls all callee paths.
- Caller and callee depth controls support `1`, `2`, `3`, `4`, `5`, and `Max`; both default to `1`.
- `Max` traverses every safe path on that side up to cycle detection, deduplication, configured traversal limits, and the graph-size limit.
- Individual graph nodes do not expose caller/callee expand or collapse buttons.
- The default graph node limit is `30`. The configurable maximum remains `250`, with a warning that graphs above `100` nodes may lay out slowly.
- Visible-node priority is focused node, direct relationships, then deeper nodes in ascending depth.
- If direct relationships alone exceed the node limit, they are truncated deterministically by stable node identity and the UI reports the omitted count.
- Edge hover may show aggregated call count and source locations. Edge clicks remain inactive in v1.
- A repeated source-target relationship renders as one aggregated edge and displays a small count badge only when the call-site count is greater than one.
- Hovering a node highlights its incoming/outgoing edges and directly connected nodes, subtly dims unrelated graph elements, and exposes the full function name and file location in a tooltip.
- Webview UI code must be split into focused browser modules; `html.ts` should own only the secure document shell and resource wiring.
- Browser rendering, controls, panning, edges, minimap, and styles should not remain combined in one large inline HTML function.
- The graph UI includes a compact, theme-aware minimap visible by default at bottom-right.
- The minimap is collapsible from the toolbar and draggable through a distinct handle.
- Reset View and depth changes preserve minimap position. Position and collapsed state reset when the panel closes.
- Layout uses a dedicated local browser-worker bundle with pure TypeScript geometry and no runtime network access.
- V1 does not use ELK, D3, Cytoscape, React, Canvas rendering, or another UI/layout framework.
- HTML renders nodes, controls, and overlays; SVG renders edges, arrowheads, and minimap content.
- Strict CSP and webview resource roots explicitly allow only the locally bundled layout worker.
- Layout runs in that worker so graph controls and viewport interaction remain responsive.
- The stateless worker receives graph data, measured node sizes, viewport size, settings, and prior positions from the main webview thread.
- Layout and graph requests use latest-request-wins cancellation so stale focus or layout results are discarded.
- Layout stops on the first valid placement or at a size-based time budget of about `150ms` for small graphs and up to `750ms` for large graphs.
- If perfect routing is unavailable, the worker returns the best non-overlapping placement and the UI shows a centered routing warning.
- Operational loading, stale-data, empty-workspace, and layout-failure messages appear as centered overlays, not toolbar status text.
- While the graph is visible, affected workspace index data updates on save and manual refresh.
- Active unsaved file analysis updates from the in-memory editor buffer after a debounce.
- Active unsaved-file updates are scoped only to the active file.
- Saving commits active-file analysis into the workspace index.
- Save-based updates naturally support VS Code auto-save.
- Extension activation and initial indexing remain command-triggered; opening a workspace does not automatically start indexing.
- Live parsing, graph rebuilding, rendering, and layout are suspended while the graph panel is closed.
- While the panel is hidden, only lightweight file-change tracking remains active; unsaved parsing, rendering, and layout resume when the panel becomes visible.
- The webview does not use `retainContextWhenHidden`. Lightweight session state is retained by the extension host and restored when the webview becomes visible.
- Changed files are marked dirty while work is suspended and reconciled when the graph is reopened or revealed.
- Full-workspace parsing and resolution run outside the extension-host thread.
- One extension-host coordinator manages a bounded pool of Node worker threads, chosen conservatively from available processors and capped at four workers.
- Saved-file updates maintain import dependency maps and re-resolve only the changed file and affected importers/imports. Manual refresh or structural uncertainty may trigger a full resolution pass.
- Active-file updates may remain on the extension-host thread when small enough for low-latency parsing.
- Parsed source text and Tree-sitter syntax trees are released after compact nodes, edges, imports, diagnostics, and navigation ranges are produced.
- The v1 index remains memory-only and is not persisted across VS Code sessions.
- Unsaved live analysis uses adaptive file-size limits: normal debounce below `500 KB`, longer debounce from `500 KB` through `2 MB`, and save/manual-refresh-only updates above `2 MB`.
- Common ignored folders include `.venv`, `venv`, `.tox`, `__pycache__`, `site-packages`, `build`, and `dist`.
- V1 formally targets small-to-medium projects up to approximately `1,000` Python files and degrades gracefully above that scale.
- Indexing should show progress feedback.
- Indexing should be cancellable for large workspaces.
- Test files are included by default.
- V1 does not include an `Include tests` UI filter.
- Syntax errors do not wipe the graph.
- The index keeps last good data for unaffected files.
- Active-file parse failures keep the current focused graph and show live analysis as temporarily unavailable.
- V1 commands are `Open Call Graph`, `Focus Call Graph on Current Function`, `Refresh Call Graph Index`, `Reveal Callers`, `Reveal Callees`, and a privacy-safe diagnostics command.
- `Reveal Callers` and `Reveal Callees` open the graph if closed.
- Reveal commands switch to the graph tab if already open.
- Reveal commands highlight or scroll the relevant caller/callee side.
- Reveal commands do not change the focused function unless the editor cursor is already in a different function.
- Initial public releases do not collect telemetry.
- A user-invoked diagnostics command may report timings, file counts, graph size, bundle/runtime versions, and errors, but must not include source code or file contents.

## Testing Decisions

- Tests should verify external behavior and user-visible contracts, not private implementation details.
- Analyzer tests should cover Python source parsing into user-defined nodes, `<module>` nodes, imports, call expressions, unresolved calls, and external calls.
- Resolver tests should cover high-confidence edge generation and ensure ambiguous calls are not rendered as graph edges.
- Resolver tests should cover same-file calls, direct imports, module imports, relative imports, `self.method()`, local `ClassName()` construction, clear `cls.method()`, and annotated local variables.
- Resolver tests should cover negative cases such as wildcard imports, dynamic imports, `getattr`, monkey-patching, ambiguous receiver types, dependency injection, and runtime reassignment.
- Index tests should cover workspace indexing, save-triggered updates, manual refresh, ignored folders, cancellation, syntax error handling, and last-good-data behavior.
- Active-file update tests should cover debounced in-memory parsing of the active unsaved file without reindexing the whole workspace.
- VS Code extension tests should cover command registration and behavior for opening, focusing, refreshing, revealing callers, revealing callees, and producing privacy-safe diagnostics.
- VS Code extension tests should cover editor cursor movement causing debounced graph refocus only when entering a different function or module node.
- Webview tests should cover soft depth bands, measured variable node dimensions, stable placement preferences, obstacle avoidance, and complete-graph bounds.
- Graph tests should cover bounded global caller/callee depth traversal, directional independence, cycles, shared paths, and graph-size limits.
- Webview tests should cover focused-node visual priority, node click navigation/refocus, complete-graph fitting, empty-canvas click no-op, canvas drag panning, Back/Forward history, Reset View, minimap collapse/dragging, hover emphasis, and operational overlays.
- Webview interaction tests should cover pan movement threshold, pointer capture, excluded interactive targets, zoom compatibility, and minimap synchronization.
- Webview tests should verify complete non-wrapping labels, separate file/line metadata, customizable role styling, and absence of visible resolution-reason edge labels.
- Graph tests should verify that callerless functions do not receive fallback `<module>` context nodes.
- Analyzer tests should continue verifying edge aggregation, call sites, and retained resolution-reason metadata.
- Layout tests should verify straight target-facing normal edges, unrelated-node obstacle clearance, allowed edge crossings, reciprocal oval-like curves, expanding spacing, complete bounds, and timeout fallback.
- Performance tests should use generated projects near the v1 target scale to verify indexing progress, cancellation, incremental invalidation, worker responsiveness, suspended hidden-panel work, and acceptable focus-change responsiveness.
- Public-release performance gates are:
  - packaged installation and activation require no runtime network access
  - idle CPU is effectively zero while the panel is closed or hidden
  - no live parsing occurs while the panel is closed or hidden
  - a 1,000-file cold index completes within 10 seconds on the target MacBook Pro
  - cancellation is observed within 250 ms
  - a typical focus-to-graph update completes within 200 ms
  - the UI remains interactive during indexing and worker layout
  - a default 30-node layout completes within 150 ms
  - memory returns close to baseline after closing or hiding the panel
  - production VSIX size, offline behavior, and bundled licenses are reviewed
- The reference benchmark workspace contains 1,000 Python files, approximately 4 KB per file, eight function-like nodes per file, and a deterministic mixture of same-file calls, direct imports, module imports, shared callees, and bounded cycles.
- Timing benchmarks run five measured iterations after one untimed warm-up and report median and p95.
- Release measurements use an Apple Silicon MacBook Pro with at least 16 GB RAM; exact hardware, macOS, VS Code, extension version, and benchmark fixture version are recorded.
- “Effectively zero” hidden/closed CPU means no Call Graph parsing, graph, or layout task is scheduled and average attributable CPU remains below 1% over a 30-second observation.
- “Close to baseline” memory means attributable memory returns, after a settling interval, to within the greater of 20% of the pre-panel baseline or 50 MB above it.
- Timing boundaries for cold indexing, cancellation, focus-to-graph, and layout are defined by the benchmark harness rather than manual observation.
- There is no existing codebase prior art in this workspace beyond the local skill files, so the first implementation should establish these testing seams directly.

## Out of Scope

- Language implementations other than Python in v1. The parser architecture should still leave room for future Tree-sitter grammars such as JavaScript and TypeScript.
- Deep type inference across arbitrary control flow.
- Runtime tracing.
- Dependency injection resolution.
- Factory function inference.
- Dynamic import resolution.
- Wildcard import resolution in the main graph.
- Monkey-patching support.
- Rendering external/library functions as primary graph nodes.
- Depending on Pylance private internals.
- Full recursive graph expansion as the default view.
- Sidebar-first graph UI.
- Editing code from inside the graph.
- Edge-click navigation behavior.
- Multi-workspace remote index persistence beyond normal VS Code workspace behavior.
- Persistent on-disk index caching in v1.
- Always-on background indexing or telemetry.
- Large monorepo optimization beyond the small-to-medium v1 target.

## Further Notes

- The product should stay precision-first. Missing an edge is preferable to showing a wrong edge.
- The UI should feel dynamic, neat, and clean, but should not trade trustworthiness for visual density.
- A future version can add optional deeper Pyright-based analysis, richer filters, and multi-language adapters.
- The issue tracker configuration and triage label vocabulary are not present in this workspace, so this PRD is written locally rather than published to an issue tracker with the `ready-for-agent` label.
