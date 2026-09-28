---
description: Generate an E2E test suite from a git diff between two branches
argument-hint: <base-branch> <current-branch> [prd-file]
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(date:*), Bash(echo:*), mcp__testlab__create-test-suite, mcp__testlab__bulk-import-test-rows
---

## Arguments

Raw arguments as typed: $ARGUMENTS

Parsed positionally (base branch, current branch, optional PRD path):
!`set -- $ARGUMENTS; echo "base=$1 current=$2 prd=$3"`

## Context

Diff of changes on the current branch since it diverged from the base branch:
!`set -- $ARGUMENTS; git diff "$1"..."$2"`

Commits on the current branch not present on the base branch:
!`set -- $ARGUMENTS; git log "$1".."$2" --oneline`

Current timestamp:
!`date +%Y%m%d-%H%M%S`

## Your task

1. From the "Parsed positionally" line above, note the base branch, current branch, and PRD path (the PRD path will be empty if only two arguments were given — that's expected, not an error).
2. If a PRD path was given, read that file yourself before proceeding, and use it to ground expected behavior. If none was given, infer intent from the commit messages, the current branch's name, and the diff itself.
3. Read the diff and commit log above to identify the user-facing behavior that changed — new routes, new UI components, new validation rules, and edge cases implied by the code itself.
4. Always call `mcp__testlab__create-test-suite` to create a brand-new suite — never search for, reuse, or update a suite from a previous run, even if one already exists for this same branch. Set `suite_name` to the current branch name plus the timestamp printed above, and `suite_description` to a summary of what this run covers. Note the `suite_id` returned.
5. For each distinct behavior identified, build a test row object with `test_name`, `test_description`, `execution_steps`, `expected_output`, and `expected_response_status` (only when the change involves an API endpoint).
6. Call `mcp__testlab__bulk-import-test-rows` once with `parent_suite_id` from step 4 and `test_rows_json` as a serialized JSON array of the objects from step 5.
7. Report the suite name, suite ID, and number of tests registered — or the specific tool error if registration failed.