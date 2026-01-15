# Express TypeScript App

## Scripts

- `npm run dev` - start dev server with hot reload
- `npm run build` - compile TypeScript to `dist/`
- `npm start` - run compiled server
- `npm run lint` - lint source
- `npm run format` - format source

## Configuration

Copy `.env.example` to `.env` and adjust as needed.

## Secure private transfer

POST `/private-transfer`

Request body:

- `walletId` (string) Privy wallet ID
- `amount` (number) USDC amount
- `recipient` (string) Solana recipient public key

Auth:

- `Authorization: Bearer <API_KEY>` or `x-api-key: <API_KEY>`
