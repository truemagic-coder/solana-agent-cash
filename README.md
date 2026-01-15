# Solana Agent Privacy Cash API

Turn-key Express + TypeScript API for using Privy wallet export and the Privacy Cash SDK.

## Requirements

- Node.js 20+
- A Privy app with wallet export enabled
- A Solana mainnet RPC URL
- HPKE P‑256 keypair (DER SPKI public key + DER PKCS8 private key, base64)

## Quick start

1) Install dependencies

```bash
npm install
```

2) Configure environment

Copy `.env.example` to `.env` and set the values:

```text
PORT=3000
API_KEY=replace-me
SOLANA_RPC_URL=https://your-solana-rpc
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PRIVY_AUTH_SIGNATURE=
PRIVY_HPKE_PUBLIC_KEY_B64=base64-der-spki-public-key
PRIVY_HPKE_PRIVATE_KEY_B64=base64-der-pkcs8-private-key
```

3) Generate HPKE keys (optional)

```bash
node scripts/generate-privy-hpke-keys.js
```

Notes on HPKE key formats:

- Recommended: base64 of DER SPKI public key and DER PKCS8 private key.
- The generator also prints base64 of PEM for compatibility with Privy’s demo.
- The server accepts either format and normalizes to DER internally.

4) Run locally

```bash
npm run dev
```

## API

### Health check

`GET /health`

Response:

```json
{ "status": "ok" }
```

### Transfer (SOL or USDC)

`POST /transfer`

Headers:

- `Authorization: Bearer <API_KEY>` **or**
- `x-api-key: <API_KEY>`

Body:

```json
{
	"walletId": "privy_wallet_id",
	"token": "USDC",
	"amount": 1.25,
	"recipient": "solana_public_key"
}
```

Response (success):

```json
{
	"status": "ok",
	"deposit": { "...": "..." },
	"withdraw": { "...": "..." }
}
```

Notes:

* Set `token` to `SOL` or `USDC`.
* `amount` is in SOL or USDC (not lamports).
* Privacy Cash charges 0.25% for withdrawls (happens in transfer)

### Deposit (SOL or USDC)

`POST /deposit`

Headers:

- `Authorization: Bearer <API_KEY>` **or**
- `x-api-key: <API_KEY>`

Body:

```json
{
	"walletId": "privy_wallet_id",
	"token": "USDC",
	"amount": 1.25
}
```

Response (success):

```json
{
	"status": "ok",
	"deposit": { "...": "..." }
}
```

### Withdraw (SOL or USDC)

`POST /withdrawl`

Headers:

- `Authorization: Bearer <API_KEY>` **or**
- `x-api-key: <API_KEY>`

Body:

```json
{
	"walletId": "privy_wallet_id",
	"token": "USDC",
	"amount": 1.25,
	"recipient": "solana_public_key"
}
```

Notes:

* Set `token` to `SOL` or `USDC`.
* `amount` is in SOL or USDC (not lamports).
* Privacy Cash charges 0.25% for withdrawls

Response (success):

```json
{
	"status": "ok",
	"withdraw": { "...": "..." }
}
```

### Private balance (SOL or USDC)

`POST /balance`

Headers:

- `Authorization: Bearer <API_KEY>` **or**
- `x-api-key: <API_KEY>`

Body:

```json
{
	"walletId": "privy_wallet_id",
	"token": "USDC"
}
```

Response (success):

```json
{
	"status": "ok",
	"balance": { "...": "..." }
}
```

## Scripts

- `npm run dev` - start dev server with hot reload
- `npm run build` - compile TypeScript to dist/
- `npm start` - run compiled server
- `npm run lint` - lint source
- `npm run format` - format source
- `npm run test` - run tests
- `npm run test:watch` - watch tests

## Tests

Run all tests:

```bash
npm run test
```

## Deployment (Dokku)

Ensure `.env` values are set in your Dokku config. A Procfile is included and runs:

```text
web: npm run build && npm start
```

## Security notes

- Never commit `.env` or your HPKE private key.
- Use a strong, unique `API_KEY` for the endpoint.
- Restrict access to your Privy app credentials.
