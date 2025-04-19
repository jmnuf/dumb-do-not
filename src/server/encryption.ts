import { env } from "../env.ts";

export async function deriveKey() {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.ENCRYPTION_KEY),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("salt"), //  Ideally, store/generate a unique salt
      iterations: 10000, //  Increase for better security
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-CBC", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(data: Record<string, any>, key?: CryptoKey) {
  if (!key) {
    key = await deriveKey();
  }
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    key,
    encodedData
  );

  const encryptedArray = new Uint8Array(encrypted);
  const combinedArray = new Uint8Array(iv.length + encryptedArray.length);
  combinedArray.set(iv, 0);
  combinedArray.set(encryptedArray, iv.length);
  const combinedStr = combinedArray.reduce((acc, val) => acc + String.fromCharCode(val), "");

  const base64Ciphertext = btoa(combinedStr);

  return base64Ciphertext;
}

export async function decrypt(base64Ciphertext: string, key?: CryptoKey) {
  if (!key) {
    key = await deriveKey();
  }

  const combinedArray = new Uint8Array(
    atob(base64Ciphertext)
      .split("")
      .map((char) => char.charCodeAt(0))
  );

  const iv = combinedArray.slice(0, 16);
  const encryptedArray = combinedArray.slice(16);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv: iv,
    },
    key,
    encryptedArray
  );

  const decoder = new TextDecoder();
  const decryptedData = decoder.decode(decrypted);

  return JSON.parse(decryptedData) as unknown;
}


const PASS_HASHING_ITERATIONS = 10_000;
const PASS_HASHING_KEY_LENGTH = 32;
const PASS_HASHING_SALT_LENGTH = 16;

export async function genSalt(): Promise<string> {
  const salt = new Uint8Array(PASS_HASHING_SALT_LENGTH);
  crypto.getRandomValues(salt);
  return Array.from(salt, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hash(password: string, salt: string, storeSalt: boolean = true): Promise<string> {
  const textEncoder = new TextEncoder();
  const passwordBuffer = textEncoder.encode(password);
  const saltBuffer = textEncoder.encode(salt);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits'] // Only need deriveKey here
  );

  const derivedKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PASS_HASHING_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    PASS_HASHING_KEY_LENGTH * 8 // Length in bits
  );

  const hashArray = Array.from(new Uint8Array(derivedKeyBits));
  const hashed = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');

  if (!storeSalt) {
    return hashed;
  }

  return salt + ':' + hashed;
}

export async function compare(password: string, storedHash: string): Promise<boolean> {
  const [salt, ogHash] = storedHash.split(':');
  const nwHash = await hash(password, salt, false);
  return nwHash === ogHash;
}


