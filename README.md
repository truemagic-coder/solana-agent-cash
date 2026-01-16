# Solana Agent Privacy Cash API

Turn-key Express + TypeScript API for using Privy wallet export and the Privacy Cash SDK.

## Requirements

- Node.js 20+
- A Privy app with wallet export enabled
- A Privy authorization key for wallet export
- A Solana mainnet RPC URL

## Quick start

1) Install dependencies

```bash
yarn install
```

2) Configure environment

Copy `.env.example` to `.env` and set the values:

```text
API_KEY=replace-me
SOLANA_RPC_URL=https://your-solana-rpc
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
PRIVY_AUTHORIZATION_KEY=your-privy-authorization-key
```

3) Run locally

```bash
yarn run dev
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

`POST /withdraw`

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

- `yarn run dev` - start dev server with hot reload
- `yarn run build` - compile TypeScript to dist/
- `yarn start` - run compiled server
- `yarn run lint` - lint source
- `yarn run format` - format source
- `yarn run test` - run tests
- `yarn run test:watch` - watch tests

## Tests

Run all tests:

```bash
yarn run test
```

## Deployment (Dokku)

Ensure `.env` values are set in your Dokku config. A Procfile is included and runs:

```text
web: npm start
```

## Security notes

- Never commit `.env` or your HPKE private key.
- Use a strong, unique `API_KEY` for the endpoint.
- Restrict access to your Privy app credentials.
