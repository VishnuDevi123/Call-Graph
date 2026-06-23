# Slice 18: UI Controls and Polish

## Goal

Complete approved toolbar, minimap, hover, overlays, and customizable styling.

## Deliverables

- Polish toolbar controls and disabled/focus/hover states.
- Show zoom percentage.
- Make minimap visible by default, collapsible, and draggable by a distinct handle.
- Preserve minimap position through depth changes and Reset View; reset on panel close.
- Highlight connected nodes/edges on hover and subtly dim unrelated elements.
- Add centered loading, stale-data, empty-workspace, routing-warning, and failure overlays.
- Organize CSS into documented variable and component sections.
- Use VS Code editor background as default canvas color.

## Acceptance

- Canvas and minimap dragging cannot be confused.
- Operational messages do not use toolbar status text.
- Reduced-motion mode simplifies motion and throbber behavior.
- Tunable colors, typography, spacing, edges, zoom, and motion are easy to locate.

## Verification

```sh
npm run compile
npm run test:unit
```
