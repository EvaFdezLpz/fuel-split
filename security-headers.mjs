// Fuente única de las cabeceras de seguridad: la usan firebase.json (vía script) y vite preview.
export const CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval' https://apis.google.com https://www.gstatic.com",
  "worker-src 'self'",
  "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://apis.google.com",
  "img-src 'self' data: blob:",
  "style-src 'self'",
  "font-src 'self'",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com",
  "manifest-src 'self'",
  "form-action 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "require-trusted-types-for 'script'",
  'upgrade-insecure-requests',
].join('; ');

export const DOCUMENT_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cache-Control': 'no-cache',
};

export const COMMON_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Los workers de OCR no tienen la política de Trusted Types de la página, así que llevan su propia CSP.
export const WORKER_CSP = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; object-src 'none'";
