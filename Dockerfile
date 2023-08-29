FROM python:3.9-slim AS builder-root

ARG USER_ID=1000
ARG GROUP_ID=1000
ENV USER_ID=$USER_ID
ENV GROUP_ID=$GROUP_ID

RUN addgroup --gid $GROUP_ID charge
RUN adduser --home /home/charge --uid $USER_ID --gid $GROUP_ID --disabled-login charge

# Install Node.js v16 using curl
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt-get update && apt-get install -y nodejs

# Install npm
RUN apt-get install -y npm

FROM builder-root AS builder-tmp
# Update and install Git
RUN apt-get update && apt-get install -y git
WORKDIR /
RUN git clone https://github.com/accumulator/charge-lnd.git

FROM builder-root AS builder-pip
WORKDIR /home/charge/charge-lnd
COPY --from=builder-tmp /charge-lnd/requirements.txt .
COPY --from=builder-tmp /charge-lnd/setup.py .
COPY --from=builder-tmp /charge-lnd/charge_lnd charge_lnd

RUN pip install -r requirements.txt .
RUN chown -R charge:charge /home/charge/charge-lnd

# Change the WORKDIR something else than what gets deleted
WORKDIR /
RUN rm -r /home/charge/charge-lnd

# Install npm packages
FROM builder-pip AS builder-npm

RUN apt-get update && apt-get install -y curl

WORKDIR /home/charge/lnd-fee-manager
COPY ./package*.json ./
RUN npm install

# Final build stage
FROM builder-npm
WORKDIR /home/charge/lnd-fee-manager
COPY ./src ./src
COPY ./lnd/*.proto ./lnd/

COPY ./run-charge.sh /usr/local/bin/run-charge
RUN chmod +x /usr/local/bin/run-charge

USER charge

CMD ["npm", "start"]
