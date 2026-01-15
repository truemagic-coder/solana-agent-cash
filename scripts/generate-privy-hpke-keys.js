import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});

const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
const privateKeyDer = privateKey.export({ type: 'pkcs8', format: 'der' });
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

const publicKeyDerB64 = publicKeyDer.toString('base64');
const privateKeyDerB64 = privateKeyDer.toString('base64');
const publicKeyPemB64 = Buffer.from(publicKeyPem).toString('base64');
const privateKeyPemB64 = Buffer.from(privateKeyPem).toString('base64');

// eslint-disable-next-line no-console
console.log('PRIVY_HPKE_PUBLIC_KEY_B64=' + publicKeyDerB64);
// eslint-disable-next-line no-console
console.log('PRIVY_HPKE_PRIVATE_KEY_B64=' + privateKeyDerB64);
// eslint-disable-next-line no-console
console.log('PRIVY_HPKE_PUBLIC_KEY_PEM_B64=' + publicKeyPemB64);
// eslint-disable-next-line no-console
console.log('PRIVY_HPKE_PRIVATE_KEY_PEM_B64=' + privateKeyPemB64);
