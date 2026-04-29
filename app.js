/* ══════════════════════════════════════════════════════
   품속 — app.js  (new index.html 호환 버전)
   index.html 절대 수정 없이 동작
   pumsok_extra.js 를 동적으로 로드
   ══════════════════════════════════════════════════════ */

// ── 인메모리 캐시 (localStorage 보완) ──────────────────
const _c = {}, _jc = {};

function safeGetItem(k, d) {
    if (d === undefined) d = '';
    if (k in _c) return _c[k];
    try { const v = localStorage.getItem(k); if (v !== null) { _c[k] = v; return v; } } catch(e) {}
    return d;
}
function safeSetItem(k, v) {
    _c[k] = v;
    try { localStorage.setItem(k, v); } catch(e) {}
}
function safeGetJSON(k, d) {
    if (d === undefined) d = [];
    if (k in _jc) return _jc[k];
    try { const v = localStorage.getItem(k); if (v) { const p = JSON.parse(v); _jc[k] = p; return p; } } catch(e) {}
    return d;
}
function safeSetJSON(k, v) {
    _jc[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
}

// ── 날짜 유틸 ──────────────────────────────────────────
const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0);

function getFormatDate(d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function getTodayStr() { return getFormatDate(todayObj); }
function getDayCount() {
    const start = new Date(todayObj.getFullYear(), 0, 1);
    return Math.floor((todayObj - start) / 86400000) + 1;
}

// ── 토스트 ─────────────────────────────────────────────
let _toastTimer;
window.showToast = function(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => t.classList.remove('show'), 1900);
};

// ── 포인트 시스템 ──────────────────────────────────────
window.getPoints = function() { return parseInt(safeGetItem('user_points', '0')) || 0; };
window.setPoints = function(p) { safeSetItem('user_points', String(Math.max(0, p))); };
window.addPoint = function(amt, reason, dailyKey) {
    if (dailyKey) {
        const k = 'pt_daily_' + dailyKey + '_' + getTodayStr();
        if (safeGetItem(k) === '1') return;
        safeSetItem(k, '1');
    }
    setPoints(getPoints() + amt);
    _ptAnim(amt);
};
function _ptAnim(amt) {
    const el = document.createElement('div');
    el.textContent = '+' + amt + 'PT';
    el.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);' +
        'background:#C9A84C;color:#fff;padding:8px 18px;border-radius:20px;font-weight:700;' +
        'z-index:9999;pointer-events:none;font-size:14px;animation:_ptF 1.4s ease forwards;';
    if (!document.getElementById('_ptStyle')) {
        const s = document.createElement('style');
        s.id = '_ptStyle';
        s.textContent = '@keyframes _ptF{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-44px)}}';
        document.head.appendChild(s);
    }
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

// ── 뷰 전환 ───────────────────────────────────────────
let _curView = 'routine';
const _titles = {
    routine: '품속', vow: '나의 다짐', affirmation: '365 확언',
    memo: '메모장', test: '오늘의 실천', settings: '설정'
};

window.switchView = function(name) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const vEl = document.getElementById('view-' + name);
    const nEl = document.querySelector('.nav-btn[data-view="' + name + '"]');
    if (vEl) vEl.classList.add('active');
    if (nEl) nEl.classList.add('active');
    _curView = name;

    const ht = document.getElementById('header-title');
    if (ht) ht.textContent = _titles[name] || '품속';

    _renderView(name);
};

function _renderView(name) {
    switch (name) {
        case 'routine':      _renderRoutine(); break;
        case 'vow':          _renderVow(); break;
        case 'affirmation':  _renderAffirmation(); break;
        case 'memo':         _renderMemo(); break;
        case 'test':         _renderTest(); break;
        case 'settings':     _renderSettings(); break;
    }
}

/* ══════════════════════════════════
   루틴 뷰 (홈)
══════════════════════════════════ */
function _renderRoutine() {
    const el = document.getElementById('view-routine');
    if (!el) return;

    const dc = getDayCount();
    const nick = safeGetItem('my_nickname', '');
    const greet = nick ? nick + '님, 오늘도 화이팅!' : '오늘도 화이팅!';

    el.innerHTML =
        '<div class="view-inner">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<span style="font-size:var(--fs-body);font-weight:700;color:var(--color-primary);">' + greet + '</span>' +
        '<span style="background:var(--color-primary);color:#fff;border-radius:20px;padding:4px 12px;font-size:var(--fs-caption);font-weight:700;">Day ' + dc + '</span>' +
        '</div>' +
        '<div id="pumsok-routine-area"></div>' +
        '</div>';

    if (typeof window.renderPumsokRoutine === 'function') {
        window.renderPumsokRoutine(document.getElementById('pumsok-routine-area'));
    }
}

window.selectMood = function(idx) {
    safeSetItem('mood_before_' + getTodayStr(), String(idx));
    addPoint(1, '기분체크', 'mood_' + getTodayStr());
    showToast('기분이 기록됐어요!');
    _renderRoutine();
};

window.completeToday = function() {
    const today = getTodayStr();
    const dates = safeGetJSON('completed_dates', []);
    if (!dates.includes(today)) {
        dates.push(today);
        safeSetJSON('completed_dates', dates);
        addPoint(1, '확언완료', 'complete_' + today);
        showToast('🌿 오늘 확언 완료! 내일도 함께해요');
        _renderRoutine();
        _renderTest(); // 실천 탭 갱신
    }
};

window.playAffirmTTS = function() {
    if (!window.speechSynthesis) { showToast('이 브라우저는 음성을 지원하지 않아요'); return; }
    const dc = getDayCount();
    const data = (typeof affirmationsData !== 'undefined')
        ? affirmationsData[(dc - 1) % affirmationsData.length] : null;
    if (!data) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(data.text);
    utt.lang = 'ko-KR'; utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
    addPoint(1, '소리듣기', 'listen_' + getTodayStr());
    showToast('🔊 재생 중...');
};

/* ══════════════════════════════════
   다짐 뷰 (Vow)
══════════════════════════════════ */
function _renderVow() {
    const el = document.getElementById('view-vow');
    if (!el) return;

    el.innerHTML = '<div class="view-inner">' +
    '<div class="section-title" style="margin-bottom:6px;">나의 다짐 🎯</div>' +
    '<p class="caption-text section-gap" style="line-height:1.7;">' +
    '목표를 소리내어 선언하면 뇌의 망상활성계(RAS)가 활성화되어, 목표를 향한 기회를 자동으로 포착합니다. 매일 읽으세요.</p>' +
    '<div id="vow-content-area"></div>' +
    '</div>';

    _renderVowContent();
}

function _renderVowContent() {
    const el = document.getElementById('vow-content-area');
    if (!el) return;
    const vow = safeGetJSON('pumsok_vow_v2', null);
    if (!vow || !vow.confirmed) {
        el.innerHTML = _vowSetupHTML();
    } else {
        el.innerHTML = _vowMainHTML(vow);
    }
}

function _vowSetupHTML() {
    return '<div class="card section-gap">' +
    '<div style="font-size:0.9em;font-weight:800;color:var(--color-primary);margin-bottom:14px;">✍️ 나의 다짐 만들기</div>' +
    '<div class="input-wrap"><label class="input-label">이름 또는 닉네임</label>' +
    '<input id="v-name" class="input-field" placeholder="예: 드림, 영희" maxlength="10"></div>' +
    '<div class="input-wrap"><label class="input-label">목표</label>' +
    '<input id="v-amount" class="input-field" placeholder="예: 1억원 달성, 출판 계약"></div>' +
    '<div class="input-wrap"><label class="input-label">목표 날짜</label>' +
    '<input id="v-date" type="date" class="input-field"></div>' +
    '<div class="input-wrap"><label class="input-label">내가 줄 가치 (어떤 방법으로?)</label>' +
    '<textarea id="v-value" class="input-field" rows="2" placeholder="예: 유튜브, 책, 강의를 통해 가치를 전달합니다"></textarea></div>' +
    '<div class="input-wrap"><label class="input-label">하루 수행 횟수</label>' +
    '<div style="display:flex;gap:8px;">' +
    '<button id="vcnt1" onclick="selVowCnt(1)" class="btn-primary" style="flex:1;padding:11px;font-size:0.88em;">☀️ 1회</button>' +
    '<button id="vcnt2" onclick="selVowCnt(2)" class="btn-secondary" style="flex:1;padding:11px;font-size:0.88em;">☀️🌙 2회</button>' +
    '</div></div>' +
    '<button onclick="genVow()" class="btn-accent">✨ 나의 다짐 문장 만들기</button>' +
    '</div>' +
    '<div id="vow-sentence-area" style="display:none;"></div>';
}

window.selVowCnt = function(n) {
    safeSetItem('vow_count', String(n));
    const b1 = document.getElementById('vcnt1');
    const b2 = document.getElementById('vcnt2');
    if (b1) { b1.className = n === 1 ? 'btn-primary' : 'btn-secondary'; b1.style.flex='1'; b1.style.padding='11px'; b1.style.fontSize='0.88em'; }
    if (b2) { b2.className = n === 2 ? 'btn-primary' : 'btn-secondary'; b2.style.flex='1'; b2.style.padding='11px'; b2.style.fontSize='0.88em'; }
};

window.genVow = function() {
    const name   = (document.getElementById('v-name')  || {}).value.trim();
    const amount = (document.getElementById('v-amount') || {}).value.trim();
    const date   = (document.getElementById('v-date')   || {}).value;
    const value  = (document.getElementById('v-value')  || {}).value.trim();
    if (!name || !amount || !date || !value) { showToast('모든 항목을 입력해주세요 🙏'); return; }

    const d = new Date(date);
    const ds = d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    const S = [
        ds + ', 나 ' + name + '은(는) ' + amount + '을(를) 이뤄낸 사람이다.\n나는 ' + value + '.',
        ds + '까지 나 ' + name + '은 ' + amount + '을(를) 손에 쥔다.\n그 대가로, ' + value + '.',
        name + '. ' + amount + '. ' + ds + '.\n' + value + '. 나는 이미 그 길 위에 있다.'
    ];
    const labels = ['A. 정체성 선언형', 'B. 직설적 단언형', 'C. 짧고 강한형'];

    const area = document.getElementById('vow-sentence-area');
    if (!area) return;
    area.style.display = 'block';
    area.innerHTML = '<div class="card section-gap">' +
    '<div style="font-size:0.9em;font-weight:800;color:var(--color-primary);margin-bottom:12px;">📝 다짐 문장을 선택하세요</div>' +
    S.map(function(s, i) {
        return '<div onclick="selVowSent(' + i + ',\'' + name + '\',\'' + amount + '\',\'' + date + '\',\'' + encodeURIComponent(value) + '\')" id="vs' + i + '" ' +
            'style="border:2px solid ' + (i===0?'var(--color-primary)':'var(--color-border)') + ';border-radius:12px;padding:14px;margin-bottom:8px;cursor:pointer;' +
            'background:' + (i===0?'var(--color-primary-soft)':'var(--color-surface)') + ';">' +
            '<div style="font-size:0.72em;font-weight:700;color:var(--color-accent);margin-bottom:4px;">' + labels[i] + '</div>' +
            '<div style="font-size:0.85em;line-height:1.75;white-space:pre-line;">' + s + '</div>' +
            '</div>';
    }).join('') +
    '<div class="input-wrap" style="margin-top:12px;"><label class="input-label">직접 수정 가능해요</label>' +
    '<textarea id="v-custom" class="input-field" rows="5">' + S[0] + '</textarea></div>' +
    '<button onclick="confVow(\'' + name + '\',\'' + amount + '\',\'' + date + '\',\'' + encodeURIComponent(value) + '\')" class="btn-accent">🎯 이 다짐으로 시작하기!</button>' +
    '</div>';
    area.scrollIntoView({ behavior: 'smooth' });
};

window.selVowSent = function(i, name, amount, date, encValue) {
    [0,1,2].forEach(function(j) {
        const c = document.getElementById('vs' + j);
        if (!c) return;
        c.style.border = j===i ? '2px solid var(--color-primary)' : '2px solid var(--color-border)';
        c.style.background = j===i ? 'var(--color-primary-soft)' : 'var(--color-surface)';
    });
    const value = decodeURIComponent(encValue);
    const d = new Date(date);
    const ds = d.getFullYear() + '년 ' + (d.getMonth()+1) + '월 ' + d.getDate() + '일';
    const S = [
        ds + ', 나 ' + name + '은(는) ' + amount + '을(를) 이뤄낸 사람이다.\n나는 ' + value + '.',
        ds + '까지 나 ' + name + '은 ' + amount + '을(를) 손에 쥔다.\n그 대가로, ' + value + '.',
        name + '. ' + amount + '. ' + ds + '.\n' + value + '. 나는 이미 그 길 위에 있다.'
    ];
    const ta = document.getElementById('v-custom');
    if (ta) ta.value = S[i];
};

window.confVow = function(name, amount, date, encValue) {
    const text = (document.getElementById('v-custom') || {}).value.trim();
    if (!text) { showToast('다짐 문장을 확인해주세요'); return; }
    const cnt = parseInt(safeGetItem('vow_count', '1'));
    const vow = {
        name, amount, date, value: decodeURIComponent(encValue),
        count: cnt, text, confirmed: true,
        checks: {}, createdAt: getTodayStr()
    };
    safeSetJSON('pumsok_vow_v2', vow);
    showToast('🎯 다짐이 시작됐어요! 매일 읽어보세요');
    _renderVowContent();
};

function _vowMainHTML(vow) {
    const today = getTodayStr();
    const checks = vow.checks || {};
    const rec = checks[today] || { morning: false, evening: false };
    const maxCnt = vow.count || 1;

    const d = new Date(vow.date); d.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d - todayObj) / 86400000);
    const ddTxt = diff > 0 ? 'D-' + diff : diff === 0 ? 'D-DAY' : 'D+' + Math.abs(diff);

    const dot = function(done, ico, label) {
        return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 18px;' +
            'border-radius:10px;background:' + (done?'#1B4332':'var(--color-bg)') + ';' +
            'border:1.5px solid ' + (done?'#1B4332':'var(--color-border)') + ';">' +
            '<span style="font-size:1.3em;">' + ico + '</span>' +
            '<span style="font-size:0.65em;font-weight:700;color:' + (done?'#fff':'var(--color-text-muted)') + ';">' + (done?'✅ 완료':'미완료') + '</span>' +
            '<span style="font-size:0.65em;color:' + (done?'rgba(255,255,255,0.7)':'var(--color-text-muted)') + ';">' + label + '</span>' +
            '</div>';
    };

    let calHTML = _vowCalendar(vow);

    return '<div class="green-card section-gap" style="text-align:center;">' +
    '<div style="font-size:3.5em;font-weight:900;color:#C9A84C;">' + ddTxt + '</div>' +
    '<div style="font-size:0.78em;color:rgba(255,255,255,0.7);margin-top:2px;">' + vow.date + ' 까지</div>' +
    '</div>' +

    '<div class="card section-gap" style="border:1.5px solid var(--color-accent);">' +
    '<div style="font-size:0.72em;font-weight:700;color:var(--color-accent);margin-bottom:8px;">🎯 나의 다짐</div>' +
    '<div style="font-size:0.95em;font-weight:700;line-height:1.85;white-space:pre-line;">' + vow.text + '</div>' +
    '</div>' +

    '<div class="card section-gap">' +
    '<button onclick="vowTTS()" class="btn-primary" style="margin-bottom:8px;">🔊 소리내어 읽기 (따라 읽으세요)</button>' +
    '<button onclick="markVow()" class="btn-secondary">✅ 오늘 수행 체크</button>' +
    '</div>' +

    '<div class="card section-gap">' +
    '<div style="font-size:0.78em;font-weight:700;color:var(--color-text-secondary);margin-bottom:10px;">오늘 수행 현황</div>' +
    '<div style="display:flex;gap:10px;justify-content:center;">' +
    (maxCnt >= 1 ? dot(rec.morning, '☀️', '아침') : '') +
    (maxCnt >= 2 ? dot(rec.evening, '🌙', '저녁') : '') +
    '</div></div>' +

    calHTML +

    '<div style="text-align:center;padding:16px 0 60px;">' +
    '<button onclick="resetVow()" style="background:none;border:none;font-size:0.8em;color:var(--color-text-muted);cursor:pointer;text-decoration:underline;">다짐 초기화하고 새로 시작하기</button>' +
    '</div>';
}

function _vowCalendar(vow) {
    const checks = vow.checks || {};
    const start = new Date(vow.createdAt || getTodayStr()); start.setHours(0,0,0,0);
    const maxCnt = vow.count || 1;
    const days = [];
    const cur = new Date(start);
    while (cur <= todayObj && days.length < 90) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    if (!days.length) return '';

    const firstDow = days[0].getDay();
    const dayNames = ['일','월','화','수','목','금','토'];
    let html = '<div class="card section-gap"><div style="font-size:0.78em;font-weight:700;color:var(--color-text-secondary);margin-bottom:10px;">📅 수행 기록</div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;">' +
        dayNames.map(d => '<div style="font-size:0.62em;color:var(--color-text-muted);padding-bottom:3px;">' + d + '</div>').join('') +
        '<div></div>'.repeat(firstDow);

    days.forEach(function(d) {
        const key = getFormatDate(d);
        const r = checks[key] || { morning: false, evening: false };
        const cnt = (r.morning ? 1 : 0) + (r.evening ? 1 : 0);
        const full = cnt >= maxCnt;
        const isToday = key === getTodayStr();
        const bg = full ? '#1B4332' : cnt > 0 ? '#A8D5BA' : 'var(--color-bg)';
        const col = full ? '#fff' : cnt > 0 ? '#1B4332' : 'var(--color-text-muted)';
        const border = isToday ? '2px solid #C9A84C' : '2px solid transparent';
        html += '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;' +
            'background:' + bg + ';color:' + col + ';font-size:0.68em;font-weight:' + (full||isToday?'700':'400') + ';border:' + border + ';">' + d.getDate() + '</div>';
    });

    html += '</div></div>';
    return html;
}

window.vowTTS = function() {
    const vow = safeGetJSON('pumsok_vow_v2', null);
    if (!vow) { showToast('먼저 다짐을 설정해주세요'); return; }
    if (!window.speechSynthesis) { showToast('음성을 지원하지 않는 기기예요'); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(vow.text.replace(/\n/g, ' '));
    utt.lang = 'ko-KR'; utt.rate = 0.85;
    utt.onend = function() { window.markVow(); };
    window.speechSynthesis.speak(utt);
    showToast('🔊 함께 소리내어 읽어보세요!');
};

window.markVow = function() {
    const vow = safeGetJSON('pumsok_vow_v2', null);
    if (!vow) return;
    const today = getTodayStr();
    vow.checks = vow.checks || {};
    let rec = vow.checks[today] || { morning: false, evening: false };
    const h = new Date().getHours();
    const slot = (h >= 5 && h < 16) ? 'morning' : 'evening';
    const maxCnt = vow.count || 1;
    if (maxCnt === 1) rec.morning = true;
    else rec[slot] = true;
    vow.checks[today] = rec;
    safeSetJSON('pumsok_vow_v2', vow);
    addPoint(5, '다짐수행', 'vow_' + today + '_' + slot);
    showToast(slot === 'morning' ? '☀️ 아침 다짐 완료!' : '🌙 저녁 다짐 완료!');
    _renderVowContent();
};

window.resetVow = function() {
    if (!confirm('다짐을 초기화할까요? 기록이 모두 삭제돼요.')) return;
    safeSetJSON('pumsok_vow_v2', null);
    _renderVowContent();
};

/* ══════════════════════════════════
   확언 뷰
══════════════════════════════════ */
function _renderAffirmation() {
    const el = document.getElementById('view-affirmation');
    if (!el) return;

    const dc = getDayCount();
    const data = (typeof affirmationsData !== 'undefined')
        ? affirmationsData[(dc - 1) % affirmationsData.length]
        : { theme: '확언', text: '나는 오늘도 최선을 다한다.', action: '한 가지 작은 도전을 해보세요.' };

    const favs = safeGetJSON('favorites', []);
    const isFav = favs.includes(dc);

    el.innerHTML = '<div class="view-inner">' +

    // 오늘의 확언
    '<div class="green-card section-gap">' +
    '<div style="font-size:0.72em;color:rgba(255,255,255,0.7);margin-bottom:4px;">Day ' + dc + ' · "' + data.theme + '"</div>' +
    '<div style="font-size:1.05em;font-weight:700;color:#fff;line-height:1.8;margin-bottom:12px;">' + data.text + '</div>' +
    '<div style="font-size:0.82em;color:rgba(255,255,255,0.85);background:rgba(255,255,255,0.1);' +
        'padding:12px;border-radius:10px;line-height:1.7;">' + data.action + '</div>' +
    '</div>' +

    // 버튼 행
    '<div style="display:flex;gap:8px;margin-bottom:16px;">' +
    '<button onclick="toggleFav(' + dc + ')" class="' + (isFav?'btn-accent':'btn-secondary') + '" style="flex:1;font-size:0.88em;">' +
        (isFav ? '★ 저장됨' : '☆ 즐겨찾기') + '</button>' +
    '<button onclick="playAffirmTTS()" class="btn-secondary" style="flex:1;font-size:0.88em;">🔊 소리 듣기</button>' +
    '</div>' +

    // 즐겨찾기 목록
    '<div class="section-title" style="margin-bottom:12px;">즐겨찾기 확언 ⭐</div>' +
    '<div id="fav-list-area">' + _favListHTML() + '</div>' +
    '</div>';
}

function _favListHTML() {
    const favs = safeGetJSON('favorites', []);
    if (!favs.length) return '<div class="empty-state">아직 즐겨찾기한 확언이 없어요<br>확언에서 ☆를 눌러 저장해보세요</div>';

    return favs.slice().reverse().map(function(dc) {
        if (typeof affirmationsData === 'undefined') return '';
        const d = affirmationsData[(dc - 1) % affirmationsData.length];
        if (!d) return '';
        return '<div class="card section-gap">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
            '<div style="flex:1;">' +
            '<div style="font-size:0.72em;color:var(--color-accent);font-weight:700;margin-bottom:3px;">Day ' + dc + ' · ' + d.theme + '</div>' +
            '<div class="caption-text" style="line-height:1.6;">' + (d.text.length > 60 ? d.text.slice(0,60)+'…' : d.text) + '</div>' +
            '</div>' +
            '<button onclick="removeFav(' + dc + ')" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.8em;padding:4px;flex-shrink:0;">삭제</button>' +
            '</div></div>';
    }).join('');
}

window.toggleFav = function(dc) {
    const favs = safeGetJSON('favorites', []);
    const idx = favs.indexOf(dc);
    if (idx === -1) { favs.push(dc); showToast('즐겨찾기에 추가됐어요!'); }
    else { favs.splice(idx, 1); showToast('즐겨찾기에서 제거됐어요'); }
    safeSetJSON('favorites', favs);
    _renderAffirmation();
};

window.removeFav = function(dc) {
    const favs = safeGetJSON('favorites', []);
    const idx = favs.indexOf(dc);
    if (idx !== -1) { favs.splice(idx, 1); safeSetJSON('favorites', favs); }
    const el = document.getElementById('fav-list-area');
    if (el) el.innerHTML = _favListHTML();
};

/* ══════════════════════════════════
   메모 뷰
══════════════════════════════════ */
let _memoTabInited = false;

function _renderMemo() {
    const el = document.getElementById('view-memo');
    if (!el) return;
    if (_memoTabInited) { return; } // 이미 렌더됨
    _memoTabInited = true;

    const dc = getDayCount();
    const data = (typeof affirmationsData !== 'undefined')
        ? affirmationsData[(dc - 1) % affirmationsData.length]
        : { text: '오늘의 확언을 필사해보세요.' };

    el.innerHTML = '<div class="view-inner">' +
    // 탭
    '<div style="display:flex;gap:6px;margin-bottom:16px;">' +
    '<button onclick="switchMemoTab(\'write\')" id="mt-write" class="btn-primary" style="flex:1;padding:10px;font-size:0.82em;">✏️ 필사</button>' +
    '<button onclick="switchMemoTab(\'free\')"  id="mt-free"  class="btn-secondary" style="flex:1;padding:10px;font-size:0.82em;">📌 메모</button>' +
    '<button onclick="switchMemoTab(\'diary\')" id="mt-diary" class="btn-secondary" style="flex:1;padding:10px;font-size:0.82em;">📔 일기</button>' +
    '</div>' +

    // 필사 탭
    '<div id="mt-content-write">' +
    '<div class="card section-gap">' +
    '<div style="font-size:0.72em;color:var(--color-accent);font-weight:700;margin-bottom:6px;">오늘의 확언 (필사해보세요)</div>' +
    '<div id="memo-aff-ref" class="caption-text" style="font-style:italic;margin-bottom:10px;line-height:1.6;">"' + data.text + '"</div>' +
    '<textarea id="memo-input" class="input-field" rows="5" placeholder="확언을 따라 손으로 쓰듯 입력해보세요..."></textarea>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">' +
    '<span id="memo-char-cnt" class="caption-text">0자</span>' +
    '<button onclick="saveMemo()" class="btn-primary" style="width:auto;padding:10px 20px;">저장 +1PT</button>' +
    '</div></div>' +
    '<div id="memo-list-area"></div>' +
    '</div>' +

    // 메모 탭
    '<div id="mt-content-free" style="display:none;">' +
    '<div class="card section-gap">' +
    '<input id="free-title-inp" class="input-field" placeholder="제목" style="margin-bottom:8px;">' +
    '<textarea id="free-body-inp" class="input-field" rows="5" placeholder="자유롭게 기록해보세요..."></textarea>' +
    '<div style="text-align:right;margin-top:8px;">' +
    '<button onclick="saveFreeNote()" class="btn-primary" style="width:auto;padding:10px 20px;">저장</button>' +
    '</div></div>' +
    '<div id="free-list-area"></div>' +
    '</div>' +

    // 일기 탭
    '<div id="mt-content-diary" style="display:none;">' +
    '<div class="card section-gap">' +
    '<div style="font-size:0.78em;font-weight:700;color:var(--color-text-secondary);margin-bottom:8px;">' +
    '📅 ' + new Date().getFullYear() + '년 ' + (new Date().getMonth()+1) + '월 ' + new Date().getDate() + '일 일기</div>' +
    '<textarea id="diary-inp" class="input-field" rows="7" placeholder="오늘 하루를 기록해보세요..."></textarea>' +
    '<div style="text-align:right;margin-top:8px;">' +
    '<button onclick="saveDiaryEntry()" class="btn-primary" style="width:auto;padding:10px 20px;">저장 +1PT</button>' +
    '</div></div>' +
    '</div>' +
    '</div>';

    // 이벤트
    const memoInput = document.getElementById('memo-input');
    if (memoInput) {
        memoInput.addEventListener('input', function() {
            const cc = document.getElementById('memo-char-cnt');
            if (cc) cc.textContent = this.value.length + '자';
        });
        // 붙여넣기 차단
        memoInput.addEventListener('paste', function(e) {
            e.preventDefault();
            showToast('필사는 직접 타이핑해야 해요 ✏️');
        });
    }

    const diaryInp = document.getElementById('diary-inp');
    if (diaryInp) diaryInp.value = safeGetItem('diary_' + getTodayStr(), '');

    _renderMemoList();
    _renderFreeList();
}

window.switchMemoTab = function(tab) {
    ['write','free','diary'].forEach(function(t) {
        const content = document.getElementById('mt-content-' + t);
        const btn = document.getElementById('mt-' + t);
        if (content) content.style.display = t === tab ? 'block' : 'none';
        if (btn) {
            btn.className = t === tab ? 'btn-primary' : 'btn-secondary';
            btn.style.flex = '1'; btn.style.padding = '10px'; btn.style.fontSize = '0.82em';
        }
    });
};

window.saveMemo = function() {
    const text = (document.getElementById('memo-input') || {}).value.trim();
    if (!text) { showToast('내용을 입력해주세요'); return; }
    const memos = safeGetJSON('memos', []);
    memos.unshift({ date: getTodayStr(), text, ts: Date.now() });
    safeSetJSON('memos', memos);
    document.getElementById('memo-input').value = '';
    document.getElementById('memo-char-cnt').textContent = '0자';
    addPoint(1, '필사', 'memo_' + getTodayStr());
    showToast('✏️ 필사가 저장됐어요! +1PT');
    _renderMemoList();
};

function _renderMemoList() {
    const el = document.getElementById('memo-list-area');
    if (!el) return;
    const memos = safeGetJSON('memos', []);
    if (!memos.length) { el.innerHTML = '<div class="empty-state">아직 필사 기록이 없어요 ✏️</div>'; return; }
    el.innerHTML = '<div class="section-title" style="margin-bottom:10px;">필사 기록</div>' +
        memos.slice(0, 10).map(function(m, i) {
            return '<div class="card section-gap" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
                '<div style="flex:1;"><div class="caption-text" style="margin-bottom:3px;">' + m.date + '</div>' +
                '<div style="font-size:0.85em;line-height:1.6;">' + (m.text.length>60?m.text.slice(0,60)+'…':m.text) + '</div></div>' +
                '<button onclick="delMemo(' + i + ')" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.78em;flex-shrink:0;">삭제</button>' +
                '</div>';
        }).join('');
}

window.delMemo = function(i) {
    const memos = safeGetJSON('memos', []);
    memos.splice(i, 1); safeSetJSON('memos', memos);
    _renderMemoList();
};

window.saveFreeNote = function() {
    const title = (document.getElementById('free-title-inp') || {}).value.trim() || '제목 없음';
    const body  = (document.getElementById('free-body-inp')  || {}).value.trim();
    if (!body) { showToast('내용을 입력해주세요'); return; }
    const notes = safeGetJSON('free_notes', []);
    notes.unshift({ id: Date.now(), title, body, date: getTodayStr() });
    safeSetJSON('free_notes', notes);
    document.getElementById('free-title-inp').value = '';
    document.getElementById('free-body-inp').value = '';
    showToast('📌 메모가 저장됐어요!');
    _renderFreeList();
};

function _renderFreeList() {
    const el = document.getElementById('free-list-area');
    if (!el) return;
    const notes = safeGetJSON('free_notes', []);
    if (!notes.length) { el.innerHTML = '<div class="empty-state">아직 저장된 메모가 없어요 📌</div>'; return; }
    el.innerHTML = notes.slice(0, 10).map(function(n, i) {
        return '<div class="card section-gap">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div style="flex:1;"><div style="font-size:0.85em;font-weight:700;margin-bottom:2px;">' + n.title + '</div>' +
            '<div class="caption-text">' + n.date + '</div>' +
            '<div style="font-size:0.82em;margin-top:4px;color:var(--color-text-secondary);">' +
            (n.body.length>50?n.body.slice(0,50)+'…':n.body) + '</div></div>' +
            '<button onclick="delFreeNote(' + i + ')" style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.78em;">삭제</button>' +
            '</div></div>';
    }).join('');
}

window.delFreeNote = function(i) {
    const notes = safeGetJSON('free_notes', []);
    notes.splice(i, 1); safeSetJSON('free_notes', notes);
    _renderFreeList();
};

window.saveDiaryEntry = function() {
    const text = (document.getElementById('diary-inp') || {}).value.trim();
    if (!text) { showToast('일기 내용을 입력해주세요'); return; }
    safeSetItem('diary_' + getTodayStr(), text);
    addPoint(1, '일기', 'diary_' + getTodayStr());
    showToast('📔 일기가 저장됐어요! +1PT');
};

/* ══════════════════════════════════
   실천 뷰 (test)
══════════════════════════════════ */
function _renderTest() {
    const el = document.getElementById('view-test');
    if (!el) return;

    const pts = getPoints();
    const today = getTodayStr();
    const dates = safeGetJSON('completed_dates', []);
    const streak = _calcStreak(dates);

    function isDone(key) { return safeGetItem('pt_daily_' + key + '_' + today) === '1'; }

    const items = [
        { key: 'complete', icon: '☑️', label: '확언 완료 체크', pt: 1 },
        { key: 'listen',   icon: '🔊', label: '소리로 듣기', pt: 1 },
        { key: 'mood_' + today, icon: '😊', label: '기분 체크', pt: 1, rawKey: true },
        { key: 'memo',     icon: '✏️', label: '필사 저장', pt: 1 },
        { key: 'diary',    icon: '📔', label: '일기 저장', pt: 1 },
    ];

    function iDone(item) {
        if (item.rawKey) return safeGetItem('mood_before_' + today, '') !== '';
        return safeGetItem('pt_daily_' + item.key + '_' + today) === '1';
    }

    const earnedPt = Math.min(23, items.reduce(function(a, it) { return a + (iDone(it) ? it.pt : 0); }, 0));
    const pct = Math.round(earnedPt / 23 * 100);

    const y = todayObj.getFullYear(), m = todayObj.getMonth();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const firstDay = new Date(y, m, 1).getDay();
    const monthDone = dates.filter(function(d) { return d.startsWith(y + '-' + (m+1) + '-'); }).length;

    el.innerHTML = '<div class="view-inner">' +

    // 요약 카드
    '<div class="card section-gap">' +
    '<div style="display:flex;justify-content:space-around;text-align:center;margin-bottom:14px;">' +
    '<div><div style="font-size:1.6em;font-weight:900;color:var(--color-primary);">' + pts + '</div><div class="caption-text">포인트</div></div>' +
    '<div><div style="font-size:1.6em;font-weight:900;color:var(--color-accent);">' + streak + '</div><div class="caption-text">연속 달성</div></div>' +
    '<div><div style="font-size:1.6em;font-weight:900;color:var(--color-primary);">' + dates.length + '</div><div class="caption-text">총 완료일</div></div>' +
    '</div>' +
    '<div style="background:var(--color-bg);border-radius:4px;height:8px;overflow:hidden;">' +
    '<div style="background:linear-gradient(90deg,var(--color-primary),#52B788);height:100%;width:' + pct + '%;border-radius:4px;transition:width 0.5s;"></div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;margin-top:6px;" class="caption-text">' +
    '<span>' + earnedPt + '/23 PT 오늘 적립</span><span>' + pct + '%</span></div>' +
    '</div>' +

    // 오늘 항목
    '<div class="card section-gap">' +
    '<div style="font-size:0.85em;font-weight:700;color:var(--color-text-secondary);margin-bottom:10px;">오늘 실천 항목</div>' +
    items.map(function(it) {
        const d = iDone(it);
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--color-border);">' +
            '<span style="font-size:1.1em;">' + it.icon + '</span>' +
            '<span style="flex:1;font-size:0.88em;color:' + (d?'var(--color-primary)':'var(--color-text-secondary)') + ';font-weight:' + (d?'700':'400') + ';">' + it.label + '</span>' +
            '<span style="font-size:0.82em;font-weight:700;color:' + (d?'var(--color-primary)':'var(--color-accent)') + ';">' + (d?'✓':'+'+it.pt+'PT') + '</span>' +
            '</div>';
    }).join('') +
    '</div>' +

    // 달력
    '<div class="section-title" style="margin:16px 0 12px;">완료 달력 📅</div>' +
    '<div class="card">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
    '<span style="font-size:0.9em;font-weight:700;">' + y + '년 ' + (m+1) + '월</span>' +
    '<span class="caption-text">' + monthDone + '/' + daysInMonth + '일 완료</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;">' +
    '일월화수목금토'.split('').map(function(d) {
        return '<div style="font-size:0.62em;color:var(--color-text-muted);padding-bottom:3px;">' + d + '</div>';
    }).join('') +
    '<div></div>'.repeat(firstDay) +
    (function() {
        let html = '';
        for (let d = 1; d <= daysInMonth; d++) {
            const key = y + '-' + (m+1) + '-' + d;
            const done = dates.includes(key);
            const isT = d === todayObj.getDate() && m === todayObj.getMonth() && y === todayObj.getFullYear();
            const bg = done ? '#1B4332' : isT ? 'var(--color-primary-soft)' : 'transparent';
            const col = done ? '#fff' : isT ? 'var(--color-primary)' : 'var(--color-text-muted)';
            html += '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;' +
                'background:' + bg + ';color:' + col + ';font-size:0.7em;font-weight:' + (done||isT?'700':'400') + ';">' + d + '</div>';
        }
        return html;
    })() +
    '</div></div>' +
    '</div>';
}

function _calcStreak(dates) {
    if (!dates.length) return 0;
    let streak = 0;
    const d = new Date(todayObj);
    const today = getFormatDate(d);
    if (!dates.includes(today)) d.setDate(d.getDate() - 1);
    while (true) {
        if (dates.includes(getFormatDate(d))) { streak++; d.setDate(d.getDate() - 1); }
        else break;
    }
    return streak;
}

/* ══════════════════════════════════
   설정 뷰
══════════════════════════════════ */
let _settingsInited = false;

function _renderSettings() {
    const el = document.getElementById('view-settings');
    if (!el) return;
    if (_settingsInited) return;
    _settingsInited = true;

    const nick = safeGetItem('my_nickname', '');
    const isDark = document.body.classList.contains('dark');

    el.innerHTML = '<div class="view-inner">' +
    '<div class="section-title" style="margin-bottom:16px;">설정 ⚙️</div>' +

    '<div class="card section-gap">' +
    '<div style="font-size:0.85em;font-weight:700;color:var(--color-text-secondary);margin-bottom:12px;">프로필</div>' +
    '<div class="input-wrap"><label class="input-label">닉네임</label>' +
    '<div style="display:flex;gap:8px;">' +
    '<input id="s-nick" class="input-field" placeholder="닉네임 입력" value="' + nick + '" style="flex:1;">' +
    '<button onclick="saveNick()" class="btn-primary" style="width:auto;padding:10px 16px;">저장</button>' +
    '</div></div>' +
    '</div>' +

    '<div class="card section-gap">' +
    '<div style="font-size:0.85em;font-weight:700;color:var(--color-text-secondary);margin-bottom:12px;">외관</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;">' +
    '<span class="body-text">다크 모드</span>' +
    '<button onclick="toggleDark(this)" style="width:52px;height:28px;border-radius:14px;' +
        'background:' + (isDark?'var(--color-primary)':'#E8E5E0') + ';border:none;cursor:pointer;position:relative;">' +
    '<div style="width:22px;height:22px;border-radius:50%;background:#fff;position:absolute;top:3px;' +
        (isDark?'right:3px':'left:3px') + ';box-shadow:0 1px 4px rgba(0,0,0,0.2);transition:all 0.2s;"></div>' +
    '</button></div>' +
    '</div>' +

    '<div class="card section-gap">' +
    '<div style="font-size:0.85em;font-weight:700;color:var(--color-text-secondary);margin-bottom:10px;">데이터</div>' +
    '<button onclick="resetAllData()" style="width:100%;padding:13px;background:transparent;border:1.5px solid var(--color-danger);' +
        'border-radius:var(--radius-md);color:var(--color-danger);font-size:var(--fs-body);font-weight:700;cursor:pointer;">⚠️ 앱 데이터 초기화</button>' +
    '</div>' +

    '<div style="text-align:center;padding:28px 0 80px;">' +
    '<div class="caption-text" style="font-weight:700;">품속 — 이불 속에서 시작되는 기적 🌿</div>' +
    '<div class="caption-text" style="margin-top:4px;">인생2막라디오 × 365일 확언</div>' +
    '<div class="caption-text" style="margin-top:2px;">life2radio.github.io/pumsok</div>' +
    '</div>' +
    '</div>';
}

window.saveNick = function() {
    const val = (document.getElementById('s-nick') || {}).value.trim();
    if (!val) { showToast('닉네임을 입력해주세요'); return; }
    safeSetItem('my_nickname', val);
    showToast('✅ 닉네임이 저장됐어요!');
};

window.toggleDark = function(btn) {
    const isDark = document.body.classList.toggle('dark');
    safeSetItem('setting_dark', isDark ? 'on' : 'off');
    if (btn) {
        btn.style.background = isDark ? 'var(--color-primary)' : '#E8E5E0';
        const thumb = btn.querySelector('div');
        if (thumb) { thumb.style.right = isDark ? '3px' : ''; thumb.style.left = isDark ? '' : '3px'; }
    }
    showToast(isDark ? '🌙 다크모드 켜짐' : '☀️ 라이트모드 켜짐');
};

window.resetAllData = function() {
    if (!confirm('모든 데이터를 초기화할까요?\n완료 기록·메모·일기·포인트가 모두 삭제돼요.\n되돌릴 수 없어요!')) return;
    try { localStorage.clear(); } catch(e) {}
    showToast('초기화 완료. 새로 시작해요!');
    setTimeout(function() { location.reload(); }, 1200);
};

/* ══════════════════════════════════
   앱 초기화 (DOMContentLoaded)
══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {

    // 다크모드 복원
    if (safeGetItem('setting_dark', 'off') === 'on') document.body.classList.add('dark');

    // 네비게이션 연결
    document.querySelectorAll('.nav-btn[data-view]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const view = this.getAttribute('data-view');
            if (view) switchView(view);
        });
    });

    // extra.js는 index.html에서 이미 로드됨
    // renderPumsokRoutine이 정의되어 있으면 바로 시작
    if (typeof window.renderPumsokRoutine === 'function') {
        switchView('routine');
    } else {
        // 혹시 아직 안 로드됐으면 대기
        const script = document.createElement('script');
        script.src = 'extra.js';
        script.onload = function() {
            switchView('routine');
        };
        script.onerror = function() {
            switchView('routine');
        };
        document.body.appendChild(script);
    }
});
