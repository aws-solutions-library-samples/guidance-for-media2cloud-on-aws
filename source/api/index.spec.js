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
    ApiOps,
    CommonUtils,
  } = require('core-lib');

const ApiRequest = require('./lib/apiRequest');

// Import all of the API files
const AnalysisOp = require('./lib/operations/analysisOp');
const AssetOp = require('./lib/operations/assetOp');
const IotOp = require('./lib/operations/iotOp');
const SearchOp = require('./lib/operations/searchOp');
const StepOp = require('./lib/operations/stepOp');
const RekognitionOp = require('./lib/operations/rekognitionOp');
const TranscribeOp = require('./lib/operations/transcribeOp');
const ComprehendOp = require('./lib/operations/comprehendOp');
const StatsOp = require('./lib/operations/statsOp');
const UsersOp = require('./lib/operations/usersOp');
const SettingsOp = require('./lib/operations/settingsOp');
const lambda = require('./index.js');

const { JobCompleted } = require('core-lib/lib/states');

const AWS = require('aws-sdk-mock');
const SDK = require('aws-sdk');

const context = {
    invokedFunctionArn: 'arn:partition:service:region:account-id:resource-id',
    getRemainingTimeInMillis: 1000
}


const media_info_sample_data = {
  creatingLibrary: {
    name: "MediaInfoLib",
    version: "22.06",
    url: "https://mediaarea.net/MediaInfo",
  },
  media: {
    "@ref": "VideoTurorial1.mp4",
    track: [
      {
        "@type": "General",
        Count: "331",
        StreamCount: "1",
        StreamKind: "General",
        StreamKind_String: "General",
        StreamKindID: "0",
        CompleteName: "VideoTurorial1.mp4",
        FileNameExtension: "VideoTurorial1.mp4",
        FileName: "VideoTurorial1",
        FileExtension: "mp4",
        Format: "MPEG-4",
        Format_String: "MPEG-4",
        Format_Extensions:
          "braw mov mp4 m4v m4a m4b m4p m4r 3ga 3gpa 3gpp 3gp 3gpp2 3g2 k3g jpm jpx mqv ismv isma ismt f4a f4b f4v",
        Format_Commercial: "MPEG-4",
        Format_Profile: "Base Media / Version 2",
        InternetMediaType: "video/mp4",
        CodecID: "mp42",
        CodecID_String: "mp42 (isom/mp41/mp42)",
        CodecID_Url: "http://www.apple.com/quicktime/download/standalone.html",
        CodecID_Compatible: "isom/mp41/mp42",
        FileSize: "967309",
        FileSize_String: "945 KiB",
        FileSize_String1: "945 KiB",
        FileSize_String2: "945 KiB",
        FileSize_String3: "945 KiB",
        FileSize_String4: "944.6 KiB",
        StreamSize: "967309",
        StreamSize_String: "945 KiB (100%)",
        StreamSize_String1: "945 KiB",
        StreamSize_String2: "945 KiB",
        StreamSize_String3: "945 KiB",
        StreamSize_String4: "944.6 KiB",
        StreamSize_String5: "945 KiB (100%)",
        StreamSize_Proportion: "1.00000",
        HeaderSize: "36",
        DataSize: "967273",
        FooterSize: "0",
        IsStreamable: "No",
        File_Modified_Date: "UTC 2022-02-07 22:00:28",
        File_Modified_Date_Local: "2022-02-07 14:00:28",
      },
    ],
  },
};


// jest.mock('CommonUtils', () => {
//     return { 
//         object_names: ['track1',
//         'track2',
//         'track3',
//         'track4']
//     }});


 describe('Test API', () => {

    beforeAll(() => {
        AWS.mock('S3', 'listObjectsV2', function(params, callback) {
            callback(null, params);
        });

        AWS.mock('DynamoDB.DocumentClient', 'query', Promise.resolve(JSON.parse(JSON.stringify(ddbQueryResponse))));
 
        AWS.mock('DynamoDB.DocumentClient', 'scan', function(params, callback) {
          const response = JSON.parse(JSON.stringify(ddbQueryResponse));
          response.LastEvaluatedKey = undefined;
          callback(null, response);
        });
     
        AWS.mock('DynamoDB.DocumentClient', 'update', function(params, callback) {
          callback(null, params);
        });
     
        AWS.mock('DynamoDB.DocumentClient', 'delete', function(params, callback) {
          callback(null, params);
        });
    });


    beforeEach(() => {
      });
      
    test('Test AnalysisOp test loadTracks', async () => { 
        const analysisOp = new AnalysisOp()
        const data = media_info_sample_data;

        AWS.mock('CommonUtils.listObjects', 'update', function(params, callback) {
            callback(null, params);
        });

        const response_data = await analysisOp.loadTracks(data, "category");
        console.log(response_data);

        let instance = new StateIndexIngestResults(stateData);
        console.log(instance);
        
        expect(stateObj.input).toStrictEqual(testEvent.input);
        expect(response_data.thing).toStringEqual(data);
        expect(instance).toBeDefined();
    });

    test('Test AnalysisOp loadTrackBasenames', async () => { 
        const analysisOp = new AnalysisOp();
        
        const bucket = 'test_bucket';
        const prefix = 'test_prefix';


        const response_data = await analysisOp.loadTrackBasenames(bucket, prefix);

        console.log(response_data);

        expect(response_data.bucket).toBe(bucket);

    });


    test('Test AssetOp startIngestWorkflow', async () => { 
        const analysisOp = new AssetOp();
        
        const params = {
            input: "my_test_input"
        }
        
        const response_data = await analysisOp.startIngestWorkflow(params);

        expect(response_data.input.input).toBe(params.input);

    });
   

    test('Test IotOp ', async () => { 
        const iotOp = new IotOp();
        
        const params = {
            input: "my_test_input"
        }
        
        const response_data = await iotOp.onPost();

        expect(response_data.status).toBe(StateData.Statuses.Completed);

    });




    test('Test SearchOp parseSearchResults', async () => { 
        const searchOp = new searchOp();
        
        const indices = 'ingest';
        const params = media_info_sample_data;

        const response_data = await searchOp.parseSearchResults(indices, params);

        expect(response_data.status).toBe(StateData.Statuses.Completed);

    });


    test('Test TranscribeOp onGetCustomLanguageModels', async () => { 
        const transcribeOp = new TranscribeOp();

        const response_data = await transcribeOp.onGetCustomLanguageModels();

        expect(response_data.status).toBe(StateData.Statuses.Completed);

    });

    test('Test TranscribeOp onGetCustomVocabularies', async () => { 
        const transcribeOp = new TranscribeOp();
    

        const response_data = await transcribeOp.onGetCustomVocabularies();

        expect(response_data.status).toBe(StateData.Statuses.Completed);

    });

});


