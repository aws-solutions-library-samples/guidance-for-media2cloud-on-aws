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
const StateRunImageInfo = require('./states/run-imageinfo');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');


const event_StateRunImageInfo = {
    "operation": "run-imageinfo",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-ingest",
      "key": "bigtree/bigtree.jpeg",
      "uuid": "6c3d2a4b-4cbb-2563-c693-b4514c0c0a49",
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
        "prefix": "6c3d2a4b-4cbb-2563-c693-b4514c0c0a49/bigtree/"
      },
      "type": "image"
    },
    "data": {
      "restore": {
        "tier": "Bulk",
        "startTime": 1675386439171,
        "endTime": 1675386439171
      },
      "checksum": {
        "algorithm": "md5",
        "fileSize": 236348,
        "computed": "023ed34e2a016a1b080a60b3aa79665c",
        "storeChecksumOnTagging": true,
        "startTime": 1675386439358,
        "endTime": 1675386439456,
        "comparedWith": "object-metadata",
        "comparedResult": "MATCHED",
        "tagUpdated": true
      }
    },
    "uuid": "6c3d2a4b-4cbb-2563-c693-b4514c0c0a49"
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
      
    test('Test the StateRunDocInfo ingest state', async () => { 
        const stateData = new StateData(Environment.StateMachines.ImageIngest, event_StateRunImageInfo, context);

        let instance = new StateRunImageInfo(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


});


