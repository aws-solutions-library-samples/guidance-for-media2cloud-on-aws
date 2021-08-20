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

# include shared configuration file
source ./common.sh

ACCOUNTID=
DEPLOY_DIR="$PWD"
SOURCE_DIR="$DEPLOY_DIR/../source"
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
  --bucket BUCKET             specify the bucket name where the templates and packages deployed to.
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
      BUCKET="$2"
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
      shift # past argument
      shift # past value
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

[ -z "$BUCKET" ] && \
  echo "error: missing --bucket parameter..." && \
  usage && \
  exit 1

[ -z "$VERSION" ] && \
  VERSION=$(cat "$SOURCE_DIR/layers/core-lib/lib/.version")

[ -z "$VERSION" ] && \
  echo "error: VERSION variable is not defined" && \
  usage && \
  exit 1

[ -z "$SOLUTION" ] && \
  SOLUTION="media2cloud"

[ -z "$SINGLE_REGION" ] && \
  SINGLE_REGION=false

[ -z "$ACL_SETTING" ] && \
  ACL_SETTING="bucket-owner-full-control"

ACCOUNTID=$(aws sts get-caller-identity | jq .Account | tr -d \")
[ -z "$ACCOUNTID" ] && \
  echo "error: fail to get AWS Account ID" && \
  exit 1

#
# @function copy_to_bucket
# @description copy solution to regional bucket
#
function copy_to_bucket() {
  local source=$1
  local bucket=$2
  local region=$3

  # get bucket region and ensure bucket is owned by the same AWS account. LocationConstraint returns null if bucket is in us-east-1 region
  local location=$(aws s3api get-bucket-location --bucket ${bucket} --expected-bucket-owner ${ACCOUNTID} | jq .LocationConstraint | tr -d \")
  [ -z "$location" ] && \
    echo "Bucket '${bucket}' either doesn't exist or doesn't belong to accountId '${ACCOUNTID}'. exiting..." && \
    return 0

  echo "uploading package to '${bucket}'..."
  if [ -z "$region" ]; then
    aws s3 cp $source s3://${bucket}/${SOLUTION}/${VERSION}/ --recursive --acl ${ACL_SETTING}
  else
    aws s3 cp $source s3://${bucket}/${SOLUTION}/${VERSION}/ --recursive --acl ${ACL_SETTING} --region ${region}
  fi
}

if [ "$SINGLE_REGION" == "true" ]; then
  # deploy to a single region
  echo "'${SOLUTION} ($VERSION)' package will be deployed to '${BUCKET}' bucket"
  copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}"
else
  echo "'${SOLUTION} ($VERSION)' package will be deployed to '${BUCKET}-[region]' buckets: ${REGIONS[*]} regions"
  # special case, deploy to main bucket (without region suffix)
  copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}" "us-east-1"

  # now, deploy to regional based buckets
  for region in ${REGIONS[@]}; do
    copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}-${region}" "${region}"
  done
fi
