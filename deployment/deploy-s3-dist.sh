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


# include shared configuration file
source ./common.sh

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
bash ./deploy-s3-dist.sh --bucket DEPLOY_BUCKET_BASENAME [--version VERSION] [--region REGION]

where
  --bucket BUCKET_BASENAME    should be the base name for the S3 bucket location where
                              the template will store the Lambda code from.
                              This script will append '-[region_name]' to this bucket name.
                              For example, ./deploy-s3-dist.sh --bucket solutions
                              The template will expect the solution code to be located in the
                              solutions-[region_name] bucket

  --version VERSION           if not specified, use 'version' field from package.json

  --region REGION             a single region to deploy. If not specified, it deploys to all
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
  VERSION=$(grep_package_version "../source/backend/package.json")

[ -z "$VERSION" ] && \
  echo "error: VERSION variable is not defined" && \
  usage && \
  exit 1

SOLUTION=$(grep_package_name "../source/backend/package.json")
[ -z "$SOLUTION" ] && \
  echo "error: SOLUTION variable is not defined" && \
  usage && \
  exit 1

pushd "dist"
if [ x"$SINGLE_REGION" != "x" ]; then
  # deploy to single region
  echo "'${SOLUTION} ($VERSION)' package will be deployed to '${BUCKET}-${SINGLE_REGION}' bucket in ${SINGLE_REGION} region"
  echo "uploading package to ${bucket}..."
  aws s3 cp . s3://${BUCKET}-${SINGLE_REGION}/${SOLUTION}/${VERSION}/ --recursive --acl public-read --region ${SINGLE_REGION}
else
  # deploy to all regions
  echo "'${SOLUTION} ($VERSION)' package will be deployed to '${BUCKET}-[region]' buckets included us-east-1 ${REGIONS[*]} regions"
  for region in ${REGIONS[@]}; do
    bucket=${BUCKET}-${region}
    echo "uploading package to ${bucket}..."
    aws s3 cp . s3://${bucket}/${SOLUTION}/${VERSION}/ --recursive --acl public-read --region ${region}
  done
fi
popd
