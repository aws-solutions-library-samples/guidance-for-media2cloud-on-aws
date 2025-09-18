# Python 3.10

#####################################################################
#
# Build Stage: install packages and preload models from HF
#
#####################################################################
FROM public.ecr.aws/lambda/python:3.10 AS build

# set python package look up path
ENV PYTHONPATH=/opt/packages

# Copy function code
COPY requirements.txt .version app.py app.test.py utils.py ./

# Update with the latest security patches
# Install packages required for the build process
RUN \
    yum update -y && \
    python3.10 -m pip install --no-cache-dir --upgrade pip && \
    python3.10 -m pip install --no-cache-dir \
    -r requirements.txt \
    -t /opt/packages  && \
    python3.10 -m pip cache purge --no-input

# Run quick test
RUN \
    python3.10 app.test.py && \
    echo "== Build stage completed =="

#####################################################################
#
# Release Stage: copy python packages and models from build stage
#
#####################################################################
FROM public.ecr.aws/lambda/python:3.10 AS release

# set python package look up path
# cache config files
# cache model
ENV PYTHONPATH=/opt/packages

# Update system libraries and pip
RUN \
    yum update -y && \
    yum clean all && \
    python3.10 -m pip install --no-cache-dir --upgrade pip

# Copy packages and models from build
COPY --from=build /opt /opt

# Copy application
COPY .version app.py app.test.py utils.py ./

RUN echo "== Release stage completed =="

# Set entrypoint
CMD [ "app.lambda_handler" ]

# For testing locally
# docker run -it --entrypoint /bin/bash image-id
