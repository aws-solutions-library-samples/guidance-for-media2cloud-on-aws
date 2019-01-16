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
 * @class SearchBox
 * @description manage the search input event
 */
class SearchBox {
  constructor(params) {
    const {
      onSearchHandler,
      searchId = '#searchFormId',
    } = params;

    this.$element = $(searchId);
    this.$onSearchHandler = onSearchHandler;
  }

  get element() {
    return this.$element;
  }

  get onSearchHandler() {
    return this.$onSearchHandler;
  }

  registerEvents() {
    this.element.submit(async (event) => {
      event.preventDefault();

      const searchParam = this.element.find('input[type="search"]').first().val();

      if (typeof this.onSearchHandler === 'function') {
        await this.onSearchHandler(searchParam);
      }
    });
  }
}
