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
  const StateRunDocInfo = require('./states/run-docinfo');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');


const event_StateRunDocInfo = {
    "operation": "run-docinfo",
    "input": {
      "bucket": "so0050-111111111111-000000000000-us-east-1-ingest",
      "key": "2022_Columbia Sportswear_Employee Store Invite/2022_Columbia Sportswear_Employee Store Invite.pdf",
      "uuid": "cf9a0540-4efb-c826-c03d-3c969e4015ab",
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
        "prefix": "cf9a0540-4efb-c826-c03d-3c969e4015ab/2022_Columbia_Sportswear_Employee_Store_Invite/"
      },
      "type": "document"
    },
    "data": {
      "restore": {
        "tier": "Bulk",
        "startTime": 1675386493721,
        "endTime": 1675386493721
      },
      "checksum": {
        "algorithm": "md5",
        "fileSize": 780806,
        "computed": "86814cf7dcc707d6b1598d5309d42e20",
        "storeChecksumOnTagging": true,
        "startTime": 1675386493942,
        "endTime": 1675386494082,
        "comparedWith": "object-metadata",
        "comparedResult": "MATCHED",
        "tagUpdated": true
      }
    },
    "progress": 0,
    "uuid": "cf9a0540-4efb-c826-c03d-3c969e4015ab",
    "status": "NOT_STARTED"
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
        const stateData = new StateData(Environment.StateMachines.DocumentIngest, event_StateRunDocInfo, context);

        let instance = new RunMediainfo(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


});


