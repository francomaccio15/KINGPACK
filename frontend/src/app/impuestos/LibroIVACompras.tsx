'use client';

interface CompraIVA {
  id: string;
  fecha: string;
  tipo_comprobante: string;
  punto_venta: string | null;
  numero_comprobante: string | null;
  proveedor_nombre: string;
  proveedor_cuit: string;
  sucursal_nombre: string;
  tipo_operacion: string;
  descripcion: string;
  neto_gravado: string;
  neto_no_gravado: string;
  iva_21: string;
  iva_105: string;
  percepciones_ib: string;
  otros_impuestos: string;
  total: string;
  sin_cuit: boolean;
}

interface Totales {
  neto_gravado: number; neto_no_gravado: number;
  iva_21: number; iva_105: number;
  percepciones_ib: number; otros_impuestos: number; total: number;
}

function fmt(n: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(Number(n));
}
function fmtFecha(iso: string) {
  // El backend puede mandar 'YYYY-MM-DD' o un ISO completo 'YYYY-MM-DDTHH:mm:ssZ'.
  // Tomamos solo la fecha y forzamos medianoche local para evitar corrimiento de zona horaria.
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-AR');
}
function fmtComp(tipo: string, pv: string | number | null, nro: string | number | null) {
  const label = tipo.replace('factura_', 'F ').replace('nota_credito_', 'NC ').replace('nota_debito_', 'ND ').toUpperCase();
  if (!pv || !nro) return label;
  return `${label} ${String(pv).padStart(5, '0')}-${String(nro).padStart(8, '0')}`;
}
const TIPO_OP_LABEL: Record<string, string> = {
  compra_mercaderia:    'Mercadería',
  compra_gasto:        'Gasto',
  inversion_bien_uso:  'Inversión',
  anticipo_proveedor:  'Anticipo',
};

export default function LibroIVACompras({
  compras, totales, creditoFiscalValido,
}: {
  compras: CompraIVA[];
  totales: Totales;
  creditoFiscalValido: number;
}) {
  const creditoFiscal = totales.iva_21 + totales.iva_105;
  const sinCuitCant   = compras.filter(c => c.sin_cuit).length;

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Neto Gravado',       value: fmt(totales.neto_gravado),    cls: 'text-kp-white' },
          { label: 'IVA 21%',            value: fmt(totales.iva_21),          cls: 'text-emerald-400' },
          { label: 'IVA 10.5%',          value: fmt(totales.iva_105),         cls: 'text-emerald-400' },
          { label: 'Crédito Fiscal Total',value: fmt(creditoFiscalValido),    cls: 'text-emerald-400 font-bold' },
        ].map(c => (
          <div key={c.label} className="bg-kp-surface border border-kp-border rounded-xl p-4">
            <p className="text-xs text-kp-gray uppercase tracking-wide font-semibold mb-1">{c.label}</p>
            <p className={`text-lg font-bold tabular-nums ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Alerta sin CUIT */}
      {sinCuitCant > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-amber-400 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-sm text-amber-300">
            <span className="font-bold">{sinCuitCant} comprobante{sinCuitCant > 1 ? 's' : ''} sin CUIT</span>
            {' — '}no computan como Crédito Fiscal válido ante AFIP ({fmt(creditoFiscal - creditoFiscalValido)} excluidos).
          </p>
        </div>
      )}

      {compras.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface px-6 py-12 text-center text-kp-gray text-sm">
          No hay compras en el período seleccionado.
        </div>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-x-auto">
          <table className="w-full text-xs min-w-[1200px]">
            <thead className="bg-kp-surface2 text-kp-gray uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                <th className="px-3 py-3 text-left font-semibold">Comprobante</th>
                <th className="px-3 py-3 text-left font-semibold">Proveedor</th>
                <th className="px-3 py-3 text-left font-semibold">CUIT</th>
                <th className="px-3 py-3 text-left font-semibold">Tipo</th>
                <th className="px-3 py-3 text-right font-semibold">Neto Grav.</th>
                <th className="px-3 py-3 text-right font-semibold">No Grav.</th>
                <th className="px-3 py-3 text-right font-semibold">IVA 21%</th>
                <th className="px-3 py-3 text-right font-semibold">IVA 10.5%</th>
                <th className="px-3 py-3 text-right font-semibold">Perc. IB</th>
                <th className="px-3 py-3 text-right font-semibold">Otros</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {compras.map(c => (
                <tr
                  key={c.id}
                  className={[
                    'hover:bg-kp-surface2 transition-colors',
                    c.sin_cuit ? 'opacity-60' : '',
                  ].join(' ')}
                >
                  <td className="px-3 py-2.5 text-kp-gray whitespace-nowrap">{fmtFecha(c.fecha)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-kp-white">{fmtComp(c.tipo_comprobante, c.punto_venta, c.numero_comprobante)}</p>
                    {c.sin_cuit && <p className="text-amber-400 text-[10px]">sin CUIT</p>}
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px]">
                    <p className="text-kp-white font-medium truncate">{c.proveedor_nombre}</p>
                    <p className="text-kp-gray">{c.sucursal_nombre}</p>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-kp-gray">{c.proveedor_cuit}</td>
                  <td className="px-3 py-2.5 text-kp-gray">{TIPO_OP_LABEL[c.tipo_operacion] ?? c.tipo_operacion}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-kp-white">{fmt(c.neto_gravado)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-kp-gray">{fmt(c.neto_no_gravado)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-400 font-semibold">{fmt(c.iva_21)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-400 font-semibold">{fmt(c.iva_105)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-kp-gray">{fmt(c.percepciones_ib)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-kp-gray">{fmt(c.otros_impuestos)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-kp-white">{fmt(c.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-kp-surface2 border-t-2 border-kp-border font-bold text-sm">
              <tr>
                <td colSpan={5} className="px-3 py-3 text-kp-gray uppercase tracking-wide text-xs">
                  TOTALES — {compras.length} comprobante{compras.length !== 1 ? 's' : ''}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-white">{fmt(totales.neto_gravado)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-gray">{fmt(totales.neto_no_gravado)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-400">{fmt(totales.iva_21)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-emerald-400">{fmt(totales.iva_105)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-gray">{fmt(totales.percepciones_ib)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-gray">{fmt(totales.otros_impuestos)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-white">{fmt(totales.total)}</td>
              </tr>
              <tr>
                <td colSpan={7} className="px-3 py-2 text-xs text-kp-gray">
                  Crédito Fiscal válido (solo con CUIT) = IVA 21% + IVA 10.5%
                </td>
                <td colSpan={5} className="px-3 py-2 text-right tabular-nums text-emerald-400 font-bold text-sm">
                  Crédito Fiscal: {fmt(creditoFiscalValido)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
