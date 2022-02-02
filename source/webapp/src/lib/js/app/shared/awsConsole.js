// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SolutionManifest from '/solution-manifest.js';

export class AWSConsoleS3 {
  static getLink(bucket, key) {
    return (key)
      ? `https://s3.console.aws.amazon.com/s3/object/${bucket}/${key}?region=${SolutionManifest.Region}`
      : `https://s3.console.aws.amazon.com/s3/buckets/${bucket}/?region=${SolutionManifest.Region}`;
  }
}

export class AWSConsoleStepFunctions {
  static getExecutionLink(arn) {
    return `https://console.aws.amazon.com/states/home?region=${SolutionManifest.Region}#/executions/details/${arn}`;
  }
}

export class AWSConsoleTranscribe {
  static getJobLink(name) {
    return `https://console.aws.amazon.com/transcribe/home?region=${SolutionManifest.Region}#job-details/${name}`;
  }
}
