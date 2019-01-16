/**
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                        *
 *                                                                                                 *
 *  Licensed under the Amazon Software License (the "License"). You may not use this               *
 *  file except in compliance with the License. A copy of the License is located at                *
 *                                                                                                 *
 *      http://aws.amazon.com/asl/                                                                 *
 *                                                                                                 *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS"        *
 *  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License       *
 *  for the specific language governing permissions and limitations under the License.             *
 *
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */

/**
 * @description on document ready...
 */
$(document).ready(async () => {
  /**
   * Cognito instance
   */
  const myCognito = await MyCognito.createInstance();

  /**
   * video card collection
   */
  const cardCollection = new CardCollection();

  /**
   * file uploader
   */
  const fileUpload = new FileUpload(cardCollection);
  console.log(`${fileUpload.toString()} initialized...`);

  /**
   * search box
   */
  const searchBox = new SearchBox({
    onSearchHandler: (async (event) => {
      await cardCollection.onSearch(event);
    }),
  });
  searchBox.registerEvents();

  /**
   * IotSubscriber
   */
  const subscriber = new IotSubscriber(myCognito, cardCollection);

  /**
   * Sign In/Out UI logic
   */
  const signInModal = new SignInModal({
    cognitoInstance: myCognito,
    onSignInHandler: (async () => {
      await subscriber.connect();
      await cardCollection.connect();
    }),
    onSignOutHandler: (async () => {
      await subscriber.reconnect();
      await cardCollection.disconnect();
    }),
  });
  await signInModal.loadUser();

  /**
   * System Message Window
   */
  const systemMessage = new SystemMessageArea({
    textarea: '#systemMessage',
  });

  /**
   * Settings Tab Panel
   */
  const settingsTab = new SettingsTabPanel(systemMessage, {
    tabPanelId: '#settings',
  });

  console.log(`${settingsTab.toString()} initialized...`);
});
