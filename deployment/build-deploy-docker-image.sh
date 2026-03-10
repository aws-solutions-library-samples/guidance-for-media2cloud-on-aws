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
PLATFORM="linux/amd64"
KEEP_IMAGE=false
DEPLOY_DIR="$PWD"
DOCKER_DIR=


function on_exit_trap() {
  cd "$DEPLOY_DIR"

  [[ -z "${IMAGE_TAG}" ]] && \
    return 0

  if [[ "$KEEP_IMAGE" == true ]]; then
    info ">> skipping local image cleanup (--keep-image)"
    return 0
  fi

  highlight "== Clean up before exiting =="
  clean_up "${IMAGE_TAG}"
}

function clean_up() {
  local images=($@)

  for image in "${images[@]}"; do
    info ">> deleting ${image}"
    docker rmi "$image"
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
bash $(basename $0) --image-name IMAGE_NAME [--profile PROFILE] [--region REGION] [--platform PLATFORM]

where
  --image-name IMAGE_NAME [REQUIRED]  specify docker image name; ex., blip-on-aws, face-api-on-aws

  --profile PROFILE [OPTIONAL]        AWS profile of the AWS account that hosts the ECR image.
                                      If not specified, falls back to environment variables
                                      (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN).
                                      ex., --profile Admin

  --region REGION [OPTIONAL]          set region where the image is pushed to.
                                      If not specified, use default region from your AWS configure.

  --platform PLATFORM [OPTIONAL]      target platform for the docker image.
                                      Supported: linux/amd64, linux/arm64
                                      Default: linux/amd64

  --keep-image [OPTIONAL]             skip deleting the local docker image after push.
                                      Useful for local testing or caching.

Example:
  bash $(basename $0) \\
    --image-name \"blip-on-aws\" \\
    --profile default \\
    --region eu-west-1 \\
    --platform linux/arm64 \\
    --keep-image
"
}

#
# check image to see if it is already on ECR repository
#
function check_docker_image() {
  local tag=$1
  local region=$2
  local profile=$3
  local image=${tag#*\/}
  local repo=${image%:*}
  local version=${image#*:}

  local profile_option=()
  if [[ -n "$profile" ]]; then
    profile_option=(--profile "$profile")
  fi

  aws ecr describe-images \
    --region "$region" "${profile_option[@]}" \
    --repository-name="$repo" \
    --image-ids=imageTag="$version" \
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
  local platform=$2
  local image=${tag#*\/}

  info ">> building for platform: ${platform}"
  docker buildx build \
    --platform "$platform" \
    --provenance=false \
    --output type=docker \
    -t "$tag" .
  if [[ $? -ne 0 ]]; then
    error "fail to build $tag"
    return 1
  fi

  info "$image"
  return 0
}

#
# push docker image to ECR
#
function push_docker_image() {
  local tag=$1
  local region=$2
  local profile=$3
  local uri=${tag%\/*}
  local image=${tag#*\/}
  local repo=${image%:*}

  local profile_option=()
  if [[ -n "$profile" ]]; then
    profile_option=(--profile "$profile")
  fi

  aws ecr get-login-password --region "$region" "${profile_option[@]}" \
    | docker login --username AWS --password-stdin "$uri"
  if [[ $? -ne 0 ]]; then
    error "fail to login to target account"
    return 1
  fi

  # create repo, ignore any error as the repo could already exist
  info ">> make sure remote repository (${repo}) exists..."
  aws ecr create-repository \
    --region "$region" "${profile_option[@]}" \
    --repository-name "$repo" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256

  # push image
  docker push "$tag"
  if [[ $? -ne 0 ]]; then
    error "fail to push $tag"
    return 1
  fi

  info "$image"
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
      -n|--image-name)
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
      --platform)
      PLATFORM="$2"
      shift # past key
      shift # past value
      ;;
      --keep-image)
      KEEP_IMAGE=true
      shift # past key
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

# Validate platform
if [[ "$PLATFORM" != "linux/amd64" && "$PLATFORM" != "linux/arm64" ]]; then
  error "unsupported platform '$PLATFORM'. Supported: linux/amd64, linux/arm64"
  usage
  exit 1
fi

#
# source account settings
#
highlight "== Checking source profile settings =="

# Build a reusable profile_option array for use in the main routine
profile_option=()
if [[ -n "$PROFILE" ]]; then
  profile_option=(--profile "$PROFILE")
  info "Using AWS profile: $PROFILE"
elif [[ -n "$AWS_ACCESS_KEY_ID" ]]; then
  info "Using AWS credentials from environment variables"
else
  info "No --profile specified and no environment credentials found. Falling back to default AWS profile"
  profile_option=(--profile default)
fi

ACCOUNT=$(aws sts get-caller-identity "${profile_option[@]}" | jq -r .Account)
[[ -z "$ACCOUNT" ]] && \
  error "failed to get your AWS account ID. Make sure you have the correct profile settings or run 'aws configure' to configure your environment" && \
  usage && \
  exit 1

if [[ -z "$REGION" ]]; then
  REGION=$(aws configure get region "${profile_option[@]}")
fi
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
check_docker_image "$IMAGE_TAG" "$REGION" "$PROFILE"
[[ $? -eq 0 ]] && \
  highlight "${IMAGE_TAG}" && \
  info "== Skipped ==" && \
  exit 0

#
# Build image
#
highlight "== Building docker image '${IMAGE_TAG}' for platform '${PLATFORM}' =="
build_docker_image "${IMAGE_TAG}" "${PLATFORM}"
[[ $? -ne 0 ]] && \
  exit 1

#
# Push image
#
highlight "== Pushing docker image '${IMAGE_TAG}' to ECR =="
push_docker_image "$IMAGE_TAG" "$REGION" "$PROFILE"
[[ $? -ne 0 ]] && \
  exit 1

#
# Done
#
success "== Completed =="
info "Image created and pushed to ECR: ${IMAGE_TAG}"

exit 0