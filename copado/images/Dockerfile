FROM salesforce/cli:latest-full

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install --assume-yes \
    bash \
    curl \
    git \
    jq \
    unzip \
    && apt-get autoremove --assume-yes \
    && apt-get clean --assume-yes \
    && rm -rf /var/lib/apt/lists/*

ENV SF_CONTAINER_MODE=true
ENV SFDX_CONTAINER_MODE=true
ENV SFDX_DISABLE_AUTOUPDATE=true
ENV SFDX_DISABLE_TELEMETRY=true
ENV SF_DISABLE_AUTOUPDATE=true
ENV SF_DISABLE_TELEMETRY=true
ENV SHELL=/bin/bash

USER root
RUN usermod -l func heroku && \
    groupmod -n func heroku && \
    usermod -d /home/func -m func && \
    mkdir -p /app /home/func && \
    chown func:func /app /home/func

USER func:func
WORKDIR /app
