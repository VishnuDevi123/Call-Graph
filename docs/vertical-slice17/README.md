# Slice 17: Full-Graph Fit and Navigation

## Goal

Fit the complete graph on every focus change and add graph navigation controls.

## Deliverables

- Fit complete graph on initial load, refocus, and Reset View.
- Let auto-fit zoom below manual range to a tunable floor near `10%`.
- Keep manual pointer-centered zoom defaults at `50%–200%`.
- Include every node in bounds, even when focus is outermost.
- Add one viewport of pan space on each side of content.
- Add Back/Forward panel-lifetime history.
- Exclude cursor-driven refocus from history.
- Add `200–300ms` fit transitions with reduced-motion handling.

## Acceptance

- Complete graph is visible after load, refocus, and Reset View.
- Full visibility wins over exact focus centering.
- Back/Forward works across files and clears on panel close.
- New navigation after Back clears Forward.

## Verification

```sh
npm run compile
npm run test:unit
```
