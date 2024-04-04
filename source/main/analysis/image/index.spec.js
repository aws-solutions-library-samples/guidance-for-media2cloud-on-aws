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
  const StateStartImageAnalysis = require('./states/start-image-analysis');
  const StateIndexAnalysisResults = require('./states/index-analysis-results');

const lambda = require('./index.js');


const event_StateIndexAnalysisResults = {
    "operation": "index-analysis-results",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-111111111111-account-number-us-west-2-ingest",
      "key": "TestingImage/TestingImage.png",
      "uuid": "6c56edc5-a973-3485-c9eb-16292d709749",
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
        "bucket": "so0050-111111111111-account-number-us-west-2-proxy",
        "prefix": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/"
      },
      "video": {
        "enabled": false
      },
      "audio": {
        "enabled": false
      },
      "image": {
        "enabled": true,
        "key": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/transcode/proxy/TestingImage.jpg"
      },
      "document": {
        "enabled": false
      },
      "request": {
        "timestamp": 1673234981669
      },
      "metrics": {
        "duration": 0,
        "requestTime": 1673234981669,
        "startTime": 1673234983381
      }
    },
    "data": {
      "image": {
        "status": "COMPLETED",
        "startTime": 1673234983880,
        "endTime": 1673234988372,
        "executionArn": "arn:aws:states:us-west-2:account-number:execution:so0050-111111111111-analysis-image:98937baf-d231-4012-b0f0-407bb0f0a757",
        "rekog-image": {
          "celeb": {
            "output": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/raw/20230109T032941/rekog-image/celeb/output.json",
            "startTime": 1673234985251,
            "endTime": 1673234986018
          },
          "face": {
            "output": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/raw/20230109T032941/rekog-image/face/output.json",
            "startTime": 1673234985351,
            "endTime": 1673234986010
          },
          "label": {
            "output": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/raw/20230109T032941/rekog-image/label/output.json",
            "startTime": 1673234985371,
            "endTime": 1673234986016
          },
          "moderation": {
            "output": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/raw/20230109T032941/rekog-image/moderation/output.json",
            "startTime": 1673234985374,
            "endTime": 1673234986000
          },
          "text": {
            "output": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/raw/20230109T032941/rekog-image/text/output.json",
            "startTime": 1673234985391,
            "endTime": 1673234988372
          }
        }
      }
    },
    "uuid": "6c56edc5-a973-3485-c9eb-16292d709749"
  }

const event_StateStartImageAnalysis = {
    "operation": "start-image-analysis",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-111111111111-account-number-us-west-2-ingest",
      "key": "TestingImage/TestingImage.png",
      "uuid": "6c56edc5-a973-3485-c9eb-16292d709749",
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
        "bucket": "so0050-111111111111-account-number-us-west-2-proxy",
        "prefix": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/"
      },
      "video": {
        "enabled": false
      },
      "audio": {
        "enabled": false
      },
      "image": {
        "enabled": true,
        "key": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/transcode/proxy/TestingImage.jpg"
      },
      "document": {
        "enabled": false
      },
      "request": {
        "timestamp": 1673234981669
      },
      "metrics": {
        "duration": 0,
        "requestTime": 1673234981669,
        "startTime": 1673234983381
      }
    },
    "stateExecution": {
      "Id": "arn:aws:states:us-west-2:account-number:execution:so0050-111111111111-analysis-image:98937baf-d231-4012-b0f0-407bb0f0a757",
      "Input": {
        "status": "NOT_STARTED",
        "progress": 0,
        "input": {
          "bucket": "so0050-111111111111-account-number-us-west-2-ingest",
          "key": "TestingImage/TestingImage.png",
          "uuid": "6c56edc5-a973-3485-c9eb-16292d709749",
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
            "bucket": "so0050-111111111111-account-number-us-west-2-proxy",
            "prefix": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/"
          },
          "video": {
            "enabled": false
          },
          "audio": {
            "enabled": false
          },
          "image": {
            "enabled": true,
            "key": "6c56edc5-a973-3485-c9eb-16292d709749/TestingImage/transcode/proxy/TestingImage.jpg"
          },
          "document": {
            "enabled": false
          },
          "request": {
            "timestamp": 1673234981669
          },
          "metrics": {
            "duration": 0,
            "requestTime": 1673234981669,
            "startTime": 1673234983381
          }
        },
        "data": {},
        "uuid": "6c56edc5-a973-3485-c9eb-16292d709749"
      },
      "StartTime": "2023-01-09T03:29:43.880Z",
      "Name": "98937baf-d231-4012-b0f0-407bb0f0a757",
      "RoleArn": "arn:aws:iam::account-number:role/so0050-111111111111/MyMedia2CloudTest-Backend-AnalysisStateMachineServ-15UVTS9SYPLZU"
    },
    "data": {},
    "uuid": "6c56edc5-a973-3485-c9eb-16292d709749"
  }


const context = {
    invokedFunctionArn: 'arn:partition:service:region:account-id:resource-id',
    getRemainingTimeInMillis: 1000
}


 describe('#Main/Analysis/Image::', () => {

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

    test('Test Lambda handler for state start ', async () => {

        const response = await lambda.handler(event_StateStartImageAnalysis, context);
        // Expected JSON response with correct ID. 
        expect(response.uuid).toBe('6c56edc5-a973-3485-c9eb-16292d709749');
	});
    
  

    test('Test Lambda handler for state index analysis ', async () => {

        const response = await lambda.handler(event_StateIndexAnalysisResults, context);
        // Expected JSON response with correct ID. 
        expect(response.uuid).toBe('6c56edc5-a973-3485-c9eb-16292d709749');
	});

    test('Test StateIndexResults', async () => { 
        // const stateData = lambda.parseEvent(event_StateIndexAnalysisResults, context);
        const stateData = new StateData(Environment.StateMachines.DocumentAnalysis, event_StateIndexAnalysisResults, context);

        let instance = new StateIndexAnalysisResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test StateStarAnalysis', async () => { 
        // const stateData = lambda.parseEvent(event_StateIndexAnalysisResults, context);
        const stateData = new StateData(Environment.StateMachines.DocumentAnalysis, event_StateStartImageAnalysis, context);

        let instance = new StateStartImageAnalysis(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


});


