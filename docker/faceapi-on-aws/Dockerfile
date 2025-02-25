# NodeJS v20

#####################################################################
#
# Build Stage: install tensorflow, face-api, and run quick test
#
#####################################################################
FROM public.ecr.aws/lambda/nodejs:20 AS build

RUN \
microdnf update -y && \
npm install -g npm && \
mkdir /opt/nodejs

# Copy artefacts
COPY .version package.json app.js app.test.js demo.jpg ./
COPY lib/ ./lib/

WORKDIR /opt/nodejs

COPY package.json ./

# install tensorflow and face-api packages
RUN npm install --omit=dev

ENV \
NODE_PATH=/opt/nodejs/node_modules \
MODEL_PATH=/opt/nodejs/node_modules/@vladmandic/face-api/model

RUN cd /var/task && node app.test.js demo.jpg

#####################################################################
#
# Release Stage: copy canvas binaries from build stage
#
#####################################################################
FROM public.ecr.aws/lambda/nodejs:20 AS release

RUN microdnf update -y

# Copy packages to /opt
COPY --from=build /opt /opt
COPY --from=build /var/task /var/task

# Copy artefacts
# COPY .version package.json app.js app.test.js demo.jpg ./
# COPY .version package.json app.js ./
# COPY lib/ ./lib/

# set environment
ENV \
NODE_PATH=/opt/nodejs/node_modules \
MODEL_PATH=/opt/nodejs/node_modules/@vladmandic/face-api/model

# Program Entrypoint
CMD [ "app.handler" ]
