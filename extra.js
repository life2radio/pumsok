/**
 * pumsok_extra.js — 품속 앱 루틴 기능
 *
 * 아침 루틴 5단계: 숨고르기 → 나의다짐 → 오늘의확언 → 아침낙서(3분) → 침대스트레칭
 * 저녁 루틴 4단계: 기억노트(해마노트) → 감사한줄 → 다짐확인 → 수면호흡(4-7-8)
 *
 * index.html 수정 없이 DOM 주입 방식으로 동작
 */

(function () {
  'use strict';

  var C_GREEN = '#1B4332';
  var C_NAVY  = '#1B3358';

  /* ============================================================
   * 루틴 데이터
   * ============================================================ */
  var ROUTINES = {
    morning: {
      label: '아침 루틴', emoji: '🌅',
      color: C_GREEN, colorAlt: '#2D6A4F', light: '#F0F7F4',
      steps: [
        { id:'breathing',    title:'숨 고르기',    icon:'🫁', type:'silence',
          desc:'오늘 상태에 맞는 방법을 골라요.\n살랑한 마음을 모으는 것만으로 충분해요.' },
        { id:'vow',          title:'나의 다짐',    icon:'🎯', type:'text_vow',
          desc:'오늘의 다짐을 소리 내어 읽어요.\n눈을 감고 그 장면을 머릿속에 그려보세요.' },
        { id:'affirmation',  title:'오늘의 확언',  icon:'✨', type:'text_aff',
          desc:'오늘의 확언을 소리 내어 읽어요.\n입으로 말하고 귀로 들을 때 뇌에 두 번 새겨져요.' },
        { id:'morning_note', title:'아침 낙서',    icon:'✏️', type:'write',    duration:180,
          desc:'지금 떠오르는 생각을 자유롭게 써요.\n주제 없이, 맞춤법 걱정 없이, 그냥 쏟아내세요.',
          placeholder:'지금 떠오르는 것을 무엇이든 써요…' },
        { id:'stretch',      title:'침대 스트레칭', icon:'🤸', type:'timer',   duration:60,
          desc:'누운 채로 몸을 천천히 깨워요.\n기지개 → 무릎 당기기 → 어깨 돌리기' }
      ]
    },
    evening: {
      label: '저녁 루틴', emoji: '🌙',
      color: C_NAVY, colorAlt: '#2D4A6F', light: '#EEF4FF',
      steps: [
        { id:'memory_note', title:'기억 노트',  icon:'📝', type:'write', duration:180,
          desc:'오늘 가장 기억에 남는 장면 하나를\n소설처럼 디테일하게 적어요.\n\n💡 공간 · 사람 · 시간 · 감정을 담아보세요',
          placeholder:'어디서 / 누구와 / 몇 시쯤 / 어떤 감정이었는지…' },
        { id:'gratitude',   title:'감사 한 줄', icon:'🙏', type:'write',
          desc:'오늘 감사했던 것 딱 한 가지만 적어요.\n작은 것도 괜찮아요.',
          placeholder:'오늘 감사한 것 하나…' },
        { id:'vow_check',   title:'다짐 확인',  icon:'✅', type:'vow_check',
          desc:'아침에 세운 다짐을 다시 읽어요.\n오늘 하루 얼마나 지켰는지 체크해보세요.' },
        { id:'sleep_breath',title:'수면 호흡',  icon:'😴', type:'breath', duration:57,
          desc:'4-7-8 호흡법으로 편안하게 잠들어요.\n3회 반복하면 부교감신경이 활성화돼요.' }
      ]
    }
  };

  /* ============================================================
   * 유틸
   * ============================================================ */
  function today()      { return new Date().toISOString().slice(0,10); }
  function routineType(){ var h=new Date().getHours(); return (h>=5&&h<16)?'morning':'evening'; }
  function isDone(t)    { return localStorage.getItem('pumsok_done_'+today()+'_'+t)==='1'; }
  function markDone(t)  { localStorage.setItem('pumsok_done_'+today()+'_'+t,'1'); }
  function getW(id)     { return localStorage.getItem('pumsok_w_'+id+'_'+today())||''; }
  function setW(id,v)   { localStorage.setItem('pumsok_w_'+id+'_'+today(),v); }
  function getChk(id)   { return localStorage.getItem('pumsok_c_'+id+'_'+today()); }
  function setChk(id,v) { localStorage.setItem('pumsok_c_'+id+'_'+today(),String(v)); }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(s){ var m=Math.floor(s/60),sec=s%60; return m+':'+(sec<10?'0':'')+sec; }

  /* ============================================================
   * 1. 사연탭 → 다짐탭
   * ============================================================ */
  function renameTab(){
    var el=document.querySelector('#nav-story .nav-text');
    if(el) el.textContent='다짐';
  }

  /* ============================================================
   * 2. 루틴 카드 주입 (홈 상단)
   * ============================================================ */
  function buildCard(){
    var t=routineType(), r=ROUTINES[t], done=isDone(t);
    var steps=r.steps.map(function(s){return s.icon+' '+s.title;}).join('  →  ');
    var card=document.createElement('div');
    card.id='pumsok-card';
    card.style.cssText='margin:0 0 16px;';
    card.innerHTML=
      '<div onclick="pumsokOpen(\''+t+'\')" style="'+
        'background:linear-gradient(135deg,'+r.color+','+r.colorAlt+');'+
        'border-radius:16px;padding:18px 20px;cursor:pointer;'+
        'box-shadow:0 4px 18px rgba(0,0,0,0.15);'+
        'display:flex;align-items:center;justify-content:space-between;'+
        '-webkit-tap-highlight-color:transparent;">'+
        '<div style="flex:1;min-width:0;">'+
          '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,.72);font-weight:700;letter-spacing:.5px;margin-bottom:4px;">'+
            r.emoji+' '+r.label+' · '+r.steps.length+'단계'+
          '</div>'+
          '<div style="font-size:var(--fs-title);font-weight:700;color:#fff;margin-bottom:6px;">'+
            (done?'✅ 오늘 루틴 완료!':'지금 루틴 시작하기 ▶')+
          '</div>'+
          '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+steps+'</div>'+
        '</div>'+
        '<div style="font-size:1.8em;margin-left:14px;flex-shrink:0;">'+(done?'🌟':'▶')+'</div>'+
      '</div>';
    return card;
  }

  function injectCard(){
    if(document.getElementById('pumsok-card')) return;
    var h=document.getElementById('view-routine');
    if(!h) return;
    h.insertBefore(buildCard(), h.firstElementChild);
  }

  function refreshCard(){
    var old=document.getElementById('pumsok-card');
    if(old) old.remove();
    injectCard();
  }

  /* ============================================================
   * 3. 루틴 모달
   * ============================================================ */
  function injectModal(){
    if(document.getElementById('pumsok-modal')) return;
    var d=document.createElement('div');
    d.id='pumsok-modal';
    d.style.cssText='display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:rgba(0,0,0,0.93);overflow-y:auto;-webkit-overflow-scrolling:touch;';
    d.innerHTML='<div style="max-width:600px;margin:0 auto;"><div id="pumsok-inner"></div></div>';
    document.body.appendChild(d);
  }

  /* ============================================================
   * 4. 상태
   * ============================================================ */
  var RS={type:null,step:0,iv:null};
  var breathOn=false;

  /* ============================================================
   * 5. 외부 진입
   * ============================================================ */
  window.pumsokOpen=function(t){
    RS.type=t||routineType(); RS.step=0;
    clearInterval(RS.iv); breathOn=false;
    document.getElementById('pumsok-modal').style.display='block';
    document.body.style.overflow='hidden';
    render();
  };

  /* ============================================================
   * 6. 렌더링
   * ============================================================ */
  function render(){
    clearInterval(RS.iv); breathOn=false;
    var t=RS.type, s=RS.step, r=ROUTINES[t], sd=r.steps[s];
    var last=s===r.steps.length-1, pct=Math.round(s/r.steps.length*100);
    var C=r.color, CL=r.light;

    var dots=r.steps.map(function(x,i){
      return '<div style="font-size:'+(i===s?'1.5em':'1.05em')+';opacity:'+(i<=s?1:.3)+';transition:all .3s;">'+x.icon+'</div>';
    }).join('');

    document.getElementById('pumsok-inner').innerHTML=
      /* 헤더 */
      '<div style="background:'+C+';padding:20px 20px 14px;position:sticky;top:0;z-index:2;">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
          '<button onclick="pumsokClose()" style="background:rgba(255,255,255,.18);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:var(--fs-caption);font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">✕ 닫기</button>'+
          '<div style="font-size:var(--fs-caption);font-weight:700;color:rgba(255,255,255,.85);">'+r.emoji+' '+r.label+'</div>'+
          '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,.65);">'+(s+1)+' / '+r.steps.length+'</div>'+
        '</div>'+
        '<div style="background:rgba(255,255,255,.2);border-radius:10px;height:6px;overflow:hidden;margin-bottom:8px;">'+
          '<div style="height:100%;background:#fff;border-radius:10px;width:'+pct+'%;transition:width .4s;"></div>'+
        '</div>'+
        '<div style="display:flex;justify-content:space-around;">'+dots+'</div>'+
      '</div>'+

      /* 본문 */
      '<div style="padding:24px 20px 120px;background:#FAFAF8;min-height:calc(100vh - 200px);">'+
        '<div style="text-align:center;margin-bottom:20px;">'+
          '<div style="font-size:2.8em;margin-bottom:10px;">'+sd.icon+'</div>'+
          '<div style="font-size:var(--fs-title);font-weight:700;color:'+C+';margin-bottom:6px;">'+sd.title+'</div>'+
          '<div style="font-size:var(--fs-caption);color:#777;line-height:1.75;">'+sd.desc.replace(/\n/g,'<br>')+'</div>'+
        '</div>'+

        bodyHtml(sd, C, CL)+

        '<div style="display:flex;gap:12px;margin-top:28px;">'+
          (s>0
            ?'<button onclick="pumsokStep('+(s-1)+')" style="flex:1;min-height:54px;background:#fff;color:#555;border:1.5px solid #ddd;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">◀ 이전</button>'
            :'<div style="flex:1;"></div>')+
          '<button onclick="'+(last?'pumsokFinish()':'pumsokStep('+(s+1)+')')+'" style="flex:2;min-height:54px;background:'+C+';color:#fff;border:none;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">'+
            (last?'🎉 루틴 완료!':'다음 →')+
          '</button>'+
        '</div>'+
      '</div>';

    var m=document.getElementById('pumsok-modal');
    if(m) m.scrollTop=0;
  }

  /* ── 본문 타입별 ── */
  function bodyHtml(sd, C, CL){
    switch(sd.type){
      case 'silence':    return silenceHtml(C);
      case 'timer':     return timerHtml(sd, C);
      case 'breath':    return breathHtml(C);
      case 'write':     return writeHtml(sd, C);
      case 'text_vow':  return vowHtml(C, CL);
      case 'text_aff':  return affHtml(C, CL);
      case 'vow_check': return checkHtml(sd, C, CL);
      default: return '';
    }
  }

  function silenceHtml(C){
    var sel = localStorage.getItem('pumsok_silence_method') || '';
    var methods = [
      { id:'breath',    label:'복식호흡',    desc:'4초 들이마시고 6초 내쉬기',  sec:60  },
      { id:'gratitude', label:'감사 떠올리기', desc:'고마운 사람 마음속으로 떠올리기', sec:60  },
      { id:'fiverule',  label:'5분 룰',      desc:'힘든 감정 충분히 느끼기',   sec:300 },
      { id:'rest',      label:'그냥 쉬기',   desc:'창밖 보기, 아무것도 안 해도 OK', sec:60  }
    ];
    var cards = methods.map(function(m){
      var isSelected = sel === m.id;
      return '<button onclick="pumsokSelectSilence(\''+m.id+'\','+m.sec+')" style="'+
        'width:100%;text-align:left;padding:14px 16px;margin-bottom:8px;cursor:pointer;'+
        'background:'+(isSelected ? '#F0F7F4' : '#fff')+';'+
        'border:'+(isSelected ? '2px solid '+C : '1.5px solid #e0ddd8')+';'+
        'border-radius:14px;-webkit-tap-highlight-color:transparent;">'+
        '<div style="font-size:var(--fs-body);font-weight:700;color:'+(isSelected ? C : '#1a1a1a')+';margin-bottom:3px;">'+m.label+'</div>'+
        '<div style="font-size:var(--fs-caption);color:#888;">'+m.desc+'</div>'+
      '</button>';
    }).join('');

    var selData = methods.filter(function(m){ return m.id === sel; })[0];
    var timerBlock = '';
    if(selData){
      var guide = {
        breath: '<div style="background:#F0F7F4;border-radius:12px;padding:14px;margin-bottom:14px;font-size:var(--fs-caption);color:#1B4332;line-height:1.9;text-align:center;">'+
          '가슴과 배에 손을 올려요<br>코로 <b>4초</b> 들이마시기 — 배 먼저 나오게<br>입으로 <b>6초</b> 내쉬기 — 배 먼저 들어가게</div>'+
          '<div id="pr-breath-anim" style="display:flex;align-items:center;justify-content:center;margin-bottom:16px;">'+
            '<div id="pr-ba-outer" style="width:120px;height:120px;border-radius:50%;border:2px solid '+C+';display:flex;align-items:center;justify-content:center;transition:all .3s;">'+
              '<div id="pr-ba-inner" style="width:60px;height:60px;border-radius:50%;background:'+C+';opacity:0.2;transition:all .3s;"></div>'+
              '<span id="pr-ba-txt" style="position:absolute;font-size:var(--fs-caption);font-weight:700;color:'+C+';">준비</span>'+
            '</div>'+
          '</div>',
        gratitude: '<div style="background:#F0F7F4;border-radius:12px;padding:14px;margin-bottom:14px;font-size:var(--fs-caption);color:#1B4332;line-height:1.9;">'+
          '힘든 사람, 아픈 사람, 고마운 사람<br>이름을 마음속으로 떠올려요<br><b>"건강하길 바란다" "감사하다"</b></div>',
        fiverule: '<div style="background:#F0F7F4;border-radius:12px;padding:14px;margin-bottom:14px;font-size:var(--fs-caption);color:#1B4332;line-height:1.9;">'+
          '지금 느끼는 감정을 <b>충분히</b> 느껴요<br>억누르지 말고, 판단하지 말고<br>타이머 울리면 "바꿀 수 없다" 하고 다음으로</div>',
        rest: '<div style="background:#F0F7F4;border-radius:12px;padding:14px;margin-bottom:14px;font-size:var(--fs-caption);color:#1B4332;line-height:1.9;">'+
          '창밖을 바라보거나 눈을 감아요<br>새 소리, 햇빛, 바람<br>생각이 떠올라도 그냥 흘려보내요</div>'
      };
      timerBlock =
        (guide[sel] || '') +
        '<div id="pr-t" style="text-align:center;font-size:3em;font-weight:700;color:'+C+';letter-spacing:2px;margin-bottom:10px;">'+fmt(selData.sec)+'</div>'+
        '<div style="background:#e8e4dd;border-radius:10px;height:8px;overflow:hidden;margin-bottom:16px;">'+
          '<div id="pr-b" style="height:100%;background:'+C+';border-radius:10px;width:100%;transition:width 1s linear;"></div>'+
        '</div>'+
        '<div style="text-align:center;font-size:var(--fs-caption);color:#888;margin-bottom:14px;">📵 핸드폰을 내려놓고 시작하세요</div>'+
        '<button id="pr-s" onclick="pumsokSilenceStart(\''+sel+'\','+selData.sec+')" style="'+
          'width:100%;padding:15px;background:'+C+';color:#fff;border:none;border-radius:14px;'+
          'font-size:var(--fs-body);font-weight:700;cursor:pointer;">▶ 시작하기</button>';
    }

    return '<div>' + cards + timerBlock + '</div>';
  }

  function timerHtml(sd, C){
    return '<div style="text-align:center;margin:10px 0 20px;">'+
      '<div id="pr-t" style="font-size:3.8em;font-weight:900;color:'+C+';letter-spacing:2px;margin-bottom:12px;">'+fmt(sd.duration)+'</div>'+
      '<div style="background:#e8e4dd;border-radius:10px;height:10px;overflow:hidden;margin-bottom:20px;">'+
        '<div id="pr-b" style="height:100%;background:'+C+';border-radius:10px;width:100%;transition:width 1s linear;"></div>'+
      '</div>'+
      '<button id="pr-s" onclick="pumsokTimer('+sd.duration+')" style="background:'+C+';color:#fff;border:none;border-radius:14px;padding:14px 36px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">▶ 시작</button>'+
    '</div>';
  }

  function breathHtml(C){
    return '<div style="background:#EEF4FF;border-radius:14px;padding:18px;margin-bottom:16px;text-align:center;">'+
      '<div id="pr-bp" style="font-size:var(--fs-title);font-weight:700;color:'+C_NAVY+';margin-bottom:8px;">준비되면 시작을 눌러주세요</div>'+
      '<div id="pr-bc" style="font-size:3em;font-weight:900;color:'+C_NAVY+';margin-bottom:8px;">-</div>'+
      '<div style="font-size:var(--fs-caption);color:#555;line-height:2;margin-bottom:14px;">'+
        '🫁 4초 들이마시기 → ⏸ 7초 참기 → 💨 8초 내쉬기<br>'+
        '<span style="opacity:.8;">× 3회 반복 (약 57초)</span>'+
      '</div>'+
      '<div style="background:#dce7f8;border-radius:10px;height:8px;overflow:hidden;margin-bottom:16px;">'+
        '<div id="pr-bb" style="height:100%;background:'+C_NAVY+';border-radius:10px;width:0%;transition:width 1s linear;"></div>'+
      '</div>'+
      '<button id="pr-bbt" onclick="pumsokBreath()" style="background:'+C_NAVY+';color:#fff;border:none;border-radius:14px;padding:14px 36px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">▶ 시작</button>'+
    '</div>';
  }

  function writeHtml(sd, C){
    var val=esc(getW(sd.id));
    var ph=esc(sd.placeholder||sd.desc.split('\n')[0]);
    var timerPart=sd.duration
      ?'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'+
        '<button id="pr-wt" onclick="pumsokWriteTimer('+sd.duration+')" style="background:'+C+';color:#fff;border:none;border-radius:10px;padding:8px 18px;font-size:var(--fs-caption);font-weight:700;cursor:pointer;">⏱ '+fmt(sd.duration)+'</button>'+
        '<span id="pr-wd" style="font-size:var(--fs-body);font-weight:700;color:'+C+';"></span>'+
      '</div>'
      :'';
    return timerPart+
      '<textarea id="pr-w" placeholder="'+ph+'" style="width:100%;box-sizing:border-box;min-height:150px;padding:14px;border:1.5px solid #e0ddd8;border-radius:14px;font-size:var(--fs-body);line-height:1.8;resize:none;outline:none;color:#2c2c2c;font-family:inherit;background:#fafaf8;">'+val+'</textarea>'+
      '<div style="text-align:right;margin-top:8px;">'+
        '<button onclick="pumsokSave(\''+sd.id+'\')" style="background:'+C+';color:#fff;border:none;border-radius:10px;padding:8px 20px;font-size:var(--fs-caption);font-weight:700;cursor:pointer;">💾 저장</button>'+
      '</div>';
  }

  function vowHtml(C, CL){
    var vow=localStorage.getItem('userVow')||localStorage.getItem('myVow')||
            localStorage.getItem('vow_text')||localStorage.getItem('vowText')||
            localStorage.getItem('daily_vow')||'';
    if(vow) return(
      '<div style="background:'+CL+';border-radius:14px;padding:20px;margin:10px 0;text-align:center;">'+
        '<div style="font-size:var(--fs-body);font-weight:700;color:'+C+';line-height:1.9;">"'+esc(vow)+'"</div>'+
      '</div>'+
      '<div style="text-align:center;font-size:var(--fs-caption);color:#888;margin-top:8px;">소리 내어 읽고, 눈 감고 30초간 그 장면을 떠올려보세요 🗣️</div>'
    );
    return '<div style="text-align:center;padding:24px;color:#888;font-size:var(--fs-caption);line-height:1.8;background:#f5f5f3;border-radius:12px;">다짐 탭에서 나만의 다짐을 먼저 설정해주세요 💚</div>';
  }

  function affHtml(C, CL){
    var text='';
    try{
      var n=window.todayDayNum||window.currentDayNum||1;
      var arr=window.AFFIRMATIONS||window.affirmations||[];
      if(arr.length>0){ var a=arr[(n-1)%arr.length]; text=a?(a.text||a.affirmation||a):''; }
    }catch(e){}
    if(text) return(
      '<div style="background:'+CL+';border-radius:14px;padding:20px;margin:10px 0;text-align:center;">'+
        '<div style="font-size:var(--fs-body);font-weight:700;color:'+C+';line-height:1.9;">"'+esc(text)+'"</div>'+
      '</div>'+
      '<div style="text-align:center;font-size:var(--fs-caption);color:#888;margin-top:8px;">소리 내어 읽고, 눈을 감고 마음에 새겨보세요 ✨</div>'
    );
    return '<div style="text-align:center;padding:24px;color:#888;font-size:var(--fs-caption);line-height:1.8;background:#f5f5f3;border-radius:12px;">홈 탭에서 오늘의 확언을 먼저 확인해주세요 ✨</div>';
  }

  function checkHtml(sd, C, CL){
    var val=getChk(sd.id);
    var vow=localStorage.getItem('userVow')||localStorage.getItem('myVow')||
            localStorage.getItem('vow_text')||localStorage.getItem('vowText')||'';
    var vowPart=vow?'<div style="background:'+CL+';border-radius:12px;padding:14px;margin-bottom:18px;text-align:center;"><div style="font-size:var(--fs-body);font-weight:700;color:'+C+';line-height:1.8;">"'+esc(vow)+'"</div></div>':'';
    var opts=[{v:'0',e:'✅',l:'완전히 지켰어요!'},{v:'1',e:'🤔',l:'절반 정도 지켰어요'},{v:'2',e:'💪',l:'내일은 꼭 지킬게요!'}];
    var btns=opts.map(function(o){
      var sel=val===o.v;
      return '<button onclick="pumsokCheck(\''+sd.id+'\',\''+o.v+'\')" style="'+
        'min-height:56px;border-radius:14px;font-size:var(--fs-body);font-weight:700;cursor:pointer;'+
        'border:2px solid '+(sel?C:'#e0ddd8')+';background:'+(sel?CL:'#fff')+';color:'+(sel?C:'#555')+';'+
        'transition:all .2s;width:100%;margin-bottom:8px;-webkit-tap-highlight-color:transparent;">'+
        o.e+' '+o.l+'</button>';
    }).join('');
    return vowPart+'<div style="max-width:300px;margin:0 auto;">'+btns+'</div>';
  }

  /* ============================================================
   * 7. 이벤트 핸들러
   * ============================================================ */
  window.pumsokSelectSilence = function(methodId, sec) {
    localStorage.setItem('pumsok_silence_method', methodId);
    render();
    setTimeout(function(){
      var el = document.getElementById('pr-s');
      if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
    }, 100);
  };

  window.pumsokSilenceStart = function(methodId, total) {
    clearInterval(RS.iv);
    var rem = total;
    var btn  = document.getElementById('pr-s');
    var disp = document.getElementById('pr-t');
    var bar  = document.getElementById('pr-b');
    if(btn) btn.style.display = 'none';

    if(methodId === 'breath') {
      var phases = [{n:'들이마시기',s:4},{n:'참기',s:2},{n:'내쉬기',s:6}];
      var pi=0, ptick=0;
      var outer = document.getElementById('pr-ba-outer');
      var inner = document.getElementById('pr-ba-inner');
      var txt   = document.getElementById('pr-ba-txt');
      RS.iv = setInterval(function(){
        var ph = phases[pi];
        var left = ph.s - ptick;
        if(txt) txt.textContent = ph.n + ' ' + left;
        var p = ptick / ph.s;
        if(pi === 0) {
          var sz = 60 + p*50; var op = 0.15 + p*0.25;
          if(inner){inner.style.width=sz+'px';inner.style.height=sz+'px';inner.style.opacity=op;}
          if(outer){outer.style.width=(120+p*30)+'px';outer.style.height=(120+p*30)+'px';}
        } else if(pi === 2) {
          var sz2 = 110 - p*50; var op2 = 0.4 - p*0.25;
          if(inner){inner.style.width=sz2+'px';inner.style.height=sz2+'px';inner.style.opacity=op2;}
          if(outer){outer.style.width=(150-p*30)+'px';outer.style.height=(150-p*30)+'px';}
        }
        rem--;
        if(disp) disp.textContent = fmt(Math.max(0,rem));
        if(bar)  bar.style.width = (rem/total*100)+'%';
        ptick++;
        if(ptick >= ph.s){ ptick=0; pi=(pi+1)%phases.length; }
        if(rem <= 0){ clearInterval(RS.iv); if(txt) txt.textContent='완료'; _silenceDone(); }
      }, 1000);
    } else {
      RS.iv = setInterval(function(){
        rem--;
        if(disp) disp.textContent = fmt(rem);
        if(bar)  bar.style.width = (rem/total*100)+'%';
        if(rem <= 0){ clearInterval(RS.iv); _silenceDone(); }
      }, 1000);
    }
  };

  function _silenceDone(){
    try{ navigator.vibrate && navigator.vibrate([200,100,200]); }catch(e){}
    var disp = document.getElementById('pr-t');
    if(disp) disp.textContent = '완료! ✅';
  }

  window.pumsokStep=function(i){ clearInterval(RS.iv); breathOn=false; RS.step=i; render(); };

  window.pumsokClose=function(){
    clearInterval(RS.iv); breathOn=false;
    document.getElementById('pumsok-modal').style.display='none';
    document.body.style.overflow='';
    refreshCard();
  };

  window.pumsokFinish=function(){
    clearInterval(RS.iv); breathOn=false;
    markDone(RS.type);
    try{ window.addPoints&&window.addPoints(3,'루틴 완료'); }catch(e){}
    var r=ROUTINES[RS.type];
    document.getElementById('pumsok-inner').innerHTML=
      '<div style="text-align:center;padding:80px 24px;">'+
        '<div style="font-size:80px;margin-bottom:20px;">'+r.emoji+'</div>'+
        '<div style="font-size:var(--fs-title);font-weight:700;color:'+r.color+';margin-bottom:12px;">'+r.label+' 완료! 🎉</div>'+
        '<div style="font-size:var(--fs-body);color:#555;line-height:1.9;margin-bottom:32px;">'+
          (RS.type==='morning'?'오늘 하루도 최고의 하루가 될 거예요!<br>+3 포인트 적립 🌿':'오늘 하루도 수고 많으셨어요!<br>편안한 밤 되세요 🌙<br>+3 포인트 적립')+
        '</div>'+
        '<button onclick="pumsokClose()" style="background:'+r.color+';color:#fff;border:none;border-radius:16px;padding:16px 40px;font-size:var(--fs-body);font-weight:700;cursor:pointer;">확인</button>'+
      '</div>';
  };

  /* 타이머 */
  window.pumsokTimer=function(total){
    clearInterval(RS.iv);
    var rem=total, btn=document.getElementById('pr-s'), t=document.getElementById('pr-t'), b=document.getElementById('pr-b');
    if(btn) btn.style.display='none';
    RS.iv=setInterval(function(){
      rem--;
      if(t) t.textContent=fmt(rem);
      if(b) b.style.width=(rem/total*100)+'%';
      if(rem<=0){ clearInterval(RS.iv); if(t) t.textContent='완료! ✅'; try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){} }
    },1000);
  };

  /* 글쓰기 타이머 */
  window.pumsokWriteTimer=function(total){
    clearInterval(RS.iv);
    var rem=total, btn=document.getElementById('pr-wt'), disp=document.getElementById('pr-wd');
    if(btn){btn.textContent='⏱ 진행 중…';btn.disabled=true;}
    RS.iv=setInterval(function(){
      rem--;
      if(disp) disp.textContent=fmt(rem);
      if(rem<=0){ clearInterval(RS.iv); if(disp) disp.textContent='✅ 완료'; try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){} }
    },1000);
  };

  /* 수면 호흡 */
  window.pumsokBreath=function(){
    if(breathOn){ clearInterval(RS.iv); breathOn=false; var b=document.getElementById('pr-bbt'); if(b) b.textContent='▶ 시작'; return; }
    breathOn=true;
    var phases=[{n:'🫁 들이마시기',s:4},{n:'⏸ 참기',s:7},{n:'💨 내쉬기',s:8}];
    var total=3, cycle=0, pi=0, tick=0;
    var ph=document.getElementById('pr-bp'), cnt=document.getElementById('pr-bc'), bar=document.getElementById('pr-bb'), btn=document.getElementById('pr-bbt');
    if(btn) btn.textContent='■ 중지';
    function tick_fn(){
      var p=phases[pi], left=p.s-tick;
      if(ph) ph.textContent=p.n+' ('+(cycle+1)+'/'+total+'회)';
      if(cnt) cnt.textContent=left+'초';
      if(bar) bar.style.width=(tick/p.s*100)+'%';
      tick++;
      if(tick>p.s){ tick=0; pi++; if(pi>=phases.length){ pi=0; cycle++; if(cycle>=total){ clearInterval(RS.iv); breathOn=false; if(ph) ph.textContent='✅ 완료! 편안한 밤 되세요 🌙'; if(cnt) cnt.textContent=''; if(bar) bar.style.width='100%'; if(btn) btn.style.display='none'; try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){} return; } } }
    }
    tick_fn();
    RS.iv=setInterval(tick_fn,1000);
  };

  /* 저장 */
  window.pumsokSave=function(id){
    var a=document.getElementById('pr-w');
    if(!a) return;
    setW(id,a.value);
    a.style.borderColor=C_GREEN;
    setTimeout(function(){a.style.borderColor='#e0ddd8';},1200);
  };

  /* 다짐 체크 */
  window.pumsokCheck=function(id,val){ setChk(id,val); render(); };

  /* ============================================================
   * 8. 초기화
   * ============================================================ */
  function init(){
    renameTab();
    injectCard();
    injectModal();

    var orig=window.switchView;
    if(typeof orig==='function'){
      window.switchView=function(v){
        orig.apply(this,arguments);
        if(v==='routine') setTimeout(refreshCard,150);
      };
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){setTimeout(init,300);});
  } else {
    setTimeout(init,300);
  }

  /* ── renderPumsokRoutine: IIFE 안에서 정의해야 내부 함수 접근 가능 ── */
  window.renderPumsokRoutine = function(container) {
  if (!container) return;
  var type = routineType();
  var r = ROUTINES[type];
  var done = isDone(type);

  var stepsHtml = r.steps.map(function(s, i) {
    var stepDone = localStorage.getItem('pumsok_step_' + today() + '_' + s.id) === '1';
    return '<div onclick="pumsokOpenStep(\'' + type + '\',' + i + ')" style="' +
      'display:flex;align-items:center;gap:14px;' +
      'background:' + (stepDone ? r.light : '#fff') + ';' +
      'border:1.5px solid ' + (stepDone ? r.color : '#e8e4dd') + ';' +
      'border-radius:14px;padding:14px 16px;margin-bottom:10px;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent;">' +
      '<div style="font-size:1.6em;flex-shrink:0;">' + s.icon + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:var(--fs-body);font-weight:700;color:' + (stepDone ? r.color : '#1a1a1a') + ';">' + s.title + '</div>' +
        '<div style="font-size:var(--fs-caption);color:#888;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + s.desc.split('\n')[0] + '</div>' +
      '</div>' +
      '<div style="font-size:var(--fs-title);flex-shrink:0;">' + (stepDone ? '✅' : '○') + '</div>' +
    '</div>';
  }).join('');

  var doneCount = r.steps.filter(function(s) {
    return localStorage.getItem('pumsok_step_' + today() + '_' + s.id) === '1';
  }).length;
  var pct = Math.round(doneCount / r.steps.length * 100);

  container.innerHTML =
    '<div style="padding:16px 16px 0;">' +
      /* 헤더 카드 */
      '<div style="background:linear-gradient(135deg,' + r.color + ',' + r.colorAlt + ');' +
        'border-radius:18px;padding:20px;margin-bottom:16px;">' +
        '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,.75);font-weight:700;margin-bottom:4px;">' +
          r.emoji + ' ' + r.label + ' · ' + r.steps.length + '단계' +
        '</div>' +
        '<div style="font-size:var(--fs-title);font-weight:700;color:#fff;margin-bottom:12px;">' +
          (done ? '✅ 오늘 루틴 완료!' : '하나씩 차례로 해요') +
        '</div>' +
        /* 진행 바 */
        '<div style="background:rgba(255,255,255,.25);border-radius:10px;height:8px;overflow:hidden;margin-bottom:6px;">' +
          '<div style="height:100%;background:#fff;border-radius:10px;width:' + pct + '%;transition:width .4s;"></div>' +
        '</div>' +
        '<div style="font-size:var(--fs-caption);color:rgba(255,255,255,.75);">' +
          doneCount + ' / ' + r.steps.length + ' 완료 · ' + pct + '%' +
        '</div>' +
      '</div>' +

      /* 단계 리스트 */
      stepsHtml +

      /* 다른 루틴 전환 버튼 */
      '<div style="text-align:center;margin-top:8px;padding-bottom:16px;">' +
        '<button onclick="pumsokSwitchRoutine()" style="' +
          'background:transparent;border:1px solid #e0ddd8;border-radius:10px;' +
          'padding:8px 20px;font-size:var(--fs-caption);color:#888;cursor:pointer;">' +
          (type === 'morning' ? '🌙 저녁 루틴으로 전환' : '🌅 아침 루틴으로 전환') +
        '</button>' +
      '</div>' +
    '</div>';
};

/* 단계 직접 열기 */
window.pumsokOpenStep = function(type, stepIdx) {
  RS.type = type;
  RS.step = stepIdx;
  clearInterval(RS.iv);
  breathOn = false;
  document.getElementById('pumsok-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
  render();
};

/* 루틴 전환 */
window.pumsokSwitchRoutine = function() {
  var area = document.getElementById('pumsok-routine-area');
  if (!area) return;
  var cur = routineType();
  var next = cur === 'morning' ? 'evening' : 'morning';
  /* 임시 전환용 플래그 */
  window._pumsokForceType = next;
  var origFn = routineType;
  routineType = function() { return window._pumsokForceType || origFn(); };
  window.renderPumsokRoutine(area);
};

/* 단계 완료 후 메인으로 복귀 시 체크 */
var _origFinish = window.pumsokFinish;
window.pumsokFinish = function() {
  /* 현재 단계 완료 표시 */
  var sd = ROUTINES[RS.type].steps[RS.step];
  localStorage.setItem('pumsok_step_' + today() + '_' + sd.id, '1');

  _origFinish && _origFinish();

  /* 루틴 메인 갱신 */
  setTimeout(function() {
    var area = document.getElementById('pumsok-routine-area');
    if (area) window.renderPumsokRoutine(area);
  }, 200);
};

})();
