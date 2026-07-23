const express = require("express");
const {
  createMaterial,
  getLiquidationResult,
  getMaterial,
  listLiquidationResults,
  listMaterialResultHistory,
  listMaterialSummaries,
  listMaterials,
  saveLiquidation,
  setMaterialActive,
  updateMaterial
} = require("./aleacionesService");
const {
  fetchExchangeRate,
  getExchangeRate,
  getLatestStoredRate,
  saveExchangeRate
} = require("./ratesService");
const { normalizeRates } = require("./calculator");
const { runAutoPriceUpdate } = require("./autoUpdater");

const router = express.Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      if (error.message === "Material no encontrado") {
        return res.status(404).json({ message: error.message });
      }

      if (
        error.message === "El nombre del material es obligatorio" ||
        error.message === "Faltan tasas validas para liquidar" ||
        error.message === "Debes enviar al menos un metal para liquidar"
      ) {
        return res.status(400).json({ message: error.message });
      }

      next(error);
    }
  };
}

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "aleaciones" });
});

router.get(
  "/materiales",
  asyncHandler(async (req, res) => {
    const materials = await listMaterials({
      includeInactive: req.query.includeInactive === "1"
    });
    res.json({ items: materials });
  })
);

router.post(
  "/materiales",
  asyncHandler(async (req, res) => {
    const material = await createMaterial(req.body);
    res.status(201).json(material);
  })
);

router.get(
  "/materiales/resumen",
  asyncHandler(async (req, res) => {
    const items = await listMaterialSummaries({
      includeInactive: req.query.includeInactive === "1"
    });
    res.json({ items });
  })
);

router.get(
  "/materiales/:id/historial",
  asyncHandler(async (req, res) => {
    const material = await getMaterial(req.params.id);
    if (!material) {
      return res.status(404).json({ message: "Material no encontrado" });
    }
    const items = await listMaterialResultHistory(req.params.id, {
      limit: req.query.limit
    });
    res.json({ material, items });
  })
);

router.get(
  "/materiales/:id",
  asyncHandler(async (req, res) => {
    const material = await getMaterial(req.params.id);
    if (!material) {
      return res.status(404).json({ message: "Material no encontrado" });
    }
    res.json(material);
  })
);

router.put(
  "/materiales/:id",
  asyncHandler(async (req, res) => {
    const material = await updateMaterial(req.params.id, req.body);
    if (!material) {
      return res.status(404).json({ message: "Material no encontrado" });
    }
    res.json(material);
  })
);

router.patch(
  "/materiales/:id/estado",
  asyncHandler(async (req, res) => {
    const requestedState = req.body.isActive;
    const isActive = !(
      requestedState === false ||
      requestedState === 0 ||
      requestedState === "0" ||
      requestedState === "false"
    );
    const material = await setMaterialActive(req.params.id, isActive);
    if (!material) {
      return res.status(404).json({ message: "Material no encontrado" });
    }
    res.json(material);
  })
);

router.get(
  "/tasas/latest",
  asyncHandler(async (req, res) => {
    const rate = await getExchangeRate({ refresh: req.query.refresh === "1" });
    res.json(rate);
  })
);

router.get(
  "/tasas/stored",
  asyncHandler(async (req, res) => {
    const rate = await getLatestStoredRate();
    res.json(rate || null);
  })
);

router.post(
  "/tasas",
  asyncHandler(async (req, res) => {
    const rate = await saveExchangeRate({
      rateDate: req.body.rateDate,
      ...normalizeRates(req.body),
      source: req.body.source || "manual"
    });
    res.status(201).json(rate);
  })
);

router.post(
  "/tasas/refresh",
  asyncHandler(async (req, res) => {
    const rate = await fetchExchangeRate();
    res.status(201).json(rate);
  })
);

router.post(
  "/actualizar-precios",
  asyncHandler(async (req, res) => {
    const result = await runAutoPriceUpdate({
      refreshRates: req.body?.refreshRates !== false
    });
    res.status(201).json(result);
  })
);

router.post(
  "/liquidar",
  asyncHandler(async (req, res) => {
    const result = await saveLiquidation(req.body);
    res.status(201).json(result);
  })
);

router.get(
  "/resultados",
  asyncHandler(async (req, res) => {
    const items = await listLiquidationResults({ limit: req.query.limit });
    res.json({ items });
  })
);

router.get(
  "/resultados/:id",
  asyncHandler(async (req, res) => {
    const result = await getLiquidationResult(req.params.id);
    if (!result) {
      return res.status(404).json({ message: "Resultado no encontrado" });
    }
    res.json(result);
  })
);

module.exports = router;
