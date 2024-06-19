# Python 3.10

#####################################################################
#
# Build Stage: install packages and preload models from HF
#
#####################################################################
FROM public.ecr.aws/lambda/python:3.10 AS build

# Update with the latest security patches
# Install packages required for the build process
RUN \
yum update -y && \
yum install -y gcc unzip && \
python3.10 -m pip install --no-cache-dir --upgrade pip && \
python3.10 -m pip install --no-cache-dir  --retries 10 --timeout 60 \
numpy==1.26.4 \
boto3 \
transformers==4.37.2 \
torch==2.1.0 \
torchvision \
-t /opt/packages

# set python package look up path
# cache config files
# cache model
ENV \
PYTHONPATH=/opt/packages:$PYTHONPATH \
TORCH_HOME=/opt/.cache/torch \
HF_HOME=/opt/.cache/huggingface \
HF_DATASETS_OFFLINE=/opt/.cache/huggingface/dataset \
HF_ASSETS_CACHE=/opt/.cache/huggingface/assets \
HF_HUB_CACHE=/opt/.cache/huggingface/hub

# Copy function code
COPY .version app.py app.test.py utils.py demo.jpg ./

# Run script to pre-cache configuration files
RUN \
python3.10 app.test.py demo.jpg && \
echo "== Build stage completed =="

#####################################################################
#
# Release Stage: copy python packages and models from build stage
#
#####################################################################
FROM public.ecr.aws/lambda/python:3.10 AS release

# Update system libraries and pip
RUN \
yum update -y && \
yum clean all && \
python3.10 -m pip install --no-cache-dir --upgrade pip

# Copy packages and models from build
COPY --from=build /opt /opt

# Copy application
COPY .version app.py app.test.py utils.py demo.jpg ./

# set python package look up path
# cache config files
# cache model
ENV \
PYTHONPATH=/opt/packages:$PYTHONPATH \
TORCH_HOME=/opt/.cache/torch \
HF_HOME=/opt/.cache/huggingface \
HF_DATASETS_OFFLINE=/opt/.cache/huggingface/dataset \
HF_ASSETS_CACHE=/opt/.cache/huggingface/assets \
HF_HUB_CACHE=/opt/.cache/huggingface/hub \
HF_HUB_OFFLINE=1

RUN echo "== Release stage completed =="

# Set entrypoint
CMD [ "app.lambda_handler" ]

# For testing locally
# docker run -it --entrypoint /bin/bash image-id
