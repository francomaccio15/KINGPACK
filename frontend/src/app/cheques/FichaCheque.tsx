'use client';

// Ficha de un cheque: todo lo que pasó con él en un solo lugar (de dónde vino,
// a dónde fue, qué movió en el banco y quién cambió cada estado) más las
// acciones que se pueden hacer ahora. Un cheque vive en 5 tablas según su
// origen; acá se ve igual venga de donde venga.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/auth';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';
import {
  ACCIONES, CAUSALES_RECHAZO, ESTADO_BADGE, ESTADO_LABEL, FORMA_LABEL, MODALIDAD_LABEL,
  formatoFecha, formatoMonto, type TipoCheque,
} from '@/lib/cheques';
import CambiarEstado from './CambiarEstado';
import CorregirEstado from './CorregirEstado';

interface Ficha {
  cheque: Record<string, any>;
  historial: { estado_anterior: string | null; estado_nuevo: string; observacion: string | null; usuario_nombre: string | null; created_at: string }[];
  origen: { venta_id: string | null; venta_numero: number | null; egreso_id: string | null; egreso_comprobante: string | null; pago_id: string | null; pago_fecha: string | null } | null;
  endoso_pago: { pago_id: string; fecha: string; proveedor: string | null } | null;
  /** Endosado para pagar un egreso (sueldos, retiros, gastos). */
  endoso_egreso?: { egreso_id: string; descripcion: string | null; fecha: string; proveedor: string | null } | null;
  movimientos_banco: { fecha: string; tipo: 'ingreso' | 'egreso'; monto: number; concepto: string; cuenta_nombre: string }[];
}

interface Props {
  tipo: TipoCheque;
  id: string;
  onClose: () => void;
}

const sumarDias = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function Fila({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-kp-border/50 last:border-0 text-sm">
      <span className="text-kp-gray shrink-0">{label}</span>
      <span className="text-kp-white text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-kp-gray">{titulo}</h3>
      <div className="rounded-lg border border-kp-border bg-kp-surface2/40 px-3">{children}</div>
    </section>
  );
}

export default function FichaCheque({ tipo, id, onClose }: Props) {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'administrador';
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setError('');
    apiFetch(`/api/cheques/${tipo}/${id}`)
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? 'No se pudo cargar el cheque');
        setFicha(d);
      })
      .catch(e => setError(e.message || 'Error de conexión con el servidor'));
  }, [tipo, id]);

  useEffect(() => { cargar(); }, [cargar]);

  const c = ficha?.cheque;
  const acciones = c ? (ACCIONES[tipo][c.estado] ?? []) : [];
  const pendiente = c && ['en_cartera', 'depositado', 'emitido', 'presentado'].includes(c.estado);

  return (
    <Modal open onClose={onClose} size="lg" title={c ? `${c.banco} #${c.numero_cheque}` : 'Cheque'}>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!c && !error && <p className="text-sm text-kp-gray py-8 text-center">Cargando…</p>}

      {c && ficha && (
        <div className="space-y-5">
          {/* Encabezado: lo que se mira primero */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs text-kp-gray">{tipo === 'recibido' ? 'Cheque recibido' : 'Cheque propio (emitido)'}</p>
              <p className="text-3xl font-bold text-kp-white tabular-nums">{formatoMonto(parseFloat(c.importe))}</p>
            </div>
            <div className="text-right">
              <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded border ${ESTADO_BADGE[c.estado] ?? 'bg-zinc-800 text-zinc-300 border-zinc-600'}`}>
                {ESTADO_LABEL[c.estado] ?? c.estado}
              </span>
              {c.vencido && <p className="text-xs text-red-400 mt-1">Vencido</p>}
            </div>
          </div>

          {/* Acciones disponibles ahora */}
          {acciones.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {acciones.map((a, i) => a.pagoProveedor ? (
                // Endosar = pagarle a un proveedor: se hace en Pago a Proveedores
                // para que además baje la deuda. Ese módulo es solo del admin.
                esAdmin && (
                  <Link
                    key={a.estado}
                    href={`/pagos-proveedor?endosar=${id}`}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-kp-border text-kp-gray-lt hover:text-kp-white hover:border-kp-white transition-colors"
                  >
                    {a.label}
                  </Link>
                )
              ) : (
                <CambiarEstado
                  key={a.estado}
                  chequeId={id}
                  tipo={tipo}
                  estadoActual={c.estado}
                  estadoFijo={a.estado}
                  label={a.label}
                  primario={i === 0 && !a.soloFicha}
                  onDone={cargar}
                />
              ))}
            </div>
          )}

          <Seccion titulo="Datos">
            <Fila label="Vencimiento">{formatoFecha(c.fecha_vencimiento)}</Fila>
            {pendiente && (
              <Fila label={tipo === 'recibido' ? 'Entra al banco' : 'Sale del banco'}>
                ~{formatoFecha(sumarDias(c.fecha_vencimiento, 2))}
              </Fila>
            )}
            <Fila label="Emisión">{formatoFecha(c.fecha_emision)}</Fila>
            {(c.forma || c.modalidad) && (
              <Fila label="Tipo">
                {[c.forma && FORMA_LABEL[c.forma as 'fisico' | 'echeq'], c.modalidad && MODALIDAD_LABEL[c.modalidad as 'al_dia' | 'diferido']].filter(Boolean).join(' · ')}
              </Fila>
            )}
            {(c.librador_nombre || c.librador_cuit) && (
              <Fila label="Librador">
                {c.librador_nombre}{c.librador_cuit && <span className="font-mono text-kp-gray"> · {c.librador_cuit}</span>}
              </Fila>
            )}
            <Fila label="Sucursal">{c.sucursal_nombre ?? '—'}</Fila>
            {c.observaciones && <Fila label="Observaciones">{c.observaciones}</Fila>}
          </Seccion>

          <Seccion titulo="De dónde vino">
            {ficha.origen?.venta_id ? (
              <Fila label="Venta">
                <Link href={`/ventas/${ficha.origen.venta_id}`} className="text-kp-red hover:underline">#{ficha.origen.venta_numero}</Link>
                {' · '}{c.origen_nombre}
              </Fila>
            ) : ficha.origen?.egreso_id ? (
              <Fila label="Pago de factura">
                <Link href={`/gastos/${ficha.origen.egreso_id}`} className="text-kp-red hover:underline">{ficha.origen.egreso_comprobante ?? 'Ver egreso'}</Link>
                {' · '}{c.origen_nombre}
              </Fila>
            ) : ficha.origen?.pago_id ? (
              <Fila label="Pago a proveedor">{c.origen_nombre} · {formatoFecha(ficha.origen.pago_fecha)}</Fila>
            ) : c.origen_tipo === 'movimiento_caja' ? (
              <Fila label="Movimiento de caja">{c.origen_nombre}</Fila>
            ) : (
              <Fila label={tipo === 'recibido' ? 'Cliente' : 'Proveedor'}>{c.origen_nombre}</Fila>
            )}
          </Seccion>

          {(c.estado === 'endosado' || c.deposito_cuenta_nombre || c.estado === 'rechazado') && (
            <Seccion titulo="A dónde fue">
              {c.estado === 'endosado' && (
                <>
                  <Fila label="Endosado a">{c.endoso_proveedor_nombre ?? ficha.endoso_pago?.proveedor ?? ficha.endoso_egreso?.descripcion ?? '—'}</Fila>
                  {c.endoso_fecha && <Fila label="Entregado el">{formatoFecha(c.endoso_fecha)}</Fila>}
                  {c.endoso_comprobante && <Fila label="Cancela">{c.endoso_comprobante}</Fila>}
                  {ficha.endoso_pago ? (
                    <Fila label="Pago a proveedor">{formatoFecha(ficha.endoso_pago.fecha)}</Fila>
                  ) : ficha.endoso_egreso ? (
                    <Fila label="Pagó el egreso">
                      <a href={`/gastos/${ficha.endoso_egreso.egreso_id}`} className="text-kp-red hover:underline">
                        {ficha.endoso_egreso.descripcion || 'Ver egreso'}
                      </a>
                      {ficha.endoso_egreso.fecha ? ` · ${formatoFecha(ficha.endoso_egreso.fecha)}` : ''}
                    </Fila>
                  ) : (
                    <p className="py-2 text-xs text-amber-400">
                      Endosado sin Pago a Proveedores: no bajó la deuda con el proveedor.
                    </p>
                  )}
                </>
              )}
              {c.deposito_cuenta_nombre && <Fila label="Depositado en">{c.deposito_cuenta_nombre}</Fila>}
              {c.estado === 'rechazado' && (
                <Fila label="Causal del rechazo">
                  <span className="text-red-400">{CAUSALES_RECHAZO[c.rechazo_causal] ?? c.rechazo_causal ?? '—'}</span>
                </Fila>
              )}
              {c.estado === 'rechazado' && ficha.endoso_pago && (
                <p className="py-2 text-xs text-amber-400">
                  Estaba endosado a {ficha.endoso_pago.proveedor ?? 'un proveedor'} y lo devolvió:
                  se le volvió a sumar a la deuda. Queda para reclamarle a quien lo libró.
                </p>
              )}
            </Seccion>
          )}

          <Seccion titulo="Banco">
            {ficha.movimientos_banco.length === 0 ? (
              <p className="py-2 text-sm text-kp-gray">
                {pendiente
                  ? 'Todavía no movió el banco. Lo hace al acreditarse o debitarse.'
                  : c.estado === 'endosado' ? 'No pasó por nuestra cuenta: se endosó.' : 'Sin movimientos en el banco.'}
              </p>
            ) : ficha.movimientos_banco.map((m, i) => (
              <Fila key={i} label={formatoFecha(m.fecha)}>
                <span className={m.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}>
                  {m.tipo === 'ingreso' ? '+' : '−'}{formatoMonto(m.monto)}
                </span>
                <span className="block text-[11px] text-kp-gray">{m.cuenta_nombre}</span>
              </Fila>
            ))}
          </Seccion>

          {ficha.historial.length > 0 && (
            <Seccion titulo="Historial">
              {ficha.historial.map((h, i) => (
                <div key={i} className="py-1.5 border-b border-kp-border/50 last:border-0 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-kp-white">
                      {h.estado_anterior ? `${ESTADO_LABEL[h.estado_anterior] ?? h.estado_anterior} → ` : ''}
                      <b>{ESTADO_LABEL[h.estado_nuevo] ?? h.estado_nuevo}</b>
                    </span>
                    <span className="text-xs text-kp-gray whitespace-nowrap">
                      {new Date(h.created_at).toLocaleDateString('es-AR')}{h.usuario_nombre ? ` · ${h.usuario_nombre}` : ''}
                    </span>
                  </div>
                  {h.observacion && <p className="text-xs text-kp-gray mt-0.5">{h.observacion}</p>}
                </div>
              ))}
            </Seccion>
          )}

          {/* Corrección de errores de carga: abajo y aparte, solo admin */}
          <div className="flex justify-end pt-1">
            <CorregirEstado chequeId={id} tipo={tipo} estadoActual={c.estado} onDone={cargar} />
          </div>
        </div>
      )}
    </Modal>
  );
}
