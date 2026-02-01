# Final Review - Comprehensive PR Review & Testing (MindScribe)

## Step 0: Determine Review Pass

Check git history to determine if this is a follow-up review:

```bash
git log --oneline -10 | grep -i "Co-Authored-By: Claude"
```

- **First pass**: No recent Claude co-authored commits on this branch
- **Follow-up pass**: Recent Claude commits exist from a previous `/final-review` run

If follow-up pass:
- Note this as "Review Pass #2" (or #3, etc.)
- Instruct agents to check git history before suggesting reversals
- Be more conservative - focus on issues introduced BY the previous review
- Aim for convergence, not endless refactoring

## Step 1: Create or Update the PR

Check which branch you're on:
- **If on `main`**: Create a feature branch with descriptive name, commit changes
- **If on feature branch**: Continue with existing branch

Then:
- If no PR exists, create one with clear title and description
- If PR exists, push any uncommitted changes

## Step 2: Launch Three Review Agents in Parallel

Use the Task tool to launch these simultaneously.

**Context for all agents on follow-up passes**:
- "Check git log for recent commits before making recommendations"
- "If a pattern looks intentional based on commit messages, don't reverse without strong justification"
- "Focus on issues INTRODUCED by recent changes"

### Agent 1: Tauri/Rust Safety Reviewer

Review Rust backend code with these focuses:

**Production Safety:**
- Any `.unwrap()` or `.expect()` calls in production paths (src-tauri/src/lib.rs, commands)
- These should use proper error handling with `?` operator or match expressions
- Per project guidelines: "avoid `.unwrap()` in production code"

**SQL Safety:**
- String formatting in SQL queries (look for `format!` with SQL)
- Should use parameterized queries exclusively
- Check src-tauri/src/db/journals.rs for SQL construction

**Error Propagation:**
- Are errors properly propagated with `Result<T, AppError>`?
- Silent error swallowing via `.ok()`, `filter_map`, or ignored Results
- Fallback values that mask real errors (e.g., returning `Utc::now()` on parse failure)

**Thread Safety:**
- DbPool Mutex usage - any potential deadlocks?
- State management in Tauri commands

**Tauri Command Validation:**
- Input validation before database operations
- Empty string checks, length limits, etc.

### Agent 2: React/TypeScript Patterns Reviewer

Review frontend code through Clean Code lens:

**React Query Patterns:**
- Cache invalidation correctness - are mutations invalidating the right query keys?
- Check src/hooks/use-journal.ts for query key factory usage
- Optimistic updates - do they properly roll back on error?

**State Management:**
- Zustand store design (src/stores/ui-store.ts) - single responsibility?
- Mixing UI state with server state inappropriately?

**Hook Dependencies:**
- Stale closure issues in useEffect/useCallback deps arrays
- Missing dependencies that could cause bugs

**Error Handling:**
- Generic catch blocks losing error context
- Are errors shown to users appropriately?
- Error boundaries for component failures

**TypeScript Compliance:**
- Any `any` types or type assertions that bypass safety?
- Proper typing of Tauri invoke calls

**Component Patterns:**
- Long components that should be decomposed
- Duplicated logic that should be extracted to hooks
- Proper separation of presentational vs domain components

### Agent 3: IPC & Data Integrity Reviewer

Review for defensive code that could hide real issues:

**Type Alignment:**
- Do TypeScript interfaces (src/types/journal.ts) match Rust structs exactly?
- Serialization mismatches between frontend and backend
- DateTime handling consistency (ISO 8601 strings)

**Race Conditions:**
- Debounced save logic (src/hooks/use-debounced-save.ts) - can old content overwrite new?
- Entry switching during pending saves
- Dual queries executing when only one is needed

**Silent Failures:**
- Fallback values that mask missing data
- Optional chaining (`?.`) chains that hide broken assumptions
- Try-catch blocks that swallow errors silently

**Data Loss Prevention:**
- Pending saves flushed on window close?
- Optimistic update rollbacks working correctly?

**Defensive Overreach:**
- Checks that prevent useful error logs from being raised
- Patterns that would make debugging harder in production

## Step 3: Reconcile and Apply Fixes

When agents return recommendations:

1. **Apply most recommendations** - If on the fence, do it. Single-developer repo, so "out of scope" doesn't apply.

2. **Handle conflicts**:
   - If Agent 1 says "use existing pattern X" and Agent 2 says "extract new abstraction Y", prefer existing code
   - Rust safety issues (Agent 1) take priority over style concerns

3. **Track skipped items** - Only skip if genuinely confident it's wrong for this codebase

4. **On follow-up passes, aim for convergence** - If changes are minimal, recommend proceeding to merge

## Step 4: Comprehensive Testing

### 4a. Rust Checks & Tests
```bash
cd src-tauri && cargo fmt --check
cd src-tauri && cargo clippy -- -D warnings
cd src-tauri && cargo test
```

### 4b. TypeScript Type Checking
```bash
pnpm build
```
This runs `tsc` which catches type errors in strict mode.

### 4c. Manual Smoke Test (if UI changes)
```bash
pnpm tauri dev
```
Then verify:
- Entry creation works
- Entry editing with debounced save
- Search functionality
- Archive/unarchive
- Entry deletion with confirmation

## Step 5: Push Final Changes

After all fixes and tests pass, commit and push:
```bash
git add -A
git commit -m "Apply review fixes

Co-Authored-By: Claude <noreply@anthropic.com>"
git push
```

## Step 6: Final Summary

Provide summary with these sections:

### Review Pass
- State which pass (e.g., "Review Pass #1" or "Review Pass #2")
- If follow-up, note what previous pass addressed

### Changes Applied
- List recommendations implemented from each agent

### Recommendations Skipped
- For each skipped item, explain WHY
- "Out of scope" is not valid for single-developer repo

### Test Results
- Rust: clippy, fmt, tests
- TypeScript: tsc build
- Manual smoke tests performed

### Unable to Test
- List anything that couldn't be tested and why
- What needs manual verification

### Another Pass Needed?
- If substantial changes (new error types, refactoring), recommend another pass
- If minimal changes (tweaks, formatting), recommend proceeding to merge
