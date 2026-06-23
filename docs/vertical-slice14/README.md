# Slice 14: Worker and Geometry Foundation

## Goal

Add an offline, framework-free layout worker and pure geometry contracts.

## Deliverables

- Add independent browser-worker bundle and strict CSP/resource wiring.
- Define typed request/result protocol with request IDs.
- Add hidden DOM text measurement using actual node styles.
- Send measured dimensions, viewport size, depths, edge types, and prior positions.
- Add pure rectangle, segment, boundary-intersection, and scene-bounds helpers.
- Add latest-request-wins handling and stateless worker lifecycle.
- Keep old renderer active until worker foundation is verified.

## Acceptance

- Worker runs locally without network access.
- Main webview remains responsive during requests.
- Stale results are ignored.
- Geometry helpers have focused unit tests.
- No ELK, D3, Cytoscape, React, Canvas, or new runtime layout dependency.

## Verification

```sh
npm run compile
npm run test:unit
```
