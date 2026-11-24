import type { Plugin } from 'vite';

/**
 * Content Security Policy of the production build (ADR 0002).
 *
 * The page may load scripts, styles, workers and images only from itself, and
 * may not connect anywhere: `connect-src 'none'` blocks fetch, XHR, WebSocket
 * and beacons, so the district's files cannot be sent even by mistake.
 * It is not applied in development, where Vite needs a connection for reloads.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "worker-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** Adds the policy to index.html in the production build. */
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'rosterradius-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' }],
    },
  };
}
