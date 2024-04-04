#!/bin/bash

########################################################################################
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
########################################################################################

######################################################################
#
# common.sh stores the shared parameters used by different shell scripts
#
######################################################################

#
# @function runcmd
# @description print command before run
#
function runcmd() {
  echo "> ${@}"
  "${@}" || exit 1
}

#
# @function grep_package_version
# @description grep package version from package.json version field
#
function grep_package_version() {
  local list=($(grep "version" "$1"))
  local tmp=${list[1]%\"*}
  local version=v${tmp#\"}
  echo $version
}

#
# @function grep_package_name
# @description grep package name from package.json name field
#
function grep_package_name() {
  local list=($(grep "name" "$1"))
  local tmp=${list[1]%\"*}
  local package=${tmp#\"}
  echo $package
}

#
# @function grep_zip_name
# @description grep package zip name from package.json name field
#
function grep_zip_name() {
  local package=$(grep_package_name "$1")
  local version=$(grep_package_version "$1")
  echo "${package}_${version}.zip"
}

#
# @function grep_solution_name
# @description grep solution name from solution.js
#
function grep_solution_name() {
  local str=$(grep "Name:" "$1")
  [[ "$str" =~ \s*Name:.+\'(.+)\', ]]
  echo ${BASH_REMATCH[1]}
}

#
# @function grep_solution_version
# @description grep solution version from solution.js
#
function grep_solution_version() {
  local str=$(grep "Version:" "$1")
  [[ "$str" =~ \s*Version:.+\'(.+)\', ]]
  echo "v${BASH_REMATCH[1]}"
}

#
# REGIONS := these are the regions that supports Guidance for Media2Cloud on AWS.
#
REGIONS=( \
  us-east-1 \
  us-east-2 \
  us-west-1 \
  us-west-2 \
  ca-central-1 \
  eu-west-1 \
  eu-west-2 \
  eu-central-1 \
  ap-south-1 \
  ap-northeast-1 \
  ap-northeast-2 \
  ap-southeast-1 \
  ap-southeast-2 \
)

#
# BUCKET_NAME := bucket base name. The 'actual' bucket name will be concatenated
#           with region. The bucket stores cloudformation template and package.
#           For example, if BUCKET_NAME is 'solutions' and is deployed in eu-west-1
#           Then, the actual deployment bucket will be 'solutions-eu-west-1'.
#           (Mandatory)
BUCKET_NAME=

#
# SOLUTION_ID := Solution ID
#
SOLUTION_ID=SO0050
