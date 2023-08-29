import fs from "fs";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import {
  GRPC_LOCATION,
  MACAROON_PATH,
  TLS_CERT_PATH,
} from "./settings-provider.js";

const loaderOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const packageDefinition = protoLoader.loadSync(
  ["./lnd/lightning.proto", "./lnd/router.proto"],
  loaderOptions
);
const lnrpc = grpc.loadPackageDefinition(packageDefinition).lnrpc;
const routerrpc = grpc.loadPackageDefinition(packageDefinition).routerrpc;

process.env.GRPC_SSL_CIPHER_SUITES = "HIGH+ECDSA";
const tlsCert = fs.readFileSync(TLS_CERT_PATH);
const sslCreds = grpc.credentials.createSsl(tlsCert);
const macaroon = fs.readFileSync(MACAROON_PATH).toString("hex");
const macaroonCreds = grpc.credentials.createFromMetadataGenerator(function (
  args,
  callback
) {
  let metadata = new grpc.Metadata();
  metadata.add("macaroon", macaroon);
  callback(null, metadata);
});
const creds = grpc.credentials.combineChannelCredentials(
  sslCreds,
  macaroonCreds
);
const client_lightning = new lnrpc.Lightning(GRPC_LOCATION, creds);
const client_router = new routerrpc.Router(GRPC_LOCATION, creds);

export { client_lightning, client_router };
