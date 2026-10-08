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

## Environment
Copy `.env.example` to `.env` and set secrets locally. In Vercel, configure the same variables as server-side Environment Variables.

`SOLANA_MAINNET_RPC_URL=https://api.mainnet.solana.com`
`SOLANA_DEVNET_RPC_URL=https://api.devnet.solana.com`
`SOLANA_NETWORK=both`
`VERA_TEST_WALLET=4AMBqkqruwzT4RMh9sojo7RmBgYLYTuqGmv2GbAtXsVL`

`URLHAUS_AUTH_KEY=` (free abuse.ch Auth-Key; keep it server-side)
`TAVILY_API_KEY=` (optional public-web reputation search; server-side only; free tier available)
`URLSCAN_API_KEY=` (optional urlscan.io API key; server-side only; unauthenticated public search is still attempted)
`CHAINABUSE_API_KEY=` (optional Chainabuse API key; server-side only)
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

## Deployment
Deploy from the GitHub repository through Vercel. Add environment variables to Preview and Production. Run database/schema.sql against the provisioned PostgreSQL database before enabling persistence.

Public Solana RPC endpoints are suitable for development but are rate-limited and have no production SLA. For production scale, move to a dedicated Solana RPC provider.
