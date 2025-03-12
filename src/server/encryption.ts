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
