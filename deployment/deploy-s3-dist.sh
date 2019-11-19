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
bash ./deploy-s3-dist.sh --bucket DEPLOY_BUCKET_BASENAME [--version VERSION] [--solution SOLUTION] [--region REGION]

where
  --bucket BUCKET_BASENAME    should be the base name for the S3 bucket location where
                              the template will store the Lambda code from.
                              This script will append '-[region_name]' to this bucket name.
                              For example, ./deploy-s3-dist.sh --bucket solutions
                              The template will expect the solution code to be located in the
                              solutions-[region_name] bucket

  --solution SOLUTION         [optional] if not specified, default to 'media2cloud'

  --version VERSION           [optional] if not specified, use 'version' field from package.json

  --region REGION             [optional] a single region to deploy. If not specified, it deploys to all
                              supported regions. (This assumes all regional buckets already exist.)
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
      -r|--region)
      SINGLE_REGION="$2"
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
  VERSION=$(grep_solution_version "../source/layers/core-lib/lib/index.js")

[ -z "$VERSION" ] && \
  echo "error: VERSION variable is not defined" && \
  usage && \
  exit 1

[ -z "$SOLUTION" ] && \
  SOLUTION=$(grep_solution_name "../source/layers/core-lib/lib/index.js")

[ -z "$SOLUTION" ] && \
  echo "error: SOLUTION variable is not defined" && \
  usage && \
  exit 1

#
# @function copy_to_bucket
# @description copy solution to regional bucket
#
function copy_to_bucket() {
  local source=$1
  local bucket=$2
  local region=$3

  aws s3api get-bucket-location --bucket ${bucket} > /dev/null 2>&1
  local status=$?
  [ $status -ne 0 ] && \
    echo "bucket '${bucket}' not exists. skipping..." && \
    return 0

  echo "uploading package to '${bucket}'..."
  aws s3 cp $source s3://${bucket}/${SOLUTION}/${VERSION}/ --recursive --acl public-read --region ${region}
}

if [ x"$SINGLE_REGION" != "x" ]; then
  # deploy to a single region
  echo "'${SOLUTION} ($VERSION)' package will be deployed to '${BUCKET}-${SINGLE_REGION}' bucket in ${SINGLE_REGION} region"
  copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}-${SINGLE_REGION}" "${SINGLE_REGION}"
else
  echo "'${SOLUTION} ($VERSION)' package will be deployed to '${BUCKET}-[region]' buckets: ${REGIONS[*]} regions"
  # special case, deploy to main bucket (without region suffix)
  copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}" "us-east-1"

  # now, deploy to regional based buckets
  for region in ${REGIONS[@]}; do
    copy_to_bucket ${BUID_DIST_DIR} "${BUCKET}-${region}" "${region}"
  done
fi
