'use client';

interface MesPosicion {
  mes: string;
  debito_fiscal: number;
  debito_21: number;
  debito_105: number;
  credito_fiscal: number;
  credito_21: number;
  credito_105: number;
  saldo_mes: number;
  saldo_acumulado: number;
  neto_ventas: number;
  neto_compras: number;
  cant_ventas: number;
  cant_compras: number;
  estado: 'a_pagar' | 'saldo_favor' | 'neutro';
}

interface YTD {
  debito_fiscal: number;
  credito_fiscal: number;
  saldo_neto: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);
}

function fmtMes(iso: string) {
  const [y, m] = iso.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

function fmtPct(num: number, den: number) {
  if (!den) return '—';
  return `${((num / den) * 100).toFixed(1)}%`;
}

export default function PosicionIVA({
  posicion, ytd, proyeccion, anio,
}: {
  posicion: MesPosicion[];
  ytd: YTD;
  proyeccion: number;
  anio: number;
}) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const ultimoMes = posicion.find(p => p.mes === mesActual) ?? posicion[posicion.length - 1];

  if (posicion.length === 0) {
    return (
      <div className="rounded-xl border border-kp-border bg-kp-surface px-6 py-12 text-center text-kp-gray text-sm">
        No hay datos de IVA para {anio}.
      </div>
    );
  }

  const saldoYTDPositivo = ytd.saldo_neto > 0;

  return (
    <div className="space-y-6">

      {/* ── KPIs año ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div className={`rounded-xl border p-5 space-y-2 ${saldoYTDPositivo ? 'bg-red-950/30 border-red-700/40' : 'bg-emerald-950/30 border-emerald-700/40'}`}>
          <p className={`text-xs font-bold uppercase tracking-widest ${saldoYTDPositivo ? 'text-red-400' : 'text-emerald-400'}`}>
            Posición IVA {anio}
          </p>
          <p className={`text-3xl font-bold tabular-nums ${saldoYTDPositivo ? 'text-red-300' : 'text-emerald-300'}`}>
            {fmt(Math.abs(ytd.saldo_neto))}
          </p>
          <p className="text-sm text-kp-gray">
            {saldoYTDPositivo ? '▲ A pagar a AFIP (acumulado)' : '▼ Saldo a favor acumulado'}
          </p>
        </div>

        <div className="rounded-xl border border-kp-border bg-kp-surface p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Desglose YTD</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-kp-gray">Débito Fiscal (ventas)</span>
              <span className="tabular-nums text-red-400 font-semibold">{fmt(ytd.debito_fiscal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-kp-gray">Crédito Fiscal (compras)</span>
              <span className="tabular-nums text-emerald-400 font-semibold">−{fmt(ytd.credito_fiscal)}</span>
            </div>
            <div className="border-t border-kp-border pt-1.5 flex justify-between text-sm font-bold">
              <span className="text-kp-white">Saldo neto</span>
              <span className={`tabular-nums ${saldoYTDPositivo ? 'text-red-400' : 'text-emerald-400'}`}>
                {saldoYTDPositivo ? '' : '−'}{fmt(Math.abs(ytd.saldo_neto))}
              </span>
            </div>
            <div className="text-xs text-kp-gray pt-1">
              Cobertura de crédito: <span className="text-kp-white font-semibold">
                {fmtPct(ytd.credito_fiscal, ytd.debito_fiscal)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-kp-border bg-kp-surface p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-kp-gray">Métricas</p>
          <div className="space-y-2 text-sm">
            {ultimoMes && (
              <>
                <div className="flex justify-between">
                  <span className="text-kp-gray">Mes actual</span>
                  <span className={`tabular-nums font-semibold ${ultimoMes.saldo_mes > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {fmt(Math.abs(ultimoMes.saldo_mes))}
                    <span className="text-xs ml-1 opacity-70">{ultimoMes.saldo_mes > 0 ? 'a pagar' : 'a favor'}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-kp-gray">Tasa efectiva IVA ventas</span>
                  <span className="text-kp-white font-semibold">
                    {fmtPct(ultimoMes.debito_fiscal, ultimoMes.neto_ventas)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-kp-gray">Proyección próx. mes</span>
              <span className={`tabular-nums font-semibold ${proyeccion > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                {proyeccion > 0 ? '+' : ''}{fmt(proyeccion)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabla mensual ── */}
      <div className="rounded-xl border border-kp-border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-kp-surface2 text-kp-gray text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Mes</th>
              <th className="px-4 py-3 text-right font-semibold">Neto Ventas</th>
              <th className="px-4 py-3 text-right font-semibold text-red-400">Débito Fiscal</th>
              <th className="px-4 py-3 text-right font-semibold">Neto Compras</th>
              <th className="px-4 py-3 text-right font-semibold text-emerald-400">Crédito Fiscal</th>
              <th className="px-4 py-3 text-right font-semibold">Saldo Mes</th>
              <th className="px-4 py-3 text-right font-semibold">Acumulado</th>
              <th className="px-4 py-3 text-center font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {posicion.map(p => {
              const esActual = p.mes === mesActual;
              return (
                <tr
                  key={p.mes}
                  className={[
                    'transition-colors',
                    esActual ? 'bg-kp-surface2' : 'hover:bg-kp-surface2',
                  ].join(' ')}
                >
                  <td className="px-4 py-3">
                    <p className={`font-semibold capitalize ${esActual ? 'text-kp-red' : 'text-kp-white'}`}>
                      {fmtMes(p.mes)}
                    </p>
                    <p className="text-xs text-kp-gray">{p.cant_ventas} ventas · {p.cant_compras} compras</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-gray">{fmt(p.neto_ventas)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-400 font-semibold">
                    {fmt(p.debito_fiscal)}
                    <p className="text-xs opacity-60">{fmt(p.debito_21)} / {fmt(p.debito_105)}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-kp-gray">{fmt(p.neto_compras)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-semibold">
                    {fmt(p.credito_fiscal)}
                    <p className="text-xs opacity-60">{fmt(p.credito_21)} / {fmt(p.credito_105)}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    <span className={p.saldo_mes > 0 ? 'text-red-400' : p.saldo_mes < 0 ? 'text-emerald-400' : 'text-kp-gray'}>
                      {p.saldo_mes > 0 ? '+' : ''}{fmt(p.saldo_mes)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    <span className={p.saldo_acumulado > 0 ? 'text-red-300' : p.saldo_acumulado < 0 ? 'text-emerald-300' : 'text-kp-gray'}>
                      {p.saldo_acumulado > 0 ? '+' : ''}{fmt(p.saldo_acumulado)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.saldo_mes > 0 ? (
                      <span className="text-xs font-bold px-2 py-1 rounded border bg-red-950/50 text-red-300 border-red-700/50">
                        A pagar
                      </span>
                    ) : p.saldo_mes < 0 ? (
                      <span className="text-xs font-bold px-2 py-1 rounded border bg-emerald-950/50 text-emerald-300 border-emerald-700/50">
                        Saldo a favor
                      </span>
                    ) : (
                      <span className="text-xs text-kp-gray px-2 py-1 rounded border border-kp-border">Neutro</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-kp-surface2 border-t-2 border-kp-border">
            <tr>
              <td className="px-4 py-3 text-xs text-kp-gray uppercase tracking-wide font-bold">TOTAL {anio}</td>
              <td />
              <td className="px-4 py-3 text-right tabular-nums font-bold text-red-400">{fmt(ytd.debito_fiscal)}</td>
              <td />
              <td className="px-4 py-3 text-right tabular-nums font-bold text-emerald-400">{fmt(ytd.credito_fiscal)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-bold">
                <span className={ytd.saldo_neto > 0 ? 'text-red-400' : 'text-emerald-400'}>
                  {ytd.saldo_neto > 0 ? '+' : ''}{fmt(ytd.saldo_neto)}
                </span>
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Leyenda */}
      <div className="rounded-xl border border-kp-border bg-kp-surface2 px-5 py-4 text-xs text-kp-gray space-y-1.5">
        <p className="font-bold text-kp-white text-sm mb-2">¿Cómo leer esta tabla?</p>
        <p>• <span className="text-red-400 font-semibold">Débito Fiscal</span> = IVA cobrado en ventas (lo que se le debe a AFIP).</p>
        <p>• <span className="text-emerald-400 font-semibold">Crédito Fiscal</span> = IVA pagado en compras con CUIT válido (lo que AFIP le debe a la empresa).</p>
        <p>• <span className="font-semibold text-kp-white">Saldo = Débito − Crédito</span>: positivo → pagar a AFIP · negativo → acumular crédito para próximos meses.</p>
        <p>• La proyección usa el promedio de los últimos 3 meses.</p>
        <p>• Percepciones de IIBB <span className="font-semibold">no</span> forman parte del Crédito Fiscal IVA (son impuesto provincial).</p>
      </div>
    </div>
  );
}
