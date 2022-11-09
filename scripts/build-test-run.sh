#!/bin/sh

# This script re-installs node_modules, runs the build, and runs the tests.

if [ ! -f 'package.json' ]; then
  echo 'package.json not found'
  exit 1
fi

rnd=$(LC_CTYPE=C tr -cd 'A-Za-z0-9' < /dev/urandom | fold -w16 | head -n1)
tmp_pkg="package-lock.json.${rnd}"

if [ -f 'package-lock.json' ]; then
  mv package-lock.json "${tmp_pkg}"
fi

rimraf node_modules && npm install && npm run build && npm run test && rm package-lock.json

if [ -f "${tmp_pkg}" ]; then
  mv "${tmp_pkg}" package-lock.json
fi