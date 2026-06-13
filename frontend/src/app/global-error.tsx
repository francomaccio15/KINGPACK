'use client';

import { useEffect } from 'react';

/**
 * Boundary de último recurso: captura errores lanzados dentro del propio
 * layout raíz (cuando ni el `error.tsx` de segmento alcanza). Reemplaza todo
 * el documento, por eso renderiza su propio <html>/<body> con estilos inline
 * (no se puede depender de que globals.css esté cargado).
 *
 * Igual que `error.tsx`, si el fallo es por un chunk viejo tras un deploy,
 * recarga una sola vez para bajar el bundle nuevo.
 */
function esErrorDeChunk(error: Error & { name?: string }) {
  const msg = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return (
    error?.name === 'ChunkLoadError' ||
    msg.includes('chunkloaderror') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('importing a module script failed')
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error] capturado:', error);
    if (esErrorDeChunk(error)) {
      const KEY = 'kp_chunk_reload_at';
      const ahora = Date.now();
      const ultimo = parseInt(sessionStorage.getItem(KEY) || '0', 10);
      if (ahora - ultimo > 10000) {
        sessionStorage.setItem(KEY, String(ahora));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f0f10',
          color: '#e5e5e5',
          fontFamily: 'system-ui, sans-serif',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            border: '1px solid #2a2a2a',
            background: '#161617',
            borderRadius: 12,
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
            Algo salió mal
          </h2>
          <p style={{ fontSize: 14, color: '#9a9a9a', margin: '0 0 20px' }}>
            Ocurrió un error inesperado. Recargá la página para continuar.
          </p>
          {error?.digest && (
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              height: 36,
              padding: '0 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 6,
              border: 'none',
              background: '#e11d2a',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Recargar página
          </button>
        </div>
      </body>
    </html>
  );
}
