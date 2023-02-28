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
const StateCreateRecord = require('./states/create-record');
const StateFixityCompleted = require('./states/fixity-completed');
const StateIndexIngestResults = require('./states/index-ingest-results');
const StateJobCompleted = require('./states/job-completed');
const StateUpdateRecord = require('./states/update-record');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');


const event_StateCreateRecord = {
    "operation": "create-record",
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-account-number-us-east-1-ingest",
      "key": "speech/speech.mp3",
      "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500",
      "aiOptions": {
        "celeb": true,
        "face": true,
        "facematch": true,
        "label": true,
        "moderation": true,
        "person": true,
        "text": true,
        "segment": true,
        "customlabel": false,
        "minConfidence": 80,
        "customLabelModels": [],
        "frameCaptureMode": 1003,
        "textROI": [
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true
        ],
        "framebased": true,
        "transcribe": true,
        "keyphrase": true,
        "entity": true,
        "sentiment": true,
        "customentity": false,
        "textract": true,
        "languageCode": "en-US"
      },
      "attributes": {},
      "destination": {
        "bucket": "so0050-0a9ab6b1a00f-account-number-us-east-1-proxy",
        "prefix": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/"
      }
    },
    "executionArn": "arn:aws:states:us-east-1:account-number:execution:so0050-0a9ab6b1a00f-ingest-main:b13ecca9-ad1e-440a-9773-1e1bc6095a0f"
  }

const event_StateFixityCompleted = {
    "operation": "fixity-completed",
    "nestedStateOutput": {
      "ExecutionArn": "arn:aws:states:us-east-1:account-number:execution:so0050-0a9ab6b1a00f-ingest-fixity:ae770da8-284d-4361-b2d0-f42d05cb4f74",
      "Input": "{\"operation\":\"check-restore-status\",\"input\":{\"bucket\":\"so0050-0a9ab6b1a00f-account-number-us-east-1-ingest\",\"key\":\"speech/speech.mp3\",\"uuid\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500\",\"aiOptions\":{\"celeb\":true,\"face\":true,\"facematch\":true,\"label\":true,\"moderation\":true,\"person\":true,\"text\":true,\"segment\":true,\"customlabel\":false,\"minConfidence\":80,\"customLabelModels\":[],\"frameCaptureMode\":1003,\"textROI\":[true,true,true,true,true,true,true,true,true],\"framebased\":true,\"transcribe\":true,\"keyphrase\":true,\"entity\":true,\"sentiment\":true,\"customentity\":false,\"textract\":true,\"languageCode\":\"en-US\"},\"attributes\":{},\"destination\":{\"bucket\":\"so0050-0a9ab6b1a00f-account-number-us-east-1-proxy\",\"prefix\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/\"},\"type\":\"audio\"},\"data\":{},\"progress\":100,\"uuid\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500\",\"status\":\"INGEST_STARTED\"}",
      "InputDetails": {
        "Included": true
      },
      "Name": "ae770da8-284d-4361-b2d0-f42d05cb4f74",
      "Output": "{\"uuid\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500\",\"stateMachine\":\"so0050-0a9ab6b1a00f-ingest-main\",\"operation\":\"validate-checksum\",\"overallStatus\":\"PROCESSING\",\"status\":\"COMPLETED\",\"progress\":100,\"input\":{\"bucket\":\"so0050-0a9ab6b1a00f-account-number-us-east-1-ingest\",\"key\":\"speech/speech.mp3\",\"uuid\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500\",\"aiOptions\":{\"celeb\":true,\"face\":true,\"facematch\":true,\"label\":true,\"moderation\":true,\"person\":true,\"text\":true,\"segment\":true,\"customlabel\":false,\"minConfidence\":80,\"customLabelModels\":[],\"frameCaptureMode\":1003,\"textROI\":[true,true,true,true,true,true,true,true,true],\"framebased\":true,\"transcribe\":true,\"keyphrase\":true,\"entity\":true,\"sentiment\":true,\"customentity\":false,\"textract\":true,\"languageCode\":\"en-US\"},\"attributes\":{},\"destination\":{\"bucket\":\"so0050-0a9ab6b1a00f-account-number-us-east-1-proxy\",\"prefix\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/\"},\"type\":\"audio\"},\"data\":{\"restore\":{\"tier\":\"Bulk\",\"startTime\":1675409786919,\"endTime\":1675409786919},\"checksum\":{\"algorithm\":\"md5\",\"fileSize\":2722840,\"computed\":\"ac5cfe51b37d5711de590746ba461bfe\",\"storeChecksumOnTagging\":true,\"startTime\":1675409787118,\"endTime\":1675409787334,\"comparedWith\":\"object-metadata\",\"comparedResult\":\"MATCHED\",\"tagUpdated\":true}}}",
      "OutputDetails": {
        "Included": true
      },
      "StartDate": 1675409785710,
      "StateMachineArn": "arn:aws:states:us-east-1:account-number:stateMachine:so0050-0a9ab6b1a00f-ingest-fixity",
      "Status": "SUCCEEDED",
      "StopDate": 1675409787811
    }
  }

const event_StateIndexIngestResults = {
    "operation": "index-ingest-results",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-account-number-us-east-1-ingest",
      "duration": 453799,
      "destination": {
        "bucket": "so0050-0a9ab6b1a00f-account-number-us-east-1-proxy",
        "prefix": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/"
      },
      "attributes": {},
      "type": "audio",
      "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500",
      "key": "speech/speech.mp3",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true
        ],
        "framebased": true,
        "celeb": true,
        "frameCaptureMode": 1003,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": true,
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
      "checksum": {
        "comparedResult": "MATCHED",
        "storeChecksumOnTagging": true,
        "computed": "ac5cfe51b37d5711de590746ba461bfe",
        "fileSize": 2722840,
        "startTime": 1675409787118,
        "endTime": 1675409787334,
        "comparedWith": "object-metadata",
        "tagUpdated": true,
        "algorithm": "md5"
      },
      "transcode": {
        "output": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/transcode/",
        "jobId": "1675409793856-6whu0q",
        "startTime": 1675409794011,
        "endTime": 1675409805251
      },
      "restore": {
        "tier": "Bulk",
        "startTime": 1675409786919,
        "endTime": 1675409786919
      },
      "mediainfo": {
        "output": [
          "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/mediainfo/mediainfo.json",
          "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/mediainfo/mediainfo.xml"
        ]
      }
    },
    "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500"
  }

const event_StateJobCompleted = {
    "operation": "job-completed",
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-account-number-us-east-1-ingest",
      "duration": 453799,
      "destination": {
        "bucket": "so0050-0a9ab6b1a00f-account-number-us-east-1-proxy",
        "prefix": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/"
      },
      "attributes": {},
      "type": "audio",
      "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500",
      "key": "speech/speech.mp3",
      "aiOptions": {
        "sentiment": true,
        "textROI": [
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true
        ],
        "framebased": true,
        "celeb": true,
        "frameCaptureMode": 1003,
        "keyphrase": true,
        "label": true,
        "languageCode": "en-US",
        "facematch": true,
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
      "checksum": {
        "comparedResult": "MATCHED",
        "storeChecksumOnTagging": true,
        "computed": "ac5cfe51b37d5711de590746ba461bfe",
        "fileSize": 2722840,
        "startTime": 1675409787118,
        "endTime": 1675409787334,
        "comparedWith": "object-metadata",
        "tagUpdated": true,
        "algorithm": "md5"
      },
      "transcode": {
        "output": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/transcode/",
        "jobId": "1675409793856-6whu0q",
        "startTime": 1675409794011,
        "endTime": 1675409805251
      },
      "restore": {
        "tier": "Bulk",
        "startTime": 1675409786919,
        "endTime": 1675409786919
      },
      "mediainfo": {
        "output": [
          "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/mediainfo/mediainfo.json",
          "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/mediainfo/mediainfo.xml"
        ]
      },
      "indexer": {
        "terms": [
          "overallStatus",
          "lastModified",
          "status",
          "timestamp",
          "basename",
          "attributes",
          "bucket",
          "fileSize",
          "mime",
          "uuid",
          "key",
          "duration",
          "md5",
          "type"
        ]
      }
    },
    "progress": 100,
    "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500",
    "status": "COMPLETED"
  }

const event_StateUpdateRecord = {
    "operation": "update-record",
    "nestedStateOutput": {
      "ExecutionArn": "arn:aws:states:us-east-1:account-number:execution:so0050-0a9ab6b1a00f-ingest-audio:a86a921b-6d7d-4774-9c8c-bb80e590bc3b",
      "Input": "{\"operation\":\"run-mediainfo\",\"status\":\"NOT_STARTED\",\"progress\":0,\"input\":{\"bucket\":\"so0050-0a9ab6b1a00f-account-number-us-east-1-ingest\",\"key\":\"speech/speech.mp3\",\"uuid\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500\",\"aiOptions\":{\"celeb\":true,\"face\":true,\"facematch\":true,\"label\":true,\"moderation\":true,\"person\":true,\"text\":true,\"segment\":true,\"customlabel\":false,\"minConfidence\":80,\"customLabelModels\":[],\"frameCaptureMode\":1003,\"textROI\":[true,true,true,true,true,true,true,true,true],\"framebased\":true,\"transcribe\":true,\"keyphrase\":true,\"entity\":true,\"sentiment\":true,\"customentity\":false,\"textract\":true,\"languageCode\":\"en-US\"},\"attributes\":{},\"destination\":{\"bucket\":\"so0050-0a9ab6b1a00f-account-number-us-east-1-proxy\",\"prefix\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/\"},\"type\":\"audio\"},\"data\":{\"restore\":{\"tier\":\"Bulk\",\"startTime\":1675409786919,\"endTime\":1675409786919},\"checksum\":{\"algorithm\":\"md5\",\"fileSize\":2722840,\"computed\":\"ac5cfe51b37d5711de590746ba461bfe\",\"storeChecksumOnTagging\":true,\"startTime\":1675409787118,\"endTime\":1675409787334,\"comparedWith\":\"object-metadata\",\"comparedResult\":\"MATCHED\",\"tagUpdated\":true}},\"uuid\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500\"}",
      "InputDetails": {
        "Included": true
      },
      "Name": "a86a921b-6d7d-4774-9c8c-bb80e590bc3b",
      "Output": "{\"uuid\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500\",\"stateMachine\":\"so0050-0a9ab6b1a00f-ingest-main\",\"operation\":\"start-transcode\",\"overallStatus\":\"PROCESSING\",\"status\":\"COMPLETED\",\"progress\":100,\"input\":{\"bucket\":\"so0050-0a9ab6b1a00f-account-number-us-east-1-ingest\",\"duration\":453799,\"destination\":{\"bucket\":\"so0050-0a9ab6b1a00f-account-number-us-east-1-proxy\",\"prefix\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/\"},\"attributes\":{},\"type\":\"audio\",\"uuid\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500\",\"key\":\"speech/speech.mp3\",\"aiOptions\":{\"sentiment\":true,\"textROI\":[true,true,true,true,true,true,true,true,true],\"framebased\":true,\"celeb\":true,\"frameCaptureMode\":1003,\"keyphrase\":true,\"label\":true,\"languageCode\":\"en-US\",\"facematch\":true,\"transcribe\":true,\"face\":true,\"customentity\":false,\"person\":true,\"minConfidence\":80,\"textract\":true,\"moderation\":true,\"segment\":true,\"customlabel\":false,\"text\":true,\"entity\":true,\"customLabelModels\":[]}},\"data\":{\"checksum\":{\"comparedResult\":\"MATCHED\",\"storeChecksumOnTagging\":true,\"computed\":\"ac5cfe51b37d5711de590746ba461bfe\",\"fileSize\":2722840,\"startTime\":1675409787118,\"endTime\":1675409787334,\"comparedWith\":\"object-metadata\",\"tagUpdated\":true,\"algorithm\":\"md5\"},\"transcode\":{\"output\":\"60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/transcode/\",\"jobId\":\"1675409793856-6whu0q\",\"startTime\":1675409794011,\"endTime\":1675409805251},\"restore\":{\"tier\":\"Bulk\",\"startTime\":1675409786919,\"endTime\":1675409786919},\"mediainfo\":{\"output\":[\"60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/mediainfo/mediainfo.json\",\"60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/mediainfo/mediainfo.xml\"]}}}",
      "OutputDetails": {
        "Included": true
      },
      "StartDate": 1675409789768,
      "StateMachineArn": "arn:aws:states:us-east-1:account-number:stateMachine:so0050-0a9ab6b1a00f-ingest-audio",
      "Status": "SUCCEEDED",
      "StopDate": 1675409806663
    }
  }


const context = {
    invokedFunctionArn: 'arn:partition:service:region:account-id:resource-id',
    getRemainingTimeInMillis: 1000
}


 describe('#Main/Analysis/Main::', () => {

    beforeAll(() => {
        // Mute console.log output for internal functions
        console.log = jest.fn();
    });


    beforeEach(() => {
      });
      
    test('Test the StateCreateRecord', async () => { 
        const stateData = new StateData(Environment.StateMachines.Main, event_StateCreateRecord, context);

        let instance = new StateCreateRecord(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the StateFixityCompleted', async () => { 
        const stateData = new StateData(Environment.StateMachines.Main, event_StateFixityCompleted, context);

        let instance = new StateFixityCompleted(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the StateIndexIngestResults', async () => { 
        const stateData = new StateData(Environment.StateMachines.Main, event_StateIndexIngestResults, context);

        let instance = new StateIndexIngestResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the StateJobCompleted', async () => { 
        const stateData = new StateData(Environment.StateMachines.Main, event_StateJobCompleted, context);

        let instance = new StateJobCompleted(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the StateUpdateRecord', async () => { 
        const stateData = new StateData(Environment.StateMachines.Main, event_StateUpdateRecord, context);

        let instance = new StateUpdateRecord(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


});


