# NodeJS v20
#####################################################################
#
# Build Stage: build Canvas and PDF.JS packages
#
#####################################################################
FROM public.ecr.aws/lambda/nodejs:20 AS build

# Dependencies to build perl and exiftool!!
RUN dnf install -y \
  make \
  automake \
  gcc \
  gcc-c++ \
  kernel-devel \
  wget \
  zip \
  tar

# Build Perl5 from source code
RUN wget https://www.cpan.org/src/5.0/perl-5.36.0.tar.gz \
  && tar -xzf perl-5.36.0.tar.gz

RUN cd perl-5.36.0 \
  && ./Configure -des \
    -Dprefix=/opt \
    -Dman1dir=none \
    -Dman3dir=none \
    -Dinstallusrbinperl \
  && make \
  && make install

# Install exiftool
RUN wget https://github.com/exiftool/exiftool/archive/refs/tags/12.70.tar.gz -O exiftool.tar.gz \
  && tar -xzf exiftool.tar.gz \
  && mv -v ./exiftool-12.70/exiftool /opt/bin/ \
  && mv -v ./exiftool-12.70/lib /opt/bin/

RUN cp -L -v /lib64/{\
libm.so.6,\
libcrypt.so.2,\
libc.so.6\
} /opt/lib/

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
COPY test.js dummy.png ${LAMBDA_TASK_ROOT}

# Test exiftool with a dummy image
RUN node test.js dummy.png && \
echo "== Release stage completed =="
