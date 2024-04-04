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
  const StatePrepareAnalysis = require('./states/prepare-analysis');
  const StateCollectAnalysisResults = require('./states/collect-analysis-results');
  const StateJobCompleted = require('./states/job-completed');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');


const event_StateCollectAnalysisResults = {
    "operation": "collect-analysis-results",
    "status": "NOT_STARTED",
    "progress": 0,
    "parallelStateOutputs": [
      {
        "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
        "stateMachine": "so0050-111111111111-analysis-main",
        "operation": "prepare-analysis",
        "overallStatus": "PROCESSING",
        "status": "ANALYSIS_STARTED",
        "progress": 100,
        "input": {
          "bucket": "so0050-111111111111-account-number-us-west-2-ingest",
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
            "bucket": "so0050-111111111111-account-number-us-west-2-proxy",
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
        "data": {}
      },
      {
        "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
        "stateMachine": "so0050-111111111111-analysis-main",
        "operation": "prepare-analysis",
        "overallStatus": "PROCESSING",
        "status": "ANALYSIS_STARTED",
        "progress": 100,
        "input": {
          "bucket": "so0050-111111111111-account-number-us-west-2-ingest",
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
            "bucket": "so0050-111111111111-account-number-us-west-2-proxy",
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
        "data": {}
      },
      {
        "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
        "stateMachine": "so0050-111111111111-analysis-main",
        "operation": "prepare-analysis",
        "overallStatus": "PROCESSING",
        "status": "ANALYSIS_STARTED",
        "progress": 100,
        "input": {
          "bucket": "so0050-111111111111-account-number-us-west-2-ingest",
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
            "bucket": "so0050-111111111111-account-number-us-west-2-proxy",
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
        "data": {}
      },
      {
        "ExecutionArn": "arn:aws:states:us-west-2:account-number:execution:so0050-111111111111-analysis-document:673359b3-1020-47b9-a4c6-7e189b6a5cab",
        "Input": "{\"status\":\"NOT_STARTED\",\"progress\":0,\"input\":{\"bucket\":\"so0050-111111111111-account-number-us-west-2-ingest\",\"key\":\"Airport to Scala 7 Interno 5 Maps/Airport to Scala 7 Interno 5 Maps.pdf\",\"uuid\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097\",\"aiOptions\":{\"sentiment\":true,\"textROI\":[false,false,false,false,false,false,false,false,false],\"framebased\":false,\"celeb\":true,\"frameCaptureMode\":0,\"keyphrase\":true,\"label\":true,\"languageCode\":\"en-US\",\"facematch\":false,\"transcribe\":true,\"face\":true,\"customentity\":false,\"person\":true,\"minConfidence\":80,\"textract\":true,\"moderation\":true,\"segment\":true,\"customlabel\":false,\"text\":true,\"entity\":true,\"customLabelModels\":[]},\"attributes\":{},\"destination\":{\"bucket\":\"so0050-111111111111-account-number-us-west-2-proxy\",\"prefix\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/\"},\"video\":{\"enabled\":false},\"audio\":{\"enabled\":false},\"image\":{\"enabled\":false},\"document\":{\"enabled\":true,\"prefix\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/transcode/proxy\",\"numPages\":2},\"request\":{\"timestamp\":1672908611250},\"metrics\":{\"duration\":0,\"requestTime\":1672908611250,\"startTime\":1672908612571}},\"data\":{},\"uuid\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097\"}",
        "InputDetails": {
          "Included": true
        },
        "Name": "673359b3-1020-47b9-a4c6-7e189b6a5cab",
        "Output": "{\"uuid\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097\",\"stateMachine\":\"so0050-111111111111-analysis-document\",\"operation\":\"index-analysis-results\",\"overallStatus\":\"PROCESSING\",\"status\":\"COMPLETED\",\"progress\":100,\"input\":{\"bucket\":\"so0050-111111111111-account-number-us-west-2-ingest\",\"key\":\"Airport to Scala 7 Interno 5 Maps/Airport to Scala 7 Interno 5 Maps.pdf\",\"uuid\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097\",\"aiOptions\":{\"sentiment\":true,\"textROI\":[false,false,false,false,false,false,false,false,false],\"framebased\":false,\"celeb\":true,\"frameCaptureMode\":0,\"keyphrase\":true,\"label\":true,\"languageCode\":\"en-US\",\"facematch\":false,\"transcribe\":true,\"face\":true,\"customentity\":false,\"person\":true,\"minConfidence\":80,\"textract\":true,\"moderation\":true,\"segment\":true,\"customlabel\":false,\"text\":true,\"entity\":true,\"customLabelModels\":[]},\"attributes\":{},\"destination\":{\"bucket\":\"so0050-111111111111-account-number-us-west-2-proxy\",\"prefix\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/\"},\"video\":{\"enabled\":false},\"audio\":{\"enabled\":false},\"image\":{\"enabled\":false},\"document\":{\"enabled\":true,\"prefix\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/transcode/proxy\",\"numPages\":2},\"request\":{\"timestamp\":1672908611250},\"metrics\":{\"duration\":0,\"requestTime\":1672908611250,\"startTime\":1672908612571}},\"data\":{\"document\":{\"status\":\"COMPLETED\",\"executionArn\":\"arn:aws:states:us-west-2:account-number:execution:so0050-111111111111-analysis-document:673359b3-1020-47b9-a4c6-7e189b6a5cab\",\"startTime\":1672908613005,\"endTime\":1672908619938,\"textract\":{\"output\":\"6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/raw/20230105T085011/textract/\",\"numOutputs\":1,\"textlist\":\"textlist.json\"}}}}",
        "OutputDetails": {
          "Included": true
        },
        "StartDate": 1672908613005,
        "StateMachineArn": "arn:aws:states:us-west-2:account-number:stateMachine:so0050-111111111111-analysis-document",
        "Status": "SUCCEEDED",
        "StopDate": 1672908620622
      }
    ]
  }

const event_StatePrepareAnalysis = {
    "operation": "prepare-analysis",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-111111111111-account-number-us-west-2-ingest",
      "key": "Airport to Scala 7 Interno 5 Maps/Airport to Scala 7 Interno 5 Maps.pdf",
      "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097",
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
        "frameCaptureMode": 0,
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
        "bucket": "so0050-111111111111-account-number-us-west-2-proxy",
        "prefix": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/"
      }
    },
    "executionArn": "arn:aws:states:us-west-2:account-number:execution:so0050-111111111111-analysis-main:a4f8decc-f31e-4fdf-8d8b-3f73fb0e778c"
  }

const event_StateJobCompleted = {
    "operation": "job-completed",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-111111111111-account-number-us-west-2-ingest",
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
        "bucket": "so0050-111111111111-account-number-us-west-2-proxy",
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
        "executionArn": "arn:aws:states:us-west-2:account-number:execution:so0050-111111111111-analysis-document:673359b3-1020-47b9-a4c6-7e189b6a5cab",
        "startTime": 1672908613005,
        "endTime": 1672908619938,
        "textract": {
          "output": "6cbb8b34-4c02-a3bb-a790-ea3d58350097/Airport_to_Scala_7_Interno_5_Maps/raw/20230105T085011/textract/",
          "numOutputs": 1,
          "textlist": "textlist.json"
        }
      }
    },
    "uuid": "6cbb8b34-4c02-a3bb-a790-ea3d58350097"
  }

const event_StateStart = {

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


    test('Test Lambda handler for state index analysis ', async () => {

        const response = await lambda.handler(event_StateCollectAnalysisResults, context);
        // Expected JSON response with correct ID. 
        expect(response.uuid).toBe('6cbb8b34-4c02-a3bb-a790-ea3d58350097');
	});

    test('Test StateIndexAnalysisResults', async () => { 
        const stateData = new StateData(Environment.StateMachines.Main, event_StateCollectAnalysisResults, context);

        let instance = new StateCollectAnalysisResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test StateIndexAnalysisResults', async () => { 
        const stateData = new StateData(Environment.StateMachines.Main, event_StatePrepareAnalysis, context);

        let instance = new StatePrepareAnalysis(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test StateStartAnalysis', async () => { 
        const stateData = new StateData(Environment.StateMachines.Main, event_StateJobCompleted, context);

        let instance = new StateJobCompleted(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

});


