const DEFAULT_ADMIN_RANGES = [
  { from: 1, to: 3999999, fee: 380000, infinite: false },
  { from: 4000000, to: 6999999, fee: 840000, infinite: false },
  { from: 7000000, to: 9999999, fee: 1200000, infinite: false },
  { from: 10000000, to: 19999999, fee: 1700000, infinite: false },
  { from: 20000000, to: 39999999, fee: 2600000, infinite: false },
  { from: 40000000, to: 69999999, fee: 4000000, infinite: false },
  { from: 70000000, to: 119999999, fee: 5500000, infinite: false },
  { from: 120000000, to: 139999999, fee: 6800000, infinite: false },
  { from: 140000000, to: 159999999, fee: 7700000, infinite: false },
  { from: 160000000, to: 349999999, fee: 9700000, infinite: false },
  { from: 350000000, to: 449999999, fee: 12400000, infinite: false },
  { from: 450000000, to: 549999999, fee: 19100000, infinite: false },
  { from: 550000000, to: 999999999, fee: 33500000, infinite: false },
  { from: 1000000000, to: 1999999999, fee: 35800000, infinite: false },
  { from: 2000000000, to: 2999999999, fee: 56300000, infinite: false },
  { from: 3000000000, to: 3999999999, fee: 77800000, infinite: false },
  { from: 4000000000, to: 4999999999, fee: 95700000, infinite: false },
  { from: 5000000000, to: 0, fee: 113500000, infinite: true }
];

const DEFAULT_ADMIN_RANGES_SYC = [
  { from: 1, to: 3999999, fee: 519000, infinite: false },
  { from: 4000000, to: 6999999, fee: 1042440, infinite: false },
  { from: 7000000, to: 9999999, fee: 1190000, infinite: false },
  { from: 10000000, to: 19999999, fee: 1650000, infinite: false },
  { from: 20000000, to: 39999999, fee: 2500000, infinite: false },
  { from: 40000000, to: 69999999, fee: 3300000, infinite: false },
  { from: 70000000, to: 119999999, fee: 5300000, infinite: false },
  { from: 120000000, to: 139999999, fee: 7140000, infinite: false },
  { from: 140000000, to: 159999999, fee: 8032500, infinite: false },
  { from: 160000000, to: 349999999, fee: 10313000, infinite: false },
  { from: 350000000, to: 449999999, fee: 11156250, infinite: false },
  { from: 450000000, to: 549999999, fee: 14280000, infinite: false },
  { from: 550000000, to: 999999999, fee: 23948750, infinite: false },
  { from: 1000000000, to: 1999999999, fee: 39865000, infinite: false },
  { from: 2000000000, to: 2999999999, fee: 55781250, infinite: false },
  { from: 3000000000, to: 3999999999, fee: 79730000, infinite: false },
  { from: 4000000000, to: 4999999999, fee: 103678750, infinite: false },
  { from: 5000000000, to: 0, fee: 150000000, infinite: true }
];

const DEFAULT_LOGISTICS_ITEMS = [
  { category: "visita", label: "Transportes", amount: 0, notes: "" },
  { category: "visita", label: "Alojamiento", amount: 0, notes: "" },
  { category: "visita", label: "Viaticos", amount: 0, notes: "" },
  { category: "retiro", label: "Flete", amount: 0, notes: "" },
  { category: "retiro", label: "Grua / cargue", amount: 0, notes: "" },
  { category: "retiro", label: "Bascula", amount: 0, notes: "" },
  { category: "retiro", label: "Candado Digital", amount: 0, notes: "" },
  { category: "retiro", label: "Viaticos Fastway (Personal en cargue)", amount: 0, notes: "" },
  { category: "retiro", label: "Montacargas", amount: 0, notes: "" },
  { category: "retiro", label: "Cargue / maquinaria", amount: 0, notes: "" },
  { category: "retiro", label: "Personal / seguridad social / EPP", amount: 0, notes: "" },
  { category: "retiro", label: "Permisos / disposicion / ambientales", amount: 0, notes: "" },
  { category: "retiro", label: "Disposicion final / aprovechamiento", amount: 0, notes: "" },
  { category: "retiro", label: "Desnaturalizacion / corte", amount: 0, notes: "" },
  { category: "otros", label: "Polizas", amount: 0, notes: "" },
  { category: "otros", label: "Nacionalizacion / DIAN / aduanas", amount: 0, notes: "" },
  { category: "otros", label: "Otros gastos", amount: 0, notes: "" },
  { category: "superbid", label: "Separacion / costo de entrada a la subasta", amount: 0, notes: "" },
  { category: "superbid", label: "Pago adicional a Superbid", amount: 0, notes: "" }
];

module.exports = {
  DEFAULT_ADMIN_RANGES,
  DEFAULT_ADMIN_RANGES_SYC,
  DEFAULT_LOGISTICS_ITEMS
};
