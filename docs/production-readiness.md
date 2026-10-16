# Production readiness and verification

Updated: 2026-10-16

This checklist separates repository changes from checks that require access to Vercel, PostgreSQL, provider dashboards, or real test cases. A green build is necessary but does not prove runtime provider correctness, privacy isolation, or UI behavior.

## Before every production release

- [ ] Confirm the candidate commit is on a reviewed branch and GitHub Actions typecheck/build succeeds.
- [ ] Confirm the Vercel Preview deployment is Ready and review the homepage, intake flow, /case, legal pages, desktop and mobile layouts.
- [ ] Promote only the reviewed commit; verify the Production deployment status and test the live hostname after it completes.
- [ ] Confirm server-side secrets are set for the correct Vercel environments. Never put provider secrets in `VITE_*` variables or commit them.
- [ ] Confirm `VERA_ANON_SECRET` is a long random secret of at least 32 characters, `DATABASE_URL` is correct, and Privy server credentials match the app.
- [ ] Confirm PostgreSQL schema migrations are applied and backups/retention are understood.
- [ ] Check logs and provider dashboards for 401/403, 429, timeouts, elevated errors, or unexpected usage.

## Solana case tests

- [ ] Known incoming SOL transfer: the searched address is clearly the recipient.
- [ ] Known outgoing SOL transfer: the searched address is clearly the sender.
- [ ] Known SPL transfer where pre/post token-balance metadata resolves both owners.
- [ ] SPL transfer with missing owner metadata: show the token account as unresolved rather than inventing a wallet owner.
- [ ] One transaction signature as the only input.
- [ ] Multiple starting addresses and an address with no recent history.
- [ ] A multi-instruction transaction with a transfer leg unrelated to the investigated address: unrelated legs must not appear connected.
- [ ] Multi-hop trace: distinguish direct from indirect records and show bounded-coverage warnings.
- [ ] Compare every sample record to the original Solscan or Solana Explorer transaction.
- [ ] Confirm Helius results are deduplicated against RPC records and are visibly attributed to Helius.
- [ ] Confirm Breadcrumbs risk labels include source links and are described as third-party signals, not identity proof.
- [ ] Confirm Devnet clearly reports Helius/Breadcrumbs skipped where those integrations are Mainnet-only.
- [ ] Test invalid address/signature, unsupported transaction version, RPC timeout, rate limiting and partial provider failure.

## URL and message tests

- [ ] Recognized legitimate domain with no threat matches: no unjustified malicious verdict from weak reputation text alone.
- [ ] Known URLhaus/OpenPhish match: preserve the exact source evidence and explain its scope.
- [ ] Lookalike domain, deceptive subdomain, punycode, shortener, redirect chain, malformed URL, unreachable host and recently registered domain.
- [ ] Message containing one or more URLs: each extracted link enters the same URL investigation pipeline.
- [ ] Provider no-match, unavailable, not configured, stale response and timeout remain distinct states.
- [ ] Ensure DNS/RDAP, HTTPS, page title, or absence of reports is never presented as proof of legitimacy.

## Privacy, access and quotas

- [ ] Confirm saved-report lookup behavior is intentional: investigation IDs should not expose data beyond the sharing model described in the UI and privacy policy.
- [ ] Attempt to access a report belonging to a different authenticated account; verify denial unless the report is explicitly shared.
- [ ] Test anonymous five-investigation limit, authenticated ten-per-UTC-day limit, midnight UTC reset, parallel requests and quota exhaustion.
- [ ] Test missing database, database timeout, signed-cookie fallback and invalid/expired authentication.
- [ ] Inspect stored rows and logs to confirm message/transaction content is redacted as documented and no secrets are retained.
- [ ] Review external-provider submissions and retention terms; do not submit seed phrases, private keys, passwords or one-time codes.
- [ ] Confirm all case/export endpoints use no-store where sensitive and validate input sizes and allowed methods.
- [ ] Verify error responses do not leak API keys, stack traces, SQL details or private reports.

## Legal and product integrity

- [ ] Have a qualified lawyer review Terms, Privacy, Cookies, Disclosures and the data-controller/operator details before a public commercial launch.
- [ ] Confirm the published contact address, retention behavior, third-party processors, analytics and deletion process are accurate.
- [ ] Keep the five/ten quota statement aligned across README, roadmap, UI, API and deployed configuration.
- [ ] Keep all product claims tied to shipped behavior; mark optional providers and unknown results clearly.
- [ ] Ensure exports include timestamps, network, source/provider labels and limitations, and are reviewed before sharing.

## Not verifiable from repository access alone

The following require the project owner or live environment: checking Vercel environment-variable values without exposing them, confirming real Helius/Breadcrumbs account entitlements, database state/backups, live mobile rendering, production provider success, and legal sign-off. Do not paste secrets into chat or GitHub issues to prove configuration.
