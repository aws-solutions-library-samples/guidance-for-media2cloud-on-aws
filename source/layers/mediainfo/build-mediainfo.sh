#!/bin/sh

BUILD_DIR=$(pwd)

OPENSSL_RELEASE_VERSION=OpenSSL_1_1_1g
LIBCURL_RELEASE_VERSION=curl-7_72_0
ZENLIB_RELEASE_VERSION=v0.4.38
MEDIAINFO_RELEASE_VERSION=v20.08

#
# Install dependencies
#
sudo yum -y update && \
sudo yum -y groupinstall -y 'Development Tools' && \
sudo yum -y install git zlib-devel perl-core

#
# OpenSSL
#
git clone --depth=1 --branch ${OPENSSL_RELEASE_VERSION} https://github.com/openssl/openssl && \
  (cd openssl && ./config no-shared --prefix=${BUILD_DIR}/openssl/usr && make install)

#
# Libcurl
#
git clone --depth=1 --branch ${LIBCURL_RELEASE_VERSION} https://github.com/curl/curl && \
  (cd curl && autoreconf -if  && ./configure --enable-static --disable-shared --with-ssl=${BUILD_DIR}/openssl/usr --prefix=${BUILD_DIR}/curl/usr && make install)

#
# Zenlib
#
git clone --depth=1 --branch ${ZENLIB_RELEASE_VERSION} https://github.com/MediaArea/ZenLib.git && \
  (cd ZenLib/Project/GNU/Library && ./autogen.sh && ./configure --enable-static && make)

#
# MediainfoLib
#
git clone --depth=1 --branch ${MEDIAINFO_RELEASE_VERSION} https://github.com/MediaArea/MediaInfoLib.git && \
  (cd MediaInfoLib/Project/GNU/Library && ./autogen.sh && ./configure --enable-staticlibs --enable-static --with-libcurl=${BUILD_DIR}/curl/usr && make)

#
# MediainfoCLI (static linked)
#
git clone --depth=1 --branch ${MEDIAINFO_RELEASE_VERSION} https://github.com/MediaArea/MediaInfo.git && \
  (cd MediaInfo/Project/GNU/CLI && ./autogen.sh && ./configure --enable-staticlibs && make)

#
# zip binaries and libraries
#
cp -v ${BUILD_DIR}/MediaInfo/Project/GNU/CLI/mediainfo ${BUILD_DIR}/mediainfo
