/**
 * In-app offline notice
 *
 * The counterpart to offline.html, for the one gap the service worker cannot
 * paper over: each view is a lazily loaded chunk, so a player who has only ever
 * seen the home screen has never downloaded the game view. Tapping a difficulty
 * offline then fails at the import rather than at the navigation, which the
 * worker never sees and the offline page never gets a chance to answer.
 *
 * So the router catches that failure and shows this instead - same frownie,
 * same line, rendered inside the shell the player already has. Browser back
 * returns to the home screen, which is cached by definition.
 *
 * Built as a view rather than a bottom sheet: it is where the player ended up,
 * not something laid over where they were.
 *
 * Getting *out* of it needs a page reload rather than a second attempt, which
 * is the whole reason `recoverWhenOnline` below exists - see the note there.
 */

import { t } from '../i18n/index.js';

/** Built once and reused - it can be shown any number of times in a session */
let noticeView = null;

/** Whether the `online` listener has been attached. It is attached at most once */
let watchingForNetwork = false;

/**
 * Reload once the network is back, if the player is still looking at the notice
 *
 * A retry in place would not work. A dynamic import that fails is recorded as a
 * failure in the document's module map, and Chromium answers every later import
 * of that URL from the record without going near the network - so tapping the
 * same difficulty again after reconnecting fails instantly and silently, for as
 * long as the page is open. Only a fresh document clears it.
 *
 * So the recovery is a reload, and it is automatic because there is nothing for
 * the player to do: the URL they were heading for is already in the address bar,
 * so the reload drops them into the puzzle they asked for.
 *
 * Guarded on the notice still being the active view, so a player who went back
 * to the home screen and started a cached puzzle is never reloaded out of it.
 * `online` is a hint rather than a guarantee - if it fires without real
 * connectivity the reload lands back on this same notice, which is where they
 * already were.
 */
function recoverWhenOnline() {
  if (watchingForNetwork) return;
  watchingForNetwork = true;

  window.addEventListener('online', () => {
    if (noticeView && noticeView.classList.contains('active')) {
      window.location.reload();
    }
  });
}

/**
 * Show the offline notice in place of the current view
 *
 * @returns {void}
 */
export function showOfflineNotice() {
  const app = document.getElementById('app');
  if (!app) return;

  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));

  if (!noticeView) {
    noticeView = document.createElement('div');
    noticeView.id = 'offline-view';
    noticeView.className = 'view offline-view';

    const face = document.createElement('p');
    face.className = 'offline-face';
    face.setAttribute('aria-hidden', 'true');
    face.textContent = ':(';

    const message = document.createElement('p');
    message.className = 'offline-message';
    message.textContent = t('offline.title');

    noticeView.append(face, message);
    app.appendChild(noticeView);
  }

  noticeView.classList.add('active');
  recoverWhenOnline();
}
