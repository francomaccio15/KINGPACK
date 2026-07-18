'use client';

interface VentaIVA {
  id: string;
  fecha: string;
  numero: number;
  cliente_nombre: string;
  cliente_cuit: string;
  cond_iva: string;
  sucursal_nombre: string;
  tipo_comprobante: string | null;
  punto_venta: string | null;
  factura_numero: number | null;
  cae: string | null;
  neto_21: string;
  iva_21: string;
  neto_105: string;
  iva_105: string;
  neto_exento: string;
  total: string;
}

interface Totales {
  neto_21: number; iva_21: number;
  neto_105: number; iva_105: number;
  neto_exento: number; total: number;
}

function fmt(n: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(Number(n));
}
function fmtFecha(iso: string) {
  // El backend puede mandar 'YYYY-MM-DD' o un ISO completo 'YYYY-MM-DDTHH:mm:ssZ'.
  // Tomamos solo la fecha y forzamos medianoche local para evitar corrimiento de zona horaria.
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-AR');
}
function fmtComp(tipo: string | null, pv: string | number | null, nro: string | number | null) {
  if (!tipo) return '—';
  const label = tipo.replace('factura_', 'F ').replace('nota_credito_', 'NC ').replace('nota_debito_', 'ND ').toUpperCase();
  if (!pv || !nro) return label;
  return `${label} ${String(pv).padStart(5, '0')}-${String(nro).padStart(8, '0')}`;
}

export default function LibroIVAVentas({ ventas, totales }: { ventas: VentaIVA[]; totales: Totales }) {
  const debitoFiscal = totales.iva_21 + totales.iva_105;

  return (
    <div className="space-y-4">
      {/* Resumen rápido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Neto Gravado 21%',  value: fmt(totales.neto_21),     cls: 'text-kp-white' },
          { label: 'IVA 21%',           value: fmt(totales.iva_21),      cls: 'text-amber-400' },
          { label: 'IVA 10.5%',         value: fmt(totales.iva_105),     cls: 'text-amber-400' },
          { label: 'Débito Fiscal Total',value: fmt(debitoFiscal),       cls: 'text-red-400 font-bold' },
        ].map(c => (
          <div key={c.label} className="bg-kp-surface border border-kp-border rounded-xl p-4">
            <p className="text-xs text-kp-gray uppercase tracking-wide font-semibold mb-1">{c.label}</p>
            <p className={`text-lg font-bold tabular-nums ${c.cls}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {ventas.length === 0 ? (
        <div className="rounded-xl border border-kp-border bg-kp-surface px-6 py-12 text-center text-kp-gray text-sm">
          No hay ventas en el período seleccionado.
        </div>
      ) : (
        <div className="rounded-xl border border-kp-border overflow-x-auto">
          <table className="w-full text-xs min-w-[1100px]">
            <thead className="bg-kp-surface2 text-kp-gray uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-left font-semibold">Fecha</th>
                <th className="px-3 py-3 text-left font-semibold">Comprobante</th>
                <th className="px-3 py-3 text-left font-semibold">Cliente</th>
                <th className="px-3 py-3 text-left font-semibold">CUIT</th>
                <th className="px-3 py-3 text-left font-semibold">Cond. IVA</th>
                <th className="px-3 py-3 text-right font-semibold">Neto 21%</th>
                <th className="px-3 py-3 text-right font-semibold">IVA 21%</th>
                <th className="px-3 py-3 text-right font-semibold">Neto 10.5%</th>
                <th className="px-3 py-3 text-right font-semibold">IVA 10.5%</th>
                <th className="px-3 py-3 text-right font-semibold">Exento</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-kp-border">
              {ventas.map(v => (
                <tr key={v.id} className="hover:bg-kp-surface2 transition-colors">
                  <td className="px-3 py-2.5 text-kp-gray whitespace-nowrap">{fmtFecha(v.fecha)}</td>
                  <td className="px-3 py-2.5">
                    {v.cae ? (
                      <div>
                        <p className="font-medium text-kp-white">{fmtComp(v.tipo_comprobante, v.punto_venta, v.factura_numero)}</p>
                        <p className="text-kp-gray font-mono">CAE: {v.cae}</p>
                      </div>
                    ) : (
                      <span className="text-kp-gray italic">Venta #{v.numero}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 max-w-[160px]">
                    <p className="text-kp-white font-medium truncate">{v.cliente_nombre}</p>
                    <p className="text-kp-gray">{v.sucursal_nombre}</p>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-kp-gray">{v.cliente_cuit}</td>
                  <td className="px-3 py-2.5 text-kp-gray">{v.cond_iva}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-kp-white">{fmt(v.neto_21)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-400 font-semibold">{fmt(v.iva_21)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-kp-white">{fmt(v.neto_105)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-400 font-semibold">{fmt(v.iva_105)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-kp-gray">{fmt(v.neto_exento)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-kp-white">{fmt(v.total)}</td>
                </tr>
              ))}
            </tbody>
            {/* Totales */}
            <tfoot className="bg-kp-surface2 border-t-2 border-kp-border font-bold text-sm">
              <tr>
                <td colSpan={5} className="px-3 py-3 text-kp-gray uppercase tracking-wide text-xs">
                  TOTALES — {ventas.length} comprobante{ventas.length !== 1 ? 's' : ''}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-white">{fmt(totales.neto_21)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-400">{fmt(totales.iva_21)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-white">{fmt(totales.neto_105)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-400">{fmt(totales.iva_105)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-gray">{fmt(totales.neto_exento)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-kp-white">{fmt(totales.total)}</td>
              </tr>
              <tr>
                <td colSpan={6} className="px-3 py-2 text-xs text-kp-gray">
                  Débito Fiscal = IVA 21% + IVA 10.5%
                </td>
                <td colSpan={5} className="px-3 py-2 text-right tabular-nums text-red-400 font-bold text-sm">
                  Débito Fiscal: {fmt(debitoFiscal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
