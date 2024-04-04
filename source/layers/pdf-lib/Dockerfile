# NodeJS v20
#####################################################################
#
# Build Stage: build Canvas and PDF.JS packages
#
#####################################################################
FROM public.ecr.aws/lambda/nodejs:20 AS build

# Dependencies to build canvas from source
# node-pre-gyp requires Python3.6 and above. zip package to create the layer
RUN \
dnf install -y \
  make \
  automake \
  gcc \
  gcc-c++ \
  kernel-devel \
  cairo-devel \
  libjpeg-turbo-devel \
  giflib-devel \
  pango-devel \
  pixman-devel \
  librsvg2-devel \
  python3 \
  zip

# Set working directory to /opt/nodejs
RUN mkdir /opt/nodejs
WORKDIR /opt/nodejs

# Update npm to the latest
# Build canvas from source and then install pdf.js package
# Fixing the path2d-polyfill version for CJS instead of ES syntax
RUN \
npm install -g npm && \
npm install canvas@v2.11.2 --build-from-source && \
npm install path2d-polyfill@2.0.1 --omit=dev && \
npm install pdfjs-dist@3.11.174 --omit=dev --omit=optional

# Copy all dependencies required by canvas.node to /opt/lib/
RUN \
mkdir /opt/lib && \
cp -L -v /lib64/{\
libblkid.so.1,\
libbz2.so.1,\
libc.so.6,\
libcairo.so.2,\
libdl.so.2,\
libexpat.so.1,\
libffi.so.8,\
libfontconfig.so.1,\
libfreetype.so.6,\
libfribidi.so.0,\
libgcc_s.so.1,\
libgdk_pixbuf-2.0.so.0,\
libgif.so.7,\
libgio-2.0.so.0,\
libglib-2.0.so.0,\
libgmodule-2.0.so.0,\
libgobject-2.0.so.0,\
libgraphite2.so.3,\
libgthread-2.0.so.0,\
libharfbuzz.so.0,\
libjpeg.so.62,\
liblzma.so.5,\
libm.so.6,\
libmount.so.1,\
libpango-1.0.so.0,\
libpangocairo-1.0.so.0,\
libpangoft2-1.0.so.0,\
libpcre2-8.so.0,\
libpixman-1.so.0,\
libpng16.so.16,\
libpthread.so.0,\
libresolv.so.2,\
librsvg-2.so.2,\
librt.so.1,\
libselinux.so.1,\
libstdc++.so.6,\
libthai.so.0,\
libxcb-render.so.0,\
libxcb-shm.so.0,\
libxcb.so.1,\
libxml2.so.2,\
libuuid.so.1,\
libz.so.1,\
libX11.so.6,\
libXau.so.6,\
libXext.so.6,\
libXrender.so.1,\
libbrotlicommon.so.1,\
libbrotlidec.so.1,\
libcairo-gobject.so.2,\
libdatrie.so.1\
} /opt/lib

# libcroco-0.6.so.3,\
# libEGL.so.1,\
# libGL.so.1,\
# libGLX.so.0,\
# libGLdispatch.so.0,\
# libICE.so.6,\
# libSM.so.6,\

# Create Lambda Layer package
RUN \
cd /opt && \
zip -r /var/task/package.zip . && \
echo "== Build stage completed =="

#####################################################################
#
# Release Stage: copy /opt/nodejs and /opt/lib
#
#####################################################################
FROM public.ecr.aws/lambda/nodejs:20 AS release

# Copy packages from build
COPY --from=build /opt /opt
COPY --from=build /var/task/package.zip .

# Copy test script to validate the package
COPY test.js dummy.pdf ./

# Test run to convert a PDF to JPG image
RUN \
NODE_PATH=/opt/nodejs/node_modules node test.js dummy.pdf && \
echo "== Release stage completed =="
