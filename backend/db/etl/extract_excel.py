"""
KINGPACK ETL — Fase 1: EXTRACT
Lee KingPack.xlsx y vuelca cada hoja relevante a CSV en etl/raw/.
"""
import argparse, os, sys
import pandas as pd
from pathlib import Path

# Hojas descartadas (confirmado con usuario: son copias/basura del Excel legacy)
HOJAS_IGNORADAS = {
    'Copia de Articulos',
    'Copia de Articulo carrito12-3',
    'Copia de Articulos 1',
    'Copia de Correcion saldos clien',
    # Hoja 17 y Hoja 20: pendiente confirmar con cliente
}

# Mapeo de hojas a nombre semántico para el pipeline
HOJA_MAP = {
    'Articulos':         'articulos',
    'Clientes datos':    'clientes',
    'Ventas':            'ventas',
    'Facturaciones':     'facturaciones',
    'Proveedores':       'proveedores',
    'Categorias':        'categorias',
    'Stock':             'stock',
    'Gastos':            'gastos',
    'Caja':              'caja',
    'Pedidos':           'pedidos',
    'Corrección saldos': 'correcciones_saldo',
    'Usuarios':          'usuarios',
    'Empleados':         'empleados',
}


def extract(excel_path: str, output_dir: str):
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    print(f'[EXTRACT] Leyendo {excel_path} ...')
    xls = pd.ExcelFile(excel_path, engine='openpyxl')
    hojas = xls.sheet_names
    print(f'[EXTRACT] {len(hojas)} hojas encontradas: {hojas}')

    report = []
    for hoja in hojas:
        if hoja in HOJAS_IGNORADAS:
            print(f'  [skip]  {hoja} — ignorada')
            continue

        try:
            df = pd.read_excel(xls, sheet_name=hoja, dtype=str)
            df.columns = [str(c).strip() for c in df.columns]
            nombre_csv = HOJA_MAP.get(hoja, hoja.lower().replace(' ', '_'))
            out_file = output_path / f'{nombre_csv}.csv'
            df.to_csv(out_file, index=False, encoding='utf-8')
            print(f'  [ok]    {hoja} → {out_file.name} ({len(df)} filas)')
            report.append({'hoja': hoja, 'archivo': str(out_file), 'filas': len(df)})
        except Exception as e:
            print(f'  [ERROR] {hoja}: {e}', file=sys.stderr)
            report.append({'hoja': hoja, 'archivo': None, 'filas': 0, 'error': str(e)})

    # Resumen
    total = sum(r['filas'] for r in report)
    print(f'\n[EXTRACT] Total filas extraídas: {total:,}')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='KINGPACK ETL — Extract')
    parser.add_argument('--excel',  required=True,  help='Ruta al KingPack.xlsx')
    parser.add_argument('--output', default='etl/raw', help='Directorio de salida CSV')
    args = parser.parse_args()
    extract(args.excel, args.output)
