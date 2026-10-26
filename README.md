# VERA ⇴ Know before you act.

VERA is an evidence-first AI decision layer for online actions. It investigates URLs, messages, Solana public wallets and transaction inputs, separates evidence from inference, and explains the next action in plain English. Its homepage also presents an interactive, source-linked overview of the human and economic impact of reported scams.

## Current implementation
- React/Vite frontend
- Vercel serverless investigation API
- Google Gemini evidence-grounded explanation layer
- URLhaus (abuse.ch) malware-URL threat-intelligence adapter (server-side Auth-Key)
- OpenPhish community phishing database for direct URL checks
- urlscan.io historical public scan search for domain observations
- Website surface inspection with redirect, title, server and security-header evidence
- Optional Tavily public-web reputation search for domain-specific scam reports, reviews, and warnings, with source links shown in the evidence trail
- Optional Chainabuse public scam-report screening for URLs and Solana addresses
- DEX Screener public Solana market context for address-shaped token inputs
- URL outcomes distinguish provider-reported threats, no known threat matches, and unavailable checks
- Explicit website-identity uncertainty: DNS and clean threat lookups are not treated as proof of legitimacy
- Solana Mainnet + Devnet read-only wallet intelligence
- Magic Eden Solana wallet intelligence adapter
- PostgreSQL production schema
- Explicit VERIFIED / SUPPORTED / UNKNOWN / SUSPICIOUS / CONFIRMED_MALICIOUS states
- No seed phrases, private keys, or autonomous transaction execution

## Multichain investigation status

Vera's multichain foundation now includes a read-only EVM RPC adapter and gated API routing for address and transaction investigations on Ethereum, Base, BNB Smart Chain, Arbitrum One, and Polygon PoS. The chain selector only enables an EVM option when the API reports both the feature flag and that chain's RPC configuration are present.

EVM investigations are **disabled by default**. To opt in for a controlled validation environment, configure `VERA_ENABLE_EVM_INVESTIGATIONS=true` and the server-side RPC URL for each chain you intend to test:

- `EVM_ETHEREUM_RPC_URL`
- `EVM_BASE_RPC_URL`
- `EVM_BSC_RPC_URL`
- `EVM_ARBITRUM_RPC_URL`
- `EVM_POLYGON_RPC_URL`

Never put RPC URLs containing credentials in client-side `VITE_` variables. The adapter verifies the RPC's reported chain ID before using it.

The initial EVM coverage includes address format, native balance, contract bytecode presence, transaction count, transaction lookup, and receipt execution status. It is not yet a complete token or contract security audit: ERC-20 behavior, holder concentration, liquidity/honeypot analysis, verified source, proxy/admin controls, and EVM-specific external threat intelligence remain incomplete. Unknown or unavailable checks must not be read as proof of safety.

Before enabling EVM investigations for real users, apply `database/migrations/20261026_add_chain_identity_to_scans.sql`, complete the EVM and Solana regression suite, and verify typecheck, production build, and live RPC behavior. See [the multichain rollout plan](docs/multichain-investigation-plan.md).

## Beta investigation limits
- Anonymous sessions are limited to **5 investigations**; authenticated accounts are limited to **10 investigations per UTC day**.
- The backend uses PostgreSQL counters when `DATABASE_URL` is configured and a signed-cookie fallback when the database cannot be used. The fallback is a best-effort abuse control, not a guarantee against determined multi-session abuse.
- A wallet connection is not required to start an investigation.
- These are current beta defaults. Confirm the deployed environment and live quota response before relying on the limits operationally.

## Environment
Copy `.env.example` to `.env` and set secrets locally. In Vercel, configure the same variables as server-side Environment Variables.

`SOLANA_MAINNET_RPC_URL=https://api.mainnet.solana.com`
`SOLANA_DEVNET_RPC_URL=https://api.devnet.solana.com`
`SOLANA_NETWORK=both`
`VERA_ENABLE_EVM_INVESTIGATIONS=false` (EVM support is opt-in and should remain false until release validation is complete)
`VERA_TEST_WALLET=4AMBqkqruwzT4RMh9sojo7RmBgYLYTuqGmv2GbAtXsVL`

`URLHAUS_AUTH_KEY=` (free abuse.ch Auth-Key; keep it server-side)
`TAVILY_API_KEY=` (optional public-web reputation search; server-side only; free tier available)
`URLSCAN_API_KEY=` (optional urlscan.io API key; server-side only; unauthenticated public search is still attempted)
`CHAINABUSE_API_KEY=` (optional Chainabuse API key; server-side only)
`HELIUS_API_KEY=` (optional parsed Solana Mainnet history; server-side only)
`BREADCRUMBS_API_KEY=` (optional address risk/attribution enrichment; server-side only)
`VERA_ANON_SECRET=` (required signed anonymous-session/quota fallback secret; use a long random value of at least 32 characters)
`VERA_ALLOWED_ORIGINS=` (optional comma-separated allowlist for API CORS; set to exact trusted origins if cross-origin calls are needed)
`GEMINI_API_KEY=`
`GEMINI_MODEL=gemini-3.8-flash`
`MAGIC_EDEN_API_KEY=`
`DATABASE_URL=`

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run typecheck
npm run build
```

## API
POST `/api/investigate`

```json
{
  "inputType": "WALLET",
  "input": "4AMBqkqruwzT4RMh9sojo7RmBgYLYTuqGmv2GbAtXsVL",
  "network": "devnet"
}
```

The AI receives only structured evidence produced by deterministic adapters. It must not invent missing evidence or convert unknowns into certainty.

### Investigation status and coverage
Every completed investigation now returns a status report with provider-by-provider state, overall coverage, the number of decisive signals, and the observation time. `MATCH` means a provider returned a positive threat signal; `NO_MATCH` means the provider completed and did not return a match; `UNAVAILABLE` means the provider could not complete; `SKIPPED` means the provider is optional and not configured.

### URL investigation results
- A URLhaus match produces a high-priority `CONFIRMED_MALICIOUS` assessment with the provider-reported URL record, threat type, status, tags, and reference where available.
- A successful lookup with no match reports **No URLhaus record found**. URLhaus focuses on malware-distribution URLs; this is not a guarantee of safety and does not rule out phishing or fraud.
- Missing configuration, provider errors, rate limits, or timeouts produce an unavailable/unknown check, never a clean result.
- DNS and registration age are supporting evidence only. VERA does not claim to have verified page content or operator identity based on those signals.

### Public web reputation evidence
- When `TAVILY_API_KEY` is configured, VERA searches public web results for domain-specific scam, fraud, review, and warning reports. Returned source links are displayed in the evidence trail.
- Search results are leads, not proof. User allegations, copied posts, affiliate promotions, stale pages, and manipulated search results can be misleading. VERA records report excerpts and source domains and only raises `SUSPICIOUS` when negative results span multiple source domains or a reputation-warning source is found.
- No negative results, missing configuration, provider errors, or timeouts do not mean a domain is safe. This search is supplemental and is not a substitute for dedicated phishing intelligence or direct transaction simulation.

### Public-impact homepage data
The homepage uses official US reporting figures as context, not as a claim about worldwide totals:
- The FTC reported consumers lost $12.5 billion to fraud in 2024: [FTC release](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024).
- The FBI's IC3 received 859,532 internet-crime complaints in 2024 and reported more than $16 billion in losses: [FBI release](https://www.fbi.gov/news/press-releases/fbi-releases-annual-internet-crime-report).
- The FBI's 2024 report states IC3 has received more than nine million complaints since its founding: [2024 IC3 report](https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf).
- The homepage's human quote is attributed to FBI Director Kash Patel and links to the original FBI release. No fictional victim testimonials or fabricated company cases are used.
- FTC and FBI figures have different reporting scopes and must not be added together. They represent reported cases and losses, not the complete global impact of scams.

## Solana Investigation Terminal
The `/case` workspace traces recent parsed SOL/SPL transfer records from supplied wallet addresses and/or transaction signatures. It is a bounded triage aid, not a full chain indexer or forensic attribution service.

- Direct records are transfer legs whose displayed source or destination matches a starting address; connected records are other legs discovered through the bounded trace.
- The trace is bounded by a maximum of 14 discovered addresses, 80 parsed transaction fetches, recent signature windows, and a maximum depth of two hops. RPC omissions and unsupported transaction formats can leave gaps.
- Token-account owners are resolved from transaction token-balance metadata when available. If owner metadata is missing, an account address may remain unresolved; do not treat that account as a confirmed human or wallet identity.
- Helius parsed history is optional, Mainnet-only, and currently queries at most eight addresses with up to 20 recent transactions per address. Breadcrumbs enrichment is optional and skipped on Devnet. Provider results are supplemental and may be partial.
- DEX Screener data is market context, not a safety verdict. Market liquidity, labels, or reported risk do not prove intent or ownership.
- Exported reports and investigator notes may contain public addresses, signatures, provider signals, and user-entered context. Review exports before sharing.

## Production verification checklist
1. In Vercel, set server-side variables for Preview and Production separately; never use a `VITE_` prefix for secrets.
2. Verify `DATABASE_URL`, `VERA_ANON_SECRET` (at least 32 characters), Privy server credentials, and the intended RPC URLs. Run `database/schema.sql` against the provisioned PostgreSQL database.
3. Verify `HELIUS_API_KEY` and `BREADCRUMBS_API_KEY` through a real Mainnet case and provider status output. Do not share API keys in issues, screenshots, client code, or chat.
4. Test one known incoming SOL transfer, one outgoing SOL transfer, an SPL token transfer, a transaction signature, an address with no recent activity, and a case that reaches trace limits. Compare each displayed record to the original explorer transaction.
5. Test invalid/missing provider credentials, HTTP 429, timeouts, RPC errors, database failure, anonymous quota exhaustion, authenticated quota reset at 00:00 UTC, and expired authentication.
6. Confirm that an unknown or unavailable provider never becomes a clean/safe claim, and that no report exposes another user's private persisted scan.
7. Test the homepage, submission flow, `/case`, all workspace sections, exports, and mobile navigation after every production release.

## Proposed $VERA token research

VERA is evaluating a potential **$VERA ecosystem token** as a future part of the product strategy. This is a proposal for research and design, not an announcement that a token has launched or that a launch is guaranteed. There is currently no confirmed launch date, network, contract address, token supply, allocation, or finalized utility.

Areas to evaluate include:
- Whether optional credits or access to advanced investigation features create durable product utility without putting essential safety information behind token ownership.
- Whether incentives for independently validated threat intelligence can improve quality while resisting spam, manipulation, and sybil abuse.
- Whether ecosystem funding can sustainably support integrations, security research, and development.
- Token supply and distribution models, vesting, treasury governance, liquidity assumptions, and transparent disclosures.
- Smart-contract security, applicable legal and regulatory obligations, user protection, and operational risks before any implementation decision.

**Decision gate:** proceed only if there is demonstrated product demand, a sustainable economic model, a credible security review plan, and appropriate legal assessment. No token price, return, reserve backing, or appreciation is promised. Liquidity is not backing, and a treasury should not be described as backing unless a specific, verifiable arrangement exists.

## Deployment
Deploy from the GitHub repository through Vercel. Add environment variables to Preview and Production. Run `database/schema.sql` against the provisioned PostgreSQL database before enabling persistence.

Public Solana RPC endpoints are rate-limited and have no production SLA. For sustained production traffic, use a dedicated RPC provider and monitor rate limits, latency, and error rates.
