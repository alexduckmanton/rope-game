/**
 * Traditional Chinese messages
 *
 * See en.js for the key list and the placeholder / plural conventions.
 *
 * Chinese has a single plural category, so count-driven messages carry only
 * `other`.
 *
 * This is Taiwan Mandarin - the difference from Simplified is vocabulary as
 * well as characters (設定 not 设置, 復原 not 撤销, 選單 not 菜单), which is why
 * the two are separate dictionaries rather than a character conversion. Hong
 * Kong readers are routed here too. The "Loopy" wordmark stays Latin.
 */

export default {
  'meta.title': 'Loopy — 每日免費一筆畫謎題',
  'meta.description':
    '畫出一條封閉的線，滿足所有數字。每天更新的一筆畫謎題，三種難度。免費、免註冊，打開瀏覽器就能玩。',
  'meta.ogDescription':
    '畫出一條封閉的線，滿足所有數字。每天更新，三種難度。免費、免註冊。',
  'meta.imageAlt': 'Loopy – 每日免費一筆畫謎題',
  'meta.playTitle': '{difficulty} Loopy — 今日一筆畫謎題',

  'home.tagline': '每日一筆畫謎題',
  'home.howToPlay': '玩法說明',

  'menu.open': '開啟選單',
  'menu.close': '關閉選單',
  'menu.label': '選單',
  'menu.unlimited': '無限模式',
  'menu.support': '支持 Loopy',
  'menu.feedback': '意見回饋',
  'menu.language': '語言',

  'difficulty.easy': '簡單',
  'difficulty.medium': '刁鑽',
  'difficulty.hard': '魔鬼',
  'difficulty.unlimited': '無限',

  'game.back': '返回',
  'game.newPuzzle': '新謎題',
  'game.help': '說明',
  'game.settings': '設定',
  'game.clear': '清除',
  'game.undo': '復原',
  'game.viewedSolution': '已查看答案',

  'common.close': '關閉',

  'settings.title': '設定',
  'settings.numbers': '數字',
  'settings.numbersPartial': '僅必要的',
  'settings.numbersAll': '全部顯示',
  'settings.behaviour': '顯示方式',
  'settings.behaviourOn': '倒數',
  'settings.behaviourOff': '顯示總數',
  'settings.behaviourBoth': '兩者都顯示',
  'settings.borders': '邊框',
  'settings.bordersOff': '關閉',
  'settings.bordersCenter': '僅中心',
  'settings.bordersFull': '完整',
  'settings.viewSolution': '查看答案',

  'win.title': '完美環線！',
  'win.finishedIn': '你花了 {time} 完成。',
  'win.playAnother': '再來一局',
  'win.yay': '太棒了！',
  'win.share': '分享',

  'share.copied': '已複製！',
  'share.failed': '失敗',

  'streak.overall': {
    other: '連續 {n} 天',
  },
  'streak.difficulty': {
    other: '連續 {n} 天（{difficulty}）',
  },

  'tutorial.draw': '拖曳即可畫出任意形狀和大小的環線。',
  'tutorial.erase': '點一下可以擦掉環線的一部分。',
  'tutorial.numbers': '當你的環線在數字的方框裡轉彎時，那個數字就會減少。',
  'tutorial.win': '畫一條環線，讓所有數字歸零就算過關。',
  'tutorial.next': '下一步',
  'tutorial.gotIt': '知道了',
  'tutorial.replay': '重新播放',

  'score.perfect': '完美',
  'score.genius': '天才',
  'score.amazing': '精彩',
  'score.great': '很棒',
  'score.good': '不錯',
  'score.okay': '還行',

  'pwa.shortcutName': 'Loopy {difficulty}',
  'pwa.shortcutDescription': '今日 Loopy {difficulty}（{size}）',
};
