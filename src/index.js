import fs from 'fs';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import updateFees from './update-fees.js';
import logger from "./winston-plugin.js";

const GRPC_LOCATION = process.env.GRPC_LOCATION || 'dutchbtc.ddns.net:10009';
const MACAROON_PATH = process.env.MACAROON_PATH || './lnd/admin.macaroon';
const TLS_CERT = process.env.TLS_CERT || './lnd/tls.cert';

const loaderOptions = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};

const packageDefinition = protoLoader.loadSync(['./lnd/lightning.proto', './lnd/router.proto'], loaderOptions);
const lnrpc = grpc.loadPackageDefinition(packageDefinition).lnrpc;
const routerrpc = grpc.loadPackageDefinition(packageDefinition).routerrpc;

process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA';
const tlsCert = fs.readFileSync(TLS_CERT);
const sslCreds = grpc.credentials.createSsl(tlsCert);
const macaroon = fs.readFileSync(MACAROON_PATH).toString('hex');
const macaroonCreds = grpc.credentials.createFromMetadataGenerator(function(args, callback) {
  let metadata = new grpc.Metadata();
  metadata.add('macaroon', macaroon);
  callback(null, metadata);
});
const creds = grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds);
const client_lightning = new lnrpc.Lightning(GRPC_LOCATION, creds);
const client_router = new routerrpc.Router(GRPC_LOCATION, creds);

const listChannels = () => {
  return new Promise((resolve, reject) => {
    let request = {
      peer_alias_lookup: true
    };

    client_lightning.listChannels(request, function(err, response) {
      if (err) 
        reject(err);
      else
        resolve(response.channels);
    });
  });
};

let updateTimerId = null;

const run = async () => {
  // keep track of the channels using a dictionary
  const myChannelIDs = (await listChannels()).reduce((a,c) => {
    a[c.chan_id] = {
      peer_alias: c.peer_alias,
      local_balance: parseInt(c.local_balance),
      remote_balance: parseInt(c.remote_balance)
    }; return a}, {});

  logger.info("Channels:", {object: myChannelIDs});

  const updateLiquidity = async () => {
    logger.debug("Update Liquidity");
    const newValues = await listChannels();
    for (const nv of newValues) {
      // TODO: store db      
      const myChannel = myChannelIDs[nv.chan_id];
      myChannel.local_balance = nv.local_balance;
      myChannel.remote_balance = nv.remote_balance;
    }

    await updateFees();
  };

  let call = client_router.subscribeHtlcEvents({});
  call.on('data', function(response) {
    // only the settle_event contains the preimage
    // so we know at that moment that the transaction was successful
    if (response.event == 'settle_event')
    {
      var myChannel = myChannelIDs[response.incoming_channel_id] || myChannelIDs[response.outgoing_channel_id];
      if (myChannel) {
        if (updateTimerId)
          clearTimeout(updateTimerId);

        // give 10s to allow bursts (amp?)
        updateTimerId = setTimeout(updateLiquidity, 10000);
        logger.debug("Raw response:", {object: response});
        logger.info("Channel:", {object: myChannel});
      }
    }
  });
  
  call.on('status', function(status) {
    // The current status of the stream.
  });
  call.on('end', function() {
    // The server has closed the stream.
  });
}

run();
