const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const config = {
  host: process.env.ALEACIONES_DB_HOST || process.env.DB_HOST || "localhost",
  port: Number(process.env.ALEACIONES_DB_PORT || process.env.DB_PORT || 3306),
  user: process.env.ALEACIONES_DB_USER || process.env.DB_USER || "root",
  password:
    process.env.ALEACIONES_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "",
  database:
    process.env.ALEACIONES_DB_NAME ||
    process.env.DB_NAME ||
    "metal_harvest_aleaciones",
  lmeDatabase: process.env.LME_DB_NAME || "metal_harvest_lme"
};

let pool;

function mysqlConnectionConfig({ database = null } = {}) {
  const connectionConfig = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  };
  if (database) {
    connectionConfig.database = database;
  }
  return connectionConfig;
}

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function initAleacionesDb() {
  const schemaPath = path.resolve(__dirname, "../../../database/aleaciones_schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf8");
  const connection = await mysql.createConnection({
    ...mysqlConnectionConfig(),
    multipleStatements: false
  });

  try {
    for (const statement of splitSql(schema)) {
      await connection.query(statement);
    }
  } finally {
    await connection.end();
  }

  pool = mysql.createPool({
    ...mysqlConnectionConfig({ database: config.database }),
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    dateStrings: true
  });

  return pool;
}

function getAleacionesPool() {
  if (!pool) {
    throw new Error("Base de datos de aleaciones no inicializada");
  }
  return pool;
}

module.exports = {
  config,
  getAleacionesPool,
  initAleacionesDb
};
