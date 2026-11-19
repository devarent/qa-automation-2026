# Security Policy

## Scope

This repository is a **demonstration lab**, not a production banking system. It has
no authentication, authorization, real customer data or external integrations. The
security posture is intentionally narrow, and the absence of these controls is
documented rather than hidden.

What is in scope for a security report:

- Unexpected exposure of data through the API or web UI.
- Injection or validation bypass that changes balances or ledger state.
- A path that allows a transfer to violate the documented business rules.
- A dependency vulnerability with a reachable exploit in the app or test toolchain.
- Secrets or personal data committed to the repository.

Out of scope:

- The absence of authentication, MFA, rate limiting, WAF or fraud scoring.
- Missing production hardening (TLS termination, secrets management, database
  encryption, backups).
- Denial of service from deliberately unbounded load against a local demo.
- Issues that require modifying the source or running untrusted local code.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` (latest) | Yes |
| Older commits and forks | No |

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

1. Use the repository host's private security advisory feature if available.
2. Otherwise contact the repository owner through the profile contact method listed
   on the repository page.
3. Include: affected file or endpoint, reproduction steps, impact, and any suggested
   fix.

You can expect an acknowledgement within 5 business days. This is a portfolio
project maintained on a best-effort basis; there is no bug bounty and no formal SLA.

## Handling

- The report is triaged privately and reproduced on a clean checkout.
- A fix is prepared with a regression test where practical.
- Public disclosure happens after a fix is available, or after 90 days, whichever
  comes first, unless an extension is agreed.
- Credit is given in the release note if the reporter wants it.

## Security practices in this repository

- No secrets, tokens or credentials are required to run the project.
- Dependencies are installed from the lockfile with `npm ci` in CI.
- The Docker image runs as the non-root `node` user and exposes only the app port.
- Input is validated for type, range, currency, account status and idempotency
  conflicts; errors do not leak stack traces.
- `npm audit` is recommended before releases; the current dependency tree reports
  zero known vulnerabilities at the time of writing.
- Test data is synthetic (`example.com` emails, fictional customers).

## Known limitations

- No authentication or authorization model.
- No rate limiting or abuse protection.
- No CSRF protection because there are no sessions or cookies.
- No transport security inside the app; a real deployment must terminate TLS.
- pg-mem is in-memory and not a production datastore.

These limitations are part of the lab's documented scope and are not treated as
vulnerabilities.
