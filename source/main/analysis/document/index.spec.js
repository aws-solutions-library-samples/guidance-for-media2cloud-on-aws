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
  const StateIndexAnalysisResults = require('./states/index-analysis-results');
  const StateStartDocumentAnalysis = require('./states/start-document-analysis');
  

const lambda = require('./index.js');


const event_StateIndexAnalysisResults = {
    "operation": "index-analysis-results",
    "input": {
      "bucket": "so0050-0a709c9ee415-account-number-us-west-2-ingest",
      "key": "Airport to Scala 7 Interno 5 Maps/Airport to Scala 7 Interno 5 Maps.pdf",
      "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
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
        "prefix": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/"
      },
      "video": {
        "enabled": false
      },
      "audio": {
        "enabled": false
      },
      "image": {
        "enabled": false
      },
      "document": {
        "enabled": true,
        "prefix": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/transcode/proxy",
        "numPages": 2
      },
      "request": {
        "timestamp": 1672908611250
      },
      "metrics": {
        "duration": 0,
        "requestTime": 1672908611250,
        "startTime": 1672908612571
      }
    },
    "data": {
      "document": {
        "status": "COMPLETED",
        "executionArn": "arn:aws:states:us-west-2:account-number:execution:so0050-0a709c9ee415-analysis-document:673359b3-1020-47b9-a4c6-7e189b6a5cab",
        "startTime": 1672908613005,
        "endTime": 1672908619938,
        "textract": {
          "output": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/raw/20230105T085011/textract/",
          "numOutputs": 1,
          "textlist": "textlist.json"
        }
      }
    },
    "progress": 100,
    "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
    "status": "COMPLETED"
  }

const event_StateStartDocumentAnalysis = {
    "operation": "start-document-analysis",
    "input": {
      "bucket": "so0050-0a709c9ee415-account-number-us-west-2-ingest",
      "key": "Airport to Scala 7 Interno 5 Maps/Airport to Scala 7 Interno 5 Maps.pdf",
      "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
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
        "prefix": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/"
      },
      "video": {
        "enabled": false
      },
      "audio": {
        "enabled": false
      },
      "image": {
        "enabled": false
      },
      "document": {
        "enabled": true,
        "prefix": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/transcode/proxy",
        "numPages": 2
      },
      "request": {
        "timestamp": 1672908611250
      },
      "metrics": {
        "duration": 0,
        "requestTime": 1672908611250,
        "startTime": 1672908612571
      }
    },
    "stateExecution": {
      "Id": "arn:aws:states:us-west-2:account-number:execution:so0050-0a709c9ee415-analysis-document:673359b3-1020-47b9-a4c6-7e189b6a5cab",
      "Input": {
        "status": "NOT_STARTED",
        "progress": 0,
        "input": {
          "bucket": "so0050-0a709c9ee415-account-number-us-west-2-ingest",
          "key": "Airport to Scala 7 Interno 5 Maps/Airport to Scala 7 Interno 5 Maps.pdf",
          "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
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
            "prefix": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/"
          },
          "video": {
            "enabled": false
          },
          "audio": {
            "enabled": false
          },
          "image": {
            "enabled": false
          },
          "document": {
            "enabled": true,
            "prefix": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/transcode/proxy",
            "numPages": 2
          },
          "request": {
            "timestamp": 1672908611250
          },
          "metrics": {
            "duration": 0,
            "requestTime": 1672908611250,
            "startTime": 1672908612571
          }
        },
        "data": {},
        "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097"
      },
      "StartTime": "2023-01-05T08:50:13.005Z",
      "Name": "673359b3-1020-47b9-a4c6-7e189b6a5cab",
      "RoleArn": "arn:aws:iam::account-number:role/so0050-0a709c9ee415/MyMedia2CloudTest-Backend-AnalysisStateMachineServ-15UVTS9SYPLZU"
    },
    "data": {},
    "progress": 0,
    "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
    "status": "NOT_STARTED"
  }


const context = {
    invokedFunctionArn: 'arn:partition:service:region:account-id:resource-id',
    getRemainingTimeInMillis: 1000
}


 describe('#Main/Analysis/Document::', () => {

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

        const response = await lambda.handler(event_StateStartDocumentAnalysis, context);
        // Expected JSON response with correct ID. 
        expect(response.uuid).toBe('6cbb8b34-4c02-a3bb-a790-ea3d58350097');
	});
    
  

    test('Test Lambda handler for state index analysis document ', async () => {

        const response = await lambda.handler(event_StateIndexAnalysisResults, context);
        // Expected JSON response with correct ID. 
        expect(response.uuid).toBe('6cbb8b34-4c02-a3bb-a790-ea3d58350097');
	});

    test('Test StateIndexAnalysisResults', async () => { 
        // const stateData = lambda.parseEvent(event_StateIndexAnalysisResults, context);
        const stateData = new StateData(Environment.StateMachines.DocumentAnalysis, event_StateIndexAnalysisResults, context);

        let instance = new StateIndexAnalysisResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test StateStartDocumentAnalysis', async () => { 
        // const stateData = lambda.parseEvent(event_StateIndexAnalysisResults, context);
        const stateData = new StateData(Environment.StateMachines.DocumentAnalysis, event_StateStartDocumentAnalysis, context);

        let instance = new StateStartDocumentAnalysis(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


});


