# Modulo de aleaciones

Endpoints base: `/api/aleaciones`

## Tasas

- `GET /tasas/latest`: devuelve la ultima tasa guardada o consulta una nueva si no existe.
- `GET /tasas/latest?refresh=1`: fuerza consulta nueva.
- `POST /tasas`: guarda tasas manuales.
- `POST /actualizar-precios`: recalcula materiales activos y guarda solo si cambian tasas o LME.

Las tasas se consultan una vez por dia desde fuentes oficiales:

- `USD->COP`: TRM oficial publicada por Superintendencia Financiera en Datos Abiertos Colombia.
- `EUR/USD`: referencia diaria del Banco Central Europeo (ECB).
- `EUR/COP`: serie diaria `Euro - COP/EUR - Tasa media` publicada por Banco de la Republica, fuente Refinitiv.

El sistema guarda tambien `USD->EUR`, derivado de `EUR/USD`.

El material define la ruta de conversion:

- `usd_eur_cop`: LME en USD, convierte a EUR y luego a COP.
- `usd_cop`: LME en USD directo a COP.

El backend ejecuta un actualizador automatico cada `ALEACIONES_AUTO_UPDATE_MINUTES`
minutos. En cada ciclo consulta tasas, lee el ultimo LME guardado en
`LME_DB_NAME`, recalcula los materiales activos y guarda un resultado nuevo
solo cuando cambia la firma de insumos.

## Materiales

- `GET /materiales`
- `POST /materiales`
- `GET /materiales/:id`
- `PUT /materiales/:id`
- `PATCH /materiales/:id/estado`

Ejemplo:

```json
{
  "name": "Bronce ejemplo",
  "code": "BR-001",
  "conversionMode": "usd_eur_cop",
  "defaultWeightKg": 1,
  "defaultClientPaymentPct": 0.925,
  "components": [
    { "metalName": "Cobre", "symbol": "Cu", "spectPct": 88.87, "paidPct": 100, "lmeUsdT": 13598.5 },
    { "metalName": "Estano", "symbol": "Sn", "spectPct": 5.78, "paidPct": 100, "lmeUsdT": 53156 },
    { "metalName": "Plomo", "symbol": "Pb", "spectPct": 4.92, "paidPct": 0, "lmeUsdT": 1872.5 }
  ]
}
```

## Liquidacion

- `POST /liquidar`: calcula y guarda el resultado.
- `GET /resultados`: lista ultimos resultados.
- `GET /resultados/:id`: obtiene resultado con detalle por metal.

Ejemplo usando tasas automaticas:

```json
{
  "materialId": 1,
  "weightKg": 1,
  "clientPaymentPct": 92.5
}
```

Ejemplo libre, sin material guardado:

```json
{
  "materialName": "Liquidacion manual",
  "weightKg": 1,
  "clientPaymentPct": 0.925,
  "conversionMode": "usd_cop",
  "rates": { "eurUsd": 1.14, "eurCop": 3688.2 },
  "components": [
    { "metalName": "Cobre", "symbol": "Cu", "spectPct": 0.8887, "paidPct": 1, "lmeUsdT": 13598.5 }
  ]
}
```
