# VERA — Know before you act.

VERA is an evidence-first AI decision layer for online actions. It investigates URLs, messages, Solana public wallets and transaction inputs, separates evidence from inference, and explains the next action in plain English.

## Current implementation
- React/Vite frontend
- Vercel serverless investigation API
- Google Gemini evidence-grounded explanation layer
- Google Web Risk URL threat-intelligence adapter (server-side API key)
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

`WEB_RISK_API_KEY=` (enable the Google Web Risk API in Google Cloud and keep this key server-side)
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

### URL reputation results
- A provider threat match produces a high-priority `CONFIRMED_MALICIOUS` assessment with the provider-reported threat categories.
- A successful lookup with no match reports **No known threats detected by Google Web Risk**. This is not a guarantee of safety.
- Missing configuration, provider errors, rate limits, or timeouts produce an unavailable/unknown check, never a clean result.
- DNS and registration age are supporting evidence only. VERA does not claim to have verified page content or operator identity based on those signals.

## Deployment
Deploy from the GitHub repository through Vercel. Add environment variables to Preview and Production. Run database/schema.sql against the provisioned PostgreSQL database before enabling persistence.

Public Solana RPC endpoints are suitable for development but are rate-limited and have no production SLA. For production scale, move to a dedicated Solana RPC provider.