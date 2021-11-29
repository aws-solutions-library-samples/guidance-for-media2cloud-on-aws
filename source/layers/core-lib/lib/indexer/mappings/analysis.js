// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
// Licensed under the Amazon Software License  http://aws.amazon.com/asl/

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
