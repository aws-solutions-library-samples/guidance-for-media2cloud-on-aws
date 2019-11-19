/**
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 * Licensed under the Amazon Software License  http://aws.amazon.com/asl/
 */

/**
 * @author MediaEnt Solutions
 */

/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */

/**
 * @class SearchBox
 * @description manage the search input event
 */
class SearchBox {
  constructor(params = {}) {
    this.$nextToken = undefined;
    this.$total = undefined;
    this.$onSearchHandler = params.onSearchHandler;
    this.$element = $(`#${params.containerId || 'search-container'}`);
    this.domInit();
  }

  static get Constants() {
    return {
      Id: {
        Loading: 'spinning-icon',
      },
      Form: {
        Id: 'search-form',
      },
    };
  }

  get [Symbol.toStringTag]() {
    return 'SearchBox';
  }

  get element() {
    return this.$element;
  }

  get nextToken() {
    return this.$nextToken;
  }

  set nextToken(val) {
    this.$nextToken = val;
  }

  get total() {
    return this.$total;
  }

  set total(val) {
    this.$total = val;
  }

  get onSearchHandler() {
    return this.$onSearchHandler;
  }

  domInit() {
    const pattern = '^[^<>()%&apos;&quot;]*$';
    const form = `
    <form
    class="needs-validation col-sm-4"
    id="${SearchBox.Constants.Form.Id}"
    novalidate>
      <div class="form-row">
        <div class="input-group mb-0 mr-sm-2">
          <div class="input-group-prepend">
            <span class="input-group-text">
              <i class="fas fa-search"></i>
            </span>
          </div>
          <input
            class="form-control"
            type="search"
            pattern="${pattern}"
            placeholder="Search..."
            value="">
          <div class="invalid-feedback text-center" style="font-size:60%">
            Must not contain '<', '>', '(', ')', '%' characters and quotes.
          </div>
        </div>
      </div>
    </form>`;
    this.element.append(form);
    this.registerEvents();
  }

  registerEvents() {
    const form = this.element.find('form').first();
    const input = form.find('input[type="search"]').first();

    form.off('submit').submit(async (event) => {
      event.preventDefault();
      const query = input.val();
      if (!query) {
        if (typeof this.onSearchHandler === 'function') {
          await this.onSearchHandler(undefined);
          return;
        }
      }

      const valid = event.currentTarget.checkValidity();
      $(event.currentTarget).addClass('was-validated');
      if (!valid) {
        event.stopPropagation();
        return;
      }

      if (this.total && this.total === this.nextToken) {
        alert(`No more results on '${query}'`); // eslint-disable-line
        return;
      }

      AppUtils.loading(SearchBox.Constants.Id.Loading);

      const params = {
        query: query.replace(/[<>()%'"]/g, ''),
        exact: true,
        token: (this.total === this.nextToken) ? undefined : this.nextToken,
        pageSize: Storage.getOption('pageSize', 10),
      };

      const response = await ApiHelper.search(params);
      console.log(`searching ${encodeURIComponent(params.query)} found ${response.uuids.length}/${response.token}/${response.total}`);

      const beginSearch = this.nextToken === undefined;

      this.nextToken = response.token;
      this.total = response.total;

      if (typeof this.onSearchHandler === 'function') {
        await this.onSearchHandler(response, beginSearch);
      }

      AppUtils.loading(SearchBox.Constants.Id.Loading, false);
    });

    input.off('change').change((event) => {
      event.preventDefault();
      form.removeClass('was-validated');
      this.nextToken = undefined;
      this.total = undefined;
    });
  }
}
