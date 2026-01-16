import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PrivacyCash } from 'privacycash';
import BigNumber from 'bignumber.js';
import { PrivyClient } from '@privy-io/node';

export const app = express();

app.use(express.json());

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const apiKey = process.env.API_KEY;
const privyAppId = process.env.PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;
const privyAuthorizationKey = process.env.PRIVY_AUTHORIZATION_KEY;
const solanaRpcUrl = process.env.SOLANA_RPC_URL;

const privyClient = privyAppId && privyAppSecret
  ? new PrivyClient({
      appId: privyAppId,
      appSecret: privyAppSecret,
    })
  : null;


type TokenSymbol = 'SOL' | 'USDC';

const parseTokenSymbol = (raw?: string): TokenSymbol | null => {
  if (!raw) return null;
  const normalized = raw.toUpperCase();
  if (normalized === 'SOL' || normalized === 'USDC') {
    return normalized;
  }
  return null;
};

const toLamports = (amount: number) =>
  new BigNumber(amount)
    .multipliedBy(LAMPORTS_PER_SOL)
    .integerValue(BigNumber.ROUND_HALF_UP)
    .toNumber();

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

async function exportPrivyWallet(walletId: string) {
  if (!privyClient || !privyAuthorizationKey) {
    throw new Error('Privy export not configured');
  }

  const { private_key } = await privyClient.wallets().export(walletId, {
    authorization_context: {
      authorization_private_keys: [privyAuthorizationKey],
    },
  });

  if (!private_key) {
    throw new Error('Privy export returned no private key');
  }

  return private_key;
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
    const { walletId, amount, recipient, token } = req.body as {
      walletId?: string;
      amount?: number;
      recipient?: string;
      token?: string;
    };

    const tokenSymbol = parseTokenSymbol(token);

    if (!walletId || !recipient || typeof amount !== 'number' || !tokenSymbol) {
      return res
        .status(400)
        .json({ error: "walletId, amount, recipient, token ('SOL' | 'USDC') required" });
    }

    if (!solanaRpcUrl) {
      return res.status(500).json({ error: 'SOLANA_RPC_URL not configured' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

    const recipientKey = new PublicKey(recipient);

    const privateKey = await exportPrivyWallet(walletId);

    const client = new PrivacyCash({
      RPC_url: solanaRpcUrl,
      owner: privateKey,
    });

    const recipientAddress = recipientKey.toBase58();
    const isSol = tokenSymbol === 'SOL';
    const lamports = isSol ? toLamports(amount) : 0;

    if (isSol && lamports <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

    const depositRes = isSol
      ? await client.deposit({
          lamports,
        })
      : await client.depositSPL({
          amount,
          mintAddress: USDC_MINT,
        });

    const withdrawRes = isSol
      ? await client.withdraw({
          lamports,
          recipientAddress,
        })
      : await client.withdrawSPL({
          amount,
          mintAddress: USDC_MINT,
          recipientAddress,
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
    const { walletId, amount, token } = req.body as {
      walletId?: string;
      amount?: number;
      token?: string;
    };

    const tokenSymbol = parseTokenSymbol(token);

    if (!walletId || typeof amount !== 'number' || !tokenSymbol) {
      return res
        .status(400)
        .json({ error: "walletId, amount, token ('SOL' | 'USDC') required" });
    }

    if (!solanaRpcUrl) {
      return res.status(500).json({ error: 'SOLANA_RPC_URL not configured' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

    const privateKey = await exportPrivyWallet(walletId);

    const client = new PrivacyCash({
      RPC_url: solanaRpcUrl,
      owner: privateKey,
    });

    const isSol = tokenSymbol === 'SOL';
    const lamports = isSol ? toLamports(amount) : 0;

    if (isSol && lamports <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

    const depositRes = isSol
      ? await client.deposit({
          lamports,
        })
      : await client.depositSPL({
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

app.post('/withdraw', requireApiKey, async (req, res) => {
  try {
    const { walletId, amount, recipient, token } = req.body as {
      walletId?: string;
      amount?: number;
      recipient?: string;
      token?: string;
    };

    const tokenSymbol = parseTokenSymbol(token);

    if (!walletId || !recipient || typeof amount !== 'number' || !tokenSymbol) {
      return res
        .status(400)
        .json({ error: "walletId, amount, recipient, token ('SOL' | 'USDC') required" });
    }

    if (!solanaRpcUrl) {
      return res.status(500).json({ error: 'SOLANA_RPC_URL not configured' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

    const recipientKey = new PublicKey(recipient);

    const privateKey = await exportPrivyWallet(walletId);

    const client = new PrivacyCash({
      RPC_url: solanaRpcUrl,
      owner: privateKey,
    });

    const recipientAddress = recipientKey.toBase58();
    const isSol = tokenSymbol === 'SOL';
    const lamports = isSol ? toLamports(amount) : 0;

    if (isSol && lamports <= 0) {
      return res.status(400).json({ error: 'amount must be > 0' });
    }

    const withdrawRes = isSol
      ? await client.withdraw({
          lamports,
          recipientAddress,
        })
      : await client.withdrawSPL({
          amount,
          mintAddress: USDC_MINT,
          recipientAddress,
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
    const { walletId, token } = req.body as {
      walletId?: string;
      token?: string;
    };

    const tokenSymbol = parseTokenSymbol(token);

    if (!walletId || !tokenSymbol) {
      return res.status(400).json({ error: "walletId, token ('SOL' | 'USDC') required" });
    }

    if (!solanaRpcUrl) {
      return res.status(500).json({ error: 'SOLANA_RPC_URL not configured' });
    }

    const privateKey = await exportPrivyWallet(walletId);

    const client = new PrivacyCash({
      RPC_url: solanaRpcUrl,
      owner: privateKey,
    });

    const balance =
      tokenSymbol === 'SOL'
        ? await client.getPrivateBalance()
        : await client.getPrivateBalanceSpl(USDC_MINT);

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
