# lnd-fee-manager

Service that utilizes LND gRPC events to record channel change history and applies charge-lnd fee updates.
More information about charge-lnd can be found [here](https://github.com/accumulator/charge-lnd).

Several configuration files (charge.config) can be found in blogs of the Lightning+ site, for example:
[Balancing with automatic fee adjustments](https://lightningnetwork.plus/posts/185)

## Inner workings

Standing on the shoulders of [accumulator](https://github.com/accumulator). the creator of charge-lnd, this is mainly a wrapper around his work. Where he uses time intervals (scheduling in CRON), this version listens to the gRPC events on the LND gRPC interface. This enables very fast updates, without excessive polling. It also enables easy integration in Docker.  
In additional, channel updates are stored in a Sqlite database, to analyse activity afterwards.

When an update event (payment or forward transaction) is triggered, a short interval of 10s (hardcoded atm) is build in to await additional updates. This is implemented using a sliding window pattern. Then (after 10s of inactivity) all channels are retrieved and checked for updates. Updates are then stored in the database and `charge-lnd` is called.

New channels are not directly registered. This functionality has not (yet) been implemented.
Closed channels are kept in the database.

## Supported Lightning implementation

- LND (LND with gRPC API)

## Installation

### Docker

```shell
git clone https://github.com/beinardus/lnd-fee-manager
# Edit `docker-compose.yml` with your details.
docker-compose up -d
```

### Installation for LND

In `.env` config file or `docker-compose` environment:

| env var       | description                                   | default value             |
| ------------- | --------------------------------------------- | ------------------------- |
| DATABASE_PATH | Path to the Sqlite database                   | "./data/database.db"      |
| LND_DIR       | (optional) used in charge-lnd                 | "~/.lnd"                  |
| GRPC_LOCATION | end-point of the gRPC interface of LND        | "dutchbtc.ddns.net:10009" |
| MACAROON_PATH | path to a LND macaroon with sufficient rights | "./lnd/admin.macaroon"    |
| TLS_CERT_PATH | path to the TLS certificate of LND            | "./lnd/tls.cert"          |
| LOG_LEVEL     | Log level (winston logging)                   | "info"                    |

> [!NOTE]
> LND_DIR is obsolete when using TLS_CERT_PATH and MACROON_PATH

```
        lnd-fee-manager:
                image: lnd-fee-manager
                container_name: lnd-fee-manager
                restart: on-failure
                volumes:
                    - /data/charge-lnd:/app
                    - /data/lnd-data:/home/charge/.lnd
                environment:
                    - DATABASE_PATH=/app/database.db
                    - LND_DIR=/home/charge/.lnd
                    - GRPC_LOCATION=lnd:10009
                    - MACAROON_PATH=/home/charge/.lnd/admin.macaroon
                    - TLS_CERT_PATH=/home/charge/.lnd/tls.cert
                depends_on: [lnd]
                networks:
                    net:
                        ipv4_address: 10.254.1.12
```

`charge-lnd` uses the file called `charge.config`, that is mapped to the `/app` directory in the Docker container. You can make adjustments to the sample file that is used by default.

> [!NOTE]
> This `lnd` hostname is a service in the same Docker network.
> Paths in the environment variables (MACAROON_PATH, TLS_CERT_PATH) need to point to resources inside the Docker container. In combination with the mappings, these are resoures on the host.

### Installation in Umbrel

Locate where Umbrel is installed. Lets call it `UMBREL_ROOT`. Lets assume the directory structure is fixed. We will find the depicted structure:

- UMBREL_ROOT
  - scripts
    - _app_
  - app-data
    - bitcoin
    - lightning
      - _exports.sh_
      - data
        - lnd
          - _tls.cert_
          - data/chain/bitcoin/mainnet
            - _admin.macaroon_
    - lnd-fee-manager

`lnd-fee-manager` does not yet exists, but we create it now:

```shell
# set UMBREL_ROOT for convenience (EDIT THIS)
UMBREL_ROOT=/the/path/to/umbrel

# create lnd-fee-manager directory and copy the files from GitHub
cd $UMBREL_ROOT/app-data
git clone https://github.com/beinardus/lnd-fee-manager

cd ./lnd-fee-manager

# replace the default docker-compose
cp docker-compose-umbrel.yml docker-compose.yml

# since everything is pre configured, it should be possible to run
# `app` provides all environment settings needed to locate resources
sudo $UMBREL_ROOT/scripts/app compose lnd-fee-manager up -d
```

You are now able to trace the output using:  
`docker logs --follow -n50 lnd-fee-manager`

### Typical log output
```
2023-09-07 13:21:20 info: Channels:
{
    "886700052760363009": {
        "peer_alias": "Beinardus [LND]",
        "local_balance": 94530,
        "remote_balance": 2000
    }
}
2023-09-07 13:22:59 info: Channel:
{
    "peer_alias": "Beinardus [LND]",
    "local_balance": 94530,
    "remote_balance": 2000
}
2023-09-07 13:23:09 info: -- charge-lnd starting --
806449x794x1  [Beinardus [LND]|02404d14a1a5ffdf7f02a04b1aea3941a9ff3184b9ef2fd2c78af862cde9572188]
  policy:          new_outgoing_channels
  strategy:        static
  base_fee_msat:   1000 ➜ 0
  fee_ppm:         1 ➜ 0
  max_htlc_msat:   99000000 ➜ 54450000
-- charge-lnd finished --
```
### Points of concern

- RFC 6066 DeprecationWarning in Umbrel
- Docker image is quite large (in WSL)

## Useful SQL queries

Use `sqlite3` to query the database.

```
// Show latest channel states including the peer names
select c.chan_id, c.peer_alias, u.local_balance, u.remote_balance
  from channel c
  left join (
    channel_update u1
    join (
      select u2.chan_id, max(u2.id) as id from channel_update u2
      group by u2.chan_id) um on um.chan_id = u1.chan_id and um.id = u1.id) u on u.chan_id = c.chan_id
```

## Advanced configuration

- Edit the `charge.config` as it suits you.
- In the root of the application there is a file called `run-charge.sh`. In this file you can put any shell commands you like.
