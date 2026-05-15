# KINGPACK ETL Pipeline

## Requisitos
```bash
pip install -r backend/db/etl/requirements.txt
```

## Pipeline completo (Día D)
```bash
# 1. Extract: vuelca hojas del Excel a CSVs crudos
python backend/db/etl/extract_excel.py --excel "C:\Users\ivanm\Downloads\KingPack.xlsx" --output etl/raw

# 2. Transform: normaliza, calcula precio_madre, genera lista_precio_items
python backend/db/etl/transform.py --raw etl/raw --output etl/transformed

# 3. Load: inserta en BD (transacción única — rollback completo si falla)
python backend/db/etl/load.py --transformed etl/transformed --database-url $DATABASE_URL

# 4. Validate: checks integridad + genera validation_report.html
python backend/db/etl/validate.py --transformed etl/transformed --database-url $DATABASE_URL
```

## Subset para desarrollo (~5% datos reales)
```bash
# Genera subset (después de correr extract + transform)
python backend/db/etl/sample.py --transformed etl/transformed --output etl/sample_data

# Carga el subset en la BD dev
python backend/db/etl/load.py --transformed etl/sample_data --database-url $DATABASE_URL_DEV
```

## Pendientes antes del Día D
- Confirmar hojas `Hoja 17` y `Hoja 20` del Excel con el cliente
- Verificar si existe columna de flete en la hoja de artículos
- Definir % de descuento de cada lista de precios con el cliente
