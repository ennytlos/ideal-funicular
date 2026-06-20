// src/lib/bunny.ts
// Bunny.net Storage & CDN helpers — server-side only (API routes).

const STORAGE_ENDPOINT = process.env.BUNNY_STORAGE_ENDPOINT || 'storage.bunnycdn.com';
const STORAGE_ZONE     = process.env.BUNNY_STORAGE_ZONE_NAME || '';
const STORAGE_API_KEY  = process.env.BUNNY_STORAGE_API_KEY   || '';
const CDN_HOSTNAME     = process.env.BUNNY_CDN_HOSTNAME       || '';
const TOKEN_AUTH_KEY   = process.env.BUNNY_TOKEN_AUTH_KEY     || '';

/**
 * Upload a file buffer to Bunny Storage.
 * @param buffer   Raw file bytes
 * @param path     Destination path within the storage zone, e.g. "covers/book-123.jpg"
 */
export async function uploadToBunny(buffer: ArrayBuffer, path: string): Promise<string> {
  const url = `https://${STORAGE_ENDPOINT}/${STORAGE_ZONE}/${path}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      AccessKey: STORAGE_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  });

  if (!response.ok) {
    throw new Error(`Bunny upload failed: ${response.status} ${response.statusText}`);
  }

  // Return the public CDN URL
  return `https://${CDN_HOSTNAME}/${path}`;
}

/**
 * Delete a file from Bunny Storage.
 * @param path  Path within the storage zone, e.g. "pdfs/book-123.pdf"
 */
export async function deleteFromBunny(path: string): Promise<void> {
  const url = `https://${STORAGE_ENDPOINT}/${STORAGE_ZONE}/${path}`;

  await fetch(url, {
    method: 'DELETE',
    headers: { AccessKey: STORAGE_API_KEY },
  });
}

/**
 * Generate a time-limited signed URL for a protected PDF.
 * Uses Bunny Token Authentication (enable this in your Pull Zone settings).
 *
 * @param path      CDN path, e.g. "pdfs/book-123.pdf"
 * @param expiresIn Seconds until expiry (default 3600 = 1 hour)
 */
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string> {
  if (!TOKEN_AUTH_KEY) {
    // If token auth is not configured, return plain CDN URL (dev only)
    return `https://${CDN_HOSTNAME}/${path}`;
  }

  const expiry = Math.floor(Date.now() / 1000) + expiresIn;
  const hashableBase = `${TOKEN_AUTH_KEY}/${path}${expiry}`;

  // Bunny uses SHA-256 → base64url token
  const encoder = new TextEncoder();
  const keyData = encoder.encode(hashableBase);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const base64     = btoa(String.fromCharCode(...hashArray));
  const token      = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `https://${CDN_HOSTNAME}/${path}?token=${token}&expires=${expiry}`;
}

/**
 * Build the full public CDN URL from a storage path.
 * Use this for non-protected assets like cover images.
 */
export function getCdnUrl(path: string): string {
  return `https://${CDN_HOSTNAME}/${path}`;
}
