/* ================================================================
   품속 (pumsok) — app.js
   index.html 뷰: routine / vow / affirmation / memo / test / settings
   ================================================================ */

(function(){
'use strict';

/* ────────────────────────────────────────
   0. 유틸
──────────────────────────────────────── */
function $(id){ return document.getElementById(id); }

function todayStr(){
  var d=new Date();
  return d.getFullYear()+'-'+(d.getMonth()<9?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();
}

function safeGet(k,def){
  try{ var v=localStorage.getItem(k); return v===null?def:v; }catch(e){ return def; }
}
function safeSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
function safeGetJSON(k,def){
  try{ var v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(e){ return def; }
}
function safeSetJSON(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }

function showToast(msg){
  var t=$('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2200);
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(s){ var m=Math.floor(s/60),sc=s%60; return m+':'+(sc<10?'0':'')+sc; }

function getDayCount(){
  var start=safeGet('app_start_date','');
  if(!start){ start=todayStr(); safeSet('app_start_date',start); }
  var ms=new Date(todayStr()).getTime()-new Date(start).getTime();
  return Math.max(1, Math.floor(ms/86400000)+1);
}

/* ────────────────────────────────────────
   1. 탭 전환
──────────────────────────────────────── */
var _curView = 'routine';
var VIEW_TITLES = {
  routine:'품속', vow:'나의 다짐', affirmation:'365 확언',
  memo:'메모', test:'테스트', settings:'설정'
};

var _viewHistory = [];

window.switchView = function(name){
  if(!name) return;

  /* 히스토리 스택 관리 */
  if(_viewHistory.length===0 || _viewHistory[_viewHistory.length-1]!==name){
    _viewHistory.push(name);
    history.pushState({view:name}, '', '');
  }

  document.querySelectorAll('.view-section').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.nav-btn').forEach(function(b){ b.classList.remove('active'); });
  var el=$('view-'+name); if(el) el.classList.add('active');
  var nb=document.querySelector('.nav-btn[data-view="'+name+'"]');
  if(nb) nb.classList.add('active');
  var ht=$('header-title'); if(ht) ht.textContent=VIEW_TITLES[name]||'품속';
  _curView=name;

  if(name==='routine')     {
    var s=$('view-routine');
    if(s) s._scrollBound=false;
    renderRoutine();
    setTimeout(initRoutineScroll, 150);
  }
  if(name==='affirmation')  renderAffirmation();
  if(name==='vow')          renderVow();
  if(name==='memo')         renderMemo();
  if(name==='settings')     renderSettings();
};

/* ────────────────────────────────────────
   2. 루틴 데이터
──────────────────────────────────────── */
var C_GREEN='#1B4332', C_GALT='#2D6A4F', C_GLIGHT='#F0F7F4';
var C_NAVY='#1B3358',  C_NALT='#2D4A6F', C_NLIGHT='#EEF4FF';

var ROUTINES = {
  morning:{
    label:'아침 루틴', emoji:'🌅', color:C_GREEN, colorAlt:C_GALT, light:C_GLIGHT,
    steps:[
      { id:'breathing',    title:'숨 고르기',    icon:'🫁', type:'silence',
        desc:'오늘 상태에 맞는 방법을 골라요.\n살랑한 마음을 모으는 것만으로 충분해요.' },
      { id:'vow',          title:'나의 다짐',    icon:'🎯', type:'text_vow',
        desc:'오늘의 다짐을 소리 내어 읽어요.\n눈을 감고 그 장면을 머릿속에 그려보세요.' },
      { id:'affirmation',  title:'오늘의 확언',  icon:'✨', type:'text_aff',
        desc:'오늘의 확언을 소리 내어 읽어요.\n입으로 말하고 귀로 들을 때 뇌에 두 번 새겨져요.' },
      { id:'morning_note', title:'아침 낙서',    icon:'✏️', type:'write', duration:180,
        desc:'지금 떠오르는 생각을 자유롭게 써요.\n주제 없이, 맞춤법 걱정 없이, 그냥 쏟아내세요.',
        placeholder:'지금 떠오르는 것을 무엇이든 써요…' },
      { id:'stretch',      title:'침대 스트레칭', icon:'🤸', type:'timer', duration:60,
        desc:'누운 채로 몸을 천천히 깨워요.\n기지개 → 무릎 당기기 → 어깨 돌리기' }
    ]
  },
  evening:{
    label:'저녁 루틴', emoji:'🌙', color:C_NAVY, colorAlt:C_NALT, light:C_NLIGHT,
    steps:[
      { id:'memory_note',  title:'기억 노트',   icon:'📝', type:'write', duration:180,
        desc:'오늘 가장 기억에 남는 장면 하나를\n소설처럼 디테일하게 적어요.\n💡 공간·사람·시간·감정을 담아보세요',
        placeholder:'어디서 / 누구와 / 몇 시쯤 / 어떤 감정이었는지…' },
      { id:'gratitude',    title:'감사 한 줄',  icon:'🙏', type:'write',
        desc:'오늘 감사했던 것 딱 한 가지만 적어요.\n작은 것도 괜찮아요.',
        placeholder:'오늘 감사한 것 하나…' },
      { id:'vow_check',    title:'다짐 확인',   icon:'✅', type:'vow_check',
        desc:'아침에 세운 다짐을 다시 읽어요.\n오늘 하루 얼마나 지켰는지 체크해보세요.' },
      { id:'sleep_breath', title:'수면 호흡',   icon:'😴', type:'breath',
        desc:'4-7-8 호흡법으로 편안하게 잠들어요.\n3회 반복하면 부교감신경이 활성화돼요.' }
    ]
  }
};

function routineType(){
  var h=new Date().getHours();
  return (h>=5&&h<16)?'morning':'evening';
}

function isStepDone(id){ return safeGet('ps_step_'+todayStr()+'_'+id)==='1'; }
function setStepDone(id){ safeSet('ps_step_'+todayStr()+'_'+id,'1'); }
function isRoutineDone(t){ return safeGet('ps_done_'+todayStr()+'_'+t)==='1'; }
function setRoutineDone(t){ safeSet('ps_done_'+todayStr()+'_'+t,'1'); }

/* ────────────────────────────────────────
   3. 루틴 메인 페이지
──────────────────────────────────────── */
function renderRoutine(){
  var el=$('view-routine'); if(!el) return;
  var type=routineType(), r=ROUTINES[type];
  var dc=getDayCount();
  var nick=safeGet('my_nickname','');
  var greet=nick?nick+'님':'안녕하세요';

  var doneCount=r.steps.filter(function(s){ return isStepDone(s.id); }).length;
  var pct=Math.round(doneCount/r.steps.length*100);
  var allDone=doneCount===r.steps.length;

  /* 다음 할 단계 인덱스 */
  var nextIdx=-1;
  for(var ni=0;ni<r.steps.length;ni++){
    if(!isStepDone(r.steps[ni].id)){ nextIdx=ni; break; }
  }

  /* 단계 리스트 — 타임라인 스타일 */
  var stepsHtml=r.steps.map(function(s,i){
    var done=isStepDone(s.id);
    var isNext=i===nextIdx;
    var isLast=i===r.steps.length-1;

    /* 번호 원 */
    var numBg=done?r.color:(isNext?r.color:'#e0ddd8');
    var numColor=done||isNext?'#fff':'#aaa';
    var numContent=done?'✓':(i+1);

    /* 카드 스타일 */
    var cardBg=done?r.light:(isNext?'#fff':'#f9f9f7');
    var cardBorder=done?r.color:(isNext?r.color:'#e8e4dd');
    var cardBorderW=isNext?'2px':'1.5px';
    var cardOpacity=(!done&&!isNext&&nextIdx!==-1)?'0.6':'1';

    /* 연결선 (마지막 제외) */
    var lineHtml=!isLast?
      '<div style="position:absolute;left:19px;top:100%;width:2px;height:14px;'+
        'background:'+(done?r.color:'#e0ddd8')+';"></div>'
      :'';

    return '<div style="position:relative;margin-bottom:14px;">'+
      lineHtml+
      '<div onclick="openRoutineStep(\''+type+'\','+i+')" style="'+
        'display:flex;align-items:center;gap:14px;'+
        'background:'+cardBg+';'+
        'border:'+cardBorderW+' solid '+cardBorder+';'+
        'border-radius:16px;padding:14px 16px;cursor:pointer;'+
        'opacity:'+cardOpacity+';'+
        'transition:all .2s;'+
        '-webkit-tap-highlight-color:transparent;'+
        (isNext?'box-shadow:0 4px 16px rgba(0,0,0,0.10);':'')+
      '">'+

        /* 번호 원 */
        '<div style="width:36px;height:36px;border-radius:50%;'+
          'background:'+numBg+';color:'+numColor+';'+
          'display:flex;align-items:center;justify-content:center;'+
          'font-size:'+(done?'1.1em':'0.9em')+';font-weight:800;flex-shrink:0;">'+
          numContent+
        '</div>'+

        /* 내용 */
        '<div style="flex:1;min-width:0;">'+
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">'+
            '<span style="font-size:1.1em;">'+s.icon+'</span>'+
            '<span style="font-size:var(--fs-body);font-weight:700;color:'+(done?r.color:(isNext?'#1a1a1a':'#aaa'))+';">'+s.title+'</span>'+
            (isNext?'<span style="font-size:10px;background:'+r.color+';color:#fff;border-radius:4px;padding:2px 6px;font-weight:700;">지금</span>':'')+
          '</div>'+
          '<div style="font-size:var(--fs-caption);color:'+(done?r.color:'#aaa')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+
            s.desc.split('\n')[0]+
          '</div>'+
        '</div>'+

        /* 완료 표시 */
        '<div style="font-size:1.2em;flex-shrink:0;color:'+(done?r.color:'#ddd')+';">'+
          (done?'✅':'›')+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  el.innerHTML=
    '<div class="view-inner">'+

    /* 상단 인사 */
    '<div id="routine-top" style="transition:all .3s;overflow:hidden;">'+
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'+
      '<div>'+
        '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">'+greet+'</div>'+
        '<div style="font-size:var(--fs-title);font-weight:800;color:var(--color-primary);">'+
          (allDone?'오늘 루틴 완료! 🎉':(doneCount===0?r.emoji+' '+r.label+' 시작해요':'계속 이어가요 💪'))+
        '</div>'+
      '</div>'+
      '<div style="text-align:right;">'+
        '<div style="background:var(--color-primary);color:#fff;border-radius:20px;padding:4px 12px;font-size:var(--fs-caption);font-weight:700;margin-bottom:4px;">Day '+dc+'</div>'+
        '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">'+doneCount+'/'+r.steps.length+' 완료</div>'+
      '</div>'+
    '</div>'+
    '</div>'+

    /* 진행률 바 (항상 표시) */
    '<div style="background:#e8e4dd;border-radius:10px;height:6px;overflow:hidden;margin-bottom:20px;">'+
      '<div style="height:100%;background:'+r.color+';border-radius:10px;width:'+pct+'%;transition:width .5s;"></div>'+
    '</div>'+

    /* 단계 리스트 */
    stepsHtml+

    /* 전환 버튼 */
    '<div style="text-align:center;margin-top:8px;padding-bottom:8px;">'+
      '<button onclick="toggleRoutineType()" style="background:transparent;border:1px solid #e0ddd8;border-radius:10px;padding:8px 20px;font-size:var(--fs-caption);color:#aaa;cursor:pointer;">'+
        (type==='morning'?'🌙 저녁 루틴 보기':'🌅 아침 루틴 보기')+
      '</button>'+
    '</div>'+
    '</div>';
}

var _forceType=null;
window.toggleRoutineType=function(){
  _forceType=(_forceType||routineType())==='morning'?'evening':'morning';
  var origFn=routineType;
  routineType=function(){ return _forceType||origFn(); };
  renderRoutine();
};

/* 루틴 탭 스크롤 → 상단 인사 영역 축소 */
function initRoutineScroll(){
  var section=$('view-routine');
  if(!section || section._scrollBound) return;
  section._scrollBound = true;

  /* routine-top 초기 maxHeight 설정 */
  var top=$('routine-top');
  if(top) top.style.maxHeight='200px';

  section.addEventListener('scroll', function(){
    var top=$('routine-top');
    if(!top) return;
    if(section.scrollTop > 50){
      top.style.maxHeight='0px';
      top.style.opacity='0';
      top.style.marginBottom='0';
      top.style.padding='0';
    } else {
      top.style.maxHeight='200px';
      top.style.opacity='1';
      top.style.marginBottom='';
      top.style.padding='';
    }
  });
}

/* ────────────────────────────────────────
   4. 루틴 모달
──────────────────────────────────────── */
var RS={type:null,step:0,iv:null};

function getModal(){
  var m=$('ps-modal');
  if(!m){
    m=document.createElement('div');
    m.id='ps-modal';
    m.style.cssText='display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:rgba(0,0,0,0.92);overflow-y:auto;-webkit-overflow-scrolling:touch;';
    m.innerHTML='<div style="max-width:600px;margin:0 auto;"><div id="ps-inner"></div></div>';
    document.body.appendChild(m);
  }
  return m;
}

window.openRoutineStep=function(type,idx){
  RS.type=type; RS.step=idx;
  clearInterval(RS.iv);
  var m=getModal(); m.style.display='block';
  document.body.style.overflow='hidden';
  renderStep();
};

window.psClose=function(){
  clearInterval(RS.iv);
  getModal().style.display='none';
  document.body.style.overflow='';
  renderRoutine();
};

window.psStep=function(i){
  clearInterval(RS.iv);
  RS.step=i;
  renderStep();
};

window.psFinish=function(){
  clearInterval(RS.iv);
  var sd=ROUTINES[RS.type].steps[RS.step];
  setStepDone(sd.id);
  var allDone=ROUTINES[RS.type].steps.every(function(s){ return isStepDone(s.id); });
  if(allDone) setRoutineDone(RS.type);

  var r=ROUTINES[RS.type];
  $('ps-inner').innerHTML=
    '<div style="text-align:center;padding:80px 24px;">'+
      '<div style="font-size:72px;margin-bottom:16px;">'+r.emoji+'</div>'+
      '<div style="font-size:var(--fs-title);font-weight:700;color:'+r.color+';margin-bottom:12px;">'+sd.title+' 완료! 🎉</div>'+
      '<div style="font-size:var(--fs-body);color:#555;line-height:1.9;margin-bottom:32px;">'+
        (allDone?'오늘 루틴 전부 완료했어요! 대단해요 🌟':'다음 단계로 넘어가세요')+
      '</div>'+
      '<div style="display:flex;gap:12px;max-width:320px;margin:0 auto;">'+
        (allDone
          ?'<button onclick="psClose()" style="flex:1;min-height:54px;background:'+r.color+';color:#fff;border:none;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">완료</button>'
          :'<button onclick="psClose()" style="flex:1;min-height:54px;background:#fff;color:#555;border:1.5px solid #ddd;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">루틴으로</button>'+
           '<button onclick="psStep('+(RS.step+1)+')" style="flex:2;min-height:54px;background:'+r.color+';color:#fff;border:none;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">다음 단계 →</button>'
        )+
      '</div>'+
    '</div>';
};

function renderStep(){
  clearInterval(RS.iv);
  var t=RS.type, s=RS.step, r=ROUTINES[t], sd=r.steps[s];
  var last=s===r.steps.length-1;
  var pct=Math.round(s/r.steps.length*100);
  var C=r.color, CL=r.light;

  var dots=r.steps.map(function(x,i){
    return '<div style="font-size:'+(i===s?'1.4em':'1em')+';opacity:'+(i<=s?1:0.3)+';transition:all .3s;">'+x.icon+'</div>';
  }).join('');

  $('ps-inner').innerHTML=
    '<div style="background:'+C+';padding:20px 20px 14px;position:sticky;top:0;z-index:2;">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
        '<button onclick="psClose()" style="background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:var(--fs-caption);font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">✕ 닫기</button>'+
        '<div style="font-size:var(--fs-caption);font-weight:700;color:rgba(255,255,255,.85);">'+r.emoji+' '+r.label+'</div>'+
        '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,.65);">'+(s+1)+' / '+r.steps.length+'</div>'+
      '</div>'+
      '<div style="background:rgba(255,255,255,.2);border-radius:10px;height:6px;overflow:hidden;margin-bottom:8px;">'+
        '<div style="height:100%;background:#fff;border-radius:10px;width:'+pct+'%;transition:width .4s;"></div>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-around;">'+dots+'</div>'+
    '</div>'+

    '<div style="padding:24px 20px 120px;background:#FAFAF8;min-height:calc(100vh - 200px);">'+
      '<div style="text-align:center;margin-bottom:20px;">'+
        '<div style="font-size:2.8em;margin-bottom:10px;">'+sd.icon+'</div>'+
        '<div style="font-size:var(--fs-title);font-weight:700;color:'+C+';margin-bottom:6px;">'+sd.title+'</div>'+
        '<div style="font-size:var(--fs-caption);color:#777;line-height:1.75;">'+sd.desc.replace(/\n/g,'<br>')+'</div>'+
      '</div>'+

      buildStepBody(sd,C,CL)+

      '<div style="display:flex;gap:12px;margin-top:28px;">'+
        (s>0
          ?'<button onclick="psStep('+(s-1)+')" style="flex:1;min-height:54px;background:#fff;color:#555;border:1.5px solid #ddd;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">◀ 이전</button>'
          :'<div style="flex:1;"></div>')+
        '<button onclick="'+(last?'psFinish()':'psStep('+(s+1)+')')+ '" style="flex:2;min-height:54px;background:'+C+';color:#fff;border:none;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">'+
          (last?'완료 ✅':'다음 →')+
        '</button>'+
      '</div>'+
    '</div>';

  var m=getModal(); if(m) m.scrollTop=0;
}

/* ────────────────────────────────────────
   5. 단계별 본문
──────────────────────────────────────── */
function buildStepBody(sd,C,CL){
  switch(sd.type){
    case 'silence':   return buildSilence(C);
    case 'timer':     return buildTimer(sd,C);
    case 'write':     return buildWrite(sd,C);
    case 'text_vow':  return buildTextVow(C,CL);
    case 'text_aff':  return buildTextAff(C,CL);
    case 'vow_check': return buildVowCheck(C,CL);
    case 'breath':    return buildBreath(C);
    default: return '';
  }
}

/* 침묵 — C안: 질문 먼저, 답에 따라 방법 안내 */
function buildSilence(C){
  var sel=safeGet('ps_silence_method_'+todayStr(),'');

  var METHODS={
    breath:{
      q:'😊 괜찮아요', label:'복식호흡', sec:60,
      guide:'<div style="background:'+C_GLIGHT+';border-radius:12px;padding:16px;margin-bottom:16px;text-align:center;font-size:var(--fs-caption);color:'+C+';line-height:2;">'+
        '가슴과 배에 손을 올려요<br>코로 <b>4초</b> 들이마시기<br>입으로 <b>6초</b> 내쉬기</div>'+
        '<div style="display:flex;justify-content:center;margin-bottom:16px;">'+
          '<div style="position:relative;width:130px;height:130px;display:flex;align-items:center;justify-content:center;">'+
            '<div id="ps-ba-outer" style="position:absolute;width:120px;height:120px;border-radius:50%;border:2px solid '+C+';transition:all .5s;"></div>'+
            '<div id="ps-ba-inner" style="position:absolute;width:60px;height:60px;border-radius:50%;background:'+C+';opacity:0.2;transition:all .5s;"></div>'+
            '<span id="ps-ba-txt" style="position:relative;font-size:var(--fs-caption);font-weight:700;color:'+C+';">준비</span>'+
          '</div>'+
        '</div>'
    },
    gratitude:{
      q:'💛 감사한 마음이에요', label:'감사 떠올리기', sec:60,
      guide:'<div style="background:'+C_GLIGHT+';border-radius:12px;padding:16px;margin-bottom:16px;font-size:var(--fs-caption);color:'+C+';line-height:2;text-align:center;">'+
        '힘든 사람, 아픈 사람, 고마운 사람<br>이름을 마음속으로 떠올려요<br><b>"건강하길 바란다" "감사하다"</b></div>'
    },
    fiverule:{
      q:'😔 힘든 일이 있어요', label:'5분 룰', sec:300,
      guide:'<div style="background:'+C_GLIGHT+';border-radius:12px;padding:16px;margin-bottom:16px;font-size:var(--fs-caption);color:'+C+';line-height:2;text-align:center;">'+
        '타이머가 울릴 때까지<br>지금 느끼는 감정을 <b>충분히</b> 느껴요<br>억누르지 말고, 판단하지 말고<br>타이머 울리면 <b>"바꿀 수 없다"</b></div>'
    },
    rest:{
      q:'😴 피곤해요', label:'그냥 쉬기', sec:60,
      guide:'<div style="background:'+C_GLIGHT+';border-radius:12px;padding:16px;margin-bottom:16px;font-size:var(--fs-caption);color:'+C+';line-height:2;text-align:center;">'+
        '창밖을 바라보거나 눈을 감아요<br>새 소리, 햇빛, 바람<br>생각이 떠올라도 그냥 흘려보내요<br>아무것도 안 해도 돼요</div>'
    }
  };

  /* 방법 선택 전 — 질문 화면 */
  if(!sel){
    var btns=Object.keys(METHODS).map(function(id){
      var m=METHODS[id];
      return '<button onclick="psSelectSilence(\''+id+'\','+m.sec+')" style="'+
        'width:100%;padding:16px;margin-bottom:10px;cursor:pointer;'+
        'background:#fff;border:1.5px solid #e0ddd8;border-radius:16px;'+
        'font-size:var(--fs-body);font-weight:700;color:#1a1a1a;text-align:left;'+
        '-webkit-tap-highlight-color:transparent;">'+
        m.q+
      '</button>';
    }).join('');

    return '<div style="text-align:center;margin-bottom:20px;">'+
      '<div style="font-size:var(--fs-title);font-weight:800;color:'+C+';margin-bottom:6px;">오늘 몸 상태가 어때요?</div>'+
      '<div style="font-size:var(--fs-caption);color:#888;">솔직하게 골라요 — 정답 없어요</div>'+
    '</div>'+
    btns;
  }

  /* 방법 선택 후 — 가이드 + 타이머 */
  var m=METHODS[sel];
  if(!m) { safeSet('ps_silence_method_'+todayStr(),''); return buildSilence(C); }

  return '<div>'+
    m.guide+
    '<div id="ps-t" style="text-align:center;font-size:3.2em;font-weight:700;color:'+C+';letter-spacing:2px;margin-bottom:10px;">'+fmt(m.sec)+'</div>'+
    '<div style="background:#e8e4dd;border-radius:10px;height:8px;overflow:hidden;margin-bottom:12px;">'+
      '<div id="ps-b" style="height:100%;background:'+C+';border-radius:10px;width:100%;transition:width 1s linear;"></div>'+
    '</div>'+
    '<div style="text-align:center;font-size:var(--fs-caption);color:#888;margin-bottom:16px;">📵 핸드폰을 내려놓고 시작하세요</div>'+
    '<button id="ps-s" onclick="psSilenceStart(\''+sel+'\','+m.sec+')" style="width:100%;padding:15px;background:'+C+';color:#fff;border:none;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">▶ 시작하기</button>'+
    '<button onclick="psClearSilence()" style="width:100%;padding:10px;margin-top:10px;background:transparent;border:none;font-size:var(--fs-caption);color:#aaa;cursor:pointer;">다른 방법으로 →</button>'+
  '</div>';
}

/* 타이머 */
function buildTimer(sd,C){
  return '<div style="text-align:center;margin:10px 0 20px;">'+
    '<div id="ps-t" style="font-size:3.5em;font-weight:700;color:'+C+';letter-spacing:2px;margin-bottom:12px;">'+fmt(sd.duration)+'</div>'+
    '<div style="background:#e8e4dd;border-radius:10px;height:8px;overflow:hidden;margin-bottom:20px;">'+
      '<div id="ps-b" style="height:100%;background:'+C+';border-radius:10px;width:100%;transition:width 1s linear;"></div>'+
    '</div>'+
    '<button id="ps-s" onclick="psTimerStart('+sd.duration+')" style="background:'+C+';color:#fff;border:none;border-radius:14px;padding:14px 36px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">▶ 시작</button>'+
  '</div>';
}

/* 글쓰기 */
function buildWrite(sd,C){
  var val=esc(safeGet('ps_w_'+sd.id+'_'+todayStr(),''));
  var ph=esc(sd.placeholder||sd.desc.split('\n')[0]);
  var timerPart=sd.duration
    ?'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'+
      '<button id="ps-wt" onclick="psWriteTimer('+sd.duration+')" style="background:'+C+';color:#fff;border:none;border-radius:10px;padding:8px 18px;font-size:var(--fs-caption);font-weight:700;cursor:pointer;">⏱ '+fmt(sd.duration)+'</button>'+
      '<span id="ps-wd" style="font-size:var(--fs-body);font-weight:700;color:'+C+';"></span>'+
    '</div>'
    :'';
  return timerPart+
    '<textarea id="ps-w" placeholder="'+ph+'" style="width:100%;box-sizing:border-box;min-height:150px;padding:14px;border:1.5px solid #e0ddd8;border-radius:14px;font-size:var(--fs-body);line-height:1.8;resize:none;outline:none;color:#2c2c2c;font-family:inherit;background:#fafaf8;">'+val+'</textarea>'+
    '<div style="text-align:right;margin-top:8px;">'+
      '<button onclick="psSaveWrite(\''+sd.id+'\')" style="background:'+C+';color:#fff;border:none;border-radius:10px;padding:8px 20px;font-size:var(--fs-caption);font-weight:700;cursor:pointer;">💾 저장</button>'+
    '</div>';
}

/* 다짐 읽기 */
function buildTextVow(C,CL){
  var vow=safeGet('my_vow','')||safeGet('userVow','')||safeGet('vow_text','');
  if(vow) return(
    '<div style="background:'+CL+';border-radius:14px;padding:20px;margin:10px 0;text-align:center;">'+
      '<div style="font-size:var(--fs-body);font-weight:700;color:'+C+';line-height:1.9;">"'+esc(vow)+'"</div>'+
    '</div>'+
    '<div style="text-align:center;font-size:var(--fs-caption);color:#888;margin-top:8px;">소리 내어 읽고, 눈 감고 30초간 그 장면을 떠올려보세요 🗣️</div>'
  );
  return '<div style="text-align:center;padding:24px;color:#888;font-size:var(--fs-caption);line-height:1.8;background:#f5f5f3;border-radius:12px;">다짐 탭에서 나만의 다짐을 먼저 설정해주세요 💚</div>';
}

/* 확언 읽기 */
function buildTextAff(C,CL){
  var text='';
  try{
    var dc=getDayCount();
    var arr=window.affirmationsData||[];
    if(arr.length>0){ var a=arr[(dc-1)%arr.length]; text=a?(a.text||a):''; }
  }catch(e){}
  if(text) return(
    '<div style="background:'+CL+';border-radius:14px;padding:20px;margin:10px 0;text-align:center;">'+
      '<div style="font-size:var(--fs-body);font-weight:700;color:'+C+';line-height:1.9;">"'+esc(text)+'"</div>'+
    '</div>'+
    '<div style="text-align:center;font-size:var(--fs-caption);color:#888;margin-top:8px;">소리 내어 읽고, 눈을 감고 마음에 새겨보세요 ✨</div>'
  );
  return '<div style="text-align:center;padding:24px;color:#888;font-size:var(--fs-caption);line-height:1.8;background:#f5f5f3;border-radius:12px;">확언 탭에서 오늘의 확언을 확인해주세요 ✨</div>';
}

/* 다짐 체크 */
function buildVowCheck(C,CL){
  var val=safeGet('ps_vow_check_'+todayStr(),'');
  var vow=safeGet('my_vow','')||safeGet('userVow','');
  var vowPart=vow?'<div style="background:'+CL+';border-radius:12px;padding:14px;margin-bottom:18px;text-align:center;"><div style="font-size:var(--fs-body);font-weight:700;color:'+C+';line-height:1.8;">"'+esc(vow)+'"</div></div>':'';
  var opts=[{v:'0',e:'✅',l:'완전히 지켰어요!'},{v:'1',e:'🤔',l:'절반 정도 지켰어요'},{v:'2',e:'💪',l:'내일은 꼭 지킬게요!'}];
  var btns=opts.map(function(o){
    var isSel=val===o.v;
    return '<button onclick="psVowCheck(\''+o.v+'\')" style="min-height:54px;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;border:2px solid '+(isSel?C:'#e0ddd8')+';background:'+(isSel?CL:'#fff')+';color:'+(isSel?C:'#555')+';transition:all .2s;width:100%;margin-bottom:8px;-webkit-tap-highlight-color:transparent;">'+o.e+' '+o.l+'</button>';
  }).join('');
  return vowPart+'<div style="max-width:300px;margin:0 auto;">'+btns+'</div>';
}

/* 수면 호흡 */
function buildBreath(C){
  return '<div style="background:'+C_NLIGHT+';border-radius:14px;padding:18px;text-align:center;">'+
    '<div id="ps-bp" style="font-size:var(--fs-title);font-weight:700;color:'+C_NAVY+';margin-bottom:8px;">준비되면 시작을 눌러주세요</div>'+
    '<div id="ps-bc" style="font-size:3em;font-weight:700;color:'+C_NAVY+';margin-bottom:8px;">-</div>'+
    '<div style="font-size:var(--fs-caption);color:#555;line-height:2;margin-bottom:14px;">🫁 4초 들이마시기 → ⏸ 7초 참기 → 💨 8초 내쉬기<br><span style="opacity:.8;">× 3회 반복 (약 57초)</span></div>'+
    '<div style="background:#dce7f8;border-radius:10px;height:8px;overflow:hidden;margin-bottom:16px;">'+
      '<div id="ps-bb" style="height:100%;background:'+C_NAVY+';border-radius:10px;width:0%;transition:width 1s linear;"></div>'+
    '</div>'+
    '<button id="ps-bbt" onclick="psBreathStart()" style="background:'+C_NAVY+';color:#fff;border:none;border-radius:14px;padding:14px 36px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">▶ 시작</button>'+
  '</div>';
}

/* ────────────────────────────────────────
   6. 단계 핸들러
──────────────────────────────────────── */
window.psClearSilence=function(){
  clearInterval(RS.iv);
  safeSet('ps_silence_method_'+todayStr(),'');
  renderStep();
};

window.psSelectSilence=function(id,sec){
  safeSet('ps_silence_method_'+todayStr(),id);
  safeSet('ps_silence_method',id);
  renderStep();
  setTimeout(function(){
    var s=$('ps-s'); if(s) s.scrollIntoView({behavior:'smooth',block:'center'});
  },150);
};

window.psSilenceStart=function(method,total){
  clearInterval(RS.iv);
  var rem=total;
  var btn=$('ps-s'), disp=$('ps-t'), bar=$('ps-b');
  if(btn) btn.style.display='none';

  if(method==='breath'){
    var phases=[{n:'들이마시기',s:4},{n:'참기',s:2},{n:'내쉬기',s:6}];
    var pi=0,ptick=0;
    RS.iv=setInterval(function(){
      var ph=phases[pi], left=ph.s-ptick;
      var txt=$('ps-ba-txt'), outer=$('ps-ba-outer'), inner=$('ps-ba-inner');
      if(txt) txt.textContent=ph.n+' '+left;
      var p=ptick/ph.s;
      if(pi===0){
        if(inner){inner.style.width=(60+p*50)+'px';inner.style.height=(60+p*50)+'px';inner.style.opacity=0.15+p*0.25;}
        if(outer){outer.style.width=(120+p*30)+'px';outer.style.height=(120+p*30)+'px';}
      } else if(pi===2){
        if(inner){inner.style.width=(110-p*50)+'px';inner.style.height=(110-p*50)+'px';inner.style.opacity=0.4-p*0.25;}
        if(outer){outer.style.width=(150-p*30)+'px';outer.style.height=(150-p*30)+'px';}
      }
      rem--;
      if(disp) disp.textContent=fmt(Math.max(0,rem));
      if(bar)  bar.style.width=(rem/total*100)+'%';
      ptick++;
      if(ptick>=ph.s){ptick=0;pi=(pi+1)%phases.length;}
      if(rem<=0){clearInterval(RS.iv);if(txt)txt.textContent='완료';_stepTimerDone();}
    },1000);
  } else {
    RS.iv=setInterval(function(){
      rem--;
      if(disp) disp.textContent=fmt(rem);
      if(bar)  bar.style.width=(rem/total*100)+'%';
      if(rem<=0){clearInterval(RS.iv);_stepTimerDone();}
    },1000);
  }
};

window.psTimerStart=function(total){
  clearInterval(RS.iv);
  var rem=total;
  var btn=$('ps-s'), disp=$('ps-t'), bar=$('ps-b');
  if(btn) btn.style.display='none';
  RS.iv=setInterval(function(){
    rem--;
    if(disp) disp.textContent=fmt(rem);
    if(bar)  bar.style.width=(rem/total*100)+'%';
    if(rem<=0){clearInterval(RS.iv);_stepTimerDone();}
  },1000);
};

window.psWriteTimer=function(total){
  clearInterval(RS.iv);
  var rem=total;
  var btn=$('ps-wt'), disp=$('ps-wd');
  if(btn){btn.textContent='⏱ 진행 중…';btn.disabled=true;}
  RS.iv=setInterval(function(){
    rem--;
    if(disp) disp.textContent=fmt(rem);
    if(rem<=0){clearInterval(RS.iv);if(disp)disp.textContent='✅ 완료';_stepTimerDone();}
  },1000);
};

function _stepTimerDone(){
  var disp=$('ps-t'); if(disp) disp.textContent='완료! ✅';
  try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){}
}

window.psSaveWrite=function(id){
  var a=$('ps-w'); if(!a) return;
  safeSet('ps_w_'+id+'_'+todayStr(),a.value);
  a.style.borderColor=C_GREEN;
  setTimeout(function(){a.style.borderColor='#e0ddd8';},1200);
  showToast('저장됐어요 💚');
};

window.psVowCheck=function(val){
  safeSet('ps_vow_check_'+todayStr(),val);
  renderStep();
};

var _breathOn=false;
window.psBreathStart=function(){
  if(_breathOn){clearInterval(RS.iv);_breathOn=false;var b=$('ps-bbt');if(b)b.textContent='▶ 시작';return;}
  _breathOn=true;
  var phases=[{n:'🫁 들이마시기',s:4},{n:'⏸ 참기',s:7},{n:'💨 내쉬기',s:8}];
  var total=3,cycle=0,pi=0,tick=0;
  var ph=$('ps-bp'),cnt=$('ps-bc'),bar=$('ps-bb'),btn=$('ps-bbt');
  if(btn) btn.textContent='■ 중지';
  function tick_fn(){
    var p=phases[pi],left=p.s-tick;
    if(ph) ph.textContent=p.n+' ('+(cycle+1)+'/'+total+'회)';
    if(cnt) cnt.textContent=left+'초';
    if(bar) bar.style.width=(tick/p.s*100)+'%';
    tick++;
    if(tick>p.s){tick=0;pi++;
      if(pi>=phases.length){pi=0;cycle++;
        if(cycle>=total){
          clearInterval(RS.iv);_breathOn=false;
          if(ph) ph.textContent='✅ 완료! 편안한 밤 되세요 🌙';
          if(cnt) cnt.textContent='';
          if(bar) bar.style.width='100%';
          if(btn) btn.style.display='none';
          try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){}
          return;
        }
      }
    }
  }
  tick_fn();
  RS.iv=setInterval(tick_fn,1000);
};

/* ────────────────────────────────────────
   7. 확언 탭 (기본)
──────────────────────────────────────── */
function renderAffirmation(){
  var el=$('view-affirmation'); if(!el) return;
  var dc=getDayCount();
  var arr=window.affirmationsData||[];
  var data=arr.length?arr[(dc-1)%arr.length]:{theme:'긍정',text:'나는 오늘도 최선을 다한다.',action:''};
  var text=data.text||data;

  el.innerHTML=
    '<div class="view-inner">'+
    '<div class="green-card section-gap" style="text-align:center;">'+
      '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,.7);margin-bottom:8px;">Day '+dc+' · '+esc(data.theme||'')+'</div>'+
      '<div style="font-size:var(--fs-title);font-weight:700;color:#fff;line-height:1.9;margin-bottom:16px;">"'+esc(text)+'"</div>'+
      (data.action?'<div style="font-size:var(--fs-caption);color:rgba(255,255,255,.75);line-height:1.7;">☐ '+esc(data.action)+'</div>':'') +
    '</div>'+
    '</div>';
}

/* ────────────────────────────────────────
   8. 다짐 탭 (기본)
──────────────────────────────────────── */
function renderVow(){
  var el=$('view-vow'); if(!el) return;
  var vow=safeGet('my_vow','')||safeGet('userVow','');

  el.innerHTML=
    '<div class="view-inner">'+
    '<div class="section-title">나의 다짐</div>'+
    '<div class="card section-gap">'+
      '<div class="input-label">내 인생의 다짐을 한 문장으로 적어요</div>'+
      '<textarea id="vow-input" class="input-field" rows="4" placeholder="나는 2027년 12월 31일, ___을 이룬다.">'+esc(vow)+'</textarea>'+
      '<button onclick="saveVow()" class="btn-primary" style="margin-top:12px;">💾 다짐 저장</button>'+
    '</div>'+
    (vow?
      '<div class="card section-gap" style="text-align:center;">'+
        '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:8px;">나의 다짐</div>'+
        '<div style="font-size:var(--fs-body);font-weight:700;color:var(--color-primary);line-height:1.9;">"'+esc(vow)+'"</div>'+
      '</div>'
    :'')+
    '</div>';
}

window.saveVow=function(){
  var v=$('vow-input'); if(!v) return;
  safeSet('my_vow',v.value);
  safeSet('userVow',v.value);
  showToast('다짐이 저장됐어요 💚');
  renderVow();
};

/* ────────────────────────────────────────
   9. 메모 탭 (기본)
──────────────────────────────────────── */
function renderMemo(){
  var el=$('view-memo'); if(!el) return;
  var list=safeGetJSON('ps_memos',[]);

  el.innerHTML=
    '<div class="view-inner">'+
    '<div class="section-title">메모</div>'+
    '<div class="card section-gap">'+
      '<textarea id="memo-input" class="input-field" rows="4" placeholder="지금 떠오르는 것을 자유롭게 써요…"></textarea>'+
      '<button onclick="saveMemo()" class="btn-primary" style="margin-top:12px;">+ 메모 저장</button>'+
    '</div>'+
    (list.length?
      '<div class="section-title">저장된 메모</div>'+
      list.slice().reverse().map(function(m,i){
        return '<div class="card section-gap">'+
          '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-bottom:6px;">'+m.date+'</div>'+
          '<div style="font-size:var(--fs-body);color:var(--color-text-primary);line-height:1.7;">'+esc(m.text)+'</div>'+
          '<button onclick="deleteMemo('+(list.length-1-i)+')" style="margin-top:8px;font-size:var(--fs-caption);color:var(--color-danger);background:none;border:none;cursor:pointer;">삭제</button>'+
        '</div>';
      }).join('')
    :'')+
    '</div>';
}

window.saveMemo=function(){
  var v=$('memo-input'); if(!v||!v.value.trim()) return;
  var list=safeGetJSON('ps_memos',[]);
  list.push({date:todayStr(),text:v.value.trim()});
  safeSetJSON('ps_memos',list);
  v.value='';
  showToast('메모 저장됐어요 📝');
  renderMemo();
};

window.deleteMemo=function(idx){
  var list=safeGetJSON('ps_memos',[]);
  list.splice(idx,1);
  safeSetJSON('ps_memos',list);
  renderMemo();
};

/* ────────────────────────────────────────
   10. 설정 탭 (기본)
──────────────────────────────────────── */
function renderSettings(){
  var el=$('view-settings'); if(!el) return;
  var nick=safeGet('my_nickname','');
  var dark=safeGet('setting_dark','off')==='on';

  el.innerHTML=
    '<div class="view-inner">'+
    '<div class="section-title">설정</div>'+

    '<div class="card section-gap">'+
      '<div class="input-label">닉네임</div>'+
      '<div style="display:flex;gap:8px;">'+
        '<input id="nick-input" class="input-field" type="text" placeholder="닉네임을 입력해요" value="'+esc(nick)+'" style="flex:1;">'+
        '<button onclick="saveNick()" class="btn-primary" style="width:auto;padding:0 16px;">저장</button>'+
      '</div>'+
    '</div>'+

    '<div class="card section-gap">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;">'+
        '<div style="font-size:var(--fs-body);font-weight:700;">다크 모드</div>'+
        '<button onclick="toggleDark()" style="width:52px;height:28px;border-radius:14px;border:none;cursor:pointer;'+
          'background:'+(dark?C_GREEN:'#ccc')+';position:relative;transition:background .2s;">'+
          '<div style="position:absolute;top:3px;'+(dark?'right:3px':'left:3px')+';width:22px;height:22px;border-radius:50%;background:#fff;transition:all .2s;"></div>'+
        '</button>'+
      '</div>'+
    '</div>'+

    '<div class="card section-gap" style="text-align:center;">'+
      '<div style="font-size:var(--fs-title);font-weight:700;color:var(--color-primary);margin-bottom:4px;">품속</div>'+
      '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);">이불 속에서 시작되는 기적</div>'+
      '<div style="font-size:var(--fs-caption);color:var(--color-text-muted);margin-top:4px;">life2radio.github.io/pumsok</div>'+
    '</div>'+
    '</div>';
}

window.saveNick=function(){
  var v=$('nick-input'); if(!v) return;
  safeSet('my_nickname',v.value.trim());
  showToast('닉네임 저장됐어요 💚');
  renderSettings();
};

window.toggleDark=function(){
  var on=safeGet('setting_dark','off')!=='on';
  safeSet('setting_dark',on?'on':'off');
  document.body.classList.toggle('dark',on);
  renderSettings();
};

/* ────────────────────────────────────────
   11. 초기화
──────────────────────────────────────── */
document.addEventListener('DOMContentLoaded',function(){

  // 다크모드 복원
  if(safeGet('setting_dark','off')==='on') document.body.classList.add('dark');

  // 네비게이션
  document.querySelectorAll('.nav-btn[data-view]').forEach(function(btn){
    btn.addEventListener('click',function(){
      switchView(this.getAttribute('data-view'));
    });
  });

  // 뒤로가기 처리
  window.addEventListener('popstate', function(e){
    /* 루틴 모달이 열려있으면 모달만 닫기 */
    var modal=$('ps-modal');
    if(modal && modal.style.display==='block'){
      psClose();
      history.pushState({view:_curView}, '', '');
      return;
    }
    /* 히스토리 스택에서 이전 탭으로 */
    _viewHistory.pop();
    if(_viewHistory.length>0){
      var prev=_viewHistory[_viewHistory.length-1];
      _viewHistory.pop(); /* switchView 안에서 다시 push하므로 */
      switchView(prev);
    } else {
      /* 스택 비었으면 루틴 탭으로 */
      switchView('routine');
    }
  });

  // 첫 화면
  switchView('routine');
});

})();
