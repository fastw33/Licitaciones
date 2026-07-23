const { config, getAleacionesPool } = require("./db");
const { listMaterials, saveLiquidationIfChanged } = require("./aleacionesService");
const { getExchangeRate } = require("./ratesService");

const DEFAULT_INTERVAL_MINUTES = 30;
let timer = null;
let running = false;

function safeDbName(value) {
  const name = String(value || "").trim();
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("Nombre de base de datos LME invalido");
  }
  return "`" + name + "`";
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function getLatestLmePricesByKey() {
  const pool = getAleacionesPool();
  const lmeDb = safeDbName(config.lmeDatabase);
  const [rows] = await pool.query(
    `SELECT metal_key, price, variation_percent, data_timestamp, scraped_at
       FROM (
         SELECT m.metal_key,
                p.price,
                p.variation_percent,
                p.data_timestamp,
                p.scraped_at,
                ROW_NUMBER() OVER (
                  PARTITION BY m.metal_key
                  ORDER BY p.scraped_at DESC, p.price_id DESC
                ) AS rn
           FROM ${lmeDb}.lme_scraped_prices p
           INNER JOIN ${lmeDb}.lme_metals m ON m.metal_id = p.metal_id
          WHERE p.status = 'ok'
            AND p.price IS NOT NULL
       ) latest
      WHERE rn = 1`
  );

  return new Map(rows.map((row) => [row.metal_key, row]));
}

function hydrateComponentsWithLme(components, lmePrices) {
  return components.map((component) => {
    const latest = component.lmeMetalKey ? lmePrices.get(component.lmeMetalKey) : null;
    return {
      ...component,
      lmeUsdT: latest?.price ? toNumber(latest.price) : toNumber(component.lmeUsdT)
    };
  });
}

async function runAutoPriceUpdate({ refreshRates = true } = {}) {
  if (running) {
    return {
      running: true,
      saved: 0,
      skipped: 0,
      errors: 0,
      items: []
    };
  }

  running = true;
  try {
    const [rates, materials, lmePrices] = await Promise.all([
      getExchangeRate({ refresh: refreshRates }),
      listMaterials({ includeInactive: false }),
      getLatestLmePricesByKey()
    ]);

    const items = [];
    let saved = 0;
    let skipped = 0;
    let errors = 0;

    for (const material of materials) {
      try {
        const result = await saveLiquidationIfChanged({
          materialId: material.id,
          materialName: material.name,
          conversionMode: material.conversionMode,
          weightKg: material.defaultWeightKg || 1,
          clientPaymentPct: material.defaultClientPaymentPct || 0.925,
          rates,
          components: hydrateComponentsWithLme(material.components, lmePrices),
          calculationOrigin: "auto",
          notes: "Actualizacion automatica por cambio de tasas o precios LME."
        });

        if (result.saved) {
          saved += 1;
        } else {
          skipped += 1;
        }

        items.push({
          materialId: material.id,
          materialName: material.name,
          saved: result.saved,
          reason: result.reason,
          resultId: result.result?.id || null
        });
      } catch (error) {
        errors += 1;
        items.push({
          materialId: material.id,
          materialName: material.name,
          saved: false,
          reason: error.message
        });
      }
    }

    return {
      running: false,
      saved,
      skipped,
      errors,
      rates,
      lmePrices: lmePrices.size,
      items
    };
  } finally {
    running = false;
  }
}

function getAutoUpdateIntervalMs() {
  const minutes = toNumber(process.env.ALEACIONES_AUTO_UPDATE_MINUTES, DEFAULT_INTERVAL_MINUTES);
  return Math.max(minutes, 1) * 60 * 1000;
}

function startAutoPriceUpdater() {
  if (process.env.ALEACIONES_AUTO_UPDATE_ENABLED === "0" || timer) {
    return null;
  }

  const intervalMs = getAutoUpdateIntervalMs();
  const execute = async () => {
    try {
      const result = await runAutoPriceUpdate({ refreshRates: true });
      if (result.saved || result.errors) {
        console.log(
          `Aleaciones auto-update: ${result.saved} guardada(s), ${result.skipped} sin cambios, ${result.errors} error(es).`
        );
      }
    } catch (error) {
      console.error("Aleaciones auto-update fallo:", error.message);
    }
  };

  timer = setInterval(execute, intervalMs);
  setTimeout(execute, 10_000);
  return timer;
}

function stopAutoPriceUpdater() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  getLatestLmePricesByKey,
  runAutoPriceUpdate,
  startAutoPriceUpdater,
  stopAutoPriceUpdater
};
