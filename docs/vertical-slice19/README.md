# Slice 19: Layout Hardening

## Goal

Verify failure behavior, responsiveness, offline packaging, and removal of obsolete UI code.

## Deliverables

- Verify worker timeout and best-result fallback.
- Keep previous graph visible on worker/layout failure.
- Add centered Retry/Refresh actions.
- Test large labels, dense graphs, reciprocal cycles, outermost focus, and uneven bounds.
- Verify latest-request-wins under rapid focus/depth changes.
- Review bundle contents, CSP, offline behavior, and idle panel behavior.
- Remove remaining obsolete UI modules, styles, messages, and tests.
- Add `rbush` only if profiling proves obstacle checks need it.

## Acceptance

- UI remains responsive during layout.
- Failure never freezes or blanks an existing graph.
- No obsolete fixed-column or ELK-related implementation remains.
- Production bundle requires no runtime network access.

## Verification

```sh
npm run compile
npm run test:unit
```

Run `npm test` when extension-host coverage is required.
