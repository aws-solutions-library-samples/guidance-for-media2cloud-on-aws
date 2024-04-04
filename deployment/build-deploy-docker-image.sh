#!/bin/bash

########################################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
########################################################################################

# Global variables
PROFILE=
ACCOUNT=
REGION=
IMAGE_TAG=
IMAGE_NAME=
DEPLOY_DIR="$PWD"
DOCKER_DIR=


function on_exit_trap() {
  cd "$DEPLOY_DIR"

  [[ -z "${IMAGE_TAG}" ]] && \
    return 0

  highlight "== Clean up before exiting =="
  clean_up "${IMAGE_TAG}"
}

function clean_up() {
  local images=($@)

  for image in ${images[@]}; do
    info ">> deleting ${image}"
    docker rmi $image
  done
}

function error() {
  printf "\n\e[41m[ERR]: $1\e[0m\n"
}

function info() {
  printf "\e[37m$1\e[0m\n"
}

function verbose() {
  printf "\e[90m$1\e[0m\n"
}

function highlight() {
  printf "\n\e[7m$1\e[0m\n"
}

function success() {
  printf "\n\e[42m$1\e[0m\n"
}

function usage() {
  echo -e "
------------------------------------------------------------------------------

This script should be run from the repo's apptek directory. It also requires
'aws', 'docker' and 'jq' command line tools.

------------------------------------------------------------------------------
cd apptek
bash $(basename $0) --image-name IMAGE_NAME [--profile PROFILE] [--region REGION]

where
  --image-name IMAGE_NAME [REQUIRED]  specify docker image name; ex., blip-on-aws, face-api-on-aws

  --profile PROFILE [OPTIONAL]        AWS profile of the AWS account that hosts the ECR image.
                                      If not specified, assume 'default'
                                      ex., --profile Admin

  --region REGION [OPTIONAL]          set region where the image is pushed to.
                                      If not specified, use default region from your AWS configure

Example:
  bash $(basename $0) \\
    --image-name \"blip-on-aws\" \\
    --profile default \\
    --region eu-west-1
"
}

#
# check image tp see if it is already on ECR repository
#
function check_docker_image() {
  local tag=$1
  local region=$2
  local profile=$3
  local image=${tag#*\/}
  local repo=${image%:*}
  local version=${image#*:}

  aws ecr describe-images \
  --region $region \
  --profile $profile \
  --repository-name=$repo \
  --image-ids=imageTag=$version \
  2>/dev/null

  local response=$?

  # image not exists, we are all good!
  if [[ $response -ne 0 ]]; then
    info "image doesn't exist. Start building a new docker image..."
    return 1
  fi

  # already exists
  info "image already exists. Skip building the docker image..."
  return 0
}

#
# build and tag docker image
#
function build_docker_image() {
  local tag=$1
  local image=${tag#*\/}

  docker build -t ${tag} .
  if [[ $? -ne 0 ]]; then
    error "fail to build $tag"
    return 1
  fi

  info $image

  return 0
}

#
# build docker image
#
function push_docker_image() {
  local tag=$1
  local region=$2
  local profile=$3
  local uri=${tag%\/*}
  local image=${tag#*\/}
  local repo=${image%:*}

  aws ecr get-login-password --region ${region} --profile ${profile} \
  | docker login --username AWS --password-stdin ${uri}

  if [[ $? -ne 0 ]]; then
    error "fail to login to target account"
    return 1
  fi

  # create repo, ignore any error as the repo could already exist
  info ">> make sure remote repository (${repo}) exists..."
  aws ecr create-repository \
    --region $region \
    --profile $profile \
    --repository-name ${repo} \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256

  # push image
  docker push $tag

  if [[ $? -ne 0 ]]; then
    error "fail to push $tag"
    return 1
  fi

  info $image

  return 0
}

########################################################################################
#
# Main routine
#

# trap exit signal and make sure to remove the TMP_DIR
trap on_exit_trap EXIT

# Parse command line options
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
      -r|--image-name)
      IMAGE_NAME="$2"
      shift # past key
      shift # past value
      ;;
      -p|--profile)
      PROFILE="$2"
      shift # past key
      shift # past value
      ;;
      -r|--region)
      REGION="$2"
      shift # past key
      shift # past value
      ;;
      *)
      shift
      ;;
  esac
done

#
# check tools
#
which docker jq aws > /dev/null
[[ $? -ne 0 ]] && \
  error "missing 'aws', 'docker', or 'jq' command line tools" && \
  usage && \
  exit 1

[[ -z "$IMAGE_NAME" ]] && \
  error "--image-name must be specified" && \
  usage && \
  exit 1

#
# source account settings
#
[[ -z "$PROFILE" ]] && \
  PROFILE=default && \
  info "--profile not specified. Assume 'default' AWS profile"

highlight "== Checking source profile settings =="

ACCOUNT=$(aws sts get-caller-identity --profile $PROFILE | jq -r .Account)
[[ -z "$ACCOUNT" ]] && \
  error "failed to get your AWS account ID. Make sure you have the correct profile settings or run 'aws configure' to configure your environment" && \
  usage && \
  exit 1

[[ -z "$REGION" ]] && \
  REGION=$(aws configure get region --profile $PROFILE)

[[ -z "$REGION" ]] && \
  error "failed to get AWS region. Use '--region' option to force the region" && \
  usage && \
  exit 1

# Working directory
DOCKER_DIR="$DEPLOY_DIR/../docker/${IMAGE_NAME}"
cd "$DOCKER_DIR"

# set version and image tag
VERSION=$(date -u +"%Y%m%dT%H%M%SZ")
if test -f ".version"; then
  VERSION=$(cat .version)
elif test -f "package.json"; then
  VERSION=$(cat package.json | jq .version | tr -d "\"")
fi

IMAGE_TAG="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${IMAGE_NAME}:${VERSION}"

#
# Docker image already exists?
#
highlight "== Checking docker image '${IMAGE_TAG}' on ECR =="
check_docker_image $IMAGE_TAG $REGION $PROFILE
[[ $? -eq 0 ]] && \
  highlight "${IMAGE_TAG}" && \
  info "== Skipped ==" && \
  exit 0

#
# Build image
#
highlight "== Building docker image '${IMAGE_TAG}' =="
build_docker_image "${IMAGE_TAG}"
[[ $? -ne 0 ]] && \
  exit 1

#
# Push image
#
highlight "== Pushing docker image '${IMAGE_TAG} to ECR' =="
push_docker_image $IMAGE_TAG $REGION $PROFILE
[[ $? -ne 0 ]] && \
  exit 1

#
# Done
#
success "== Completed =="
info "Image created and pushed to ECR: ${IMAGE_TAG}"

exit 0
