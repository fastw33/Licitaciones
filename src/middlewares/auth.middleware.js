const jwt = require("jsonwebtoken");

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }
  return authHeader.slice("Bearer ".length).trim();
}

function authMiddleware(req, res, next) {
  if (req.method === "OPTIONS") {
    return next();
  }

  const internalServiceKey = String(process.env.INTERNAL_SERVICE_KEY || "").trim();
  const incomingInternalKey = String(req.headers["x-internal-service-key"] || "").trim();

  if (
    internalServiceKey &&
    incomingInternalKey &&
    incomingInternalKey === internalServiceKey
  ) {
    req.usuario = { internal_service: true };
    return next();
  }

  const jwtSecret = String(process.env.JWT_SECRET || "").trim();
  if (!jwtSecret) {
    return res.status(503).json({
      message: "JWT_SECRET no configurado en el backend seguro.",
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  try {
    req.usuario = jwt.verify(token, jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ message: "Token invalido o expirado" });
  }
}

module.exports = authMiddleware;
