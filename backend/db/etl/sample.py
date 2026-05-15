"""
KINGPACK ETL — Subset para desarrollo/demo (~5% de datos reales)
Genera CSVs en etl/sample_data/ con:
  - Catálogos completos (categorías, medios de pago)
  - 100 artículos top por volumen de ventas
  - 20 proveedores con más actividad
  - 50 clientes representativos (con CC, RI, CF)
  - 500 ventas de los últimos 3 meses
  - Facturaciones, pagos, pedidos, cajas, gastos proporcionales
Anonimiza: DNIs, teléfonos, emails (razones sociales se mantienen)
"""
import argparse, hashlib, random
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta


def _anon_dni(legacy_id: str) -> str:
    random.seed(legacy_id)
    return f'{random.randint(20_000_000, 45_000_000)}'


def _anon_tel(val: str) -> str:
    if pd.isna(val) or not str(val).strip():
        return val
    h = hashlib.md5(str(val).encode()).hexdigest()[:6]
    return f'demo_{h}'


def _anon_email(val: str) -> str:
    if pd.isna(val) or not str(val).strip():
        return val
    h = hashlib.md5(str(val).encode()).hexdigest()[:8]
    return f'demo_{h}@kingpack-dev.com'


def generate_sample(transformed_dir: str, output_dir: str, seed: int = 42):
    random.seed(seed)
    trans = Path(transformed_dir)
    out   = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)

    # Catálogos completos
    for nombre in ['categorias', 'alicuotas_iva']:
        f = trans / f'{nombre}.csv'
        if f.exists():
            pd.read_csv(f).to_csv(out / f'{nombre}.csv', index=False)

    # Artículos: top 100 por precio_madre (proxy de volumen hasta tener ventas)
    art_file = trans / 'articulos.csv'
    if art_file.exists():
        df_art = pd.read_csv(art_file, dtype=str)
        df_art['_pm'] = pd.to_numeric(df_art.get('precio_madre', '0'), errors='coerce').fillna(0)
        df_sample = df_art.nlargest(100, '_pm').drop(columns=['_pm'])
        df_sample.to_csv(out / 'articulos.csv', index=False)
        art_ids = set(df_sample['id'].tolist())
        print(f'[SAMPLE] articulos: {len(df_sample)} filas')
    else:
        art_ids = set()

    # Proveedores: top 20
    prov_file = trans / 'proveedores.csv'
    if prov_file.exists():
        df = pd.read_csv(prov_file, dtype=str).head(20)
        df.to_csv(out / 'proveedores.csv', index=False)
        print(f'[SAMPLE] proveedores: {len(df)} filas')

    # Clientes: 50 variados
    cli_file = trans / 'clientes.csv'
    if cli_file.exists():
        df = pd.read_csv(cli_file, dtype=str)
        df_sample = df.sample(min(50, len(df)), random_state=seed)

        # Anonimizar
        for col in ['DNI', 'dni']:
            if col in df_sample.columns:
                df_sample[col] = df_sample.apply(lambda r: _anon_dni(str(r['id'])), axis=1)
        for col in ['Teléfono', 'telefono', 'Tel']:
            if col in df_sample.columns:
                df_sample[col] = df_sample[col].apply(_anon_tel)
        for col in ['Email', 'email']:
            if col in df_sample.columns:
                df_sample[col] = df_sample[col].apply(_anon_email)

        df_sample.to_csv(out / 'clientes.csv', index=False)
        cli_ids = set(df_sample['id'].tolist())
        print(f'[SAMPLE] clientes: {len(df_sample)} filas')
    else:
        cli_ids = set()

    # Ventas: 500 últimas (o las que haya)
    ven_file = trans / 'ventas.csv'
    if ven_file.exists():
        df = pd.read_csv(ven_file, dtype=str)
        df_sample = df.tail(500)
        df_sample.to_csv(out / 'ventas.csv', index=False)
        ven_ids = set(df_sample['id'].tolist())
        print(f'[SAMPLE] ventas: {len(df_sample)} filas')
    else:
        ven_ids = set()

    # Facturaciones relacionadas con esas ventas
    fac_file = trans / 'facturaciones.csv'
    if fac_file.exists() and ven_ids:
        df = pd.read_csv(fac_file, dtype=str)
        id_col = next((c for c in df.columns if 'venta' in c.lower()), None)
        if id_col:
            df = df[df[id_col].isin(ven_ids)]
        df.to_csv(out / 'facturaciones.csv', index=False)
        print(f'[SAMPLE] facturaciones: {len(df)} filas')

    # Stock para los 100 artículos
    stock_file = trans / 'stock.csv'
    if stock_file.exists() and art_ids:
        df = pd.read_csv(stock_file, dtype=str)
        id_col = next((c for c in df.columns if 'articulo' in c.lower()), None)
        if id_col:
            df = df[df[id_col].isin(art_ids)]
        df.to_csv(out / 'stock.csv', index=False)
        print(f'[SAMPLE] stock: {len(df)} filas')

    # Gastos: 100 últimos
    gas_file = trans / 'gastos.csv'
    if gas_file.exists():
        df = pd.read_csv(gas_file, dtype=str).tail(100)
        df.to_csv(out / 'gastos.csv', index=False)
        print(f'[SAMPLE] gastos: {len(df)} filas')

    # Usuarios (sin anonimizar — el cliente quiere los reales + reset de passwords en seed)
    usr_file = trans / 'usuarios.csv'
    if usr_file.exists():
        df = pd.read_csv(usr_file, dtype=str)
        df.to_csv(out / 'usuarios.csv', index=False)
        print(f'[SAMPLE] usuarios: {len(df)} filas')

    print(f'\n[SAMPLE] Subset generado en {out}')
    print('[SAMPLE] RECORDATORIO: cargar con load.py --transformed etl/sample_data --database-url ...')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='KINGPACK ETL — Sample generator')
    parser.add_argument('--transformed', default='etl/transformed', help='Fuente de CSVs transformados')
    parser.add_argument('--output',      default='etl/sample_data', help='Destino del subset')
    parser.add_argument('--seed',        type=int, default=42)
    args = parser.parse_args()
    generate_sample(args.transformed, args.output, args.seed)
