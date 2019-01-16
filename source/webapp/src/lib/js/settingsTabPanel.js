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
/* eslint-disable no-unused-vars */

/**
 * @class SettingsTabPanel
 * @description manage setting UI tab
 */
class SettingsTabPanel {
  constructor(systemMessageInstance, params = {}) {
    const {
      tabPanelId = '#settings',
    } = params;

    if (!systemMessageInstance) {
      throw new Error('invalid setting, systemMessageInstance');
    }

    this.$systemMessageInstance = systemMessageInstance;
    this.$messageOnOff = undefined;
    this.$tabPanel = $(tabPanelId);

    this.domInit();
  }

  /* eslint-disable class-methods-use-this */
  get [Symbol.toStringTag]() {
    return 'SettingsTabPanel';
  }
  /* eslint-enable class-methods-use-this */

  get systemMessage() {
    return this.$systemMessageInstance;
  }

  get tabPanel() {
    return this.$tabPanel;
  }

  get messageOnOff() {
    return this.$messageOnOff;
  }

  domInit() {
    const messageOnOff = 'messageOnOff';

    const element = $(`
    <div class="container mt-4">
      <div class="row">
        <div class="col">
          <!-- system message -->
          <div class="input-group">
            <label class="switch">
              <input type="checkbox" id="${messageOnOff}" data-toggle="tooltip" data-placement="bottom" title="slide to change your settings">
              <span class="slider round"></span>
            </label>
            <span class="col-sm-4 col-form-label">Enable system message</span>
          </div>
        </div>
      </div>
    </div>`);

    element.appendTo(this.tabPanel);

    this.$messageOnOff = $(`#${messageOnOff}`);

    this.registerEvents();
  }

  registerEvents() {
    this.messageOnOff.change((event) => {
      event.preventDefault();

      if (this.messageOnOff.prop('checked')) {
        this.systemMessage.show();
      } else {
        this.systemMessage.hide();
      }
    });
  }
}
