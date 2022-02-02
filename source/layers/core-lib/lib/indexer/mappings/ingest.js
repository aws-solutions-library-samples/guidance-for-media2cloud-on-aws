// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  settings: {
    index: {
      'sort.field': 'timestamp',
      'sort.order': 'desc',
    },
    analysis: {
      analyzer: {
        default: {
          type: 'pattern',
          pattern: '\\W|_',
          lowercase: true,
        },
      },
    },
  },
  mappings: {
    properties: {
      overallStatus: {
        type: 'keyword',
      },
      lastModified: {
        type: 'date',
        format: 'epoch_millis',
      },
      aiOptions: {
        type: 'object',
      },
      timestamp: {
        type: 'date',
        format: 'epoch_millis',
      },
      status: {
        type: 'keyword',
      },
      basename: {
        type: 'text',
        fields: {
          keyword: {
            type: 'keyword',
          },
        },
      },
      attributes: {
        type: 'object',
      },
      bucket: {
        type: 'text',
      },
      group: {
        type: 'text',
        fields: {
          keyword: {
            type: 'keyword',
          },
        },
      },
      executionArn: {
        type: 'text',
      },
      fileSize: {
        type: 'long',
      },
      mime: {
        type: 'text',
        fields: {
          keyword: {
            type: 'keyword',
          },
        },
      },
      framerate: {
        type: 'float',
      },
      uuid: {
        type: 'text',
        fields: {
          keyword: {
            type: 'keyword',
          },
        },
      },
      key: {
        type: 'text',
      },
      duration: {
        type: 'long',
      },
      type: {
        type: 'keyword',
      },
      md5: {
        type: 'text',
      },
    },
  },
};
