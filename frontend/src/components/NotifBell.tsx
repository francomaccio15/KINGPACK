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
  general:   { dot: 'bg-slate-400', color: 'text-slate-400', label: 'General'   },
  pendiente: { dot: 'bg-amber-400', color: 'text-amber-400', label: 'Pendiente' },
  pedido:    { dot: 'bg-sky-400',   color: 'text-sky-400',   label: 'Pedido'    },
  aviso:     { dot: 'bg-rose-400',  color: 'text-rose-400',  label: 'Aviso'     },
} as const;

const NIVEL_ALERTA = {
  error:   { dot: 'bg-rose-400',   color: 'text-rose-400',   order: 0 },
  warning: { dot: 'bg-amber-400',  color: 'text-amber-400',  order: 1 },
  info:    { dot: 'bg-violet-400', color: 'text-violet-400', order: 3 },
} as const;

// Item unificado para renderizar en la lista
type UnifiedItem = {
  key:        string;
  dot:        string;
  labelColor: string;
  tagLabel:   string;
  title:      string;
  meta?:      string;
  href:       string;
  isNew?:     boolean;
  sortOrder:  number; // 0=error 1=warning 2=notas 3=info
};

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

const IcoChev = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3"><path d="M9 18l6-6-6-6"/></svg>;

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

  // ── Construir lista unificada ─────────────────────────────────────────────
  const items: UnifiedItem[] = [];

  if (data) {
    // Alertas
    for (const a of data.alertas) {
      const cfg = NIVEL_ALERTA[a.nivel];
      items.push({
        key:        `alerta-${a.tipo}-${items.length}`,
        dot:        cfg.dot,
        labelColor: cfg.color,
        tagLabel:   a.nivel === 'error' ? 'Urgente' : a.nivel === 'warning' ? 'Atención' : 'Info',
        title:      a.label,
        href:       a.href,
        sortOrder:  cfg.order,
      });
    }
    // Notas nuevas
    for (const n of data.notas_nuevas) {
      const cfg = TIPO_NOTA[n.tipo] ?? TIPO_NOTA.general;
      items.push({
        key:        `nota-${n.id}`,
        dot:        cfg.dot,
        labelColor: cfg.color,
        tagLabel:   cfg.label,
        title:      n.contenido,
        meta:       `${n.autor} · ${tiempoRelativo(n.created_at)}`,
        href:       '/notas',
        isNew:      true,
        sortOrder:  2,
      });
    }
    // Ordenar: errores → warnings → notas → info
    items.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const total = items.length;

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
        {/* Badge */}
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-kp-red text-white text-[9px] font-bold leading-none ring-2 ring-kp-bg">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[360px] rounded-xl border border-kp-border bg-kp-surface shadow-2xl shadow-black/60 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-kp-border bg-kp-surface2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-kp-white">Notificaciones</span>
              {total > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-kp-surface border border-kp-border text-kp-gray">
                  {total}
                </span>
              )}
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

          {/* Lista unificada */}
          <div className="max-h-[460px] overflow-y-auto divide-y divide-kp-border/50">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-5 h-5 border-2 border-kp-red border-t-transparent rounded-full animate-spin" />
              </div>
            ) : total === 0 ? (
              <div className="py-10 text-center">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-sm text-kp-gray">Todo al día, sin pendientes.</p>
              </div>
            ) : (
              items.map(item => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-kp-surface2 transition-colors group"
                >
                  {/* Dot */}
                  <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${item.dot}`} />

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-kp-white leading-snug line-clamp-2">{item.title}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className={`text-[10px] font-bold ${item.labelColor}`}>{item.tagLabel}</span>
                      {item.isNew && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-kp-red/15 text-kp-red border border-kp-red/20">
                          Nueva
                        </span>
                      )}
                      {item.meta && (
                        <>
                          <span className="text-kp-gray/40">·</span>
                          <span className="text-[10px] text-kp-gray">{item.meta}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Flecha hover */}
                  <span className={`mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${item.labelColor}`}>
                    <IcoChev />
                  </span>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-kp-border px-4 py-2 bg-kp-surface2">
            <p className="text-[10px] text-kp-gray text-center">
              {data?.ultima_vista && new Date(data.ultima_vista).getTime() > 1000
                ? `Última revisión: ${tiempoRelativo(data.ultima_vista)}`
                : 'Primera apertura'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
