'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

type Tipo = 'recibido' | 'emitido';

interface Opcion { id: string; nombre: string }

const ESTADOS_RECIBIDO = [
  { value: 'en_cartera', label: 'En Cartera' },
  { value: 'depositado', label: 'Depositado' },
  { value: 'acreditado', label: 'Acreditado' },
  { value: 'endosado',   label: 'Endosado' },
  { value: 'rechazado',  label: 'Rechazado' },
];
const ESTADOS_EMITIDO = [
  { value: 'emitido',    label: 'Emitido' },
  { value: 'presentado', label: 'Presentado' },
  { value: 'debitado',   label: 'Debitado' },
  { value: 'rechazado',  label: 'Rechazado' },
];

export default function AgregarCheque() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Catálogos
  const [sucursales,  setSucursales]  = useState<Opcion[]>([]);
  const [clientes,    setClientes]    = useState<Opcion[]>([]);
  const [proveedores, setProveedores] = useState<Opcion[]>([]);

  // Formulario
  const [tipo, setTipo] = useState<Tipo>('recibido');
  const [banco, setBanco] = useState('');
  const [numero, setNumero] = useState('');
  const [importe, setImporte] = useState('');
  const [fechaEmision, setFechaEmision] = useState('');
  const [fechaVenc, setFechaVenc] = useState('');
  const [estado, setEstado] = useState('en_cartera');
  const [sucursalId, setSucursalId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Cargar catálogos al abrir por primera vez
  useEffect(() => {
    if (!open || sucursales.length > 0) return;
    Promise.all([
      apiFetch('/api/sucursales').then(r => r.json()).catch(() => ({ sucursales: [] })),
      apiFetch('/api/clientes?limit=500').then(r => r.json()).catch(() => ({ clientes: [] })),
      apiFetch('/api/proveedores?limit=500').then(r => r.json()).catch(() => ({ proveedores: [] })),
    ]).then(([suc, cli, prov]) => {
      const sArr = (suc.sucursales ?? []).map((s: any) => ({ id: s.id, nombre: s.nombre }));
      setSucursales(sArr);
      if (sArr.length > 0) setSucursalId(sArr[0].id);
      setClientes((cli.clientes ?? []).map((c: any) => ({ id: c.id, nombre: c.razon_social })));
      setProveedores((prov.proveedores ?? []).map((p: any) => ({ id: p.id, nombre: p.razon_social })));
    });
  }, [open, sucursales.length]);

  // Reajustar estado por defecto al cambiar el tipo
  useEffect(() => {
    setEstado(tipo === 'recibido' ? 'en_cartera' : 'emitido');
  }, [tipo]);

  const estados = tipo === 'recibido' ? ESTADOS_RECIBIDO : ESTADOS_EMITIDO;

  const reset = () => {
    setTipo('recibido');
    setBanco(''); setNumero(''); setImporte('');
    setFechaEmision(''); setFechaVenc('');
    setEstado('en_cartera'); setClienteId(''); setProveedorId('');
    setObservaciones(''); setError('');
    if (sucursales.length > 0) setSucursalId(sucursales[0].id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!banco.trim())  return setError('Ingresá el banco');
    if (!numero.trim()) return setError('Ingresá el número de cheque');
    if (!fechaVenc)     return setError('Ingresá la fecha de vencimiento');
    if (!importe || parseFloat(importe) <= 0) return setError('Ingresá un importe mayor a 0');
    if (!sucursalId)    return setError('Seleccioná una sucursal');

    setLoading(true);
    try {
      const res = await apiFetch('/api/cheques', {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          banco: banco.trim(),
          numero_cheque: numero.trim(),
          fecha_emision: fechaEmision || null,
          fecha_vencimiento: fechaVenc,
          importe: parseFloat(importe),
          estado,
          sucursal_id: sucursalId,
          cliente_id: tipo === 'recibido' ? (clienteId || null) : null,
          proveedor_id: tipo === 'emitido' ? (proveedorId || null) : null,
          observaciones: observaciones.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Error al guardar el cheque');
        return;
      }
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'h-9 px-3 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red';
  const labelCls = 'text-xs text-kp-gray font-medium';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Agregar cheque
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-kp-surface border border-kp-border rounded-xl shadow-xl p-6 space-y-4 my-8">
            <h3 className="text-base font-bold text-kp-white">Agregar cheque</h3>

            {/* Tipo */}
            <div className="flex gap-2">
              {(['recibido', 'emitido'] as Tipo[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={[
                    'flex-1 px-3 py-2 text-sm font-semibold rounded-md border transition-colors',
                    tipo === t
                      ? 'border-kp-red bg-kp-red/10 text-kp-white'
                      : 'border-kp-border text-kp-gray hover:text-kp-white',
                  ].join(' ')}
                >
                  {t === 'recibido' ? 'Recibido' : 'Emitido'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Banco *</label>
                  <input value={banco} onChange={e => setBanco(e.target.value)} placeholder="Banco" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>N° de cheque *</label>
                  <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="00000000" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Importe *</label>
                  <input type="number" min="0" step="0.01" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Estado</label>
                  <select value={estado} onChange={e => setEstado(e.target.value)} className={inputCls}>
                    {estados.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Fecha de emisión</label>
                  <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Fecha de vencimiento *</label>
                  <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} className={inputCls} />
                </div>
              </div>

              {tipo === 'recibido' ? (
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Cliente (opcional)</label>
                  <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={inputCls}>
                    <option value="">— Sin cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Proveedor (opcional)</label>
                  <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} className={inputCls}>
                    <option value="">— Sin proveedor —</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className={labelCls}>Sucursal *</label>
                <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className={inputCls}>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className={labelCls}>Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  rows={2}
                  placeholder="Referencia, titular del cheque, etc."
                  className="px-3 py-2 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors disabled:opacity-50"
                >
                  {loading ? 'Guardando…' : 'Guardar cheque'}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); reset(); }}
                  className="px-4 h-9 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
