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
/* frame-based analysis */
const StatePrepareFrameDetectionIterators = require('./states/prepare-frame-detection-iterators');
const StateDetectFrameIterator = require('./states/detect-frame-iterator');
const StatePrepareFrameTrackIterators = require('./states/prepare-frame-track-iterators');
/* video-based analysis */
const StatePrepareVideoDetectionIterators = require('./states/prepare-video-detection-iterators');
/* custom analysis */
const StatePrepareCustomDetectionIterators = require('./states/prepare-custom-detection-iterators');
/* shared */
const StateStartDetectionIterator = require('./states/start-detection-iterator');
const StateCollectResultsIterator = require('./states/collect-results-iterator');
const StateCreateTrackIterator = require('./states/create-track-iterator');
const StateIndexAnalysisIterator = require('./states/index-analysis-iterator');
/* job completed */
const StateJobCompleted = require('./states/job-completed');


const lambda = require('./index.js');

/* frame-based analysis */
// prepare-frame-detection-iterators
const event_StatePrepareFrameDetectionIterators = {
    "operation": "prepare-frame-detection-iterators",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a709c9ee415-account-number-us-west-2-ingest",
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
        "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
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

// detect-frame-iterator
const event_StateDetectFrameIterator = 
// prepare-frame-track-iterators
const event_StatePrepareFrameTrackIterators = {
    "operation": "prepare-video-detection-iterators",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a709c9ee415-account-number-us-west-2-ingest",
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
        "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
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
/* video-based analysis */
// prepare-video-detection-iterators
const event_StatePrepareVideoDetectionIterators =  {
    "operation": "prepare-video-detection-iterators",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a709c9ee415-account-number-us-west-2-ingest",
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
        "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
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
/* custom analysis */
// prepare-custom-detection-iterators
const event_StatePrepareCustomDetectionIterators = {
    "operation": "prepare-custom-detection-iterators",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a709c9ee415-account-number-us-west-2-ingest",
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
        "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
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
/* shared */
// start-detection-iterator
const event_StateStartDetectionIterator = {
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
    "status": "NOT_STARTED",
    "progress": 0,
    "data": {
      "segment": {
        "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/",
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4",
        "duration": 284653,
        "framerate": 29.97,
        "requestTime": 1671693342864,
        "minConfidence": 80,
        "cursor": 0,
        "numOutputs": 0
      }
    }
  }
// collect-results-iterator
const event_StateCollectResultsIterator = {
    "operation": "collect-results-iterator",
    "data": {
      "segment": {
        "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
        "duration": 284653,
        "requestTime": 1671693342864,
        "cursor": 0,
        "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-segment-3c193375",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/",
        "framerate": 29.97,
        "minConfidence": 80,
        "startTime": 1671693347323,
        "numOutputs": 0,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4",
        "jobId": "ab5065a7a83e9f81273f90b9d0449b3494030c53e89d83ea72cd76c5671e6add",
        "endTime": 1671693410000
      }
    },
    "progress": 100,
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
    "status": "COMPLETED"
  }
// create-track-iterator
const event_StateCreateTrackIterator = {
    "operation": "create-track-iterator",
    "data": {
      "segment": {
        "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
        "duration": 284653,
        "requestTime": 1671693342864,
        "cursor": 0,
        "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-segment-3c193375",
        "prefix": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/",
        "framerate": 29.97,
        "minConfidence": 80,
        "startTime": 1671693347323,
        "numOutputs": 1,
        "key": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/transcode/aiml/JUMANJI_Interview.mp4",
        "jobId": "ab5065a7a83e9f81273f90b9d0449b3494030c53e89d83ea72cd76c5671e6add",
        "endTime": 1671693410000
      }
    },
    "progress": 100,
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
    "status": "COMPLETED"
  }
// index-analysis-iterator
const event_StateIndexAnalysisIterator = {
    "operation": "index-analysis-results",
    "data": {
      "segment": {
        "startTime": 1671693347323,
        "endTime": 1671693410000,
        "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-segment-3c193375",
        "jobId": "ab5065a7a83e9f81273f90b9d0449b3494030c53e89d83ea72cd76c5671e6add",
        "numOutputs": 1,
        "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
        "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/rekognition/segment/",
        "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/segment/",
        "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/vtt/segment/",
        "edl": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/edl/segment/"
      }
    },
    "progress": 100,
    "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
    "status": "COMPLETED"
  }
// job-completed
const event_StateJobCompleted = {
    "operation": "job-completed",
    "stateExecution": {
      "Id": "arn:aws:states:us-west-2:account-number:execution:so0050-0a709c9ee415-analysis-video:3bc3cdb8-44ae-4e7d-8839-f43e3f12ae9b",
      "Input": {
        "status": "NOT_STARTED",
        "progress": 0,
        "input": {
          "bucket": "so0050-0a709c9ee415-account-number-us-west-2-ingest",
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
            "bucket": "so0050-0a709c9ee415-account-number-us-west-2-proxy",
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
      },
      "StartTime": "2022-12-22T07:15:45.207Z",
      "Name": "3bc3cdb8-44ae-4e7d-8839-f43e3f12ae9b",
      "RoleArn": "arn:aws:iam::account-number:role/so0050-0a709c9ee415/MyMedia2CloudTest-Backend-AnalysisStateMachineServ-15UVTS9SYPLZU"
    },
    "parallelStateOutputs": [
      {
        "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
        "stateMachine": "so0050-0a709c9ee415-analysis-video",
        "operation": "prepare-frame-track-iterators",
        "overallStatus": "PROCESSING",
        "status": "NOT_STARTED",
        "progress": 0,
        "data": {
          "iterators": []
        }
      },
      {
        "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
        "stateMachine": "so0050-0a709c9ee415-analysis-video",
        "operation": "prepare-video-detection-iterators",
        "overallStatus": "PROCESSING",
        "status": "NOT_STARTED",
        "progress": 0,
        "data": {
          "iterators": [
            {
              "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
              "stateMachine": "so0050-0a709c9ee415-analysis-video",
              "operation": "index-analysis-results",
              "overallStatus": "PROCESSING",
              "status": "COMPLETED",
              "progress": 100,
              "data": {
                "celeb": {
                  "startTime": 1671693347300,
                  "endTime": 1671693408000,
                  "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-celeb-9d504a2b",
                  "jobId": "1da867cde610043c68703babe8ab0833907123aab791e21e6363ca964b8baf46",
                  "numOutputs": 1,
                  "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/rekognition/celeb/mapFile.json",
                  "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/celeb/",
                  "timeseries": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/timeseries/celeb/",
                  "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/vtt/celeb/"
                }
              }
            },
            {
              "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
              "stateMachine": "so0050-0a709c9ee415-analysis-video",
              "operation": "index-analysis-results",
              "overallStatus": "PROCESSING",
              "status": "COMPLETED",
              "progress": 100,
              "data": {
                "face": {
                  "startTime": 1671693348465,
                  "endTime": 1671693451000,
                  "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-face-7e71b798",
                  "jobId": "489e381f1e04455241dab9c6d176ba78b8ed27865d84824a37906e50d39e97a0",
                  "numOutputs": 1,
                  "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/rekognition/face/mapFile.json",
                  "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/face/",
                  "timeseries": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/timeseries/face/",
                  "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/vtt/face/"
                }
              }
            },
            {
              "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
              "stateMachine": "so0050-0a709c9ee415-analysis-video",
              "operation": "index-analysis-results",
              "overallStatus": "PROCESSING",
              "status": "COMPLETED",
              "progress": 100,
              "data": {
                "label": {
                  "startTime": 1671693347644,
                  "endTime": 1671693420000,
                  "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-label-f07df949",
                  "jobId": "de150001a40f02c5001b30cce62a2e2e1b0d24578ec13243e6a86155a1bf2b0d",
                  "numOutputs": 1,
                  "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/rekognition/label/mapFile.json",
                  "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/label/",
                  "timeseries": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/timeseries/label/",
                  "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/vtt/label/"
                }
              }
            },
            {
              "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
              "stateMachine": "so0050-0a709c9ee415-analysis-video",
              "operation": "index-analysis-results",
              "overallStatus": "PROCESSING",
              "status": "COMPLETED",
              "progress": 100,
              "data": {
                "moderation": {
                  "startTime": 1671693348388,
                  "endTime": 1671693452000,
                  "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-moderation-00850110",
                  "jobId": "1a64331d9f1ab72f1d18e4d0a3a936995b4ec337bb16126838a3c3240b038ce4",
                  "numOutputs": 1,
                  "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/rekognition/moderation/mapFile.json",
                  "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/moderation/",
                  "timeseries": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/timeseries/moderation/",
                  "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/vtt/moderation/"
                }
              }
            },
            {
              "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
              "stateMachine": "so0050-0a709c9ee415-analysis-video",
              "operation": "index-analysis-results",
              "overallStatus": "PROCESSING",
              "status": "COMPLETED",
              "progress": 100,
              "data": {
                "text": {
                  "startTime": 1671693348376,
                  "endTime": 1671693418000,
                  "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-text-336a55e7",
                  "jobId": "1f07b0a9fb1fd47f67a0a25156582a696405313a26aad0cc7e11a85ff10b6240",
                  "numOutputs": 1,
                  "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/rekognition/text/mapFile.json",
                  "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/text/",
                  "timeseries": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/timeseries/text/"
                }
              }
            },
            {
              "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
              "stateMachine": "so0050-0a709c9ee415-analysis-video",
              "operation": "index-analysis-results",
              "overallStatus": "PROCESSING",
              "status": "COMPLETED",
              "progress": 100,
              "data": {
                "person": {
                  "startTime": 1671693347332,
                  "endTime": 1671693736000,
                  "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-person-659d1b6d",
                  "jobId": "e0e1746f94a5ca5832fd6d40726249b17038e07e022064a499d03ad56a1478b1",
                  "numOutputs": 1,
                  "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/rekognition/person/mapFile.json",
                  "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/person/",
                  "timeseries": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/timeseries/person/",
                  "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/vtt/person/"
                }
              }
            },
            {
              "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
              "stateMachine": "so0050-0a709c9ee415-analysis-video",
              "operation": "index-analysis-results",
              "overallStatus": "PROCESSING",
              "status": "COMPLETED",
              "progress": 100,
              "data": {
                "segment": {
                  "startTime": 1671693347323,
                  "endTime": 1671693410000,
                  "backlogId": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8-segment-3c193375",
                  "jobId": "ab5065a7a83e9f81273f90b9d0449b3494030c53e89d83ea72cd76c5671e6add",
                  "numOutputs": 1,
                  "output": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/raw/20221222T071542/rekognition/segment/",
                  "metadata": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/metadata/segment/",
                  "vtt": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/vtt/segment/",
                  "edl": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8/JUMANJI_Interview/edl/segment/"
                }
              }
            }
          ]
        }
      },
      {
        "uuid": "ae67fe18-c8f8-7cff-662a-d8ea2bacd5c8",
        "stateMachine": "so0050-0a709c9ee415-analysis-video",
        "operation": "prepare-custom-detection-iterators",
        "overallStatus": "PROCESSING",
        "status": "NOT_STARTED",
        "progress": 0,
        "data": {
          "iterators": []
        }
      }
    ]
  }


const context = {
    invokedFunctionArn: 'arn:partition:service:region:account-id:resource-id',
    getRemainingTimeInMillis: 1000
}

 describe('#Main/Analysis/Video::', () => {

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

        process.env.ENV_ES_DOMAIN_ENDPOINT = 'Test_ENV_Variable';

      });

    test('Test Lambda handler for state start document ', async () => {

        const response = await lambda.handler(event_StateStartImageAnalysis, context);
        // Expected JSON response with correct ID. 
        expect(response.uuid).toBe('6c56edc5-a973-3485-c9eb-16292d709749');
	});
    

    test('Test StateIndexAnalysisResults', async () => { 
        // const stateData = lambda.parseEvent(event_StateIndexAnalysisResults, context);
        const stateData = new StateData(Environment.StateMachines.DocumentAnalysis, event_StateIndexAnalysisResults, context);

        let instance = new StateIndexAnalysisResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });



});


