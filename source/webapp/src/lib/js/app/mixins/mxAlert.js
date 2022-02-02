// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const mxAlert = Base => class extends Base {
  shake(container, delay = 200) {
    container.addClass('shake-sm')
      .off('webkitAnimationEnd oanimationend msAnimationEnd animationend')
      .on('webkitAnimationEnd oanimationend msAnimationEnd animationend', e =>
        container.delay(delay).removeClass('shake-sm'));
  }

  async showMessage(container, type, header, description, duration = 5 * 1000) {
    return new Promise((resolve, notuse) => {
      const msgbox = $('<div/>').addClass('up-alert');
      const alert = $('<div/>').addClass(`alert alert-dismissible fade show alert-${type}`)
        .attr('role', 'alert')
        .append($('<h4/>').addClass('alert-heading')
          .html(header))
        .append($('<p/>')
          .html(description))
        .append($('<button/>').addClass('close')
          .attr('type', 'button')
          .attr('data-dismiss', 'alert')
          .attr('aria-label', 'Close')
          .append($('<span/>')
            .attr('aria-hidden', true)
            .html('&times;')));

      let timer = setTimeout(() => {
        alert.alert('close');
        timer = undefined;
      }, duration);

      alert.on('close.bs.alert', () => {
        clearInterval(timer);
        timer = undefined;
      });

      alert.on('closed.bs.alert', () => {
        alert.alert('dispose');
        msgbox.remove();
        resolve();
      });

      msgbox.append(alert);
      container.append(msgbox);
    });
  }
};

export default mxAlert;
