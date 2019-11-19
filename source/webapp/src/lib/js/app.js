/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
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
   * initialize mime types
   */
  (() => {
    window.AWSomeNamespace.Mime.define({
      'image/x-adobe-dng': ['DNG'],
      'image/x-canon-cr2': ['CR2'],
      'image/x-canon-crw': ['CRW'],
      'image/x-epson-erf': ['ERF'],
      'image/x-fuji-raf': ['RAF'],
      'image/x-kodak-dcr': ['DCR'],
      'image/x-kodak-k25': ['K25'],
      'image/x-kodak-kdc': ['KDC'],
      'image/x-minolta-mrw': ['MRW'],
      'image/x-nikon-nef': ['NEF'],
      'image/x-olympus-orf': ['ORF'],
      'image/x-panasonic-raw': ['RAW'],
      'image/x-pentax-pef': ['PEF'],
      'image/x-sony-arw': ['ARW'],
      'image/x-sony-sr2': ['SR2'],
      'image/x-sony-srf': ['SRF'],
      'image/x-sigma-x3f': ['X3F'],
    }, true);
  })();

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
    onSearchHandler: (async (...args) => {
      await cardCollection.onSearch(...args);
    }),
  });
  console.log(`${searchBox.toString()} initialized...`);

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
      await GoogleMap.getInstance();
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
  const settingsTab = new SettingsTabPanel({
    tabPanelId: '#settings',
    systemMessageInstance: systemMessage,
    cognitoInstance: myCognito,
  });

  console.log(`${settingsTab.toString()} initialized...`);

  /**
   * Bring up the sign in modal if the user has not signed in.
   */
  if (myCognito.isAnonymousUser) {
    await AppUtils.pause(1000);
    signInModal.showModal();
  }

  /**
   * Check AIML service availability
   */
  await (ServiceAvailability.createInstance(SO0050.Region)).detectServices();
});
