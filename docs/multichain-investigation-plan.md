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
| `robinhood` | Robinhood Chain | 4663 | `EVM_ROBINHOOD_RPC_URL` | Planned |

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
3. **Deeper token and contract evidence:** ERC-20 metadata and receipt transfer logs are implemented. Wallet address lookups now query a bounded recent window of standard ERC-20 Transfer events (5,000 blocks, capped at 100 logs) and probe standard EIP-1967 implementation/admin/beacon slots plus the common `owner()` selector for contract addresses. These are partial indicators only; complete history, native transfers, internal traces, custom proxy patterns, verified source, arbitrary privileged functions, token holders/liquidity/restrictions, and external security intelligence remain outstanding.
4. **Threat intelligence:** integrate only sources with confirmed API access, suitable licensing, acceptable rate limits, and explainable findings.
5. **UI and report integration (partial):** chain selection is exposed for wallet/transaction investigations; EVM choices are disabled unless the server reports the chain's RPC and feature flag are configured. API reports include normalized EVM evidence and chain identity. Full chain-specific report presentation, explorer links for every evidence item, and end-to-end saved-report verification remain outstanding.
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

## Deferred follow-up: wallet permissions and delayed-drain investigation

**Status: documented for a later security-evidence milestone; explicitly out of scope for the current chain-integration pass.** Do not represent these checks as implemented until the requirements below are built and verified.

A failed or abandoned transaction must not be treated as proof that no wallet permission was granted. A user may have signed a separate approval, permit, or authorization that remains usable after the original interaction fails or is abandoned. Vera should investigate the permission state and subsequent asset movements, not infer safety from the transaction outcome alone.

### Requirements and acceptance checklist

- [ ] Enumerate ERC-20 allowances for the investigated wallet across supported EVM chains, identifying token contract, spender, allowance amount, observation block, and data source.
- [ ] Detect approval-related transactions and relevant events, including standard Approval logs; distinguish confirmed observations from incomplete historical coverage.
- [ ] Identify unlimited or unusually large allowances using transparent thresholds and explain why each allowance is noteworthy.
- [ ] Inspect supported signature-based permissions (including EIP-2612 permits and Permit2 where applicable); clearly disclose when historical signature discovery is unavailable from the selected data sources.
- [ ] Provide a revocation/management reference for each supported token and chain; Vera remains read-only and must never revoke or submit transactions on the user's behalf.
- [ ] Correlate approval/permission changes with later token transfers and suspicious spender activity where reliable indexed history or traces are available.
- [ ] Support a user-supplied public wallet address and optional transaction hash as investigation inputs; never request seed phrases, private keys, or signing access.
- [ ] Explain that connecting a wallet alone does not prove a drain permission was granted; identify the exact observed signature, approval, or transaction evidence instead.
- [ ] Preserve chain, token, spender, amount, block/time, source, and evidence limitations in the normalized report.
- [ ] Treat unavailable history, unsupported token standards, RPC/indexer gaps, and failed lookups as UNKNOWN/PARTIAL, never as clean or safe.
- [ ] Add fixtures for: failed transaction followed by persistent approval; abandoned dapp interaction with a separate approval; unlimited allowance; revoked allowance; delayed transfer by approved spender; and missing historical data.
- [ ] Add regression tests across every enabled EVM network and ensure Solana behavior remains unchanged.

**Completion criterion:** every applicable checklist item is implemented, evidence-linked, covered by automated tests, and accurately represented in the report before this capability is described as available. This backlog does not block the current chain registry and gated read-only integration work.
