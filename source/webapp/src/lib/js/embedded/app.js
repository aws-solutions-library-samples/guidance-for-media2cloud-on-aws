import EmbeddedApp from './embeddedApp.js';
import {
  LazySignIn,
  ON_SIGNIN_VIEW_HIDDEN,
} from './lazySignIn.js';

const ID_DEMOAPP = '#demo-app';
const TITLE = 'Media2Cloud Embedded Video';

$(document).ready(async () => {
  // container
  const appContainer = $('<div/>');
  $(ID_DEMOAPP).append(appContainer);

  // attach signin flow
  const signIn = new LazySignIn(TITLE);
  signIn.appendTo(appContainer);

  // event handlings
  signIn.view.on(ON_SIGNIN_VIEW_HIDDEN, () => {
    setTimeout(async () => {
      const app = new EmbeddedApp();
      console.log('EmbeddedApp loaded');

      $(window).on('unload', async () => {
        console.log('EmbeddedApp unloading...');
        await app.hide();
      });

      await app.show();
    }, 10);
  });

  await signIn.show();
});
