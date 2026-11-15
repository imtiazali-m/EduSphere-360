const encoder = new TextEncoder()

function toHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

function equalHex(left, right) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export async function signDevicePayload(secret, timestamp, rawBody) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const message = encoder.encode(`${timestamp}.${rawBody}`)
  const signature = await crypto.subtle.sign('HMAC', key, message)
  return `v1=${toHex(new Uint8Array(signature))}`
}

export async function verifyDeviceSignature(secret, timestamp, rawBody, suppliedSignature, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false
  if (typeof suppliedSignature !== 'string' || !/^v1=[0-9a-f]{64}$/i.test(suppliedSignature)) return false
  const expected = await signDevicePayload(secret, timestamp, rawBody)
  return equalHex(expected.toLowerCase(), suppliedSignature.toLowerCase())
}
