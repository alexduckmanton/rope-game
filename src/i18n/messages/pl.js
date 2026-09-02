/**
 * Polish messages
 *
 * See en.js for the key list and the placeholder / plural conventions.
 *
 * Polish has four plural categories. Intl.PluralRules picks between them:
 *   one   1
 *   few   2-4, 22-24, ... ("dni")
 *   many  0, 5-21, 25-31, ... ("dni")
 *   other fractions only, which a day count never produces
 *
 * The Polish alphabet needs Inter's latin-ext subset - flagged on the locale
 * entry in locales.js so it gets preloaded alongside latin.
 */

export default {
  'meta.title': 'Loopy — darmowa codzienna łamigłówka z rysowaniem',
  'meta.description':
    'Narysuj jedną linię, która zamyka się w pętlę i spełnia każdą liczbę. Nowa łamigłówka z rysowaniem każdego dnia w trzech poziomach trudności. Za darmo, bez rejestracji, prosto w przeglądarce.',
  'meta.ogDescription':
    'Narysuj jedną linię, która zamyka się w pętlę i spełnia każdą liczbę. Nowa łamigłówka każdego dnia, w trzech poziomach trudności. Za darmo i bez rejestracji.',
  'meta.imageAlt': 'Loopy – darmowa codzienna łamigłówka z rysowaniem',
  'meta.playTitle': '{difficulty} Loopy — dzisiejsza łamigłówka z rysowaniem',

  'home.tagline': 'Codzienna łamigłówka z rysowaniem',
  'home.howToPlay': 'Jak grać',

  'menu.open': 'Otwórz menu',
  'menu.close': 'Zamknij menu',
  'menu.label': 'Menu',
  'menu.unlimited': 'Bez limitu',
  'menu.support': 'Wesprzyj Loopy',
  'menu.feedback': 'Prześlij opinię',
  'menu.language': 'Język',

  'difficulty.easy': 'Łatwy',
  'difficulty.medium': 'Podchwytliwy',
  'difficulty.hard': 'Diabelski',
  'difficulty.unlimited': 'Bez limitu',

  'game.back': 'Wstecz',
  'game.newPuzzle': 'Nowa łamigłówka',
  'game.help': 'Pomoc',
  'game.settings': 'Ustawienia',
  'game.clear': 'Wyczyść',
  'game.undo': 'Cofnij',
  'game.viewedSolution': 'Podejrzano rozwiązanie',

  'settings.title': 'Ustawienia',
  'common.close': 'Zamknij',
  'settings.numbers': 'Liczby',
  'settings.numbersPartial': 'Tylko potrzebne',
  'settings.numbersAll': 'Pokaż wszystkie',
  'settings.behaviour': 'Zachowanie',
  'settings.behaviourOn': 'Odliczanie',
  'settings.behaviourOff': 'Pokaż sumę',
  'settings.behaviourBoth': 'Pokaż oba',
  'settings.borders': 'Ramki',
  'settings.bordersOff': 'Wyłączone',
  'settings.bordersCenter': 'Tylko środek',
  'settings.bordersFull': 'Pełne',
  'settings.viewSolution': 'Zobacz rozwiązanie',

  'win.title': 'Idealna pętla!',
  'win.finishedIn': 'Ukończono w {time}.',
  'win.playAnother': 'Zagraj w kolejną',
  'win.yay': 'Super!',
  'win.share': 'Udostępnij',

  'share.copied': 'Skopiowano!',
  'share.failed': 'Nie udało się',

  'streak.overall': {
    one: '{n} dzień z rzędu',
    few: '{n} dni z rzędu',
    many: '{n} dni z rzędu',
    other: '{n} dnia z rzędu',
  },
  'streak.difficulty': {
    one: '{n} dzień z rzędu ({difficulty})',
    few: '{n} dni z rzędu ({difficulty})',
    many: '{n} dni z rzędu ({difficulty})',
    other: '{n} dnia z rzędu ({difficulty})',
  },

  'tutorial.draw': 'Przeciągnij, aby narysować pętlę o dowolnym kształcie i rozmiarze.',
  'tutorial.erase': 'Dotknij, aby wymazać fragmenty pętli.',
  'tutorial.numbers': 'Liczby maleją, gdy pętla skręca na sąsiednich polach.',
  'tutorial.win': 'Aby wygrać, narysuj pętlę, która sprowadzi każdą liczbę do zera.',
  'tutorial.next': 'Dalej',
  'tutorial.gotIt': 'Jasne',
  'tutorial.replay': 'Odtwórz ponownie',

  'score.perfect': 'Perfekcyjnie',
  'score.genius': 'Genialnie',
  'score.amazing': 'Wspaniale',
  'score.great': 'Świetnie',
  'score.good': 'Dobrze',
  'score.okay': 'Nieźle',

  'offline.title': 'Jesteś offline',

  'pwa.shortcutName': 'Loopy {difficulty}',
  'pwa.shortcutDescription': 'Dzisiejsze Loopy {difficulty} ({size})',
};
