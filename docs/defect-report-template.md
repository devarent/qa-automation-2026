# Defect Report Template

Copy this template into the defect tracker (Jira, Azure DevOps, GitHub Issues) and
keep the same identifiers in the test case and RTM. A defect without reproduction
steps and evidence is not ready for triage.

## Summary

| Field | Value |
| --- | --- |
| Defect ID | DEF-YYYY-NNN |
| Title | Short, specific, observable statement |
| Reported by | Name / role |
| Reported date | YYYY-MM-DD |
| Build / commit | Version or SHA |
| Environment | Local / CI / Docker / browser / OS / Node version |
| Component | API / UI / transfer service / ledger / database / CI |
| Severity | Critical / High / Medium / Low |
| Priority | P0 / P1 / P2 / P3 |
| Status | New / Triaged / Assigned / In Progress / Fixed / Ready for Retest / Closed / Reopened |
| Reproducibility | Always / Intermittent (x of y) / Once |
| Requirement | REQ-xxx |
| Test case | TC-xxx |
| Related defect | DEF-xxx (if duplicate or dependent) |

## Preconditions

- Data, accounts, balances and configuration required to reproduce.
- Feature flags, browser, viewport, network conditions or test-only setup.
- Whether a fresh database or a running server is required.

## Steps to reproduce

1. Step one with exact values and endpoint or selector.
2. Step two.
3. Step three.
4. Observe the result.

## Expected result

Describe the correct business or technical behaviour, including status code,
response body, balance, ledger entries and user-visible message.

## Actual result

Describe precisely what happened. Include the observed status code, response body,
balance and ledger state. Do not summarise away the evidence.

## Evidence

- Screenshot or video path.
- Playwright trace path or test name.
- Request/response capture with sensitive data removed.
- Database query output or reconciliation row.
- CI run URL and artifact name.
- Console or server log excerpt with the request id.

## Impact and workaround

- Who is affected and how often.
- Financial or data-integrity impact.
- Temporary workaround, if any.
- Whether the issue blocks release.

## Root cause analysis

- Trigger and underlying cause.
- Why existing tests or reviews did not catch it.
- Contributing factors (race, missing constraint, unclear requirement, environment).

## Fix and verification

| Field | Value |
| --- | --- |
| Fix owner | Name |
| Fix commit / PR | Link |
| Fix description | What changed and why |
| Regression scope | Suites and cases to re-run |
| Retest result | Pass / Fail with evidence |
| Closed by / date | Name / YYYY-MM-DD |

## Regression test

- Test added or updated (file and case id).
- If no automated regression is possible, state why and record the manual check.
- Link the requirement and RTM row.

## Triage checklist

- [ ] Reproduced on a clean environment or evidence is sufficient.
- [ ] Severity and priority agreed with the product/release owner.
- [ ] Requirement and test case linked.
- [ ] Sensitive data removed from evidence.
- [ ] Regression scope identified.
- [ ] Fix verified and regression suite green before closure.
