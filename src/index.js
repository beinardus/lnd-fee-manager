import { client_router } from "./grpc-endpoint-provider.js";
import updateFees from "./update-fees.js";
import logger from "./winston-plugin.js";
import {
  listChannels,
  createChannelDict,
  getAffectedChannels,
  createChannelSummary,
} from "./channel-repository.js";
import {
  setupDatabase,
  complementDatabase,
  updateAffectedChannels,
} from "./database-manager.js";

const updateLiquidity = async (channelDict) => {
  logger.debug("Update Liquidity");
  const newValues = await listChannels();
  const affectedChannels = getAffectedChannels(channelDict, newValues);

  await updateAffectedChannels(affectedChannels);
  for (const nv of affectedChannels) {
    const chanSum = createChannelSummary(nv);
    channelDict[nv.chan_id] = chanSum;
  }

  await updateFees();
};

const run = async () => {
  let updateTimerId = null;

  const myChannelDict = await (async () => {
    await setupDatabase();
    const channels = await listChannels();

    // update changes that were made before this service was started
    await complementDatabase(channels);

    // keep track of the channels using a dictionary
    return createChannelDict(channels);
  })();

  logger.info("Channels:", { object: myChannelDict });

  let call = client_router.subscribeHtlcEvents({});
  call.on("data", function (response) {
    // only the settle_event contains the preimage
    // so we know at that moment that the transaction was successful
    if (response.event == "settle_event") {
      var myChannel =
        myChannelDict[response.incoming_channel_id] ||
        myChannelDict[response.outgoing_channel_id];
      if (myChannel) {
        if (updateTimerId) clearTimeout(updateTimerId);

        // give 10s to allow bursts (amp?)
        updateTimerId = setTimeout(() => updateLiquidity(myChannelDict), 10000);
        logger.debug("Raw response:", { object: response });
        logger.info("Channel:", { object: myChannel });
      }
    }
  });

  call.on("status", function (status) {
    // The current status of the stream.
  });
  call.on("end", function () {
    // The server has closed the stream.
  });
};

run();
