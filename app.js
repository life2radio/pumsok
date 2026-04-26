/* ════════════════════════════════════════
   품속 — 메인 로직
   ════════════════════════════════════════ */

(function() {
'use strict';

/* ── 1. 유틸리티 ── */

function $(id) { return document.getElementById(id); }

function safeGet(key, def) {
  try { return localStorage.getItem(key) ?? def; } catch(e) { return def; }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val); } catch(e) {}
}
function safeGetJSON(key, def) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch(e) { return def; }
}
function safeSetJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

function today() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}

function todayLabel() {
  var d = new Date();
  var days = ['일','월','화','수','목','금','토'];
  return d.getFullYear() + '년 ' + (d.getMonth()+1) + '월 ' + d.getDate() + '일 ' + days[d.getDay()] + '요일';
}

var _toastTimer = null;
function showToast(msg, dur) {
  var el = $('toast'); if(!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function() { el.classList.remove('show'); }, dur || 2500);
}

/* ── 2. 네비게이션 ── */

var _currentView = 'routine';

function switchView(name) {
  document.querySelectorAll('.view-section').forEach(function(el) {
    el.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  var view = $('view-' + name);
  var btn  = document.querySelector('.nav-btn[data-view="' + name + '"]');
  if(view) view.classList.add('active');
  if(btn)  btn.classList.add('active');
  _currentView = name;

  // 각 탭 진입 시 렌더
  if(name === 'routine')     renderRoutine();
  if(name === 'vow')         renderVow();
  if(name === 'affirmation') renderAffirmation();
  if(name === 'memo')        renderMemo();
  if(name === 'test')        renderTest();
  if(name === 'settings')    renderSettings();
}

// 네비 버튼 이벤트
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchView(btn.dataset.view);
    });
  });
  initApp();
});

/* ── 3. 앱 초기화 ── */

function initApp() {
  applyFontSize();
  applyTheme();
  updateRoutineBadge();
  // 헤더 타이틀 변경
  var ht = document.getElementById('header-title');
  if(ht) ht.textContent = '품속';
  switchView('routine');
  checkOnboarding();
}

/* ── 4. 글씨 크기 ── */

function applyFontSize() {
  var sz = safeGet('font_size', 'normal');
  document.body.classList.remove('fs-large','fs-xlarge');
  if(sz === 'large')  document.body.classList.add('fs-large');
  if(sz === 'xlarge') document.body.classList.add('fs-xlarge');
}

function setFontSize(sz) {
  safeSet('font_size', sz);
  applyFontSize();
  showToast('글씨 크기가 변경됐어요');
}

/* ── 5. 다크모드 ── */

function applyTheme() {
  var dark = safeGet('dark_mode','0') === '1';
  document.body.classList.toggle('dark', dark);
}

function toggleDarkMode() {
  var dark = safeGet('dark_mode','0') === '1';
  safeSet('dark_mode', dark ? '0' : '1');
  applyTheme();
  showToast(dark ? '라이트 모드로 변경됐어요' : '다크 모드로 변경됐어요');
}


/* ════════════════════════════════════════
   온보딩 (첫 방문 시)
   ════════════════════════════════════════ */

var ONBOARDING_SLIDES = [
  {
    emoji: '🌿',
    title: '품속에 오신 것을\n환영합니다',
    desc: '아침에 일어나자마자 반드시 해야 할 일!\n인생을 기적으로 만드는 품속을\n매일 함께 실천해요.',
    sub: '인생2막라디오'
  },
  {
    emoji: '🧠',
    title: '왜 아침 루틴이\n중요할까요?',
    desc: '기상 직후 뇌는 세타파 상태예요.\n이때가 하루 중 정보가 가장 깊이\n새겨지는 골든타임입니다.\n\n이 시간을 어떻게 쓰느냐가\n하루 전체의 감정과 방향을 결정해요.',
    sub: '뇌과학이 증명한 사실'
  },
  {
    emoji: '📋',
    title: '5단계 루틴',
    desc: '① 🧘 숨 고르기 — 1분 침묵으로 마음 모으기\n② 🎯 나의 다짐 — 소리내어 선언하기\n③ ✨ 오늘의 확언 — 뇌에 긍정 심기\n④ 📝 한 줄 기록 — 생각 쏟아내기\n⑤ 🤸 몸 깨우기 — 스트레칭으로 마무리',
    sub: '매일 5~10분이면 충분해요'
  },
  {
    emoji: '🎯',
    title: '나의 다짐이란?',
    desc: '목표 금액, 날짜, 내가 줄 가치를 담은\n나만의 선언문을 만들어요.\n\n매일 소리내어 읽으면\n뇌의 망상활성계(RAS)가 활성화되어\n목표를 향한 기회를 자동으로 포착합니다.',
    sub: '록펠러도 매일 했던 그 습관'
  },
  {
    emoji: '✨',
    title: '오늘의 확언이란?',
    desc: '365일 매일 다른 확언이 준비되어 있어요.\n뇌과학 기반으로 작성된 문장을\n소리내어 읽으면 생각이 바뀌고\n생각이 바뀌면 삶이 바뀝니다.',
    sub: '매일 새로운 확언'
  },
  {
    emoji: '👤',
    title: '시작하기',
    desc: '이름(또는 별명)과 이메일을 입력하세요.\n앱 소식과 동기부여 메시지를\n가끔 보내드릴게요.',
    sub: '1분이면 충분해요',
    isInput: true
  }
];

var _obSlide = 0;

function checkOnboarding() {
  var done = safeGet('onboarding_done_v2', '0');
  if(done !== '1') showOnboarding();
}

function showOnboarding() {
  var existing = document.getElementById('onboarding-overlay');
  if(existing) { existing.style.display='flex'; return; }

  var ov = document.createElement('div');
  ov.id = 'onboarding-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:#1B4332;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
  document.body.appendChild(ov);
  _obSlide = 0;
  renderOnboardingSlide();
}

function renderOnboardingSlide() {
  var ov = document.getElementById('onboarding-overlay');
  if(!ov) return;
  var s = ONBOARDING_SLIDES[_obSlide];
  var total = ONBOARDING_SLIDES.length;
  var isLast = _obSlide === total - 1;

  // 점 인디케이터
  var dots = ONBOARDING_SLIDES.map(function(_, i) {
    return '<div style="width:'+(i===_obSlide?'20px':'8px')+';height:8px;border-radius:4px;background:'+(i===_obSlide?'#C9A84C':'rgba(255,255,255,0.3)')+';transition:all 0.3s;"></div>';
  }).join('');

  var inputHTML = s.isInput ? [
    '<div style="width:100%;max-width:320px;margin-top:8px;">',
    '<div style="margin-bottom:10px;">',
    '<input id="ob-nick" type="text" placeholder="이름 또는 별명" ',
    'style="width:100%;padding:14px;border-radius:12px;border:none;font-size:16px;background:rgba(255,255,255,0.15);color:#fff;outline:none;box-sizing:border-box;" ',
    'value="'+safeGet('user_nick','')+'">',
    '</div>',
    '<div style="margin-bottom:16px;">',
    '<input id="ob-email" type="email" placeholder="이메일 주소" ',
    'style="width:100%;padding:14px;border-radius:12px;border:none;font-size:16px;background:rgba(255,255,255,0.15);color:#fff;outline:none;box-sizing:border-box;" ',
    'value="'+safeGet('user_email','')+'">',
    '</div>',
    '<button onclick="googleLoginOnboarding()" ',
    'style="width:100%;padding:13px;border-radius:12px;border:none;background:#fff;color:#1B4332;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px;">',
    '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
    '구글 계정으로 자동 입력',
    '</button>',
    '</div>',
  ].join('') : '';

  ov.innerHTML = [
    // 상단 도트
    '<div style="display:flex;gap:6px;margin-bottom:32px;">'+dots+'</div>',

    // 이모지
    '<div style="font-size:4em;margin-bottom:20px;">'+s.emoji+'</div>',

    // 제목
    '<div style="font-size:22px;font-weight:900;color:#fff;text-align:center;line-height:1.4;margin-bottom:16px;white-space:pre-line;">'+s.title+'</div>',

    // 부제
    '<div style="font-size:12px;color:#C9A84C;font-weight:700;letter-spacing:1px;margin-bottom:16px;">'+s.sub+'</div>',

    // 설명
    '<div style="font-size:15px;color:rgba(255,255,255,0.85);text-align:center;line-height:1.8;margin-bottom:24px;white-space:pre-line;max-width:320px;">'+s.desc+'</div>',

    // 입력창 (마지막 슬라이드)
    inputHTML,

    // 버튼들
    '<div style="width:100%;max-width:320px;">',
    isLast ?
      '<button onclick="completeOnboarding()" style="width:100%;padding:16px;border-radius:14px;border:none;background:#C9A84C;color:#1B4332;font-size:17px;font-weight:900;cursor:pointer;margin-bottom:12px;">시작하기 🌿</button>' :
      '<button onclick="nextObSlide()" style="width:100%;padding:16px;border-radius:14px;border:none;background:#C9A84C;color:#1B4332;font-size:17px;font-weight:900;cursor:pointer;margin-bottom:12px;">다음 →</button>',
    _obSlide > 0 ?
      '<button onclick="prevObSlide()" style="width:100%;padding:12px;border-radius:14px;border:none;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);font-size:15px;cursor:pointer;margin-bottom:12px;">← 이전</button>' : '',
    '<button onclick="skipOnboarding()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:13px;cursor:pointer;padding:8px;">건너뛰기</button>',
    '</div>',
  ].join('');
}

window.nextObSlide = function() {
  if(_obSlide < ONBOARDING_SLIDES.length - 1) {
    _obSlide++;
    renderOnboardingSlide();
  }
};

window.prevObSlide = function() {
  if(_obSlide > 0) { _obSlide--; renderOnboardingSlide(); }
};

window.skipOnboarding = function() {
  safeSet('onboarding_done_v2','1');
  var ov = document.getElementById('onboarding-overlay');
  if(ov) ov.style.display='none';
};

window.completeOnboarding = function() {
  var nick  = (document.getElementById('ob-nick') ||{}).value||'';
  var email = (document.getElementById('ob-email')||{}).value||'';
  if(nick.trim()) safeSet('user_nick', nick.trim());
  if(email.trim()) safeSet('user_email', email.trim());
  safeSet('onboarding_done_v2','1');
  var ov = document.getElementById('onboarding-overlay');
  if(ov) {
    ov.style.opacity='0';
    ov.style.transition='opacity 0.4s';
    setTimeout(function(){ov.style.display='none';},400);
  }
  showToast('환영해요! 품속을 시작해볼까요 🌿');
  renderRoutine();
};

window.googleLoginOnboarding = function() {
  var CLIENT_ID = '960491976015-2d0jequkprvnp5g267i16q4mrgd96qr3.apps.googleusercontent.com';
  var redirectUri = encodeURIComponent('https://life2radio.github.io/pumsok/');
  var scope = encodeURIComponent('email profile');
  var url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id='+CLIENT_ID+
    '&redirect_uri='+redirectUri+'&response_type=token&scope='+scope+'&prompt=select_account';

  var isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  if(!isMobile) {
    var popup = window.open(url,'google_oauth','width=500,height=600,scrollbars=yes');
    var timer = setInterval(function(){
      try {
        if(popup && popup.closed){clearInterval(timer);return;}
        if(popup && popup.location && popup.location.hash){
          var hash = popup.location.hash;
          clearInterval(timer); popup.close();
          var params = new URLSearchParams(hash.substring(1));
          var token = params.get('access_token');
          if(token){
            fetch('https://www.googleapis.com/oauth2/v3/userinfo?access_token='+token)
              .then(function(r){return r.json();})
              .then(function(info){
                var nickEl  = document.getElementById('ob-nick');
                var emailEl = document.getElementById('ob-email');
                if(emailEl && info.email) emailEl.value = info.email;
                if(nickEl  && !nickEl.value && info.name) nickEl.value = info.name;
                showToast('✅ 구글 계정 정보가 입력됐어요!');
              }).catch(function(){showToast('이메일을 직접 입력해주세요');});
          }
        }
      } catch(e){}
    },500);
    setTimeout(function(){clearInterval(timer);if(popup&&!popup.closed)popup.close();},30000);
  } else {
    safeSet('ob_waiting_oauth','1');
    window.open(url,'_blank');
    window.addEventListener('message',function _msg(e){
      if(e.data && e.data.type==='oauth_email'){
        window.removeEventListener('message',_msg);
        var nickEl  = document.getElementById('ob-nick');
        var emailEl = document.getElementById('ob-email');
        if(emailEl && e.data.email) emailEl.value = e.data.email;
        if(nickEl  && !nickEl.value && e.data.name) nickEl.value = e.data.name;
        showToast('✅ 구글 계정 정보가 입력됐어요!');
      }
    });
  }
};

// 온보딩 다시 보기 (설정에서 호출)
window.showOnboardingAgain = function() {
  _obSlide = 0;
  var ov = document.getElementById('onboarding-overlay');
  if(ov) { ov.style.display='flex'; ov.style.opacity='1'; }
  else showOnboarding();
  renderOnboardingSlide();
};

/* ════════════════════════════════════════
   루틴 탭
   ════════════════════════════════════════ */

var _silenceTimer = null;
var _silenceSec   = 60;
var _silenceRunning = false;

function renderRoutine() {
  var el = $('view-routine');
  if(!el) return;

  var todayStr  = today();
  var record    = safeGetJSON('routine_record', {});
  var todayRec  = record[todayStr] || {};
  var vowData   = safeGetJSON('vow_data_v2', null);
  var vowText   = vowData ? vowData.text : null;

  // 오늘 날짜 레이블
  var dateLabel = todayLabel();

  // 각 스텝 완료 여부
  var steps = ['silence','vow','affirmation','memo','body'];
  var doneCount = steps.filter(function(s) { return todayRec[s]; }).length;

  el.innerHTML = [
    '<div class="view-inner">',

    // 날짜 + 인사
    '<div class="green-card" style="margin-bottom:16px;">',
    '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,0.7);margin-bottom:4px;">' + dateLabel + '</div>',
    '<div style="font-size:var(--fs-title);font-weight:900;color:#fff;margin-bottom:8px;">좋은 아침이에요 🌿</div>',
    '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,0.8);margin-bottom:16px;">오늘의 루틴을 시작해볼까요</div>',
    // 진행 바
    '<div style="background:rgba(255,255,255,0.2);border-radius:4px;height:6px;overflow:hidden;">',
    '<div style="background:#C9A84C;height:100%;border-radius:4px;width:' + (doneCount/5*100) + '%;transition:width 0.4s;"></div>',
    '</div>',
    '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,0.7);margin-top:6px;">' + doneCount + '/5 완료</div>',
    '</div>',

    // 스텝 1: 침묵
    makeStepCard({
      step: 1, key: 'silence', done: todayRec.silence,
      icon: '🧘', title: '숨 고르기',
      desc: '하루를 시작하는 1분. 눈을 감고 조용히 호흡에 집중하세요.',
      action: '<button class="btn-primary" onclick="startSilence()" id="silence-btn">' +
              (todayRec.silence ? '✅ 완료됨' : '▶ 1분 타이머 시작') + '</button>',
    }),

    // 스텝 2: 다짐
    makeStepCard({
      step: 2, key: 'vow', done: todayRec.vow,
      icon: '🎯', title: '나의 다짐',
      desc: vowText
        ? '"' + vowText.slice(0,40) + (vowText.length>40?'...':'"')
        : '아직 다짐을 설정하지 않으셨어요.',
      action: '<button class="btn-primary" onclick="goVow()">' +
              (todayRec.vow ? '✅ 완료됨' : (vowText ? '🔊 다짐 읽기' : '✏️ 다짐 만들기')) + '</button>',
    }),

    // 스텝 3: 오늘의 확언
    makeStepCard({
      step: 3, key: 'affirmation', done: todayRec.affirmation,
      icon: '✨', title: '오늘의 확언',
      desc: getTodayAffirmationText(),
      action: '<button class="btn-primary" onclick="goAffirmation()">' +
              (todayRec.affirmation ? '✅ 완료됨' : '📖 확언 읽기') + '</button>',
    }),

    // 스텝 4: 한 줄 기록
    makeStepCard({
      step: 4, key: 'memo', done: todayRec.memo,
      icon: '📝', title: '한 줄 기록',
      desc: '오늘 마음속에 떠오르는 것을 한 줄로 쏟아내세요.',
      action: '<button class="btn-primary" onclick="goMemo()">' +
              (todayRec.memo ? '✅ 완료됨' : '✏️ 기록하기') + '</button>',
    }),

    // 스텝 5: 몸 깨우기
    makeStepCard({
      step: 5, key: 'body', done: todayRec.body,
      icon: '🤸', title: '몸 깨우기',
      desc: '이제 몸을 깨울 시간이에요. 가볍게 스트레칭으로 하루를 열어보세요.',
      action: '<div style="display:flex;gap:8px;">' +
              '<button class="btn-secondary" style="flex:1" onclick="openBodyStretch()">스트레칭 영상 보기</button>' +
              (todayRec.body ? '' : '<button class="btn-primary" style="flex:1" onclick="markBody()">완료 체크</button>') +
              (todayRec.body ? '<button class="btn-primary" style="flex:1" disabled style="opacity:0.6;">✅ 완료됨</button>' : '') +
              '</div>',
    }),

    // 전체 완료 축하
    doneCount === 5 ?
      '<div style="background:linear-gradient(135deg,#C9A84C,#E8C97A);border-radius:16px;padding:20px;text-align:center;margin-bottom:16px;">' +
      '<div style="font-size:2em;margin-bottom:8px;">🎉</div>' +
      '<div style="font-size:var(--fs-title);font-weight:900;color:#1B4332;margin-bottom:4px;">오늘 루틴 완료!</div>' +
      '<div style="font-size:var(--fs-caption);color:#2D6A4F;">정말 잘하셨어요. 뇌가 오늘의 시작을 기억합니다.</div>' +
      '</div>' : '',

    '</div>',
  ].join('');

  // 타이머 복원
  if(_silenceRunning) {
    updateSilenceBtn();
  }
}

function makeStepCard(opt) {
  var doneStyle = opt.done
    ? 'border:1.5px solid #1B4332;'
    : 'border:1.5px solid var(--color-border);';

  return [
    '<div class="card section-gap" style="' + doneStyle + '">',
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">',
    '<div style="width:32px;height:32px;border-radius:50%;background:' +
      (opt.done ? '#1B4332' : 'var(--color-border)') +
      ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:var(--fs-caption);font-weight:800;flex-shrink:0;">' + opt.step + '</div>',
    '<div>',
    '<div style="font-size:var(--fs-title);font-weight:800;color:var(--color-text-primary);">' + opt.icon + ' ' + opt.title + '</div>',
    '</div>',
    '</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-secondary);margin-bottom:14px;line-height:1.6;">' + opt.desc + '</div>',
    opt.action,
    '</div>',
  ].join('');
}

function getTodayAffirmationText() {
  var arr = window.AFFIRMATIONS;
  if(!arr || !arr.length) return '확언을 불러오는 중이에요.';
  var start = new Date(new Date().getFullYear(), 0, 1);
  var now   = new Date();
  var diff  = Math.floor((now - start) / 86400000);
  var item  = arr[diff % arr.length];
  return item ? item.text.slice(0,60) + (item.text.length>60?'...':'') : '';
}

// 침묵 타이머
function startSilence() {
  var todayStr = today();
  var rec = safeGetJSON('routine_record',{});
  if(rec[todayStr] && rec[todayStr].silence) {
    showToast('오늘 이미 완료했어요 ✅'); return;
  }

  if(_silenceRunning) {
    // 정지
    clearInterval(_silenceTimer);
    _silenceRunning = false;
    _silenceSec = 60;
    var btn = $('silence-btn');
    if(btn) btn.textContent = '▶ 1분 타이머 시작';
    return;
  }

  _silenceRunning = true;
  _silenceSec = 60;
  updateSilenceBtn();

  _silenceTimer = setInterval(function() {
    _silenceSec--;
    updateSilenceBtn();
    if(_silenceSec <= 0) {
      clearInterval(_silenceTimer);
      _silenceRunning = false;
      _silenceSec = 60;
      // 완료 처리
      var rec2 = safeGetJSON('routine_record',{});
      var td   = today();
      if(!rec2[td]) rec2[td] = {};
      rec2[td].silence = true;
      safeSetJSON('routine_record', rec2);
      showToast('숨 고르기 완료! 🧘 마음이 차분해졌나요?');
      renderRoutine();
      updateRoutineBadge();
    }
  }, 1000);
}

function updateSilenceBtn() {
  var btn = $('silence-btn'); if(!btn) return;
  if(_silenceRunning) {
    btn.textContent = '⏹ ' + _silenceSec + '초... (탭하면 중지)';
    btn.style.background = '#2D6A4F';
  }
}

// 다짐 탭으로 이동 + 완료 체크
function goVow() {
  switchView('vow');
}

// 루틴에서 확언 읽기
function goAffirmation() {
  // 완료 체크 후 이동
  var rec = safeGetJSON('routine_record',{});
  var td  = today();
  if(!rec[td]) rec[td] = {};
  rec[td].affirmation = true;
  safeSetJSON('routine_record', rec);
  switchView('affirmation');
  updateRoutineBadge();
}

// 메모 탭으로 이동
function goMemo() {
  switchView('memo');
}

// 몸 깨우기
function openBodyStretch() {
  window.open('https://www.youtube.com/@SecondActRadio','_blank');
}

function markBody() {
  var rec = safeGetJSON('routine_record',{});
  var td  = today();
  if(!rec[td]) rec[td] = {};
  rec[td].body = true;
  safeSetJSON('routine_record', rec);
  showToast('몸 깨우기 완료! 🤸 오늘 루틴 끝!');
  renderRoutine();
  updateRoutineBadge();
}

// 루틴 배지 (미완료 시 표시)
function updateRoutineBadge() {
  var badge = document.querySelector('.nav-btn[data-view="routine"] .nav-badge');
  if(!badge) return;
  var rec   = safeGetJSON('routine_record',{});
  var td    = today();
  var done  = rec[td] ? Object.values(rec[td]).filter(Boolean).length : 0;
  badge.classList.toggle('show', done < 5);
}

// 다짐 탭에서 완료 후 루틴 체크
window.markRoutineVow = function() {
  var rec = safeGetJSON('routine_record',{});
  var td  = today();
  if(!rec[td]) rec[td] = {};
  rec[td].vow = true;
  safeSetJSON('routine_record', rec);
  updateRoutineBadge();
};

// 메모 탭에서 완료 후 루틴 체크
window.markRoutineMemo = function() {
  var rec = safeGetJSON('routine_record',{});
  var td  = today();
  if(!rec[td]) rec[td] = {};
  rec[td].memo = true;
  safeSetJSON('routine_record', rec);
  updateRoutineBadge();
};

/* ════════════════════════════════════════
   다짐 탭
   ════════════════════════════════════════ */

function renderVow() {
  var el = $('view-vow'); if(!el) return;
  var vow = safeGetJSON('vow_data_v2', null);
  if(!vow || !vow.confirmed) {
    renderVowSetup(el);
  } else {
    renderVowMain(el, vow);
  }
}

function renderVowSetup(el) {
  el.innerHTML = [
    '<div class="view-inner">',
    '<div class="green-card">',
    '<div class="section-title">🎯 나의 다짐 만들기</div>',
    '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,0.8);line-height:1.7;">',
    '매일 소리내어 읽으면 뇌가 목표를 현실로 만들기 시작합니다.<br>',
    '세 가지를 정하고 나만의 선언문을 완성하세요.',
    '</div>',
    '</div>',

    '<div class="card section-gap">',
    '<div class="input-wrap">',
    '<label class="input-label">목표 금액</label>',
    '<input id="vow-amount" class="input-field" type="text" placeholder="예: 1억원, 5천만원">',
    '</div>',
    '<div class="input-wrap">',
    '<label class="input-label">목표 날짜</label>',
    '<input id="vow-target" class="input-field" type="date">',
    '</div>',
    '<div class="input-wrap">',
    '<label class="input-label">내가 줄 가치 (어떤 방법으로?)</label>',
    '<input id="vow-value" class="input-field" type="text" placeholder="예: 유튜브, 앱, 책, 강의">',
    '</div>',
    '<div class="input-wrap">',
    '<label class="input-label">닉네임 또는 이름</label>',
    '<input id="vow-name" class="input-field" type="text" placeholder="예: 드림">',
    '</div>',
    '<div class="input-wrap">',
    '<label class="input-label">하루 수행 횟수</label>',
    '<div style="display:flex;gap:8px;">',
    '<button id="vow-cnt-1" class="btn-primary" style="flex:1" onclick="selectVowCount(1)">하루 1회</button>',
    '<button id="vow-cnt-2" class="btn-secondary" style="flex:1" onclick="selectVowCount(2)">아침 + 저녁</button>',
    '</div>',
    '</div>',
    '<div class="input-wrap">',
    '<label class="input-label">시작일</label>',
    '<input id="vow-start" class="input-field" type="date">',
    '</div>',
    '</div>',

    '<button class="btn-accent section-gap" onclick="generateVowSentences()">나의 선언문 만들기 →</button>',

    // 선언문 선택 영역 (처음엔 숨김)
    '<div id="vow-sentences" style="display:none;"></div>',

    '</div>',
  ].join('');

  // 기본값 설정
  var startEl = $('vow-start');
  if(startEl) startEl.value = today();
  selectVowCount(1);

  // 저장된 값 복원
  var saved = safeGetJSON('vow_draft',{});
  if(saved.amount && $('vow-amount')) $('vow-amount').value = saved.amount;
  if(saved.target && $('vow-target')) $('vow-target').value = saved.target;
  if(saved.value  && $('vow-value'))  $('vow-value').value  = saved.value;
  if(saved.name   && $('vow-name'))   $('vow-name').value   = saved.name;
  if(saved.count) selectVowCount(saved.count);
}

var _vowCount = 1;
window.selectVowCount = function(n) {
  _vowCount = n;
  var b1 = $('vow-cnt-1'), b2 = $('vow-cnt-2');
  if(!b1||!b2) return;
  if(n===1) {
    b1.className = 'btn-primary'; b1.style.flex = '1';
    b2.className = 'btn-secondary'; b2.style.flex = '1';
  } else {
    b2.className = 'btn-primary'; b2.style.flex = '1';
    b1.className = 'btn-secondary'; b1.style.flex = '1';
  }
};

window.generateVowSentences = function() {
  var amount = ($('vow-amount')||{}).value || '';
  var target = ($('vow-target')||{}).value || '';
  var value  = ($('vow-value') ||{}).value || '';
  var name   = ($('vow-name')  ||{}).value || '나';
  var start  = ($('vow-start') ||{}).value || today();

  if(!amount||!target||!value||!name) {
    showToast('모든 항목을 입력해주세요 🙏'); return;
  }

  // 임시 저장
  safeSetJSON('vow_draft', {amount,target,value,name,count:_vowCount,start});

  var d = new Date(target);
  var ymd = d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일';

  var sentences = [
    ymd+', 나 '+name+'은 '+amount+'을 이뤄낸 사람이다.\n나는 '+value+'을 통해 많은 분들께 진심 어린 가치를 전하는 작가이자 크리에이터다.',
    ymd+'까지 나 '+name+'은 '+amount+'을 손에 쥔다.\n그 대가로 나는 '+value+'로 세상에 가치를 펼쳐 보인다.',
    name+'. '+amount+'. '+ymd+'.\n'+value+'로 많은 이들의 삶을 바꾼다. 나는 이미 그 길 위에 있다.',
  ];
  var labels = ['✨ 정체성 선언형','💪 직설 단언형','⚡ 짧고 강한형'];

  var html = '<div class="card section-gap"><div style="font-size:var(--fs-title);font-weight:800;margin-bottom:4px;">선언문을 선택하세요</div><div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:14px;">마음에 드는 것을 고른 후 수정할 수 있어요</div>';
  sentences.forEach(function(s,i) {
    html += '<div onclick="pickVowSentence('+i+')" id="vs-'+i+'" style="border:1.5px solid '+(i===0?'#1B4332':'var(--color-border)')+';border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;background:'+(i===0?'var(--color-primary-soft)':'var(--color-surface)')+';">'+
      '<div style="font-size:var(--fs-caption);font-weight:700;color:#1B4332;margin-bottom:6px;">'+labels[i]+'</div>'+
      '<div style="font-size:var(--fs-body);line-height:1.8;white-space:pre-line;">'+s+'</div>'+
      '</div>';
  });
  html += '<div class="input-wrap" style="margin-top:8px;"><label class="input-label">✏️ 직접 수정</label><textarea id="vow-custom" class="input-field" rows="4" style="line-height:1.8;">'+sentences[0]+'</textarea></div>';
  html += '<button class="btn-accent" style="margin-top:4px;" onclick="confirmVow()">이 문장으로 확정하기 →</button></div>';

  var area = $('vow-sentences');
  if(area) { area.innerHTML = html; area.style.display='block'; }
  area.scrollIntoView({behavior:'smooth'});
};

window.pickVowSentence = function(i) {
  [0,1,2].forEach(function(j) {
    var c = $('vs-'+j); if(!c) return;
    c.style.borderColor = i===j ? '#1B4332' : 'var(--color-border)';
    c.style.background  = i===j ? 'var(--color-primary-soft)' : 'var(--color-surface)';
  });
  var draft = safeGetJSON('vow_draft',{});
  var d = new Date(draft.target||today());
  var ymd = d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일';
  var n = draft.name||'나', a = draft.amount||'', v = draft.value||'';
  var sentences = [
    ymd+', 나 '+n+'은 '+a+'을 이뤄낸 사람이다.\n나는 '+v+'을 통해 많은 분들께 진심 어린 가치를 전하는 작가이자 크리에이터다.',
    ymd+'까지 나 '+n+'은 '+a+'을 손에 쥔다.\n그 대가로 나는 '+v+'로 세상에 가치를 펼쳐 보인다.',
    n+'. '+a+'. '+ymd+'.\n'+v+'로 많은 이들의 삶을 바꾼다. 나는 이미 그 길 위에 있다.',
  ];
  var ta = $('vow-custom'); if(ta) ta.value = sentences[i];
};

window.confirmVow = function() {
  var text  = ($('vow-custom')||{}).value || '';
  var draft = safeGetJSON('vow_draft',{});
  if(!text.trim()) { showToast('선언문을 입력해주세요'); return; }
  var vow = {
    text:      text,
    amount:    draft.amount,
    target:    draft.target,
    value:     draft.value,
    name:      draft.name,
    count:     draft.count || 1,
    startDate: draft.start || today(),
    confirmed: true,
    checks:    {},
  };
  safeSetJSON('vow_data_v2', vow);
  showToast('🎯 다짐이 시작됐어요!');
  renderVow();
};

// ── 다짐 메인 화면 ──

var _vowTTSPlaying = false;

function renderVowMain(el, vow) {
  // 마이그레이션 (숫자→객체)
  if(vow.checks) {
    Object.keys(vow.checks).forEach(function(k) {
      if(typeof vow.checks[k] === 'number') {
        vow.checks[k] = {morning: vow.checks[k]>=1, evening: false};
      }
    });
    safeSetJSON('vow_data_v2', vow);
  }

  var td      = today();
  var checks  = vow.checks || {};
  var maxCnt  = vow.count || 1;
  var raw     = checks[td] || {morning:false,evening:false};
  var mDone   = raw.morning||false;
  var eDone   = raw.evening||false;

  // D-Day
  var targetD = new Date(vow.target); targetD.setHours(0,0,0,0);
  var nowD    = new Date(); nowD.setHours(0,0,0,0);
  var diff    = Math.ceil((targetD-nowD)/86400000);
  var ddayTxt = diff>0 ? 'D-'+diff : diff===0 ? 'D-Day' : 'D+'+Math.abs(diff);

  // 스트릭
  var streak=0, cur=new Date(); cur.setHours(0,0,0,0);
  while(true) {
    var kk=cur.getFullYear()+'-'+String(cur.getMonth()+1).padStart(2,'0')+'-'+String(cur.getDate()).padStart(2,'0');
    var cr=checks[kk]||{};
    if(cr.morning||cr.evening){streak++;cur.setDate(cur.getDate()-1);}else break;
  }

  // 달력
  var calHTML = renderVowCalendar(vow);

  // 체크 카드
  var checkHTML = '';
  if(maxCnt===1) {
    checkHTML = makeVowCheckCard(mDone,'☀️','완료','var(--color-primary-soft)','#1B4332');
  } else {
    checkHTML = '<div style="display:flex;gap:12px;justify-content:center;">' +
      makeVowCheckCard(mDone,'☀️','아침','#FFFBEA','#C9A84C') +
      makeVowCheckCard(eDone,'🌙','저녁','var(--color-primary-soft)','#1B4332') +
      '</div>';
  }

  el.innerHTML = [
    '<div class="view-inner">',

    // 매일 두 가지 약속
    '<div class="green-card" style="margin-bottom:14px;">',
    '<div style="font-size:var(--fs-caption);font-weight:800;color:#A8D5BA;letter-spacing:1px;margin-bottom:10px;">📌 매일 두 가지 약속</div>',
    '<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">',
    '<div style="min-width:22px;height:22px;background:#C9A84C;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;">1</div>',
    '<div style="font-size:var(--fs-caption);color:#fff;line-height:1.6;">눈뜨자마자 한 번, 잠들기 직전 한 번<br><span style="color:#A8D5BA;">반드시 소리내어 읽는다</span></div>',
    '</div>',
    '<div style="display:flex;gap:10px;align-items:flex-start;">',
    '<div style="min-width:22px;height:22px;background:#C9A84C;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;">2</div>',
    '<div style="font-size:var(--fs-caption);color:#fff;line-height:1.6;">읽을 때 그 장면이 이루어진 모습을<br><span style="color:#A8D5BA;">머릿속에 또렷이 그린다</span></div>',
    '</div>',
    '</div>',

    // D-Day
    '<div class="green-card" style="text-align:center;margin-bottom:14px;">',
    '<div style="font-size:var(--fs-caption);color:#A8D5BA;margin-bottom:4px;">목표까지</div>',
    '<div style="font-size:3em;font-weight:900;color:#C9A84C;letter-spacing:-2px;">'+ddayTxt+'</div>',
    '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,0.7);margin-top:4px;">'+vow.target+' 까지</div>',
    '</div>',

    // 선언문
    '<div class="card section-gap" style="border:1.5px solid #C9A84C33;">',
    '<div style="font-size:var(--fs-caption);font-weight:700;color:#C9A84C;margin-bottom:8px;">🎯 나의 다짐</div>',
    '<div style="font-size:var(--fs-body);line-height:1.9;white-space:pre-line;font-weight:600;">'+vow.text+'</div>',
    '</div>',

    // 버튼
    '<div class="card section-gap">',
    '<button id="vow-tts-btn" class="btn-primary" style="margin-bottom:10px;" onclick="vowTTS()">🔊 따라해보세요</button>',
    '<button class="btn-secondary" onclick="vowSTT()">🎙 소리내어 읽기</button>',
    '<div id="vow-stt-status" style="font-size:var(--fs-caption);color:var(--color-text-muted);text-align:center;margin-top:6px;min-height:18px;"></div>',
    '</div>',

    // 오늘 수행
    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-caption);font-weight:700;color:var(--color-text-secondary);margin-bottom:12px;">오늘 수행 현황</div>',
    '<div style="margin-bottom:14px;">'+checkHTML+'</div>',
    '<div style="text-align:right;">',
    '<button class="btn-text" onclick="resetTodayVow()">오늘 기록 초기화</button>',
    '</div>',
    '</div>',

    // 시각화
    '<div class="card section-gap" style="border:1.5px solid var(--color-border);">',
    '<div style="font-size:var(--fs-title);font-weight:800;margin-bottom:4px;">🔭 시각화</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:14px;">선언문을 읽은 후, 두 가지를 머릿속에 그려보세요</div>',
    '<div class="input-wrap">',
    '<label class="input-label">먼 미래 — 이 다짐이 이루어진 날, 나는?</label>',
    '<textarea id="vow-vis-far" class="input-field" rows="2" placeholder="예: 서점에서 내 책을 보고 있다" onchange="saveVowVis()">' +
      (vow.visFar||'') + '</textarea>',
    '</div>',
    '<div class="input-wrap">',
    '<label class="input-label">오늘 — 이를 위해 오늘 한 가지 한다면?</label>',
    '<textarea id="vow-vis-today" class="input-field" rows="2" placeholder="예: EP.05 스크립트 초안 완성" onchange="saveVowVis()">' +
      (vow.visToday||'') + '</textarea>',
    '</div>',
    '</div>',

    // 스탯
    '<div class="card section-gap" style="display:flex;gap:0;text-align:center;">',
    '<div style="flex:1;border-right:1px solid var(--color-border);">',
    '<div style="font-size:1.6em;font-weight:900;color:#1B4332;">'+streak+'</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">연속 일수</div>',
    '</div>',
    '<div style="flex:1;">',
    '<div style="font-size:1.6em;font-weight:900;color:#1B4332;">'+Object.keys(checks).filter(function(k){var r=checks[k];return r.morning||r.evening;}).length+'</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">총 수행일</div>',
    '</div>',
    '</div>',

    // 달력
    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-body);font-weight:800;margin-bottom:12px;">📅 수행 기록</div>',
    calHTML,
    '</div>',

    // 카카오
    '<div style="background:#FEE500;border-radius:14px;padding:16px;margin-bottom:14px;display:flex;align-items:center;gap:12px;">',
    '<div style="font-size:1.6em;">💛</div>',
    '<div>',
    '<div style="font-size:var(--fs-body);font-weight:900;color:#3C1E1E;margin-bottom:2px;">매일 아침·저녁 다짐 알림 받기</div>',
    '<div style="font-size:var(--fs-caption);color:#5C3E1E;margin-bottom:8px;">카카오 채널에서 다짐 알림을 보내드려요</div>',
    '<a href="https://open.kakao.com/o/gr3RC2pi" target="_blank" style="display:inline-block;background:#3C1E1E;color:#FEE500;padding:7px 16px;border-radius:20px;font-size:var(--fs-caption);font-weight:700;">오픈채팅 참여하기 →</a>',
    '</div>',
    '</div>',

    // 리셋
    '<div style="text-align:center;margin-bottom:16px;">',
    '<button class="btn-text" onclick="resetVow()">새 다짐으로 다시 시작하기</button>',
    '</div>',

    // 사연 보내기
    '<div class="card">',
    '<div style="font-size:var(--fs-body);font-weight:800;color:var(--color-primary);margin-bottom:6px;">💌 사연 보내기</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:12px;">다짐을 이루는 이야기를 들려주세요</div>',
    '<button class="btn-primary" onclick="openStoryModal()">💌 사연 보내기</button>',
    '</div>',

    '</div>',
  ].join('');
}

function makeVowCheckCard(done, emoji, label, doneBg, doneBorder) {
  if(done) {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;background:'+doneBg+';border:2px solid '+doneBorder+';border-radius:12px;padding:10px 18px;">' +
      '<span style="font-size:1.4em;">'+emoji+'</span>' +
      '<span style="font-size:0.95em;">✅</span>' +
      '<span style="font-size:var(--fs-caption);font-weight:800;color:'+doneBorder+';">'+label+' 완료</span>' +
      '</div>';
  }
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;background:#F5F5F5;border:2px dashed #ddd;border-radius:12px;padding:10px 18px;">' +
    '<span style="font-size:1.4em;filter:grayscale(0.6);opacity:0.5;">'+emoji+'</span>' +
    '<span style="font-size:0.95em;color:#ddd;">○</span>' +
    '<span style="font-size:var(--fs-caption);font-weight:700;color:#bbb;">'+label+'</span>' +
    '</div>';
}

function renderVowCalendar(vow) {
  var checks   = vow.checks || {};
  var startD   = new Date(vow.startDate||today()); startD.setHours(0,0,0,0);
  var nowD     = new Date(); nowD.setHours(0,0,0,0);
  var maxCnt   = vow.count || 1;
  var y=nowD.getFullYear(), m=nowD.getMonth();
  var firstDay = new Date(y,m,1);
  var lastDay  = new Date(y,m+1,0);

  var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;">';
  ['일','월','화','수','목','금','토'].forEach(function(d) {
    html += '<div style="font-size:11px;color:var(--color-text-muted);padding-bottom:4px;">'+d+'</div>';
  });
  for(var i=0;i<firstDay.getDay();i++) html += '<div></div>';
  for(var day=1;day<=lastDay.getDate();day++) {
    var dt = new Date(y,m,day); dt.setHours(0,0,0,0);
    var kk = dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
    var raw = checks[kk]||{};
    if(typeof raw==='number') raw={morning:raw>=1,evening:false};
    var done = raw.morning?1:0; if(raw.evening) done++;
    var isToday = dt.getTime()===nowD.getTime();
    var inRange = dt>=startD && dt<=nowD;
    var bg='#f5f5f5', col='#ccc';
    if(inRange) {
      if(done>=maxCnt) {bg='#1B4332';col='#fff';}
      else if(done>0)  {bg='#A8D5B5';col='#1B4332';}
      else             {bg='#FFE0E0';col='#e57373';}
    }
    var border = isToday ? '2px solid #C9A84C' : '2px solid transparent';
    html += '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;background:'+bg+';color:'+col+';font-size:11px;font-weight:700;border:'+border+';">'+day+'</div>';
  }
  html += '</div>';
  return html;
}

// TTS
window.vowTTS = function() {
  var vow = safeGetJSON('vow_data_v2',null); if(!vow) return;
  if(!window.speechSynthesis) { showToast('음성 기능을 지원하지 않아요'); return; }
  if(_vowTTSPlaying) {
    window.speechSynthesis.cancel(); _vowTTSPlaying=false;
    var b=$('vow-tts-btn'); if(b) b.textContent='🔊 따라해보세요'; return;
  }
  window.speechSynthesis.cancel();
  var utt = new SpeechSynthesisUtterance(vow.text.replace(/[\r\n]/g,' '));
  utt.lang='ko-KR'; utt.rate=0.88;
  utt.onstart=function(){_vowTTSPlaying=true;var b=$('vow-tts-btn');if(b)b.textContent='⏹ 정지하기';};
  utt.onend=function(){_vowTTSPlaying=false;var b=$('vow-tts-btn');if(b)b.textContent='🔊 따라해보세요';vowMarkCheck();};
  utt.onerror=function(){_vowTTSPlaying=false;var b=$('vow-tts-btn');if(b)b.textContent='🔊 따라해보세요';};
  window.speechSynthesis.speak(utt);
  showToast('🔊 함께 소리내어 읽어보세요!');
};

// STT
var _vowRec = null;
window.vowSTT = function() {
  var SR = window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR) { showToast('이 브라우저는 음성 인식을 지원하지 않아요'); return; }
  if(_vowRec) { _vowRec.stop(); _vowRec=null; return; }
  _vowRec = new SR();
  _vowRec.lang='ko-KR'; _vowRec.continuous=false; _vowRec.interimResults=true;
  _vowRec.onresult=function(e){var t='';for(var i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript;var s=$('vow-stt-status');if(s)s.textContent=t;};
  _vowRec.onend=function(){_vowRec=null;vowMarkCheck();var s=$('vow-stt-status');if(s){s.textContent='✅ 완료! 수행 체크됐어요';setTimeout(function(){s.textContent='';},2000);}};
  _vowRec.start();
  var s=$('vow-stt-status');if(s)s.textContent='🎙 듣고 있어요...';
};

// 수행 체크
function getVowSlot() {
  var h=new Date().getHours();
  return (h>=5&&h<16)?'morning':'evening';
}

function vowMarkCheck() {
  var vow=safeGetJSON('vow_data_v2',null);if(!vow)return;
  var td=today();
  vow.checks=vow.checks||{};
  var raw=vow.checks[td]||{morning:false,evening:false};
  if(typeof raw==='number') raw={morning:raw>=1,evening:false};
  var slot=getVowSlot(), maxCnt=vow.count||1;
  if(maxCnt===1) raw.morning=true;
  else raw[slot]=true;
  vow.checks[td]=raw;
  safeSetJSON('vow_data_v2',vow);
  // 루틴 체크
  markRoutineVow();
  var done=(maxCnt===1)?raw.morning:(raw.morning&&raw.evening);
  if(done) showToast('오늘 다짐 완료! 🎉');
  else if(slot==='morning') showToast('아침 다짐 완료! ☀️ 저녁에 한 번 더!');
  else showToast('저녁 다짐 완료! 🌙 오늘 하루 수고했어요!');
  renderVow();
}

window.resetTodayVow = function() {
  var vow=safeGetJSON('vow_data_v2',null);if(!vow)return;
  var td=today();
  vow.checks=vow.checks||{};
  vow.checks[td]={morning:false,evening:false};
  safeSetJSON('vow_data_v2',vow);
  showToast('오늘 기록이 초기화됐어요');
  renderVow();
};

window.resetVow = function() {
  if(!confirm('다짐을 초기화하고 새로 시작할까요?')) return;
  localStorage.removeItem('vow_data_v2');
  renderVow();
};

window.saveVowVis = function() {
  var vow=safeGetJSON('vow_data_v2',null);if(!vow)return;
  vow.visFar   = ($('vow-vis-far')||{}).value||'';
  vow.visToday = ($('vow-vis-today')||{}).value||'';
  safeSetJSON('vow_data_v2',vow);
};

/* ════════════════════════════════════════
   확언 탭
   ════════════════════════════════════════ */

function renderAffirmation() {
  var el = $('view-affirmation'); if(!el) return;
  var arr = window.AFFIRMATIONS;
  if(!arr||!arr.length) { el.innerHTML='<div class="view-inner empty-state">확언 데이터를 불러오는 중이에요.</div>'; return; }

  var start = new Date(new Date().getFullYear(),0,1);
  var diff  = Math.floor((new Date()-start)/86400000);
  var item  = arr[diff%arr.length];
  var favs  = safeGetJSON('affirmation_favs',[]);
  var isFav = favs.indexOf(diff)!==-1;

  // 루틴 확언 완료 체크
  var rec=safeGetJSON('routine_record',{});
  var td=today();
  if(!rec[td]) rec[td]={};
  rec[td].affirmation=true;
  safeSetJSON('routine_record',rec);
  updateRoutineBadge();

  el.innerHTML = [
    '<div class="view-inner">',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:4px;">'+todayLabel()+'</div>',
    '<div style="font-size:var(--fs-title);font-weight:900;margin-bottom:20px;">오늘의 확언</div>',

    '<div class="green-card" style="text-align:center;margin-bottom:20px;">',
    '<div style="font-size:var(--fs-caption);color:#A8D5BA;margin-bottom:8px;">'+item.theme+'</div>',
    '<div style="font-size:var(--fs-body);line-height:1.9;color:#fff;font-weight:600;">'+item.text+'</div>',
    '</div>',

    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-caption);font-weight:700;color:var(--color-text-secondary);margin-bottom:8px;">🌱 오늘의 실천</div>',
    '<div style="font-size:var(--fs-body);color:var(--color-text-primary);line-height:1.7;">'+item.action+'</div>',
    '</div>',

    '<div style="display:flex;gap:10px;margin-bottom:14px;">',
    '<button class="btn-primary" style="flex:1" onclick="ttsAffirmation()">🔊 소리내어 읽기</button>',
    '<button class="btn-secondary" style="flex:0 0 48px;padding:0;" onclick="toggleAffirmFav('+diff+')">',
    isFav ? '⭐' : '☆',
    '</button>',
    '</div>',

    '<button class="btn-secondary" onclick="showAffirmCalendar()">📅 달력 보기</button>',

    '<div id="affirmation-calendar" style="margin-top:16px;"></div>',

    '</div>',
  ].join('');
}

window.ttsAffirmation = function() {
  var arr=window.AFFIRMATIONS; if(!arr) return;
  var diff=Math.floor((new Date()-new Date(new Date().getFullYear(),0,1))/86400000);
  var item=arr[diff%arr.length]; if(!item) return;
  if(!window.speechSynthesis) { showToast('음성 기능을 지원하지 않아요'); return; }
  window.speechSynthesis.cancel();
  var utt=new SpeechSynthesisUtterance(item.text);
  utt.lang='ko-KR'; utt.rate=0.88;
  window.speechSynthesis.speak(utt);
  showToast('🔊 확언을 소리내어 읽어보세요');
};

window.toggleAffirmFav = function(idx) {
  var favs=safeGetJSON('affirmation_favs',[]);
  var i=favs.indexOf(idx);
  if(i===-1) { favs.push(idx); showToast('⭐ 즐겨찾기에 추가됐어요'); }
  else { favs.splice(i,1); showToast('즐겨찾기에서 해제됐어요'); }
  safeSetJSON('affirmation_favs',favs);
  renderAffirmation();
};

window.showAffirmCalendar = function() {
  var el=$('affirmation-calendar'); if(!el) return;
  if(el.innerHTML) { el.innerHTML=''; return; }
  // 이번 달 달력
  var y=new Date().getFullYear(), m=new Date().getMonth();
  var first=new Date(y,m,1), last=new Date(y,m+1,0);
  var rec=safeGetJSON('routine_record',{});
  var html='<div style="font-size:var(--fs-body);font-weight:800;margin-bottom:10px;">이번 달 확언 기록</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;">';
  ['일','월','화','수','목','금','토'].forEach(function(d){html+='<div style="font-size:11px;color:var(--color-text-muted);">'+d+'</div>';});
  for(var i=0;i<first.getDay();i++) html+='<div></div>';
  for(var d=1;d<=last.getDate();d++) {
    var dt=new Date(y,m,d);
    var kk=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
    var done=rec[kk]&&rec[kk].affirmation;
    var isToday=kk===today();
    html+='<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;background:'+(done?'#1B4332':'#f5f5f5')+';color:'+(done?'#fff':'#ccc')+';font-size:12px;font-weight:700;border:'+(isToday?'2px solid #C9A84C':'none')+';">'+d+'</div>';
  }
  html+='</div>';
  el.innerHTML=html;
};

/* ════════════════════════════════════════
   메모 탭
   ════════════════════════════════════════ */

function renderMemo() {
  var el=$('view-memo'); if(!el) return;
  var memos=safeGetJSON('memos_v2',[]);
  var todayMemo=memos.find(function(m){return m.date===today();});

  el.innerHTML=[
    '<div class="view-inner">',
    '<div style="font-size:var(--fs-title);font-weight:900;margin-bottom:4px;">📝 한 줄 기록</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:20px;">오늘 마음속에 떠오르는 것을 쏟아내세요</div>',

    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-caption);font-weight:700;color:var(--color-text-secondary);margin-bottom:8px;">오늘 — '+todayLabel()+'</div>',
    '<textarea id="memo-input" class="input-field" rows="4" placeholder="오늘 느끼는 것, 감사한 것, 하고 싶은 말 무엇이든..." style="margin-bottom:10px;">'+(todayMemo?todayMemo.text:'')+'</textarea>',
    '<button class="btn-primary" onclick="saveMemo()">저장하기</button>',
    '</div>',

    memos.length ?
      '<div><div style="font-size:var(--fs-body);font-weight:800;margin-bottom:12px;">지난 기록</div>' +
      memos.slice().reverse().slice(0,10).map(function(m) {
        return '<div class="card section-gap" style="position:relative;">' +
          '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:4px;">'+m.date+'</div>' +
          '<div style="font-size:var(--fs-body);line-height:1.7;">'+m.text+'</div>' +
          '</div>';
      }).join('') + '</div>' : '',

    '</div>',
  ].join('');
}

window.saveMemo = function() {
  var text=($('memo-input')||{}).value||'';
  if(!text.trim()){showToast('내용을 입력해주세요');return;}
  var memos=safeGetJSON('memos_v2',[]);
  var td=today();
  var idx=memos.findIndex(function(m){return m.date===td;});
  if(idx===-1) memos.push({date:td,text:text.trim()});
  else memos[idx].text=text.trim();
  safeSetJSON('memos_v2',memos);
  showToast('✅ 저장됐어요');
  // 루틴 완료 체크
  markRoutineMemo();
  renderMemo();
};

/* ════════════════════════════════════════
   테스트 탭 (심리테스트 — 간략 버전)
   ════════════════════════════════════════ */

function renderTest() {
  var el=$('view-test'); if(!el) return;
  var result=safeGetJSON('psych_result_v2',null);

  if(result && result.animal) {
    renderTestResult(el, result);
  } else {
    el.innerHTML=[
      '<div class="view-inner">',
      '<div class="green-card">',
      '<div class="section-title">🧠 나는 어떤 사람일까?</div>',
      '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,0.85);line-height:1.7;margin-bottom:16px;">',
      'BFI-44 · Rosenberg · VIA 기반<br>',
      '세계 52개국 검증된 성격 검사로<br>',
      '16가지 동물 유형 중 나를 발견하세요',
      '</div>',
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center;font-size:var(--fs-caption);margin-bottom:16px;">',
      ['🦁사자','🐺늑대','🦅독수리','🦫비버','🐘코끼리','🐋고래','🦝라쿤','🐢거북',
       '🐒원숭이','🦊여우','🦦수달','🦌사슴','🐯호랑이','🐆표범','🦢백조','🐱고양이']
      .map(function(a){return '<div>'+a+'</div>';}).join(''),
      '</div>',
      '</div>',
      '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);text-align:center;margin-bottom:16px;">BFI-44 · Rosenberg · VIA · 약 12분 · 무료</div>',
      '<button class="btn-accent" onclick="startPsychTest()">🧠 검사 시작하기</button>',
      '</div>',
    ].join('');
  }
}

window.startPsychTest = function() {
  showToast('심리테스트 준비 중이에요 🧠');
  // TODO: 전체 심리테스트 구현
};

function renderTestResult(el, result) {
  el.innerHTML=[
    '<div class="view-inner">',
    '<div class="green-card" style="text-align:center;">',
    '<div style="font-size:3em;margin-bottom:8px;">'+result.animal.emoji+'</div>',
    '<div style="font-size:var(--fs-title);font-weight:900;color:#fff;margin-bottom:4px;">'+result.animal.name+'</div>',
    '<div style="font-size:var(--fs-caption);color:#A8D5BA;">'+result.animal.mbti+'</div>',
    '</div>',
    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-body);line-height:1.8;">'+result.animal.desc+'</div>',
    '</div>',
    '<button class="btn-secondary" onclick="resetPsychTest()">다시 검사하기</button>',
    '</div>',
  ].join('');
}

window.resetPsychTest = function() {
  localStorage.removeItem('psych_result_v2');
  renderTest();
};

/* ════════════════════════════════════════
   설정 탭
   ════════════════════════════════════════ */

function renderSettings() {
  var el=$('view-settings'); if(!el) return;
  var dark=safeGet('dark_mode','0')==='1';
  var fs=safeGet('font_size','normal');

  el.innerHTML=[
    '<div class="view-inner">',
    '<div style="font-size:var(--fs-title);font-weight:900;margin-bottom:20px;">설정</div>',

    // 글씨 크기
    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-body);font-weight:800;margin-bottom:12px;">글씨 크기</div>',
    '<div style="display:flex;gap:8px;">',
    makeSettingBtn('보통', 'setFontSize("normal")', fs==='normal'),
    makeSettingBtn('크게', 'setFontSize("large")', fs==='large'),
    makeSettingBtn('매우 크게', 'setFontSize("xlarge")', fs==='xlarge'),
    '</div>',
    '</div>',

    // 다크모드
    '<div class="card section-gap" style="display:flex;justify-content:space-between;align-items:center;">',
    '<div style="font-size:var(--fs-body);font-weight:800;">다크 모드</div>',
    '<button onclick="toggleDarkMode()" style="width:52px;height:28px;border-radius:14px;border:none;background:'+(dark?'#1B4332':'#ddd')+';position:relative;cursor:pointer;transition:background 0.2s;">',
    '<div style="width:22px;height:22px;border-radius:50%;background:#fff;position:absolute;top:3px;'+(dark?'right:3px':'left:3px')+';transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);"></div>',
    '</button>',
    '</div>',

    // 앱 공유
    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-body);font-weight:800;margin-bottom:8px;">앱 공유하기</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:12px;">소중한 분들께 이 앱을 소개해주세요</div>',
    '<button class="btn-primary" onclick="shareApp()">📤 앱 공유하기</button>',
    '</div>',

    // 앱 소개 다시 보기
    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-body);font-weight:800;margin-bottom:8px;">앱 사용법 보기</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:12px;">처음 사용법이 궁금하실 때 다시 보세요</div>',
    '<button class="btn-secondary" onclick="showOnboardingAgain()">📖 앱 소개 다시 보기</button>',
    '</div>',

    // 유튜브
    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-body);font-weight:800;margin-bottom:8px;">인생2막라디오 채널</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:12px;">뇌과학 기반 심리·습관 콘텐츠를 만나보세요</div>',
    '<button class="btn-secondary" onclick="window.open(\'https://www.youtube.com/@SecondActRadio\',\'_blank\')">📺 유튜브 채널 방문</button>',
    '</div>',

    // 사연
    '<div class="card section-gap">',
    '<div style="font-size:var(--fs-body);font-weight:800;margin-bottom:8px;">사연 보내기</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:12px;">변화된 삶의 이야기를 나눠주세요</div>',
    '<button class="btn-secondary" onclick="openStoryModal()">💌 사연 보내기</button>',
    '</div>',

    '<div style="text-align:center;padding:20px 0;">',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">품속</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">life2radio.github.io/pumsok</div>',
    '</div>',

    '</div>',
  ].join('');
}

function makeSettingBtn(label, onclick, active) {
  return '<button onclick="'+onclick+'" style="flex:1;padding:10px;border-radius:8px;font-size:var(--fs-caption);font-weight:700;border:1.5px solid '+(active?'#1B4332':'var(--color-border)')+';background:'+(active?'#1B4332':'transparent')+';color:'+(active?'#fff':'var(--color-text-primary)')+';cursor:pointer;">'+label+'</button>';
}

window.shareApp = function() {
  var url='https://life2radio.github.io/pumsok';
  if(navigator.share) {
    navigator.share({title:'품속',text:'이불 속에서 시작되는 기적. 품속과 함께하세요.',url:url});
  } else if(navigator.clipboard) {
    navigator.clipboard.writeText(url);
    showToast('링크가 복사됐어요 📋');
  }
};

/* ════════════════════════════════════════
   사연 보내기 모달
   ════════════════════════════════════════ */

window.openStoryModal = function() {
  var ex=$('story-modal-overlay');
  if(ex){ex.style.display='flex';return;}
  var ov=document.createElement('div');
  ov.id='story-modal-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
  ov.innerHTML=
    '<div style="background:var(--color-surface);border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:90dvh;overflow-y:auto;padding:24px 16px 40px;">'+
    '<div style="width:36px;height:4px;background:var(--color-border);border-radius:2px;margin:0 auto 20px;"></div>'+
    '<div style="font-size:var(--fs-title);font-weight:900;margin-bottom:16px;">💌 사연 보내기</div>'+
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:16px;line-height:1.7;">변화된 삶, 이루어가는 이야기를 나눠주세요 🌿</div>'+
    '<div class="input-wrap"><label class="input-label">제목</label><input id="sm-title" class="input-field" type="text" placeholder="제목을 입력해주세요"></div>'+
    '<div class="input-wrap"><label class="input-label">이름 (선택)</label><input id="sm-name" class="input-field" type="text" placeholder="닉네임 또는 이름"></div>'+
    '<div class="input-wrap"><label class="input-label">이메일 (선택)</label><input id="sm-email" class="input-field" type="email" placeholder="답장 원하시면 입력"></div>'+
    '<div class="input-wrap"><label class="input-label">사연 내용</label><textarea id="sm-body" class="input-field" rows="5" placeholder="자유롭게 써주세요"></textarea></div>'+
    '<button class="btn-primary" style="margin-bottom:10px;" onclick="sendStoryModal()">💌 사연 보내기</button>'+
    '<button class="btn-text" onclick="closeStoryModal()">닫기</button>'+
    '</div>';
  ov.addEventListener('click',function(e){if(e.target===ov)closeStoryModal();});
  document.body.appendChild(ov);
};

window.closeStoryModal = function() {
  var ov=$('story-modal-overlay');if(ov)ov.style.display='none';
};

window.sendStoryModal = async function() {
  var title=($('sm-title')||{}).value||'';
  var name =($('sm-name') ||{}).value||'';
  var email=($('sm-email')||{}).value||'';
  var body =($('sm-body') ||{}).value||'';
  if(!title.trim()){showToast('제목을 입력해주세요');return;}
  if(!body.trim()) {showToast('사연 내용을 입력해주세요');return;}
  var emailBody = name?'[이름] '+name+'\n\n'+body:body;
  try {
    var res=await fetch('https://formspree.io/f/xqewzqqg',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({이름:name||'익명',제목:title,사연:emailBody,이메일:email})
    });
    if(res.ok){
      showToast('💌 사연이 전송됐어요! 감사해요 🌿');
      closeStoryModal();
    } else throw new Error();
  } catch(e) {
    window.location.href='mailto:life2radio@gmail.com?subject='+encodeURIComponent('[인생2막라디오 사연] '+title)+'&body='+encodeURIComponent(emailBody);
  }
};

/* ── 전역 노출 ── */
window.startSilence    = startSilence;
window.goVow           = goVow;
window.goAffirmation   = goAffirmation;
window.goMemo          = goMemo;
window.openBodyStretch = openBodyStretch;
window.markBody        = markBody;
window.setFontSize     = setFontSize;
window.toggleDarkMode  = toggleDarkMode;
window.renderRoutine   = renderRoutine;

})();
