const fs = require("fs/promises");
const path = require("path");

const METALS_DEV_URL = "https://api.metals.dev/v1/latest";
const CACHE_DIR = path.join(__dirname, "..", "..", "data");
const CACHE_FILE = path.join(CACHE_DIR, "lme-cache.json");
const ENV_FILE = path.join(__dirname, "..", "..", ".env");
const TIME_ZONE = "America/Bogota";
const DAILY_QUERY_LIMIT = 2;
const AUTO_REFRESH_HOUR = 10;
const AUTO_REFRESH_MINUTE = 30;
const TROY_OUNCES_PER_METRIC_TON = 32150.746568627;

const LME_FIELDS = [
  { key: "lme_aluminum", label: "Aluminio LME" },
  { key: "lme_copper", label: "Cobre LME" },
  { key: "lme_lead", label: "Plomo LME" },
  { key: "lme_nickel", label: "Níquel LME" },
  { key: "lme_zinc", label: "Zinc LME" }
];

let lock = Promise.resolve();

function runLocked(task) {
  const next = lock.then(task, task);
  lock = next.catch(() => {});
  return next;
}

function getBogotaDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getBogotaTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    hour: Number(values.hour),
    minute: Number(values.minute)
  };
}

function canAutoRefreshNow(date = new Date()) {
  const { hour, minute } = getBogotaTimeParts(date);
  return hour > AUTO_REFRESH_HOUR ||
    (hour === AUTO_REFRESH_HOUR && minute >= AUTO_REFRESH_MINUTE);
}

function createEmptyCache(dayKey = getBogotaDay()) {
  return {
    dayKey,
    callsToday: 0,
    lastSuccess: null
  };
}

async function readCache() {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const cache = JSON.parse(raw);
    return {
      ...createEmptyCache(),
      ...cache,
      callsToday: Number.isFinite(Number(cache.callsToday))
        ? Number(cache.callsToday)
        : 0
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return createEmptyCache();
    }
    throw error;
  }
}

async function writeCache(cache) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
}

async function getMetalsDevApiKey() {
  if (process.env.METALS_DEV_API_KEY) {
    return process.env.METALS_DEV_API_KEY;
  }

  try {
    const raw = await fs.readFile(ENV_FILE, "utf8");
    const line = raw
      .split(/\r?\n/)
      .find(item => item.trim().startsWith("METALS_DEV_API_KEY="));

    if (!line) {
      return "";
    }

    const value = line.slice(line.indexOf("=") + 1).trim();
    const unquoted = value.replace(/^['"]|['"]$/g, "");
    if (unquoted) {
      process.env.METALS_DEV_API_KEY = unquoted;
    }
    return unquoted;
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function normalizeCacheDay(cache) {
  const today = getBogotaDay();
  if (cache.dayKey === today) {
    return cache;
  }

  return {
    ...cache,
    dayKey: today,
    callsToday: 0
  };
}

function normalizePriceByUnit(value, unit) {
  if (unit === "mt") {
    return value;
  }

  if (unit === "toz") {
    return value * TROY_OUNCES_PER_METRIC_TON;
  }

  throw new Error(`Unidad no soportada por el modulo LME: ${unit || "sin unidad"}.`);
}

function parseRates(data) {
  const safeRates = data.rates || data.metals || {};
  const unit = data.unit || "mt";
  const metals = LME_FIELDS.map(field => {
    const rawValue = Number(safeRates[field.key]);
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      throw new Error(`La respuesta de Metals.Dev no incluyo ${field.key}.`);
    }

    return {
      key: field.key,
      label: field.label,
      price: normalizePriceByUnit(rawValue, unit)
    };
  });

  return metals;
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    throw new Error("La respuesta de Metals.Dev no incluyo timestamp.");
  }

  if (typeof value === "number") {
    const milliseconds = value < 1000000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    if (Number.isNaN(date.getTime())) {
      throw new Error("El timestamp de Metals.Dev no es valido.");
    }
    return date.toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("El timestamp de Metals.Dev no es valido.");
  }

  return parsed.toISOString();
}

function hasValidLastSuccess(lastSuccess) {
  return Boolean(
    lastSuccess &&
    Array.isArray(lastSuccess.metals) &&
    lastSuccess.metals.length === LME_FIELDS.length &&
    lastSuccess.marketTimestamp &&
    lastSuccess.fetchedAt
  );
}

function buildPayload(cache, options = {}) {
  const lastSuccess = hasValidLastSuccess(cache.lastSuccess)
    ? cache.lastSuccess
    : null;
  return {
    metals: lastSuccess ? lastSuccess.metals : [],
    source: "Metals.Dev — referencia LME",
    priceBasis:
      "Valor entregado por Metals.Dev desde campos lme_* y expresado en USD por tonelada métrica. No es una lectura directa de LME.com.",
    currency: "USD",
    unit: "mt",
    unitLabel: "tonelada métrica",
    marketTimestamp: lastSuccess ? lastSuccess.marketTimestamp : null,
    fetchedAt: lastSuccess ? lastSuccess.fetchedAt : null,
    fromCache: Boolean(options.fromCache),
    queriesUsedToday: cache.callsToday,
    queryLimit: DAILY_QUERY_LIMIT,
    limitReached: cache.callsToday >= DAILY_QUERY_LIMIT,
    autoRefreshAvailable: canAutoRefreshNow(),
    error: options.error || "",
    message: options.message || ""
  };
}

async function fetchFromMetalsDev(apiKey) {
  const params = new URLSearchParams({
    api_key: apiKey,
    currency: "USD",
    unit: "toz"
  });

  const response = await fetch(`${METALS_DEV_URL}?${params.toString()}`, {
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Metals.Dev respondio con estado ${response.status}.`);
  }

  const data = await response.json();
  return {
    metals: parseRates(data),
    marketTimestamp: normalizeTimestamp(data.timestamp || data.timestamps?.metal),
    fetchedAt: new Date().toISOString(),
    authority: "lme",
    currency: "USD",
    unit: "mt"
  };
}

async function getLmePrices(options = {}) {
  return runLocked(async () => {
    const forceRefresh = Boolean(options.forceRefresh);
    let cache = normalizeCacheDay(await readCache());
    await writeCache(cache);

    const lastSuccessIsValid = hasValidLastSuccess(cache.lastSuccess);

    if (!forceRefresh && lastSuccessIsValid && cache.lastSuccess.dayKey === cache.dayKey) {
      return buildPayload(cache, { fromCache: true });
    }

    if (!forceRefresh && !canAutoRefreshNow()) {
      return buildPayload(cache, {
        fromCache: lastSuccessIsValid,
        message: "Aún no se ha realizado la actualización de hoy."
      });
    }

    if (cache.callsToday >= DAILY_QUERY_LIMIT) {
      return buildPayload(cache, {
        fromCache: lastSuccessIsValid,
        message: "Límite diario alcanzado. Se muestran los últimos precios disponibles."
      });
    }

    const apiKey = await getMetalsDevApiKey();
    if (!apiKey) {
      return buildPayload(cache, {
        fromCache: lastSuccessIsValid,
        error: "Falta configurar METALS_DEV_API_KEY en backend/.env para consultar Metals.Dev."
      });
    }

    try {
      cache = {
        ...cache,
        callsToday: cache.callsToday + 1
      };
      await writeCache(cache);

      const result = await fetchFromMetalsDev(apiKey);
      cache = {
        ...cache,
        lastSuccess: {
          ...result,
          dayKey: cache.dayKey
        }
      };
      await writeCache(cache);

      return buildPayload(cache, { fromCache: false });
    } catch (error) {
      await writeCache(cache);
      return buildPayload(cache, {
        fromCache: hasValidLastSuccess(cache.lastSuccess),
        error: "No fue posible obtener precios LME desde Metals.Dev.",
        message: hasValidLastSuccess(cache.lastSuccess)
          ? "Se muestran los últimos precios disponibles."
          : error.message
      });
    }
  });
}

module.exports = {
  getLmePrices
};
