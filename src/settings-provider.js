const GRPC_LOCATION = process.env.GRPC_LOCATION || "dutchbtc.ddns.net:10009";
const MACAROON_PATH = process.env.MACAROON_PATH || "./lnd/admin.macaroon";
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || "./lnd/tls.cert";
const DATABASE_PATH = process.env.DATABASE_PATH || "./database.db";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";

export {
  GRPC_LOCATION,
  MACAROON_PATH,
  TLS_CERT_PATH,
  DATABASE_PATH,
  LOG_LEVEL,
};
