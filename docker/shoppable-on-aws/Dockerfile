# Python 3.10

#####################################################################
#
# Build Stage: install packages and preload models from HF
#
#####################################################################
FROM public.ecr.aws/lambda/python:3.10 AS build

ENV \
    PYTHONPATH=/opt/packages \
    TORCH_HOME=/opt/.cache/torch \
    HF_HOME=/opt/.cache/huggingface \
    HF_DATASETS_OFFLINE=/opt/.cache/huggingface/dataset \
    HF_ASSETS_CACHE=/opt/.cache/huggingface/assets \
    HF_HUB_CACHE=/opt/.cache/huggingface/hub

COPY requirements.txt .version app.py app.test.py utils.py demo.jpg ./

RUN \
    yum update -y && \
    yum install -y gcc unzip && \
    python3.10 -m pip install --no-cache-dir --upgrade pip && \
    python3.10 -m pip install --no-cache-dir --retries 10 --timeout 60 \
    -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -t /opt/packages && \
    python3.10 -m pip cache purge --no-input

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

ENV \
    PYTHONPATH=/opt/packages \
    TORCH_HOME=/opt/.cache/torch \
    HF_HOME=/opt/.cache/huggingface \
    HF_DATASETS_OFFLINE=/opt/.cache/huggingface/dataset \
    HF_ASSETS_CACHE=/opt/.cache/huggingface/assets \
    HF_HUB_CACHE=/opt/.cache/huggingface/hub \
    HF_HUB_OFFLINE=1

RUN \
    yum update -y && \
    yum clean all && \
    python3.10 -m pip install --no-cache-dir --upgrade pip

# Copy packages and models from build
COPY --from=build /opt /opt

COPY requirements.txt .version app.py app.test.py utils.py demo.jpg ./

# Set entrypoint
CMD [ "app.lambda_handler" ]

# For testing locally
# docker run -it --entrypoint /bin/bash image-id
