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
const StateRunMediaInfo = require('./states/run-mediainfo');
const StateStartTranscode = require('./states/start-transcode');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');


const event_StateRunMediaInfo = {
    "operation": "run-mediainfo",
    "status": "NOT_STARTED",
    "progress": 0,
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-ingest",
      "key": "thenewshort/thenewshort.mp4",
      "uuid": "3168c4e2-be37-8395-ad0b-62e5636eeef8",
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
        "prefix": "3168c4e2-be37-8395-ad0b-62e5636eeef8/thenewshort/"
      },
      "type": "video"
    },
    "data": {
      "restore": {
        "tier": "Bulk",
        "startTime": 1675386392708,
        "endTime": 1675386392709
      },
      "checksum": {
        "algorithm": "md5",
        "fileSize": 191767238,
        "computed": "b9b4ae670c88b8d0d1d51a39dcc0da0c",
        "storeChecksumOnTagging": true,
        "startTime": 1675386392929,
        "endTime": 1675386395275,
        "comparedWith": "object-metadata",
        "comparedResult": "MATCHED",
        "tagUpdated": true
      }
    },
    "uuid": "3168c4e2-be37-8395-ad0b-62e5636eeef8"
  }

const event_StateStartTranscode = {
    "uuid": "3168c4e2-be37-8395-ad0b-62e5636eeef8",
    "stateMachine": "so0050-0a9ab6b1a00f-ingest-main",
    "operation": "run-mediainfo",
    "overallStatus": "PROCESSING",
    "status": "COMPLETED",
    "progress": 100,
    "input": {
      "bucket": "so0050-0a9ab6b1a00f-193234372883-us-east-1-ingest",
      "key": "thenewshort/thenewshort.mp4",
      "uuid": "3168c4e2-be37-8395-ad0b-62e5636eeef8",
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
        "prefix": "3168c4e2-be37-8395-ad0b-62e5636eeef8/thenewshort/"
      },
      "type": "video",
      "duration": 300033,
      "framerate": 59.94
    },
    "data": {
      "restore": {
        "tier": "Bulk",
        "startTime": 1675386392708,
        "endTime": 1675386392709
      },
      "checksum": {
        "algorithm": "md5",
        "fileSize": 191767238,
        "computed": "b9b4ae670c88b8d0d1d51a39dcc0da0c",
        "storeChecksumOnTagging": true,
        "startTime": 1675386392929,
        "endTime": 1675386395275,
        "comparedWith": "object-metadata",
        "comparedResult": "MATCHED",
        "tagUpdated": true
      },
      "mediainfo": {
        "container": [
          {
            "format": "MPEG-4",
            "fileSize": 191767238,
            "duration": 300.033,
            "frameRate": 59.94,
            "overallBitRate": 5113231
          }
        ],
        "audio": [
          {
            "streamOrder": 1,
            "format": "AAC",
            "codecID": "mp4a-40-2",
            "bitRateMode": "VBR",
            "bitRate": 96000,
            "channels": 2,
            "channelLayout": "L R",
            "samplesPerFrame": 1024,
            "samplingRate": 48000,
            "iD": 2
          }
        ],
        "video": [
          {
            "streamOrder": 0,
            "format": "AVC",
            "formatProfile": "Main",
            "formatLevel": 3.2,
            "codecID": "avc1",
            "bitRateMode": "CBR",
            "bitRate": 5000000,
            "width": 1280,
            "height": 720,
            "pixelAspectRatio": 1,
            "displayAspectRatio": 1.778,
            "frameRate": 59.94,
            "bitDepth": 8,
            "scanType": "Progressive",
            "iD": 1
          }
        ],
        "output": [
          "3168c4e2-be37-8395-ad0b-62e5636eeef8/thenewshort/mediainfo/mediainfo.json",
          "3168c4e2-be37-8395-ad0b-62e5636eeef8/thenewshort/mediainfo/mediainfo.xml"
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
      
    test('Test the StateRunDocInfo ingest state', async () => { 
        const stateData = new StateData(Environment.StateMachines.VideoIngest, event_StateRunMediaInfo, context);

        let instance = new StateRunMediaInfo(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });
      
    test('Test the StateRunDocInfo ingest state', async () => { 
        const stateData = new StateData(Environment.StateMachines.VideoIngest, event_StateStartTranscode, context);

        let instance = new StateStartTranscode(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

});


