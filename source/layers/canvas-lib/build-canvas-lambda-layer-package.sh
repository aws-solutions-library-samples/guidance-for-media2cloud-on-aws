#!/bin/sh

#
# Preparation
#
# Launch a new EC2 instance with Amazon Linux 2
# See details here, https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
#
# Copy the script to the instance and run it to build the package
# $ bash build-canvas-lambda-layer-package.sh
#

#
# Option Flags
# To publish package to AWS Lambda Layer, set PUBLISH_PACKAGE=1
# (You must have run 'aws configure' to provide valid credential for publishing)
#
PUBLISH_PACKAGE=0

#
# Node configuration
# (Default to build nodejs14.x package)
#
VER_NODE=14.15.4
VER_NODE_MODULE=83
#VER_NODE=12.20.1
#VER_NODE_MODULE=72
#VER_NODE=10.16.3
#VER_NODE_MODULE=64

#
# Canvas configuration
#
VER_CANVAS=2.6.1
PREBUILT_LD_PATH=/opt/nodejs/node_modules/canvas/build/Release

#
# AWS Lambda Layer configuration
#
NODE_LAMBDA_RUNTIME=nodejs${VER_NODE%%.*}.x
PKG_NAME=canvas-v${VER_CANVAS}-node-v${VER_NODE_MODULE}-amzn2-glibc-x64.zip
LAYER_NAME=canvas-v${VER_CANVAS//\./_}-nodejs${VER_NODE%%.*}

#
# update and install development tool
#
sudo yum update -y
sudo yum groupinstall "Development Tools" -y

#
# install nvm and node
#
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash
. ~/.nvm/nvm.sh
nvm install $VER_NODE
[ $(node --version) != "v${VER_NODE}" ] && \
  echo "mismatch node version ($(node --version) / x${VER_NODE})" && \
  exit 1

#
# install cavas library dependencies
#
sudo yum install gcc-c++ cairo-devel libjpeg-turbo-devel giflib-devel pango-devel -y

#
# install and build canvas package
#
rm -rf nodejs && mkdir nodejs
pushd nodejs
export LDFLAGS=-Wl,-rpath=${PREBUILT_LD_PATH}
npm install --build-from-source canvas@${VER_CANVAS}


#
# copy libraries to canvas build/Release folder
#
cp -L -v /usr/lib64/\
{\
libpixman-1.so.0,\
libcairo.so.2,\
libpng15.so.15,\
libpangocairo-1.0.so.0,\
libpango-1.0.so.0,\
libgif.so.4,\
libEGL.so.1,\
libxcb-shm.so.0,\
libxcb.so.1,\
libxcb-render.so.0,\
libXrender.so.1,\
libXext.so.6,\
libGL.so.1,\
libpangoft2-1.0.so.0,\
libharfbuzz.so.0,\
libfontconfig.so.1,\
libthai.so.0,\
libSM.so.6,\
libICE.so.6,\
libX11.so.6,\
libXau.so.6,\
libGLX.so.0,\
libGLdispatch.so.0,\
libgraphite2.so.3,\
libglib-2.0.so.0,\
libfreetype.so.6,\
libgthread-2.0.so.0,\
libuuid.so.1,\
libjpeg.so.62,\
libexpat.so.1,\
libgobject-2.0.so.0,\
libfribidi.so.0,\
libbz2.so.1,\
\
} ./node_modules/canvas/build/Release/

#
# readelf -d node_modules/canvas/build/Release/canvas.node | grep RPATH
#
popd

#
# create aws lambda layer package and publish to AWS Lambda console
#
rm -v ${PKG_NAME}
zip -rq ${PKG_NAME} nodejs

if [ ${PUBLISH_PACKAGE} -ne 0 ]; then
  echo "Publish to AWS Lambda console, '${LAYER_NAME}' for ${NODE_LAMBDA_RUNTIME} with package '${PKG_NAME}'"
  aws lambda publish-layer-version \
  --layer-name ${LAYER_NAME} \
  --compatible-runtimes ${NODE_LAMBDA_RUNTIME} \
  --zip-file fileb://./${PKG_NAME}
fi
