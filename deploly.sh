#!/bin/bash

# basic setting
_DEPLOY_DIR="/data/web"
_REPO="startup-mod"
_FRONT_DIR="${_REPO}/client"
_BACK_DIR="${_REPO}/server"
_BASEDIR=$(dirname $0)
pushd ${_BASEDIR} > /dev/null

# deploy front
cd
cd "${_FRONT_DIR}"
git pull origin main
npm --registry=https://registry.npmmirror.com install
npm run build
mkdir -p ${_DEPLOY_DIR}
rm -rf ${_DEPLOY_DIR}/*
rsync -avtP dist/ ${_DEPLOY_DIR}
systemctl restart nginx.service

# deploy back
cd
cd "${_BACK_DIR}"
git pull origin main
python src/app.py

# recovery
popd > /dev/null