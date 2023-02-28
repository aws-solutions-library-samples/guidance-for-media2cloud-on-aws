/*********************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/
const {
    Environment,
    StateData,
    AnalysisError,
} = require('core-lib'); 

// All the libraries to be tested
/* transcribe */
const StateStartTranscribe = require('./states/start-transcribe');
const StateCollectTranscribeResults = require('./states/collect-transcribe-results');
const StateIndexTranscribeResults = require('./states/index-transcribe-results');
/* comprehend entity */
const StateStartEntity = require('./states/start-entity');
const StateIndexEntityResults = require('./states/index-entity-results');
/* comprehend keyphrase */
const StateStartKeyphrase = require('./states/start-keyphrase');
const StateIndexKeyphraseResults = require('./states/index-keyphrase-results');
/* comprehend sentiment */
const StateStartSentiment = require('./states/start-sentiment');
const StateIndexSentimentResults = require('./states/index-sentiment-results');
/* comprehend custom entity */
const StateCheckCustomEntityCriteria = require('./states/check-custom-entity-criteria');
const StateStartCustomEntity = require('./states/start-custom-entity');
const StateCheckCustomEntityStatus = require('./states/check-custom-entity-status');
const StateCreateCustomEntityTrack = require('./states/create-custom-entity-track');
const StateIndexCustomEntityResults = require('./states/index-custom-entity-results');
/* job completed */
const StateJobCompleted = require('./states/job-completed');

const lambda = require('./index.js');
// const parseEvent = 

const event_start_transcribe = {
    parallelStateOutputs: false,
    stateExecution: {
        Input: {
            input: 'fake_input',
            uuid: "88298a59-e68d-4c87-9973-afe5877e9d39"
        },
        StartTime: '0:00',
        Id: 'my_id',
        operation: "collect-transcribe-results",
        status: "NOT_STARTED",
        progress: 0
    }
}

const context = {
    invokedFunctionArn: 'arn:partition:service:region:account-id:resource-id',
    getRemainingTimeInMillis: 1000
}

const event_for_collect_transcribe_results = {
        "uuid": "b72fc9c0-58eb-83ef-42f2-dfceb342798f",
        "stateMachine": "so0050-0a709c9ee415-analysis-audio",
        "operation": "collect-transcribe-results",
        "overallStatus": "PROCESSING",
        "status": "NO_DATA",
        "progress": 100,
        "input": {
          "image": {
            "enabled": false
          },
          "request": {
            "timestamp": 1671613689920
          },
          "framerate": 59.874,
          "document": {
            "enabled": false
          },
          "destination": {
            "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
            "prefix": "b72fc9c0-58eb-83ef-42f2-dfceb342798f/surfers/"
          },
          "video": {
            "enabled": true,
            "key": "b72fc9c0-58eb-83ef-42f2-dfceb342798f/surfers/transcode/aiml/surfers.mp4"
          },
          "uuid": "b72fc9c0-58eb-83ef-42f2-dfceb342798f",
          "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
          "duration": 34273,
          "attributes": {},
          "audio": {
            "enabled": true,
            "key": "b72fc9c0-58eb-83ef-42f2-dfceb342798f/surfers/transcode/aiml/surfers.m4a"
          },
          "metrics": {
            "duration": 34273,
            "requestTime": 1671613689920,
            "startTime": 1671613691717
          },
          "key": "surfers/surfers.mp4",
          "aiOptions": {
            "sentiment": false,
            "textROI": [
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              false,
              false
            ],
            "framebased": false,
            "celeb": true,
            "frameCaptureMode": 0,
            "keyphrase": true,
            "label": true,
            "facematch": false,
            "transcribe": true,
            "face": false,
            "customentity": false,
            "person": false,
            "minConfidence": 80,
            "textract": true,
            "moderation": false,
            "segment": true,
            "customlabel": false,
            "text": false,
            "entity": true,
            "customLabelModels": []
          }
        },
        "data": {
          "transcribe": {
            "output": "b72fc9c0-58eb-83ef-42f2-dfceb342798f/surfers/raw/20221221T090809/transcribe/",
            "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_b72fc9c0-58eb-83ef-42f2-dfceb342798f_5cfa9a20f7465a80",
            "startTime": 1671613693615,
            "endTime": 1671613699787,
            "status": "NO_DATA",
            "errorMessage": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_b72fc9c0-58eb-83ef-42f2-dfceb342798f_5cfa9a20f7465a80: Your audio file must have a speech segment long enough in duration to perform automatic language identification. Provide an audio file with someone speaking for a longer period of time and try your request again.;"
          }
        }
}

const event_for_index_transcribe_results = {
    "operation": "index-transcribe-results",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.json",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693449247,
        "languageCode": "en-US",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.vtt"
      }
    },
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const event_start_transcribe_and_wait = {
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      },
      "attributes": {},
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "duration": 284653,
      "framerate": 29.97,
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "image": {
        "enabled": false
      },
      "document": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      }
    },
    "data": {},
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const  event_StateCollectTranscribeResults = {
    "operation": "collect-transcribe-results",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693446571
      }
    },
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const  event_StateIndexTranscribeResults = {
    "operation": "index-transcribe-results",
    "status": "STARTED",
    "progress": 0,
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.json",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693449247,
        "languageCode": "en-US",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.vtt"
      }
    },
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const event_StateStartSentiment = {
    "status": "NOT_STARTED",
    "operation": "start-sentiment",
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.json",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693449247,
        "languageCode": "en-US",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.vtt"
      }
    },
    "progress": 100,
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const event_StateIndexSentimentResults = {
    "status": "NOT_STARTED",
    "progress": 0,
    "operation": "index-sentiment-results",
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.json",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693449247,
        "languageCode": "en-US",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.vtt"
      },
      "comprehend": {
        "sentiment": {
          "startTime": 1671693449896,
          "endTime": 1671693450270,
          "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/comprehend/sentiment/output.manifest",
          "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/sentiment/output.json"
        }
      }
    },
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const event_StateStartKeyphrase = {
    "status": "NOT_STARTED",
    "operation": "start-keyphrase",
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.json",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693449247,
        "languageCode": "en-US",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.vtt"
      }
    },
    "progress": 100,
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const event_StateIndexKeyphraseResults = {
    "status": "NOT_STARTED",
    "progress": 0,
    "operation": "index-keyphrase-results",
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.json",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693449247,
        "languageCode": "en-US",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.vtt"
      },
      "comprehend": {
        "keyphrase": {
          "startTime": 1671693451052,
          "endTime": 1671693451949,
          "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/comprehend/keyphrase/output.manifest",
          "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/keyphrase/output.json"
        }
      }
    },
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const event_StateStartEntity = {
    "status": "NOT_STARTED",
    "operation": "start-entity",
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.json",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693449247,
        "languageCode": "en-US",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.vtt"
      }
    },
    "progress": 100,
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

const event_StateIndexEntityResults = {
    "status": "NOT_STARTED",
    "progress": 0,
    "operation": "index-entity-results",
    "input": {
      "image": {
        "enabled": false
      },
      "request": {
        "timestamp": 1671693342864
      },
      "framerate": 29.97,
      "document": {
        "enabled": false
      },
      "destination": {
        "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/"
      },
      "video": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4"
      },
      "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
      "bucket": "so0050-0a709c9ee415-193234372883-us-west-2-ingest",
      "duration": 284653,
      "attributes": {},
      "audio": {
        "enabled": true,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.m4a"
      },
      "metrics": {
        "duration": 284653,
        "requestTime": 1671693342864,
        "startTime": 1671693344722
      },
      "key": "JUMANJI_Interview/JUMANJI_Interview.mp4",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false,
          false
        ],
        "framebased": false,
        "celeb": true,
        "frameCaptureMode": 0,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": false,
        "transcribe": true,
        "face": true,
        "customentity": false,
        "person": true,
        "minConfidence": 80,
        "textract": true,
        "moderation": true,
        "segment": true,
        "customlabel": false,
        "text": true,
        "entity": true,
        "customLabelModels": []
      }
    },
    "data": {
      "transcribe": {
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.json",
        "jobId": "cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c",
        "startTime": 1671693346948,
        "endTime": 1671693449247,
        "languageCode": "en-US",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/transcribe/cee070fe-d7e5-cde0-1c51-d0cc6dbf59a9_ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8_34009be0978b435c.vtt"
      },
      "comprehend": {
        "entity": {
          "startTime": 1671693450998,
          "endTime": 1671693451803,
          "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/comprehend/entity/output.manifest",
          "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/entity/output.json"
        }
      }
    },
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8"
  }

 describe('Main / Analysis / Audio', () => {

    beforeAll(() => {
        // Mute console.log output for internal functions
        console.log = jest.fn();
    });

    beforeEach(() => {
        jest.resetModules() // Most important - it clears the cache
        // These env varialbes are not needed to test functionality
        process.env = { 
            ENV_SOLUTION_ID: 'Test_ENV_Variable',
            ENV_RESOURCE_PREFIX: 'Test_ENV_Variable',
            ENV_SOLUTION_UUID: 'Test_ENV_Variable',
            ENV_ANONYMOUS_USAGE: 'Test_ENV_Variable',
            ENV_IOT_HOST: 'Test_ENV_Variable',
            ENV_IOT_TOPIC: 'Test_ENV_Variable',
            ENV_PROXY_BUCKET: 'Test_ENV_Variable',
            ENV_DATA_ACCESS_ROLE: 'Test_ENV_Variable',
            ENV_ES_DOMAIN_ENDPOINT: 'Test_ENV_Variable'
        };
      });

	test('Test main lambda handler is able to complete ', async () => {

        const response = await lambda.handler(event_for_collect_transcribe_results, context);
        // Expected JSON response with correct ID. 
        expect(response.uuid).toBe('b72fc9c0-58eb-83ef-42f2-dfceb342798f');
	});
    test('Test the Start transcribe and wait state', async () => { 
        const stateData = lambda.parseEvent(event_start_transcribe_and_wait, context);

        let instance = new StateStartTranscribe(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the Collect transcribe results state', async () => { 
        const stateData = lambda.parseEvent(event_StateCollectTranscribeResults, context);

        let instance = new StateCollectTranscribeResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the Index transcribe results state', async () => { 
        const stateData = lambda.parseEvent(event_StateIndexTranscribeResults, context);

        let instance = new StateIndexTranscribeResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test StateStartSentiment', async () => { 
        const stateData = lambda.parseEvent(event_StateStartSentiment, context);

        let instance = new StateStartSentiment(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test StateIndexSentimentResults', async () => { 
        const stateData = lambda.parseEvent(event_StateIndexSentimentResults, context);

        let instance = new StateIndexSentimentResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


    test('Test StateStartKeyphrase', async () => { 
        const stateData = lambda.parseEvent(event_StateStartKeyphrase, context);

        let instance = new StateStartKeyphrase(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


    test('Test StateIndexKeyphraseResults', async () => { 
        const stateData = lambda.parseEvent(event_StateIndexKeyphraseResults, context);

        let instance = new StateIndexKeyphraseResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test StateStartEntity', async () => { 
        const stateData = lambda.parseEvent(event_StateStartEntity, context);

        let instance = new StateStartEntity(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


    test('Test StateIndexEntityResults', async () => { 
        const stateData = lambda.parseEvent(event_StateIndexEntityResults, context);

        let instance = new StateIndexEntityResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

//   /* comprehend entity */
//   /* comprehend keyphrase */
//   /* comprehend sentiment */

//   /* comprehend custom entity */
//   const StateCheckCustomEntityCriteria = require('./states/check-custom-entity-criteria');
//   const StateStartCustomEntity = require('./states/start-custom-entity');
//   const StateCheckCustomEntityStatus = require('./states/check-custom-entity-status');
//   const StateCreateCustomEntityTrack = require('./states/create-custom-entity-track');
//   const StateIndexCustomEntityResults = require('./states/index-custom-entity-results');
//   /* job completed */
//   const StateJobCompleted = require('./states/job-completed');
  
    // test('Analysis Audio State Machine: Index transcribe results', async () => {
    //     const Environment = jest.fn();
    //     Environment.mockImplementation(() => {
    //         return {
    //             Elasticsearch: {
    //                 DomainEndpoint: jest.fn().mockReturnValue('https://endpoint.example.com'),
    //             } 
    //         };
    //     });

    //     const response = await lambda.handler(event_for_collect_transcribe_results, context);
    //     // Expected JSON response with correct ID. 
    //     expect(response.uuid).toBe('b72fc9c0-58eb-83ef-42f2-dfceb342798f');
	// });

    // test('Analysis Audio State Machine: Index entity results', async () => {

   
});


