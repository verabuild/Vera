# VERA Roadmap

**October 2026 → October 2027**

VERA is building from a frictionless beta scanner into an evergreen pre-action security layer.

## Product thesis

People do not need another list of warnings. They need a reliable decision before they click, connect, sign, send or pay.

## Beta

No wallet connection is required for core investigations.

- Anonymous sessions: 5 investigations
- Authenticated accounts: 10 investigations per UTC day
- Limits are beta defaults and must be verified against deployed configuration

## Current implementation snapshot (October 2026)\n\nAlready implemented: URL/message/wallet/transaction investigation, source-linked provider status, Solana Mainnet/Devnet read-only checks, a bounded Solana case terminal with direct/connected transfer filters, Helius/Breadcrumbs optional enrichment, DEX Screener market context, JSON evidence export, and the legal-information routes. These are implemented capabilities, not a guarantee that every provider is configured or available in every environment.\n\nStill requiring verification or further engineering: known-signature regression tests; token-account owner edge cases; provider failure and stale-data handling; robust privacy/access checks for persisted reports; systematic URL false-positive/false-negative fixtures; decoded transaction-intent and authority-change analysis; and independent legal/privacy review. See README.md for the release checklist.\n\n## 12-month roadmap

| Phase | Window | Outcome | Priority builds |
|---|---|---|---|
| 1. Verdict foundation | 0–6 weeks | Clear SAFE / CAUTION / REVIEW / NOT SAFE decisions | Deterministic verdict policy, evidence precedence, freshness, provider health, regression fixtures |
| 2. Transaction intelligence | 6–12 weeks | Explain what a Solana transaction is actually trying to do | Instruction decoding, program registry, signer/writable roles, asset flows, recipient screening, authority-change detection |
| 3. Message + social attack surface | 3–5 months | Connect messages to the destinations they lead to | Inspect all links, impersonation heuristics, lookalike domains, QR/link expansion, shareable reports, extension prototype |
| 4. Threat graph + community loop | 5–7 months | Correlate domains, wallets, URLs, brands and transactions | Entity graph, reusable indicators, user reports, feedback, deduplication, evidence lineage, correction workflow |
| 5. Developer platform | 7–10 months | Let other products call VERA before their users act | API, SDK, batch scans, webhooks, embeddable decision card, audit logs, provider health, enterprise controls |
| 6. Evergreen security network | 10–12 months | Turn one-time scanning into continuous protection | Watchlists, recurring re-checks, address monitoring, domain-change detection, alerts, policy profiles, team workspaces |

## Evergreen end state

**Manual investigation → Continuous monitoring**

**Raw provider signals → Normalized evidence graph**

**Technical states → Clear user verdicts**

**Solana-first → Cross-chain-ready architecture**

**Consumer web app → Consumer + extension + API/SDK**

The moat is not a bigger blacklist. It is decision quality: correlation, provenance, freshness, explainability, transaction context and feedback.

## Safety principles

VERA should never treat a provider no-match as proof of safety. Unavailable evidence remains visible. AI explains structured evidence but does not override deterministic hard findings. VERA never asks for seed phrases or private keys and does not autonomously execute financial transactions.

## Strategic note

This roadmap is a product strategy, not a promise of future performance. External market and threat figures should be validated against their cited primary sources before publication.
