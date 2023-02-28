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
// import SolutionManifest from '../solution-manifest.js';
jest.mock(
    '/solution-manifest.js',
    () => ({
      Version: 'test',
      LastUpdated: 'test'
    }),
    { virtual: true }
  );

// import app from '../src/lib/js/app.js'
import AppUtils from '../../webapp/src/lib/js/app/shared/appUtils.js';
import LocalStoreDB from '../../webapp/src/lib/js/app/shared/localCache/localStoreDB.js';
import MainView from '../../webapp/src/lib/js/app/mainView.js';
import SignInFlow from '../../webapp/src/lib/js/app/signInFlow.js';

test('example of how to mock an ES6 module', () => {
    AppUtils();

});

describe

/**
 * Tests
//  */
describe('#API_Operations::', () => {

    decribe('should return "responseData" when create GET request is successful', async () => {
    const response = await recommendCategorySlideComponent.createSimilaritySearchForm();
    expect(response.Id).to.equal('');
	});
 
});