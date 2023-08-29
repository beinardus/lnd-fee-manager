import { AsyncDatabase } from "promised-sqlite3";
import { DATABASE_PATH } from "./settings-provider.js";
import {
  createChannelDict,
  getAffectedChannels,
} from "./channel-repository.js";
import { US_CREATE, US_UPDATE } from "./channel-update-states.js";

const setupDatabase = async () => {
  const db = await AsyncDatabase.open(DATABASE_PATH);

  // Run some sql request.
  await db.run(`
    CREATE TABLE IF NOT EXISTS channel (
            chan_id TEXT PRIMARY KEY,
            peer_alias TEXT NOT NULL )`);

  await db.run(`
    CREATE TABLE IF NOT EXISTS channel_update (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chan_id TEXT,
            local_balance INTEGER,
            remote_balance INTEGER,
            time TIMESTAMP,
            FOREIGN KEY (chan_id) REFERENCES channel(chan_id))`);

  await db.close();
};

const updateAffectedChannels = async (affectedChannels) => {
  const db = await AsyncDatabase.open(DATABASE_PATH);
  const epochTime = new Date().getTime();
  for (const c of affectedChannels) {
    switch (c.status) {
      case US_CREATE:
        await db.run(
          `
          insert into channel (chan_id, peer_alias)
          values ($chan_id, $peer_alias)`,
          {
            $chan_id: c.chan_id,
            $peer_alias: c.peer_alias,
          }
        );
        await db.run(
          `
          insert into channel_update (chan_id, local_balance, remote_balance, time)
          values ($chan_id, $local_balance, $remote_balance, $time)`,
          {
            $chan_id: c.chan_id,
            $local_balance: c.local_balance,
            $remote_balance: c.remote_balance,
            $time: epochTime,
          }
        );
        break;

      case US_UPDATE:
        await db.run(
          `
          insert into channel_update (chan_id, local_balance, remote_balance, time)
          values ($chan_id, $local_balance, $remote_balance, $time)`,
          {
            $chan_id: c.chan_id,
            $local_balance: c.local_balance,
            $remote_balance: c.remote_balance,
            $time: epochTime,
          }
        );
        break;
    }
  }
  await db.close();
};

const complementDatabase = async (channels) => {
  const db = await AsyncDatabase.open(DATABASE_PATH);
  const rows = await db.all(`
    select c.chan_id, u.local_balance, u.remote_balance 
    from channel c 
    left join (
        channel_update u1
        join ( 
            select u2.chan_id, max(u2.id) as id
            from channel_update u2 
            group by u2.chan_id) um on um.chan_id = u1.chan_id and um.id = u1.id) u on u.chan_id = c.chan_id`);

  const previousChannels = createChannelDict(rows);
  const affectedChannels = getAffectedChannels(previousChannels, channels);
  updateAffectedChannels(affectedChannels);
  await db.close();
};

export { setupDatabase, complementDatabase, updateAffectedChannels };
