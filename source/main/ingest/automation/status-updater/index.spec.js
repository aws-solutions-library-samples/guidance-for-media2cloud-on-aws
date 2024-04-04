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
const CloudWatchStatus = require('./lib/cloudwatch');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');


const event_CloudWatchStatus = {
    "operation": "create-record",
    "input": {
      "bucket": "so0050-111111111111-account-number-us-east-1-ingest",
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
        "bucket": "so0050-111111111111-account-number-us-east-1-proxy",
        "prefix": "60aa12c0-b046-1db7-b9e2-3a3aac69b500/speech/"
      }
    },
    "executionArn": "arn:aws:states:us-east-1:account-number:execution:so0050-111111111111-ingest-main:b13ecca9-ad1e-440a-9773-1e1bc6095a0f"
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
      
    test('Test the CloudWatchStatus', async () => { 
        const stateData = new StateData(Environment.StateMachines.CloudWatchStatus, event_CloudWatchStatus, context);

        let instance = new CloudWatchStatus(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });



});


