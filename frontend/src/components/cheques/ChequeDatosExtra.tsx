'use client';

// Campos de la mig 059 para un cheque cargado dentro de otra operación
// (venta, egreso, pago a proveedor, movimiento de caja, cobranza). El form
// anfitrión sigue manejando banco, número, vencimiento e importe.

import {
  type ChequeExtra, type Forma, type Modalidad,
  cuitValido, avisoCbu, formatearCuit, errorVigencia,
} from '@/lib/cheques';

interface Props {
  value: ChequeExtra;
  onChange: (cambios: Partial<ChequeExtra>) => void;
  tipo: 'recibido' | 'emitido';
  /** Vencimiento del form anfitrión, para avisar la vigencia en vivo. */
  fechaVencimiento?: string;
  /** false si el form anfitrión ya tiene su propio input de emisión. */
  conEmision?: boolean;
  inputCls?: string;
  labelCls?: string;
}

const INPUT = 'h-8 px-2 text-xs rounded-md bg-kp-surface2 border border-kp-border text-kp-white placeholder:text-kp-gray focus:outline-none focus:border-kp-red w-full';
const LABEL = 'text-[11px] text-kp-gray font-medium';

export default function ChequeDatosExtra({
  value, onChange, tipo, fechaVencimiento, conEmision = true,
  inputCls = INPUT, labelCls = LABEL,
}: Props) {
  const avisoCuit = value.librador_cuit && !cuitValido(value.librador_cuit) ? 'CUIT inválido' : '';
  const avisoCbuTxt = avisoCbu(value.banco_cbu);
  const avisoVig = fechaVencimiento ? errorVigencia(value.fecha_emision, fechaVencimiento, value.modalidad) : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Forma *</label>
        <select value={value.forma} onChange={e => onChange({ forma: e.target.value as Forma })} className={inputCls}>
          <option value="fisico">Físico</option>
          <option value="echeq">ECHEQ</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Modalidad *</label>
        <select value={value.modalidad} onChange={e => onChange({ modalidad: e.target.value as Modalidad })} className={inputCls}>
          <option value="al_dia">Al día</option>
          <option value="diferido">Diferido</option>
        </select>
      </div>
      {conEmision && (
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Emisión *</label>
          <input type="date" value={value.fecha_emision} onChange={e => onChange({ fecha_emision: e.target.value })} className={inputCls} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>Sucursal banco</label>
        <input value={value.banco_sucursal} onChange={e => onChange({ banco_sucursal: e.target.value })} placeholder="N° o nombre" className={inputCls} />
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelCls}>CBU</label>
        <input value={value.banco_cbu} onChange={e => onChange({ banco_cbu: e.target.value })} inputMode="numeric" placeholder="o sucursal" className={`${inputCls} font-mono`} />
        {avisoCbuTxt && <span className="text-[10px] text-amber-400">{avisoCbuTxt}</span>}
      </div>
      {tipo === 'recibido' && (
        <>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>CUIT librador *</label>
            <input value={value.librador_cuit} onChange={e => onChange({ librador_cuit: e.target.value })}
              onBlur={() => cuitValido(value.librador_cuit) && onChange({ librador_cuit: formatearCuit(value.librador_cuit) })}
              inputMode="numeric" placeholder="20-12345678-9" className={`${inputCls} font-mono`} />
            {avisoCuit && <span className="text-[10px] text-amber-400">{avisoCuit}</span>}
          </div>
          <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
            <label className={labelCls}>Nombre librador *</label>
            <input value={value.librador_nombre} onChange={e => onChange({ librador_nombre: e.target.value })} placeholder="Razón social" className={inputCls} />
          </div>
        </>
      )}
      {avisoVig && <p className="col-span-full text-[10px] text-amber-400">{avisoVig}</p>}
    </div>
  );
}
