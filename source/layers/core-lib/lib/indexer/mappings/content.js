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
        // Input: John Doe, Jane_Doe, Ann Doé, Joe-Jo Doe II
        // Output: ["john", "doe", "jane", "doe", "ann", "doé", "Joe", "jo", "doe", "ii"]
        default: {
          char_filter: [
            'underscore_space',
          ],
          tokenizer: 'standard',
          filter: [
            'lowercase',
            'stop',
          ],
        },
        // Input: John Doe, Jane_Doe, Musical Instrument, Ann Doé, Joe-Jo Doe II
        // Output: ["john doe", "jane doe", "musical instrument", "ann doé", "joe-jo doe iii"]
        phrase_analyzer: {
          char_filter: [
            'underscore_space',
          ],
          tokenizer: 'comma_delimiter_tokenizer',
          filter: [
            'lowercase',
          ],
        },
      },
      tokenizer: {
        comma_delimiter_tokenizer: {
          type: 'pattern',
          pattern: ',',
          lowercase: true,
          flags: 'CASE_INSENSITIVE',
        },
      },
      char_filter: {
        underscore_space: {
          type: 'pattern_replace',
          pattern: '_',
          replacement: ' ',
        },
      },
    },
  },
  mappings: {
    properties: {
      uuid: {
        type: 'keyword',
      },
      type: {
        type: 'keyword',
      },
      timestamp: {
        type: 'date',
        format: 'epoch_millis',
      },
      group: {
        type: 'keyword',
      },
      status: {
        type: 'keyword',
      },
      overallStatus: {
        type: 'keyword',
      },
      executionArn: {
        type: 'text',
      },
      fileSize: {
        type: 'long',
      },
      mime: {
        type: 'keyword',
      },
      duration: {
        type: 'long',
      },
      framerate: {
        type: 'float',
      },
      basename: {
        type: 'text',
      },
      bucket: {
        type: 'text',
      },
      key: {
        type: 'text',
      },
      md5: {
        type: 'keyword',
      },
      lastModified: {
        type: 'date',
        format: 'epoch_millis',
      },
      attributes: {
        type: 'object',
      },
      aiOptions: {
        type: 'object',
      },
      celeb: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      facematch: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
          faceId: {
            type: 'keyword',
          },
        },
      },
      face: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      label: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      customlabel: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
          model: {
            type: 'keyword',
          },
        },
      },
      moderation: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      text: {
        properties: {
          name: {
            type: 'text',
          },
          timecodes: {
            type: 'object',
            properties: {
              begin: {
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      transcribe: {
        properties: {
          name: {
            type: 'text',
          },
          timecodes: {
            type: 'object',
            properties: {
              begin: {
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      entity: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      customentity: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      keyphrase: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      sentiment: {
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
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
      textract: {
        properties: {
          name: {
            type: 'text',
          },
          timecodes: {
            type: 'object',
            properties: {
              begin: {
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
          page: {
            type: 'short',
          },
        },
      },
      caption: {
        properties: {
          name: {
            type: 'text',
          },
          timecodes: {
            type: 'object',
            properties: {
              begin: {
                type: 'long',
              },
              end: {
                type: 'long',
              },
            },
          },
        },
      },
    },
  },
};
