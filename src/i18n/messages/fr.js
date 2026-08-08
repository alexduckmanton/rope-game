/**
 * French messages
 *
 * See en.js for the key list and the placeholder / plural conventions.
 *
 * French puts a narrow non-breaking space before ! and ? - written here as the
 * literal character (U+202F) so it survives copy-paste and JSON round-trips.
 */

export default {
  'meta.title': 'Loopy — le puzzle de tracé quotidien et gratuit',
  'meta.description':
    'Tracez un seul chemin qui se referme en boucle et satisfait tous les nombres. Un nouveau puzzle de tracé chaque jour, en trois difficultés. Gratuit, sans inscription, directement dans le navigateur.',
  'meta.ogDescription':
    'Tracez un seul chemin qui se referme en boucle et satisfait tous les nombres. Un nouveau puzzle chaque jour, en trois difficultés. Gratuit et sans inscription.',
  'meta.imageAlt': 'Loopy – le puzzle de tracé quotidien et gratuit',
  'meta.playTitle': '{difficulty} Loopy — le puzzle de tracé du jour',

  'home.tagline': 'Le puzzle de tracé quotidien',
  'home.howToPlay': 'Comment jouer',

  'menu.open': 'Ouvrir le menu',
  'menu.close': 'Fermer le menu',
  'menu.label': 'Menu',
  'menu.unlimited': 'Illimité',
  'menu.support': 'Soutenir Loopy',
  'menu.feedback': 'Donner votre avis',
  'menu.language': 'Langue',

  'difficulty.easy': 'Facile',
  'difficulty.medium': 'Retors',
  'difficulty.hard': 'Diabolique',
  'difficulty.unlimited': 'Illimité',

  'game.back': 'Retour',
  'game.newPuzzle': 'Nouveau puzzle',
  'game.help': 'Aide',
  'game.settings': 'Réglages',
  'game.clear': 'Effacer',
  'game.undo': 'Annuler',
  'game.viewedSolution': 'Solution consultée',

  'settings.title': 'Réglages',
  'common.close': 'Fermer',
  'settings.numbers': 'Nombres',
  'settings.numbersPartial': 'Seulement les utiles',
  'settings.numbersAll': 'Tout afficher',
  'settings.behaviour': 'Comportement',
  'settings.behaviourOn': 'Décompte',
  'settings.behaviourOff': 'Afficher le total',
  'settings.behaviourBoth': 'Afficher les deux',
  'settings.borders': 'Bordures',
  'settings.bordersOff': 'Aucune',
  'settings.bordersCenter': 'Centre seulement',
  'settings.bordersFull': 'Complètes',
  'settings.viewSolution': 'Voir la solution',

  'win.title': 'Boucle parfaite !',
  'win.finishedIn': 'Terminé en {time}.',
  'win.playAnother': 'En jouer un autre',
  'win.yay': 'Super !',
  'win.share': 'Partager',

  'share.copied': 'Copié !',
  'share.failed': 'Échec',

  'streak.overall': {
    one: '{n} jour d’affilée',
    other: '{n} jours d’affilée',
  },
  'streak.difficulty': {
    one: '{n} jour d’affilée ({difficulty})',
    other: '{n} jours d’affilée ({difficulty})',
  },

  'tutorial.drawing':
    'Faites glisser pour tracer une boucle fermée de n’importe quelle forme ou taille. Touchez pour effacer.',
  'tutorial.counting':
    'Chaque fois que votre tracé tourne dans les cases situées sur un nombre ou autour, ce nombre diminue.',
  'tutorial.winning':
    'Pour gagner, tracez une seule boucle continue qui met tous les nombres à zéro.',
  'tutorial.next': 'Suivant',
  'tutorial.gotIt': 'J’ai compris',

  'score.perfect': 'Parfait',
  'score.genius': 'Génial',
  'score.amazing': 'Impressionnant',
  'score.great': 'Très bien',
  'score.good': 'Bien',
  'score.okay': 'Correct',

  'pwa.shortcutName': 'Loopy {difficulty}',
  'pwa.shortcutDescription': 'Le Loopy {difficulty} du jour ({size})',
};
