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

/**
 * @class WorkteamWizard
 * @description wizard dialog to create work team
 */
class WorkteamWizard extends BaseWizard {
  constructor(parent, params = {}) {
    super(parent, params.modalId || 'workteam-modal-id');
  }

  static get Constants() {
    const prefix = 'workteam';
    return {
      Loading: {
        Id: `${prefix}-loading`,
      },
      Carousel: {
        Container: {
          Id: `${prefix}-carousel-container`,
        },
        Slide: {
          Welcome: {
            Id: `${prefix}-slide-welcome`,
          },
          PrivateTeam: {
            Id: `${prefix}-slide-private-team`,
            Select: {
              Workteam: `${prefix}-options`,
            },
          },
          TeamMember: {
            Id: `${prefix}-slide-team-member`,
            Badges: `${prefix}-member-badges`,
            Form: {
              AddMember: `${prefix}-form-add-member`,
            },
            Action: {
              Add: 'add-member',
              Remove: 'remove-member',
            },
          },
          Finish: {
            Id: `${prefix}-slide-finish`,
            Action: {
              Done: 'done',
            },
          },
          Cancel: {
            Id: `${prefix}-slide-cancel`,
          },
        },
      },
    };
  }

  get workteamEndpoint() {
    return `${SO0050.ApiEndpoint}/${window.AWSomeNamespace.ApiOps.Workteam}`;
  }

  /**
   * @function domInit
   * @description initialize dom element
   */
  domInit() {
    const id = WorkteamWizard.Constants.Carousel.Container.Id;
    const element = $(`
    <div class="modal-dialog modal-lg" role="document">
      <div class="modal-content">
        <div class="modal-body">
          <!-- loading icon -->
          <div
          id="${WorkteamWizard.Constants.Loading.Id}"
          class="spinner-grow text-secondary loading collapse"
          style="height: 3em; width: 3em;"
          role="status">
            <span class="sr-only">Loading...</span>
          </div>

          <div
          id="${id}"
          class="carousel slide"
          data-ride="carousel"
          data-interval="false">
            <div class="carousel-inner">
            </div>
          </div>
        </div>
      </div>
    </div>`);

    /* append slides */
    const slides = element.find('div.carousel-inner');
    slides.append(this.createCarouselSlideWelcome('active'));
    slides.append(this.createCarouselSlidePrivateTeam());
    slides.append(this.createCarouselSlideTeamMembers());
    slides.append(this.createCarouselSlideFinish());

    /* attach to workteam modal */
    element.appendTo(this.modal);
    this.carousel = $(`#${id}`);
    this.registerEvents();
  }

  registerEvents() {
    this.registerWorkteamEvents();
    return super.registerEvents();
  }

  registerWorkteamEvents() {
    const id = WorkteamWizard.Constants.Carousel.Slide.PrivateTeam.Select.Workteam;
    $(`select#${id}`).off('change').on('change', async (ev) => {
      const selected = $(ev.currentTarget).find('option:selected').val();
      alert(`selected = ${selected}`);
    });
  }

  createCarouselSlideWelcome(active = '') {
    const slide = WorkteamWizard.Constants.Carousel.Slide;
    const element = `
    <div
    class="carousel-item ${active}"
    id="${slide.Welcome.Id}"
    style="height: 400px">
      <div
      class="container"
      style="height: 100%; width: 96%;">
        <div
        class="row d-flex justify-content-center align-items-center"
        style="height: 90%;">
          <!-- graphics -->
          <div class="col-sm-3 px-0 text-center">
            <img
            src="./images/ground-truth-labeling.svg"
            width="100%"
            class="img-fluid"
            alt="Ground Truth labeling"
            style="filter: invert(30%); -webkit-filter: invert(100%)"
            >
          </div>

          <!-- description -->
          <div class="col-sm-9 px-0">
            <h4>Create or manage your Amazon SageMaker Ground Truth private workforce</h4>
            <p class="lead mt-3">
              By creating a work team, you can send labeling job to your private workforce to index faces.
            </p>
          </div>
        </div>

        <div class="row d-flex justify-content-end align-items-end">
          <!-- cancel -->
          <button
          type="button"
          class="btn btn-sm btn-light px-4 mx-1"
          data-action="${slide.Cancel.Id}">
            Cancel
          </button>

          <!-- Next -->
          <button
          type="button"
          class="btn btn-sm btn-success px-4 mx-1"
          data-action="${slide.PrivateTeam.Id}">
            Start
          </button>
        </div>
      </div>
    </div>
    `;
    return element;
  }

  createCarouselSlidePrivateTeam() {
    const slide = WorkteamWizard.Constants.Carousel.Slide;
    const element = `
    <div
    class="carousel-item"
    id="${slide.PrivateTeam.Id}"
    style="height: 400px">
      <div
      class="container"
      style="height: 100%; width: 96%;">
        <div
        class="row d-flex justify-content-center align-items-center"
        style="height: 90%;">
          <!-- graphics -->
          <div class="col-sm-3 px-0 text-center">
            <i class="fas fa-users-cog" style="color: #ccc; font-size: 6em"></i>
          </div>

          <!-- description -->
          <div class="col-sm-9 px-0">
            <h4>Choose a work team</h4>
            <p class="lead mt-3">
              From the 'select' box, choose an existing team to work on the labeling tasks. If no team has been created before, select 'Create new team' to create one.
            </p>

            <!-- content -->
            <form>
              <div class="form-group">
                <select class="form-control" id="${slide.PrivateTeam.Select.Workteam}">
                </select>
              </div>
            </form>
          </div>
        </div>

        <div class="row d-flex justify-content-end align-items-end">
          <!-- Cancel -->
          <button
          type="button"
          class="btn btn-sm btn-light px-4 mx-1"
          data-action="${slide.Cancel.Id}">
            Cancel
          </button>

          <!-- Welcome -->
          <button
          type="button"
          class="btn btn-sm btn-primary px-4 mx-1"
          data-action="${slide.Welcome.Id}">
            Back
          </button>

          <!-- Team Member -->
          <button
          type="button"
          class="btn btn-sm btn-success px-4 mx-1"
          data-action="${slide.TeamMember.Id}">
            Next
          </button>
        </div>
      </div>
    </div>
    `;
    return element;
  }

  addMemberBadge(email) {
    const action = WorkteamWizard.Constants.Carousel.Slide.TeamMember.Action;
    return `
    <span
    class="badge badge-pill badge-secondary my-1 py-2 mx-1"
    style="font-size: 1em; font-weight: 300;">
      ${email}
      <a
      href="#"
      class="member-anchor"
      data-action="${action.Remove}"
      data-email="${email}"
      data-toggle="tooltip"
      data-placement="bottom"
      title="remove member">
        <i class="fas fa-times-circle pl-1"></i>
      </a>
    </span>
    `;
  }

  addMemberBadgeAndEvent(email) {
    const badge = $(this.addMemberBadge(email));
    badge.find('[data-action]').off('click').on('click', async (event) => {
      event.preventDefault();
      await this.onAction(event.currentTarget);
    });
    return badge;
  }

  createCarouselSlideTeamMembers() {
    const slide = WorkteamWizard.Constants.Carousel.Slide;
    const element = `
    <div
    class="carousel-item"
    id="${slide.TeamMember.Id}"
    style="height: 400px">
      <div
      class="container"
      style="height: 100%; width: 96%;">
        <div
        class="row d-flex justify-content-center align-items-center"
        style="height: 90%;">
          <!-- graphics -->
          <div class="col-sm-3 px-0 text-center">
            <i class="fas fa-user-plus" style="color: #ccc; font-size: 6em"></i>
          </div>

          <!-- description -->
          <div class="col-sm-9 px-0">
            <h4>Manage team member</h4>
            <p class="lead mt-3">
              Enter email address(es) to add member. Use 'comma' delimiter to add multiple email addresses. To remove a member, click on 'x' next to the email address.
            </p>

            <!-- content -->
            <form id="${slide.TeamMember.Form.AddMember}">
              <div class="input-group mb-3">
                <input type="text" class="form-control" placeholder="Email addresses (comma delimiter)" aria-label="email address (comma separator)" aria-describedby="${slide.TeamMember.Action.Add}">
                <div class="input-group-append">
                  <button type="submit" class="btn btn-primary" data-action="${slide.TeamMember.Action.Add}">Add member</button>
                </div>
              </div>
            </form>
            <!-- current members -->
            <div id="${slide.TeamMember.Badges}" style="overflow-y: scroll;height: 4.5em;">
            </div>
          </div>
        </div>

        <div class="row d-flex justify-content-end align-items-end">
          <!-- Cancel -->
          <button
          type="button"
          class="btn btn-sm btn-light px-4 mx-1"
          data-action="${slide.Cancel.Id}">
            Cancel
          </button>

          <!-- Private team -->
          <button
          type="button"
          class="btn btn-sm btn-primary px-4 mx-1"
          data-action="${slide.PrivateTeam.Id}">
            Back
          </button>

          <!-- Finish -->
          <button
          type="button"
          class="btn btn-sm btn-success px-4 mx-1"
          data-action="${slide.Finish.Id}">
            Next
          </button>
        </div>
      </div>
    </div>
    `;
    return element;
  }

  createCarouselSlideFinish(active = '') {
    const slide = WorkteamWizard.Constants.Carousel.Slide;
    const element = `
    <div
    class="carousel-item ${active}"
    id="${slide.Finish.Id}"
    style="height: 400px">
      <div
      class="container"
      style="height: 100%; width: 96%;">
        <div
        class="row d-flex justify-content-center align-items-center"
        style="height: 90%;">
          <!-- graphics -->
          <div class="col-sm-3 px-0 text-center">
            <i class="far fa-check-circle" style="color: #28a745; font-size: 6em"></i>
          </div>

          <!-- description -->
          <div class="col-sm-9 px-0">
            <h4>Completed!</h4>
            <p class="lead mt-3">
              You can now send labeling job to team members by:
            </p>
            <ol class="text-muted">
              <li>Play a video</li>
              <li>Scroll carousel to 'Face Collection' page</li>
              <li>Click on 'Snapshot' and crop a face</li>
              <li>Click on 'Queue for later'</li>
              <li>When you finish collecting all faces, click on 'Send to Ground Truth'</li>
            </ol>
          </div>
        </div>

        <div class="row d-flex justify-content-end align-items-end">
          <!-- Done -->
          <button
          type="button"
          class="btn btn-sm btn-success px-4 mx-1"
          data-action="${slide.Finish.Action.Done}">
            Done
          </button>
        </div>
      </div>
    </div>
    `;
    return element;
  }

  async onAction(target) {
    const slide = WorkteamWizard.Constants.Carousel.Slide;
    switch ($(target).data('action')) {
      case slide.TeamMember.Action.Add:
        await this.onAddMembers(target);
        break;
      case slide.TeamMember.Action.Remove:
        await this.onRemoveMember(target);
        break;
      case slide.Finish.Action.Done:
        await this.onFinish(target);
        break;
      case slide.Cancel.Id:
        await this.onCancel(target);
        break;
      default:
        await super.onAction(target);
        break;
    }
    return true;
  }

  removeMember(target) {
    $(target).parent().remove();
  }

  async onRemoveMember(target) {
    const team = WorkteamWizard.Constants.Carousel.Slide.PrivateTeam.Select.Workteam;
    try {
      AppUtils.loading(WorkteamWizard.Constants.Loading.Id);
      const member = $(target).data('email');
      if (confirm(`Confirm to remove ${member} from team`)) {
        const teamName = $(`select#${team}`).find('option:selected').val();

        await AppUtils.authHttpRequest('DELETE', this.workteamEndpoint, {
          teamName,
          member,
        });
        console.log(`${member} is removed from ${teamName}`);
        this.removeMember(target);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      AppUtils.loading(WorkteamWizard.Constants.Loading.Id, false);
    }
    return true;
  }

  addMembers(emails) {
    /* add badge now */
    const parent = $(`#${WorkteamWizard.Constants.Carousel.Slide.TeamMember.Badges}`, this.modal);
    emails.forEach(x =>
      parent.prepend(this.addMemberBadgeAndEvent(x)));
  }

  async onAddMembers(target) {
    const slide = WorkteamWizard.Constants.Carousel.Slide;
    try {
      AppUtils.loading(WorkteamWizard.Constants.Loading.Id);

      const input = $(`#${slide.TeamMember.Form.AddMember}`, this.modal).find('input').first();
      const emails = input.val().split(',').map(x => x.trim());

      /* sanity check email address */
      // [a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$
      const regex = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i;
      let invalid = emails.filter(x => !regex.test(x));

      if (invalid.length > 0) {
        throw new Error(`invalid email addresses: ${invalid.join(', ')}`);
      }

      invalid = [];

      const added = [];
      const teamName = $(`select#${slide.PrivateTeam.Select.Workteam}`).find('option:selected').val();

      /* eslint-disable no-await-in-loop */
      do {
        const member = emails.shift();
        try {
          const response = await AppUtils.authHttpRequest('POST', this.workteamEndpoint, undefined, {
            teamName,
            member,
          });
          added.push(response.member);
        } catch (e) {
          invalid.push(member);
        }
      } while (emails.length);
      /* eslint-enable no-await-in-loop */

      this.addMembers(added);
      input.val('');

      if (invalid.length > 0) {
        throw new Error(`fail to add the folowing emails: ${invalid.join(', ')}`);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      AppUtils.loading(WorkteamWizard.Constants.Loading.Id, false);
    }
    return true;
  }

  async onCancel(target) {
    return this.onFinish(target);
  }

  async onFinish(target) {
    await this.hide();
    return true;
  }

  async show() {
    const slide = WorkteamWizard.Constants.Carousel.Slide;
    try {
      const response = await AppUtils.authHttpRequest('GET', this.workteamEndpoint);

      await super.show();

      $(`select#${slide.PrivateTeam.Select.Workteam}`).empty()
        .append(`<option value="${response.teamName}" selected>${response.teamName}</option>`);

      $(`#${slide.TeamMember.Badges}`, this.modal).empty();
      this.addMembers(response.members);
    } catch (e) {
      console.error(encodeURIComponent(e.message));
    }
  }
}
