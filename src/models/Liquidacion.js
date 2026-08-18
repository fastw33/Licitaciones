const mongoose = require("mongoose");

const AdminRangeSchema = new mongoose.Schema(
  {
    from: { type: Number, default: 0 },
    to: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },
    infinite: { type: Boolean, default: false }
  },
  { _id: false }
);

const LogisticsItemSchema = new mongoose.Schema(
  {
    category: { type: String, default: "otros" },
    label: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    notes: { type: String, default: "" }
  },
  { _id: false }
);

const CalculationLotSchema = new mongoose.Schema(
  {
    nombre: { type: String, default: "" },
    tipoCalculo: { type: String, enum: ["total", "kg"], default: "total" },
    valorAdjudicado: { type: Number, default: 0 },
    valorBaseLote: { type: Number, default: 0 },
    depositoGarantia: { type: Number, default: 0 },
    kilosEstimados: { type: Number, default: 0 },
    pesoUnitarioKg: { type: Number, default: 0 },
    aprovechableModo: { type: String, enum: ["kg", "pct"], default: "kg" },
    aprovechableValor: { type: Number, default: 0 },
    precioVentaKg: { type: Number, default: 0 },
    valorPorKilo: { type: Number, default: 0 }
  },
  { _id: false }
);

const GeneralSchema = new mongoose.Schema(
  {
    nombre: { type: String, default: "" },
    casaSubastadora: {
      type: String,
      enum: ["superbid", "subastas_y_comercio", "el_martillo"],
      default: "superbid"
    },
    referencia: { type: String, default: "" },
    fecha: { type: String, default: "" },
    fechaVisita: { type: String, default: "" },
    fechaCierre: { type: String, default: "" },
    plataforma: { type: String, default: "SUPER BID" },
    ubicacion: { type: String, default: "" },
    lote: { type: String, default: "" },
    detalle: { type: String, default: "" },
    observaciones: { type: String, default: "" }
  },
  { _id: false }
);

const CalculationSchema = new mongoose.Schema(
  {
    modo: { type: String, enum: ["total", "kg"], default: "total" },
    modoSyc: {
      type: String,
      enum: ["total", "kg", "multiple"],
      default: "total"
    },
    valorLote: { type: Number, default: 0 },
    pesoKg: { type: Number, default: 0 },
    valorPorKg: { type: Number, default: 0 },
    pesoRealKgMartillo: { type: Number, default: 0 },
    valorBaseDepositoMartillo: { type: Number, default: 0 },
    depositoParticipacionPctMartillo: { type: Number, default: 0.2 },
    garantiaAdicionalMartillo: { type: Number, default: 0 },
    devolucionMenorPesoMartillo: {
      type: String,
      enum: ["si", "no"],
      default: "no"
    },
    incluirHabilitacion: { type: Boolean, default: false },
    incluirDepositoGarantiaEnDesembolso: { type: Boolean, default: true },
    incluirColchonPrepago: { type: Boolean, default: true },
    unidadMedidaSyc: {
      type: String,
      enum: ["kg", "unidad"],
      default: "kg"
    },
    causaIvaValorAdjudicado: {
      type: String,
      enum: ["si", "no", "incluido"],
      default: "no"
    },
    ivaValorAdjudicadoRecuperable: { type: Boolean, default: false },
    acompanamientoUbicacion: { type: String, default: "" },
    acompanamientoDias: { type: Number, default: 1 },
    porcentajePrepagoAdicional: { type: Number, default: 0.2 },
    lotItems: { type: [CalculationLotSchema], default: [] }
  },
  { _id: false }
);

const CostConfigSchema = new mongoose.Schema(
  {
    comisionPct: { type: Number, default: 0.11 },
    ivaPct: { type: Number, default: 0.19 },
    garantia: { type: Number, default: 3000000 },
    habilitacion: { type: Number, default: 50000 },
    gmfPct: { type: Number, default: 0.004 }
  },
  { _id: false }
);

const BreakdownSchema = new mongoose.Schema(
  {
    auctionHouse: { type: String, default: "superbid" },
    houseLabel: { type: String, default: "Superbid" },
    valorMercancia: { type: Number, default: 0 },
    valorBaseLote: { type: Number, default: 0 },
    totalPagosSuperbid: { type: Number, default: 0 },
    totalGastosOperativos: { type: Number, default: 0 },
    ivaMaterialModo: { type: String, default: "no" },
    ivaValorAdjudicado: { type: Number, default: 0 },
    ivaValorAdjudicadoCosto: { type: Number, default: 0 },
    ivaValorAdjudicadoIncluido: { type: Number, default: 0 },
    devolucionIvaValorAdjudicado: { type: Number, default: 0 },
    comisionBase: { type: Number, default: 0 },
    ivaSobreComision: { type: Number, default: 0 },
    comisionTotal: { type: Number, default: 0 },
    gastoAdministrativoBase: { type: Number, default: 0 },
    ivaGastoAdministrativo: { type: Number, default: 0 },
    gastoAdministrativoTotal: { type: Number, default: 0 },
    totalLogistica: { type: Number, default: 0 },
    totalCompraSinGarantia: { type: Number, default: 0 },
    garantiaSeriedad: { type: Number, default: 0 },
    gmfDevolucion: { type: Number, default: 0 },
    costoHabilitacion: { type: Number, default: 0 },
    devolucionGarantia: { type: Number, default: 0 },
    cajaTemporal: { type: Number, default: 0 },
    costoNetoFinal: { type: Number, default: 0 },
    prepagoTotal: { type: Number, default: 0 },
    totalInversion: { type: Number, default: 0 },
    totalInversionConGarantia: { type: Number, default: 0 },
    aprovechableTotal: { type: Number, default: 0 },
    precioVentaKg: { type: Number, default: 0 },
    costoAprovechableKg: { type: Number, default: 0 },
    utilidadKg: { type: Number, default: 0 },
    utilidadPct: { type: Number, default: 0 },
    utilidadTotal: { type: Number, default: 0 },
    totalDesembolso: { type: Number, default: 0 },
    costoTotalEstimadoNegocio: { type: Number, default: 0 },
    porcentajeRealCostos: { type: Number, default: 0 },
    rangoAplicado: { type: AdminRangeSchema, default: null },
    lotBreakdowns: {
      type: [
        new mongoose.Schema(
          {
            nombre: { type: String, default: "" },
            tipoCalculo: { type: String, default: "total" },
            valorAdjudicado: { type: Number, default: 0 },
            valorBaseLote: { type: Number, default: 0 },
            kilosEstimados: { type: Number, default: 0 },
            cantidadUnidades: { type: Number, default: 0 },
            pesoUnitarioKg: { type: Number, default: 0 },
            pesoTotalKg: { type: Number, default: 0 },
            aprovechableModo: { type: String, default: "kg" },
            aprovechableValor: { type: Number, default: 0 },
            aprovechableCantidad: { type: Number, default: 0 },
            precioVentaKg: { type: Number, default: 0 },
            valorPorKilo: { type: Number, default: 0 },
            prepago: { type: Number, default: 0 },
            comisionBase: { type: Number, default: 0 },
            ivaComision: { type: Number, default: 0 },
            totalComision: { type: Number, default: 0 },
            tasaAdministrativa: { type: Number, default: 0 },
            depositoGarantia: { type: Number, default: 0 }
          },
          { _id: false }
        )
      ],
      default: []
    },
    warnings: { type: [String], default: [] }
  },
  { _id: false }
);

const AuctionSnapshotSchema = new mongoose.Schema(
  {
    kind: { type: String, default: "" },
    at: { type: String, default: "" },
    bidder: { type: String, default: "" },
    bidMode: { type: String, enum: ["kg", "total"], default: "total" },
    bidLabel: { type: String, default: "lote" },
    bidValue: { type: Number, default: 0 },
    bidTotal: { type: Number, default: 0 },
    maxBidValue: { type: Number, default: 0 },
    maxBidTotal: { type: Number, default: 0 },
    frozenDeposit: { type: Number, default: 0 },
    costPerUnit: { type: Number, default: 0 },
    utilityPct: { type: Number, default: 0 },
    utilityKg: { type: Number, default: 0 },
    utilityTotal: { type: Number, default: 0 },
    cashWithoutDeposit: { type: Number, default: 0 },
    totalWithDeposit: { type: Number, default: 0 },
    status: { type: String, default: "" }
  },
  { _id: false }
);

const AuctionMaxPlanSchema = new mongoose.Schema(
  {
    capturedAt: { type: String, default: "" },
    bidMode: { type: String, enum: ["kg", "total"], default: "total" },
    bidLabel: { type: String, default: "lote" },
    unitSuffix: { type: String, default: "" },
    bidQuantity: { type: Number, default: 0 },
    currentOfferValue: { type: Number, default: 0 },
    currentOfferTotal: { type: Number, default: 0 },
    incrementValue: { type: Number, default: 0 },
    incrementTotal: { type: Number, default: 0 },
    utilidadMinPct: { type: Number, default: 0 },
    utilidadMinKg: { type: Number, default: 0 },
    utilidadMinTotal: { type: Number, default: 0 },
    cajaMaxima: { type: Number, default: 0 },
    recommendedBidValue: { type: Number, default: 0 },
    recommendedBidTotal: { type: Number, default: 0 },
    hasAnyRule: { type: Boolean, default: false },
    hasViableMaximum: { type: Boolean, default: false },
    currentStatus: { type: Boolean, default: false },
    nextStatus: { type: Boolean, default: false },
    recommendedSnapshot: { type: AuctionSnapshotSchema, default: null },
    currentSnapshot: { type: AuctionSnapshotSchema, default: null },
    nextSnapshot: { type: AuctionSnapshotSchema, default: null },
    sensitivity: { type: [AuctionSnapshotSchema], default: [] }
  },
  { _id: false }
);

const AuctionSessionSchema = new mongoose.Schema(
  {
    version: { type: Number, default: 1 },
    sourceLiquidacionId: { type: String, default: "" },
    resultLiquidacionId: { type: String, default: "" },
    status: { type: String, default: "" },
    plannedAt: { type: String, default: "" },
    startedAt: { type: String, default: "" },
    finishedAt: { type: String, default: "" },
    bidMode: { type: String, enum: ["kg", "total"], default: "total" },
    bidLabel: { type: String, default: "lote" },
    unitSuffix: { type: String, default: "" },
    bidQuantity: { type: Number, default: 0 },
    startSnapshot: { type: AuctionSnapshotSchema, default: null },
    maxPlan: { type: AuctionMaxPlanSchema, default: null },
    bids: { type: [AuctionSnapshotSchema], default: [] },
    finalSnapshot: { type: AuctionSnapshotSchema, default: null }
  },
  { _id: false }
);

const LiquidacionSchema = new mongoose.Schema(
  {
    general: { type: GeneralSchema, default: () => ({}) },
    calculation: { type: CalculationSchema, default: () => ({}) },
    costConfig: { type: CostConfigSchema, default: () => ({}) },
    logisticsItems: { type: [LogisticsItemSchema], default: [] },
    adminRanges: { type: [AdminRangeSchema], default: [] },
    adminRangesSyc: { type: [AdminRangeSchema], default: [] },
    auctionSession: { type: AuctionSessionSchema, default: null },
    breakdown: { type: BreakdownSchema, default: () => ({}) },
    deletedAt: { type: Date, default: null },
    purgeAt: { type: Date, default: null }
  },
  {
    collection: "liquidador",
    timestamps: true,
    versionKey: false
  }
);

LiquidacionSchema.index({
  "general.nombre": "text",
  "general.casaSubastadora": "text",
  "general.plataforma": "text",
  "general.referencia": "text",
  "general.lote": "text",
  "general.ubicacion": "text",
  "general.detalle": "text",
  "general.observaciones": "text"
});
LiquidacionSchema.index({ createdAt: -1 });
LiquidacionSchema.index({ deletedAt: 1, createdAt: -1 });
LiquidacionSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Liquidacion", LiquidacionSchema);
