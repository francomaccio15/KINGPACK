"""
KINGPACK ETL — Fase 4: VALIDATE
Checks post-load: compara BD vs Excel/CSV transformados.
Genera etl/validation_report.html para auditoría con el cliente.
"""
import argparse, os, sys, html
import pandas as pd
import psycopg2
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / '.env')


def run_checks(transformed_dir: str, database_url: str):
    trans  = Path(transformed_dir)
    conn   = psycopg2.connect(database_url)
    cur    = conn.cursor()
    errors = []
    warns  = []
    ok     = []

    def check(label, condition, msg_ok, msg_fail, is_error=True):
        if condition:
            ok.append(f'{label}: {msg_ok}')
        else:
            (errors if is_error else warns).append(f'{label}: {msg_fail}')

    # 1. Counts por tabla
    tablas_csv = {
        'articulos.csv':      'articulos',
        'clientes.csv':       'clientes',
        'ventas.csv':         'ventas',
        'facturaciones.csv':  'facturaciones',
        'proveedores.csv':    'proveedores',
    }
    for csv_name, tabla in tablas_csv.items():
        f = trans / csv_name
        if not f.exists():
            continue
        n_csv = len(pd.read_csv(f))
        cur.execute(f'SELECT COUNT(*) FROM {tabla}')
        n_db = cur.fetchone()[0]
        check(
            f'COUNT {tabla}',
            n_db >= n_csv,
            f'{n_db} filas en BD ≥ {n_csv} en CSV',
            f'BD tiene {n_db} filas pero CSV tiene {n_csv} — posibles filas no cargadas'
        )

    # 2. Suma de totales en ventas
    ven_file = trans / 'ventas.csv'
    if ven_file.exists():
        df_ven = pd.read_csv(ven_file, dtype=str)
        total_col = next((c for c in df_ven.columns if 'total' in c.lower()), None)
        if total_col:
            suma_csv = pd.to_numeric(df_ven[total_col], errors='coerce').sum()
            cur.execute("SELECT COALESCE(SUM(total), 0) FROM ventas WHERE deleted_at IS NULL AND estado != 'anulada'")
            suma_db = float(cur.fetchone()[0])
            diff = abs(suma_db - suma_csv)
            check(
                'SUM ventas.total',
                diff <= 1.0,
                f'{suma_db:,.2f} ARS (diferencia ≤ 1 ARS)',
                f'Diferencia de {diff:,.2f} ARS entre BD ({suma_db:,.2f}) y CSV ({suma_csv:,.2f})'
            )

    # 3. FK huérfanas
    fk_checks = [
        ('venta_items.venta_id',       'SELECT COUNT(*) FROM venta_items vi LEFT JOIN ventas v ON v.id=vi.venta_id WHERE v.id IS NULL'),
        ('venta_items.articulo_id',    'SELECT COUNT(*) FROM venta_items vi LEFT JOIN articulos a ON a.id=vi.articulo_id WHERE a.id IS NULL'),
        ('facturaciones.venta_id',     'SELECT COUNT(*) FROM facturaciones f LEFT JOIN ventas v ON v.id=f.venta_id WHERE f.venta_id IS NOT NULL AND v.id IS NULL'),
        ('clientes.sucursal_id',       'SELECT COUNT(*) FROM clientes c LEFT JOIN sucursales s ON s.id=c.sucursal_default_id WHERE c.sucursal_default_id IS NOT NULL AND s.id IS NULL'),
        ('stock.articulo_id',          'SELECT COUNT(*) FROM stock st LEFT JOIN articulos a ON a.id=st.articulo_id WHERE a.id IS NULL'),
    ]
    for label, sql in fk_checks:
        cur.execute(sql)
        n = cur.fetchone()[0]
        check(f'FK huérfanas: {label}', n == 0, '0 huérfanas', f'{n} registros huérfanos')

    # 4. CAE duplicados
    cur.execute("SELECT COUNT(*) FROM (SELECT cae, COUNT(*) FROM facturaciones WHERE cae IS NOT NULL GROUP BY cae HAVING COUNT(*) > 1) t")
    n_dup_cae = cur.fetchone()[0]
    check('CAE duplicados', n_dup_cae == 0, '0 duplicados', f'{n_dup_cae} CAEs duplicados')

    # 5. Artículos sin lista_precio_items
    cur.execute("SELECT COUNT(*) FROM articulos a WHERE deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM lista_precio_items lpi WHERE lpi.articulo_id = a.id)")
    n_sin_lista = cur.fetchone()[0]
    check('Artículos sin lista_precio_items', n_sin_lista == 0, '0 artículos sin lista', f'{n_sin_lista} artículos sin ítems de lista', is_error=False)

    cur.close()
    conn.close()

    # Generar reporte
    _write_report(errors, warns, ok)
    if errors:
        print(f'\n[VALIDATE] ✗ {len(errors)} ERRORES CRÍTICOS — ver etl/validation_report.html')
        return False
    else:
        print(f'\n[VALIDATE] ✓ OK — {len(warns)} advertencias, {len(ok)} checks pasados')
        return True


def _write_report(errors, warns, ok):
    def rows(items, color):
        return ''.join(f'<tr style="background:{color}"><td>{html.escape(i)}</td></tr>' for i in items)

    Path('etl/validation_report.html').write_text(f'''<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>KINGPACK Validation Report</title>
<style>body{{font-family:sans-serif;padding:2rem}} table{{border-collapse:collapse;width:100%}}
td{{border:1px solid #ccc;padding:.5rem .75rem}}</style></head>
<body><h1>KINGPACK ETL — Validation Report</h1>
<p>Generado: {datetime.now():%Y-%m-%d %H:%M:%S}</p>
<h2>Errores críticos ({len(errors)})</h2>
<table>{rows(errors, "#ffe0e0") if errors else "<tr><td>Ninguno</td></tr>"}</table>
<h2>Advertencias ({len(warns)})</h2>
<table>{rows(warns, "#fff8e0") if warns else "<tr><td>Ninguna</td></tr>"}</table>
<h2>Checks OK ({len(ok)})</h2>
<table>{rows(ok, "#e8f5e9")}</table>
</body></html>''', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='KINGPACK ETL — Validate')
    parser.add_argument('--transformed', default='etl/transformed')
    parser.add_argument('--database-url', default=os.getenv('DATABASE_URL'))
    args = parser.parse_args()
    ok = run_checks(args.transformed, args.database_url)
    sys.exit(0 if ok else 1)
