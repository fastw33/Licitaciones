const crypto = require("crypto");
const { getAleacionesPool } = require("./db");
const { normalizeRates } = require("./calculator");

const DEFAULT_TRM_URL =
  "https://www.datos.gov.co/resource/32sa-8pi3.json?%24limit=1&%24order=vigenciadesde%20DESC";
const TRM_URL =
  process.env.ALEACIONES_TRM_URL ||
  DEFAULT_TRM_URL;
const ECB_URL =
  process.env.ALEACIONES_ECB_URL ||
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const BANREP_EUR_COP_URL =
  process.env.ALEACIONES_BANREP_EUR_COP_URL ||
  "https://suameca.banrep.gov.co/estadisticas-economicas-back/rest/estadisticaEconomicaRestService/consultaInformacionSerieXTipoDato?idSerie=30&tipoDato=0&cantDatos=1";
const EXCHANGE_RATE_SOURCE =
  process.env.ALEACIONES_EXCHANGE_RATE_SOURCE ||
  "Superfinanciera/Datos.gov.co + Banco de la Republica/Refinitiv + ECB";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function mapRateRow(row) {
  if (!row) {
    return null;
  }
  const rates = normalizeRates({
    usdToCop: row.usd_to_cop,
    usdToEur: row.usd_to_eur,
    eurUsd: row.eur_usd,
    eurCop: row.eur_cop
  });

  return {
    id: row.id,
    rateDate: row.rate_date,
    ...rates,
    source: row.source,
    rateSignature: row.rate_signature || "",
    fetchedAt: row.fetched_at
  };
}

function createRateSignature(rate) {
  const snapshot = {
    rateDate: rate.rateDate || todayIsoDate(),
    usdToCop: rate.usdToCop,
    usdToEur: rate.usdToEur,
    eurUsd: rate.eurUsd,
    eurCop: rate.eurCop,
    source: rate.source || EXCHANGE_RATE_SOURCE
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
}

async function getLatestStoredRate() {
  const pool = getAleacionesPool();
  const [rows] = await pool.query(
    `SELECT *
       FROM alloy_exchange_rates
      WHERE source = ?
      ORDER BY rate_date DESC, fetched_at DESC, id DESC
      LIMIT 1`,
    [EXCHANGE_RATE_SOURCE]
  );
  return mapRateRow(rows[0]);
}

async function getTodayStoredRate() {
  const pool = getAleacionesPool();
  const [rows] = await pool.query(
    `SELECT *
       FROM alloy_exchange_rates
      WHERE DATE(fetched_at) = CURDATE()
        AND source = ?
      ORDER BY fetched_at DESC, id DESC
      LIMIT 1`,
    [EXCHANGE_RATE_SOURCE]
  );
  return mapRateRow(rows[0]);
}

async function saveExchangeRate(rate, rawPayload = null) {
  const pool = getAleacionesPool();
  const payload = rawPayload ? JSON.stringify(rawPayload) : null;
  const source = rate.source || EXCHANGE_RATE_SOURCE;
  const rateDate = rate.rateDate || todayIsoDate();
  const rateSignature = createRateSignature({ ...rate, source, rateDate });
  const [result] = await pool.execute(
    `INSERT INTO alloy_exchange_rates
       (rate_date, usd_to_cop, usd_to_eur, eur_usd, eur_cop,
        source, rate_signature, fetched_at, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)
     ON DUPLICATE KEY UPDATE
       fetched_at = VALUES(fetched_at),
       raw_payload = VALUES(raw_payload)`,
    [
      rateDate,
      rate.usdToCop,
      rate.usdToEur,
      rate.eurUsd,
      rate.eurCop,
      source,
      rateSignature,
      payload
    ]
  );

  return {
    id: result.insertId || null,
    ...rate,
    rateDate,
    source,
    rateSignature
  };
}

async function fetchJson(url, label) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No fue posible consultar ${label}: HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchText(url, label) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`No fue posible consultar ${label}: HTTP ${response.status}`);
  }

  return response.text();
}

function parseDate(value) {
  if (!value) {
    return todayIsoDate();
  }

  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/");
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? todayIsoDate() : parsed.toISOString().slice(0, 10);
}

async function fetchUsdCopFromSuperfinanciera() {
  let data;
  try {
    data = await fetchJson(TRM_URL, "TRM oficial USD/COP");
  } catch (error) {
    if (TRM_URL !== DEFAULT_TRM_URL && /HTTP 400/.test(error.message)) {
      data = await fetchJson(DEFAULT_TRM_URL, "TRM oficial USD/COP");
    } else {
      throw error;
    }
  }
  const row = Array.isArray(data) ? data[0] : data;
  const usdToCop = Number(row?.valor);

  if (!Number.isFinite(usdToCop) || usdToCop <= 0) {
    throw new Error("La TRM oficial no retorno un valor USD/COP valido");
  }

  return {
    usdToCop,
    rateDate: parseDate(row?.vigenciadesde),
    raw: data
  };
}

async function fetchEurUsdFromEcb() {
  const xml = await fetchText(ECB_URL, "referencia oficial EUR/USD del ECB");
  const usdMatch = xml.match(/currency=['"]USD['"]\s+rate=['"]([0-9.]+)['"]/i);
  const dateMatch = xml.match(/<Cube\s+time=['"]([0-9-]+)['"]/i);
  const eurUsd = Number(usdMatch?.[1]);

  if (!Number.isFinite(eurUsd) || eurUsd <= 0) {
    throw new Error("El ECB no retorno un valor EUR/USD valido");
  }

  return {
    eurUsd,
    rateDate: dateMatch?.[1] || todayIsoDate(),
    raw: xml
  };
}

async function fetchEurCopFromBanrep() {
  const data = await fetchJson(BANREP_EUR_COP_URL, "EUR/COP Banco de la Republica");
  const row = Array.isArray(data) ? data[0] : data;
  const eurCop = Number(row?.valor);

  if (!Number.isFinite(eurCop) || eurCop <= 0) {
    throw new Error("Banco de la Republica no retorno un valor EUR/COP valido");
  }

  return {
    eurCop,
    rateDate: parseDate(row?.fecha),
    raw: data
  };
}

async function fetchExchangeRate() {
  const [trm, ecb, banrepEurCop] = await Promise.all([
    fetchUsdCopFromSuperfinanciera(),
    fetchEurUsdFromEcb(),
    fetchEurCopFromBanrep()
  ]);

  const normalized = normalizeRates({
    usdToCop: trm.usdToCop,
    eurUsd: ecb.eurUsd,
    eurCop: banrepEurCop.eurCop
  });

  return saveExchangeRate(
    {
      rateDate: banrepEurCop.rateDate || trm.rateDate,
      ...normalized,
      source: EXCHANGE_RATE_SOURCE
    },
    {
      trm: trm.raw,
      ecb: {
        rateDate: ecb.rateDate,
        eurUsd: ecb.eurUsd
      },
      banrepEurCop: {
        rateDate: banrepEurCop.rateDate,
        eurCop: banrepEurCop.eurCop
      }
    }
  );
}

async function getExchangeRate({ refresh = false } = {}) {
  if (refresh) {
    return fetchExchangeRate();
  }

  const today = await getTodayStoredRate();
  if (today) {
    return today;
  }

  try {
    return await fetchExchangeRate();
  } catch (error) {
    const latest = await getLatestStoredRate();
    if (latest) {
      return { ...latest, stale: true, warning: error.message };
    }
    throw error;
  }
}

module.exports = {
  fetchExchangeRate,
  getExchangeRate,
  getLatestStoredRate,
  getTodayStoredRate,
  saveExchangeRate
};
