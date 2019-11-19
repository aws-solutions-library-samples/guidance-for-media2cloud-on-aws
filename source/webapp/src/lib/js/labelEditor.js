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
/* eslint-disable no-alert */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-restricted-globals */
/* eslint-disable no-plusplus */

/**
 * @class LabelEditor
 * @description wizard dialog to create work team
 */
class LabelEditor extends mxReadable(class {}) {
  constructor(parent, params = {}) {
    super();
    this.$parent = parent;
    this.$element = undefined;
    this.$target = undefined;
    this.$modal = $(`#${params.modalId || 'label-editor-modal-id'}`);
  }

  static get Constants() {
    const prefix = 'label-editor';
    return {
      Loading: {
        Id: `${prefix}-loading`,
      },
      Form: {
        Id: `${prefix}-form`,
        Table: {
          Id: `${prefix}-label-list`,
        },
        Input: {
          Id: `${prefix}-label-name`,
          Pattern: '^[a-zA-Z0-9]+[a-zA-Z0-9 -_]{1,}$',
        },
        Checkbox: {
          Id: `${prefix}-apply-to-all`,
        },
      },
    };
  }

  get analysisEndpoint() {
    return `${SO0050.ApiEndpoint}/${window.AWSomeNamespace.ApiOps.Analysis}`;
  }

  get parent() {
    return this.$parent;
  }

  get modal() {
    return this.$modal;
  }

  get element() {
    return this.$element;
  }

  set element(val) {
    this.$element = val;
  }

  get target() {
    return this.$target;
  }

  set target(val) {
    this.$target = val;
  }

  async show(target) {
    this.target = target;
    this.domInit();
    this.modal.modal('show');
  }

  async hide() {
    this.target = undefined;
    this.domRemove();
  }

  domRemove() {
    if (this.element) {
      this.element.remove();
    }
    this.element = undefined;
  }

  domInit() {
    this.domRemove();

    const loading = LabelEditor.Constants.Loading.Id;
    const formId = LabelEditor.Constants.Form.Id;
    const inputId = LabelEditor.Constants.Form.Input.Id;
    const tableId = LabelEditor.Constants.Form.Table.Id;
    const chkboxId = LabelEditor.Constants.Form.Checkbox.Id;
    const pattern = LabelEditor.Constants.Form.Input.Pattern;
    const height = Math.ceil(this.parent.player.el().getBoundingClientRect().height + 4);
    const label = $(this.target).text().trim();

    this.element = $(`
    <div class="modal-dialog modal-xl" role="document">
      <div class="modal-content">
        <div class = "container">
          <div class="row p-0" style="height:${height}px">
            <!-- image -->
            <div class="col-sm m-auto">
              <div class="lead" style="max-width: 100%">
                Modifying label, <strong>${label}</strong>?
              </div>
              <form class="needs-validation mt-4"
                id=${formId}
                novalidate
              >
                <!-- name -->
                <div class="input-group mb-0 mr-sm-2">
                  <label for="${inputId}"
                    class="col-sm-2 col-form-label form-control-sm px-0"
                    >Name
                  </label>
                  <input
                    id=${inputId}
                    type="text"
                    class="form-control form-control-sm col-sm-9"
                    data-label-original="${label}"
                    value="${label}"
                    pattern="${pattern}"
                    required
                  >
                  <div class="invalid-feedback text-center" style="font-size:60%">
                    Must be ${pattern}
                  </div>
                </div>

                <!-- occurences -->
                <div
                  class="mt-4 collapse"
                  id=${tableId}
                  style="overflow-y:scroll; height:${Math.floor(height / 2)}px;"
                >
                  <table class="table table-hover table-sm" style="font-size:0.8em;">
                    <thead>
                      <tr>
                        <th scope="col" class="align-middle">#</th>
                        <th scope="col" class="align-middle px-0">Start</th>
                        <th scope="col" class="align-middle px-0">End</th>
                        <th scope="col" class="align-middle px-0">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                    </tbody>
                  </table>
                </div>

                <!-- apply to all -->
                <div class="form-check collapse float-right">
                  <input class="form-check-input" type="checkbox" value="" id="${chkboxId}">
                  <label class="form-check-label" for="${chkboxId}">
                    apply to all
                  </label>
                </div>
              </form>
            </div>

            <!-- controls -->
            <div class="col-sm p-0 m-auto">
              <div class="modal-body">
                <div class="container mt-2">
                  <!-- loading icon -->
                  <div
                    id="${loading}"
                    class="spinner-grow text-secondary loading collapse"
                    style="height: 3em; width: 3em;"
                    role="status">
                    <span class="sr-only">Loading...</span>
                  </div>

                  <!-- description  -->
                  <div>
                    You can do:
                    <ul>
                      <li>Change label name</li>
                      <li>Delete label</li>
                      <li>Apply changes to all occurrences</li>
                      <li>Apply changes to specific timestamp</li>
                    </ul>
                  </div>

                  <div class="col-12 mt-auto mb-auto">
                    <div class="form-group mb-3 float-right">
                      <button
                        type="button"
                        class="btn btn-light btn-sm mb-2"
                        data-action="cancel">
                        Cancel
                      </button>

                      <button
                        type="button"
                        class="btn btn-danger btn-sm mb-2"
                        data-action="delete">
                        Delete selected
                      </button>

                      <button
                        type="button"
                        class="btn btn-success btn-sm mb-2"
                        data-action="apply">
                        Apply selected
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`);

    /* attach to preview modal */
    this.element.appendTo(this.modal);

    this.registerEvents();
  }

  async validateFormData(target) {
    const form = this.element.find('.needs-validation');
    form.get(0).checkValidity();
    form.addClass('was-validated');
  }

  async loadTrack() {
    const target = $(this.target);
    const name = target.data('track');

    let track;
    const tracks = this.parent.player.remoteTextTracks();
    for (let i = 0; i < tracks.length; i += 1) {
      if (tracks[i].label === name) {
        track = tracks[i];
        break;
      }
    }

    const markers = [];
    if (track) {
      for (let i = 0; i < track.cues.length; i++) {
        markers.push({
          startTime: track.cues[i].startTime * 1000,
          endTime: track.cues[i].endTime * 1000,
          duration: (track.cues[i].endTime - track.cues[i].startTime) * 1000,
        });
      }
      return markers;
    }
    return markers;
  }

  buildOccurenceRow(row) {
    return `<tr>
      <th scope="row" class="align-middle">
        <div class="form-check">
          <input
            type="checkbox"
            class="form-check-input position-static"
            data-start-time="${row.startTime}"
            data-end-time="${row.endTime}">
        </div>
      </th>
      <td class="align-middle px-0">
        <span class="">
          ${LabelEditor.readableDuration(row.startTime)}
        </span>
      </td>
      <td class="align-middle px-0">
        <span class="">
          ${LabelEditor.readableDuration(row.endTime)}
        </span>
      </td>
      <td class="align-middle px-0">
        <span class="">
          ${LabelEditor.readableDuration(row.duration)}
        </span>
      </td>
    </tr>`;
  }

  buildOccurenceList(list) {
    const table = this.element.find(`#${LabelEditor.Constants.Form.Table.Id}`);
    const body = table.find('tbody');
    body.children().remove();

    const items = [];
    while (list.length) {
      const item = this.buildOccurenceRow(list.shift());
      items.push(item);
    }

    if (items.length) {
      $(items.join('\n')).appendTo(body);
      table.removeClass('collapse');
    }
    return items.length > 0;
  }

  async loadOccurences() {
    const markers = await this.loadTrack();
    const shown = this.buildOccurenceList(markers);
    if (shown) {
      this.element.find(`#${LabelEditor.Constants.Form.Checkbox.Id}`).parent().removeClass('collapse');
    }
    return shown;
  }

  async onCancel(event) {
    this.modal.modal('hide');
  }

  async onApply(event) {
    return this.onModify('apply', event);
  }

  async onDelete(event) {
    return this.onModify('delete', event);
  }

  async onModify(action, event) {
    const grandparent = $(this.target).parent().parent();
    const trackCategory = grandparent.data('track-category');
    const trackType = grandparent.data('track-type');
    const trackGroup = $(this.target).data('track-group');

    let id = LabelEditor.Constants.Form.Checkbox.Id;
    const applyAll = this.modal.find(`input#${id}`).first().prop('checked');

    id = LabelEditor.Constants.Form.Input.Id;
    const input = this.modal.find(`input#${id}`).first();
    const olabel = input.data('label-original');
    const nlabel = input.val().trim();

    const list = [];
    id = LabelEditor.Constants.Form.Table.Id;
    this.modal.find(`#${id}`).first().find('input[type="checkbox"]').each((k, v) => {
      const elem = $(v);
      if (elem.prop('checked') || applyAll) {
        list.push({
          startTime: Number.parseInt(elem.data('start-time'), 10),
          endTime: Number.parseInt(elem.data('end-time'), 10),
        });
      }
    });

    if (!list.length && !applyAll) {
      alert('select the timecode(s) or \'apply to all\' to modify the label');
      return;
    }

    if (action === 'apply' && olabel.toLowerCase() === nlabel.toLowerCase()) {
      alert('original and new label names are the same. nothing to modify.');
      return;
    }

    const response = await ApiHelper.editLabel({
      uuid: this.parent.current.uuid,
      trackCategory,
      trackType,
      trackGroup,
      track: {
        name: {
          original: olabel,
          modified: nlabel,
        },
        action,
        [action]: list,
        applyAll,
      },
    });

    let forceReloadAiml = false;
    Object.keys(response.vtt).forEach((x) => {
      if (response.vtt[x].deleted) {
        this.parent.removeLabel(trackCategory, trackGroup, x, response.vtt[x].deleted);
        forceReloadAiml = true;
      }
      if (response.vtt[x].added) {
        this.parent.addLabel(trackCategory, trackGroup, x, response.vtt[x].added);
        forceReloadAiml = true;
      }
      if (response.vtt[x].modified) {
        this.parent.reloadLabel(trackCategory, trackGroup, x, response.vtt[x].modified);
      }
    });
    if (forceReloadAiml) {
      await this.parent.reloadAimlResults();
    }
    this.modal.modal('hide');
  }

  async onAction(event) {
    const action = $(event.currentTarget).data('action');
    switch (action) {
      case 'apply':
        await this.onApply();
        break;
      case 'delete':
        await this.onDelete();
        break;
      case 'cancel':
        await this.onCancel();
        break;
      default:
        break;
    }
  }

  async onSelectAll(event) {
    const chkboxId = LabelEditor.Constants.Form.Checkbox.Id;
    const checked = this.modal.find(`input#${chkboxId}`).is(':checked');
    const table = this.element.find(`#${LabelEditor.Constants.Form.Table.Id}`);
    const body = table.find('tbody');

    body.find('input[type="checkbox"]').each((key, val) => {
      $(val).prop('checked', checked);
    });
  }

  registerEvents() {
    this.modal.off('shown.bs.modal').on('shown.bs.modal', async () => {
      try {
        AppUtils.loading(LabelEditor.Constants.Loading.Id, true);
        await Promise.all([
          this.loadOccurences(),
          this.validateFormData(),
        ]);
      } catch (e) {
        console.error(e.message);
      } finally {
        AppUtils.loading(LabelEditor.Constants.Loading.Id, false);
      }
    });

    this.modal.off('hidden.bs.modal').on('hidden.bs.modal', async () => {
      await this.hide();
    });

    this.modal.find('[data-action]').each((key, val) => {
      $(val).off('click').on('click', async (event) => {
        event.preventDefault();
        try {
          AppUtils.loading(LabelEditor.Constants.Loading.Id, true);
          await this.onAction(event);
        } catch (e) {
          console.error(e.message);
        } finally {
          AppUtils.loading(LabelEditor.Constants.Loading.Id, false);
        }
      });
    });

    const chkboxId = LabelEditor.Constants.Form.Checkbox.Id;
    this.modal.find(`input#${chkboxId}`).off('change').change(async (event) => {
      await this.onSelectAll(event);
    });
  }
}
