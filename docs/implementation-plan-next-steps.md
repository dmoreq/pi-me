# Implementation plan for codebase cleanup and activation

## Phase 1: Reactivate missing live features
1. Wire `core-tools/memory/index.ts` into `core-tools/index.ts` for dev/full.
2. Wire `core-tools/thinking-steps/thinking-steps.ts` into `core-tools/index.ts` for dev/full.
3. Fix `foundation/context-monitor` counters and triggers.
4. Fix workflow background-job persistence.

## Phase 2: Remove dead/compatibility code
1. Delete `authoring/index.ts` and remove it from `package.json`.
2. Delete unused workflow stub files:
   - `core-tools/workflow/capture.ts`
   - `core-tools/workflow/commands.ts`
   - `core-tools/workflow/compatibility.ts`
   - `core-tools/workflow/intent.ts`
3. Delete `core-tools/memory/src/bootstrap.ts` if still unused.
4. Delete or wire `foundation/secrets/scanner.ts`.
5. Decide on `shared/command-builder.ts`, `shared/lazy-package.ts`, and `shared/ext-state.ts`.

## Phase 3: Dependencies and docs
1. Remove unused dependencies.
2. Rewrite README to match actual activation/profile behavior.
3. Archive or delete `core-tools/CODE_REVIEW.md`.
4. Refresh skills that mention removed systems.

## Phase 4: Verification
1. Run `npm test`.
2. Update report with final status.
