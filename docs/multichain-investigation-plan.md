# Vera Multichain Investigation Plan

## Goal

Extend Vera from its existing Solana investigation foundation to a consistent, read-only, evidence-first multichain investigation experience. This plan preserves current Solana behavior while introducing EVM support through explicit chain adapters.

## Initial network scope

| Chain ID | Network | EVM chain ID | RPC environment variable | Initial status |
| --- | --- | ---: | --- | --- |
| `solana` | Solana | — | Existing Solana configuration | Existing |
| `ethereum` | Ethereum Mainnet | 1 | `EVM_ETHEREUM_RPC_URL` | Planned |
| `base` | Base | 8453 | `EVM_BASE_RPC_URL` | Planned |
| `bsc` | BNB Smart Chain | 56 | `EVM_BSC_RPC_URL` | Planned |
| `arbitrum` | Arbitrum One | 42161 | `EVM_ARBITRUM_RPC_URL` | Planned |
| `polygon` | Polygon PoS | 137 | `EVM_POLYGON_RPC_URL` | Planned |

A registry entry does not mean a chain is production-supported. EVM chains must remain disabled for investigation until their RPC configuration, adapter implementation, evidence coverage, and regression tests have passed.

## Architecture

- Keep the existing `Network = 'mainnet' | 'devnet'` type for backward-compatible Solana behavior during migration.
- Use a separate stable `ChainId` for multichain routing.
- Keep chain-specific RPC and parsing in adapters; do not scatter EVM/Solana conditionals across the UI and API.
- Normalize observations into the existing `Evidence` shape.
- Keep source, observation time, state, and limitations with each result.
- Provider errors, missing history, rate limits, and unsupported checks must be visible as unknown/unavailable, never interpreted as a clean result.
- The API remains read-only. No signing, transaction submission, private-key collection, or wallet-secret handling is part of this work.

## Capability stages

1. **Foundation:** chain registry, adapter contracts, compatibility boundary, regression baseline.
2. **EVM read-only RPC (baseline adapter and gated API routing added in this branch):** chain ID verification, address validation, native balance, account/contract bytecode classification, transaction and receipt retrieval. Routing requires the chain's registry gate `enabledForInvestigation: true`, `VERA_ENABLE_EVM_INVESTIGATIONS=true`, and the matching server-side RPC environment variable. The registry gate remains false for every EVM chain in this PR. This is not yet a complete security assessment.
3. **Deeper token and contract evidence:** ERC-20 metadata, transfer logs, verified source, creation data, ownership/admin controls, proxy detection, and carefully scoped static signals. The current adapter explicitly marks these deeper checks as pending.
4. **Threat intelligence:** integrate only sources with confirmed API access, suitable licensing, acceptable rate limits, and explainable findings.
5. **UI and report integration (initial controls added):** chain selection is exposed for wallet/transaction investigations; EVM choices are disabled unless the server reports the chain's RPC and feature flag are configured. Chain-aware status reports and full explorer-linked UX remain to be completed.
6. **Release hardening:** known benign and suspicious fixtures, malformed inputs, unavailable providers, chain mismatch, timeout and rate-limit behavior, and Solana regression tests.

## Security and reliability requirements

- Never accept arbitrary RPC URLs from the user; resolve provider endpoints from server-side configuration.
- Verify the RPC-reported chain ID against the registry before using a provider.
- Apply request timeouts, bounded concurrency, response-size limits, and sensible caching.
- Do not expose provider secrets in client bundles or logs.
- Validate EVM addresses and transaction hashes before RPC calls.
- Treat address format validity as distinct from address safety.
- Treat verified contract source as evidence of source availability, not a safety guarantee.
- Distinguish direct observations from heuristics and third-party reputation labels.
- Do not infer that the same hexadecimal address across chains is the same person or entity.
- Preserve chain identity in API responses, assessment reports, and the new `scans.chain_id` field. The existing `network` column remains on its legacy `mainnet`/`devnet` contract for compatibility.

## Definition of done

- Existing Solana URL, wallet, transaction, and investigation paths pass regression tests.
- Each EVM chain has a verified RPC configuration and correct chain ID.
- Address and transaction investigations return normalized, source-linked evidence.
- Token and contract checks clearly indicate when data is unavailable or unsupported.
- API, UI, and stored reports agree on chain identity.
- Typecheck, production build, and automated tests pass.
- No EVM network is marked available until the above conditions are met.

## Implementation note

This branch now includes the chain registry, adapter contracts, a baseline read-only EVM JSON-RPC adapter, gated wallet/transaction API routing, and this rollout plan. The EVM route is opt-in through `VERA_ENABLE_EVM_INVESTIGATIONS=true` plus a matching server-side RPC variable, and all EVM chains remain off by default. The UI exposes chain choices but disables EVM options unless the API reports the chain as enabled. Apply the chain identity migration before enabling EVM investigations in production; provider setup, deeper evidence sources, UI/report integration, and regression tests remain release requirements.
