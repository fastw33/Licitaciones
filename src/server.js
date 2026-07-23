require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Liquidacion = require("./models/Liquidacion");
const authMiddleware = require("./middlewares/auth.middleware");
const { getLmePrices } = require("./services/lmeService");
const aleacionesRoutes = require("./modules/aleaciones/routes");
const { initAleacionesDb } = require("./modules/aleaciones/db");
const { startAutoPriceUpdater } = require("./modules/aleaciones/autoUpdater");
const {
  DEFAULT_ADMIN_RANGES,
  DEFAULT_ADMIN_RANGES_SYC,
  DEFAULT_LOGISTICS_ITEMS
} = require("./defaults");

const app = express();
const PORT = Number(process.env.PORT) || 4060;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/Licitaciones";
const TRASH_RETENTION_DAYS = 30;

app.use(
  cors({
    allowedHeaders: ["Content-Type", "Authorization", "X-Internal-Service-Key"],
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(authMiddleware);

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRange(range) {
  const safe = range || {};
  return {
    from: normalizeNumber(safe.from),
    to: normalizeNumber(safe.to),
    fee: normalizeNumber(safe.fee),
    infinite: Boolean(safe.infinite)
  };
}

function normalizeLogisticsItem(item) {
  const safe = item || {};
  return {
    category: normalizeString(safe.category) || "otros",
    label: normalizeString(safe.label),
    amount: normalizeNumber(safe.amount),
    notes: normalizeString(safe.notes)
  };
}

function normalizeLotItem(item) {
  const safe = item || {};
  return {
    nombre: normalizeString(safe.nombre),
    tipoCalculo: safe.tipoCalculo === "kg" ? "kg" : "total",
    valorAdjudicado: normalizeNumber(safe.valorAdjudicado),
    valorBaseLote: normalizeNumber(safe.valorBaseLote),
    kilosEstimados: normalizeNumber(safe.kilosEstimados),
    valorPorKilo: normalizeNumber(safe.valorPorKilo)
  };
}

function normalizeBreakdownLot(item) {
  const safe = item || {};
  return {
    nombre: normalizeString(safe.nombre),
    tipoCalculo: safe.tipoCalculo === "kg" ? "kg" : "total",
    valorAdjudicado: normalizeNumber(safe.valorAdjudicado),
    valorBaseLote: normalizeNumber(safe.valorBaseLote),
    kilosEstimados: normalizeNumber(safe.kilosEstimados),
    valorPorKilo: normalizeNumber(safe.valorPorKilo),
    prepago: normalizeNumber(safe.prepago),
    comisionBase: normalizeNumber(safe.comisionBase),
    ivaComision: normalizeNumber(safe.ivaComision),
    totalComision: normalizeNumber(safe.totalComision),
    tasaAdministrativa: normalizeNumber(safe.tasaAdministrativa),
    depositoGarantia: normalizeNumber(safe.depositoGarantia)
  };
}

function normalizePayload(payload) {
  const safe = payload || {};
  const general = safe.general || {};
  const calculation = safe.calculation || {};
  const costConfig = safe.costConfig || {};
  const breakdown = safe.breakdown || {};

  return {
    general: {
      nombre: normalizeString(general.nombre),
      casaSubastadora:
        general.casaSubastadora === "subastas_y_comercio"
          ? "subastas_y_comercio"
          : general.casaSubastadora === "el_martillo"
            ? "el_martillo"
          : "superbid",
      referencia: normalizeString(general.referencia),
      fecha: normalizeString(general.fecha),
      fechaVisita: normalizeString(general.fechaVisita),
      fechaCierre: normalizeString(general.fechaCierre),
      plataforma: normalizeString(general.plataforma) || "SUPER BID",
      ubicacion: normalizeString(general.ubicacion),
      lote: normalizeString(general.lote),
      detalle: normalizeString(general.detalle),
      observaciones: normalizeString(general.observaciones)
    },
    calculation: {
      modo: calculation.modo === "kg" ? "kg" : "total",
      modoSyc:
        calculation.modoSyc === "multiple"
          ? "multiple"
          : calculation.modoSyc === "kg"
            ? "kg"
            : "total",
      valorLote: normalizeNumber(calculation.valorLote),
      pesoKg: normalizeNumber(calculation.pesoKg),
      valorPorKg: normalizeNumber(calculation.valorPorKg),
      pesoRealKgMartillo: normalizeNumber(calculation.pesoRealKgMartillo),
      valorBaseDepositoMartillo: normalizeNumber(
        calculation.valorBaseDepositoMartillo
      ),
      depositoParticipacionPctMartillo:
        normalizeNumber(calculation.depositoParticipacionPctMartillo) || 0.2,
      garantiaAdicionalMartillo: normalizeNumber(
        calculation.garantiaAdicionalMartillo
      ),
      devolucionMenorPesoMartillo:
        calculation.devolucionMenorPesoMartillo === "si" ? "si" : "no",
      incluirHabilitacion: Boolean(calculation.incluirHabilitacion),
      incluirDepositoGarantiaEnDesembolso:
        calculation.incluirDepositoGarantiaEnDesembolso !== false,
      causaIvaValorAdjudicado:
        calculation.causaIvaValorAdjudicado === "si" ? "si" : "no",
      acompanamientoUbicacion: normalizeString(
        calculation.acompanamientoUbicacion
      ),
      acompanamientoDias: normalizeNumber(calculation.acompanamientoDias) || 1,
      porcentajePrepagoAdicional:
        normalizeNumber(calculation.porcentajePrepagoAdicional) || 0.2,
      lotItems: Array.isArray(calculation.lotItems)
        ? calculation.lotItems.map(normalizeLotItem)
        : []
    },
    costConfig: {
      comisionPct: normalizeNumber(costConfig.comisionPct),
      ivaPct: normalizeNumber(costConfig.ivaPct),
      garantia: normalizeNumber(costConfig.garantia),
      habilitacion: normalizeNumber(costConfig.habilitacion),
      gmfPct: normalizeNumber(costConfig.gmfPct)
    },
    logisticsItems: Array.isArray(safe.logisticsItems)
      ? safe.logisticsItems.map(normalizeLogisticsItem)
      : [],
    adminRanges: Array.isArray(safe.adminRanges)
      ? safe.adminRanges.map(normalizeRange)
      : [],
    adminRangesSyc: Array.isArray(safe.adminRangesSyc)
      ? safe.adminRangesSyc.map(normalizeRange)
      : [],
    breakdown: {
      auctionHouse:
        breakdown.auctionHouse === "subastas_y_comercio"
          ? "subastas_y_comercio"
          : breakdown.auctionHouse === "el_martillo"
            ? "el_martillo"
          : "superbid",
      houseLabel: normalizeString(breakdown.houseLabel),
      valorMercancia: normalizeNumber(breakdown.valorMercancia),
      valorBaseLote: normalizeNumber(breakdown.valorBaseLote),
      totalPagosSuperbid: normalizeNumber(breakdown.totalPagosSuperbid),
      totalGastosOperativos: normalizeNumber(breakdown.totalGastosOperativos),
      ivaValorAdjudicado: normalizeNumber(breakdown.ivaValorAdjudicado),
      comisionBase: normalizeNumber(breakdown.comisionBase),
      ivaSobreComision: normalizeNumber(breakdown.ivaSobreComision),
      comisionTotal: normalizeNumber(breakdown.comisionTotal),
      gastoAdministrativoBase: normalizeNumber(breakdown.gastoAdministrativoBase),
      ivaGastoAdministrativo: normalizeNumber(breakdown.ivaGastoAdministrativo),
      gastoAdministrativoTotal: normalizeNumber(breakdown.gastoAdministrativoTotal),
      totalLogistica: normalizeNumber(breakdown.totalLogistica),
      totalCompraSinGarantia: normalizeNumber(breakdown.totalCompraSinGarantia),
      garantiaSeriedad: normalizeNumber(breakdown.garantiaSeriedad),
      gmfDevolucion: normalizeNumber(breakdown.gmfDevolucion),
      costoHabilitacion: normalizeNumber(breakdown.costoHabilitacion),
      devolucionGarantia: normalizeNumber(breakdown.devolucionGarantia),
      cajaTemporal: normalizeNumber(breakdown.cajaTemporal),
      costoNetoFinal: normalizeNumber(breakdown.costoNetoFinal),
      prepagoTotal: normalizeNumber(breakdown.prepagoTotal),
      totalDesembolso: normalizeNumber(breakdown.totalDesembolso),
      costoTotalEstimadoNegocio: normalizeNumber(
        breakdown.costoTotalEstimadoNegocio
      ),
      porcentajeRealCostos: normalizeNumber(breakdown.porcentajeRealCostos),
      rangoAplicado: breakdown.rangoAplicado
        ? normalizeRange(breakdown.rangoAplicado)
        : null,
      lotBreakdowns: Array.isArray(breakdown.lotBreakdowns)
        ? breakdown.lotBreakdowns.map(normalizeBreakdownLot)
        : [],
      warnings: Array.isArray(breakdown.warnings)
        ? breakdown.warnings.map(normalizeString).filter(Boolean)
        : []
    }
  };
}

function buildTrashDate() {
  const trashDate = new Date();
  trashDate.setDate(trashDate.getDate() + TRASH_RETENTION_DAYS);
  return trashDate;
}

function buildHistoryFilter(status, search) {
  const filter = {};

  if (status === "trash") {
    filter.deletedAt = { $ne: null, $exists: true };
  } else {
    filter.deletedAt = null;
  }

  if (search) {
    filter.$text = { $search: search };
  }

  return filter;
}

app.get("/api/health", (req, res) => {
  const states = {
    0: "desconectado",
    1: "conectado",
    2: "conectando",
    3: "desconectando"
  };

  res.json({
    ok: true,
    service: "liquidador-licitaciones-backend",
    mongodb: states[mongoose.connection.readyState] || "desconocido"
  });
});

app.get("/api/defaults", (req, res) => {
  res.json({
    logisticsItems: DEFAULT_LOGISTICS_ITEMS,
    adminRanges: DEFAULT_ADMIN_RANGES,
    adminRangesSyc: DEFAULT_ADMIN_RANGES_SYC,
    costConfig: {
      comisionPct: 0.11,
      ivaPct: 0.19,
      garantia: 3000000,
      habilitacion: 50000,
      gmfPct: 0.004
    }
  });
});

app.get("/api/lme/prices", async (req, res, next) => {
  try {
    const payload = await getLmePrices({
      forceRefresh: req.query.refresh === "1"
    });
    const status = payload.metals.length > 0 || payload.fromCache ? 200 : 503;
    res.status(status).json(payload);
  } catch (error) {
    next(error);
  }
});

app.use("/api/aleaciones", aleacionesRoutes);

app.post("/api/liquidaciones", async (req, res, next) => {
  try {
    const created = await Liquidacion.create({
      ...normalizePayload(req.body),
      deletedAt: null,
      purgeAt: null
    });
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.get("/api/liquidaciones", async (req, res, next) => {
  try {
    const page = Math.max(normalizeNumber(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(normalizeNumber(req.query.limit) || 20, 1), 100);
    const search = normalizeString(req.query.search);
    const status = normalizeString(req.query.status) === "trash" ? "trash" : "active";
    const filter = buildHistoryFilter(status, search);

    const [items, total] = await Promise.all([
      Liquidacion.find(filter)
        .sort(status === "trash" ? { deletedAt: -1, createdAt: -1 } : { createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Liquidacion.countDocuments(filter)
    ]);

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/liquidaciones/:id", async (req, res, next) => {
  try {
    const item = await Liquidacion.findById(req.params.id).lean();
    if (!item) {
      return res.status(404).json({ message: "Liquidacion no encontrada" });
    }
    res.json(item);
  } catch (error) {
    next(error);
  }
});

app.put("/api/liquidaciones/:id", async (req, res, next) => {
  try {
    const updated = await Liquidacion.findByIdAndUpdate(
      req.params.id,
      {
        ...normalizePayload(req.body),
        deletedAt: null,
        purgeAt: null
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Liquidacion no encontrada" });
    }
    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/liquidaciones/:id", async (req, res, next) => {
  try {
    const deleted = await Liquidacion.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { deletedAt: new Date(), purgeAt: buildTrashDate() },
      { new: true }
    ).lean();

    if (!deleted) {
      return res.status(404).json({ message: "Liquidacion no encontrada" });
    }
    res.json({
      message: "Liquidacion movida a la papelera",
      id: req.params.id,
      deletedAt: deleted.deletedAt,
      purgeAt: deleted.purgeAt
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/liquidaciones/:id/restaurar", async (req, res, next) => {
  try {
    const restored = await Liquidacion.findOneAndUpdate(
      { _id: req.params.id, deletedAt: { $ne: null, $exists: true } },
      { deletedAt: null, purgeAt: null },
      { new: true }
    ).lean();

    if (!restored) {
      return res.status(404).json({ message: "Liquidacion no encontrada en papelera" });
    }

    res.json({
      message: "Liquidacion restaurada",
      id: req.params.id
    });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/liquidaciones/:id/permanent", async (req, res, next) => {
  try {
    const deleted = await Liquidacion.findOneAndDelete({
      _id: req.params.id,
      deletedAt: { $ne: null, $exists: true }
    }).lean();

    if (!deleted) {
      return res.status(404).json({ message: "Liquidacion no encontrada en papelera" });
    }

    res.json({ message: "Liquidacion eliminada definitivamente", id: req.params.id });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

app.use((error, req, res, next) => {
  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: "ID invalido" });
  }

  console.error(error);
  res.status(500).json({
    message: "Error interno del servidor",
    detail: process.env.NODE_ENV === "development" ? error.message : undefined
  });
});

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB conectado:", MONGODB_URI);
    await initAleacionesDb();
    console.log("MariaDB aleaciones conectado");
    startAutoPriceUpdater();
    await Liquidacion.createCollection().catch((error) => {
      if (!error || error.codeName !== "NamespaceExists") {
        throw error;
      }
    });
    await new Promise((resolve, reject) => {
      const server = app.listen(PORT, () => {
        console.log("API escuchando en http://localhost:" + PORT);
        resolve(server);
      });
      server.on("error", reject);
    });
  } catch (error) {
    if (error && error.code === "EADDRINUSE") {
      console.error("No fue posible iniciar el servidor: el puerto " + PORT + " ya esta en uso.");
    } else {
      console.error("No fue posible iniciar el servidor:", error.message);
    }
    process.exit(1);
  }
}

start();
