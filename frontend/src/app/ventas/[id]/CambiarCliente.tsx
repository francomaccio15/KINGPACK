'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, { ...o, headers: { 'Content-Type': 'application/json', ...(o.headers as Record<string, string> || {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
};

interface ClienteOpt { id: string; razon_social: string; cuit: string | null; }

// Cambia el cliente de una venta no facturada (se cargó al cliente equivocado).
// El backend mueve la deuda de cuenta corriente al cliente nuevo; no toca la caja.
export default function CambiarCliente({
  ventaId, numero, clienteActualId, clienteActualNombre,
}: {
  ventaId: string;
  numero?: number;
  clienteActualId: string | null;
  clienteActualNombre: string | null;
}) {
  const router = useRouter();
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState('');
  const [results, setResults]     = useState<ClienteOpt[]>([]);
  const [buscando, setBuscando]   = useState(false);
  const [elegido, setElegido]     = useState<ClienteOpt | null>(null);
  const [motivo, setMotivo]       = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounce.current);
    if (!open || elegido || query.trim().length < 2) { setResults([]); setBuscando(false); return; }
    setBuscando(true);
    debounce.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: '20' });
        const r = await apiFetch(`/api/clientes?${params}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        const lista: ClienteOpt[] = data.clientes ?? data ?? [];
        setResults(lista.filter(c => c.id !== clienteActualId));
      } catch {
        setResults([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [query, open, elegido, clienteActualId]);

  const cerrar = () => {
    if (guardando) return;
    setOpen(false); setQuery(''); setResults([]); setElegido(null); setMotivo(''); setError('');
  };

  const guardar = async () => {
    if (!elegido) { setError('Elegí el cliente correcto'); return; }
    if (!motivo.trim()) { setError('Escribí el motivo'); return; }
    setGuardando(true); setError('');
    try {
      const r = await apiFetch(`/api/ventas/${ventaId}/cliente`, {
        method: 'PATCH',
        body: JSON.stringify({ cliente_id: elegido.id, motivo: motivo.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'No se pudo cambiar el cliente');
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el cliente');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-kp-gray-lt hover:text-kp-red transition-colors min-h-touch md:min-h-0 px-1"
      >
        Cambiar cliente
      </button>

      <Modal
        open={open}
        onClose={cerrar}
        size="sm"
        title={`Cambiar cliente${numero ? ` · Venta #${numero}` : ''}`}
        subtitle={clienteActualNombre ? `Actual: ${clienteActualNombre}` : 'Actual: Público general'}
        footer={
          <>
            <button
              type="button" onClick={cerrar} disabled={guardando}
              className="px-4 py-2 min-h-touch md:min-h-touch-sm rounded-lg border border-kp-border text-sm text-kp-gray-lt hover:text-kp-white transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button" onClick={guardar} disabled={guardando || !elegido || !motivo.trim()}
              className="px-4 py-2 min-h-touch md:min-h-touch-sm rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : 'Cambiar cliente'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-kp-gray leading-snug">
            Si la venta fue a cuenta corriente, la deuda pasa al cliente nuevo.
            No se modifican la caja, el stock ni los precios.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="cc-cliente" className="text-2xs md:text-[10px] text-kp-gray uppercase tracking-widest">
              Cliente correcto
            </label>
            {elegido ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-kp-red/50 bg-kp-surface px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-kp-white truncate">{elegido.razon_social}</p>
                  {elegido.cuit && <p className="text-xs text-kp-gray font-mono">{elegido.cuit}</p>}
                </div>
                <button type="button" onClick={() => setElegido(null)} className="text-xs text-kp-gray hover:text-kp-red flex-shrink-0">
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <input
                  id="cc-cliente" type="search" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre o CUIT…"
                  className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white focus:outline-none focus:border-kp-red"
                />
                {buscando && <p className="text-xs text-kp-gray">Buscando…</p>}
                {!buscando && query.trim().length >= 2 && results.length === 0 && (
                  <p className="text-xs text-kp-gray">Sin resultados</p>
                )}
                {results.length > 0 && (
                  <ul className="max-h-56 overflow-y-auto rounded-lg border border-kp-border divide-y divide-kp-border">
                    {results.map(c => (
                      <li key={c.id}>
                        <button
                          type="button" onClick={() => { setElegido(c); setError(''); }}
                          className="w-full text-left px-3 py-2 min-h-touch md:min-h-0 hover:bg-kp-surface2 transition-colors"
                        >
                          <span className="block text-sm text-kp-white truncate">{c.razon_social}</span>
                          {c.cuit && <span className="block text-xs text-kp-gray font-mono">{c.cuit}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cc-motivo" className="text-2xs md:text-[10px] text-kp-gray uppercase tracking-widest">
              Motivo
            </label>
            <input
              id="cc-motivo" type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ej: se cargó al cliente equivocado"
              className="w-full bg-kp-surface border border-kp-border rounded-lg px-3 py-2 min-h-touch md:min-h-touch-sm text-base md:text-sm text-kp-white focus:outline-none focus:border-kp-red"
            />
          </div>

          {error && <p role="alert" className="text-xs text-kp-red">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
