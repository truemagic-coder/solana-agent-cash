import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
  publicKeyEncoding: {
    type: 'spki',
    format: 'der',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'der',
  },
});

const publicKeyB64 = publicKey.toString('base64');
const privateKeyB64 = privateKey.toString('base64');

// eslint-disable-next-line no-console
console.log('PRIVY_HPKE_PUBLIC_KEY_B64=' + publicKeyB64);
// eslint-disable-next-line no-console
console.log('PRIVY_HPKE_PRIVATE_KEY_B64=' + privateKeyB64);
