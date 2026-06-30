'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Rol = 'administrador' | 'supervisor' | 'cajero' | 'vendedor';

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  sucursal_default_id: string | null;
  sucursal_nombre: string | null;
  created_at: string;
}

interface Sucursal { id: string; nombre: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const apiFetch = (p: string, o: RequestInit = {}) => {
  const t = typeof window !== 'undefined' ? localStorage.getItem('kp_token') : null;
  return fetch(`${API}${p}`, {
    ...o,
    headers: {
      'Content-Type': 'application/json',
      ...(o.headers as Record<string, string> || {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
};

const ROL_LABELS: Record<Rol, string> = {
  administrador: 'Administrador',
  supervisor:    'Supervisor',
  cajero:        'Cajero',
  vendedor:      'Preventista',
};

const ROL_COLORS: Record<Rol, string> = {
  administrador: 'bg-kp-red/20 text-kp-red border-kp-red/30',
  supervisor:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  cajero:        'bg-amber-500/20 text-amber-400 border-amber-500/30',
  vendedor:      'bg-green-500/20 text-green-400 border-green-500/30',
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-kp-surface border border-kp-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
          <h3 className="text-sm font-bold uppercase tracking-widest text-kp-white">{title}</h3>
          <button onClick={onClose} className="text-kp-gray hover:text-kp-white transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Formulario de usuario (crear / editar) ───────────────────────────────────
function FormUsuario({
  inicial, sucursales, onGuardar, onCerrar,
}: {
  inicial?: Usuario;
  sucursales: Sucursal[];
  onGuardar: () => void;
  onCerrar: () => void;
}) {
  const esEdicion = !!inicial;

  const [nombre,             setNombre]            = useState(inicial?.nombre            ?? '');
  const [email,              setEmail]             = useState(inicial?.email             ?? '');
  const [telefono,           setTelefono]          = useState(inicial?.telefono          ?? '');
  const [rol,                setRol]               = useState<Rol>(inicial?.rol          ?? 'cajero');
  const [sucursalDefaultId,  setSucursalDefaultId] = useState(inicial?.sucursal_default_id ?? '');
  const [password,           setPassword]          = useState('');
  const [saving,             setSaving]            = useState(false);
  const [error,              setError]             = useState<string | null>(null);

  const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  const handleSubmit = async () => {
    setError(null);
    if (!nombre.trim()) return setError('El nombre es requerido');
    if (!esEdicion && !email.trim()) return setError('El email es requerido');
    if (!esEdicion && !password.trim()) return setError('La contraseña es requerida');
    if (!esEdicion && password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');

    setSaving(true);
    try {
      const body = esEdicion
        ? { nombre: nombre.trim(), telefono: telefono.trim() || null, rol, sucursal_default_id: sucursalDefaultId || null }
        : { email: email.trim(), password, nombre: nombre.trim(), telefono: telefono.trim() || null, rol, sucursal_default_id: sucursalDefaultId || null };

      const res = await apiFetch(
        esEdicion ? `/api/usuarios/${inicial!.id}` : '/api/usuarios',
        { method: esEdicion ? 'PATCH' : 'POST', body: JSON.stringify(body) }
      );
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'Error al guardar');
      onGuardar();
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Nombre *</label>
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Nombre completo" className={inputCls} />
      </div>

      {!esEdicion && (
        <div>
          <label className={labelCls}>Email *</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="email@ejemplo.com" className={inputCls} />
        </div>
      )}

      {esEdicion && (
        <div>
          <label className={labelCls}>Email</label>
          <input type="text" value={inicial!.email} disabled
            className={`${inputCls} opacity-50 cursor-not-allowed`} />
        </div>
      )}

      {!esEdicion && (
        <div>
          <label className={labelCls}>Contraseña *</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres" className={inputCls} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Rol *</label>
          <select value={rol} onChange={e => setRol(e.target.value as Rol)} className={inputCls}>
            <option value="administrador">Administrador</option>
            <option value="supervisor">Supervisor</option>
            <option value="cajero">Cajero</option>
            <option value="vendedor">Preventista</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Sucursal default</label>
          <select value={sucursalDefaultId} onChange={e => setSucursalDefaultId(e.target.value)} className={inputCls}>
            <option value="">— Sin asignar —</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Teléfono</label>
        <input type="text" value={telefono} onChange={e => setTelefono(e.target.value)}
          placeholder="Opcional" className={inputCls} />
      </div>

      {error && (
        <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onCerrar}
          className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white hover:border-kp-gray transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 transition-colors disabled:opacity-50">
          {saving ? <><Spinner /> Guardando…</> : esEdicion ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </div>
  );
}

// ─── Modal cambiar contraseña ─────────────────────────────────────────────────
function ModalPassword({ usuario, onGuardar, onCerrar }: { usuario: Usuario; onGuardar: () => void; onCerrar: () => void }) {
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [ok,        setOk]        = useState(false);

  const inputCls = 'w-full bg-kp-surface2 border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors';
  const labelCls = 'block text-xs font-semibold uppercase tracking-widest text-kp-gray mb-1';

  const handleSubmit = async () => {
    setError(null);
    if (!password.trim()) return setError('Ingresá la nueva contraseña');
    if (password.length < 6) return setError('Mínimo 6 caracteres');
    if (password !== password2) return setError('Las contraseñas no coinciden');

    setSaving(true);
    try {
      const res  = await apiFetch(`/api/usuarios/${usuario.id}/password`, {
        method: 'PATCH', body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'Error al cambiar contraseña');
      setOk(true);
      setTimeout(onGuardar, 1000);
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-kp-gray">Cambiar contraseña de <span className="text-kp-white font-semibold">{usuario.nombre}</span></p>
      <div>
        <label className={labelCls}>Nueva contraseña *</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres" className={inputCls} autoFocus />
      </div>
      <div>
        <label className={labelCls}>Repetir contraseña *</label>
        <input type="password" value={password2} onChange={e => setPassword2(e.target.value)}
          placeholder="Repetir contraseña" className={inputCls} />
      </div>
      {error && <p className="text-sm text-kp-red bg-kp-red/10 border border-kp-red/30 rounded-lg px-4 py-2">{error}</p>}
      {ok    && <p className="text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">✓ Contraseña actualizada</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onCerrar}
          className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white transition-colors">
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving || ok}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 disabled:opacity-50">
          {saving ? <><Spinner /> Guardando…</> : 'Cambiar'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function UsuariosClient() {
  const [usuarios,   setUsuarios]   = useState<Usuario[]>([]);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [q,          setQ]          = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'' | 'true' | 'false'>('');

  // Modales
  const [modalCrear,    setModalCrear]    = useState(false);
  const [modalEditar,   setModalEditar]   = useState<Usuario | null>(null);
  const [modalPassword, setModalPassword] = useState<Usuario | null>(null);
  const [modalEliminar, setModalEliminar] = useState<Usuario | null>(null);
  const [eliminando,    setEliminando]    = useState(false);
  const [togglingId,    setTogglingId]    = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim())       params.set('q', q.trim());
      if (filtroActivo)   params.set('activo', filtroActivo);

      const [uRes, sRes] = await Promise.all([
        apiFetch(`/api/usuarios?${params}`),
        apiFetch('/api/sucursales'),
      ]);
      const [uData, sData] = await Promise.all([uRes.json(), sRes.json()]);
      setUsuarios(uData.usuarios ?? []);
      setSucursales(sData.sucursales ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, filtroActivo]);

  useEffect(() => { cargar(); }, [cargar]);

  const toggleActivo = async (u: Usuario) => {
    setTogglingId(u.id);
    try {
      await apiFetch(`/api/usuarios/${u.id}`, {
        method: 'PATCH', body: JSON.stringify({ activo: !u.activo }),
      });
      await cargar();
    } finally {
      setTogglingId(null);
    }
  };

  const eliminar = async () => {
    if (!modalEliminar) return;
    setEliminando(true);
    try {
      await apiFetch(`/api/usuarios/${modalEliminar.id}`, { method: 'DELETE' });
      setModalEliminar(null);
      await cargar();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <section className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-6 bg-kp-red rounded-full block" />
          <h2 className="text-2xl font-bold uppercase tracking-wide">Usuarios</h2>
          <span className="ml-2 text-xs font-semibold text-kp-gray bg-kp-surface2 border border-kp-border rounded-full px-2 py-0.5">
            {usuarios.length}
          </span>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold shadow-lg shadow-kp-red/20 hover:bg-kp-red/90 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kp-gray pointer-events-none">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por nombre o email…"
            value={q}
            onChange={e => setQ(e.target.value)}
            className="w-full bg-kp-surface border border-kp-border rounded-lg pl-9 pr-3 py-2 text-sm text-kp-white placeholder-kp-gray focus:outline-none focus:border-kp-red transition-colors"
          />
        </div>
        <select
          value={filtroActivo}
          onChange={e => setFiltroActivo(e.target.value as '' | 'true' | 'false')}
          className="bg-kp-surface border border-kp-border rounded-lg px-3 py-2 text-sm text-kp-white focus:outline-none focus:border-kp-red transition-colors"
        >
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-20 text-kp-gray"><Spinner /></div>
      ) : usuarios.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface p-12 text-center text-kp-gray text-sm">
          No hay usuarios{q ? ` que coincidan con "${q}"` : ''}.
        </div>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-kp-surface2 border-b border-kp-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Sucursal</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-kp-gray uppercase tracking-widest">Activo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {usuarios.map(u => (
                <tr key={u.id} className={`bg-kp-surface hover:bg-kp-surface2 transition-colors ${!u.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-kp-white">{u.nombre}</span>
                    {u.telefono && <span className="ml-2 text-xs text-kp-gray">{u.telefono}</span>}
                  </td>
                  <td className="px-4 py-3 text-kp-gray font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ROL_COLORS[u.rol]}`}>
                      {ROL_LABELS[u.rol]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-kp-gray text-xs">{u.sucursal_nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActivo(u)}
                      disabled={togglingId === u.id}
                      title={u.activo ? 'Desactivar' : 'Activar'}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${u.activo ? 'bg-green-500' : 'bg-kp-border'}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${u.activo ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Editar */}
                      <button onClick={() => setModalEditar(u)} title="Editar"
                        className="p-1.5 rounded-lg text-kp-gray hover:text-kp-white hover:bg-kp-surface2 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {/* Contraseña */}
                      <button onClick={() => setModalPassword(u)} title="Cambiar contraseña"
                        className="p-1.5 rounded-lg text-kp-gray hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </button>
                      {/* Eliminar */}
                      <button onClick={() => setModalEliminar(u)} title="Eliminar"
                        className="p-1.5 rounded-lg text-kp-gray hover:text-kp-red hover:bg-kp-red/10 transition-colors">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear */}
      {modalCrear && (
        <Modal title="Nuevo usuario" onClose={() => setModalCrear(false)}>
          <FormUsuario
            sucursales={sucursales}
            onGuardar={() => { setModalCrear(false); cargar(); }}
            onCerrar={() => setModalCrear(false)}
          />
        </Modal>
      )}

      {/* Modal Editar */}
      {modalEditar && (
        <Modal title="Editar usuario" onClose={() => setModalEditar(null)}>
          <FormUsuario
            inicial={modalEditar}
            sucursales={sucursales}
            onGuardar={() => { setModalEditar(null); cargar(); }}
            onCerrar={() => setModalEditar(null)}
          />
        </Modal>
      )}

      {/* Modal Contraseña */}
      {modalPassword && (
        <Modal title="Cambiar contraseña" onClose={() => setModalPassword(null)}>
          <ModalPassword
            usuario={modalPassword}
            onGuardar={() => { setModalPassword(null); cargar(); }}
            onCerrar={() => setModalPassword(null)}
          />
        </Modal>
      )}

      {/* Modal Confirmar Eliminar */}
      {modalEliminar && (
        <Modal title="Eliminar usuario" onClose={() => setModalEliminar(null)}>
          <div className="space-y-4">
            <p className="text-sm text-kp-gray">
              ¿Eliminar a <span className="text-kp-white font-semibold">{modalEliminar.nombre}</span>?
              Esta acción desactiva su acceso al sistema.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModalEliminar(null)}
                className="flex-1 py-2 rounded-lg border border-kp-border text-sm text-kp-gray hover:text-kp-white transition-colors">
                Cancelar
              </button>
              <button onClick={eliminar} disabled={eliminando}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-kp-red text-white text-sm font-semibold hover:bg-kp-red/90 disabled:opacity-50">
                {eliminando ? <><Spinner /> Eliminando…</> : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </section>
  );
}
