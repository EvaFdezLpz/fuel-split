// Política por defecto de Trusted Types. La CSP exige Trusted Types en los sumideros peligrosos
// (innerHTML, script.src, new Worker...). Nuestro código no los usa; esta política cubre a las
// librerías de terceros (Firebase / Google) con una lista de orígenes de script permitidos
// y sanea cualquier HTML con DOMPurify.
import DOMPurify from 'dompurify';

const SCRIPT_ORIGINS = new Set([location.origin, 'https://apis.google.com', 'https://www.gstatic.com']);

type TTWindow = Window & {
  trustedTypes?: {
    createPolicy: (name: string, rules: Record<string, (s: string) => string>) => unknown;
  };
};

export function installTrustedTypes() {
  const tt = (window as TTWindow).trustedTypes;
  if (!tt) return;
  try {
    tt.createPolicy('default', {
      createHTML: (s: string) => DOMPurify.sanitize(s, { RETURN_TRUSTED_TYPE: false }) as string,
      createScriptURL: (s: string) => {
        const u = new URL(s, location.href);
        if (SCRIPT_ORIGINS.has(u.origin)) return u.href;
        throw new TypeError(`Script bloqueado: ${u.origin}`);
      },
      createScript: () => {
        throw new TypeError('Código dinámico bloqueado');
      },
    });
  } catch {
    /* ya existe */
  }
}
