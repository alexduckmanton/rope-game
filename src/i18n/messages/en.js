/**
 * English messages - the reference dictionary
 *
 * Every other locale file carries exactly these keys. `npm run check:i18n`
 * diffs them against this file, so a key added here and nowhere else is
 * reported rather than silently falling back.
 *
 * Values are either a string, or an object keyed by Intl.PluralRules category
 * ('one', 'few', 'many', 'other', ...) for messages that inflect on a count.
 * Placeholders are `{name}` and are substituted by `t()`.
 *
 * "Loopy" is the game's name and stays untranslated everywhere.
 */

export default {
  // Document head. These are what search engines and link previews read, so
  // they are the reason the localised builds exist at all
  'meta.title': 'Loopy — A Free Daily Path-Drawing Puzzle',
  'meta.description':
    'Draw a single path that closes into a loop and satisfies every number. A new path-drawing puzzle every day, in three difficulties. Free, no sign-up, plays in your browser.',
  'meta.ogDescription':
    'Draw a single path that closes into a loop and satisfies every number. A new puzzle every day, in three difficulties. Free, no sign-up.',
  'meta.imageAlt': 'Loopy - a free daily path-drawing puzzle',
  'meta.playTitle': "{difficulty} Loopy — Today's Path-Drawing Puzzle",

  // Home screen
  'home.tagline': 'A daily path-drawing puzzle',
  'home.howToPlay': 'How to play',

  // Hamburger menu
  'menu.open': 'Open menu',
  'menu.close': 'Close menu',
  'menu.label': 'Menu',
  'menu.unlimited': 'Unlimited',
  'menu.support': 'Support Loopy',
  'menu.feedback': 'Give feedback',
  'menu.language': 'Language',

  // Difficulty labels. The internal keys stay easy/medium/hard everywhere -
  // in URLs, storage, daily seeds and analytics - so these are display only
  'difficulty.easy': 'Easy',
  'difficulty.medium': 'Tricky',
  'difficulty.hard': 'Diabolical',
  'difficulty.unlimited': 'Unlimited',

  // Game screen
  'game.back': 'Back',
  'game.newPuzzle': 'New puzzle',
  'game.help': 'Help',
  'game.settings': 'Settings',
  'game.clear': 'Clear',
  'game.undo': 'Undo',
  'game.viewedSolution': 'Viewed solution',

  // Shared across components
  'common.close': 'Close',

  // Settings sheet
  'settings.title': 'Settings',
  'settings.numbers': 'Numbers',
  'settings.numbersPartial': 'Required only',
  'settings.numbersAll': 'Show all',
  'settings.behaviour': 'Behaviour',
  'settings.behaviourOn': 'Count down',
  'settings.behaviourOff': 'Show total',
  'settings.behaviourBoth': 'Show both',
  'settings.borders': 'Borders',
  'settings.bordersOff': 'Off',
  'settings.bordersCenter': 'Center only',
  'settings.bordersFull': 'Full',
  'settings.viewSolution': 'View solution',

  // Win sheet
  'win.title': 'Perfect loop!',
  'win.finishedIn': 'You finished in {time}.',
  'win.playAnother': 'Play another',
  'win.yay': 'Yay!',
  'win.share': 'Share',

  // Share button feedback
  'share.copied': 'Copied!',
  'share.failed': 'Failed',

  // Streak lines, shared between the home screen and the win sheet.
  //
  // English does not actually inflect here - "day" is attributive, so it stays
  // singular at any count - but these are still written as plural objects so
  // the reference declares the key as count-driven. Every other language does
  // inflect, and several have more than two forms.
  'streak.overall': {
    one: '{n} day streak',
    other: '{n} day streak',
  },
  'streak.difficulty': {
    one: '{n} day {difficulty} streak',
    other: '{n} day {difficulty} streak',
  },

  // Tutorial carousel
  'tutorial.draw': 'Drag to draw a loop — any shape, any size.',
  'tutorial.erase': 'Tap a square to rub it out.',
  'tutorial.numbers':
    'Bends in the squares around a number count it down. Bends further away don’t.',
  'tutorial.zero': 'A closed loop isn’t enough — every number has to reach zero.',
  'tutorial.win': 'Zero them all and the puzzle is yours.',
  'tutorial.next': 'Next',
  'tutorial.gotIt': 'Got it',
  'tutorial.replay': 'Replay',

  // Score labels. Only "Perfect" reaches a player today - the rest are
  // reported on game_abandoned, where partial progress is the point
  'score.perfect': 'Perfect',
  'score.genius': 'Genius',
  'score.amazing': 'Amazing',
  'score.great': 'Great',
  'score.good': 'Good',
  'score.okay': 'Okay',

  // Installed PWA
  'pwa.shortcutName': '{difficulty} Loopy',
  'pwa.shortcutDescription': "Today's {difficulty} Loopy ({size})",
};
