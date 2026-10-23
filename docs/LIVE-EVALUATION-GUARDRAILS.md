# Live Evaluation Guardrails v0.1

Date: 2026-10-21 (Asia/Shanghai). **Live evaluation remains BLOCKED. Paid calls: 0.**

## Scope and frozen contract

The eight fixed cases, rubric, Pro model, Thinking effort routing, 4096 completion cap,
CNY 3.05 experiment cap and CNY 100 monthly allocation are unchanged. Manifest and
rubric SHA-256 values and the assembled baseline system-message SHA-256 are pinned
in `app/evaluation_guard.py`. The optional prototype must not enter these requests.
Frozen manifest/rubric JSON files have explicit LF checkout attributes so their
byte-level SHA-256 contracts survive Windows `core.autocrlf=true`. The input and
rubric bytes and pinned hashes are unchanged; `npm run test:tools` verifies Git
checkout filtering in temporary repositories under three autocrlf settings. The offline `cases.json` corpus has the same LF rule because matched comparisons use its byte-level hash.
The provider payload was extracted into a pure function without changing parameters
or prompt text. Admission hashes the full assembled payload; dispatch checks that
same hash again. There is no input trimming, automatic retry, repair or model switch.

## Input admission and remaining blocker

Rechecked official sources:
- https://api-docs.deepseek.com/zh-cn/quick_start/token_usage/
- https://api-docs.deepseek.com/zh-cn/quick_start/pricing/

Peak Pro prices remain CNY 9 / 0.30 / 27 per million input-miss / input-hit / completion
tokens. 4096 completion tokens include Thinking. Conditional exposure at 30000 input
tokens is 380592 micro-CNY per request and 3044736 micro-CNY for eight requests.
This leaves 5264 micro-CNY below the cap, but does NOT establish a hosted input bound.

The previous Pro-0813 BPE/encoder audit does not prove the hosted server uses precisely
that framing or adds no other billable tokens. Official documentation makes returned
usage authoritative; a local text-token count is not a provider billing certificate.
No arbitrary framing allowance is elevated into such a certificate here.

`check_payload` measures the complete UTF-8 serialized request in the explicitly
synthetic Mock protocol, including system, strategies, adaptive records, summaries,
memories, recent messages, structured-output instructions and request properties.
Its 30000 ceiling is a **Mock admission measurement, NOT hosted token counting**.
A real transport is unconditionally rejected. There is no `verified=true` switch,
config override or CLI live mode to bypass this missing proof. Over-limit Mock input
is rejected before dispatch and the original input/history remains intact.

Before live authorization: establish a model-specific hosted framing/billing bound
(or a provider-enforced equivalent), review its scope/version, and separately approve
the storage/accounting arrangement. Increasing money or reducing fixed inputs is not
a workaround. The guard is an offline implementation ready for those prerequisites,
not a claim that the original paid experiment is executable today.

## Durable state and transaction boundary

`evaluation_runs` (separate SQLAlchemy metadata): deterministic run ID, unique
experiment identity, manifest version/hash, model/Thinking, rate version, immutable
contract and synthetic case bindings, attempts, settled/reserved/unknown micro-CNY,
status and stop reason.

`evaluation_attempts`: unique request key and (run, case), payload hash, measured
input count/method, reserved/settled micro-CNY, status, allowlisted usage and manual
review. Raw model reasoning and complete provider responses are never stored.

No normal application startup migration creates these tables. Tests explicitly
provision them in temporary SQLite. No production database was migrated or seeded.

Admission takes an atomic conditional run-row write lock, binds the exact next case
to its synthetic user/conversation, reserves the full 380592 micro-CNY and increments
the attempt count. This and the existing monthly Budget reservation commit in the
**same SQL transaction**. Either both commit or neither does. Monthly admission
retains existing spend; it does not copy or replace the ledger. Outstanding unknown
costs are a disjoint accounting bucket: settled + reserved + unknown <= 3050000.
The independent maximum is eight attempts, even if all replies cost much less.

The transport-side callback atomically transitions reserved -> dispatched once,
then sends the already checked payload. A repeated callback cannot resend it.
A valid receipt settles both ledgers and retained chat in one transaction, then
sets `review_required`. Only an explicit operator review permits the next case.
No public HTTP endpoint authorizes reviews or provisions runs.

Timeout, cancellation, truncation, invalid usage or other failure marks outstanding
attempts unknown, retains their conservative reserve in both accounting systems,
and stops the run. Restart reads existing progress, never clears it. Explicit crash
recovery changes unresolved attempts to unknown/stopped and never retries them.
A crash after reservation but before dispatch is conservatively treated as potentially
billed. Concurrent admission cannot allocate twice. External manual deletion of the
authoritative database is not a supported operation; there is no reset/delete API.

## Data and approval boundary

All fixtures are fictional adults and isolated test storage. The formal database,
`.env`, credentials, existing budgets and private conversations are not written by
this work. There is no live runner in this version.

A future production accounting proposal would need to disclose writes to the existing
Budget row and AIRequest usage entries, plus experiment/attempt metadata. Synthetic
transcripts must remain isolated. Cross-database atomic coordination has not been
implemented or approved; a zeroed copied ledger must never substitute for authoritative
spend. No such production writes are authorized by this document.

## Offline acceptance

Run from the repository root with test environment isolated:
`uv run --directory apps/api pytest tests/test_evaluation_guard.py -q`

Tests cover eight fixed inputs and manual stops, ninth-call refusal, duplicate IDs,
run/month amount rejection, complete-payload over-limit rejection, price/system/input
drift, two independent processes racing one persistent run, dispatch replay refusal,
restart, crash recovery, timeout, truncation and invalid usage retaining allowance.
The existing-spend sentinel is 37588 micro-CNY; tests assert it survives reservation
and settlement. Test results and broader acceptance are recorded below after execution.

These tests establish contracts, not real token equivalence, provider pricing stability,
real reply quality or human quality scores. SQLite multiprocess coverage is not a claim
that PostgreSQL integration has been exercised against production.

## Acceptance results

- Guard suite: 16 passed, including two independent processes and restart/crash checks.
- Combined new backend suites: 34 passed (16 guard + 18 perspective).
- Full API suite: 222 passed, 1 skipped (PostgreSQL integration not configured).
- Ruff: passed for application and tests.
- TypeScript: `vue-tsc --noEmit` passed.
- Frontend: 103 passed, including 8 new perspective cases and existing reasoning cases.
- Default and prototype Mini Program builds: passed; bundled native compilers checked 14 WXSS and
  41 WXML files, references and images. Native interaction is recorded in the design doc.
- Tooling tests: 2 passed. `git diff --check` passed; existing line-ending warnings
  and upstream Sass legacy-API deprecation warnings are not application failures.
- No live requests, `.env` changes, formal-account writes, production migrations,
  budget reset, commit or push occurred. Existing unrelated work was preserved.

The initially failing oversized-input test constructed invalid JSON instead of an
oversized valid request; its fixture was corrected. The final suite tests complete
valid oversized context and rejects it before dispatch. No acceptance gate is waived.

## Changed implementation surface

- `app/evaluation_guard.py`: separate persistent run/attempt schema and transaction guard.
- `app/ai.py`: pure provider-payload construction and pre-dispatch callback.
- `app/main.py`: opt-in offline guard integration with existing monthly transactions.
- `tests/test_evaluation_guard.py`: isolated admission, failure and concurrency regression suite.

Perspective-specific changes are listed in `PERSPECTIVE-SHIFT-DESIGN.md`. There are no
formal schema migrations or environment changes in this delivery.
