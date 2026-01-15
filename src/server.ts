import 'dotenv/config';
import express from 'express';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PublicKey } from '@solana/web3.js';
import { PrivacyCash } from 'privacycash';
import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from '@hpke/core';
import { Chacha20Poly1305 } from '@hpke/chacha20poly1305';

export const app = express();

app.use(express.json());

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const apiKey = process.env.API_KEY;
const privyAppId = process.env.PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;
const privyAuthSignature = process.env.PRIVY_AUTH_SIGNATURE;
const privyHpkePublicKeyB64 = process.env.PRIVY_HPKE_PUBLIC_KEY_B64;
const privyHpkePrivateKeyB64 = process.env.PRIVY_HPKE_PRIVATE_KEY_B64;
const solanaRpcUrl = process.env.SOLANA_RPC_URL;

function requireApiKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.headers['x-api-key'];

  if (!token || token !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}

async function decryptPrivyWalletPrivateKey(exportPayload: {
  ciphertext: string;
  encapsulated_key: string;
}): Promise<string> {
  if (!privyHpkePrivateKeyB64) {
    throw new Error('Missing HPKE private key');
  }

  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });

  const privateKeyDer = Buffer.from(privyHpkePrivateKeyB64, 'base64');
  const recipientKey = await webcrypto.subtle.importKey(
    'pkcs8',
    privateKeyDer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveBits'],
  );

  const toArrayBuffer = (data: Uint8Array): ArrayBuffer =>
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;

  const enc = toArrayBuffer(Buffer.from(exportPayload.encapsulated_key, 'base64'));
  const ciphertext = toArrayBuffer(Buffer.from(exportPayload.ciphertext, 'base64'));

  const recipient = await suite.createRecipientContext({
    recipientKey,
    enc,
  });

  const plaintext = await recipient.open(ciphertext);
  return new TextDecoder().decode(plaintext);
}

async function exportPrivyWallet(walletId: string) {
  if (!privyAppId || !privyAppSecret || !privyHpkePublicKeyB64) {
    throw new Error('Privy export not configured');
  }

  const auth = Buffer.from(`${privyAppId}:${privyAppSecret}`).toString('base64');
  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    'privy-app-id': privyAppId,
  };

  if (privyAuthSignature) {
    headers['privy-authorization-signature'] = privyAuthSignature;
  }

  const response = await fetch(`https://api.privy.io/v1/wallets/${walletId}/export`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      encryption_type: 'HPKE',
      recipient_public_key: privyHpkePublicKeyB64,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Privy export failed: ${response.status} ${text}`);
  }

  return (await response.json()) as {
    encryption_type: 'HPKE';
    ciphertext: string;
    encapsulated_key: string;
  };
}

app.get('/', (_req, res) => {
  res.json({
    name: 'express-typescript-app',
    status: 'ok',
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/private-transfer', requireApiKey, async (req, res) => {
  try {
    const { walletId, amount, recipient } = req.body as {
      walletId?: string;
      amount?: number;
      recipient?: string;
    };

    if (!walletId || !recipient || typeof amount !== 'number') {
      return res.status(400).json({ error: 'walletId, amount, recipient required' });
    }

    if (!solanaRpcUrl) {
      return res.status(500).json({ error: 'SOLANA_RPC_URL not configured' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

    const recipientKey = new PublicKey(recipient);

    const exportPayload = await exportPrivyWallet(walletId);
    const privateKey = await decryptPrivyWalletPrivateKey(exportPayload);

    const client = new PrivacyCash({
      RPC_url: solanaRpcUrl,
      owner: privateKey,
    });

    const depositRes = await client.depositSPL({
      amount,
      mintAddress: USDC_MINT,
    });

    const withdrawRes = await client.withdrawSPL({
      amount,
      mintAddress: USDC_MINT,
      recipientAddress: recipientKey.toBase58(),
    });

    return res.json({
      status: 'ok',
      deposit: depositRes,
      withdraw: withdrawRes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ error: message });
  }
});

const port = Number(process.env.PORT) || 3000;

const isEntrypoint = process.argv[1] === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}
