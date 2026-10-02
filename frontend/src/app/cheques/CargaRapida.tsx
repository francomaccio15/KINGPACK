'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import Modal from '@/components/ui/Modal';
import { sucursalPorDefecto, useSucursalActiva } from '@/lib/sucursalActivaCliente';
import {
  type Forma, type Modalidad, FORMA_LABEL, MODALIDAD_LABEL,
  cuitValido, cbuValido, numeroValido, errorVigencia, formatearCuit,
  formatoMonto, soloDigitos,
} from '@/lib/cheques';
import { type BorradorCheque, type ClienteRef, parsearTexto } from '@/lib/cheques-parser';

interface Opcion { id: string; nombre: string }

type Fila = BorradorCheque & {
  key: number;
  resultado?: 'ok' | string; // 'ok' = guardado; otro texto = error del servidor
};

const EJEMPLO = `ECHEQ Santander 12345678 $150000 Emi: 01/10 Venc: 15/11 CUIT 30-71234567-1 Suc: 045 Cliente: Distribuidora Norte
Físico Galicia 00451234 $ 85.000,50 Emi: 28/09 Venc: 20/10 al día Cliente: Kiosco Sur Fact: A-0001-00001234`;

const hoyISO = () => new Date().toLocaleDateString('en-CA');

// Mismo criterio que el backend (cheques-validacion.js). Lista vacía = lista para guardar.
function errores(f: Fila): string[] {
  const e: string[] = [];
  if (!f.banco.trim()) e.push('Falta banco');
  if (!f.numero.trim()) e.push(f.forma === 'echeq' ? 'Falta ID ECHEQ' : 'Falta N° de cheque');
  else if (!numeroValido(f.numero, f.forma)) e.push('Número con formato inválido');
  if (!f.importe || Number(f.importe) <= 0) e.push('Falta importe');
  if (!f.fechaEmision) e.push('Falta emisión');
  if (!f.fechaVencimiento) e.push('Falta vencimiento');
  const v = errorVigencia(f.fechaEmision, f.fechaVencimiento, f.modalidad);
  if (v) e.push(v);
  if (!f.bancoSucursal.trim() && !f.cbu.trim()) e.push('Falta sucursal o CBU');
  if (f.cbu.trim() && !cbuValido(f.cbu)) e.push('CBU inválido');
  if (!f.libradorCuit.trim()) e.push('Falta CUIT librador');
  else if (!cuitValido(f.libradorCuit)) e.push('CUIT inválido');
  if (!f.libradorNombre.trim()) e.push('Falta nombre librador');
  return e;
}

export default function CargaRapida() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [paso, setPaso] = useState<'texto' | 'revisar'>('texto');
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [sucursales, setSucursales] = useState<Opcion[]>([]);
  const [clientes, setClientes] = useState<ClienteRef[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || sucursales.length > 0) return;
    Promise.all([
      apiFetch('/api/sucursales').then(r => r.json()).catch(() => ({ sucursales: [] })),
      apiFetch('/api/clientes?limit=5000').then(r => r.json()).catch(() => ({ clientes: [] })),
    ]).then(([suc, cli]) => {
      const sArr = (suc.sucursales ?? []).map((s: any) => ({ id: s.id, nombre: s.nombre }));
      setSucursales(sArr);
      if (sArr.length) setSucursalId(sucursalPorDefecto(sArr));
      setClientes((cli.clientes ?? []).map((c: any) => ({ id: c.id, nombre: c.razon_social, cuit: c.cuit })));
    });
  }, [open, sucursales.length]);

  const sucursalActiva = useSucursalActiva();
  useEffect(() => {
    if (sucursalActiva && sucursales.some(s => s.id === sucursalActiva)) setSucursalId(sucursalActiva);
  }, [sucursalActiva]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = () => {
    setOpen(false);
    setPaso('texto');
    setTexto(''); setFilas([]); setError('');
  };

  const interpretar = () => {
    setError('');
    const borradores = parsearTexto(texto, hoyISO(), clientes);
    if (!borradores.length) return setError('Pegá al menos una línea');
    setFilas(borradores.map((b, i) => ({ ...b, key: i })));
    setPaso('revisar');
  };

  const editar = (key: number, cambios: Partial<Fila>) =>
    setFilas(fs => fs.map(f => (f.key === key ? { ...f, ...cambios, resultado: undefined } : f)));

  const quitar = (key: number) => setFilas(fs => fs.filter(f => f.key !== key));

  const elegirCliente = (key: number, id: string) => {
    const c = clientes.find(x => x.id === id);
    setFilas(fs => fs.map(f => {
      if (f.key !== key) return f;
      return {
        ...f,
        clienteId: id,
        libradorNombre: f.libradorNombre.trim() ? f.libradorNombre : (c?.nombre ?? ''),
        libradorCuit: f.libradorCuit.trim() ? f.libradorCuit : (c?.cuit ?? ''),
        resultado: undefined,
      };
    }));
  };

  const pendientes = filas.filter(f => f.resultado !== 'ok');
  const listas = pendientes.filter(f => errores(f).length === 0);
  const totalListas = listas.reduce((s, f) => s + Number(f.importe || 0), 0);

  // Guarda de a uno: cada cheque es su propia transacción en el backend, y así
  // un rechazo (duplicado, p. ej.) no frena a los demás. Las filas guardadas
  // quedan marcadas; las que fallan muestran el motivo y se pueden corregir.
  const guardar = async () => {
    if (!sucursalId) return setError('Seleccioná una sucursal');
    setGuardando(true);
    setError('');
    for (const f of listas) {
      let resultado: Fila['resultado'];
      try {
        const res = await apiFetch('/api/cheques', {
          method: 'POST',
          body: JSON.stringify({
            tipo: 'recibido',
            forma: f.forma,
            modalidad: f.modalidad,
            banco: f.banco.trim(),
            banco_sucursal: f.bancoSucursal.trim() || null,
            banco_cbu: soloDigitos(f.cbu) || null,
            numero_cheque: f.numero.trim(),
            fecha_emision: f.fechaEmision,
            fecha_vencimiento: f.fechaVencimiento,
            importe: f.importe,
            estado: 'en_cartera',
            sucursal_id: sucursalId,
            librador_cuit: f.libradorCuit.trim(),
            librador_nombre: f.libradorNombre.trim(),
            cliente_id: f.clienteId || null,
            observaciones: f.observaciones.trim() || null,
          }),
        });
        resultado = res.ok ? 'ok' : ((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`);
      } catch {
        resultado = 'Error de conexión';
      }
      setFilas(fs => fs.map(x => (x.key === f.key ? { ...x, resultado } : x)));
    }
    setGuardando(false);
    router.refresh();
  };

  const cell = 'h-8 px-2 text-xs rounded bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red';
  const th = 'px-1.5 py-2 text-left text-[11px] font-semibold text-kp-gray uppercase tracking-wide whitespace-nowrap';
  const guardadas = filas.filter(f => f.resultado === 'ok').length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md border border-kp-border text-kp-gray-lt hover:text-kp-white hover:border-kp-white transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M4 6h16M4 12h10M4 18h7" />
        </svg>
        Carga rápida
      </button>

      <Modal
        open={open}
        onClose={cerrar}
        title={paso === 'texto' ? 'Carga rápida de cheques recibidos' : 'Revisar antes de guardar'}
        subtitle={paso === 'texto'
          ? 'Un cheque por línea. Se interpreta cada dato; lo que falte se completa en el paso siguiente.'
          : `${filas.length} línea(s) · ${listas.length} lista(s) para guardar${guardadas ? ` · ${guardadas} guardada(s)` : ''}`}
        size={paso === 'texto' ? 'lg' : 'full'}
      >
        {paso === 'texto' ? (
          <div className="space-y-3">
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={9}
              autoFocus
              placeholder={EJEMPLO}
              className="w-full px-3 py-2 text-sm font-mono rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray/60 focus:outline-none focus:border-kp-red resize-y"
            />
            <div className="text-[11px] text-kp-gray leading-relaxed">
              Reconoce: <b>ECHEQ</b>/<b>Físico</b> · banco · número o <b>ID:</b> · <b>$</b>importe (150.000,50 o 150000) ·
              {' '}<b>Emi:</b> y <b>Venc:</b> (dd/mm o dd/mm/aa) · <b>al día</b>/<b>diferido</b> · <b>CUIT</b> · <b>CBU</b> ·
              {' '}<b>Suc:</b> · <b>Cliente:</b> · <b>Librador:</b> · <b>Fact:</b>/<b>Pedido:</b>. Las líneas con <b>#</b> se ignoran.
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={interpretar}
                disabled={!texto.trim()}
                className="flex-1 h-9 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors disabled:opacity-50"
              >
                Interpretar
              </button>
              <button
                type="button"
                onClick={() => setTexto(EJEMPLO)}
                className="px-4 h-9 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
              >
                Ver ejemplo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-kp-gray font-medium">Sucursal *</label>
                <select value={sucursalId} onChange={e => setSucursalId(e.target.value)} className={`${cell} h-9 text-sm`}>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <p className="text-xs text-kp-gray pb-2">
                Todos entran <b className="text-kp-white">En Cartera</b>. Los datos en <span className="text-amber-400">ámbar</span> fueron deducidos: revisalos.
              </p>
            </div>

            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full min-w-[1100px] border-separate border-spacing-y-1">
                <thead>
                  <tr>
                    <th className={th}>Forma</th>
                    <th className={th}>Modalidad</th>
                    <th className={th}>Banco</th>
                    <th className={th}>N° / ID</th>
                    <th className={th}>Importe</th>
                    <th className={th}>Emisión</th>
                    <th className={th}>Vencimiento</th>
                    <th className={th}>Suc. / CBU</th>
                    <th className={th}>Librador (CUIT · nombre)</th>
                    <th className={th}>Cliente</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => {
                    const guardada = f.resultado === 'ok';
                    const inferido = (b: boolean) => (b ? 'border-amber-500/70' : '');
                    return (
                      <tr key={f.key} className={guardada ? 'opacity-50' : ''}>
                        <td className="px-1 align-top">
                          <select disabled={guardada} value={f.forma} onChange={e => editar(f.key, { forma: e.target.value as Forma, formaInferida: false })}
                            className={`${cell} ${inferido(f.formaInferida)}`}>
                            {Object.entries(FORMA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-1 align-top">
                          <select disabled={guardada} value={f.modalidad} onChange={e => editar(f.key, { modalidad: e.target.value as Modalidad, modalidadInferida: false })}
                            className={`${cell} ${inferido(f.modalidadInferida)}`}>
                            {Object.entries(MODALIDAD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-1 align-top">
                          <input disabled={guardada} value={f.banco} onChange={e => editar(f.key, { banco: e.target.value })} className={`${cell} w-24`} />
                        </td>
                        <td className="px-1 align-top">
                          <input disabled={guardada} value={f.numero} onChange={e => editar(f.key, { numero: e.target.value })} className={`${cell} w-28 font-mono`} />
                        </td>
                        <td className="px-1 align-top">
                          <input disabled={guardada} value={f.importe} inputMode="decimal" onChange={e => editar(f.key, { importe: e.target.value.replace(',', '.') })}
                            className={`${cell} w-28 font-mono text-right`} />
                        </td>
                        <td className="px-1 align-top">
                          <input disabled={guardada} type="date" value={f.fechaEmision} onChange={e => editar(f.key, { fechaEmision: e.target.value })} className={`${cell} w-32`} />
                        </td>
                        <td className="px-1 align-top">
                          <input disabled={guardada} type="date" value={f.fechaVencimiento} onChange={e => editar(f.key, { fechaVencimiento: e.target.value })} className={`${cell} w-32`} />
                        </td>
                        <td className="px-1 align-top">
                          <div className="flex flex-col gap-1">
                            <input disabled={guardada} value={f.bancoSucursal} placeholder="Sucursal" onChange={e => editar(f.key, { bancoSucursal: e.target.value })} className={`${cell} w-28`} />
                            <input disabled={guardada} value={f.cbu} placeholder="CBU" onChange={e => editar(f.key, { cbu: e.target.value })} className={`${cell} w-28 font-mono`} />
                          </div>
                        </td>
                        <td className="px-1 align-top">
                          <div className="flex flex-col gap-1">
                            <input disabled={guardada} value={f.libradorCuit} placeholder="CUIT"
                              onChange={e => editar(f.key, { libradorCuit: e.target.value })}
                              onBlur={() => cuitValido(f.libradorCuit) && editar(f.key, { libradorCuit: formatearCuit(f.libradorCuit) })}
                              className={`${cell} w-36 font-mono`} />
                            <input disabled={guardada} value={f.libradorNombre} placeholder="Nombre" onChange={e => editar(f.key, { libradorNombre: e.target.value })} className={`${cell} w-36`} />
                          </div>
                        </td>
                        <td className="px-1 align-top">
                          <select disabled={guardada} value={f.clienteId} onChange={e => elegirCliente(f.key, e.target.value)} className={`${cell} w-40`}>
                            <option value="">{f.clienteTexto ? `¿"${f.clienteTexto}"?` : '— Sin cliente —'}</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </td>
                        <td className="px-1 align-top whitespace-nowrap">
                          {guardada ? (
                            <span className="text-xs font-semibold text-emerald-400">✓ Guardado</span>
                          ) : (
                            <button type="button" onClick={() => quitar(f.key)} disabled={guardando}
                              className="text-xs text-kp-gray hover:text-red-400" aria-label="Quitar línea">Quitar</button>
                          )}
                        </td>
                      </tr>
                    );
                  }).flatMap((tr, i) => {
                    // Debajo de cada fila: la línea original y lo que le falta.
                    const f = filas[i];
                    const errs = f.resultado === 'ok' ? [] : errores(f);
                    const srv = f.resultado && f.resultado !== 'ok' ? f.resultado : '';
                    return [tr, (
                      <tr key={`${f.key}-info`}>
                        <td colSpan={11} className="px-1 pb-2 border-b border-kp-border/60">
                          <span className="text-[11px] font-mono text-kp-gray">{f.linea}</span>
                          {(errs.length > 0 || srv) && (
                            <span className="ml-3 text-[11px] text-red-400">{[srv, ...errs].filter(Boolean).join(' · ')}</span>
                          )}
                          {!errs.length && !srv && f.resultado !== 'ok' && (
                            <span className="ml-3 text-[11px] text-emerald-400">Listo</span>
                          )}
                        </td>
                      </tr>
                    )];
                  })}
                </tbody>
              </table>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={guardar}
                disabled={guardando || listas.length === 0}
                className="h-9 px-4 text-sm font-semibold rounded-md bg-kp-red text-white hover:bg-kp-red-dark transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando…' : `Guardar ${listas.length} cheque(s) · ${formatoMonto(totalListas)}`}
              </button>
              <button
                type="button"
                onClick={() => setPaso('texto')}
                disabled={guardando}
                className="h-9 px-4 text-sm font-semibold rounded-md border border-kp-border text-kp-gray hover:text-kp-white hover:border-kp-white transition-colors"
              >
                Volver al texto
              </button>
              {pendientes.length > listas.length && (
                <span className="text-xs text-kp-gray">
                  {pendientes.length - listas.length} con datos faltantes no se guardan hasta completarlos.
                </span>
              )}
              {guardadas > 0 && pendientes.length === 0 && (
                <button type="button" onClick={cerrar} className="h-9 px-4 text-sm font-semibold rounded-md border border-emerald-600 text-emerald-400">
                  Listo, cerrar
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
