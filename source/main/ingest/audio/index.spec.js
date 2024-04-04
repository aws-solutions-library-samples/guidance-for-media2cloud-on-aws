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
  const RunMediainfo = require('./states/run-mediainfo');
  const StartTranscode = require('./states/start-transcode');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');


const event_RunMediainfo = {
    "operation": "run-mediainfo",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-111111111111-000000000000-us-east-1-ingest",
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
        "bucket": "so0050-111111111111-000000000000-us-east-1-proxy",
        "prefix": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/"
      },
      "type": "audio"
    },
    "data": {
      "restore": {
        "tier": "Bulk",
        "startTime": 1675409786919,
        "endTime": 1675409786919
      },
      "checksum": {
        "algorithm": "md5",
        "fileSize": 2722840,
        "computed": "ac5cfe51b37d5711de590746ba461bfe",
        "storeChecksumOnTagging": true,
        "startTime": 1675409787118,
        "endTime": 1675409787334,
        "comparedWith": "object-metadata",
        "comparedResult": "MATCHED",
        "tagUpdated": true
      }
    },
    "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500"
  }

const event_StartTranscode = {
    "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500",
    "stateMachine": "so0050-111111111111-ingest-main",
    "operation": "run-mediainfo",
    "overallStatus": "PROCESSING",
    "status": "COMPLETED",
    "progress": 100,
    "input": {
      "bucket": "so0050-111111111111-000000000000-us-east-1-ingest",
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
        "bucket": "so0050-111111111111-000000000000-us-east-1-proxy",
        "prefix": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/"
      },
      "type": "audio",
      "duration": 453799
    },
    "data": {
      "restore": {
        "tier": "Bulk",
        "startTime": 1675409786919,
        "endTime": 1675409786919
      },
      "checksum": {
        "algorithm": "md5",
        "fileSize": 2722840,
        "computed": "ac5cfe51b37d5711de590746ba461bfe",
        "storeChecksumOnTagging": true,
        "startTime": 1675409787118,
        "endTime": 1675409787334,
        "comparedWith": "object-metadata",
        "comparedResult": "MATCHED",
        "tagUpdated": true
      },
      "mediainfo": {
        "container": [
          {
            "format": "MPEG Audio",
            "fileSize": 2722840,
            "duration": 453.799,
            "overallBitRate": 48000
          }
        ],
        "audio": [
          {
            "format": "MPEG Audio",
            "bitRateMode": "CBR",
            "bitRate": 48000,
            "channels": 1,
            "samplesPerFrame": 576,
            "samplingRate": 22050
          }
        ],
        "video": [],
        "output": [
          "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/mediainfo/mediainfo.json",
          "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/mediainfo/mediainfo.xml"
        ]
      }
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
      
    test('Test the run mediainfo', async () => { 
        const stateData = new StateData(Environment.StateMachines.AudioIngest, event_RunMediainfo, context);

        let instance = new RunMediainfo(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the run mediainfo', async () => { 
        const stateData = new StateData(Environment.StateMachines.AudioIngest, event_StartTranscode, context);

        let instance = new StartTranscode(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });



});


