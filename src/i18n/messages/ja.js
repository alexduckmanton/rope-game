/**
 * Japanese messages
 *
 * See en.js for the key list and the placeholder / plural conventions.
 *
 * Japanese has a single plural category, so count-driven messages carry only
 * `other`. Intl.PluralRules is what decides that, and check-i18n.mjs derives
 * the required set from it, so nothing here has to know the rule.
 *
 * Register is ですます-adjacent but light - friendly rather than formal, which
 * is what a casual daily puzzle wants. The "Loopy" wordmark stays Latin.
 */

export default {
  'meta.title': 'Loopy — 無料で遊べる毎日の一筆書きパズル',
  'meta.description':
    '一本の線を描いて輪をつくり、すべての数字を満たそう。毎日新しい一筆書きパズルが3つの難易度で登場。無料、登録不要、ブラウザですぐ遊べます。',
  'meta.ogDescription':
    '一本の線を描いて輪をつくり、すべての数字を満たそう。毎日新しいパズルが3つの難易度で登場。無料、登録不要。',
  'meta.imageAlt': 'Loopy – 無料で遊べる毎日の一筆書きパズル',
  'meta.playTitle': '{difficulty} Loopy — 今日の一筆書きパズル',

  'home.tagline': '毎日の一筆書きパズル',
  'home.howToPlay': '遊び方',

  'menu.open': 'メニューを開く',
  'menu.close': 'メニューを閉じる',
  'menu.label': 'メニュー',
  'menu.unlimited': '無制限',
  'menu.support': 'Loopyを応援する',
  'menu.feedback': 'ご意見を送る',
  'menu.language': '言語',

  'difficulty.easy': 'かんたん',
  'difficulty.medium': 'ひとくせ',
  'difficulty.hard': '極悪',
  'difficulty.unlimited': '無制限',

  'game.back': '戻る',
  'game.newPuzzle': '新しいパズル',
  'game.help': 'ヘルプ',
  'game.settings': '設定',
  'game.clear': 'クリア',
  'game.undo': '元に戻す',
  'game.viewedSolution': '答えを見ました',

  'common.close': '閉じる',

  'settings.title': '設定',
  'settings.numbers': '数字',
  'settings.numbersPartial': '必要なものだけ',
  'settings.numbersAll': 'すべて表示',
  'settings.behaviour': '動作',
  'settings.behaviourOn': 'カウントダウン',
  'settings.behaviourOff': '合計を表示',
  'settings.behaviourBoth': '両方を表示',
  'settings.borders': '枠線',
  'settings.bordersOff': 'なし',
  'settings.bordersCenter': '中央のみ',
  'settings.bordersFull': 'すべて',
  'settings.viewSolution': '答えを見る',

  'win.title': '完璧なループ！',
  'win.finishedIn': '{time} でクリアしました。',
  'win.playAnother': 'もう一問',
  'win.yay': 'やった！',
  'win.share': '共有',

  'share.copied': 'コピーしました！',
  'share.failed': '失敗しました',

  'streak.overall': {
    other: '{n}日連続',
  },
  'streak.difficulty': {
    other: '{n}日連続（{difficulty}）',
  },

  'tutorial.draw': 'ドラッグして、好きな形と大きさのループを描きましょう。',
  'tutorial.erase': 'タップするとループの一部を消せます。',
  'tutorial.numbers': '近くのマスで線が曲がると、その数字が減ります。',
  'tutorial.win': 'すべての数字が0になるループを描けばクリアです。',
  'tutorial.next': '次へ',
  'tutorial.gotIt': 'わかった',
  'tutorial.replay': 'もう一度再生',

  'score.perfect': '完璧',
  'score.genius': '天才的',
  'score.amazing': 'お見事',
  'score.great': 'すばらしい',
  'score.good': 'いい感じ',
  'score.okay': 'まずまず',

  'pwa.shortcutName': 'Loopy {difficulty}',
  'pwa.shortcutDescription': '今日の Loopy {difficulty}（{size}）',
};
