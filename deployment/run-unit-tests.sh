#!/bin/bash

# This script should be run from the repo's deployment directory
# cd deployment
# ./run-unit-tests.sh

# Run unit tests
echo "Running unit tests"
echo "------------------------------------------------------------------------------"
echo "Installing Dependencies And Testing Analysis"
echo "------------------------------------------------------------------------------"
pushd ../source/backend
npm install
npm test
popd

echo "------------------------------------------------------------------------------"
echo "Installing Dependencies And Testing API"
echo "------------------------------------------------------------------------------"
pushd ../source/custom-resources
npm install
npm test
popd

echo "------------------------------------------------------------------------------"
echo "Installing Dependencies And Testing Helper"
echo "------------------------------------------------------------------------------"
pushd ../source/webapp
npm install
#npm test
popd

echo "------------------------------------------------------------------------------"
echo "Installing Dependencies And Testing Complete"
echo "------------------------------------------------------------------------------"
