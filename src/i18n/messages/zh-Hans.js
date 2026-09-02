/**
 * Simplified Chinese messages
 *
 * See en.js for the key list and the placeholder / plural conventions.
 *
 * Chinese has a single plural category, so count-driven messages carry only
 * `other`.
 *
 * Mainland vocabulary (设置, 撤销, 菜单), which is where this differs from the
 * Traditional dictionary beyond the characters themselves. In practice this
 * build serves Singapore, Malaysia and the diaspora more than the mainland -
 * see the note on the locale entry in locales.js. The "Loopy" wordmark stays
 * Latin.
 */

export default {
  'meta.title': 'Loopy — 每日免费一笔画谜题',
  'meta.description':
    '画出一条封闭的线，满足所有数字。每天更新的一笔画谜题，三种难度。免费、无需注册，打开浏览器就能玩。',
  'meta.ogDescription':
    '画出一条封闭的线，满足所有数字。每天更新，三种难度。免费、无需注册。',
  'meta.imageAlt': 'Loopy – 每日免费一笔画谜题',
  'meta.playTitle': '{difficulty} Loopy — 今日一笔画谜题',

  'home.tagline': '每日一笔画谜题',
  'home.howToPlay': '玩法说明',

  'menu.open': '打开菜单',
  'menu.close': '关闭菜单',
  'menu.label': '菜单',
  'menu.unlimited': '无限模式',
  'menu.support': '支持 Loopy',
  'menu.feedback': '反馈意见',
  'menu.language': '语言',

  'difficulty.easy': '简单',
  'difficulty.medium': '刁钻',
  'difficulty.hard': '魔鬼',
  'difficulty.unlimited': '无限',

  'game.back': '返回',
  'game.newPuzzle': '新谜题',
  'game.help': '帮助',
  'game.settings': '设置',
  'game.clear': '清除',
  'game.undo': '撤销',
  'game.viewedSolution': '已查看答案',

  'common.close': '关闭',

  'settings.title': '设置',
  'settings.numbers': '数字',
  'settings.numbersPartial': '仅必要的',
  'settings.numbersAll': '全部显示',
  'settings.behaviour': '显示方式',
  'settings.behaviourOn': '倒数',
  'settings.behaviourOff': '显示总数',
  'settings.behaviourBoth': '两者都显示',
  'settings.borders': '边框',
  'settings.bordersOff': '关闭',
  'settings.bordersCenter': '仅中心',
  'settings.bordersFull': '完整',
  'settings.viewSolution': '查看答案',

  'win.title': '完美环线！',
  'win.finishedIn': '你用了 {time} 完成。',
  'win.playAnother': '再来一局',
  'win.yay': '太棒了！',
  'win.share': '分享',

  'share.copied': '已复制！',
  'share.failed': '失败',

  'streak.overall': {
    other: '连续 {n} 天',
  },
  'streak.difficulty': {
    other: '连续 {n} 天（{difficulty}）',
  },

  'tutorial.draw': '拖动即可画出任意形状和大小的环线。',
  'tutorial.erase': '点击可以擦掉环线的一部分。',
  'tutorial.numbers': '当你的环线在附近的格子里转弯时，那个数字就会减少。',
  'tutorial.win': '画一条让所有数字归零的环线就算通关。',
  'tutorial.next': '下一步',
  'tutorial.gotIt': '知道了',
  'tutorial.replay': '重新播放',

  'score.perfect': '完美',
  'score.genius': '天才',
  'score.amazing': '精彩',
  'score.great': '很棒',
  'score.good': '不错',
  'score.okay': '还行',

  'offline.title': '你目前离线',

  'pwa.shortcutName': 'Loopy {difficulty}',
  'pwa.shortcutDescription': '今日 Loopy {difficulty}（{size}）',
};
