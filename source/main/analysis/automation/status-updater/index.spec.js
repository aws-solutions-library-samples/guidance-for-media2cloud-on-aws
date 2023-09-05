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

const lambda = require('./index.js');


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

const context = {
    invokedFunctionArn: 'arn:partition:service:region:account-id:resource-id',
    getRemainingTimeInMillis: 1000
}


 describe('#Main/Analysis/Automation::', () => {

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
            ENV_ANONYMIZED_USAGE: 'Test_ENV_Variable',
            ENV_IOT_HOST: 'Test_ENV_Variable',
            ENV_IOT_TOPIC: 'Test_ENV_Variable',
            ENV_PROXY_BUCKET: 'Test_ENV_Variable',
            ENV_DATA_ACCESS_ROLE: 'Test_ENV_Variable',
            ENV_ES_DOMAIN_ENDPOINT: 'Test_ENV_Variable'
        };
      });


	test('Automation State Machine: Test instance filter ', async () => {

        lambda.CloudWatchStatus = jest.fn().mockImplementation(() => 'hello');

        const response = await lambda.handler(event_for_index_transcribe_results, context);
        // Expected JSON response with correct ID. 
        console.log(response)
        expect(response.uuid).toBe('b72fc9c0-58eb-83ef-42f2-dfceb342798f');
	});

   


});


