// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

module.exports = {
  settings: {
    index: {
      max_inner_result_window: 1000,
    },
    analysis: {
      analyzer: {
        default: {
          type: 'standard',
        },
      },
    },
  },
  mappings: {
    properties: {
      type: {
        type: 'keyword',
      },
      data: {
        type: 'nested',
        properties: {
          name: {
            type: 'text',
            fields: {
              keyword: {
                type: 'keyword',
              },
            },
          },
          timecodes: {
            type: 'object',
            properties: {
              begin: {
                type: 'integer',
              },
              end: {
                type: 'integer',
              },
            },
          },
          model: {
            type: 'text',
            fields: {
              keyword: {
                type: 'keyword',
              },
            },
          },
          page: {
            type: 'short',
          },
        },
      },
    },
  },
};
