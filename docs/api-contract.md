# VERA Investigation API Contract

## POST /api/investigate

Request:
```json
{
  "inputType": "URL | MESSAGE | WALLET | TX",
  "input": "string",
  "network": "mainnet | devnet"
}
```

Response:
```json
{
  "id": "uuid",
  "createdAt": "ISO timestamp",
  "inputType": "WALLET",
  "input": "public wallet address",
  "network": "mainnet",
  "assessment": {
    "state": "SUPPORTED",
    "headline": "Wallet evidence collected on mainnet",
    "explanation": "...",
    "action": "...",
    "confidence": "HIGH",
    "evidence": []
  }
}
```

AI receives structured evidence only. Missing evidence must remain UNKNOWN. No private keys, seed phrases, passwords or secret API keys are accepted or requested.