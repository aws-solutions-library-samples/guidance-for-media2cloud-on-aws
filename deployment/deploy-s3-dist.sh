#!/bin/bash

########################################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
########################################################################################

# include shared configuration file
source ./common.sh

ACCOUNTID=
SOURCE_DIR="../source"
TEMPLATE_DIST_DIR="global-s3-assets"
BUID_DIST_DIR="regional-s3-assets"

#
# @function usage
#
function usage() {
  echo -e "
------------------------------------------------------------------------------

This script helps you to deploy CloudFormation templates to the bucket(s).
It should be run from the repo's deployment directory

------------------------------------------------------------------------------
cd deployment
bash ./deploy-s3-dist.sh --bucket DEPLOY_BUCKET_BASENAME [--version VERSION] [--solution SOLUTION] [--single-region]

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

  --single-region             [optional] if specified, it deploys to a single bucket that you specify
                              in '--bucket' setting

  --acl ACL_SETTING           [optional] if not specified, it deploys with 'bucket-owner-full-control' access
                              control setting. You could specify 'public-read' if you plan to share the solution
                              with other AWS accounts. Note that it requires your bucket to be configured to permit
                              'public-read' acl settings
"
  return 0
}

######################################################################
#
# optional flags
#
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
      -b|--bucket)
      BUCKET_NAME="$2"
      shift # past argument
      shift # past value
      ;;
      -s|--solution)
      SOLUTION="$2"
      shift # past key
      shift # past value
      ;;
      -v|--version)
      VERSION="$2"
      shift # past argument
      shift # past value
      ;;
      -r|--single-region)
      SINGLE_REGION=true
      shift # key
      ;;
      -a|--acl)
      ACL_SETTING="$2"
      shift # past argument
      shift # past value
      ;;
      *)
      shift
      ;;
  esac
done

[ -z "$BUCKET_NAME" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(cat "$SOURCE_DIR/layers/core-lib/lib/.version")

[ -z "$VERSION" ] && \
  echo "error: VERSION variable is not defined" && \
  usage && \
  exit 1

ACCOUNTID=$(aws sts get-caller-identity | jq .Account | tr -d \")
[ -z "$ACCOUNTID" ] && \
  echo "error: fail to get AWS Account ID" && \
  exit 1

[ -z "$SOLUTION" ] && \
  SOLUTION="media2cloud"

[ -z "$SINGLE_REGION" ] && \
  SINGLE_REGION=false

[ -z "$ACL_SETTING" ] && \
  ACL_SETTING="bucket-owner-full-control"

#
# @function copy_to_bucket
# @description copy solution to regional bucket
#
function copy_to_bucket() {
  local source=$1
  local bucket=$2
  local dest=s3://${bucket}/${SOLUTION}/${VERSION}/
  # get bucket region and ensure bucket is owned by the same AWS account. LocationConstraint returns null if bucket is in us-east-1 region
  local location=$(aws s3api get-bucket-location --bucket ${bucket} --expected-bucket-owner ${ACCOUNTID} | jq .LocationConstraint | tr -d \")
  [ -z "$location" ] && \
    echo "Bucket '${bucket}' either doesn't exist or doesn't belong to accountId '${ACCOUNTID}'. exiting..." && \
    exit 1
  local region="us-east-1"
  [ "$location" != "null" ] && \
    region=$location
  # upload artifacts to the regional bucket
  echo "== Deploy '${SOLUTION} ($VERSION)' package from '${source}' to '${dest}' in '${region}' [BEGIN] =="
  if [ "$region" == "us-east-1" ]; then
    aws s3 cp $source $dest --recursive --acl ${ACL_SETTING}
  else
    aws s3 cp $source $dest --recursive --acl ${ACL_SETTING} --region ${region}
  fi
  echo "== Deploy '${SOLUTION} ($VERSION)' package from '${source}' to '${dest}' in '${region}' [COMPLETED] =="
}

if [ "$SINGLE_REGION" != "true" ]; then
  # deploy to regional based buckets
  for region in ${REGIONS[@]}; do
    copy_to_bucket ${BUID_DIST_DIR} "${BUCKET_NAME}-${region}"
  done
fi
copy_to_bucket ${BUID_DIST_DIR} "${BUCKET_NAME}"
