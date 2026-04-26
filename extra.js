/* ══════════════════════════════════════════════════════
   pumsok_extra.js — 아침 루틴 (5단계) + 저녁 루틴 (4단계)
   app.js 로드 완료 후 동적으로 실행됨
   ══════════════════════════════════════════════════════

   아침: 숨고르기 → 다짐 → 확언 → 아침낙서 → 침대스트레칭
   저녁: 기억노트 → 감사한줄 → 다짐확인 → 수면호흡(4-7-8)
*/

(function() {
'use strict';

// ── 스토리지 키 ────────────────────────────────────────
var RKEY = 'pumsok_routine_v2';

// ── 스토리지 유틸 (app.js의 함수 활용, 없으면 폴백) ──
function _get(k, d) {
    if (typeof safeGetItem === 'function') return safeGetItem(k, d);
    try { var v = localStorage.getItem(k); return v !== null ? v : d; } catch(e) { return d; }
}
function _set(k, v) {
    if (typeof safeSetItem === 'function') return safeSetItem(k, v);
    try { localStorage.setItem(k, v); } catch(e) {}
}
function _getJ(k, d) {
    if (typeof safeGetJSON === 'function') return safeGetJSON(k, d);
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e) { return d; }
}
function _setJ(k, v) {
    if (typeof safeSetJSON === 'function') return safeSetJSON(k, v);
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
}
function _toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
    else alert(msg);
}
function _pt(amt, reason, key) {
    if (typeof addPoint === 'function') addPoint(amt, reason, key);
}
function _today() {
    if (typeof getTodayStr === 'function') return getTodayStr();
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

// ── 루틴 레코드 ────────────────────────────────────────
function getRec() { return _getJ(RKEY, {}); }
function setRec(r) { _setJ(RKEY, r); }

function getTodayRec(slot) {
    var rec = getRec(); var td = _today();
    return (rec[td] && rec[td][slot]) || {};
}

function markStep(slot, stepKey) {
    var rec = getRec(); var td = _today();
    if (!rec[td]) rec[td] = {};
    if (!rec[td][slot]) rec[td][slot] = {};
    rec[td][slot][stepKey] = true;
    setRec(rec);
    _pt(1, '루틴_' + slot + '_' + stepKey, 'rt_' + slot + '_' + stepKey + '_' + td);
}

// ── 시간대 슬롯 ────────────────────────────────────────
function getSlot() {
    var h = new Date().getHours();
    return (h >= 5 && h < 16) ? 'morning' : 'evening';
}

/* ══════════════════════════════════════════════════════
   아침 루틴 5단계 정의
══════════════════════════════════════════════════════ */
var MORNING_STEPS = [
    {
        key: 'silence',
        icon: '🧘',
        title: '숨 고르기',
        desc: '눈을 감고 이불 속 온기를 느끼며 조용히 호흡에 집중하세요. ' +
              '들이쉬고 4초, 내쉬고 4초. 1분이면 하루가 달라져요.',
        badge: 'STEP 1',
        color: '#2D6A4F'
    },
    {
        key: 'vow',
        icon: '🎯',
        title: '나의 다짐',
        desc: '다짐 탭에서 설정한 목표를 소리내어 읽으세요. ' +
              '이루어진 장면을 머릿속에 또렷이 그려보세요. 뇌가 현실로 인식하기 시작합니다.',
        badge: 'STEP 2',
        color: '#1B4332'
    },
    {
        key: 'affirmation',
        icon: '✨',
        title: '오늘의 확언',
        desc: '오늘의 확언을 소리내어 읽어보세요. 귀로 듣고 눈으로 보면 ' +
              '기억 정착률이 높아집니다. 세 번 반복하면 더욱 효과적이에요.',
        badge: 'STEP 3',
        color: '#40916C'
    },
    {
        key: 'memo',
        icon: '✏️',
        title: '아침낙서',
        desc: '머릿속을 비우듯 자유롭게 써보세요. 걱정, 기대, 오늘 할 일, ' +
              '떠오르는 생각 무엇이든 OK. 3분 자유 기록이 하루를 맑게 합니다.',
        badge: 'STEP 4',
        color: '#52B788'
    },
    {
        key: 'stretch',
        icon: '🤸',
        title: '침대 스트레칭',
        desc: '이불 위에서 시작하는 몸 깨우기. ' +
              '양팔을 위로 쭉 뻗기 → 무릎을 가슴으로 당기기 → 목을 천천히 돌리기. ' +
              '1분이면 혈액순환이 살아납니다.',
        badge: 'STEP 5',
        color: '#74C69D'
    }
];

/* ══════════════════════════════════════════════════════
   저녁 루틴 4단계 정의
══════════════════════════════════════════════════════ */
var EVENING_STEPS = [
    {
        key: 'memory',
        icon: '🧠',
        title: '기억노트',
        desc: '오늘 가장 기억에 남는 순간 하나를 소설처럼 적어보세요. ' +
              '어디서, 누구와, 어떤 감정이었나요? 기억을 기록하면 삶이 더 풍부해집니다.',
        badge: 'STEP 1',
        color: '#1B4332'
    },
    {
        key: 'gratitude',
        icon: '💛',
        title: '감사한 줄',
        desc: '오늘 감사한 것 딱 하나만. 커피 한 잔, 따뜻한 햇살, 작은 것도 좋아요. ' +
              '매일 감사를 기록하면 뇌의 긍정 회로가 강화됩니다.',
        badge: 'STEP 2',
        color: '#C9A84C'
    },
    {
        key: 'vow_check',
        icon: '🎯',
        title: '다짐 확인',
        desc: '잠들기 전 나의 다짐을 한 번 더 소리내어 읽으세요. ' +
              '자는 동안 무의식이 목표를 처리합니다. 자기 전 마지막 생각이 내일을 만듭니다.',
        badge: 'STEP 3',
        color: '#2D6A4F'
    },
    {
        key: 'breath478',
        icon: '😴',
        title: '수면 호흡 (4-7-8)',
        desc: '4초 들이쉬기 → 7초 멈추기 → 8초 내쉬기. ' +
              '3회 반복하면 부교감신경이 활성화되어 수면이 빨라져요. ' +
              '애리조나대 앤드루 와일 박사가 개발한 검증된 호흡법입니다.',
        badge: 'STEP 4',
        color: '#0D2B1F'
    }
];

/* ══════════════════════════════════════════════════════
   메인 루틴 렌더 함수 (app.js 에서 호출)
══════════════════════════════════════════════════════ */
window.renderPumsokRoutine = function(container) {
    if (!container) return;
    var slot = getSlot();
    var isMorning = slot === 'morning';

    container.innerHTML =
        '<div class="card section-gap">' +
        '<div id="pumsok-tabs" style="display:flex;margin-bottom:14px;border-bottom:1px solid var(--color-border);">' +
        _tabBtn('morning', '🌅 아침 루틴', isMorning) +
        _tabBtn('evening', '🌙 저녁 루틴', !isMorning) +
        '</div>' +
        '<div id="pumsok-morning-panel" style="display:' + (isMorning?'block':'none') + ';"></div>' +
        '<div id="pumsok-evening-panel" style="display:' + (!isMorning?'block':'none') + ';"></div>' +
        '</div>';

    _renderMorningPanel();
    _renderEveningPanel();
};

function _tabBtn(slot, label, active) {
    return '<button onclick="pumsokTab(\'' + slot + '\')" id="pumsok-tab-' + slot + '" style="' +
        'flex:1;padding:9px 4px;border:none;background:transparent;cursor:pointer;font-size:0.82em;' +
        'font-weight:' + (active?'800':'500') + ';' +
        'color:' + (active?'var(--color-primary)':'var(--color-text-muted)') + ';' +
        'border-bottom:' + (active?'2px solid var(--color-primary)':'2px solid transparent') + ';">' +
        label + '</button>';
}

window.pumsokTab = function(slot) {
    var isMorning = slot === 'morning';
    ['morning','evening'].forEach(function(s) {
        var btn = document.getElementById('pumsok-tab-' + s);
        var panel = document.getElementById('pumsok-' + s + '-panel');
        var active = s === slot;
        if (btn) {
            btn.style.fontWeight = active ? '800' : '500';
            btn.style.color = active ? 'var(--color-primary)' : 'var(--color-text-muted)';
            btn.style.borderBottom = active ? '2px solid var(--color-primary)' : '2px solid transparent';
        }
        if (panel) panel.style.display = active ? 'block' : 'none';
    });
};

/* ── 아침 루틴 패널 ───────────────────────────────── */
function _renderMorningPanel() {
    var el = document.getElementById('pumsok-morning-panel');
    if (!el) return;
    var rec = getTodayRec('morning');
    var done = MORNING_STEPS.filter(function(s) { return rec[s.key]; }).length;
    var pct = Math.round(done / MORNING_STEPS.length * 100);

    el.innerHTML =
        _progressBar(done, MORNING_STEPS.length, pct, 'morning') +
        MORNING_STEPS.map(function(step, idx) {
            return _morningStepCard(step, idx + 1, !!rec[step.key]);
        }).join('') +
        (done === MORNING_STEPS.length ? _completeBanner('morning') : '');
}

function _morningStepCard(step, num, done) {
    var action = '';
    var sKey = step.key;

    if (sKey === 'silence') {
        action = done
            ? _doneLabel()
            : '<button onclick="pumsokSilence()" id="px-silence-btn" ' +
              'style="' + _btnStyle('var(--color-primary)') + '">▶ 1분 타이머 시작</button>' +
              '<div id="px-silence-status" style="' + _statusStyle() + '"></div>';

    } else if (sKey === 'vow') {
        action = done
            ? _doneLabel()
            : '<button onclick="pumsokGoVow(\'morning\')" style="' + _btnStyle('var(--color-primary)') + '">🎯 다짐 탭에서 읽기 → 완료</button>' +
              '<button onclick="pumsokMarkStep(\'morning\',\'vow\')" style="' + _btnStyle2() + ' margin-top:6px;">✅ 여기서 완료 체크</button>';

    } else if (sKey === 'affirmation') {
        action = done
            ? _doneLabel()
            : '<button onclick="pumsokReadAffirmation()" style="' + _btnStyle('#40916C') + '">✨ 확언 읽기 (TTS)</button>' +
              '<button onclick="pumsokMarkStep(\'morning\',\'affirmation\')" style="' + _btnStyle2() + ' margin-top:6px;">✅ 완료 체크</button>';

    } else if (sKey === 'memo') {
        action = done
            ? _doneLabel()
            : '<div>' +
              '<textarea id="px-morning-memo" style="width:100%;padding:10px;border:1.5px solid var(--color-border);border-radius:8px;' +
              'font-size:0.85em;background:var(--color-bg);color:var(--color-text-primary);resize:none;' +
              'box-sizing:border-box;" rows="3" placeholder="지금 머릿속에 떠오르는 것을 자유롭게..."></textarea>' +
              '<button onclick="pumsokSaveMorningMemo()" style="' + _btnStyle('var(--color-primary)') + ' margin-top:6px;">저장 완료 +1PT</button>' +
              '</div>';

    } else if (sKey === 'stretch') {
        action = done
            ? _doneLabel()
            : '<button onclick="pumsokMarkStep(\'morning\',\'stretch\')" style="' + _btnStyle('#52B788') + '">🤸 스트레칭 완료!</button>';
    }

    return _stepCard(step, num, done, action);
}

/* ── 저녁 루틴 패널 ───────────────────────────────── */
function _renderEveningPanel() {
    var el = document.getElementById('pumsok-evening-panel');
    if (!el) return;
    var rec = getTodayRec('evening');
    var done = EVENING_STEPS.filter(function(s) { return rec[s.key]; }).length;
    var pct = Math.round(done / EVENING_STEPS.length * 100);

    el.innerHTML =
        _progressBar(done, EVENING_STEPS.length, pct, 'evening') +
        EVENING_STEPS.map(function(step, idx) {
            return _eveningStepCard(step, idx + 1, !!rec[step.key]);
        }).join('') +
        (done === EVENING_STEPS.length ? _completeBanner('evening') : '');
}

function _eveningStepCard(step, num, done) {
    var action = '';
    var sKey = step.key;

    if (sKey === 'memory') {
        action = done
            ? _doneLabel()
            : '<div>' +
              '<textarea id="px-memory-note" style="width:100%;padding:10px;border:1.5px solid var(--color-border);border-radius:8px;' +
              'font-size:0.85em;background:var(--color-bg);color:var(--color-text-primary);resize:none;' +
              'box-sizing:border-box;" rows="3" placeholder="오늘 가장 기억에 남는 순간... (어디서, 누구와, 어떤 감정)"></textarea>' +
              '<button onclick="pumsokSaveMemory()" style="' + _btnStyle('var(--color-primary)') + ' margin-top:6px;">기억 저장 완료 +1PT</button>' +
              '</div>';

    } else if (sKey === 'gratitude') {
        action = done
            ? _doneLabel()
            : '<div style="display:flex;gap:6px;">' +
              '<input id="px-gratitude" style="flex:1;padding:10px;border:1.5px solid var(--color-border);border-radius:8px;' +
              'font-size:0.85em;background:var(--color-bg);color:var(--color-text-primary);" ' +
              'placeholder="오늘 감사한 것 하나..."/>' +
              '<button onclick="pumsokSaveGratitude()" style="padding:10px 14px;background:#C9A84C;color:#1B4332;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85em;white-space:nowrap;">저장</button>' +
              '</div>';

    } else if (sKey === 'vow_check') {
        action = done
            ? _doneLabel()
            : '<button onclick="pumsokGoVow(\'evening\')" style="' + _btnStyle('#2D6A4F') + '">🎯 다짐 탭에서 읽기 → 완료</button>' +
              '<button onclick="pumsokMarkStep(\'evening\',\'vow_check\')" style="' + _btnStyle2() + ' margin-top:6px;">✅ 여기서 완료 체크</button>';

    } else if (sKey === 'breath478') {
        action = done
            ? _doneLabel()
            : '<button onclick="pumsokBreath478()" id="px-breath-btn" style="' + _btnStyle('#0D2B1F') + '">😴 4-7-8 호흡 시작</button>' +
              '<div id="px-breath-status" style="' + _statusStyle() + '"></div>';
    }

    return _stepCard(step, num, done, action);
}

/* ── UI 헬퍼 ─────────────────────────────────────── */
function _stepCard(step, num, done, actionHTML) {
    return '<div style="border:1.5px solid ' + (done ? 'var(--color-primary)' : 'var(--color-border)') + ';' +
        'border-radius:12px;padding:14px;margin-bottom:10px;' +
        'background:' + (done ? 'var(--color-primary-soft)' : 'var(--color-surface)') + ';' +
        'transition:all 0.2s;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;' +
        'background:' + (done ? 'var(--color-primary)' : 'var(--color-bg)') + ';' +
        'border:2px solid ' + (done ? 'var(--color-primary)' : 'var(--color-border)') + ';' +
        'font-size:0.7em;font-weight:900;color:' + (done ? '#fff' : 'var(--color-text-muted)') + ';">' + num + '</div>' +
        '<span style="font-size:0.9em;font-weight:800;color:var(--color-text-primary);">' + step.icon + ' ' + step.title + '</span>' +
        '<span style="margin-left:auto;font-size:0.62em;font-weight:700;color:var(--color-accent);">' + step.badge + '</span>' +
        '</div>' +
        '<div style="font-size:0.8em;color:var(--color-text-secondary);margin-bottom:10px;line-height:1.65;">' + step.desc + '</div>' +
        actionHTML +
        '</div>';
}

function _progressBar(done, total, pct, slot) {
    return '<div style="margin-bottom:12px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
        '<span style="font-size:0.82em;font-weight:700;color:var(--color-primary);">' + done + '/' + total + ' 완료</span>' +
        '<span style="font-size:0.75em;color:var(--color-text-muted);">' + pct + '%</span>' +
        '</div>' +
        '<div style="background:var(--color-bg);border-radius:4px;height:6px;overflow:hidden;">' +
        '<div style="background:linear-gradient(90deg,' + (slot==='morning'?'#40916C,#74C69D':'#0D2B1F,#1B4332') + ');' +
        'height:100%;width:' + pct + '%;border-radius:4px;transition:width 0.5s;"></div>' +
        '</div></div>';
}

function _completeBanner(slot) {
    var isMorning = slot === 'morning';
    return '<div style="border-radius:12px;padding:16px;text-align:center;margin-top:6px;' +
        'background:' + (isMorning ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : 'linear-gradient(135deg,#0D2B1F,#1B4332)') + ';">' +
        '<div style="font-size:1.8em;margin-bottom:4px;">' + (isMorning?'🎉':'🌙') + '</div>' +
        '<div style="font-size:0.9em;font-weight:900;color:' + (isMorning?'#1B4332':'#C9A84C') + ';">' +
        (isMorning ? '아침 루틴 완료! 이불 속에서 기적이 시작됐어요 🌿' : '저녁 루틴 완료! 편안한 밤 되세요 🌙') +
        '</div></div>';
}

function _doneLabel() {
    return '<div style="text-align:center;font-size:0.85em;font-weight:700;color:var(--color-primary);' +
        'padding:6px;background:var(--color-primary-soft);border-radius:8px;">✅ 오늘 완료!</div>';
}

function _btnStyle(bg) {
    return 'width:100%;padding:12px;background:' + bg + ';color:#fff;border:none;border-radius:10px;' +
        'font-size:0.9em;font-weight:700;cursor:pointer;';
}
function _btnStyle2() {
    return 'width:100%;padding:10px;background:transparent;color:var(--color-primary);' +
        'border:1.5px solid var(--color-primary);border-radius:10px;font-size:0.85em;font-weight:700;cursor:pointer;';
}
function _statusStyle() {
    return 'font-size:0.75em;color:var(--color-text-muted);text-align:center;margin-top:5px;min-height:14px;';
}

function _refreshPanel(slot) {
    if (slot === 'morning') _renderMorningPanel();
    else _renderEveningPanel();
}

/* ══════════════════════════════════════════════════════
   액션 핸들러
══════════════════════════════════════════════════════ */

// 공통 마킹
window.pumsokMarkStep = function(slot, stepKey) {
    markStep(slot, stepKey);
    _toast('✅ 완료!');
    _refreshPanel(slot);
    // 루틴 탭 전체도 갱신 (완료 배너 등)
    if (typeof window.renderPumsokRoutine === 'function') {
        var area = document.getElementById('pumsok-routine-area');
        if (area) window.renderPumsokRoutine(area);
    }
};

/* ── 숨 고르기: 1분 타이머 ──────────────────────── */
var _silTimer = null, _silSec = 60;

window.pumsokSilence = function() {
    if (_silTimer) {
        clearInterval(_silTimer);
        _silTimer = null;
        _silSec = 60;
        var btn = document.getElementById('px-silence-btn');
        if (btn) btn.textContent = '▶ 1분 타이머 시작';
        return;
    }
    _silSec = 60;
    _silTimer = setInterval(function() {
        _silSec--;
        var btn = document.getElementById('px-silence-btn');
        var status = document.getElementById('px-silence-status');
        if (btn) btn.textContent = '⏹ ' + _silSec + '초 (탭하면 중지)';
        if (status) {
            var msg = _silSec > 40 ? '🧘 코로 천천히 들이쉬세요...' :
                      _silSec > 20 ? '🌿 온몸의 긴장을 내려놓으세요...' :
                                     '✨ 거의 다 왔어요, 이 평화를 느껴보세요...';
            status.textContent = msg;
        }
        if (_silSec <= 0) {
            clearInterval(_silTimer); _silTimer = null; _silSec = 60;
            markStep('morning', 'silence');
            _toast('🧘 1분 완료! 마음이 고요해졌나요?');
            _refreshPanel('morning');
        }
    }, 1000);
    _toast('🧘 숨을 깊게 쉬며 집중하세요...');
};

/* ── 다짐 읽기 이동 ──────────────────────────────── */
window.pumsokGoVow = function(slot) {
    if (typeof switchView === 'function') switchView('vow');
    // 탭으로 이동하면서 완료로 표시
    setTimeout(function() {
        markStep(slot, slot === 'morning' ? 'vow' : 'vow_check');
        _toast('🎯 다짐 탭으로 이동! 소리내어 읽어보세요.');
    }, 300);
};

/* ── 확언 TTS 읽기 ───────────────────────────────── */
window.pumsokReadAffirmation = function() {
    if (!window.speechSynthesis) {
        _toast('음성을 지원하지 않는 기기예요');
        return;
    }
    var dc = typeof getDayCount === 'function' ? getDayCount() : 1;
    var data = null;
    if (typeof affirmationsData !== 'undefined' && affirmationsData.length) {
        data = affirmationsData[(dc - 1) % affirmationsData.length];
    }
    if (!data) { _toast('확언 데이터를 불러올 수 없어요'); return; }

    window.speechSynthesis.cancel();
    var utt = new SpeechSynthesisUtterance(data.text);
    utt.lang = 'ko-KR'; utt.rate = 0.85;
    utt.onend = function() {
        markStep('morning', 'affirmation');
        _toast('✨ 확언 완료! 깊이 새겨졌을 거예요');
        _refreshPanel('morning');
    };
    window.speechSynthesis.speak(utt);
    _toast('🔊 확언을 소리내어 따라 읽어보세요!');
};

/* ── 아침 낙서 저장 ──────────────────────────────── */
window.pumsokSaveMorningMemo = function() {
    var inp = document.getElementById('px-morning-memo');
    var text = inp ? inp.value.trim() : '';
    if (!text) { _toast('내용을 입력해주세요'); return; }

    // 메모 목록에도 저장
    if (typeof safeGetJSON === 'function') {
        var memos = safeGetJSON('free_notes', []);
        var today = _today();
        memos.unshift({ id: Date.now(), title: '🌅 아침낙서 ' + today, body: text, date: today });
        if (typeof safeSetJSON === 'function') safeSetJSON('free_notes', memos);
    }

    markStep('morning', 'memo');
    _toast('✏️ 아침낙서 저장! +1PT');
    _refreshPanel('morning');
};

/* ── 기억노트 저장 ───────────────────────────────── */
window.pumsokSaveMemory = function() {
    var inp = document.getElementById('px-memory-note');
    var text = inp ? inp.value.trim() : '';
    if (!text) { _toast('기억을 입력해주세요'); return; }

    // 일기로 저장
    var today = _today();
    var existing = _get('diary_' + today, '');
    var newText = existing ? (existing + '\n\n[기억노트]\n' + text) : ('[기억노트]\n' + text);
    _set('diary_' + today, newText);

    markStep('evening', 'memory');
    _toast('🧠 기억이 저장됐어요! +1PT');
    _refreshPanel('evening');
};

/* ── 감사 저장 ───────────────────────────────────── */
window.pumsokSaveGratitude = function() {
    var inp = document.getElementById('px-gratitude');
    var text = inp ? inp.value.trim() : '';
    if (!text) { _toast('감사한 내용을 입력해주세요'); return; }

    // 감사 목록 저장
    var gratitudes = JSON.parse(localStorage.getItem('pumsok_gratitudes') || '[]');
    gratitudes.unshift({ date: _today(), text: text });
    localStorage.setItem('pumsok_gratitudes', JSON.stringify(gratitudes.slice(0, 365)));

    markStep('evening', 'gratitude');
    _toast('💛 감사가 기록됐어요! +1PT');
    _refreshPanel('evening');
};

/* ── 4-7-8 수면 호흡 타이머 ─────────────────────── */
var _breathTimer = null;
var _breathPhases = [
    { label: '🌬 들이쉬기', dur: 4 },
    { label: '😶 멈추기',   dur: 7 },
    { label: '💨 내쉬기',   dur: 8 }
];
var _breathRound = 0, _breathPhaseIdx = 0, _breathPhaseSec = 0;
var BREATH_TOTAL_ROUNDS = 3;

window.pumsokBreath478 = function() {
    if (_breathTimer) {
        clearInterval(_breathTimer);
        _breathTimer = null;
        _breathRound = 0; _breathPhaseIdx = 0; _breathPhaseSec = 0;
        var btn = document.getElementById('px-breath-btn');
        if (btn) btn.textContent = '😴 4-7-8 호흡 시작';
        var st = document.getElementById('px-breath-status');
        if (st) st.textContent = '';
        return;
    }

    _breathRound = 0; _breathPhaseIdx = 0; _breathPhaseSec = 0;
    _toast('😴 코로 들이쉬고... 따라해보세요');

    _breathTimer = setInterval(function() {
        var ph = _breathPhases[_breathPhaseIdx];
        var remaining = ph.dur - _breathPhaseSec;
        var btn = document.getElementById('px-breath-btn');
        var st = document.getElementById('px-breath-status');

        if (btn) btn.textContent = ph.label + ' (' + remaining + '초)';
        if (st) st.textContent = '라운드 ' + (_breathRound + 1) + ' / ' + BREATH_TOTAL_ROUNDS;

        _breathPhaseSec++;
        if (_breathPhaseSec >= ph.dur) {
            _breathPhaseSec = 0;
            _breathPhaseIdx++;
            if (_breathPhaseIdx >= _breathPhases.length) {
                _breathPhaseIdx = 0;
                _breathRound++;
                if (_breathRound >= BREATH_TOTAL_ROUNDS) {
                    clearInterval(_breathTimer); _breathTimer = null;
                    markStep('evening', 'breath478');
                    _toast('🌙 수면 호흡 완료! 편안한 밤 되세요 ✨');
                    _refreshPanel('evening');
                }
            }
        }
    }, 1000);
};

/* ══════════════════════════════════════════════════════
   초기화 함수 (app.js에서 호출)
══════════════════════════════════════════════════════ */
window.initPumsokExtra = function() {
    // 오늘의 루틴 뷰 갱신 (이미 view-routine 이 열려있다면)
    var area = document.getElementById('pumsok-routine-area');
    if (area && typeof window.renderPumsokRoutine === 'function') {
        window.renderPumsokRoutine(area);
    }
    console.log('[pumsok_extra] 아침/저녁 루틴 초기화 완료 ✅');
};

})(); // IIFE 끝
