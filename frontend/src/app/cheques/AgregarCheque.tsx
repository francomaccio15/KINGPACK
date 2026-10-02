'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import Modal from '@/components/ui/Modal';
import { sucursalPorDefecto, useSucursalActiva } from '@/lib/sucursalActivaCliente';
import {
  type Forma, type Modalidad, FORMA_LABEL, MODALIDAD_LABEL,
  cuitValido, cbuValido, numeroValido, errorVigencia, formatearCuit,
  formatoMonto, formatoFecha, soloDigitos,
} from '@/lib/cheques';

type Tipo = 'recibido' | 'emitido';

interface Opcion { id: string; nombre: string; cuit?: string | null }

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
  // 'form' → carga; 'confirmar' → tabla resumen antes de impactar.
  const [paso, setPaso] = useState<'form' | 'confirmar'>('form');

  // Catálogos
  const [sucursales,  setSucursales]  = useState<Opcion[]>([]);
  const [clientes,    setClientes]    = useState<Opcion[]>([]);
  const [proveedores, setProveedores] = useState<Opcion[]>([]);

  // Formulario
  const [tipo, setTipo] = useState<Tipo>('recibido');
  const [forma, setForma] = useState<Forma>('fisico');
  const [modalidad, setModalidad] = useState<Modalidad>('diferido');
  const [banco, setBanco] = useState('');
  const [bancoSucursal, setBancoSucursal] = useState('');
  const [cbu, setCbu] = useState('');
  const [numero, setNumero] = useState('');
  const [importe, setImporte] = useState('');
  const [fechaEmision, setFechaEmision] = useState('');
  const [fechaVenc, setFechaVenc] = useState('');
  const [libradorCuit, setLibradorCuit] = useState('');
  const [libradorNombre, setLibradorNombre] = useState('');
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
      apiFetch('/api/clientes?limit=5000').then(r => r.json()).catch(() => ({ clientes: [] })),
      apiFetch('/api/proveedores?limit=500').then(r => r.json()).catch(() => ({ proveedores: [] })),
    ]).then(([suc, cli, prov]) => {
      const sArr = (suc.sucursales ?? []).map((s: any) => ({ id: s.id, nombre: s.nombre }));
      setSucursales(sArr);
      if (sArr.length > 0) {
        setSucursalId(sucursalPorDefecto(sArr));
      }
      setClientes((cli.clientes ?? []).map((c: any) => ({ id: c.id, nombre: c.razon_social, cuit: c.cuit })));
      setProveedores((prov.proveedores ?? []).map((p: any) => ({ id: p.id, nombre: p.razon_social })));
    });
  }, [open, sucursales.length]);

  // Al abrir, re-leer la sucursal activa del header (cambia con router.refresh
  // sin remontar este componente).
  useEffect(() => {
    if (open && sucursales.length > 0) setSucursalId(sucursalPorDefecto(sucursales));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reflejar en vivo el cambio del selector del header, incluso con el modal abierto.
  const sucursalActiva = useSucursalActiva();
  useEffect(() => {
    if (sucursalActiva && sucursales.some(s => s.id === sucursalActiva)) {
      setSucursalId(sucursalActiva);
    }
  }, [sucursalActiva]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reajustar estado por defecto al cambiar el tipo
  useEffect(() => {
    setEstado(tipo === 'recibido' ? 'en_cartera' : 'emitido');
  }, [tipo]);

  // Elegir el cliente propone al librador: casi siempre el que entrega el cheque
  // es quien lo firma. Solo completa lo vacío — si es un cheque de tercero, se pisa.
  const elegirCliente = (id: string) => {
    setClienteId(id);
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    if (!libradorNombre.trim()) setLibradorNombre(c.nombre);
    if (!libradorCuit.trim() && c.cuit) setLibradorCuit(c.cuit);
  };

  const estados = tipo === 'recibido' ? ESTADOS_RECIBIDO : ESTADOS_EMITIDO;

  // Avisos en vivo, campo por campo (no bloquean el tipeo).
  const avisoNumero = numero && !numeroValido(numero, forma)
    ? (forma === 'echeq' ? 'ID ECHEQ: 6 a 30 caracteres alfanuméricos' : 'Solo dígitos (4 a 12)') : '';
  const avisoCuit = libradorCuit && !cuitValido(libradorCuit) ? 'No cierra el dígito verificador' : '';
  const avisoCbu = cbu && !cbuValido(cbu) ? 'CBU inválido (22 dígitos, verificadores)' : '';
  const avisoVigencia = errorVigencia(fechaEmision, fechaVenc, modalidad) ?? '';

  const reset = () => {
    setPaso('form');
    setTipo('recibido');
    setForma('fisico'); setModalidad('diferido');
    setBanco(''); setBancoSucursal(''); setCbu('');
    setNumero(''); setImporte('');
    setFechaEmision(''); setFechaVenc('');
    setLibradorCuit(''); setLibradorNombre('');
    setEstado('en_cartera'); setClienteId(''); setProveedorId('');
    setObservaciones(''); setError('');
    if (sucursales.length > 0) {
      setSucursalId(sucursalPorDefecto(sucursales));
    }
  };

  // Paso 1 → 2: valida todo y muestra el resumen. No toca el servidor.
  const revisar = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!banco.trim())  return setError('Ingresá el banco');
    if (!numero.trim()) return setError(forma === 'echeq' ? 'Ingresá el ID del ECHEQ' : 'Ingresá el número de cheque');
    if (avisoNumero)    return setError(`Número: ${avisoNumero}`);
    if (!bancoSucursal.trim() && !cbu.trim()) return setError('Ingresá la sucursal bancaria o el CBU');
    if (avisoCbu)       return setError(avisoCbu);
    if (!fechaEmision)  return setError('Ingresá la fecha de emisión');
    if (!fechaVenc)     return setError('Ingresá la fecha de vencimiento');
    if (avisoVigencia)  return setError(avisoVigencia);
    if (!importe || parseFloat(importe) <= 0) return setError('Ingresá un importe mayor a 0');
    if (!/^\d+(\.\d{1,2})?$/.test(importe.trim())) return setError('El importe admite como máximo 2 decimales');
    if (tipo === 'recibido') {
      if (!libradorCuit.trim()) return setError('Ingresá el CUIT/CUIL del librador');
      if (avisoCuit)            return setError(`CUIT/CUIL: ${avisoCuit}`);
      if (!libradorNombre.trim()) return setError('Ingresá el nombre del librador');
    }
    if (!sucursalId)    return setError('Seleccioná una sucursal');
    setPaso('confirmar');
  };

  // Paso 2: impacta.
  const confirmar = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/cheques', {
        method: 'POST',
        body: JSON.stringify({
          tipo,
          forma,
          modalidad,
          banco: banco.trim(),
          banco_sucursal: bancoSucursal.trim() || null,
          banco_cbu: soloDigitos(cbu) || null,
          numero_cheque: numero.trim(),
          fecha_emision: fechaEmision,
          fecha_vencimiento: fechaVenc,
          importe: importe.trim(),
          estado,
          sucursal_id: sucursalId,
          librador_cuit: tipo === 'recibido' ? libradorCuit.trim() : null,
          librador_nombre: tipo === 'recibido' ? libradorNombre.trim() : null,
          cliente_id: tipo === 'recibido' ? (clienteId || null) : null,
          proveedor_id: tipo === 'emitido' ? (proveedorId || null) : null,
          observaciones: observaciones.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Error al guardar el cheque');
        setPaso('form');
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
  const avisoCls = 'text-[11px] text-amber-400';

  const Toggle = <T extends string>({ valor, opciones, onChange }: {
    valor: T; opciones: { v: T; l: string }[]; onChange: (v: T) => void;
  }) => (
    <div className="flex gap-1.5">
      {opciones.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={[
            'flex-1 px-2 py-1.5 text-xs font-semibold rounded-md border transition-colors',
            valor === o.v
              ? 'border-kp-red bg-kp-red/10 text-kp-white'
              : 'border-kp-border text-kp-gray hover:text-kp-white',
          ].join(' ')}
        >
          {o.l}
        </button>
      ))}
    </div>
  );

  const nombreSucursal = sucursales.find(s => s.id === sucursalId)?.nombre ?? '—';
  const nombreProveedor = proveedores.find(p => p.id === proveedorId)?.nombre;
  const nombreCliente = clientes.find(c => c.id === clienteId)?.nombre;
  const labelEstado = estados.find(s => s.value === estado)?.label ?? estado;

  const filasResumen: [string, React.ReactNode][] = [
    ['Tipo', <><b>{tipo === 'recibido' ? 'Recibido' : 'Emitido'}</b> · {FORMA_LABEL[forma]} · {MODALIDAD_LABEL[modalidad]}</>],
    [forma === 'echeq' ? 'ID ECHEQ' : 'N° de cheque', <span className="font-mono">{numero.trim()}</span>],
    ['Banco', <>{banco.trim()}{bancoSucursal.trim() ? ` — Suc. ${bancoSucursal.trim()}` : ''}</>],
    ...(cbu.trim() ? [['CBU', <span className="font-mono">{soloDigitos(cbu)}</span>] as [string, React.ReactNode]] : []),
    ...(tipo === 'recibido'
      ? [['Librador', <>{libradorNombre.trim()} <span className="font-mono text-kp-gray">({formatearCuit(libradorCuit)})</span></>] as [string, React.ReactNode]]
      : []),
    ['Emisión', formatoFecha(fechaEmision)],
    ['Vencimiento', formatoFecha(fechaVenc)],
    ['Importe', <b className="font-mono">{formatoMonto(parseFloat(importe || '0'))}</b>],
    ['Origen', tipo === 'recibido' ? (nombreCliente ?? 'Sin cliente') : (nombreProveedor ?? 'Sin proveedor')],
    ['Estado inicial', <b>{labelEstado}</b>],
    ['Sucursal', nombreSucursal],
    ...(observaciones.trim() ? [['Observaciones', observaciones.trim()] as [string, React.ReactNode]] : []),
  ];

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

      <Modal
          open={open}
          onClose={() => { setOpen(false); reset(); }}
          title={paso === 'form' ? 'Agregar cheque' : 'Confirmar cheque'}
          size="md"
        >

        {paso === 'confirmar' ? (
          <div className="space-y-3">
            <table className="w-full text-sm">
              <tbody>
                {filasResumen.map(([k, v]) => (
                  <tr key={k} className="border-b border-kp-border/60 last:border-0">
                    <td className="py-1.5 pr-3 text-xs text-kp-gray whitespace-nowrap align-top">{k}</td>
                    <td className="py-1.5 text-kp-white">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {estado === 'acreditado' && tipo === 'recibido' && (
              <p className="text-xs text-amber-400">
                Al confirmar se acredita el importe en la cuenta de cheques.
              </p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={confirmar}
                disabled={loading}
                className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando…' : 'Confirmar y guardar'}
              </button>
              <button
                type="button"
                onClick={() => setPaso('form')}
                disabled={loading}
                className="px-4 h-9 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
              >
                Corregir
              </button>
            </div>
          </div>
        ) : (
          <>
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

          <form onSubmit={revisar} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Forma *</label>
                <Toggle valor={forma} onChange={setForma}
                  opciones={[{ v: 'fisico', l: 'Físico' }, { v: 'echeq', l: 'ECHEQ' }]} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Modalidad *</label>
                <Toggle valor={modalidad} onChange={setModalidad}
                  opciones={[{ v: 'al_dia', l: 'Al día' }, { v: 'diferido', l: 'Diferido' }]} />
              </div>

              <div className="flex flex-col gap-1">
                <label className={labelCls}>Banco *</label>
                <input value={banco} onChange={e => setBanco(e.target.value)} placeholder="Banco" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>{forma === 'echeq' ? 'ID ECHEQ *' : 'N° de cheque *'}</label>
                <input value={numero} onChange={e => setNumero(e.target.value)}
                  placeholder={forma === 'echeq' ? 'ID asignado' : '00000000'} className={`${inputCls} font-mono`} />
                {avisoNumero && <span className={avisoCls}>{avisoNumero}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Sucursal bancaria</label>
                <input value={bancoSucursal} onChange={e => setBancoSucursal(e.target.value)} placeholder="N° o nombre" className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>CBU</label>
                <input value={cbu} onChange={e => setCbu(e.target.value)} inputMode="numeric" placeholder="22 dígitos" className={`${inputCls} font-mono`} />
                {avisoCbu
                  ? <span className={avisoCls}>{avisoCbu}</span>
                  : <span className="text-[11px] text-kp-gray">Sucursal o CBU: alcanza con uno</span>}
              </div>

              {tipo === 'recibido' && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>CUIT/CUIL librador *</label>
                    <input value={libradorCuit} onChange={e => setLibradorCuit(e.target.value)}
                      onBlur={() => cuitValido(libradorCuit) && setLibradorCuit(formatearCuit(libradorCuit))}
                      inputMode="numeric" placeholder="20-12345678-9" className={`${inputCls} font-mono`} />
                    {avisoCuit && <span className={avisoCls}>{avisoCuit}</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className={labelCls}>Nombre librador *</label>
                    <input value={libradorNombre} onChange={e => setLibradorNombre(e.target.value)} placeholder="Razón social" className={inputCls} />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1">
                <label className={labelCls}>Fecha de emisión *</label>
                <input type="date" value={fechaEmision} onChange={e => setFechaEmision(e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>{modalidad === 'diferido' ? 'Fecha de pago diferido *' : 'Fecha de vencimiento *'}</label>
                <input type="date" value={fechaVenc} onChange={e => setFechaVenc(e.target.value)} className={inputCls} />
              </div>
              {avisoVigencia && <p className={`${avisoCls} col-span-2 -mt-2`}>{avisoVigencia}</p>}

              <div className="flex flex-col gap-1">
                <label className={labelCls}>Importe (ARS) *</label>
                <input type="number" min="0" step="0.01" value={importe} onChange={e => setImporte(e.target.value)} placeholder="0.00" className={`${inputCls} font-mono`} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} className={inputCls}>
                  {estados.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {tipo === 'recibido' ? (
              <div className="flex flex-col gap-1">
                <label className={labelCls}>Cliente que lo entrega (opcional)</label>
                <select value={clienteId} onChange={e => elegirCliente(e.target.value)} className={inputCls}>
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
              <label className={labelCls}>Observaciones / Concepto</label>
              <textarea
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                rows={2}
                placeholder="N° de factura o pedido asociado, referencia, etc."
                className="px-3 py-2 text-sm rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors"
              >
                Revisar
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
          </>
        )}

        </Modal>
    </>
  );
}
