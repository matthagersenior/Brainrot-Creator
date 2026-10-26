// Issue a fresh CSP nonce for the HTML shell while retaining a restrictive policy.
// Google AdSense requires strict-dynamic and cannot use a fixed domain allowlist.
function freshNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export async function onRequest({ request, next }) {
  const response = await next();
  if (request.method !== 'GET' ||
      !['/', '/index.html'].includes(new URL(request.url).pathname) ||
      !response.ok ||
      !response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }

  const nonce = freshNonce();
  const html = (await response.text()).replace(/<script\b/gi, '<script nonce="' + nonce + '"');
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  headers.delete('ETag');
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'nonce-" + nonce + "' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval' https: http:",
    "style-src 'self' 'unsafe-inline' https:",
    "connect-src 'self' https:",
    "img-src 'self' data: blob: https:",
    "frame-src https:",
    "font-src 'self' data: https:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; '));
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
