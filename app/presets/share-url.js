/** UTF-8-safe base64url encoding for self-contained kiosk preset links. */
function bytesToBinary(bytes) {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return binary;
}

function binaryToBytes(binary) {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function encodePresetParam(text) {
  const bytes = new TextEncoder().encode(String(text));
  return btoa(bytesToBinary(bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodePresetParam(value) {
  let base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  base64 += '='.repeat((4 - (base64.length % 4)) % 4);
  return new TextDecoder().decode(binaryToBytes(atob(base64)));
}

export function createPresetShareUrl(text, locationLike = globalThis.location) {
  return `${locationLike.origin}${locationLike.pathname}?mode=kiosk&preset=${encodePresetParam(text)}`;
}
