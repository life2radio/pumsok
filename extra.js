/* ════════════════════════════════════════
   품속 — 추가 기능 (pumsok_extra.js)
   기존 app.js 위에 덧붙이는 방식
   ════════════════════════════════════════ */

// ── 앱 이름 변경 ──
document.addEventListener('DOMContentLoaded', function() {
    // 헤더 타이틀
    var titles = document.querySelectorAll('.app-title, #app-title, .header-title');
    titles.forEach(function(t) { t.textContent = '품속'; });

    // 사연 탭 → 다짐 탭
    setTimeout(function() {
        var navStory = document.getElementById('nav-story');
        if(navStory) {
            var txt = navStory.querySelector('.nav-text, span');
            if(txt) txt.textContent = '다짐';
        }
    }, 300);

    // 루틴 탭 주입 (홈 탭 위에)
    injectRoutineTab();
});

// ── 루틴 탭 홈 화면 최상단에 주입 ──
function injectRoutineTab() {
    var viewHome = document.getElementById('view-home');
    if(!viewHome) return;

    var routineDiv = document.createElement('div');
    routineDiv.id = 'pumsok-routine-wrap';
    routineDiv.style.cssText = 'padding:12px 14px 0;';
    viewHome.insertBefore(routineDiv, viewHome.firstChild);
    renderPumsokRoutineInHome();
}

function getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getPumsokRec() {
    try { return JSON.parse(localStorage.getItem('pumsok_routine_v1') || '{}'); } catch(e) { return {}; }
}
function setPumsokRec(rec) {
    try { localStorage.setItem('pumsok_routine_v1', JSON.stringify(rec)); } catch(e) {}
}

function getSlot() {
    return new Date().getHours() < 16 ? 'morning' : 'evening';
}

function renderPumsokRoutineInHome() {
    var wrap = document.getElementById('pumsok-routine-wrap');
    if(!wrap) return;

    var isMorning = new Date().getHours() < 16;

    wrap.innerHTML =
        '<div style="background:#fff;border-radius:16px;border:1px solid #E8E5E0;margin-bottom:12px;overflow:hidden;">' +
        '<div style="display:flex;border-bottom:1px solid #E8E5E0;">' +
        '<button onclick="pumsokShowTab(\'morning\')" id="ptab-m" style="flex:1;padding:11px;border:none;font-size:0.88em;font-weight:'+(isMorning?900:600)+';color:'+(isMorning?'#1B4332':'#aaa')+';background:transparent;border-bottom:'+(isMorning?'2px solid #1B4332':'none')+';cursor:pointer;">🌅 아침 루틴</button>' +
        '<button onclick="pumsokShowTab(\'evening\')" id="ptab-e" style="flex:1;padding:11px;border:none;font-size:0.88em;font-weight:'+(!isMorning?900:600)+';color:'+(!isMorning?'#1B4332':'#aaa')+';background:transparent;border-bottom:'+(!isMorning?'2px solid #1B4332':'none')+';cursor:pointer;">🌙 저녁 루틴</button>' +
        '</div>' +
        '<div id="ptab-morning" style="display:'+(isMorning?'block':'none')+'"></div>' +
        '<div id="ptab-evening" style="display:'+(!isMorning?'block':'none')+'"></div>' +
        '</div>';

    if(isMorning) renderMorning();
    else renderEvening();
}

function makeStep(num, icon, title, desc, done, action) {
    return '<div style="padding:12px 14px;border-bottom:1px solid #f0ede8;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<div style="width:24px;height:24px;border-radius:50%;background:'+(done?'#1B4332':'#E8E5E0')+';display:flex;align-items:center;justify-content:center;color:'+(done?'#fff':'#999')+';font-size:0.75em;font-weight:900;flex-shrink:0;">'+num+'</div>' +
        '<div style="font-size:0.92em;font-weight:800;color:#1A1A1A;">'+icon+' '+title+'</div>' +
        (done ? '<span style="margin-left:auto;font-size:0.75em;background:#E8F5EE;color:#1B4332;padding:2px 8px;border-radius:10px;font-weight:700;">완료✅</span>' : '') +
        '</div>' +
        '<div style="font-size:0.8em;color:#888;margin-bottom:8px;line-height:1.5;padding-left:32px;">'+desc+'</div>' +
        '<div style="padding-left:32px;">'+action+'</div>' +
        '</div>';
}

function mkBtn(text, onclick, secondary) {
    return '<button onclick="'+onclick+'" style="padding:10px 16px;background:'+(secondary?'transparent':'#1B4332')+';color:'+(secondary?'#1B4332':'#fff')+';border:'+(secondary?'1.5px solid #1B4332':'none')+';border-radius:10px;font-size:0.85em;font-weight:700;cursor:pointer;margin-right:6px;">'+text+'</button>';
}

function renderMorning() {
    var el = document.getElementById('ptab-morning');
    if(!el) return;
    var td = getTodayKey();
    var rec = getPumsokRec();
    var r = (rec[td] && rec[td].morning) || {};
    var done = [r.silence,r.vow,r.affirmation,r.memo,r.stretch].filter(Boolean).length;

    // 진행 바
    var header = '<div style="padding:12px 14px;background:linear-gradient(135deg,#1B4332,#2D6A4F);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div style="font-size:0.82em;font-weight:700;color:#fff;">이불 속에서 여는 하루 🌿</div>' +
        '<div style="font-size:0.78em;color:#A8D5BA;">'+done+'/5</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.2);border-radius:3px;height:4px;">' +
        '<div style="background:#C9A84C;height:100%;width:'+Math.round(done/5*100)+'%;border-radius:3px;transition:width 0.4s;"></div>' +
        '</div></div>';

    el.innerHTML = header +
        makeStep(1,'🧘','숨 고르기','눈 감고 조용히 1분 호흡에 집중하세요.',r.silence,
            r.silence ? '' : mkBtn('▶ 1분 타이머','startPSilence()')) +
        makeStep(2,'🎯','나의 다짐','소리내어 선언하고 시각화하세요.',r.vow,
            r.vow ? '' : mkBtn('다짐하기','window.switchView&&switchView(\'story\')')) +
        makeStep(3,'✨','오늘의 확언','한 줄 확언을 소리내어 읽으세요.',r.affirmation,
            r.affirmation ? '' : mkBtn('확언 읽기','markPM(\'affirmation\')')) +
        makeStep(4,'✏️','아침낙서','3분 타이머. 머릿속을 쏟아내세요.',r.memo,
            r.memo ? '' : mkBtn('낙서하기','window.switchView&&switchView(\'memo\')')) +
        makeStep(5,'🤸','침대 스트레칭','이불 속에서 시작해 몸을 깨워요.',r.stretch,
            r.stretch ? '' :
            mkBtn('영상 보기',"window.open('https://www.youtube.com/@SecondActRadio','_blank')",true) +
            mkBtn('완료','markPM(\'stretch\')')) +
        (done===5 ? '<div style="padding:14px;text-align:center;background:#F0FAF4;"><div style="font-size:1.3em;">🎉</div><div style="font-size:0.88em;font-weight:800;color:#1B4332;">아침 루틴 완료! 이불 속에서 기적이 시작됐어요</div></div>' : '');
}

function renderEvening() {
    var el = document.getElementById('ptab-evening');
    if(!el) return;
    var td = getTodayKey();
    var rec = getPumsokRec();
    var r = (rec[td] && rec[td].evening) || {};
    var done = [r.memory,r.gratitude,r.vow_check,r.breath].filter(Boolean).length;

    var header = '<div style="padding:12px 14px;background:linear-gradient(135deg,#0D2B1F,#1B4332);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div style="font-size:0.82em;font-weight:700;color:#fff;">이불 속에서 닫는 하루 🌙</div>' +
        '<div style="font-size:0.78em;color:#A8D5BA;">'+done+'/4</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,0.2);border-radius:3px;height:4px;">' +
        '<div style="background:#C9A84C;height:100%;width:'+Math.round(done/4*100)+'%;border-radius:3px;transition:width 0.4s;"></div>' +
        '</div></div>';

    el.innerHTML = header +
        makeStep(1,'🧠','기억노트','오늘 가장 기억에 남는 장면을 소설처럼. 공간·사람·시간·감정.',r.memory,
            r.memory ? '' : mkBtn('기억 기록','window.switchView&&switchView(\'memo\')')) +
        makeStep(2,'💛','감사한 줄','오늘 감사한 것 딱 하나만.',r.gratitude,
            r.gratitude ? '' : mkBtn('감사 기록','markPE(\'gratitude\')')) +
        makeStep(3,'🎯','다짐 확인','잠들기 전 나의 다짐을 한 번 더.',r.vow_check,
            r.vow_check ? '' : mkBtn('다짐 확인','window.switchView&&switchView(\'story\')')) +
        makeStep(4,'😴','수면 호흡','4-7-8 호흡법. 3번이면 잠이 와요.',r.breath,
            r.breath ? '' : mkBtn('▶ 호흡 시작','startPBreath()')) +
        (done===4 ? '<div style="padding:14px;text-align:center;background:#0D2B1F;"><div style="font-size:1.3em;">🌙</div><div style="font-size:0.88em;font-weight:800;color:#C9A84C;">저녁 루틴 완료! 편안한 밤 되세요</div></div>' : '');
}

window.pumsokShowTab = function(tab) {
    var m = document.getElementById('ptab-morning');
    var e = document.getElementById('ptab-evening');
    var tm = document.getElementById('ptab-m');
    var te = document.getElementById('ptab-e');
    if(tab==='morning') {
        if(m){m.style.display='block';renderMorning();}
        if(e) e.style.display='none';
        if(tm){tm.style.color='#1B4332';tm.style.fontWeight='900';tm.style.borderBottom='2px solid #1B4332';}
        if(te){te.style.color='#aaa';te.style.fontWeight='600';te.style.borderBottom='none';}
    } else {
        if(e){e.style.display='block';renderEvening();}
        if(m) m.style.display='none';
        if(te){te.style.color='#1B4332';te.style.fontWeight='900';te.style.borderBottom='2px solid #1B4332';}
        if(tm){tm.style.color='#aaa';tm.style.fontWeight='600';tm.style.borderBottom='none';}
    }
};

window.markPM = function(step) {
    var td = getTodayKey();
    var rec = getPumsokRec();
    if(!rec[td]) rec[td]={};
    if(!rec[td].morning) rec[td].morning={};
    rec[td].morning[step]=true;
    setPumsokRec(rec);
    renderMorning();
};

window.markPE = function(step) {
    var td = getTodayKey();
    var rec = getPumsokRec();
    if(!rec[td]) rec[td]={};
    if(!rec[td].evening) rec[td].evening={};
    rec[td].evening[step]=true;
    setPumsokRec(rec);
    renderEvening();
};

// 침묵 타이머
var _pst=null,_pss=60,_psr=false;
window.startPSilence=function(){
    var td=getTodayKey();
    var rec=getPumsokRec();
    if(rec[td]&&rec[td].morning&&rec[td].morning.silence){showToast&&showToast('오늘 이미 완료했어요 ✅');return;}
    if(_psr){clearInterval(_pst);_psr=false;_pss=60;renderMorning();return;}
    _psr=true;_pss=60;
    _pst=setInterval(function(){
        _pss--;
        var btn=document.querySelector('[onclick="startPSilence()"]');
        if(btn) btn.textContent='⏹ '+_pss+'초...';
        if(_pss<=0){
            clearInterval(_pst);_psr=false;_pss=60;
            markPM('silence');
            showToast&&showToast('숨 고르기 완료! 🧘');
        }
    },1000);
};

// 수면 호흡 4-7-8
var _pbt=null,_pbr=false;
window.startPBreath=function(){
    var td=getTodayKey();
    var rec=getPumsokRec();
    if(rec[td]&&rec[td].evening&&rec[td].evening.breath){showToast&&showToast('오늘 이미 완료했어요 ✅');return;}
    if(_pbr){clearInterval(_pbt);_pbr=false;renderEvening();return;}
    _pbr=true;
    var phases=[{t:'🌬 들이쉬기',d:4},{t:'😶 멈추기',d:7},{t:'💨 내쉬기',d:8}];
    var round=0,pi=0,ps=0;
    _pbt=setInterval(function(){
        var ph=phases[pi];
        var btn=document.querySelector('[onclick="startPBreath()"]');
        if(btn) btn.textContent=ph.t+' ('+(ph.d-ps)+')';
        ps++;
        if(ps>=ph.d){ps=0;pi++;
            if(pi>=phases.length){pi=0;round++;
                if(round>=3){clearInterval(_pbt);_pbr=false;markPE('breath');showToast&&showToast('수면 호흡 완료! 🌙 편안한 밤 되세요');}
            }
        }
    },1000);
};
