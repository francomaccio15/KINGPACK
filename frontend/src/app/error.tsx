'use client';

import { useEffect } from 'react';

/**
 * Error boundary de la app.
 *
 * Caso principal: tras un deploy, los chunks de Next.js cambian de hash.
 * Un navegador con la SPA vieja abierta que navega a una ruta nueva pide un
 * chunk que ya no existe → `ChunkLoadError`. Sin este boundary, el usuario
 * quedaba en la pantalla muerta "Application error: a client-side exception".
 *
 * Acá detectamos ese caso y forzamos una recarga completa (una sola vez, para
 * no entrar en loop) que baja el bundle nuevo. Para cualquier otro error,
 * mostramos una UI de recuperación con botones de reintento y recarga.
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
    msg.includes('importing a module script failed') ||
    // Desfase de deploy: la SPA vieja pide un Server Action / payload RSC que
    // ya no existe en el build nuevo del servidor. Mismo origen que el
    // ChunkLoadError (bundle viejo en una pestaña abierta), distinto síntoma.
    msg.includes('failed to find server action') ||
    msg.includes('older or newer deployment') ||
    msg.includes('connection closed') ||
    (msg.includes('failed to fetch') && msg.includes('rsc'))
  );
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = esErrorDeChunk(error);

  useEffect(() => {
    // Log para diagnóstico (queda en la consola del navegador)
    console.error('[app/error] capturado:', error);

    if (chunkError) {
      // Recargar una sola vez para traer el bundle nuevo, evitando loops.
      const KEY = 'kp_chunk_reload_at';
      const ahora = Date.now();
      const ultimo = parseInt(sessionStorage.getItem(KEY) || '0', 10);
      if (ahora - ultimo > 10000) {
        sessionStorage.setItem(KEY, String(ahora));
        // `location.reload()` NO fuerza bypass de caché: el navegador puede
        // re-servir el documento viejo (mismos chunks muertos) y dejar al
        // usuario pegado en esta pantalla. Navegar a la misma URL con un query
        // único fuerza un documento fresco que ya referencia los chunks del
        // build nuevo.
        const url = new URL(window.location.href);
        url.searchParams.set('_v', String(ahora));
        window.location.replace(url.toString());
      }
    }
  }, [error, chunkError]);

  if (chunkError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <p className="text-sm text-kp-gray">Actualizando a la última versión…</p>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-xl border border-kp-border bg-kp-surface px-6 py-8 text-center space-y-4">
        <div className="flex justify-center">
          <span className="w-10 h-10 rounded-full bg-kp-red/15 text-kp-red flex items-center justify-center text-xl font-bold">
            !
          </span>
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-kp-white">Algo salió mal</h2>
          <p className="text-sm text-kp-gray">
            Ocurrió un error inesperado al cargar esta sección. Podés reintentar
            o recargar la página.
          </p>
          {error?.digest && (
            <p className="text-xs text-kp-gray/60 pt-1">Ref: {error.digest}</p>
          )}
        </div>
        <div className="flex gap-2 justify-center pt-1">
          <button
            onClick={() => reset()}
            className="h-9 px-4 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-red-700 transition-colors"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.reload()}
            className="h-9 px-4 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors"
          >
            Recargar página
          </button>
        </div>
      </div>
    </div>
  );
}
