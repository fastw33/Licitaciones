const crypto = require("crypto");
const { getAleacionesPool } = require("./db");
const {
  calculateLiquidation,
  normalizeComponent,
  normalizeRates,
  normalizeRatio,
  normalizeText,
  toNumber
} = require("./calculator");
const { getExchangeRate } = require("./ratesService");

const CALCULATION_VERSION = "2026-07-22-usd-eur-divide-eur-usd";

function mapMaterial(row, components = []) {
  return {
    id: row.id,
    name: row.name,
    code: row.code || "",
    description: row.description || "",
    conversionMode: row.conversion_mode || "usd_eur_cop",
    defaultWeightKg: row.default_weight_kg ?? 1,
    defaultClientPaymentPct: row.default_client_payment_pct ?? 0.925,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    components
  };
}

function mapComponent(row) {
  return {
    id: row.id,
    materialId: row.material_id,
    metalName: row.metal_name,
    symbol: row.symbol || "",
    lmeMetalKey: row.lme_metal_key || "",
    spectPct: row.spect_pct,
    paidPct: row.paid_pct,
    lmeUsdT: row.lme_usd_t ?? 0,
    displayOrder: row.display_order
  };
}

function mapResult(row, items = []) {
  const rates = normalizeRates({
    usdToCop: row.usd_to_cop,
    usdToEur: row.usd_to_eur,
    eurUsd: row.eur_usd,
    eurCop: row.eur_cop
  });

  return {
    id: row.id,
    materialId: row.material_id,
    materialName: row.material_name,
    conversionMode: row.conversion_mode || "usd_eur_cop",
    calculationOrigin: row.calculation_origin || "manual",
    inputSignature: row.input_signature || "",
    weightKg: row.weight_kg,
    clientPaymentPct: row.client_payment_pct,
    rates,
    subtotalCopKg: row.subtotal_cop_kg,
    paymentPriceCopKg: row.payment_price_cop_kg,
    lotValueCop: row.lot_value_cop,
    totalSpectPct: row.total_spect_pct,
    totalRecognizedPct: row.total_recognized_pct,
    notes: row.notes || "",
    createdAt: row.created_at,
    items
  };
}

function normalizeActive(value) {
  return !(value === false || value === 0 || value === "0" || value === "false");
}

function normalizeOrigin(value) {
  return value === "auto" ? "auto" : "manual";
}

function roundMoney(value) {
  const numeric = toNumber(value);
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

function buildResultChange(latest, previous) {
  const latestValue = toNumber(latest?.paymentPriceCopKg);
  const previousValue = toNumber(previous?.paymentPriceCopKg);
  if (!latest || !previous || !previousValue) {
    return null;
  }

  const valueDiff = roundMoney(latestValue - previousValue);
  const percentDiff = roundMoney((valueDiff / previousValue) * 100);
  return {
    previousResultId: previous.id,
    previousValue,
    valueDiff,
    percentDiff,
    direction: valueDiff > 0 ? "up" : valueDiff < 0 ? "down" : "flat"
  };
}

function createInputSignature(calculation) {
  const snapshot = {
    calculationVersion: CALCULATION_VERSION,
    materialId: calculation.materialId,
    conversionMode: calculation.conversionMode,
    weightKg: calculation.weightKg,
    clientPaymentPct: calculation.clientPaymentPct,
    rates: calculation.rates,
    items: calculation.items.map((item) => ({
      metalName: item.metalName,
      symbol: item.symbol,
      lmeMetalKey: item.lmeMetalKey,
      spectPct: item.spectPct,
      paidPct: item.paidPct,
      lmeUsdT: item.lmeUsdT
    }))
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
}

async function listMaterials({ includeInactive = false } = {}) {
  const pool = getAleacionesPool();
  const [materials] = await pool.query(
    `SELECT *
       FROM alloy_materials
      ${includeInactive ? "" : "WHERE is_active = 1"}
      ORDER BY name ASC`
  );

  if (materials.length === 0) {
    return [];
  }

  const ids = materials.map((material) => material.id);
  const [components] = await pool.query(
    `SELECT *
       FROM alloy_material_components
      WHERE material_id IN (?)
      ORDER BY material_id ASC, display_order ASC, id ASC`,
    [ids]
  );
  const componentsByMaterial = components.reduce((acc, component) => {
    const materialId = component.material_id;
    acc[materialId] = acc[materialId] || [];
    acc[materialId].push(mapComponent(component));
    return acc;
  }, {});

  return materials.map((material) =>
    mapMaterial(material, componentsByMaterial[material.id] || [])
  );
}

async function getMaterial(materialId) {
  const pool = getAleacionesPool();
  const [materials] = await pool.execute(
    "SELECT * FROM alloy_materials WHERE id = ? LIMIT 1",
    [materialId]
  );

  if (!materials[0]) {
    return null;
  }

  const [components] = await pool.execute(
    `SELECT *
       FROM alloy_material_components
      WHERE material_id = ?
      ORDER BY display_order ASC, id ASC`,
    [materialId]
  );

  return mapMaterial(materials[0], components.map(mapComponent));
}

async function replaceMaterialComponents(connection, materialId, components) {
  await connection.execute(
    "DELETE FROM alloy_material_components WHERE material_id = ?",
    [materialId]
  );

  for (const [index, component] of components.entries()) {
    const normalized = normalizeComponent(component, index);
    await connection.execute(
      `INSERT INTO alloy_material_components
        (material_id, metal_name, symbol, lme_metal_key, spect_pct, paid_pct, lme_usd_t, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        materialId,
        normalized.metalName,
        normalized.symbol || null,
        normalized.lmeMetalKey || null,
        normalized.spectPct,
        normalized.paidPct,
        normalized.lmeUsdT || null,
        normalized.displayOrder
      ]
    );
  }
}

async function createMaterial(payload) {
  const pool = getAleacionesPool();
  const connection = await pool.getConnection();
  const safe = payload || {};
  const name = normalizeText(safe.name);

  if (!name) {
    throw new Error("El nombre del material es obligatorio");
  }

  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO alloy_materials (
         name, code, description, conversion_mode,
         default_weight_kg, default_client_payment_pct, is_active
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        normalizeText(safe.code) || null,
        normalizeText(safe.description) || null,
        safe.conversionMode === "usd_cop" ? "usd_cop" : "usd_eur_cop",
        toNumber(safe.defaultWeightKg ?? safe.default_weight_kg ?? safe.weightKg ?? 1, 1),
        normalizeRatio(
          safe.defaultClientPaymentPct ??
            safe.default_client_payment_pct ??
            safe.clientPaymentPct ??
            0.925
        ),
        normalizeActive(safe.isActive) ? 1 : 0
      ]
    );
    await replaceMaterialComponents(
      connection,
      result.insertId,
      Array.isArray(safe.components) ? safe.components : []
    );
    await connection.commit();
    return getMaterial(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateMaterial(materialId, payload) {
  const pool = getAleacionesPool();
  const connection = await pool.getConnection();
  const safe = payload || {};
  const name = normalizeText(safe.name);

  if (!name) {
    throw new Error("El nombre del material es obligatorio");
  }

  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE alloy_materials
          SET name = ?,
              code = ?,
              description = ?,
              conversion_mode = ?,
              default_weight_kg = ?,
              default_client_payment_pct = ?,
              is_active = ?
        WHERE id = ?`,
      [
        name,
        normalizeText(safe.code) || null,
        normalizeText(safe.description) || null,
        safe.conversionMode === "usd_cop" ? "usd_cop" : "usd_eur_cop",
        toNumber(safe.defaultWeightKg ?? safe.default_weight_kg ?? safe.weightKg ?? 1, 1),
        normalizeRatio(
          safe.defaultClientPaymentPct ??
            safe.default_client_payment_pct ??
            safe.clientPaymentPct ??
            0.925
        ),
        normalizeActive(safe.isActive) ? 1 : 0,
        materialId
      ]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return null;
    }

    await replaceMaterialComponents(
      connection,
      materialId,
      Array.isArray(safe.components) ? safe.components : []
    );
    await connection.commit();
    return getMaterial(materialId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function setMaterialActive(materialId, isActive) {
  const pool = getAleacionesPool();
  const [result] = await pool.execute(
    "UPDATE alloy_materials SET is_active = ? WHERE id = ?",
    [isActive ? 1 : 0, materialId]
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getMaterial(materialId);
}

async function buildLiquidationPayload(payload) {
  const safe = payload || {};
  let components = Array.isArray(safe.components) ? safe.components : [];
  let materialName = normalizeText(safe.materialName ?? safe.material_name);
  let conversionMode = safe.conversionMode ?? safe.conversion_mode;
  const materialId = safe.materialId ?? safe.material_id ?? null;

  if (materialId && components.length === 0) {
    const material = await getMaterial(materialId);
    if (!material) {
      throw new Error("Material no encontrado");
    }
    components = material.components;
    materialName = materialName || material.name;
    conversionMode = conversionMode || material.conversionMode;
  }

  let rates = safe.rates || null;
  if (!rates) {
    const latestRate = await getExchangeRate();
    rates = latestRate.rates || latestRate;
  }

  return {
    ...safe,
    materialId,
    materialName,
    conversionMode: conversionMode === "usd_cop" ? "usd_cop" : "usd_eur_cop",
    components,
    rates
  };
}

async function saveLiquidation(payload) {
  const calculationPayload = await buildLiquidationPayload(payload);
  const calculation = calculateLiquidation(calculationPayload);
  return persistLiquidation(calculation, {
    calculationOrigin: normalizeOrigin(payload?.calculationOrigin ?? payload?.calculation_origin),
    inputSignature: normalizeText(payload?.inputSignature ?? payload?.input_signature) || null
  });
}

async function persistLiquidation(calculation, meta = {}) {
  const pool = getAleacionesPool();
  const connection = await pool.getConnection();
  const calculationOrigin = normalizeOrigin(meta.calculationOrigin);
  const inputSignature =
    meta.inputSignature || (calculationOrigin === "auto" ? createInputSignature(calculation) : null);

  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO alloy_liquidation_results
        (material_id, material_name, conversion_mode, calculation_origin, input_signature,
         weight_kg, client_payment_pct,
         usd_to_cop, usd_to_eur, eur_usd, eur_cop,
         subtotal_cop_kg, payment_price_cop_kg, lot_value_cop,
         total_spect_pct, total_recognized_pct, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        calculation.materialId,
        calculation.materialName,
        calculation.conversionMode,
        calculationOrigin,
        inputSignature,
        calculation.weightKg,
        calculation.clientPaymentPct,
        calculation.rates.usdToCop,
        calculation.rates.usdToEur,
        calculation.rates.eurUsd,
        calculation.rates.eurCop,
        calculation.subtotalCopKg,
        calculation.paymentPriceCopKg,
        calculation.lotValueCop,
        calculation.totalSpectPct,
        calculation.totalRecognizedPct,
        calculation.notes || null
      ]
    );

    for (const [index, item] of calculation.items.entries()) {
      await connection.execute(
        `INSERT INTO alloy_liquidation_result_items
          (result_id, metal_name, symbol, lme_metal_key, spect_pct, paid_pct,
           lme_usd_t, usd_kg, eur_kg, cop_kg, recognized_pct,
           base_value_cop_kg, recognized_value_cop_kg, display_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          item.metalName,
          item.symbol || null,
          item.lmeMetalKey || null,
          item.spectPct,
          item.paidPct,
          item.lmeUsdT,
          item.usdKg,
          item.eurKg,
          item.copKg,
          item.recognizedPct,
          item.baseValueCopKg,
          item.recognizedValueCopKg,
          item.displayOrder ?? index
        ]
      );
    }

    await connection.commit();
    return getLiquidationResult(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getLatestLiquidationResultForMaterial(materialId) {
  const pool = getAleacionesPool();
  const [rows] = await pool.execute(
    `SELECT *
       FROM alloy_liquidation_results
      WHERE material_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [materialId]
  );

  return rows[0] ? mapResult(rows[0]) : null;
}

async function saveLiquidationIfChanged(payload) {
  const calculationPayload = await buildLiquidationPayload(payload);
  const calculation = calculateLiquidation(calculationPayload);
  const inputSignature = createInputSignature(calculation);
  const latest = calculation.materialId
    ? await getLatestLiquidationResultForMaterial(calculation.materialId)
    : null;

  if (latest?.inputSignature === inputSignature) {
    return {
      saved: false,
      reason: "sin cambios",
      result: latest
    };
  }

  try {
    const result = await persistLiquidation(calculation, {
      calculationOrigin: "auto",
      inputSignature
    });
    return {
      saved: true,
      reason: latest ? "insumos actualizados" : "primer resultado automatico",
      result
    };
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      const duplicate = calculation.materialId
        ? await getLatestLiquidationResultForMaterial(calculation.materialId)
        : null;
      return {
        saved: false,
        reason: "sin cambios",
        result: duplicate
      };
    }
    throw error;
  }
}

async function listLiquidationResults({ limit = 30 } = {}) {
  const pool = getAleacionesPool();
  const safeLimit = Math.min(Math.max(toNumber(limit, 30), 1), 100);
  const [rows] = await pool.query(
    `SELECT *
       FROM alloy_liquidation_results
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    [safeLimit]
  );

  return rows.map((row) => mapResult(row));
}

async function listMaterialSummaries({ includeInactive = false } = {}) {
  const pool = getAleacionesPool();
  const materials = await listMaterials({ includeInactive });

  if (materials.length === 0) {
    return [];
  }

  const ids = materials.map((material) => material.id);
  const [resultRows] = await pool.query(
    `WITH day_ranked AS (
       SELECT r.*,
              DATE(r.created_at) AS result_day,
              ROW_NUMBER() OVER (
                PARTITION BY r.material_id, DATE(r.created_at)
                ORDER BY r.created_at DESC, r.id DESC
              ) AS day_rn
         FROM alloy_liquidation_results r
        WHERE r.material_id IN (?)
     ),
     daily_latest AS (
       SELECT day_ranked.*,
              ROW_NUMBER() OVER (
                PARTITION BY material_id
                ORDER BY result_day DESC, created_at DESC, id DESC
              ) AS day_order
         FROM day_ranked
        WHERE day_rn = 1
     )
     SELECT *
       FROM daily_latest
      WHERE day_order <= 2
      ORDER BY material_id ASC, day_order ASC`,
    [ids]
  );
  const latestRows = resultRows.filter((row) => Number(row.day_order) === 1);
  const previousByMaterial = new Map(
    resultRows
      .filter((row) => Number(row.day_order) === 2)
      .map((row) => [Number(row.material_id), mapResult(row)])
  );
  const latestByMaterial = new Map(
    latestRows.map((row) => {
      const latest = mapResult(row);
      latest.priceChange = buildResultChange(latest, previousByMaterial.get(Number(row.material_id)));
      return [Number(row.material_id), latest];
    })
  );

  if (latestRows.length > 0) {
    const resultIds = latestRows.map((row) => row.id);
    const [itemRows] = await pool.query(
      `SELECT *
         FROM alloy_liquidation_result_items
        WHERE result_id IN (?)
        ORDER BY result_id ASC, display_order ASC, id ASC`,
      [resultIds]
    );
    for (const row of itemRows) {
      const materialResult = latestRows.find((result) => result.id === row.result_id);
      if (!materialResult) {
        continue;
      }
      const latest = latestByMaterial.get(Number(materialResult.material_id));
      if (latest) {
        latest.items.push({
          id: row.id,
          resultId: row.result_id,
          metalName: row.metal_name,
          symbol: row.symbol || "",
          lmeMetalKey: row.lme_metal_key || "",
          spectPct: row.spect_pct,
          paidPct: row.paid_pct,
          lmeUsdT: row.lme_usd_t,
          usdKg: row.usd_kg,
          eurKg: row.eur_kg,
          copKg: row.cop_kg,
          recognizedPct: row.recognized_pct,
          baseValueCopKg: row.base_value_cop_kg,
          recognizedValueCopKg: row.recognized_value_cop_kg,
          displayOrder: row.display_order
        });
      }
    }
  }

  return materials.map((material) => ({
    ...material,
    latestResult: latestByMaterial.get(Number(material.id)) || null
  }));
}

async function listMaterialResultHistory(materialId, { limit = 120 } = {}) {
  const pool = getAleacionesPool();
  const safeLimit = Math.min(Math.max(toNumber(limit, 120), 1), 365);
  const [rows] = await pool.query(
    `SELECT *
       FROM alloy_liquidation_results
      WHERE material_id = ?
      ORDER BY created_at ASC, id ASC
      LIMIT ?`,
    [materialId, safeLimit]
  );

  return rows.map((row) => mapResult(row));
}

async function getLiquidationResult(resultId) {
  const pool = getAleacionesPool();
  const [rows] = await pool.execute(
    "SELECT * FROM alloy_liquidation_results WHERE id = ? LIMIT 1",
    [resultId]
  );

  if (!rows[0]) {
    return null;
  }

  const [items] = await pool.execute(
    `SELECT *
       FROM alloy_liquidation_result_items
      WHERE result_id = ?
      ORDER BY display_order ASC, id ASC`,
    [resultId]
  );

  return mapResult(rows[0], items.map((item) => ({
    id: item.id,
    resultId: item.result_id,
    metalName: item.metal_name,
    symbol: item.symbol || "",
    lmeMetalKey: item.lme_metal_key || "",
    spectPct: item.spect_pct,
    paidPct: item.paid_pct,
    lmeUsdT: item.lme_usd_t,
    usdKg: item.usd_kg,
    eurKg: item.eur_kg,
    copKg: item.cop_kg,
    recognizedPct: item.recognized_pct,
    baseValueCopKg: item.base_value_cop_kg,
    recognizedValueCopKg: item.recognized_value_cop_kg,
    displayOrder: item.display_order
  })));
}

module.exports = {
  createMaterial,
  getLiquidationResult,
  getLatestLiquidationResultForMaterial,
  getMaterial,
  listLiquidationResults,
  listMaterialResultHistory,
  listMaterialSummaries,
  listMaterials,
  saveLiquidation,
  saveLiquidationIfChanged,
  setMaterialActive,
  updateMaterial
};
