# Slice 12: Revised Graph Contract

Status: Implemented

## Goal

Correct graph semantics and limits before replacing the UI layout.

## Delivered

- Removed callerless fallback `<module>` nodes.
- Kept real file-scope module relationships and module focus.
- Removed unresolved/external sections and role headings from primary UI.
- Preserved caller/callee depth across focus changes.
- Prioritized focus, direct relationships, then deeper nodes.
- Added deterministic truncation, omitted counts, large-graph warning, and edge metadata.

## Verification

- Graph tests cover module behavior, depth persistence, traversal priority, limits, and edge metadata.
- Webview tests cover removed sections and labels.
- `npm run compile`
- `npm run test:unit`

## Follow-up

The fixed-column scene is temporary. Slice 13 begins the approved UI replacement.
