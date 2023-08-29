#!/usr/bin/env sh
echo "-- charge-lnd starting --"
charge-lnd \
    --grpc "${GRPC_LOCATION}" \
    --lnddir "${LND_DIR}" \
    --tlscert "${LND_DIR}/tls.cert" \
	--macaroon "${MACAROON_PATH}" \
    -c "/app/charge.config"
echo "-- charge-lnd finished --"
