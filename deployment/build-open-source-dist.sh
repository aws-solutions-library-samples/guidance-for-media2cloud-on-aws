#!/bin/bash

###
# Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License Version 2.0 (the 'License').
# You may not use this file except in compliance with the License.
# A copy of the License is located at
#
#         http://www.apache.org/licenses/
#
# or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#
##

###
# @author aws-mediaent-solutions
##

# always include the shared configuration file
source ./common.sh

######################################################################
#
# optional flags
#
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
      -s|--solution)
      SOLUTION="$2"
      shift # past key
      shift # past value
      ;;
      *)
      shift
      ;;
  esac
done

[ -z "${SOLUTION}" ] && \
  SOLUTION=$(grep_solution_name "../source/layers/core-lib/lib/index.js")

[ -z "${SOLUTION}" ] && \
  echo "error: SOLUTION variable is not defined" && \
  usage && \
  exit 1

echo "------------------------------------------------------------------------------"
echo "Building open-source Folder"
echo "------------------------------------------------------------------------------"

# Setting up diretory
DEPLOYMENT_DIR="$PWD"
OPENSRC_DIR="$DEPLOYMENT_DIR/open-source"
OPENSRC_DIST_DIR="$OPENSRC_DIR/dist"
SRC_DIR="$DEPLOYMENT_DIR/../source/"

#
# @function usage
#
function usage() {
  echo -e "
------------------------------------------------------------------------------

This script helps you to build open source code package
It should be run from the repo's deployment directory

------------------------------------------------------------------------------
cd deployment
bash ./build-open-source-dist.sh [--solution SOLUTION]

where
  --solution SOLUTION  [optional] if not specified, use 'solution name' from package.json
"
  return 0
}

#
# @function clear_start
#
function clear_start() {
  runcmd rm -rf "$OPENSRC_DIR"
  runcmd mkdir -p "$OPENSRC_DIST_DIR/deployment"
  # in case build system is macosx, delete any .DS_Store file
  find "$DEPLOYMENT_DIR" -name '.DS_Store' -type f -delete
  find "$SRC_DIR" -name '.DS_Store' -type f -delete
}

#
# @function copy_deployment_folder
#
function copy_deployment_folder() {
  echo "------------------------------------------------------------------------------"
  echo "Copying Deployment Folder"
  echo "------------------------------------------------------------------------------"
  local files=(\
    "build-s3-dist.sh" \
    "build-open-source-dist.sh" \
    "common.sh" \
    "deploy-s3-dist.sh" \
    "run-unit-tests.sh" \
  )
  cp -rv "$DEPLOYMENT_DIR"/*.yaml "$OPENSRC_DIST_DIR/deployment/"
  for file in "${files[@]}"; do
    runcmd cp -r "$DEPLOYMENT_DIR/$file" "$OPENSRC_DIST_DIR/deployment/"
  done
  # copy tutorials folder
  cp -rv "$DEPLOYMENT_DIR"/tutorials "$OPENSRC_DIST_DIR"/deployment/tutorials
  # copy .github PULL_REQUEST_TEMPLATE file
  cp -rv "$DEPLOYMENT_DIR"/../.github "$OPENSRC_DIST_DIR/"
}

function copy_standard_documents() {
  echo "------------------------------------------------------------------------------"
  echo "Copying Legal Related Documents"
  echo "------------------------------------------------------------------------------"
  local files=(\
    "CHANGELOG.md" \
    "CODE_OF_CONDUCT.md" \
    "CONTRIBUTING.md" \
    "LICENSE.txt" \
    "NOTICE.txt" \
    "README.md" \
  )
  pushd "$DEPLOYMENT_DIR"/..
  pwd
  for file in "${files[@]}"; do
    runcmd cp -r "$file" "$OPENSRC_DIST_DIR"/
  done
  popd
}

function copy_source_folder() {
  echo "------------------------------------------------------------------------------"
  echo "Copying Source Folder"
  echo "------------------------------------------------------------------------------"
  runcmd cp -r "$SRC_DIR" "$OPENSRC_DIST_DIR/source/"

  # clean up dist
  pushd "$OPENSRC_DIST_DIR/source"
  find . -name "dist" -type d -exec rm -rf "{}" \; 2> /dev/null
  find . -name "node_modules" -type d -exec rm -rf "{}" \; 2> /dev/null
  find . -name "image-process-lib" -type d -exec rm -rf "{}/t" \; 2> /dev/null
  find . -name "package-lock.json" -type f -delete
  popd
}

function create_github_zip() {
  echo "------------------------------------------------------------------------------"
  echo "Create GitHub zip File"
  echo "------------------------------------------------------------------------------"
  cd "$OPENSRC_DIST_DIR" || exit
  # zip -q -r9 ../${SOLUTION}.zip * .github .gitignore .tool-versions
  zip -q -r9 ../${SOLUTION}.zip * .github
  cd "$DEPLOYMENT_DIR" || exit
  rm -rf "$OPENSRC_DIST_DIR"
}

function on_complete() {
  echo "------------------------------------------------------------------------------"
  echo "Open Source Packaging Complete"
  echo "------------------------------------------------------------------------------"
}

clear_start
copy_deployment_folder
copy_standard_documents
copy_source_folder
create_github_zip
on_complete
