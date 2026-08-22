/**
 * Korean messages
 *
 * See en.js for the key list and the placeholder / plural conventions.
 *
 * Korean has a single plural category, so count-driven messages carry only
 * `other`.
 *
 * Register is 해요체 - polite but informal, the normal register for a casual
 * game. 합니다체 would read as a bank. The "Loopy" wordmark stays Latin.
 *
 * Korean puts spaces between words, unlike Japanese and Chinese, so the prose
 * blocks get `word-break: keep-all` in style.css - see the locale font stacks
 * block there.
 */

export default {
  'meta.title': 'Loopy — 매일 즐기는 무료 한붓그리기 퍼즐',
  'meta.description':
    '선 하나로 고리를 그려 모든 숫자를 만족시켜 보세요. 매일 새로운 한붓그리기 퍼즐이 세 가지 난이도로 찾아옵니다. 무료, 가입 없이 브라우저에서 바로 즐기세요.',
  'meta.ogDescription':
    '선 하나로 고리를 그려 모든 숫자를 만족시켜 보세요. 매일 새로운 퍼즐이 세 가지 난이도로. 무료, 가입 불필요.',
  'meta.imageAlt': 'Loopy – 매일 즐기는 무료 한붓그리기 퍼즐',
  'meta.playTitle': '{difficulty} Loopy — 오늘의 한붓그리기 퍼즐',

  'home.tagline': '매일의 한붓그리기 퍼즐',
  'home.howToPlay': '게임 방법',

  'menu.open': '메뉴 열기',
  'menu.close': '메뉴 닫기',
  'menu.label': '메뉴',
  'menu.unlimited': '무제한',
  'menu.support': 'Loopy 응원하기',
  'menu.feedback': '의견 보내기',
  'menu.language': '언어',

  'difficulty.easy': '쉬움',
  'difficulty.medium': '까다로움',
  'difficulty.hard': '악랄함',
  'difficulty.unlimited': '무제한',

  'game.back': '뒤로',
  'game.newPuzzle': '새 퍼즐',
  'game.help': '도움말',
  'game.settings': '설정',
  'game.clear': '지우기',
  'game.undo': '실행 취소',
  'game.viewedSolution': '정답을 봤어요',

  'common.close': '닫기',

  'settings.title': '설정',
  'settings.numbers': '숫자',
  'settings.numbersPartial': '필요한 것만',
  'settings.numbersAll': '모두 표시',
  'settings.behaviour': '동작',
  'settings.behaviourOn': '카운트다운',
  'settings.behaviourOff': '합계 표시',
  'settings.behaviourBoth': '둘 다 표시',
  'settings.borders': '테두리',
  'settings.bordersOff': '없음',
  'settings.bordersCenter': '가운데만',
  'settings.bordersFull': '전체',
  'settings.viewSolution': '정답 보기',

  'win.title': '완벽한 고리!',
  'win.finishedIn': '{time} 만에 완성했어요.',
  'win.playAnother': '하나 더',
  'win.yay': '좋았어!',
  'win.share': '공유',

  'share.copied': '복사했어요!',
  'share.failed': '실패했어요',

  'streak.overall': {
    other: '{n}일 연속',
  },
  'streak.difficulty': {
    other: '{n}일 연속 ({difficulty})',
  },

  'tutorial.draw': '드래그해서 원하는 모양과 크기의 고리를 그려 보세요.',
  'tutorial.erase': '탭하면 고리의 일부를 지울 수 있어요.',
  'tutorial.numbers': '가까운 칸에서 선이 꺾이면 그 숫자가 줄어듭니다.',
  'tutorial.win': '고리를 그려서 모든 숫자를 0으로 만들면 성공이에요.',
  'tutorial.next': '다음',
  'tutorial.gotIt': '알겠어요',
  'tutorial.replay': '다시 재생',

  'score.perfect': '완벽',
  'score.genius': '천재적',
  'score.amazing': '훌륭함',
  'score.great': '아주 좋음',
  'score.good': '좋음',
  'score.okay': '무난함',

  'pwa.shortcutName': 'Loopy {difficulty}',
  'pwa.shortcutDescription': '오늘의 Loopy {difficulty} ({size})',
};
