import Docker from "dockerode";
import logger from "./winston-plugin.js";
import config from "config";

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const createContainer = async () => {
  const container = await docker.createContainer({
    Image: "accumulator/charge-lnd",
    Env: ["LND_DIR=/home/charge/.lnd","GRPC_LOCATION=lnd:10009","MACAROON_PATH=/home/charge/.lnd/admin.macaroon"],
    NetworkingConfig: {
      EndpointsConfig: {
        "bitcoin-compose_net": {}, // Replace with your network name
      }
    },        
    HostConfig: {
      AutoRemove: true,
      Binds: ["/data/charge-lnd:/app", "/data/lnd-data:/home/charge/.lnd"],
    },
  });

  return container;
};

const lookupServiceContainer = async () => {
  const serviceName = 'charge';
  return docker.getContainer(serviceName); // Assuming a single instance
};

const containerProvider = async (createNew) => {
  return await createNew ? createContainer() : lookupServiceContainer();
};

const updateFees = async () => {
  try {
      // TODO: decide if the create option is still relevant
      const container = await containerProvider(false);
      const stream = await container.attach({
        stream: true,
        stdout: true,
        stderr: true
      });

      // this dumps all previous logs      
      //const stream = await container.logs({ follow:true, stdout: true, stderr: true });

      // Set encoding to UTF-8 (optional)
      stream.setEncoding('utf8');

      // Listen to the 'data' event and print the logs
      //stream.on('data', (data) => {
      //  process.stdout.write(data);
      //});

      // Pipe the stream to the process's stdout
      stream.pipe(process.stdout);

      // Listen to the 'end' event (optional) and perform any cleanup
      stream.on('end', () => {
        logger.debug('Output stream ended.');
      });

      await container.start();
      logger.debug('INF: charge-lnd finished');
  }
  catch (e) {
    logger.error(`ERR: charge-lnd: ${e}`);
  }
};

export default updateFees;