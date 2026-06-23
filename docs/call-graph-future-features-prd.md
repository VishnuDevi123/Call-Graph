# Call Graph Future Features

This document records approved product ideas that are intentionally deferred from the current v1 implementation plan. Items here require their own vertical slices before implementation.

## Enhanced Keyboard and Command Navigation

### Status

Deferred for future implementation.

### Goal

Add keyboard and VS Code command equivalents for graph viewport operations after the revised pointer-based graph experience is complete.

### Proposed Behavior

- Add keyboard shortcuts when focus is inside the graph.
- Consider contributed VS Code commands for Zoom In, Zoom Out, Reset View, Back, and Forward.
- Controls must expose accessible names, focus indicators, disabled states, and tooltips.
- Keyboard behavior must not interfere with normal VS Code shortcuts when graph focus is elsewhere.
- Motion must honor the reduced-motion preference.

### Open Decisions

- Exact keyboard shortcut bindings.
- Whether keyboard shortcuts are webview-local, contributed as VS Code commands, or both.
- Whether trackpad pinch gestures should receive dedicated handling.
- Whether additional toolbar zoom controls are needed after pointer and keyboard testing.

### Acceptance Direction

- Every graph viewport operation available through pointer input has an accessible keyboard or command equivalent.
- Navigation controls do not change graph focus, directional depth, filters, or history.
- Controls remain usable with supported light, dark, and high-contrast VS Code themes.
