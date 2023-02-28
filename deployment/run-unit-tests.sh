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
  "layers/core-lib" \ 
  "layers/mediainfo" \ 
  "layers/service-backlog-lib/" \
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
echo "Running Unit Tests now. This may take a while."
echo "------------------------------------------------------------------------------"

[ "$DEBUG" == 'true' ] && set -x
set -e

prepare_jest_coverage_report() {
  local component_name=$1

  if [ ! -d "coverage" ]; then
      echo "ValidationError: Missing required directory coverage after running unit tests"
      exit 129
  fi

  # prepare coverage reports
  rm -fr coverage/lcov-report
  mkdir -p $coverage_reports_top_path/jest
  coverage_report_path=$coverage_reports_top_path/jest/$component_name
  rm -fr $coverage_report_path
  mv coverage $coverage_report_path
}

# Get reference for all important folders
template_dir="$PWD"
source_dir="$template_dir/../source"
coverage_reports_top_path=$source_dir/test/coverage-reports
