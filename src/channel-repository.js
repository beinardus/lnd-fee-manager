import { client_lightning } from "./grpc-endpoint-provider.js";
import { US_CREATE, US_UPDATE } from "./channel-update-states.js";

const listChannels = () => {
  return new Promise((resolve, reject) => {
    let request = {
      peer_alias_lookup: true,
    };

    client_lightning.listChannels(request, (err, response) => {
      if (err) reject(err);
      else resolve(response.channels);
    });
  });
};

const createChannelSummary = (channel) => {
  return {
    peer_alias: channel.peer_alias,
    local_balance: channel.local_balance,
    remote_balance: channel.remote_balance,
  };
};

const createChannelDict = (channels) => {
  return channels.reduce((a, c) => {
    a[c.chan_id] = {
      peer_alias: c.peer_alias,
      local_balance: parseInt(c.local_balance),
      remote_balance: parseInt(c.remote_balance),
    };
    return a;
  }, {});
};

const getAffectedChannels = (channelDict, newValues) => {
  const affected = [];

  for (const nv of newValues) {
    const oldValue = channelDict[nv.chan_id];
    if (oldValue == null) {
      affected.push({ ...nv, status: US_CREATE });
      continue;
    }

    if (
      oldValue.local_balance != nv.local_balance ||
      oldValue.remote_balance != nv.remote_balance
    ) {
      affected.push({ ...nv, status: US_UPDATE });
    }
  }

  return affected;
};

export {
  listChannels,
  createChannelDict,
  getAffectedChannels,
  createChannelSummary,
};
