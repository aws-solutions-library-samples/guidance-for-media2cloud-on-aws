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

#
# @function usage
#
function usage() {
  echo -e "
------------------------------------------------------------------------------

This script should be run from the repo's deployment directory

------------------------------------------------------------------------------
cd deployment
bash ./build-s3-dist.sh --bucket DEPLOY_BUCKET_BASENAME [--solution SOLUTION] [--version VERSION]

where
  --bucket BUCKET_BASENAME    should be the base name for the S3 bucket location where
                              the template will store the Lambda code from.
                              This script will append '-[region_name]' to this bucket name.
                              For example, ./build-s3-dist.sh --bucket solutions
                              The template will expect the solution code to be located in the
                              solutions-[region_name] bucket

  --solution SOLUTION         [optional] if not specified, default to 'media2cloud'

  --version VERSION           [optional] if not specified, use 'version' field from package.json
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
      -s|--solution)
      SOLUTION="$2"
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
SOURCE_DIR="$DEPLOY_DIR/../source"
TEMPLATE_DIST_DIR="$DEPLOY_DIR/global-s3-assets"
BUILD_DIST_DIR="$DEPLOY_DIR/regional-s3-assets"
TMP_DIR=$(mktemp -d)

[ -z "$BUCKET" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(grep_solution_version "$SOURCE_DIR/layers/core-lib/lib/index.js")

[ -z "$VERSION" ] && \
  echo "error: can't find the versioning, please use --version parameter..." && \
  usage && \
  exit 1

[ -z "$SOLUTION" ] && \
  SOLUTION=$(grep_solution_name "$SOURCE_DIR/layers/core-lib/lib/index.js")

[ -z "$SOLUTION" ] && \
  echo "error: SOLUTION variable is not defined" && \
  usage && \
  exit 1

#
# zip packages
#
## Custom resource package
PKG_CUSTOM_RESOURCES=

## Lambda layer package(s)
LAYER_AWSSDK=
LAYER_MEDIAINFO=
LAYER_CORE_LIB=
LAYER_IMAGE_PROCESS=
LAYER_FIXITY_LIB=
# note: core-lib for custom resource
CORE_LIB_LOCAL_PKG=

## modular workflow package(s)
PKG_S3EVENT=
PKG_INGEST=
PKG_ANALYSIS_MONITOR=
PKG_AUDIO_ANALYSIS=
PKG_VIDEO_ANALYSIS=
PKG_IMAGE_ANALYSIS=
PKG_DOCUMENT_ANALYSIS=
PKG_GT_LABELING=
PKG_API=
PKG_ERROR_HANDLER=
PKG_WEBAPP=

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
  local dir
  # remake dirs
  for dir in "$TEMPLATE_DIST_DIR" "$BUILD_DIST_DIR"; do
    rm -rf "$dir"
    runcmd mkdir -p "$dir"
  done
  # remove .DS_Store
  for dir in "$DEPLOY_DIR" "$SOURCE_DIR"; do
    find "$dir" -name '.DS_Store' -type f -delete
  done
  # delete all package-lock.json
  find "$SOURCE_DIR" -name 'package-lock.json' -type f -delete
}

function install_dev_dependencies() {
  echo "------------------------------------------------------------------------------"
  echo "Install node package dependencies"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR"
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
  runcmd cp -rv *.yaml "$TEMPLATE_DIST_DIR/"
  pushd "$TEMPLATE_DIST_DIR"

  # solution name
  echo "Updating %SOLUTION% param in cloudformation templates..."
  sed -i'.bak' -e "s|%SOLUTION%|${SOLUTION}|g" *.yaml || exit 1

  # solution version
  echo "Updating %VERSION% param in cloudformation templates..."
  sed -i'.bak' -e "s|%VERSION%|${VERSION}|g" *.yaml || exit 1

  # deployment bucket name
  echo "Updating %BUCKET% param in cloudformation templates..."
  sed -i'.bak' -e "s|%BUCKET%|${BUCKET}|g" *.yaml || exit 1

  # key prefix name
  local keyprefix="${SOLUTION}/${VERSION}"
  echo "Updating %KEYPREFIX% param in cloudformation templates..."
  sed -i'.bak' -e "s|%KEYPREFIX%|${keyprefix}|g" *.yaml || exit 1

  # web package name
  echo "Updating %PKG_WEBAPP% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_WEBAPP%|${PKG_WEBAPP}|g" *.yaml || exit 1

  # layer aws-sdk name
  echo "Updating %LAYER_AWSSDK% param in cloudformation templates..."
  sed -i'.bak' -e "s|%LAYER_AWSSDK%|${LAYER_AWSSDK}|g" *.yaml || exit 1

  echo "Updating %LAYER_CORE_LIB% param in cloudformation templates..."
  sed -i'.bak' -e "s|%LAYER_CORE_LIB%|${LAYER_CORE_LIB}|g" *.yaml || exit 1

  echo "Updating %LAYER_MEDIAINFO% param in cloudformation templates..."
  sed -i'.bak' -e "s|%LAYER_MEDIAINFO%|${LAYER_MEDIAINFO}|g" *.yaml || exit 1

  echo "Updating %LAYER_IMAGE_PROCESS% param in cloudformation templates..."
  sed -i'.bak' -e "s|%LAYER_IMAGE_PROCESS%|${LAYER_IMAGE_PROCESS}|g" *.yaml || exit 1

  echo "Updating %LAYER_FIXITY_LIB% param in cloudformation templates..."
  sed -i'.bak' -e "s|%LAYER_FIXITY_LIB%|${LAYER_FIXITY_LIB}|g" *.yaml || exit 1

  # custom resource name
  echo "Updating %PKG_CUSTOM_RESOURCES% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_CUSTOM_RESOURCES%|${PKG_CUSTOM_RESOURCES}|g" *.yaml || exit 1

  # package name
  echo "Updating %PKG_S3EVENT% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_S3EVENT%|${PKG_S3EVENT}|g" *.yaml || exit 1

  echo "Updating %PKG_INGEST% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_INGEST%|${PKG_INGEST}|g" *.yaml || exit 1

  echo "Updating %PKG_ANALYSIS_MONITOR% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_ANALYSIS_MONITOR%|${PKG_ANALYSIS_MONITOR}|g" *.yaml || exit 1

  echo "Updating %PKG_AUDIO_ANALYSIS% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_AUDIO_ANALYSIS%|${PKG_AUDIO_ANALYSIS}|g" *.yaml || exit 1

  echo "Updating %PKG_VIDEO_ANALYSIS% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_VIDEO_ANALYSIS%|${PKG_VIDEO_ANALYSIS}|g" *.yaml || exit 1

  echo "Updating %PKG_IMAGE_ANALYSIS% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_IMAGE_ANALYSIS%|${PKG_IMAGE_ANALYSIS}|g" *.yaml || exit 1

  echo "Updating %PKG_DOCUMENT_ANALYSIS% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_DOCUMENT_ANALYSIS%|${PKG_DOCUMENT_ANALYSIS}|g" *.yaml || exit 1

  echo "Updating %PKG_GT_LABELING% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_GT_LABELING%|${PKG_GT_LABELING}|g" *.yaml || exit 1

  echo "Updating %PKG_ERROR_HANDLER% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_ERROR_HANDLER%|${PKG_ERROR_HANDLER}|g" *.yaml || exit 1

  echo "Updating %PKG_API% param in cloudformation templates..."
  sed -i'.bak' -e "s|%PKG_API%|${PKG_API}|g" *.yaml || exit 1

  # remove .bak
  runcmd rm -v *.bak
  # rename .yaml to .template
  find . -name "*.yaml" -exec bash -c 'mv -v "$0" "${0%.yaml}.template"' {} \;
  # copy templates to regional bucket as well
  cp -v *.template "$BUILD_DIST_DIR"

  popd
}

#
# @function build_awssdk_layer
# @description
#   build layer packages and copy to deployment/dist folder
#
function build_awssdk_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building aws-sdk layer package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/layers/aws-sdk-layer/nodejs" || exit
  npm install
  npm run build

  local version=$(grep_package_version "./dist/nodejs/node_modules/aws-sdk/package.json")
  local package=$(grep_package_name "./dist/nodejs/package.json")
  LAYER_AWSSDK="${package}_${version}.zip"

  npm run zip -- "$LAYER_AWSSDK" .
  cp -v "./dist/${LAYER_AWSSDK}" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_core_lib_layer
# @description
#   build layer packages and copy to deployment/dist folder
#
function build_core_lib_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building M2C Core Library layer package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/layers/core-lib" || exit
  LAYER_CORE_LIB=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$LAYER_CORE_LIB" .
  cp -v "./dist/${LAYER_CORE_LIB}" "$BUILD_DIST_DIR"
  # also create a local package for custom resource
  pushd "./dist/nodejs/node_modules/m2c-core-lib"
  CORE_LIB_LOCAL_PKG="$(pwd)/$(npm pack)"
  popd
  popd
}

#
# @function build_mediainfo_layer
# @description
#   build layer packages and copy to deployment/dist folder
#
function build_mediainfo_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building mediainfo layer package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/layers/mediainfo" || exit
  LAYER_MEDIAINFO=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$LAYER_MEDIAINFO" .
  cp -v "./dist/${LAYER_MEDIAINFO}" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_image_process_layer
# @description
#   build layer packages and copy to deployment/dist folder
#
function build_image_process_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building image-process layer package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/layers/image-process-lib" || exit
  LAYER_IMAGE_PROCESS=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$LAYER_IMAGE_PROCESS" .
  cp -v "./dist/${LAYER_IMAGE_PROCESS}" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_fixity_layer
# @description
#   build layer packages and copy to deployment/dist folder
#
function build_fixity_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building fixity layer package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/layers/fixity-lib" || exit
  LAYER_FIXITY_LIB=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$LAYER_FIXITY_LIB" .
  cp -v "./dist/${LAYER_FIXITY_LIB}" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_s3event_package
# @description
#   build s3event package and copy to deployment/dist folder
#
function build_s3event_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building S3 Event trigger package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/s3event" || exit
  PKG_S3EVENT=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_S3EVENT" .
  cp -v "./dist/$PKG_S3EVENT" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_ingest_package
# @description
#   build the ingest state machine package and copy to deployment/dist folder
#
function build_ingest_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest State Machine package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/ingest" || exit
  PKG_INGEST=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_INGEST" .
  cp -v "./dist/$PKG_INGEST" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_analysis_monitor_package
# @description
#   build analysis state machine package and copy to deployment/dist folder
#
function build_analysis_monitor_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Analysis Monitor state machine package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/analysis-monitor" || exit
  PKG_ANALYSIS_MONITOR=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_ANALYSIS_MONITOR" .
  cp -v "./dist/$PKG_ANALYSIS_MONITOR" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_audio_analysis_package
# @description
#   build audio analysis state machine package and copy to deployment/dist folder
#
function build_audio_analysis_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Audio Analysis state machine package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/audio-analysis" || exit
  PKG_AUDIO_ANALYSIS=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_AUDIO_ANALYSIS" .
  cp -v "./dist/$PKG_AUDIO_ANALYSIS" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_video_analysis_package
# @description
#   build video analysis state machine package and copy to deployment/dist folder
#
function build_video_analysis_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Video Analysis state machine package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/video-analysis" || exit
  PKG_VIDEO_ANALYSIS=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_VIDEO_ANALYSIS" .
  cp -v "./dist/$PKG_VIDEO_ANALYSIS" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_image_analysis_package
# @description
#   build image analysis state machine package and copy to deployment/dist folder
#
function build_image_analysis_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Image Analysis state machine package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/image-analysis" || exit
  PKG_IMAGE_ANALYSIS=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_IMAGE_ANALYSIS" .
  cp -v "./dist/$PKG_IMAGE_ANALYSIS" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_document_analysis_package
# @description
#   build document analysis state machine package and copy to deployment/dist folder
#
function build_document_analysis_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Document Analysis state machine package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/document-analysis" || exit
  PKG_DOCUMENT_ANALYSIS=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_DOCUMENT_ANALYSIS" .
  cp -v "./dist/$PKG_DOCUMENT_ANALYSIS" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_gt_labeling_package
# @description
#   build audio analysis state machine package and copy to deployment/dist folder
#
function build_gt_labeling_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ground Truth state machine package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/gt-labeling" || exit
  PKG_GT_LABELING=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_GT_LABELING" .
  cp -v "./dist/$PKG_GT_LABELING" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_error_handler_package
# @description
#   build state machine error handler package and copy to deployment/dist folder
#
function build_error_handler_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Error Handler package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/error-handler" || exit
  PKG_ERROR_HANDLER=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_ERROR_HANDLER" .
  cp -v "./dist/$PKG_ERROR_HANDLER" "$BUILD_DIST_DIR"
  popd
}

#
# @function build_api_package
# @description
#   build api lambda package and copy to deployment/dist folder
#
function build_api_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building API Gateway lambda package"
  echo "------------------------------------------------------------------------------"
  pushd "$SOURCE_DIR/api" || exit
  PKG_API=$(grep_zip_name "./package.json")
  npm install
  npm run build
  npm run zip -- "$PKG_API" .
  cp -v "./dist/$PKG_API" "$BUILD_DIST_DIR"
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
  PKG_CUSTOM_RESOURCES=$(grep_zip_name "./package.json")
  npm install
  npm run build
  # explicitly package core-lib in custom resource package
  pushd dist
  npm install --production --no-save "$CORE_LIB_LOCAL_PKG"
  popd
  #
  npm run zip -- "$PKG_CUSTOM_RESOURCES" .
  cp -v "./dist/$PKG_CUSTOM_RESOURCES" "$BUILD_DIST_DIR"
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
# @function build_spark_md5_bundle
# @description
#   build and copy third party bundle to dist
#      * spark-md5
#
function build_spark_md5_bundle() {
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
# @function build_cropper_bundle
# @description
#   build and copy cropper bundle to dist
#      * cropper
#
function build_cropper_bundle() {
  echo "------------------------------------------------------------------------------"
  echo "Building cropper bundle"
  echo "------------------------------------------------------------------------------"
  local bundle="cropper-bundle"
  local bundle_dir="$SOURCE_DIR/webapp/src/third_party/$bundle"

  pushd "$bundle_dir" || exit
  rm -rf "dist" && mkdir "dist"
  npm install --production
  npm run copy -- "$bundle_dir"/dist
  popd
}

#
# @function build_mime_bundle
# @see https://www.npmjs.com/package/mime
# @description
#   browserify mime library
#
function build_mime_bundle() {
  echo "------------------------------------------------------------------------------"
  echo "Building mime-bundle"
  echo "------------------------------------------------------------------------------"
  local bundle="mime-bundle"
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

function build_videojs_bundle() {
  echo "------------------------------------------------------------------------------"
  echo "Building videojs bundle"
  echo "------------------------------------------------------------------------------"
  local bundle="videojs-bundle"
  local bundle_dir="$SOURCE_DIR/webapp/src/third_party/$bundle"

  pushd "$bundle_dir" || exit
  npm run build
  popd
}

function build_videojs_markers_bundle() {
  echo "------------------------------------------------------------------------------"
  echo "Building videojs-markers bundle"
  echo "------------------------------------------------------------------------------"
  local bundle="videojs-markers-bundle"
  local bundle_dir="$SOURCE_DIR/webapp/src/third_party/$bundle"

  pushd "$bundle_dir" || exit
  npm run build
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
  build_spark_md5_bundle
  build_cropper_bundle
  build_mime_bundle
  build_videojs_bundle
  build_videojs_markers_bundle
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
  PKG_WEBAPP=$(grep_zip_name "./package.json")
  npm install
  npm run build

  # create a tmp folder to run browserify and uglify processes
  local tmpdir="$TMP_DIR/webapp"
  mkdir -p "$tmpdir"

  # browserify shared libraries
  local files=

  # grep a list of files that exposes AWSomeNamespace
  local list=($(grep AWSomeNamespace "$SOURCE_DIR/layers/core-lib/lib/"*.js))
  for f in "${list[@]}"; do
    case "$f" in
      *\.js:)
        echo "${f%%:}"
        files=("${files[@]}" ${f%%:})
        ;;
    esac
  done

  local browserify="browserify"
  $browserify ${files[@]} --exclude aws-sdk -o "$tmpdir/common-bundle.js"
  [ $? -ne 0 ] && exit 1

  cp -rv ./src/lib/js/* "$tmpdir"/

  # save the uncompressed files to dist/dev
  mkdir "./dist/dev" && cp -rv "$tmpdir"/ "./dist/dev/"

  # uglify webapp js files
  local uglify="uglifyjs"
  $uglify "$tmpdir"/mixins/*.js \
    "$tmpdir"/shared/*.js \
    "$tmpdir"/*.js -o \
    "$tmpdir/app.min.js"
  [ $? -ne 0 ] && exit 1

  # copy app.min.js to dist/
  cp -rv "$tmpdir/app.min.js" "./dist/"
  [ $? -ne 0 ] && exit 1

  # start building all third party bundles
  build_webapp_dependencies

  # copy all dependencies to webapp/dist/third_party
  local srcdir="$SOURCE_DIR/webapp/src/third_party"
  local dstdir="$SOURCE_DIR/webapp/dist/third_party"
  mkdir -p "$dstdir"
  cp -rv "$srcdir"/*/dist/*.min.js "$dstdir"
  cp -rv "$srcdir"/*/dist/*.min.css "$dstdir"

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
    "%SRI_CROPPER_JS%" \
    "third_party/cropper.min.js" \
    "%SRI_CROPPER_CSS%" \
    "third_party/cropper.min.css" \
    "%SRI_MIME_JS%" \
    "third_party/mime.min.js" \
    "%SRI_VIDEOJS_CSS%" \
    "third_party/video-js.min.css" \
    "%SRI_VIDEOJS%" \
    "third_party/video.min.js" \
    "%SRI_VIDEOJS_MARKERS_CSS%" \
    "third_party/videojs.markers.min.css" \
    "%SRI_VIDEOJS_MARKERS%" \
    "third_party/videojs-markers.min.js" \
  )
  compute_jscript_integrity ${files[@]}

  # now, zip and package all the files
  npm run zip -- "$PKG_WEBAPP" . -x ./dev**
  cp -v "./dist/$PKG_WEBAPP" "$BUILD_DIST_DIR"
  popd
}

function on_complete() {
  echo "------------------------------------------------------------------------------"
  echo "S3 Packaging Complete. (${SOLUTION} ${VERSION})"
  echo "------------------------------------------------------------------------------"
  echo "** LAYER_AWSSDK=${LAYER_AWSSDK} **"
  echo "** LAYER_CORE_LIB=${LAYER_CORE_LIB} **"
  echo "** LAYER_MEDIAINFO=${LAYER_MEDIAINFO} **"
  echo "** LAYER_IMAGE_PROCESS=${LAYER_IMAGE_PROCESS} **"
  echo "** LAYER_FIXITY_LIB=${LAYER_FIXITY_LIB} **"
  echo "** PKG_CUSTOM_RESOURCES=${PKG_CUSTOM_RESOURCES} **"
  echo "** PKG_S3EVENT=${PKG_S3EVENT} **"
  echo "** PKG_INGEST=${PKG_INGEST} **"
  echo "** PKG_ANALYSIS_MONITOR=${PKG_ANALYSIS_MONITOR} **"
  echo "** PKG_AUDIO_ANALYSIS=${PKG_AUDIO_ANALYSIS} **"
  echo "** PKG_VIDEO_ANALYSIS=${PKG_VIDEO_ANALYSIS} **"
  echo "** PKG_IMAGE_ANALYSIS=${PKG_IMAGE_ANALYSIS} **"
  echo "** PKG_DOCUMENT_ANALYSIS=${PKG_DOCUMENT_ANALYSIS} **"
  echo "** PKG_GT_LABELING=${PKG_GT_LABELING} **"
  echo "** PKG_ERROR_HANDLER=${PKG_ERROR_HANDLER} **"
  echo "** PKG_API=${PKG_API} **"
  echo "** PKG_WEBAPP=${PKG_WEBAPP} **"
}

#
# main routine goes here
#
clean_start
install_dev_dependencies

# layers
build_awssdk_layer
build_core_lib_layer
build_fixity_layer
build_mediainfo_layer
build_image_process_layer
# custom resource
build_custom_resources_package
# ingest
build_s3event_package
build_ingest_package
# analysis
build_analysis_monitor_package
build_audio_analysis_package
build_video_analysis_package
build_image_analysis_package
build_document_analysis_package
# ground-truth
build_gt_labeling_package
# state machine error handler
build_error_handler_package
# api
build_api_package
# webapp
build_webapp_package
# cloudformation
build_cloudformation_templates
on_complete
