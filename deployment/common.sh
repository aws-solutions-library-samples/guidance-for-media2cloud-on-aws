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
# REGIONS := these are the regions that supports Media2Cloud solution.
#
REGIONS=( \
  us-east-1 \
  us-east-2 \
  us-west-2 \
  eu-west-1 \
  ap-southeast-2 \
)

#
# BUCKET := bucket base name. The 'actual' bucket name will be concatenated
#           with region. The bucket stores cloudformation template and package.
#           For example, if BUCKET is 'solutions' and is deployed in eu-west-1
#           Then, the actual deployment bucket will be 'solutions-eu-west-1'.
#           (Mandatory)
BUCKET=
