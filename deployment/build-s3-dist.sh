#!/bin/bash

###
 #  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        #
 #                                                                                                 #
 #  Licensed under the Amazon Software License (the "License"). You may not use this               #
 #  file except in compliance with the License. A copy of the License is located at                #
 #                                                                                                 #
 #      http://aws.amazon.com/asl/                                                                 #
 #                                                                                                 #
 #  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        #
 #  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       #
 #  for the specific language governing permissions and limitations under the License.             #
 #
 ##

###
 # @author MediaEnt Solutions
 ##

# always include the shared configuration file
source ./common.sh

#
# @function usage
#
function usage() {
  echo -e "
------------------------------------------------------------------------------

This script should be run from the repo's deployment directory

------------------------------------------------------------------------------
cd deployment
bash ./build-s3-dist.sh --bucket DEPLOY_BUCKET_BASENAME [--version VERSION]

where
  --bucket BUCKET_BASENAME    should be the base name for the S3 bucket location where
                              the template will store the Lambda code from.
                              This script will append '-[region_name]' to this bucket name.
                              For example, ./build-s3-dist.sh --bucket solutions
                              The template will expect the solution code to be located in the
                              solutions-[region_name] bucket
  --version VERSION           if not specified, use 'version' field from package.json
"
  return 0
}


######################################################################
#
# BUCKET must be defined through commandline option
#
# --bucket DEPLOY_BUCKET_BASENAME
#
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
      -b|--bucket)
      BUCKET="$2"
      shift # past key
      shift # past value
      ;;
      -v|--version)
      VERSION="$2"
      shift # past key
      shift # past value
      ;;
      *)
      shift
      ;;
  esac
done

## configure global variables
DEPLOY_DIR="$PWD"
DIST_DIR="$DEPLOY_DIR/dist"
SOURCE_DIR="$DEPLOY_DIR/../source"
TMP_DIR=$(mktemp -d)

[ -z "$BUCKET" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(grep_package_version "$SOURCE_DIR/backend/package.json")

[ -z "$VERSION" ] && \
  echo "error: can't find the versioning, please use --version parameter..." && \
  usage && \
  exit 1

#
# SOLUTION := grep solution name from package.json
#
SOLUTION=$(grep_package_name "$SOURCE_DIR/backend/package.json")
[ -z "$SOLUTION" ] && \
  echo "error: SOLUTION variable is not defined" && \
  usage && \
  exit 1


## zip packages' names
## note:
##   customer-resources and media2cloud packages could have
##   different versioning as they have different package.json
PACKAGENAME=$(grep_zip_name "$SOURCE_DIR/backend/package.json")
CUSTOMRESOURCES=$(grep_zip_name "$SOURCE_DIR/custom-resources/package.json")
WEBAPP_PACKAGE=$(grep_zip_name "$SOURCE_DIR/webapp/package.json")

## trap exit signal and make sure to remove the TMP_DIR
trap "rm -rf $TMP_DIR" EXIT

#
# @function clean_start
# @description
#   make sure to have a clean start
#
function clean_start() {
  echo "------------------------------------------------------------------------------"
  echo "Rebuild distribution"
  echo "------------------------------------------------------------------------------"
  rm -rf "$DIST_DIR"
  runcmd mkdir -p "$DIST_DIR"
  # in case build system is macosx, delete any .DS_Store file
  find "$DEPLOY_DIR" -name '.DS_Store' -type f -delete
  find "$SOURCE_DIR" -name '.DS_Store' -type f -delete
}

#
# @function build_cloudformation_templates
# @description
#   copy cloudformation templates
#   replace %PARAMS% variables with real names
#
function build_cloudformation_templates() {
  echo "------------------------------------------------------------------------------"
  echo "CloudFormation Templates"
  echo "------------------------------------------------------------------------------"
  # copy yaml to dist folder
  cp -rv *.yaml "$DIST_DIR/"

  pushd "$DIST_DIR"
  # solution name
  echo "Updating %SOLUTION% param in cloudformation templates..."
  sed -i'.bak' -e "s|%SOLUTION%|${SOLUTION}|g" *.yaml || exit 1
  # deployment bucket name
  echo "Updating %BUCKET% param in cloudformation templates..."
  sed -i'.bak' -e "s|%BUCKET%|${BUCKET}|g" *.yaml || exit 1
  # web package name
  echo "Updating %WEBAPP_PACKAGE% param in cloudformation templates..."
  sed -i'.bak' -e "s|%WEBAPP_PACKAGE%|${WEBAPP_PACKAGE}|g" *.yaml || exit 1
  # key prefix name
  local keyprefix="${SOLUTION}/${VERSION}"
  echo "Updating %KEYPREFIX% param in cloudformation templates..."
  sed -i'.bak' -e "s|%KEYPREFIX%|${keyprefix}|g" *.yaml || exit 1
  # package name
  echo "Updating %PACKAGENAME% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PACKAGENAME%|${PACKAGENAME}|g" *.yaml || exit 1
  # custom resource name
  echo "Updating %CUSTOMRESOURCES% param in cloudformation templates..."
  sed -i'.bak' -e "s|%CUSTOMRESOURCES%|${CUSTOMRESOURCES}|g" *.yaml || exit 1
  # remove .bak
  runcmd rm -v *.bak
  # rename .yaml to .template
  find . -name "*.yaml" -exec bash -c 'mv -v "$0" "${0%.yaml}.template"' {} \;
  popd
}

#
# @deprecated - pull the latest prebuilt media-analysis binary instead of building it
# @function build_media_analysis_package
# @description
#   download media-analysis-solution from github
#   build solution and copy lambda packages to deployment/dist/media-analysis folder
#   note that we are not using media-analysis CF templates at all!
#
function build_media_analysis_package() {
  echo "------------------------------------------------------------------------------"
  echo "Build media-analysis-solution from Github"
  echo "------------------------------------------------------------------------------"
  runcmd pushd "$TMP_DIR"
  echo "Download media-analysis-solution from github..."
  git clone --depth 1 https://github.com/awslabs/media-analysis-solution.git media-analysis

  echo "Build media-analysis-solution..."
  cd "media-analysis/deployment"
  bash ./run-unit-tests.sh
  bash ./build-s3-dist.sh $BUCKET $VERSION

  echo "Copy media-analysis-solution lambda packages..."
  cd "dist"
  local files=(\
    "media-analysis-api.zip" \
    "media-analysis-function.zip" \
    "media-analysis-helper.zip" \
  )
  for file in "${files[@]}"; do
    runcmd cp -rv "$file" "$DIST_DIR/media-analysis/"
  done
  runcmd popd
}

#
# @function build_media2cloud_package
# @description
#   build the main package and copy to deployment/dist folder
#
function build_media2cloud_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Media2Cloud Lambda package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/backend" || exit
  npm install
  npm run build
  npm run zip -- "$PACKAGENAME" .
  cp -v "./dist/$PACKAGENAME" "$DIST_DIR"
  popd
}

#
# @function build_custom_resources_package
# @description
#   build custom resources package and copy to deployment/dist folder
#
function build_custom_resources_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building custom resources Lambda package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/custom-resources" || exit
  npm install
  npm run build
  npm run zip -- "$CUSTOMRESOURCES" .
  cp -v "./dist/$CUSTOMRESOURCES" "$DIST_DIR"
  popd
}

#
# @function build_aws_iot_sdk_bundle
# @see https://github.com/aws/aws-iot-device-sdk-js
# @description
#   Build our own version of aws-iot-sdk-bundle with the following aws-sdk services:
#     * cognitoidentity
#     * cognitoidentityserviceprovider
#     * iot
#     * iotdata
#     * s3
#     * dynamodb
#
function build_aws_iot_sdk_bundle() {
  echo "------------------------------------------------------------------------------"
  echo "Building aws-iot-sdk-bundle"
  echo "------------------------------------------------------------------------------"
  local bundle="aws-iot-sdk-browser-bundle"
  local bundle_dir="$SOURCE_DIR/webapp/src/third_party/$bundle"

  pushd "$bundle_dir" || exit
  rm -rf "dist" && mkdir "dist"

  # create a tmp folder to run browserify and uglify processes
  local tmpdir="$TMP_DIR/$bundle"
  mkdir -p "$tmpdir"
  cp -v index.js package.json "$tmpdir"
  pushd "$tmpdir"
  npm install
  npm run browserify
  npm run uglify
  npm run copy -- "$bundle_dir/dist"
  popd

  popd
}

#
# @function build_amazon_cognito_identity_bundle
# @see https://www.npmjs.com/package/amazon-cognito-identity-js
# @description
#   Highly recommend to use amplify, https://aws-amplify.github.io/ instead
#   This project was started before amplify was mature.
#
function build_amazon_cognito_identity_bundle() {
  echo "------------------------------------------------------------------------------"
  echo "Building amazon_cognito_identity"
  echo "------------------------------------------------------------------------------"
  local bundle="amazon-cognito-identity-bundle"
  local bundle_dir="$SOURCE_DIR/webapp/src/third_party/$bundle"

  pushd "$bundle_dir" || exit
  npm install
  npm run copy -- "$bundle_dir"/dist
  popd
}

#
# @function build_third_party_bundle
# @description
#   build and copy third party bundle to dist
#      * spark-md5
#
function build_third_party_bundle() {
  echo "------------------------------------------------------------------------------"
  echo "Building third party bundle"
  echo "------------------------------------------------------------------------------"
  local bundle="spark-md5-bundle"
  local bundle_dir="$SOURCE_DIR/webapp/src/third_party/$bundle"

  pushd "$bundle_dir" || exit
  rm -rf "dist" && mkdir "dist"
  npm install --production
  npm run copy -- "$bundle_dir"/dist
  popd
}

#
# @function build_webapp_dependencies
# @description
#   Build all dependencies that are needed for the webapp
#
function build_webapp_dependencies() {
  echo "------------------------------------------------------------------------------"
  echo "Building webapp dependenceis for browser"
  echo "------------------------------------------------------------------------------"
  build_aws_iot_sdk_bundle
  build_amazon_cognito_identity_bundle
  build_third_party_bundle
}

#
# @function compute_jscript_integrity
# @description
#   compute SHA384 hash for all JS files and inject hash into <script integrity=hash> attribute
#
function compute_jscript_integrity() {
  echo "------------------------------------------------------------------------------"
  echo "Compute and Inject Integrity check to webapp"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/webapp/dist" || exit
  while [ $# -gt 0 ]; do
    local param=$1
    local file=$2
    shift; shift;
    local hash=$(openssl dgst -sha384 -binary "$file" | openssl base64 -A)
    echo "Updating $file integrity with $hash in demo.html..."
    sed -i'.bak' -e "s|${param}|${hash}|g" demo.html || exit 1
  done
  runcmd rm -v *.bak
  popd
}

#
# @function build_webapp_package
# @description
#   build webapp package and copy to deployment/dist folder
#
function build_webapp_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building webapp package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/webapp" || exit
  npm install
  npm run build

  # create a tmp folder to run browserify and uglify processes
  local tmpdir="$TMP_DIR/webapp"
  mkdir -p "$tmpdir"

  # browserify shared libraries
  local files=(\
    "$SOURCE_DIR/backend/lib/shared/db.js" \
    "$SOURCE_DIR/backend/lib/shared/dbConfig.js" \
    "$SOURCE_DIR/backend/lib/shared/signer.js" \
    "$SOURCE_DIR/backend/lib/shared/stateIOData.js" \
    "$SOURCE_DIR/backend/lib/shared/videoAsset.js" \
  )
  local browserify="./node_modules/.bin/browserify"
  $browserify ${files[@]} --exclude aws-sdk -o "$tmpdir/common-bundle.js"

  cp -v ./src/lib/js/*.js "$tmpdir"

  # save the uncompressed files to dist/dev
  mkdir "./dist/dev" && cp -rv "$tmpdir"/*.js "./dist/dev"

  # uglify webapp js files
  local uglify="./node_modules/.bin/uglifyjs"
  $uglify "$tmpdir"/*.js -o "$tmpdir/app.min.js"
  # copy app.min.js to dist/
  cp -rv "$tmpdir/app.min.js" "./dist/"

  # start building all third party bundles
  build_webapp_dependencies

  # copy all dependencies to webapp/dist/third_party
  local srcdir="$SOURCE_DIR/webapp/src/third_party"
  local dstdir="$SOURCE_DIR/webapp/dist/third_party"
  mkdir -p "$dstdir"
  cp -rv "$srcdir"/*/dist/*.min.js "$dstdir"

  # compute and insert integrity to webapp
  # (key1 val1 key2 val2 ... keyN valN)
  local files=(\
    "%SRI_APP_JS%" \
    "app.min.js" \
    "%SRI_APP_CSS%" \
    "css/app.css" \
    "%SRI_COGNITO_IDENTITY_JS%" \
    "third_party/amazon-cognito-identity.min.js" \
    "%SRI_IOT_SDK_JS%" \
    "third_party/aws-iot-sdk-bundle.min.js" \
    "%SRI_SPARK_MD5_JS%" \
    "third_party/spark-md5.min.js" \
  )
  compute_jscript_integrity ${files[@]}

  # now, zip and package all the files
  npm run zip -- "$WEBAPP_PACKAGE" . -x ./dev**
  cp -v "./dist/$WEBAPP_PACKAGE" "$DIST_DIR"
  popd
}

function on_complete() {
  echo "------------------------------------------------------------------------------"
  echo "S3 Packaging Complete"
  echo "------------------------------------------------------------------------------"
}


#
# main routine goes here
#
clean_start
build_cloudformation_templates
#build_media_analysis_package
build_media2cloud_package
build_custom_resources_package
build_webapp_package
on_complete

