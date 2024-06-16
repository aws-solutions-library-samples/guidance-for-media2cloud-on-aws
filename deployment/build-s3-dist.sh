#!/bin/bash

########################################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
########################################################################################

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
bash ./build-s3-dist.sh --bucket DEPLOY_BUCKET_BASENAME [--solution SOLUTION] [--version VERSION] [--single-region]

where
  --bucket BUCKET_NAME        specify the bucket name where the templates and packages deployed to.
                              By default, the script deploys the templates and packages across all regions
                              where '--bucket' setting is treated as a basename of the bucket and a region
                              string is automatically appended to the bucket name. For example,
                              if you specify '--bucket MY_BUCKET', then the actual bucket name(s) become
                              MY_BUCKET-us-east-1, MY_BUCKET-eu-west-1, and so forth. (All region
                              deployments require that all regional buckets are already created.
                              Use '--single-region' flag to deploy to a single region (single bucket). 

  --solution SOLUTION         [optional] if not specified, default to 'media2cloud'

  --version VERSION           [optional] if not specified, use 'version' field from package.json

  --single-region             [optional] specify if it is to deploy to a single region. This affects
                              how the solution template looks up the location of the packages. If
                              '--single-region' is specified, the solution stores templates and
                              packages in the bucket that you specify in '--bucket' setting.
                              If '--single-region' is not specified, the solution stores templates
                              and packages in the bucket that uses region suffix. For example, if
                              --bucket MY_BUCKET, then the actual bucket name will be 'MY_BUCKET-us-east-1'

  --dev                       [optional] if specified, set template for development
"
  return 0
}

######################################################################
#
# BUCKET_NAME must be defined through commandline option
#
# --bucket DEPLOY_BUCKET_BASENAME
#
BUILD_ENV=
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
      -b|--bucket)
      BUCKET_NAME="$2"
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
      -d|--dev)
      BUILD_ENV="dev"
      shift # past key
      ;;
      -r|--single-region)
      SINGLE_REGION=true
      shift # past key
      ;;
      *)
      shift
      ;;
  esac
done

## configure global variables
NODEJS_VERSION=$(node --version)
DEPLOY_DIR="$PWD"
SOURCE_DIR="$DEPLOY_DIR/../source"
TEMPLATE_DIST_DIR="$DEPLOY_DIR/global-s3-assets"
BUILD_DIST_DIR="$DEPLOY_DIR/regional-s3-assets"
TMP_DIR=$(mktemp -d)

# make sure nodejs v20 is installed
[[ ! "${NODEJS_VERSION}" =~ "v20" ]] && \
  echo "error: Node JS Version must be v20" && \
  exit 1

# make sure docker is installed
[ "$(which docker)" == "" ] && \
  echo "error: Docker is required to build some lambda layers" && \
  exit 1

[ "$(which jq)" == "" ] && \
  echo "error: JQ command line tool is required" && \
  exit 1

[ "$(which aws)" == "" ] && \
  echo "error: AWS CLI command line tool is required" && \
  exit 1

[ -z "$SOLUTION_ID" ] && \
  echo "error: can't find SOLUTION_ID..." && \
  usage && \
  exit 1

[ -z "$BUCKET_NAME" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(cat "$SOURCE_DIR/layers/core-lib/lib/.version")

[ -z "$VERSION" ] && \
  echo "error: can't find the versioning, please use --version parameter..." && \
  usage && \
  exit 1

[ -z "$SOLUTION" ] && \
  SOLUTION="media2cloud"

[ -z "$SINGLE_REGION" ] && \
  SINGLE_REGION=false

## Lambda layer package(s)
LAYER_AWSSDK=
LAYER_MEDIAINFO=
LAYER_CORE_LIB=
LAYER_JIMP=
LAYER_IMAGE_PROCESS=
LAYER_FIXITY_LIB=
LAYER_PDF_LIB=
LAYER_BACKLOG=
# note: core-lib for custom resource
CORE_LIB_LOCAL_PKG=

## Ingest Workflow packages ##
PKG_INGEST_MAIN=
PKG_INGEST_FIXITY=
PKG_INGEST_VIDEO=
PKG_INGEST_AUDIO=
PKG_INGEST_IMAGE=
PKG_INGEST_DOCUMENT=
PKG_INGEST_STATUS_UPDATER=
## Analysis Workflow packages ##
PKG_ANALYSIS_MAIN=
PKG_ANALYSIS_AUDIO=
PKG_ANALYSIS_VIDEO=
PKG_ANALYSIS_IMAGE=
PKG_ANALYSIS_DOCUMENT=
PKG_ANALYSIS_STATUS_UPDATER=
PKG_BACKLOG_STATUS_UPDATER=
PKG_BACKLOG_STREAM_CONNECTOR=
PKG_BACKLOG_CUSTOMLABELS=
## Main Workflow ##
PKG_ERROR_HANDLER=
PKG_MAIN_S3EVENT=
## CloudFormation Custom Resource ##
PKG_CUSTOM_RESOURCES=
## WebApp packages ##
PKG_API=
PKG_WEBAPP=

## anonymized data setting
ANONYMIZED_DATA="Yes"
[ "$BUILD_ENV" == "dev" ] && \
  ANONYMIZED_DATA="No"

# bucket account owner
ACCOUNTID=$(aws sts get-caller-identity | jq .Account | tr -d \")
[ -z "$ACCOUNTID" ] && \
  echo "error: fail to get AWS Account ID" && \
  exit 1

# check to make sure the deployment bucket belongs to the same account
[ "$(aws s3api get-bucket-location --bucket ${BUCKET_NAME} --expected-bucket-owner ${ACCOUNTID} | jq .LocationConstraint | tr -d \")" == "" ] && \
  echo "error: deployment bucket, \"${BUCKET_NAME}\" doesn't belong to the same AWS Account" && \
  exit 1

## trap exit signal and make sure to remove the TMP_DIR
trap "rm -rf $TMP_DIR" EXIT

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
    chai \
    eslint \
    eslint-config-airbnb-base \
    eslint-plugin-import \
    browserify \
    terser \
    mocha \
    nock \
    npm-run-all \
    sinon \
    sinon-chai
  popd
}

#####################################################################
#
# Lambda Layer packages
#
#####################################################################
function build_layer_packages() {
  echo "------------------------------------------------------------------------------"
  echo "Building Lambda Layer Packages"
  echo "------------------------------------------------------------------------------"
  build_awssdk_layer
  build_core_lib_layer
  build_fixity_layer
  build_mediainfo_layer
  build_jimp_layer
  build_image_process_layer
  build_pdf_layer
  build_backlog_layer
}

function build_awssdk_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building aws-sdk layer package"
  echo "------------------------------------------------------------------------------"
  local package="aws-sdk-layer"
  LAYER_AWSSDK="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/layers/${package}/nodejs"
  npm install
  npm run build
  npm run zip -- "$LAYER_AWSSDK" .
  cp -v "./dist/${LAYER_AWSSDK}" "$BUILD_DIST_DIR"
  popd
}

function build_core_lib_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building M2C Core Library layer package"
  echo "------------------------------------------------------------------------------"
  local package="core-lib"
  LAYER_CORE_LIB="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/layers/${package}"
  npm install
  npm run build

  npm run zip -- "$LAYER_CORE_LIB" .
  cp -v "./dist/${LAYER_CORE_LIB}" "$BUILD_DIST_DIR"
  # also create a local package for custom resource
  pushd "./dist/nodejs/node_modules/${package}"
  CORE_LIB_LOCAL_PKG="$(pwd)/$(npm pack)"
  popd
  popd
}

function build_mediainfo_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building mediainfo layer package"
  echo "------------------------------------------------------------------------------"
  local package="mediainfo"
  LAYER_MEDIAINFO="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/layers/${package}"
  npm install
  npm run build
  npm run zip -- "$LAYER_MEDIAINFO" .
  cp -v "./dist/${LAYER_MEDIAINFO}" "$BUILD_DIST_DIR"
  popd
}

function build_jimp_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building JIMP layer package"
  echo "------------------------------------------------------------------------------"
  local package="jimp"
  LAYER_JIMP="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/layers/${package}"
  npm install
  npm run build
  npm run zip -- "$LAYER_JIMP" .
  cp -v "./dist/${LAYER_JIMP}" "$BUILD_DIST_DIR"
  popd
}

function build_image_process_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building image-process (EXIFTOOL) layer package"
  echo "------------------------------------------------------------------------------"
  local package="image-process-lib"
  LAYER_IMAGE_PROCESS="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/layers/${package}"

  mkdir ./dist

  # If a pre-built package matched the version, skip building
  local latestVersion=$(cat package.json | jq .version | tr -d \")
  local bucket=$BUCKET_NAME
  local key="${SOLUTION}/prebuilt/layers/${package}/${latestVersion}.zip"

  local response=$(aws s3 cp s3://${bucket}/${key} $BUILD_DIST_DIR/${LAYER_IMAGE_PROCESS})
  if [ "$response" != "" ] && [ -f $BUILD_DIST_DIR/${LAYER_IMAGE_PROCESS} ]; then
    echo "=== Using Prebuilt package (${latestVersion}.zip) for \"${package}\" ==="
    popd
    return 0
  fi

  # docker builds Perl5 runtime and exiftool, then package to package.zip
  docker build -t ${package} .
  [ $? -ne 0 ] && exit 1

  # create a container so we can copy the zip package to local host
  local id=$(docker create ${package})
  docker cp ${id}:/var/task/package.zip ./dist/${LAYER_IMAGE_PROCESS}

  # remove container
  docker rm -v $id

  # remove image
  docker rmi ${package}

  # copy the prebuilt package to s3 bucket
  aws s3api put-object \
  --bucket ${bucket} \
  --key ${key} \
  --body "./dist/${LAYER_IMAGE_PROCESS}" \
  --expected-bucket-owner ${ACCOUNTID}

  mv -v "./dist/${LAYER_IMAGE_PROCESS}" "$BUILD_DIST_DIR"

  popd
}

function build_fixity_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building fixity layer package"
  echo "------------------------------------------------------------------------------"
  local package="fixity-lib"
  LAYER_FIXITY_LIB="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/layers/${package}"
  npm install
  npm run build
  npm run zip -- "$LAYER_FIXITY_LIB" .
  cp -v "./dist/${LAYER_FIXITY_LIB}" "$BUILD_DIST_DIR"
  popd
}

function build_pdf_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building PDF layer package (Docker)"
  echo "------------------------------------------------------------------------------"
  local package="pdf-lib"
  LAYER_PDF_LIB="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/layers/${package}"

  mkdir ./dist

  # If a pre-built package matched the version, skip building
  local latestVersion=$(cat package.json | jq .version | tr -d \")
  local bucket=$BUCKET_NAME
  local key="${SOLUTION}/prebuilt/layers/${package}/${latestVersion}.zip"

  local response=$(aws s3 cp s3://${bucket}/${key} $BUILD_DIST_DIR/${LAYER_PDF_LIB})
  if [ "$response" != "" ] && [ -f $BUILD_DIST_DIR/${LAYER_PDF_LIB} ]; then
    echo "=== Using Prebuilt package (${latestVersion}.zip) for \"${package}\" ==="
    popd
    return 0
  fi

  # docker builds the PDFJS and Canvas modules and package to package.zip
  docker build -t ${package} .
  [ $? -ne 0 ] && exit 1

  # create a container so we can copy the zip package to local host
  local id=$(docker create ${package})
  docker cp ${id}:/var/task/package.zip ./dist/${LAYER_PDF_LIB}

  # remove container
  docker rm -v $id

  # remove image
  docker rmi ${package}

  # copy the prebuilt package to s3 bucket
  aws s3api put-object \
  --bucket ${bucket} \
  --key ${key} \
  --body "./dist/${LAYER_PDF_LIB}" \
  --expected-bucket-owner ${ACCOUNTID}

  mv -v "./dist/${LAYER_PDF_LIB}" "$BUILD_DIST_DIR"

  popd
}

function build_backlog_layer() {
  echo "------------------------------------------------------------------------------"
  echo "Building Service Backlog layer package"
  echo "------------------------------------------------------------------------------"
  local package="service-backlog-lib"
  LAYER_BACKLOG="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/layers/${package}"
  npm install
  npm run build
  npm run zip -- "$LAYER_BACKLOG" .
  cp -v "./dist/${LAYER_BACKLOG}" "$BUILD_DIST_DIR"
  popd
}

#####################################################################
#
# Service Backlog packages
#
#####################################################################
function build_backlog_packages() {
  echo "------------------------------------------------------------------------------"
  echo "Building Backlog Service Packages"
  echo "------------------------------------------------------------------------------"
  build_backlog_status_updater_package
  build_backlog_stream_connector_package
  build_backlog_custom_labels_package
}

function build_backlog_status_updater_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Backlog Status Updater lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="backlog"
  local name="status-updater"
  local package="${workflow}-${name}"
  PKG_BACKLOG_STATUS_UPDATER="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${workflow}/${name}"
  npm install
  npm run build
  npm run zip -- "$PKG_BACKLOG_STATUS_UPDATER" .
  cp -v "./dist/$PKG_BACKLOG_STATUS_UPDATER" "$BUILD_DIST_DIR"
  popd
}

function build_backlog_stream_connector_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Backlog DDB Stream Connector lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="backlog"
  local name="stream-connector"
  local package="${workflow}-${name}"
  PKG_BACKLOG_STREAM_CONNECTOR="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${workflow}/${name}"
  npm install
  npm run build
  npm run zip -- "$PKG_BACKLOG_STREAM_CONNECTOR" .
  cp -v "./dist/$PKG_BACKLOG_STREAM_CONNECTOR" "$BUILD_DIST_DIR"
  popd
}

function build_backlog_custom_labels_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Backlog Custom Labels lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="backlog"
  local name="custom-labels"
  local package="${workflow}-${name}"
  PKG_BACKLOG_CUSTOMLABELS="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${workflow}/${name}"
  npm install
  npm run build
  npm run zip -- "$PKG_BACKLOG_CUSTOMLABELS" .
  cp -v "./dist/$PKG_BACKLOG_CUSTOMLABELS" "$BUILD_DIST_DIR"
  popd
}

#####################################################################
#
# Ingest Workflow packages
#
#####################################################################
function build_ingest_workflow_packages() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest Workflow Packages"
  echo "------------------------------------------------------------------------------"
  # state machine
  build_ingest_main_package
  build_ingest_fixity_package
  build_ingest_video_package
  build_ingest_audio_package
  build_ingest_image_package
  build_ingest_document_package
  # automation
  build_ingest_status_updater_package
}

function build_ingest_main_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest Main state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="ingest"
  local statemachine="main"
  local package="${workflow}-${statemachine}"
  PKG_INGEST_MAIN="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_INGEST_MAIN" .
  cp -v "./dist/$PKG_INGEST_MAIN" "$BUILD_DIST_DIR"
  popd
}

function build_ingest_fixity_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest Fixity nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="ingest"
  local statemachine="fixity"
  local package="${workflow}-${statemachine}"
  PKG_INGEST_FIXITY="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_INGEST_FIXITY" .
  cp -v "./dist/$PKG_INGEST_FIXITY" "$BUILD_DIST_DIR"
  popd
}

function build_ingest_video_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest Video nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="ingest"
  local statemachine="video"
  local package="${workflow}-${statemachine}"
  PKG_INGEST_VIDEO="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_INGEST_VIDEO" .
  cp -v "./dist/$PKG_INGEST_VIDEO" "$BUILD_DIST_DIR"
  popd
}

function build_ingest_audio_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest Audio nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="ingest"
  local statemachine="audio"
  local package="${workflow}-${statemachine}"
  PKG_INGEST_AUDIO="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_INGEST_AUDIO" .
  cp -v "./dist/$PKG_INGEST_AUDIO" "$BUILD_DIST_DIR"
  popd
}

function build_ingest_image_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest Image nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="ingest"
  local statemachine="image"
  local package="${workflow}-${statemachine}"
  PKG_INGEST_IMAGE="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_INGEST_IMAGE" .
  cp -v "./dist/$PKG_INGEST_IMAGE" "$BUILD_DIST_DIR"
  popd
}

function build_ingest_document_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest Document nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="ingest"
  local statemachine="document"
  local package="${workflow}-${statemachine}"
  PKG_INGEST_DOCUMENT="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_INGEST_DOCUMENT" .
  cp -v "./dist/$PKG_INGEST_DOCUMENT" "$BUILD_DIST_DIR"
  popd
}

function build_ingest_status_updater_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Ingest Automation Status Updater lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="ingest"
  local automation="automation"
  local lambda="status-updater"
  local package="${workflow}-${automation}-${lambda}"
  PKG_INGEST_STATUS_UPDATER="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${automation}/${lambda}"
  npm install
  npm run build
  npm run zip -- "$PKG_INGEST_STATUS_UPDATER" .
  cp -v "./dist/$PKG_INGEST_STATUS_UPDATER" "$BUILD_DIST_DIR"
  popd
}

#####################################################################
#
# Analysis Workflow packages
#
#####################################################################
function build_analysis_workflow_packages() {
  echo "------------------------------------------------------------------------------"
  echo "Building Analysis Workflow Packages"
  echo "------------------------------------------------------------------------------"
  # state machine
  build_analysis_main_package
  build_analysis_audio_package
  build_analysis_video_package
  build_analysis_image_package
  build_analysis_document_package
  # status updater
  build_analysis_status_updater_package
}

function build_analysis_main_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Analysis Main state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="analysis"
  local statemachine="main"
  local package="${workflow}-${statemachine}"
  PKG_ANALYSIS_MAIN="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_ANALYSIS_MAIN" .
  cp -v "./dist/$PKG_ANALYSIS_MAIN" "$BUILD_DIST_DIR"
  popd
}

function build_analysis_audio_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Analysis Audio nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="analysis"
  local statemachine="audio"
  local package="${workflow}-${statemachine}"
  PKG_ANALYSIS_AUDIO="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_ANALYSIS_AUDIO" .
  cp -v "./dist/$PKG_ANALYSIS_AUDIO" "$BUILD_DIST_DIR"
  popd
}

function build_analysis_video_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Analysis Video nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="analysis"
  local statemachine="video"
  local package="${workflow}-${statemachine}"
  PKG_ANALYSIS_VIDEO="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_ANALYSIS_VIDEO" .
  cp -v "./dist/$PKG_ANALYSIS_VIDEO" "$BUILD_DIST_DIR"
  popd
}

function build_analysis_image_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Analysis Image nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="analysis"
  local statemachine="image"
  local package="${workflow}-${statemachine}"
  PKG_ANALYSIS_IMAGE="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_ANALYSIS_IMAGE" .
  cp -v "./dist/$PKG_ANALYSIS_IMAGE" "$BUILD_DIST_DIR"
  popd
}

function build_analysis_document_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Analysis Document nested state machine lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="analysis"
  local statemachine="document"
  local package="${workflow}-${statemachine}"
  PKG_ANALYSIS_DOCUMENT="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${statemachine}"
  npm install
  npm run build
  npm run zip -- "$PKG_ANALYSIS_DOCUMENT" .
  cp -v "./dist/$PKG_ANALYSIS_DOCUMENT" "$BUILD_DIST_DIR"
  popd
}

function build_analysis_status_updater_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Analysis Automation Status Updater lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="analysis"
  local automation="automation"
  local lambda="status-updater"
  local package="${workflow}-${automation}-${lambda}"
  PKG_ANALYSIS_STATUS_UPDATER="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/${workflow}/${automation}/${lambda}"
  npm install
  npm run build
  npm run zip -- "$PKG_ANALYSIS_STATUS_UPDATER" .
  cp -v "./dist/$PKG_ANALYSIS_STATUS_UPDATER" "$BUILD_DIST_DIR"
  popd
}

#####################################################################
#
# Main Workflow packages
#
#####################################################################
function build_main_workflow_packages() {
  echo "------------------------------------------------------------------------------"
  echo "Building Main Workflow Packages"
  echo "------------------------------------------------------------------------------"
  # ingest workflow
  build_ingest_workflow_packages
  # analysis workflow
  build_analysis_workflow_packages
  # state machine error handler
  build_workflow_error_handler_package
  # optional s3event package
  build_main_automation_s3event_package
}

function build_workflow_error_handler_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Workflow Error Handler package"
  echo "------------------------------------------------------------------------------"
  local workflow="main"
  local lambda="error-handler"
  local package="${workflow}-${lambda}"
  PKG_ERROR_HANDLER="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/automation/${lambda}"
  npm install
  npm run build
  npm run zip -- "$PKG_ERROR_HANDLER" .
  cp -v "./dist/$PKG_ERROR_HANDLER" "$BUILD_DIST_DIR"
  popd
}

function build_main_automation_s3event_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building Main Automation S3 Event lambda package"
  echo "------------------------------------------------------------------------------"
  local workflow="main"
  local lambda="s3event"
  local package="${workflow}-${lambda}"
  PKG_MAIN_S3EVENT="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/main/automation/${lambda}"
  npm install
  npm run build
  npm run zip -- "$PKG_MAIN_S3EVENT" .
  cp -v "./dist/$PKG_MAIN_S3EVENT" "$BUILD_DIST_DIR"
  popd
}

#####################################################################
#
# API package
#
#####################################################################
function build_api_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building API Gateway lambda package"
  echo "------------------------------------------------------------------------------"
  local package="api"
  PKG_API="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${package}"
  npm install
  npm run build
  npm run zip -- "$PKG_API" .
  cp -v "./dist/$PKG_API" "$BUILD_DIST_DIR"
  popd
}

#####################################################################
#
# Custom Resource package
#
#####################################################################
function build_custom_resources_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building custom resources Lambda package"
  echo "------------------------------------------------------------------------------"
  local package="custom-resources"
  PKG_CUSTOM_RESOURCES="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${package}"
  npm install
  npm run build
  # explicitly package core-lib in custom resource package
  pushd dist
  echo "=== Merging CORE_LIB_LOCAL_PKG = ${CORE_LIB_LOCAL_PKG} ===="
  npm install --no-save "$CORE_LIB_LOCAL_PKG"
  popd
  #
  npm run zip -- "$PKG_CUSTOM_RESOURCES" .
  cp -v "./dist/$PKG_CUSTOM_RESOURCES" "$BUILD_DIST_DIR"
  popd
}

#####################################################################
#
# Web App packages
#
#####################################################################
function build_thirdparty_bundle() {
  echo "------------------------------------------------------------------------------"
  echo "Building $1"
  echo "------------------------------------------------------------------------------"
  local bundle=$1
  local bundle_dir="$SOURCE_DIR/webapp/third_party/$bundle"

  pushd "$bundle_dir"
  npm install --omit=dev --omit=optional
  npm run build
  [ $? -ne 0 ] && exit 1
  popd
}

function build_webapp_dependencies() {
  echo "------------------------------------------------------------------------------"
  echo "Building webapp dependenceis for browser"
  echo "------------------------------------------------------------------------------"
  local bundles=(\
    "aws-iot-sdk-browser-bundle" \
    "amazon-cognito-identity-bundle" \
    "spark-md5-bundle" \
    "cropper-bundle" \
    "mime-bundle" \
    "videojs-bundle" \
    "videojs-markers-bundle" \
    "bootstrap-bundle" \
    "fontawesome-bundle" \
    "jquery-bundle" \
    "crypto-js-bundle" \
    "echarts-js-bundle" \
  )
  for bundle in ${bundles[@]}
  do
    build_thirdparty_bundle $bundle
  done;

  # copy all dependencies to webapp/third_party/dist
  local srcdir="$SOURCE_DIR/webapp/third_party"
  local dstdir="$SOURCE_DIR/webapp/third_party/dist"

  rm -rf "$dstdir" && mkdir -p "$dstdir"
  cp -rv "$srcdir"/*/dist/js "$dstdir"
  cp -rv "$srcdir"/*/dist/css "$dstdir"
  cp -rv "$srcdir"/*/dist/webfonts "$dstdir"
}

function rollup_appjs() {
  echo "------------------------------------------------------------------------------"
  echo "Rollup and minify Webapp code"
  echo "------------------------------------------------------------------------------"
  local infile=$1
  local outfile=$2
  pushd "$SOURCE_DIR/build"
  npm install --omit=dev --omit=optional
  node post-build.js rollup --input "$infile" --output "$outfile"
  [ $? -ne 0 ] && exit 1
  popd
}

function build_index_html() {
  echo "------------------------------------------------------------------------------"
  echo "Build Index html and Inject Integrity check"
  echo "------------------------------------------------------------------------------"
  local file=$1
  pushd "$SOURCE_DIR/build"
  npm install --omit=dev --omit=optional
  node post-build.js build-html --html "$file"
  [ $? -ne 0 ] && exit 1
  popd
}

function minify_jscript() {
  echo "------------------------------------------------------------------------------"
  echo "Minify Webapp code"
  echo "------------------------------------------------------------------------------"
  local file=$1
  pushd "$SOURCE_DIR/build"
  npm install --omit=dev --omit=optional
  node post-build.js minify --dir "$file"
  [ $? -ne 0 ] && exit 1
  popd
}

function compute_jscript_integrity() {
  echo "------------------------------------------------------------------------------"
  echo "Compute and Inject Integrity check to webapp"
  echo "------------------------------------------------------------------------------"
  local file=$1
  pushd "$SOURCE_DIR/build"
  npm install --omit=dev --omit=optional
  node post-build.js inject-sri --html "$file"
  [ $? -ne 0 ] && exit 1
  popd
}

function build_webapp_package() {
  echo "------------------------------------------------------------------------------"
  echo "Building webapp package"
  echo "------------------------------------------------------------------------------"
  local package="webapp"
  PKG_WEBAPP="${package}-${VERSION}.zip"
  pushd "$SOURCE_DIR/${package}"
  npm install --omit=dev --omit=optional
  npm run build

  # start building all third party bundles
  build_webapp_dependencies
  # copy all dependencies to webapp/dist/third_party
  local srcdir="$SOURCE_DIR/${package}/third_party/dist"
  local dstdir="$SOURCE_DIR/${package}/dist/third_party/dist"
  mkdir -p "$dstdir"/js "$dstdir"/css "$dstdir"/webfonts
  cp -rv "$srcdir"/js/* "$dstdir"/js/
  cp -rv "$srcdir"/css/* "$dstdir"/css/
  cp -rv "$srcdir"/webfonts/* "$dstdir"/webfonts/

  # rollup and minimize app.js
  rollup_appjs "$SOURCE_DIR/${package}/dist/src/lib/js/app.js" "$SOURCE_DIR/${package}/dist/app.min.js"
  # build index html and inject integrity check
  build_index_html "$SOURCE_DIR/${package}/dist/index.html"

  # now, zip and package all the files
  npm run zip -- "$PKG_WEBAPP" . -x ./dev**
  cp -v "./dist/$PKG_WEBAPP" "$BUILD_DIST_DIR"

  popd
}

#####################################################################
#
# CloudFormation templates
#
#####################################################################
function build_cloudformation_templates() {
  echo "------------------------------------------------------------------------------"
  echo "CloudFormation Templates"
  echo "------------------------------------------------------------------------------"
  # copy yaml to dist folder
  runcmd cp -rv *.yaml "$TEMPLATE_DIST_DIR/"
  pushd "$TEMPLATE_DIST_DIR"

  # solution Id
  echo "Updating %%SOLUTION_ID%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%SOLUTION_ID%%|${SOLUTION_ID}|g" *.yaml || exit 1

  # solution Id (lowercase)
  local solutionId=$(echo ${SOLUTION_ID} | tr "[:upper:]" "[:lower:]")
  echo "Updating %%SOLUTION_ID_LOWERCASE%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%SOLUTION_ID_LOWERCASE%%|${solutionId}|g" *.yaml || exit 1

  # solution version
  echo "Updating %%VERSION%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%VERSION%%|${VERSION}|g" *.yaml || exit 1

  # deployment bucket name
  echo "Updating %%BUCKET_NAME%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%BUCKET_NAME%%|${BUCKET_NAME}|g" *.yaml || exit 1

  # key prefix name
  local keyprefix="${SOLUTION}/${VERSION}"
  echo "Updating %%KEYPREFIX%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%KEYPREFIX%%|${keyprefix}|g" *.yaml || exit 1

  # web package name
  echo "Updating %%PKG_WEBAPP%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_WEBAPP%%|${PKG_WEBAPP}|g" *.yaml || exit 1

  echo "Updating %%PKG_API%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_API%%|${PKG_API}|g" *.yaml || exit 1

  # layer aws-sdk name
  echo "Updating %%LAYER_AWSSDK%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_AWSSDK%%|${LAYER_AWSSDK}|g" *.yaml || exit 1

  echo "Updating %%LAYER_CORE_LIB%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_CORE_LIB%%|${LAYER_CORE_LIB}|g" *.yaml || exit 1

  echo "Updating %%LAYER_MEDIAINFO%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_MEDIAINFO%%|${LAYER_MEDIAINFO}|g" *.yaml || exit 1

  echo "Updating %%LAYER_JIMP%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_JIMP%%|${LAYER_JIMP}|g" *.yaml || exit 1

  echo "Updating %%LAYER_IMAGE_PROCESS%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_IMAGE_PROCESS%%|${LAYER_IMAGE_PROCESS}|g" *.yaml || exit 1

  echo "Updating %%LAYER_FIXITY_LIB%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_FIXITY_LIB%%|${LAYER_FIXITY_LIB}|g" *.yaml || exit 1

  echo "Updating %%LAYER_PDF_LIB%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_PDF_LIB%%|${LAYER_PDF_LIB}|g" *.yaml || exit 1

  echo "Updating %%LAYER_BACKLOG%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%LAYER_BACKLOG%%|${LAYER_BACKLOG}|g" *.yaml || exit 1

  # custom resource name
  echo "Updating %%PKG_CUSTOM_RESOURCES%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_CUSTOM_RESOURCES%%|${PKG_CUSTOM_RESOURCES}|g" *.yaml || exit 1

  # package name
  echo "Updating %%PKG_INGEST_MAIN%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_INGEST_MAIN%%|${PKG_INGEST_MAIN}|g" *.yaml || exit 1

  echo "Updating %%PKG_INGEST_FIXITY%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_INGEST_FIXITY%%|${PKG_INGEST_FIXITY}|g" *.yaml || exit 1

  echo "Updating %%PKG_INGEST_VIDEO%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_INGEST_VIDEO%%|${PKG_INGEST_VIDEO}|g" *.yaml || exit 1

  echo "Updating %%PKG_INGEST_AUDIO%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_INGEST_AUDIO%%|${PKG_INGEST_AUDIO}|g" *.yaml || exit 1

  echo "Updating %%PKG_INGEST_IMAGE%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_INGEST_IMAGE%%|${PKG_INGEST_IMAGE}|g" *.yaml || exit 1

  echo "Updating %%PKG_INGEST_DOCUMENT%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_INGEST_DOCUMENT%%|${PKG_INGEST_DOCUMENT}|g" *.yaml || exit 1

  echo "Updating %%PKG_INGEST_STATUS_UPDATER%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_INGEST_STATUS_UPDATER%%|${PKG_INGEST_STATUS_UPDATER}|g" *.yaml || exit 1

  echo "Updating %%PKG_ANALYSIS_MAIN%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_ANALYSIS_MAIN%%|${PKG_ANALYSIS_MAIN}|g" *.yaml || exit 1

  echo "Updating %%PKG_ANALYSIS_AUDIO%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_ANALYSIS_AUDIO%%|${PKG_ANALYSIS_AUDIO}|g" *.yaml || exit 1

  echo "Updating %%PKG_ANALYSIS_VIDEO%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_ANALYSIS_VIDEO%%|${PKG_ANALYSIS_VIDEO}|g" *.yaml || exit 1

  echo "Updating %%PKG_ANALYSIS_IMAGE%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_ANALYSIS_IMAGE%%|${PKG_ANALYSIS_IMAGE}|g" *.yaml || exit 1

  echo "Updating %%PKG_ANALYSIS_DOCUMENT%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_ANALYSIS_DOCUMENT%%|${PKG_ANALYSIS_DOCUMENT}|g" *.yaml || exit 1

  echo "Updating %%PKG_ANALYSIS_STATUS_UPDATER%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_ANALYSIS_STATUS_UPDATER%%|${PKG_ANALYSIS_STATUS_UPDATER}|g" *.yaml || exit 1

  # Backlog Service Workflow
  echo "Updating %%PKG_BACKLOG_STATUS_UPDATER%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_BACKLOG_STATUS_UPDATER%%|${PKG_BACKLOG_STATUS_UPDATER}|g" *.yaml || exit 1

  echo "Updating %%PKG_BACKLOG_STREAM_CONNECTOR%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_BACKLOG_STREAM_CONNECTOR%%|${PKG_BACKLOG_STREAM_CONNECTOR}|g" *.yaml || exit 1

  echo "Updating %%PKG_BACKLOG_CUSTOMLABELS%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_BACKLOG_CUSTOMLABELS%%|${PKG_BACKLOG_CUSTOMLABELS}|g" *.yaml || exit 1

  ## Main Workflow
  echo "Updating %%PKG_ERROR_HANDLER%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_ERROR_HANDLER%%|${PKG_ERROR_HANDLER}|g" *.yaml || exit 1

  echo "Updating %%PKG_MAIN_S3EVENT%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%PKG_MAIN_S3EVENT%%|${PKG_MAIN_S3EVENT}|g" *.yaml || exit 1

  ## Misc.
  echo "Updating %%ANONYMIZED_DATA%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%ANONYMIZED_DATA%%|${ANONYMIZED_DATA}|g" *.yaml || exit 1

  echo "Updating %%SINGLE_REGION%% param in cloudformation templates..."
  sed -i'.bak' -e "s|%%SINGLE_REGION%%|${SINGLE_REGION}|g" *.yaml || exit 1

  # remove .bak
  runcmd rm -v *.bak
  # rename .yaml to .template
  find . -name "*.yaml" -exec bash -c 'mv -v "$0" "${0%.yaml}.template"' {} \;
  # copy templates to regional bucket as well
  cp -v *.template "$BUILD_DIST_DIR"

  popd
}

function on_complete() {
  echo "------------------------------------------------------------------------------"
  echo "S3 Packaging Complete. (${SOLUTION} ${VERSION})"
  echo "------------------------------------------------------------------------------"
  ## Lambda Layers ##
  echo "** LAYER_AWSSDK=${LAYER_AWSSDK} **"
  echo "** LAYER_CORE_LIB=${LAYER_CORE_LIB} **"
  echo "** LAYER_MEDIAINFO=${LAYER_MEDIAINFO} **"
  echo "** LAYER_JIMP=${LAYER_JIMP} **"
  echo "** LAYER_IMAGE_PROCESS=${LAYER_IMAGE_PROCESS} **"
  echo "** LAYER_FIXITY_LIB=${LAYER_FIXITY_LIB} **"
  echo "** LAYER_PDF_LIB=${LAYER_PDF_LIB} **"
  echo "** LAYER_BACKLOG=${LAYER_BACKLOG} **"
  ## Backlog Service ##
  echo "** PKG_BACKLOG_STATUS_UPDATER=${PKG_BACKLOG_STATUS_UPDATER} **"
  echo "** PKG_BACKLOG_STREAM_CONNECTOR=${PKG_BACKLOG_STREAM_CONNECTOR} **"
  echo "** PKG_BACKLOG_CUSTOMLABELS=${PKG_BACKLOG_CUSTOMLABELS} **"
  ## Ingest Workflow ##
  echo "** PKG_INGEST_MAIN=${PKG_INGEST_MAIN} **"
  echo "** PKG_INGEST_FIXITY=${PKG_INGEST_FIXITY} **"
  echo "** PKG_INGEST_VIDEO=${PKG_INGEST_VIDEO} **"
  echo "** PKG_INGEST_AUDIO=${PKG_INGEST_AUDIO} **"
  echo "** PKG_INGEST_IMAGE=${PKG_INGEST_IMAGE} **"
  echo "** PKG_INGEST_DOCUMENT=${PKG_INGEST_DOCUMENT} **"
  ## Analysis Workflow ##
  echo "** PKG_ANALYSIS_MAIN=${PKG_ANALYSIS_MAIN} **"
  echo "** PKG_ANALYSIS_AUDIO=${PKG_ANALYSIS_AUDIO} **"
  echo "** PKG_ANALYSIS_VIDEO=${PKG_ANALYSIS_VIDEO} **"
  echo "** PKG_ANALYSIS_IMAGE=${PKG_ANALYSIS_IMAGE} **"
  echo "** PKG_ANALYSIS_DOCUMENT=${PKG_ANALYSIS_DOCUMENT} **"
  echo "** PKG_ANALYSIS_STATUS_UPDATER=${PKG_ANALYSIS_STATUS_UPDATER} **"
  ## Main Workflow ##
  echo "** PKG_ERROR_HANDLER=${PKG_ERROR_HANDLER} **"
  echo "** PKG_MAIN_S3EVENT=${PKG_MAIN_S3EVENT} **"
  ## WebApp ##
  echo "** PKG_API=${PKG_API} **"
  echo "** PKG_WEBAPP=${PKG_WEBAPP} **"
  ## Misc. ##
  echo "** PKG_CUSTOM_RESOURCES=${PKG_CUSTOM_RESOURCES} **"
}

#
# main routine goes here
#
clean_start
install_dev_dependencies

# layers
build_layer_packages
# custom resource
build_custom_resources_package
# backlog service
build_backlog_packages
# main workflow
build_main_workflow_packages
# api
build_api_package
# webapp
build_webapp_package
# cloudformation
build_cloudformation_templates
on_complete
