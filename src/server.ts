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

const pemBodyRegex = /-----BEGIN [^-]+-----|-----END [^-]+-----|\s+/g;

const normalizePemBase64 = (value: string, pemHeader: string) => {
  const decoded = Buffer.from(value, 'base64').toString('utf8');
  if (decoded.includes(pemHeader)) {
    return decoded.replace(pemBodyRegex, '');
  }
  return value;
};

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

  const privateKeyDerBase64 = normalizePemBase64(privyHpkePrivateKeyB64, 'BEGIN PRIVATE KEY');
  const privateKeyDer = Buffer.from(privateKeyDerBase64, 'base64');
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

  const recipientPublicKeyDerBase64 = normalizePemBase64(
    privyHpkePublicKeyB64,
    'BEGIN PUBLIC KEY',
  );

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
      recipient_public_key: recipientPublicKeyDerBase64,
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

app.post('/transfer', requireApiKey, async (req, res) => {
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

app.post('/deposit', requireApiKey, async (req, res) => {
  try {
    const { walletId, amount } = req.body as {
      walletId?: string;
      amount?: number;
    };

    if (!walletId || typeof amount !== 'number') {
      return res.status(400).json({ error: 'walletId, amount required' });
    }

    if (!solanaRpcUrl) {
      return res.status(500).json({ error: 'SOLANA_RPC_URL not configured' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

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

    return res.json({
      status: 'ok',
      deposit: depositRes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ error: message });
  }
});

app.post('/withdrawl', requireApiKey, async (req, res) => {
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

    const withdrawRes = await client.withdrawSPL({
      amount,
      mintAddress: USDC_MINT,
      recipientAddress: recipientKey.toBase58(),
    });

    return res.json({
      status: 'ok',
      withdraw: withdrawRes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ error: message });
  }
});

app.post('/balance', requireApiKey, async (req, res) => {
  try {
    const { walletId } = req.body as {
      walletId?: string;
    };

    if (!walletId) {
      return res.status(400).json({ error: 'walletId required' });
    }

    if (!solanaRpcUrl) {
      return res.status(500).json({ error: 'SOLANA_RPC_URL not configured' });
    }

    const exportPayload = await exportPrivyWallet(walletId);
    const privateKey = await decryptPrivyWalletPrivateKey(exportPayload);

    const client = new PrivacyCash({
      RPC_url: solanaRpcUrl,
      owner: privateKey,
    });

    const balance = await client.getPrivateBalanceSpl(USDC_MINT);

    return res.json({
      status: 'ok',
      balance,
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
