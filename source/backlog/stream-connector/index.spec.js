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
    Environment: {
      StateMachines: {
        States,
      },
    },
  } = require('service-backlog-lib');
const StateCheckProjectVersionStatus = require('./states/check-project-version-status');
const StateStartProjectVersion = require('./states/start-project-version');
const StateDetectCustomLabels = require('./states/detect-custom-labels');

const lambda = require('./index.js');
const { JobCompleted } = require('core-lib/lib/states');

const context = {
    invokedFunctionArn: 'arn:partition:service:region:account-id:resource-id',
    getRemainingTimeInMillis: 1000
}


 describe('#Main/Analysis/Main::', () => {

    beforeAll(() => {
        console.log = jest.fn();
    });


    beforeEach(() => {
      });
      
    test('Test the StateDetectCustomLabels', async () => { 
        const stateData = new StateData(Environment.StateMachines.StateDetectCustomLabels, event_StateDetectCustomLabels, context);

        let instance = new StateIndexIngestResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });



    test('Test the StateCheckProjectVersionStatus', async () => { 
        const stateData = new StateData(Environment.StateMachines.StateDetectCustomLabels, event_StateCheckProjectVersionStatus, context);

        let instance = new StateCreateRecord(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the StateStartProjectVersion', async () => { 
        const stateData = new StateData(Environment.StateMachines.StateDetectCustomLabels, event_StateStartProjectVersion, context);

        let instance = new StateFixityCompleted(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });

    test('Test the StateDetectCustomLabels', async () => { 
        const stateData = new StateData(Environment.StateMachines.StateDetectCustomLabels, event_StateDetectCustomLabels, context);

        let instance = new StateIndexIngestResults(stateData);
        console.log(instance);
        
        expect(instance).toBeDefined();
    });


});


