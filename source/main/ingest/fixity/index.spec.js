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
const StateCheckRestoreStatus = require('./states/check-restore-status');
const StateComputeChecksum = require('./states/compute-checksum');
const StateValidateChecksum = require('./states/validate-checksum');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');


const event_StateCheckRestoreStatus = {
    "operation": "check-restore-status",
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-ingest",
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
        "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-proxy",
        "prefix": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/"
      },
      "type": "audio"
    },
    "data": {},
    "progress": 100,
    "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500",
    "status": "INGEST_STARTED"
  }

const event_StateComputeChecksum = {
    "operation": "compute-checksum",
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-ingest",
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
        "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-proxy",
        "prefix": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/"
      },
      "type": "audio"
    },
    "data": {
      "restore": {
        "tier": "Bulk",
        "startTime": 1675409786919,
        "endTime": 1675409786919
      }
    },
    "progress": 100,
    "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500",
    "status": "COMPLETED"
  }

const event_StateValidateChecksum = {
    "operation": "validate-checksum",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-ingest",
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
        "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-proxy",
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
        "endTime": 1675409787334
      }
    },
    "uuid": "60aa12c0-b046-1db7-b9e2-3a3aac69b500"
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
      
    test('Test the StateCheckRestoreStatus', async () => { 
        const stateData = new StateData(Environment.StateMachines.FixityIngest, event_StateCheckRestoreStatus, context);

        let instance = new StateCheckRestoreStatus(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });
    
    test('Test the StateComputeChecksum', async () => { 
        const stateData = new StateData(Environment.StateMachines.FixityIngest, event_StateComputeChecksum, context);

        let instance = new StateComputeChecksum(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the StateValidateChecksum', async () => { 
        const stateData = new StateData(Environment.StateMachines.FixityIngest, event_StateValidateChecksum, context);

        let instance = new StateValidateChecksum(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

});


