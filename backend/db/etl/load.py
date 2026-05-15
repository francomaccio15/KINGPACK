"""
KINGPACK ETL — Fase 3: LOAD
Carga los CSVs transformados a la BD PostgreSQL.
Todo en una única transacción: si algo falla, rollback completo.
"""
import argparse, os, sys
import pandas as pd
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / '.env')

# Orden de carga respeta FKs
LOAD_ORDER = [
    'categorias',
    'alicuotas_iva',      # ya seedeado — se salta si no hay CSV
    'proveedores',
    'articulos',
    'lista_precio_items',
    'clientes',
    'stock',
    'pedidos',
    'ventas',
    'facturaciones',
    'correcciones_saldo',
    'gastos',
]

# Mapeo CSV → tabla en BD
TABLA_MAP = {
    'categorias':        'categorias',
    'proveedores':       'proveedores',
    'articulos':         'articulos',
    'lista_precio_items':'lista_precio_items',
    'clientes':          'clientes',
    'stock':             'stock',
    'pedidos':           'pedidos_compra',
    'ventas':            'ventas',
    'facturaciones':     'facturaciones',
    'correcciones_saldo':'correcciones_saldo_cliente',
    'gastos':            'gastos',
}

# Columnas a excluir del INSERT (las que no existen en la BD o son auto-generadas)
EXCLUIR_COLS = {'index', 'legacy_iva', 'precio_legacy'}


def load(transformed_dir: str, database_url: str, dry_run: bool = False):
    trans = Path(transformed_dir)
    conn  = psycopg2.connect(database_url)

    try:
        with conn:
            cur = conn.cursor()

            # Resolver UUIDs de listas_precios (necesario para lista_precio_items)
            cur.execute("SELECT id, tipo FROM listas_precios WHERE activo = TRUE")
            listas_map = {row[1]: row[0] for row in cur.fetchall()}

            for nombre in LOAD_ORDER:
                csv_file = trans / f'{nombre}.csv'
                if not csv_file.exists():
                    print(f'  [skip]  {nombre}.csv — no encontrado')
                    continue

                df = pd.read_csv(csv_file, dtype=str)
                tabla = TABLA_MAP.get(nombre, nombre)

                # Resolver lista_tipo → lista_id para lista_precio_items
                if nombre == 'lista_precio_items' and 'lista_tipo' in df.columns:
                    df['lista_id'] = df['lista_tipo'].map(listas_map)
                    df = df.drop(columns=['lista_tipo'])

                cols = [c for c in df.columns if c not in EXCLUIR_COLS]
                df   = df[cols].where(pd.notna(df[cols]), None)

                if dry_run:
                    print(f'  [dry]   {tabla}: {len(df)} filas (no se insertan)')
                    continue

                # COPY para tablas grandes (>1000 filas), INSERT para chicas
                if len(df) > 1000:
                    import io
                    buf = io.StringIO()
                    df.to_csv(buf, index=False, header=False, na_rep='\\N')
                    buf.seek(0)
                    cur.copy_expert(
                        f"COPY {tabla} ({','.join(cols)}) FROM STDIN WITH CSV NULL '\\N'",
                        buf
                    )
                else:
                    placeholders = ','.join(['%s'] * len(cols))
                    sql = f"INSERT INTO {tabla} ({','.join(cols)}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
                    for _, row in df.iterrows():
                        cur.execute(sql, [row[c] for c in cols])

                print(f'  [ok]    {tabla}: {len(df)} filas cargadas')

        print('\n[LOAD] Transacción confirmada (COMMIT).')

    except Exception as e:
        conn.rollback()
        print(f'\n[LOAD] ERROR — ROLLBACK completo: {e}', file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='KINGPACK ETL — Load')
    parser.add_argument('--transformed', default='etl/transformed', help='Directorio CSVs transformados')
    parser.add_argument('--database-url', default=os.getenv('DATABASE_URL'), help='PostgreSQL URL')
    parser.add_argument('--dry-run', action='store_true', help='Solo mostrar, no insertar')
    args = parser.parse_args()

    if not args.database_url:
        print('ERROR: DATABASE_URL no definida', file=sys.stderr)
        sys.exit(1)

    load(args.transformed, args.database_url, args.dry_run)
