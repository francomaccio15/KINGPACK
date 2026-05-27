'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────
type NotaItem = {
  id: string;
  contenido: string;
  tipo: 'general' | 'pendiente' | 'pedido' | 'aviso';
  autor: string;
  created_at: string;
};

type Alerta = {
  tipo: string;
  nivel: 'error' | 'warning' | 'info';
  count: number;
  href: string;
  label: string;
};

type NotifData = {
  no_leidas:    number;
  notas_nuevas: NotaItem[];
  alertas:      Alerta[];
  ultima_vista: string;
};

// ─── Config ───────────────────────────────────────────────────────────────────
const TIPO_NOTA = {
  general:   { dot: 'bg-slate-400', color: 'text-slate-400',   label: 'General'   },
  pendiente: { dot: 'bg-amber-400', color: 'text-amber-400',   label: 'Pendiente' },
  pedido:    { dot: 'bg-sky-400',   color: 'text-sky-400',     label: 'Pedido'    },
  aviso:     { dot: 'bg-rose-400',  color: 'text-rose-400',    label: 'Aviso'     },
} as const;

const NIVEL_ALERTA = {
  error:   { bg: 'bg-rose-500/10',   border: 'border-rose-500/25',   icon: 'text-rose-400',  dot: 'bg-rose-400'   },
  warning: { bg: 'bg-amber-500/10',  border: 'border-amber-500/25',  icon: 'text-amber-400', dot: 'bg-amber-400'  },
  info:    { bg: 'bg-violet-500/10', border: 'border-violet-500/25', icon: 'text-violet-400',dot: 'bg-violet-400' },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string> || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function tiempoRelativo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)     return 'ahora';
  if (s < 3600)   return `${Math.floor(s / 60)}min`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

// ─── Íconos ───────────────────────────────────────────────────────────────────
const IcoBell = ({ active }: { active?: boolean }) => (
  <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active ? 0 : 1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const IcoNote  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcoWarn  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoChev  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><path d="M9 18l6-6-6-6"/></svg>;

// ─── Componente principal ─────────────────────────────────────────────────────
export default function NotifBell() {
  const [count, setCount]   = useState(0);
  const [open, setOpen]     = useState(false);
  const [data, setData]     = useState<NotifData | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Fetch solo el conteo (liviano, para el badge) ─────────────────────────
  const fetchCount = useCallback(async () => {
    try {
      const r = await apiFetch('/api/notificaciones');
      if (r.ok) {
        const d: NotifData = await r.json();
        setCount(d.no_leidas);
        // Si el panel está abierto, actualizar data también
        if (open) setData(d);
      }
    } catch { /* silencioso */ }
  }, [open]);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  // ── Abrir panel: fetch completo + marcar leído ────────────────────────────
  const handleOpen = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const r = await apiFetch('/api/notificaciones');
      if (r.ok) {
        const d: NotifData = await r.json();
        setData(d);
        // Si hay notas nuevas, marcarlas como leídas
        if (d.no_leidas > 0) {
          await apiFetch('/api/notificaciones/leer', { method: 'POST' });
          setCount(0);
        }
      }
    } finally { setLoading(false); }
  };

  // ── Cerrar al click fuera ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const totalAlertas = data?.alertas.length ?? 0;
  const tieneContenido = (data?.notas_nuevas.length ?? 0) > 0 || totalAlertas > 0;

  return (
    <div className="relative" ref={wrapRef}>
      {/* ── Botón campana ── */}
      <button
        onClick={handleOpen}
        className={[
          'relative flex items-center justify-center w-9 h-9 rounded-lg border transition-colors',
          open
            ? 'bg-kp-surface2 border-kp-red text-kp-red'
            : 'bg-kp-surface border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-border/60',
        ].join(' ')}
        title="Notificaciones"
      >
        <IcoBell active={open} />
        {/* Badge rojo */}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-kp-red text-white text-[9px] font-bold leading-none ring-2 ring-kp-bg">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* ── Panel de notificaciones ── */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[360px] rounded-xl border border-kp-border bg-kp-surface shadow-2xl shadow-black/60 overflow-hidden">

          {/* Header del panel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-kp-border bg-kp-surface2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-kp-white">Notificaciones</span>
              {count > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-kp-red text-white">
                  {count} nueva{count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <Link
              href="/notas"
              onClick={() => setOpen(false)}
              className="text-[10px] font-semibold text-kp-red hover:underline flex items-center gap-0.5"
            >
              Ver notas <IcoChev />
            </Link>
          </div>

          {/* Cuerpo scrollable */}
          <div className="max-h-[440px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-kp-red border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !tieneContenido ? (
              <div className="py-10 text-center">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-sm text-kp-gray">Todo al día, sin pendientes.</p>
              </div>
            ) : (
              <>
                {/* ── Notas nuevas ── */}
                {(data?.notas_nuevas.length ?? 0) > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-kp-gray flex items-center gap-1.5">
                      <IcoNote />
                      Notas nuevas
                    </p>
                    <div className="divide-y divide-kp-border/50">
                      {data!.notas_nuevas.map(n => {
                        const cfg = TIPO_NOTA[n.tipo] ?? TIPO_NOTA.general;
                        return (
                          <Link
                            key={n.id}
                            href="/notas"
                            onClick={() => setOpen(false)}
                            className="flex items-start gap-3 px-4 py-3 hover:bg-kp-surface2 transition-colors group"
                          >
                            {/* Dot tipo */}
                            <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-kp-white leading-snug line-clamp-2">
                                {n.contenido}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                                <span className="text-kp-gray/50">·</span>
                                <span className="text-[10px] text-kp-gray">{n.autor}</span>
                                <span className="text-kp-gray/50">·</span>
                                <span className="text-[10px] text-kp-gray">{tiempoRelativo(n.created_at)}</span>
                              </div>
                            </div>
                            <span className="text-kp-gray opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                              <IcoChev />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Alertas del sistema ── */}
                {totalAlertas > 0 && (
                  <div className={data && data.notas_nuevas.length > 0 ? 'border-t border-kp-border' : ''}>
                    <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-kp-gray flex items-center gap-1.5">
                      <IcoWarn />
                      Alertas del sistema
                    </p>
                    <div className="px-4 pb-3 space-y-2">
                      {data!.alertas.map(a => {
                        const cfg = NIVEL_ALERTA[a.nivel];
                        return (
                          <Link
                            key={a.tipo}
                            href={a.href}
                            onClick={() => setOpen(false)}
                            className={[
                              'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all',
                              cfg.bg, cfg.border,
                              'hover:brightness-110',
                            ].join(' ')}
                          >
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                            <span className={`text-xs font-semibold flex-1 ${cfg.icon}`}>{a.label}</span>
                            <span className={cfg.icon}><IcoChev /></span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-kp-border px-4 py-2.5 bg-kp-surface2">
            <p className="text-[10px] text-kp-gray text-center">
              {data?.ultima_vista && data.ultima_vista !== new Date(0).toISOString()
                ? `Última revisión: ${tiempoRelativo(data.ultima_vista)}`
                : 'Primera vez que revisás'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
