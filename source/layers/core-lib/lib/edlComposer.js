// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

class EDLComposer {
  constructor(data) {
    this.$title = data.title;
    this.$events = data.events;
    this.$dropFrame = ((data.events[0] || {}).startTime || '').indexOf(';') > 0;
  }

  get title() {
    return this.$title;
  }

  get events() {
    return this.$events;
  }

  get dropFrame() {
    return this.$dropFrame;
  }

  compose() {
    const lines = [];
    lines.splice(lines.length, 0, ...this.makeEDLHeader());
    lines.push('');

    for (let i = 0; i < this.events.length; i++) {
      const prev = (i === 0) ? undefined : this.events[i - 1];
      lines.splice(lines.length, 0, ...this.makeEDLStatement(i + 1, this.events[i], prev));
      lines.push('');
    }
    lines.push('');
    return lines.join('\n');
  }

  makeEDLHeader() {
    const title = this.title.toUpperCase().replace(/[^A-Z0-9\s:\\/]/g, ' ').substring(0, 70);
    const dropFrame = this.dropFrame
      ? 'DROP FRAME'
      : 'NON-DROP FRAME';
    return [
      `TITLE: ${title}`,
      `FCM: ${dropFrame}`,
    ];
  }

  makeEDLStatement(idx, event, prev) {
    // field 1
    const eventNum = idx.toString().padStart(3, '0');
    // field 2
    let reel = event.reelName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (reel.length > 8) {
      reel = reel.substring(reel.length - 8);
    }
    // field 3
    const trackType = 'V';
    // field 4
    const editType = 'C';
    // field 5
    const space = ' ';
    // field 6/7
    const srcIn = event.startTime.replace(';', ':');
    const srcOut = event.endTime.replace(';', ':');
    // field 8/9
    // const recordIn = (prev) ? prev.endTime.replace(';', ':') : srcIn;
    const recordIn = srcIn;
    const recordOut = srcOut;
    const clipName = event.clipName; // .toUpperCase().replace(/[^A-Z0-9\s_.-]/g, ' ');
    return [
      `${eventNum}  ${reel}  ${trackType}     ${editType}  ${space}  ${srcIn} ${srcOut} ${recordIn} ${recordOut}`,
      `* FROM CLIP NAME: ${clipName}`,
      // `FINAL CUT PRO REEL: ${event.reelName} REPLACED BY: ${reel}`,
    ];
  }
}

module.exports = EDLComposer;
