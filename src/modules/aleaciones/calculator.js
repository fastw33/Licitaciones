const Decimal = require("decimal.js");

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDecimal(value, fallback = 0) {
  try {
    const decimal = new Decimal(value ?? fallback);
    return decimal.isFinite() ? decimal : new Decimal(fallback);
  } catch {
    return new Decimal(fallback);
  }
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRatio(value) {
  const number = toNumber(value);
  return Math.abs(number) > 1 ? number / 100 : number;
}

function normalizeConversionMode(value) {
  return value === "usd_cop" ? "usd_cop" : "usd_eur_cop";
}

function round(value, decimals = 6) {
  return toDecimal(value).toDecimalPlaces(decimals).toNumber();
}

function roundMoney(value) {
  return toDecimal(value).toDecimalPlaces(2).toNumber();
}

function roundRate(value) {
  return roundMoney(value);
}

function normalizeRates(input) {
  const safe = input || {};
  const explicitUsdToCop = toNumber(
    safe.usdToCop ?? safe.usd_to_cop ?? safe.usdCop ?? safe.trmUsdCop
  );
  const explicitUsdToEur = toNumber(
    safe.usdToEur ?? safe.usd_to_eur ?? safe.usdEur
  );
  const explicitEurUsd = toNumber(safe.eurUsd ?? safe.eur_usd);
  const eurUsd = explicitEurUsd || (explicitUsdToEur ? 1 / explicitUsdToEur : 0);
  const explicitEurCop = toNumber(
    safe.eurCop ?? safe.eur_cop ?? safe.trmEurCop
  );
  const usdToEur = explicitUsdToEur || (eurUsd ? 1 / eurUsd : 0);
  const usdToCop =
    explicitUsdToCop || (explicitEurCop && eurUsd ? explicitEurCop / eurUsd : 0);
  const eurCop = explicitEurCop || (usdToCop && eurUsd ? usdToCop * eurUsd : 0);

  if (!usdToCop || !usdToEur || !eurUsd || !eurCop) {
    throw new Error("Faltan tasas validas para liquidar");
  }

  return {
    usdToCop: roundRate(usdToCop),
    usdToEur: roundRate(usdToEur),
    eurUsd: roundRate(eurUsd),
    eurCop: roundRate(eurCop)
  };
}

function normalizeComponent(component, index = 0) {
  const safe = component || {};
  return {
    metalName:
      normalizeText(safe.metalName ?? safe.metal_name ?? safe.name) ||
      "Metal sin nombre",
    symbol: normalizeText(safe.symbol),
    lmeMetalKey: normalizeText(safe.lmeMetalKey ?? safe.lme_metal_key),
    spectPct: normalizeRatio(safe.spectPct ?? safe.spect_pct),
    paidPct: normalizeRatio(safe.paidPct ?? safe.paid_pct),
    lmeUsdT: toNumber(safe.lmeUsdT ?? safe.lme_usd_t),
    displayOrder: Number.isInteger(Number(safe.displayOrder ?? safe.display_order))
      ? Number(safe.displayOrder ?? safe.display_order)
      : index
  };
}

function calculateLiquidation(payload) {
  const safe = payload || {};
  const weightKg = toNumber(safe.weightKg ?? safe.weight_kg, 1);
  const clientPaymentPct = normalizeRatio(
    safe.clientPaymentPct ?? safe.client_payment_pct ?? safe.paymentPct ?? 1
  );
  const conversionMode = normalizeConversionMode(
    safe.conversionMode ?? safe.conversion_mode
  );
  const rates = normalizeRates(safe.rates);
  const components = Array.isArray(safe.components)
    ? safe.components.map(normalizeComponent)
    : [];

  if (components.length === 0) {
    throw new Error("Debes enviar al menos un metal para liquidar");
  }

  const items = components.map((component, index) => {
    const lmeUsdT = roundMoney(component.lmeUsdT);
    const spectPct = toDecimal(component.spectPct);
    const paidPct = toDecimal(component.paidPct);
    const usdKgValue = toDecimal(lmeUsdT).div(1000);
    const eurKgValue = rates.eurUsd
      ? usdKgValue.div(rates.eurUsd)
      : usdKgValue.mul(rates.usdToEur);
    const copKgValue =
      conversionMode === "usd_cop"
        ? usdKgValue.mul(rates.usdToCop)
        : eurKgValue.mul(rates.eurCop);
    const recognizedPct = round(spectPct.mul(paidPct), 8);
    const baseValueCopKgValue = copKgValue.mul(spectPct);
    const recognizedValueCopKgValue = copKgValue.mul(recognizedPct);

    return {
      ...component,
      _baseValueCopKgValue: baseValueCopKgValue,
      _recognizedValueCopKgValue: recognizedValueCopKgValue,
      lmeUsdT,
      usdKg: roundMoney(usdKgValue),
      eurKg: roundMoney(eurKgValue),
      copKg: roundMoney(copKgValue),
      recognizedPct,
      baseValueCopKg: roundMoney(baseValueCopKgValue),
      recognizedValueCopKg: roundMoney(recognizedValueCopKgValue),
      displayOrder: component.displayOrder ?? index
    };
  });

  const subtotalCopKgValue = items.reduce(
    (total, item) => total.plus(item._recognizedValueCopKgValue),
    new Decimal(0)
  );
  const subtotalCopKg = roundMoney(subtotalCopKgValue);
  const paymentPriceCopKg = roundMoney(subtotalCopKgValue.mul(clientPaymentPct));
  const lotValueCop = roundMoney(toDecimal(paymentPriceCopKg).mul(weightKg));
  const totalSpectPct = items.reduce((total, item) => total + item.spectPct, 0);
  const totalRecognizedPct = items.reduce(
    (total, item) => total + item.recognizedPct,
    0
  );

  return {
    materialId: safe.materialId ?? safe.material_id ?? null,
    materialName:
      normalizeText(safe.materialName ?? safe.material_name) ||
      "Liquidacion sin material",
    weightKg: round(weightKg, 6),
    clientPaymentPct: round(clientPaymentPct, 8),
    conversionMode,
    rates,
    subtotalCopKg,
    paymentPriceCopKg,
    lotValueCop,
    totalSpectPct: round(totalSpectPct, 8),
    totalRecognizedPct: round(totalRecognizedPct, 8),
    notes: normalizeText(safe.notes),
    items: items.map(({ _baseValueCopKgValue, _recognizedValueCopKgValue, ...item }) => item)
  };
}

module.exports = {
  calculateLiquidation,
  normalizeComponent,
  normalizeConversionMode,
  normalizeRatio,
  normalizeRates,
  normalizeText,
  toNumber
};
