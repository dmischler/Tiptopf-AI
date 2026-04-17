const PEPPER = 'recipin-encryption-v1'

function getCrypto() {
  const cryptoImpl = globalThis.crypto
  if (!cryptoImpl?.subtle) {
    throw new Error('Web Crypto API is not available')
  }
  return cryptoImpl
}

function toBase64(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}

function fromBase64(base64: string) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'))
  }

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function deriveKey(userId: string, salt: Uint8Array, usage: KeyUsage[]) {
  const cryptoImpl = getCrypto()
  const encoder = new TextEncoder()

  const keyMaterial = await cryptoImpl.subtle.importKey(
    'raw',
    encoder.encode(userId + PEPPER),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return cryptoImpl.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    usage
  )
}

export async function encryptApiKey(plaintext: string, userId: string): Promise<string> {
  const cryptoImpl = getCrypto()
  const encoder = new TextEncoder()
  const salt = cryptoImpl.getRandomValues(new Uint8Array(16))
  const iv = cryptoImpl.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(userId, salt, ['encrypt'])

  const encrypted = await cryptoImpl.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    encoder.encode(plaintext)
  )

  const cipherBytes = new Uint8Array(encrypted)
  const combined = new Uint8Array(salt.length + iv.length + cipherBytes.length)

  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(cipherBytes, salt.length + iv.length)

  return toBase64(combined)
}

export async function decryptApiKey(ciphertext: string, userId: string): Promise<string> {
  const cryptoImpl = getCrypto()
  const combined = fromBase64(ciphertext)

  const salt = combined.slice(0, 16)
  const iv = combined.slice(16, 28)
  const cipherBytes = combined.slice(28)

  const key = await deriveKey(userId, salt, ['decrypt'])

  const decrypted = await cryptoImpl.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(cipherBytes)
  )

  return new TextDecoder().decode(decrypted)
}

export function maskApiKey(value: string) {
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`
}
