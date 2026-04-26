/* ════════════════════════════════════════
   인생2막라디오 루틴앱 — 메인 로직
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
  switchView('routine');
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
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">인생2막라디오 루틴앱</div>',
    '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">life2radio.github.io/routine</div>',
    '</div>',

    '</div>',
  ].join('');
}

function makeSettingBtn(label, onclick, active) {
  return '<button onclick="'+onclick+'" style="flex:1;padding:10px;border-radius:8px;font-size:var(--fs-caption);font-weight:700;border:1.5px solid '+(active?'#1B4332':'var(--color-border)')+';background:'+(active?'#1B4332':'transparent')+';color:'+(active?'#fff':'var(--color-text-primary)')+';cursor:pointer;">'+label+'</button>';
}

window.shareApp = function() {
  var url='https://life2radio.github.io/routine';
  if(navigator.share) {
    navigator.share({title:'인생2막라디오 루틴앱',text:'매일 아침 나를 깨우는 루틴.',url:url});
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
