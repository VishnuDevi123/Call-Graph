# Slice 13: UI Contract Cleanup

## Goal

Make the Slice 12 baseline match the approved V1 contract before new layout work.

## Deliverables

- Remove `Include Tests` from HTML, messages, controls, and V1 graph-session UI state.
- Keep test relationships included by default.
- Replace toolbar status text with a minimal centered overlay seam.
- Add explicit reciprocal-edge classification to graph data.
- Add approved toolbar shell: Back, Forward, Refresh, Reset View, depths, minimap toggle, zoom percentage.
- Keep current geometry runnable; do not implement new placement yet.
- Remove obsolete tests only when replacement contract tests exist.

## Acceptance

- Extension compiles and current graph still opens.
- No V1 test-filter UI or messages remain.
- Reciprocal relationships reach the webview as explicit graph semantics.
- New toolbar/overlay DOM contract is tested.

## Verification

```sh
npm run compile
npm run test:unit
```
