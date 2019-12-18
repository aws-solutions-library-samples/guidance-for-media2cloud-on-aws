#!/bin/bash

# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh

# Run unit tests
echo "Running unit tests"

echo "------------------------------------------------------------------------------"
echo "Installing Testing Dependencies"
echo "------------------------------------------------------------------------------"
pushd ../source
npm install -g \
  aws-sdk \
  aws-sdk-mock \
  browserify \
  chai \
  eslint \
  eslint-config-airbnb-base \
  eslint-plugin-import \
  mocha \
  nock \
  npm-run-all \
  sinon \
  sinon-chai \
  uglify-es
popd


#
# Testing lambda packages
#
PACKAGES=(\
  "api" \
  "ingest" \
  "analysis-monitor" \
  "image-analysis" \
  "audio-analysis" \
  "video-analysis" \
  "document-analysis" \
  "gt-labeling" \
)

for package in "${PACKAGES[@]}"; do
  echo "------------------------------------------------------------------------------"
  echo "Testing Package ${package}"
  echo "------------------------------------------------------------------------------"
  pushd ../source/${package}
  npm install
  npm test
  popd
done

#
# Testing lambda layers
#
LAYERS=(\
  "mediainfo" \
)

for layer in "${LAYERS[@]}"; do
  echo "------------------------------------------------------------------------------"
  echo "Testing Layer ${layer}"
  echo "------------------------------------------------------------------------------"
  pushd ../source/layers/${layer}
  npm install
  npm test
  popd
done


echo "------------------------------------------------------------------------------"
echo "Installing Dependencies And Testing Complete"
echo "------------------------------------------------------------------------------"
