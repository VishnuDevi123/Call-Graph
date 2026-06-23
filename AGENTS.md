# Call Graph Implementation Instructions

This repository builds the Call Graph VS Code extension.

## Project Context

- Workspace root: `/Users/vishnudevireddy/extension1`
- Extension project: `call-graph/`
- Product name: `Call Graph`
- Extension package identifier: `call-graph`
- First supported language: Python
- Parsing uses Tree-sitter behind language-neutral interfaces.

## Required Context

Before implementing a slice, read:

- `AGENTS.md`
- `.agents/slice-loop.md`
- `docs/python-call-graph-extension-prd.md`
- `docs/call-graph-ui-grill-session.md` for UI work
- the target `docs/vertical-slice{number}/README.md`
- `docs/call-graph-progress.md`
- relevant existing source and tests

## Slice Workflow

- Implement one vertical slice at a time.
- If the user names a slice, implement that slice.
- If the user asks for the next slice, use `docs/call-graph-progress.md`.
- Do not skip ahead unless the active slice needs a small supporting change.
- Preserve unrelated user changes.
- Keep the extension runnable and testable.
- Run relevant verification from `call-graph/`.
- Update `docs/call-graph-progress.md` after completing a slice.

## Implementation Quality

Code must be readable without requiring the reader to reconstruct hidden intent.

- Prefer simple, direct structures and obvious module names.
- Keep functions focused and modules small enough to understand in one pass.
- Avoid clever abstractions, deep nesting, and premature framework layers.
- Use descriptive names for types, functions, state, and messages.
- Make data flow and ownership explicit.
- Separate graph semantics, layout geometry, browser rendering, and VS Code integration.
- Match existing boundaries unless the active slice explicitly replaces them.
- Do not leave dead code, misleading names, or obsolete compatibility paths after a verified replacement.

## Comments and Documentation

Future implementation must include clear explanatory comments where they help a reader understand structure or reasoning.

- Add a short module comment when a file's responsibility is not immediately obvious.
- Document exported types and important functions with their purpose, inputs, outputs, and important constraints.
- Comment non-obvious algorithms, geometry, retries, state transitions, and failure handling.
- Explain why a decision or invariant exists, especially for precision, performance, lifecycle, and layout behavior.
- Place comments near the code they explain.
- Keep comments concise and accurate.
- Do not narrate trivial syntax or repeat what a clear name already says.
- Update or remove comments when behavior changes.

Readable code remains primary; comments should expose intent and constraints, not compensate for confusing implementation.

Preferred structure:

```text
src/
  extension.ts
  graph/
    buildFocusedGraph.ts
    types.ts
  webview/
    CallGraphPanel.ts
    client/
    layout/
```

Avoid unnecessary hierarchy:

```text
src/
  core/
    domain/
      aggregate/
        factories/
          providers/
```

## Testing

- Add focused tests when changing parser, resolver, graph, command, geometry, worker, or user-visible behavior.
- Test public behavior and important invariants rather than incidental implementation details.
- Record test gaps explicitly.
- Do not claim behavior is covered when it was only compiled or inspected.

## Verification

Default:

```sh
cd call-graph
npm run compile
```

Run targeted tests when relevant:

```sh
npm run test:unit
```

`npm test` launches VS Code Electron and may require unsandboxed execution.

## Completion

A slice is complete only when:

- deliverables and acceptance checks are satisfied
- obsolete behavior replaced by the slice is safely removed
- compile and relevant tests pass, or a concrete blocker is documented
- `docs/call-graph-progress.md` is current
- no unrelated slice work was started
