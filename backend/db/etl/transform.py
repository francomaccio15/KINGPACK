"""
KINGPACK ETL — Fase 2: TRANSFORM
Lee CSVs de etl/raw/, normaliza y genera etl/transformed/ listos para load.
Incluye:
  - costo_base / costo_flete separados
  - precio_madre calculado
  - 4 ítems de lista_precio_items por artículo
  - reasignación de clientes con sucursal "Matias" → Laprida
  - normalización de Consumidor Final
  - reporte de inconsistencias en etl/report.html
"""
import argparse, os, re, uuid, html
import pandas as pd
from pathlib import Path
from datetime import datetime

# Normalización de "Consumidor Final" (variantes con puntos/espacios)
CF_PATTERN = re.compile(r'consumidor\s*final\.?\.?', re.IGNORECASE)

# Porcentajes de descuento por tipo de lista (placeholder 0% hasta que cliente los defina)
DESCUENTOS_LISTA = {
    'madre':           0,
    'publica':         0,
    'revendedor':      0,
    'cuenta_corriente':0,
}


def _normalizar_cf(valor):
    if pd.isna(valor):
        return valor
    if CF_PATTERN.match(str(valor).strip()):
        return 'Consumidor Final'
    return valor


def _calcular_precio_madre(costo_base, costo_flete, iva_pct, margen_pct):
    try:
        ct = float(costo_base or 0) + float(costo_flete or 0)
        pm = ct * (1 + float(margen_pct or 0) / 100) * (1 + float(iva_pct or 21) / 100)
        return round(pm, 2)
    except Exception:
        return 0.0


def transform(raw_dir: str, output_dir: str, margen_default: float = 30.0, iva_default: float = 21.0):
    raw  = Path(raw_dir)
    out  = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    issues = []

    # ── Artículos ──────────────────────────────────────────────────────────────
    art_file = raw / 'articulos.csv'
    if art_file.exists():
        df = pd.read_csv(art_file, dtype=str)
        df.columns = df.columns.str.strip()

        # Mapear columnas según lo que exista en el Excel
        col_map = {
            'Código':    'codigo',
            'Nombre':    'nombre',
            'Categoría': 'categoria_nombre',
            'Costo':     'costo_base',
            'Flete':     'costo_flete',       # puede no existir
            'Transporte':'costo_flete',        # alias alternativo
            'Precio':    'precio_legacy',
            'Precio Licitaciones': 'precio_licitaciones',
            'IVA':       'iva_pct',
            'Margen':    'margen_pct',
            'Activo':    'activo',
        }
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

        if 'costo_flete' not in df.columns:
            df['costo_flete'] = '0'
            issues.append({'tabla': 'articulos', 'msg': 'Columna flete no encontrada → costo_flete=0. Revisar con el cliente.'})

        df['costo_base']  = pd.to_numeric(df.get('costo_base',  '0'), errors='coerce').fillna(0)
        df['costo_flete'] = pd.to_numeric(df.get('costo_flete', '0'), errors='coerce').fillna(0)
        df['margen_pct']  = pd.to_numeric(df.get('margen_pct',  str(margen_default)), errors='coerce').fillna(margen_default)
        df['iva_pct']     = pd.to_numeric(df.get('iva_pct',     str(iva_default)),    errors='coerce').fillna(iva_default)

        df['precio_madre'] = df.apply(
            lambda r: _calcular_precio_madre(r['costo_base'], r['costo_flete'], r['iva_pct'], r['margen_pct']),
            axis=1
        )

        # Generar UUID nuevo para cada artículo y guardar mapping legacy_id → uuid
        df['legacy_id'] = df.get('codigo', df.index.astype(str))
        df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]

        df['nombre'] = df.get('nombre', pd.Series(dtype=str)).str.strip()
        df['codigo'] = df.get('codigo', pd.Series(dtype=str)).str.strip()

        df.to_csv(out / 'articulos.csv', index=False)

        # Generar lista_precio_items para las 4 listas (placeholder, lista IDs se resuelven en load)
        lpi_rows = []
        for _, row in df.iterrows():
            for tipo, desc_pct in DESCUENTOS_LISTA.items():
                precio_ef = round(float(row['precio_madre']) * (1 - desc_pct / 100), 2)
                lpi_rows.append({
                    'articulo_id':      row['id'],
                    'lista_tipo':       tipo,             # load.py resuelve a lista_id
                    'metodo':           'descuento_sobre_madre',
                    'descuento_pct':    desc_pct,
                    'precio_efectivo':  precio_ef,
                })
        pd.DataFrame(lpi_rows).to_csv(out / 'lista_precio_items.csv', index=False)
        print(f'[TRANSFORM] articulos: {len(df)} filas → {len(lpi_rows)} lista_precio_items generados')

    # ── Clientes ───────────────────────────────────────────────────────────────
    cli_file = raw / 'clientes.csv'
    if cli_file.exists():
        df = pd.read_csv(cli_file, dtype=str)
        df.columns = df.columns.str.strip()

        # Normalizar Consumidor Final
        if 'Razón Social' in df.columns:
            df['Razón Social'] = df['Razón Social'].apply(_normalizar_cf)
        elif 'Nombre' in df.columns:
            df['Nombre'] = df['Nombre'].apply(_normalizar_cf)

        # Reasignar clientes con sucursal "Matias"
        suc_col = next((c for c in df.columns if 'sucursal' in c.lower()), None)
        if suc_col:
            mask_matias = df[suc_col].str.strip().str.lower() == 'matias'
            n_matias = mask_matias.sum()
            if n_matias > 0:
                df['legacy_sucursal_excel'] = df[suc_col]
                df.loc[mask_matias, suc_col] = 'Laprida'
                issues.append({'tabla': 'clientes', 'msg': f'{n_matias} clientes con sucursal "Matias" reasignados a Laprida. legacy_sucursal_excel conservado.'})

        df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]
        df.to_csv(out / 'clientes.csv', index=False)
        print(f'[TRANSFORM] clientes: {len(df)} filas')

    # ── Ventas ─────────────────────────────────────────────────────────────────
    ven_file = raw / 'ventas.csv'
    if ven_file.exists():
        df = pd.read_csv(ven_file, dtype=str)
        df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]
        df.to_csv(out / 'ventas.csv', index=False)
        print(f'[TRANSFORM] ventas: {len(df)} filas')

    # ── Proveedores ────────────────────────────────────────────────────────────
    for nombre_csv in ['proveedores', 'facturaciones', 'stock', 'gastos', 'pedidos',
                       'correcciones_saldo', 'usuarios', 'empleados', 'categorias']:
        f = raw / f'{nombre_csv}.csv'
        if f.exists():
            df = pd.read_csv(f, dtype=str)
            df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]
            df.to_csv(out / f'{nombre_csv}.csv', index=False)
            print(f'[TRANSFORM] {nombre_csv}: {len(df)} filas')

    # ── Reporte HTML ────────────────────────────────────────────────────────────
    _write_report(issues, out / 'report.html')
    print(f'[TRANSFORM] Reporte generado en {out}/report.html')


def _write_report(issues, path):
    rows = ''.join(
        f'<tr><td>{html.escape(i["tabla"])}</td><td>{html.escape(i["msg"])}</td></tr>'
        for i in issues
    )
    status = 'verde — sin problemas críticos' if not issues else f'amarillo — {len(issues)} advertencias'
    Path(path).write_text(f'''<!DOCTYPE html><html><head><meta charset="utf-8">
<title>KINGPACK ETL Report {datetime.now():%Y-%m-%d %H:%M}</title>
<style>body{{font-family:sans-serif;padding:2rem}} table{{border-collapse:collapse;width:100%}}
td,th{{border:1px solid #ccc;padding:.5rem .75rem}} th{{background:#f0f0f0}}</style></head>
<body><h1>KINGPACK ETL — Reporte de transformación</h1>
<p>Estado: <strong>{status}</strong></p>
<p>Generado: {datetime.now():%Y-%m-%d %H:%M:%S}</p>
<table><thead><tr><th>Tabla</th><th>Mensaje</th></tr></thead>
<tbody>{rows if rows else "<tr><td colspan=2>Sin advertencias</td></tr>"}</tbody>
</table></body></html>''', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='KINGPACK ETL — Transform')
    parser.add_argument('--raw',    default='etl/raw',         help='Directorio CSVs raw')
    parser.add_argument('--output', default='etl/transformed', help='Directorio de salida')
    parser.add_argument('--margen', type=float, default=30.0,  help='Margen default %')
    parser.add_argument('--iva',    type=float, default=21.0,  help='IVA default %')
    args = parser.parse_args()
    transform(args.raw, args.output, args.margen, args.iva)
