    /* =========================================================
       ★ 새 에피소드 업로드 시 아래 3개만 수정하세요
       title을 빈 문자열로 두면 배너가 자동으로 숨겨집니다
       ========================================================= */
    // ★★★ 구글 스프레드시트 연동 설정 ★★★
    // 스프레드시트 배포 후 아래 URL을 교체하세요
    const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbwaacDnfTuhiO_QCpHzPmex_ZFkr1RGsX1_Nmprp3CzIRjBINfa8tmC7gsCZkQNniz9/exec';

    async function loadSheetData(){
        if(SHEET_API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL') return;
        try{
            const res  = await fetch(SHEET_API_URL + '?t=' + Date.now());
            const data = await res.json();

            // ① 시크릿 코드
            if(data.secretCodes) Object.assign(SECRET_CODES, data.secretCodes);

            // ② Shorts 영상
            if(data.shorts){
                data.shorts.forEach(s=>{
                    const found = SHORTS_DATA.find(d=> d.ep === s.ep);
                    if(found){ found.url=s.url; found.title=s.title; found.theme=s.theme; }
                    else if(s.url) SHORTS_DATA.push(s);
                });
            }

            // ③ 에피소드 배너 (최신 1개)
            if(data.episode && data.episode.title){
                latestEpisode.title = data.episode.title;
                latestEpisode.url   = data.episode.url;
                latestEpisode.date  = data.episode.date;
                renderEpisodeBanner();
            }

            // ④ 핵심 질문 (테마별 덮어쓰기)
            if(data.questions){
                data.questions.forEach(q=>{
                    THEME_QUESTIONS[q.theme] = {
                        q:    q.question,
                        type: q.type || 'episode',
                        url:  q.url  || ''
                    };
                });
            }

            // ⑤ 앱 설정
            if(data.settings){
                if(data.settings.channelUrl) {}
                if(data.settings.hallOfFame){
                    window._sheetHallOfFame = data.settings.hallOfFame;
                }
                // PDF 링크 저장
                ['pdf_url_1','pdf_url_2','pdf_url_3','pdf_url_4'].forEach(key=>{
                    if(data.settings[key]) safeSetItem(key, data.settings[key]);
                });
            }

            // ⑥ 시크릿 특별 콘텐츠 (날짜별)
            if(data.secretContents){
                window.SECRET_CONTENTS = data.secretContents;
            }

        } catch(e){
            // 카톡/인앱브라우저에서는 CORS로 실패할 수 있음 — 조용히 무시
        }
    }

    const latestEpisode = {
        title: "",
        url: "https://www.youtube.com/@SecondActRadio",
        date: ""
    };

    /* =========================================================
       데이터
       ========================================================= */

    let currentMode = 'A';
    let selectedDateObj = new Date();
    selectedDateObj.setHours(0,0,0,0);
    let todayObj = new Date();
    todayObj.setHours(0,0,0,0);
    let isToday = true;
    let currentOracleDayCount = 1; // 오라클에서 현재 보여주는 dayCount

    /* === 유틸 (TOP's 스마트 데이터 어댑터) === */
    function safeGetItem(k, d) {
        let val = appState.get('cache', k);
        // ★ 수정: undefined와 null을 모두 완벽하게 방어
        if (val !== undefined && val !== null) return val;
        try { const i = localStorage.getItem(k); if(i !== null) { appState.set('cache', k, i); return i; } return d; } catch(e) { return d; }
    }
    function safeSetItem(k, v) {
        appState.set('cache', k, v);
        try { localStorage.setItem(k, v); } catch(e) {}
    }
    function safeGetJSON(k, d) {
        let val = appState.get('json', k);
        // ★ 수정: undefined와 null을 모두 완벽하게 방어
        if (val !== undefined && val !== null) return val;
        try { const i = localStorage.getItem(k); if(i) { const p = JSON.parse(i); appState.set('json', k, p); return p; } return d; } catch(e) { return d; }
    }
    function safeSetJSON(k, v) {
        appState.set('json', k, v);
        try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {}
    }
    function getFormatDate(d){return`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;}
    function getTodayStr(){return getFormatDate(todayObj);}

    /* ===== ★ 6단계: 확언 카드 공유 ===== */
    window.openShareCard = function(){
        const affirmEl = document.getElementById('affirmation-text');
        const themeEl  = document.getElementById('theme-text');
        if(!affirmEl || affirmEl.closest('.blurred-content')) {
            showToast('먼저 기분을 선택해 확언을 열어주세요!');
            return;
        }
        const affirmText = affirmEl.innerText;
        const themeText  = themeEl ? themeEl.innerText.replace(/["""]/g,'') : '';
        const dayText    = document.getElementById('day-label').innerText;

        drawShareCard(affirmText, themeText, dayText);
        document.getElementById('share-modal').style.display = 'flex';
    }

    function drawShareCard(affirmText, themeText, dayText){
        const canvas = document.getElementById('share-canvas');
        const W = 800, H = 800;
        canvas.width  = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // 배경
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1B4332');
        grad.addColorStop(1, '#0D2B20');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // 장식 원
        ctx.beginPath(); ctx.arc(W-80, 80, 180, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(212,168,67,0.07)'; ctx.fill();
        ctx.beginPath(); ctx.arc(80, H-80, 140, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(212,168,67,0.05)'; ctx.fill();

        // ── 레이아웃 영역 정의 ──
        const TOP_PAD    = 70;   // 상단 여백
        const BOT_ZONE   = 160; // 하단 워터마크 영역 높이
        const SIDE_PAD   = 70;   // 좌우 여백
        const TEXT_TOP   = 210;  // 확언 텍스트 시작 Y
        const TEXT_BOT   = H - BOT_ZONE - 20; // 확언 텍스트 끝 Y (최대)

        // 골드 상단 선
        ctx.strokeStyle = '#D4A843'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(SIDE_PAD, TOP_PAD); ctx.lineTo(W-SIDE_PAD, TOP_PAD); ctx.stroke();

        // 골드 하단 선 (워터마크 위)
        ctx.beginPath(); ctx.moveTo(SIDE_PAD, H-BOT_ZONE); ctx.lineTo(W-SIDE_PAD, H-BOT_ZONE); ctx.stroke();

        // 날짜
        ctx.fillStyle = '#D4A843';
        ctx.font = 'bold 30px "Apple SD Gothic Neo","Malgun Gothic",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dayText, W/2, TOP_PAD + 48);

        // 테마
        ctx.fillStyle = 'rgba(212,168,67,0.8)';
        ctx.font = '26px "Apple SD Gothic Neo","Malgun Gothic",sans-serif';
        ctx.fillText(themeText, W/2, TOP_PAD + 88);

        // 구분선
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(120, TOP_PAD+108); ctx.lineTo(W-120, TOP_PAD+108); ctx.stroke();

        // 확언 텍스트 — 글자 수에 따라 폰트 크기 자동 조절
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        const textAreaH = TEXT_BOT - TEXT_TOP;
        const maxWidth  = W - SIDE_PAD*2 - 20;

        // 폰트 크기 자동 조절 (긴 텍스트는 작게)
        let fontSize = affirmText.length < 20 ? 88 : affirmText.length < 35 ? 76 : affirmText.length < 50 ? 66 : affirmText.length < 90 ? 54 : affirmText.length < 130 ? 44 : 36;
        let lineHeight = fontSize * 1.65;
        ctx.font = `bold ${fontSize}px "Apple SD Gothic Neo","Malgun Gothic",sans-serif`;

        // 줄 나누기
        const rawLines = splitLines(ctx, affirmText, maxWidth);
        // 총 높이가 영역 초과 시 폰트 더 줄이기
        while(rawLines.length * lineHeight > textAreaH && fontSize > 20){
            fontSize -= 2;
            lineHeight = fontSize * 1.65;
            ctx.font = `bold ${fontSize}px "Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
        }

        // 수직 중앙 정렬
        const totalH = rawLines.length * lineHeight;
        const startY = TEXT_TOP + (textAreaH - totalH) / 2 + fontSize;
        rawLines.forEach((line, i)=>{
            ctx.fillText(line, W/2, startY + i * lineHeight);
        });

        // ── 하단 워터마크 영역 ──
        const wmY = H - BOT_ZONE + 20;
        const qrSize = 80;
        const qrX = W - SIDE_PAD - qrSize - 10;
        const qrY = H - BOT_ZONE + (BOT_ZONE - qrSize - 24) / 2;

        // QR 패턴
        drawQRPattern(ctx, qrX, qrY, qrSize, '#D4A843');

        // 채널명
        ctx.fillStyle = 'rgba(212,168,67,0.9)';
        ctx.font = `bold 24px "Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('🌿 인생2막라디오 · 365일 확언', SIDE_PAD + 10, wmY + 36);

        // 채널 주소
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `18px "Apple SD Gothic Neo","Malgun Gothic",sans-serif`;
        ctx.fillText('youtube.com/@SecondActRadio', SIDE_PAD + 10, wmY + 66);
    }

    // 줄 나누기 함수 (한 줄 최대 maxWidth)
    function splitLines(ctx, text, maxWidth){
        const chars = text.split('');
        const lines  = [];
        let line = '';
        for(let c of chars){
            const test = line + c;
            if(ctx.measureText(test).width > maxWidth && line !== ''){
                lines.push(line);
                line = c;
            } else { line = test; }
        }
        if(line) lines.push(line);
        return lines;
    }

    function drawQRPattern(ctx, x, y, size, color){
        // QR코드 느낌의 패턴 (실제 QR 대신 시각적 표현)
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x-4, y-4, size+8, size+8);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, size, size);

        // QR 픽셀 패턴
        const pattern = [
            [1,1,1,1,1,1,1,0,0,1,0,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1,0,1,0,1,0,1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1,0,0,1,0,0,1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1,0,0,0,1,0,1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1,0,1,0,0,0,1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1],
            [0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
            [0,1,0,1,1,0,1,1,0,0,1,0,1,0,1,1,0,1,0],
            [1,0,1,0,0,1,0,1,1,1,0,1,0,1,0,0,1,0,1],
            [0,1,1,0,1,0,1,0,1,0,1,0,1,1,0,1,0,1,0],
            [0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,1,0,1],
            [1,1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1,0,1,0,1,0,1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1,0,0,1,0,1,1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1,0,1,0,1,0,0,0,1,1,1,0,1],
            [1,0,1,1,1,0,1,0,0,1,0,1,1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1,0,1,0,1,0,1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1,0,0,1,0,0,1,1,1,1,1,1,1],
        ];
        const cell = size / pattern.length;
        ctx.fillStyle = '#1B4332';
        pattern.forEach((row, ri)=>{
            row.forEach((val, ci)=>{
                if(val) ctx.fillRect(x + ci*cell, y + ri*cell, cell-0.5, cell-0.5);
            });
        });

        // QR 아래 라벨
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.floor(size*0.18)}px "Apple SD Gothic Neo", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('채널 바로가기', x + size/2, y + size + 18);
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxY){
        const sentences = text.split('. ');
        let lines = [];
        for(let s=0; s<sentences.length; s++){
            let sentence = sentences[s] + (s < sentences.length-1 ? '.' : '');
            let testLine = '';
            for(let c=0; c<sentence.length; c++){
                testLine += sentence[c];
                if(ctx.measureText(testLine).width > maxWidth){
                    lines.push(testLine.slice(0,-1));
                    testLine = sentence[c];
                }
            }
            if(testLine) lines.push(testLine);
        }
        lines = lines.slice(0, 8);
        let startY = y;
        for(let l of lines){
            if(maxY && startY > maxY) break;
            ctx.fillText(l.trim(), x, startY);
            startY += lineHeight;
        }
    }

    window.downloadCard = function(){
        const canvas = document.getElementById('share-canvas');
        const link = document.createElement('a');
        const dayText = document.getElementById('day-label').innerText.replace(/\s/g,'_');
        link.download = `확언카드_${dayText}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('💚 카드가 저장됐어요!');
    }

    window.shareCard = function(){
        addPoint(1,'확언카드공유','share_card');
        window._sendShareLog('확언카드공유');
        const canvas = document.getElementById('share-canvas');
        canvas.toBlob(async (blob) => {
            if(navigator.share && navigator.canShare){
                const file = new File([blob], '확언카드.png', {type:'image/png'});
                if(navigator.canShare({files:[file]})){
                    try{
                        await navigator.share({
                            files: [file],
                            title: '오늘의 확언',
                            text: '인생2막라디오 365일 확언 🌿'
                        });
                    } catch(e){ downloadCard(); }
                } else { downloadCard(); }
            } else { downloadCard(); }
        }, 'image/png');
    }
    let toastTimer = null;
    function showToast(msg){
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(()=>t.classList.remove('show'), 1800);
    }

    /* ===== ★ 5단계: 에피소드 배너 ===== */
    function initBanner(){
        if(!latestEpisode.title) return;
        const todayStr = getTodayStr();
        const hidden = safeGetItem('banner_hidden_date','');
        if(hidden === todayStr) return;
        document.getElementById('banner-title-text').textContent = '🎙 새 에피소드: ' + latestEpisode.title;
        document.getElementById('episode-banner').style.display = 'block';
    }
    window.openEpisodeBanner = function(){
        window.open(latestEpisode.url,'_blank');
    }
    window.closeBanner = function(){
        document.getElementById('episode-banner').style.display = 'none';
        safeSetItem('banner_hidden_date', getTodayStr());
    }

    /* ===== ★ 5단계: 즐겨찾기 ===== */
    function getDayCountNow(){
        // 현재 화면에 표시 중인 dayCount 반환
        if(currentMode==='A'){
            let minDateA=new Date(todayObj.getFullYear(),0,1);
            return Math.floor((selectedDateObj-minDateA)/86400000)+1;
        } else {
            const startStr=safeGetItem('start_date_B',null);
            if(!startStr) return 1;
            let parts=startStr.split('-');
            let minDateB=new Date(parts[0],parts[1]-1,parts[2]);
            let dc=Math.floor((selectedDateObj-minDateB)/86400000)+1;
            return dc<1?1:dc;
        }
    }

    window.toggleFavorite = function(){
        let favs = safeGetJSON('favorites',[]);
        const dc = getDayCountNow();
        const idx = favs.indexOf(dc);
        if(idx === -1){
            favs.push(dc);
            safeSetJSON('favorites', favs);
            addPoint(1,'즐겨찾기','fav_'+getTodayStr());
            showToast('즐겨찾기에 추가됐어요!');
        } else {
            favs.splice(idx,1);
            safeSetJSON('favorites', favs);
            showToast('즐겨찾기에서 해제됐어요');
        }
        updateFavButton(dc);
        renderDashboard();
        // 미션용 카운트도 업데이트
        let m=todayObj.getMonth()+1, y=todayObj.getFullYear();
        let cnt=favs.length;
        safeSetJSON('fav_count_total', cnt);
        safeSetJSON(`fav_count_${y}_${m}`, favs.filter(d=>d<=366).length); // 간단히
        checkMissions();
    }

    function updateFavButton(dc){
        const btn = document.getElementById('btn-fav-main');
        if(!btn) return;
        const favs = safeGetJSON('favorites',[]);
        if(favs.includes(dc)){
            btn.textContent = '★ 저장됨 (다시 누르면 해제)';
            btn.classList.add('saved');
        } else {
            btn.textContent = '즐겨찾기에 추가';
            btn.classList.remove('saved');
        }
    }

    window.renderFavoritesPage = function(){
        const favs = safeGetJSON('favorites',[]);
        const container = document.getElementById('fav-list');
        if(favs.length === 0){
            container.innerHTML = '<div class="fav-empty">아직 즐겨찾기한 확언이 없어요 🌿<br>확언 화면에서 ⭐를 눌러 저장해보세요.</div>';
            return;
        }
        // 최신 저장 순서 (역순)
        const sorted = [...favs].reverse();
        let html = '';
        sorted.forEach(dc => {
            const dataIndex = (dc-1) % affirmationsData.length;
            const data = affirmationsData[dataIndex];
            const shortText = data.text.length>60 ? data.text.substring(0,60)+'...' : data.text;
            html += `<div class="fav-card" onclick="openFavDetail(${dc})">
                <div class="fav-card-top">
                    <div class="fav-card-meta">
                        <span class="fav-card-day">D${dc}</span>
                        <span class="fav-card-theme">${data.theme}</span>
                    </div>
                    <button class="fav-card-del" onclick="event.stopPropagation();deleteFav(${dc})">삭제</button>
                </div>
                <div class="fav-card-text">${shortText}</div>
            </div>`;
        });
        container.innerHTML = html;
    }


    window.openFavDetail = function(dc){
        const dataIndex = (dc-1) % affirmationsData.length;
        const data = affirmationsData[dataIndex];
        const old = document.getElementById('fav-detail-modal');
        if(old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'fav-detail-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:6000;display:flex;align-items:flex-end;justify-content:center;';
        const inner = document.createElement('div');
        inner.style.cssText = 'background:var(--bg-color);border-radius:20px 20px 0 0;padding:28px 22px 44px;width:100%;max-width:600px;box-sizing:border-box;max-height:85vh;overflow-y:auto;';
        inner.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
            '<span style="font-size:0.85em;color:var(--text-muted);">📅 D' + dc + ' · ' + (data.theme||'') + '</span>' +
            '<button id="fav-close-btn" style="background:none;border:none;font-size:1.3em;cursor:pointer;color:var(--text-muted);">✕</button>' +
            '</div>' +
            '<div style="font-size:1.05em;font-weight:600;color:var(--primary-color);line-height:1.9;margin-bottom:18px;">"' + (data.text||'') + '"</div>' +
            '<div style="background:var(--card-bg);border-radius:12px;padding:14px;margin-bottom:16px;font-size:0.85em;color:var(--text-muted);line-height:1.7;">' +
            '<div style="font-size:0.8em;font-weight:700;color:var(--primary-color);margin-bottom:4px;">🎯 오늘의 행동 지침</div>' +
            (data.action||'') + '</div>' +
            '<div style="display:flex;gap:8px;">' +
            '<button id="fav-speak-btn" style="flex:1;min-height:44px;background:var(--primary-color);color:#fff;border:none;border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;">🔊 듣기</button>' +
            '<button id="fav-goto-btn" style="flex:1;min-height:44px;background:var(--card-bg);color:var(--primary-color);border:1px solid var(--border-color);border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;">📅 날짜로 이동</button>' +
            '</div>';
        modal.appendChild(inner);
        document.body.appendChild(modal);
        document.getElementById('fav-close-btn').onclick = function(){ modal.remove(); };
        document.getElementById('fav-speak-btn').onclick = function(){ speakTextOnce(data.text); showToast('🔊 재생 중...'); };
        document.getElementById('fav-goto-btn').onclick = function(){ goToFav(dc); modal.remove(); };
        modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
    };

    window.goToFav = function(dc, bypassCap){
        // 해당 day로 이동
        if(currentMode==='A'){
            let minDateA=new Date(todayObj.getFullYear(),0,1);
            selectedDateObj=new Date(minDateA.getTime()+(dc-1)*86400000);
        } else {
            const startStr=safeGetItem('start_date_B',null);
            if(startStr){
                let parts=startStr.split('-');
                let minDateB=new Date(parts[0],parts[1]-1,parts[2]);
                selectedDateObj=new Date(minDateB.getTime()+(dc-1)*86400000);
            }
        }
        // ★ bypassCap=true면 미래 날짜도 허용
        if(!bypassCap && selectedDateObj>todayObj) selectedDateObj=new Date(todayObj);
        // ★ bypassCap은 switchView 전에 반드시 설정 (renderScreen이 내부에서 실행됨)
        window._bypassDateCap = !!bypassCap;
        switchView('home');
    }

    window.deleteFav = function(dc){
        let favs=safeGetJSON('favorites',[]);
        favs=favs.filter(d=>d!==dc);
        safeSetJSON('favorites',favs);
        safeSetJSON('fav_count_total',favs.length);
        renderFavoritesPage();
        renderDashboard();
        updateFavButton(getDayCountNow());
        showToast('즐겨찾기에서 삭제됐어요');
    }

    let favTtsIndex=0;
    let favTtsArray=[];
    window.playFavsInOrder=function(loop){
        const favs=safeGetJSON('favorites',[]);
        if(!favs.length){showToast('즐겨찾기한 확언이 없어요');return;}
        favTtsArray=[...favs];
        favTtsIndex=0;
        favTtsLoop=!!loop;
        showToast(loop?'🔁 전체 무한반복 재생 중...':'▶️ 순서대로 재생 중...');
        playNextFav();
    }
    window.playFavRandom=function(){
        const favs=safeGetJSON('favorites',[]);
        if(!favs.length){showToast('즐겨찾기한 확언이 없어요');return;}
        const dc=favs[Math.floor(Math.random()*favs.length)];
        const data=affirmationsData[(dc-1)%affirmationsData.length];
        speakTextOnce(data.text);
        showToast('🎲 '+data.theme);
    }
    let favTtsLoop = false;
    function playNextFav(){
        if(favTtsIndex>=favTtsArray.length){
            if(favTtsLoop){ favTtsIndex=0; }
            else { showToast('모두 들었어요 ✅'); return; }
        }
        const dc=favTtsArray[favTtsIndex];
        const data=affirmationsData[(dc-1)%affirmationsData.length];
        speakTextOnce(data.text,()=>{favTtsIndex++;setTimeout(playNextFav,1500);});
    }
    function speakTextOnce(text,cb){
        if(!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const u=new SpeechSynthesisUtterance(text);
        u.lang='ko-KR'; u.rate=0.85;
        if(cb) u.onend=cb;
        window.speechSynthesis.speak(u);
    }

    /* ===== ★ 5단계: 오라클 ===== */
    window.openOracle = function(){
        const rnd=Math.floor(Math.random()*affirmationsData.length);
        const data=affirmationsData[rnd];
        currentOracleDayCount=rnd+1;
        document.getElementById('oracle-theme-text').textContent='"'+data.theme+'"';
        document.getElementById('oracle-affirmation-text').textContent=data.text;
        document.getElementById('oracle-action-text').textContent=data.action;
        // 즐겨찾기 버튼 상태
        const favs=safeGetJSON('favorites',[]);
        const fb=document.getElementById('oracle-fav-btn');
        if(favs.includes(currentOracleDayCount)){
            fb.textContent='★ 저장됨';
            fb.style.opacity='0.6';
        } else {
            fb.textContent='⭐ 저장';
            fb.style.opacity='1';
        }
        document.getElementById('oracle-modal').style.display='flex';
    }
    window.favOracle=function(){
        let favs=safeGetJSON('favorites',[]);
        if(!favs.includes(currentOracleDayCount)){
            favs.push(currentOracleDayCount);
            safeSetJSON('favorites',favs);
            safeSetJSON('fav_count_total',favs.length);
            const fb=document.getElementById('oracle-fav-btn');
            fb.textContent='★ 저장됨';
            fb.style.opacity='0.6';
            showToast('즐겨찾기에 추가됐어요!');
            updateFavButton(getDayCountNow());
            renderDashboard();
        }
    }
    window.oracleOverlayClick=function(e){
        if(e.target.id==='oracle-modal'){
            document.getElementById('oracle-modal').style.display='none';
        }
    }

    /* ===== ★ 5단계: 구독 유도 팝업 ===== */
    function showSubscribeNudge(){
        const shown=safeGetItem('subscribe_nudge_shown','');
        if(shown==='true') return;
        safeSetItem('subscribe_nudge_shown','true');
        setTimeout(()=>{
            document.getElementById('subscribe-modal').style.display='flex';
        },400);
    }

    /* ===== 배경음악 ===== */
    let audioCtx=null,bgmGainNode=null,bgmFilter=null,bgmSource=null,isBgmOn=false,bgmInitialized=false;
    const VOL_NORMAL=0.3,VOL_DUCK=0.05;
    function initAudioContext(){if(!audioCtx){try{const A=window.AudioContext||window.webkitAudioContext;audioCtx=new A();bgmGainNode=audioCtx.createGain();bgmGainNode.gain.value=0;bgmGainNode.connect(audioCtx.destination);}catch(e){}}}
        let bgmType = parseInt(safeGetItem('bgm_type','0'))||0;
    const BGM_TYPES = [
        {label:'🌊 파도', icon:'🌊'},
        {label:'🌧️ 빗소리', icon:'🌧️'},
        {label:'🐦 새소리', icon:'🐦'},
        {label:'🎵 음악상자', icon:'🎵'}
    ];
    function createBgmByType(type){
        if(!audioCtx) return null;
        try{
            if(type===0) return createWaveSound();
            if(type===1) return createRainSound();
            if(type===2) return createBirdSound();
            if(type===3) return createMusicBoxSound();
        }catch(e){ return createWaveSound(); }
        return createWaveSound();
    }
    function makePink(dur){
        var sr=audioCtx.sampleRate,len=sr*dur,buf=audioCtx.createBuffer(1,len,sr),d=buf.getChannelData(0),b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for(var i=0;i<len;i++){var w=Math.random()*2-1;b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.96900*b2+w*0.1538520;b3=0.86650*b3+w*0.3104856;b4=0.55000*b4+w*0.5329522;b5=-0.7616*b5-w*0.0168980;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;b6=w*0.115926;}
        return buf;
    }
    function createWaveSound(){
        var src=audioCtx.createBufferSource(),lp=audioCtx.createBiquadFilter(),amp=audioCtx.createGain(),mod=audioCtx.createOscillator(),mg=audioCtx.createGain();
        src.buffer=makePink(8);src.loop=true;lp.type='lowpass';lp.frequency.value=300;mod.frequency.value=0.1;mod.type='sine';mg.gain.value=0.22;amp.gain.value=0.78;
        mod.connect(mg);mg.connect(amp.gain);src.connect(lp);lp.connect(amp);amp.connect(bgmGainNode);mod.start(0);src.start(0);src._extra=[mod];return src;
    }
    function createRainSound(){
        var src=audioCtx.createBufferSource();
        var lp=audioCtx.createBiquadFilter();
        var amp=audioCtx.createGain();
        var mod=audioCtx.createOscillator();
        var mg=audioCtx.createGain();
        src.buffer=makePink(6); src.loop=true;
        lp.type='lowpass'; lp.frequency.value=800;
        mod.frequency.value=0.15; mod.type='sine';
        mg.gain.value=0.12; amp.gain.value=0.55;
        mod.connect(mg); mg.connect(amp.gain);
        src.connect(lp); lp.connect(amp); amp.connect(bgmGainNode);
        mod.start(0); src.start(0);
        src._extra=[mod]; return src;
    }
    var _bt=[];
    function _sb(){_bt.forEach(function(t){clearTimeout(t);});_bt=[];}
    function _ch(f){
        if(!audioCtx||!isBgmOn) return;
        try{var o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(f,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(f*1.3,audioCtx.currentTime+0.08);o.frequency.exponentialRampToValueAtTime(f*0.9,audioCtx.currentTime+0.2);g.gain.setValueAtTime(0,audioCtx.currentTime);g.gain.linearRampToValueAtTime(0.55,audioCtx.currentTime+0.02);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);o.connect(g);g.connect(bgmGainNode);o.start(audioCtx.currentTime);o.stop(audioCtx.currentTime+0.25);}catch(e){}
    }
    function createBirdSound(){
        var src=audioCtx.createBufferSource(),lp=audioCtx.createBiquadFilter(),amp=audioCtx.createGain();
        src.buffer=makePink(6);src.loop=true;lp.type='lowpass';lp.frequency.value=500;amp.gain.value=0.08;
        src.connect(lp);lp.connect(amp);amp.connect(bgmGainNode);src.start(0);
        _sb();
        var freqs=[2400,3000,2800,3600,4000,3200];
        function next(){
            var t=setTimeout(function(){
                if(!isBgmOn) return;
                var f=freqs[Math.floor(Math.random()*freqs.length)];
                var n=Math.floor(Math.random()*4)+2;
                for(var i=0;i<n;i++){
                    (function(ii){
                        var bt=setTimeout(function(){ _ch(f+Math.random()*200); },ii*160);
                        _bt.push(bt);
                    })(i);
                }
                next();
            }, 1000+Math.random()*2500);
            _bt.push(t);
        }
        // isBgmOn이 true로 세팅된 후 시작
        setTimeout(function(){ next(); }, 200);
        return src;
    }
    var _mt=null;
    function _sm(){if(_mt){clearTimeout(_mt);_mt=null;}}
    function createMusicBoxSound(){
        var scale=[523.25,587.33,659.25,783.99,880,1046.5],pats=[[0,2,4,5,4,2],[0,4,2,5],[5,3,1,0,2]],ni=0,pi=0,pat=pats[0];
        function note(){if(!isBgmOn)return;try{var o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;o.type='sine';o.frequency.value=scale[pat[ni%pat.length]];g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(0.18,t+0.01);g.gain.exponentialRampToValueAtTime(0.001,t+1.8);o.connect(g);g.connect(bgmGainNode);o.start(t);o.stop(t+1.9);}catch(e){}ni++;if(ni%pat.length===0){pi=(pi+1)%pats.length;pat=pats[pi];}_mt=setTimeout(note,700+Math.random()*400);}
        _mt=setTimeout(note,150);return null;
    }
    
    window.selectBgmType = function(type){
        bgmType = type;
        safeSetItem('bgm_type', String(type));
        // 재생 중이면 재시작
        if(isBgmOn){
            if(bgmSource){ _sb();_sm(); if(!bgmSource._isMusicBox&&!bgmSource._isBird){try{bgmSource.stop();}catch(e){}} bgmSource=null; }
            bgmSource = createBgmByType(bgmType);
        }
        // UI 업데이트
        updateBgmUI();
        document.getElementById('bgm-selector-modal')?.remove();
    };

    window.openBgmSelector = function(){
        const existing = document.getElementById('bgm-selector-modal');
        if(existing){ existing.remove(); return; }

        const modal = document.createElement('div');
        modal.id = 'bgm-selector-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:6000;display:flex;align-items:flex-end;justify-content:center;';

        const sheet = document.createElement('div');
        sheet.style.cssText = 'background:var(--bg-color);border-radius:20px 20px 0 0;padding:20px 20px 40px;width:100%;max-width:600px;box-sizing:border-box;';
        sheet.innerHTML = '<div style="text-align:center;font-weight:700;color:var(--primary-color);font-size:1em;margin-bottom:6px;">🎵 배경음악 선택</div>' +
            '<div style="text-align:center;font-size:0.78em;color:var(--text-muted);margin-bottom:16px;">확언에 집중하는 데 도움이 되는 소리를 골라보세요</div>';

        const options = [
            {type:-1, icon:'🔇', label:'끄기', desc:'배경음악 없음'},
            {type:0,  icon:'🌊', label:'파도', desc:'잔잔한 파도 소리'},
            {type:1,  icon:'🌧️', label:'빗소리', desc:'잔잔한 빗소리'},
            {type:2,  icon:'🐦', label:'새소리', desc:'자연 새소리'},
            {type:3,  icon:'🎵', label:'음악상자', desc:'잔잔한 오르골'},
        ];

        options.forEach(function(opt){
            const isActive = (opt.type === -1 && !isBgmOn) || (opt.type === bgmType && isBgmOn);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;cursor:pointer;background:' + (isActive?'var(--card-bg)':'transparent') + ';margin-bottom:4px;border:' + (isActive?'1.5px solid var(--primary-color)':'1.5px solid transparent') + ';';
            row.innerHTML = '<span style="font-size:24px;">' + opt.icon + '</span>' +
                '<div style="flex:1;"><div style="font-size:0.9em;font-weight:' + (isActive?'700':'500') + ';color:var(--text-color);">' + opt.label + '</div>' +
                '<div style="font-size:0.75em;color:var(--text-muted);">' + opt.desc + '</div></div>' +
                (isActive ? '<span style="color:var(--primary-color);font-size:1.1em;">✓</span>' : '');
            row.onclick = function(){
                if(opt.type === -1){
                    pauseBGM();
                } else {
                    bgmType = opt.type;
                    safeSetItem('bgm_type', String(bgmType));
                    if(bgmSource){ try{ bgmSource.stop(); }catch(e){} bgmSource=null; }
                    playBGM();
                }
                updateBgmUI();
                modal.remove();
            };
            sheet.appendChild(row);
        });

        modal.appendChild(sheet);
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
    };

    function playBGM(){try{initAudioContext();if(!audioCtx)return;if(audioCtx.state==='suspended')audioCtx.resume();if(!bgmSource){bgmSource=createBgmByType(bgmType);}isBgmOn=true;safeSetItem('bgm_state','on');updateBgmUI();bgmGainNode.gain.setTargetAtTime(isTtsPlaying?VOL_DUCK:VOL_NORMAL,audioCtx.currentTime,0.5);}catch(e){}}
    function pauseBGM(){try{_sb();_sm();isBgmOn=false;safeSetItem('bgm_state','off');updateBgmUI();if(bgmGainNode&&audioCtx){bgmGainNode.gain.setTargetAtTime(0,audioCtx.currentTime,0.5);setTimeout(()=>{if(!isBgmOn&&audioCtx.state==='running')audioCtx.suspend();},1000);}}catch(e){}}
    window.toggleBGM=function(){if(!bgmInitialized){bgmInitialized=true;document.removeEventListener('click',unlockAudio);document.removeEventListener('touchstart',unlockAudio);}isBgmOn?pauseBGM():playBGM();}
    function updateBgmUI(){
        const btn=document.getElementById('btn-bgm'),ic=document.getElementById('bgm-icon'),tx=document.getElementById('bgm-text');
        const hdrBtn=document.getElementById('header-bgm-btn');
        if(isBgmOn){
            if(btn){ btn.classList.add('on'); }
            if(ic) ic.innerText = BGM_TYPES[bgmType]?.icon || '🎵';
            if(tx) tx.innerText = '배경음악 · ' + (BGM_TYPES[bgmType]?.label || '');
            if(hdrBtn) hdrBtn.textContent = BGM_TYPES[bgmType]?.icon || '🎵';
            if(hdrBtn) hdrBtn.style.background = 'var(--accent-color)';
            if(hdrBtn) hdrBtn.style.color = 'var(--primary-color)';
        } else {
            if(btn) btn.classList.remove('on');
            if(ic) ic.innerText='🎵';
            if(tx) tx.innerText='배경음악';
            if(hdrBtn){ hdrBtn.textContent='🎵'; hdrBtn.style.background='var(--primary-color)'; hdrBtn.style.color='#fff'; }
        }
    }

    function applyDucking(){if(isBgmOn&&bgmGainNode&&audioCtx)bgmGainNode.gain.setTargetAtTime(VOL_DUCK,audioCtx.currentTime,0.5);}
    function removeDucking(){if(isBgmOn&&bgmGainNode&&audioCtx)bgmGainNode.gain.setTargetAtTime(VOL_NORMAL,audioCtx.currentTime,0.5);}
    function unlockAudio(){
        if(bgmInitialized) return;
        try{
            initAudioContext();
            if(audioCtx){
                // 아이폰/안드로이드 오디오 컨텍스트 강제 해제
                audioCtx.resume().then(()=>{
                    bgmInitialized = true;
                    // 배경음악 자동 재생 설정 확인
                    if(safeGetItem('bgm_state','off')==='on') playBGM();
                }).catch(()=>{ bgmInitialized = true; });
            } else {
                bgmInitialized = true;
            }
        } catch(e){ bgmInitialized = true; }
        // 리스너 제거
        document.removeEventListener('click',    unlockAudio);
        document.removeEventListener('touchstart', unlockAudio);
        document.removeEventListener('touchend',   unlockAudio);
        document.removeEventListener('keydown',    unlockAudio);
    }
    // 모바일 대응 — touchend 및 keydown도 추가
    document.addEventListener('click',     unlockAudio, {once:true});
    document.addEventListener('touchstart', unlockAudio, {once:true, passive:true});
    document.addEventListener('touchend',   unlockAudio, {once:true, passive:true});
    document.addEventListener('keydown',    unlockAudio, {once:true});

    /* ===== TTS ===== */
    let isTtsPlaying=false,isTtsLooping=false,ttsTimeout=null,currentAffirmation='';
    window.playTTS=function(loop){try{if(!('speechSynthesis'in window)){alert('이 브라우저는 음성 낭독을 지원하지 않습니다.');return;}if(isTtsPlaying){if(isTtsLooping===loop){stopTTS();return;}else{stopTTS();}}window.speechSynthesis.cancel();clearTimeout(ttsTimeout);isTtsPlaying=true;isTtsLooping=loop;currentAffirmation=document.getElementById('affirmation-text').innerText.replace(/["']/g,'');updateTTSUI();applyDucking();speakText('따라 해보세요.',()=>{if(isTtsPlaying)speakAffirmation();});}catch(e){stopTTS();}}
    function speakAffirmation(){speakText(currentAffirmation,()=>{if(isTtsPlaying){if(isTtsLooping){ttsTimeout=setTimeout(()=>{if(isTtsPlaying&&isTtsLooping)speakAffirmation();},3000);}else{stopTTS();}}});}
    function speakText(text,cb){if(!isTtsPlaying)return;const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.rate=0.85;u.volume=1.0;u.onend=()=>{if(cb)cb();};u.onerror=()=>{stopTTS();};window.speechSynthesis.speak(u);}
    window.stopTTS=function(){try{isTtsPlaying=false;isTtsLooping=false;clearTimeout(ttsTimeout);if('speechSynthesis'in window)window.speechSynthesis.cancel();removeDucking();updateTTSUI();}catch(e){}}
    function updateTTSUI(){const bl=document.getElementById('btn-listen'),bp=document.getElementById('btn-loop');if(!bl||!bp)return;if(isTtsPlaying){if(isTtsLooping){bp.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" style="margin-right:6px;flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>정지';bp.classList.add('active-play');bl.disabled=true;}else{bl.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" style="margin-right:6px;flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>정지';bl.classList.add('active-play');bp.disabled=true;}}else{bl.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="margin-right:6px;flex-shrink:0;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>소리로 듣기';bl.classList.remove('active-play');bl.disabled=false;bp.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="margin-right:6px;flex-shrink:0;"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>무한재생';bp.classList.remove('active-play');bp.disabled=false;}}

    /* ===== 화면 전환 ===== */
    // ★ 뷰 히스토리 스택
    window._viewHistory = [];
    window._currentView = 'home';

    window.switchView = function switchView(viewName, _fromBack){
        if(typeof window.stopTTS==='function')stopTTS();
        // 뷰 히스토리 스택 관리 (뒤로가기용)
        if(!_fromBack){
            if(window._currentView && window._currentView !== viewName){
                window._viewHistory.push(window._currentView);
                // 최대 20개만 유지
                if(window._viewHistory.length > 20) window._viewHistory.shift();
            }
        }
        window._currentView = viewName;
        document.querySelectorAll('.view-section').forEach(el=>el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
        const titles={home:'오늘의 확언',calendar:'달력 및 통계',favorites:'내 최애 확언 ⭐',memo:'메모장',story:'나의 다짐 🎯',settings:'앱 설정',shorts:'오늘의 실천 📣',completion:'완주 축하합니다!'};
        document.getElementById('main-header-title').innerText=titles[viewName]||'오늘의 확언';
        if(viewName==='home'){
            document.getElementById('view-home').classList.add('active');
            document.getElementById('nav-home').classList.add('active');
            renderScreen();
        } else if(viewName==='calendar'){
            document.getElementById('view-calendar').classList.add('active');
            document.getElementById('nav-calendar').classList.add('active');
            calYear=todayObj.getFullYear();calMonth=todayObj.getMonth()+1;
            renderCalendar();renderDashboard();checkMissions();
            renderEnhancedStats();
            renderHallOfFame();
            check300DayBanner();
            renderDiaryPromoCard();
            renderIdentityLabel(); // ★ 정체성 라벨
            render100DayCertButton(); // ★ 100일 인증 버튼
        } else if(viewName==='favorites'){
            document.getElementById('view-favorites').classList.add('active');
            document.getElementById('nav-favorites').classList.add('active');
            renderFavoritesPage();
            renderPsychPreview(); // ★ 심리테스트 미리보기 카드 렌더링
        } else if(viewName==='memo'){
            document.getElementById('view-memo').classList.add('active');
            document.getElementById('nav-memo').classList.add('active');
            // ★ 필사 탭으로 초기화
            switchMemoTab('write');
        } else if(viewName==='psych'){
            document.getElementById('view-psych').classList.add('active');
            const navPsych = document.getElementById('nav-psych');
            if(navPsych) navPsych.classList.add('active');
        } else if(viewName==='story'){
            document.getElementById('view-story').classList.add('active');
            document.getElementById('nav-story').classList.add('active');
            initVowNavAndView();
            renderVowView();
        } else if(viewName==='shorts'){
            document.getElementById('view-shorts').classList.add('active');
            document.getElementById('nav-shorts').classList.add('active');
            setTimeout(renderShortsPointSummary, 100);
            // 풀잎(레벨2) 미만이면 잠금 안내
            if(getLevel(getPoints()) < 2){
                document.getElementById('shorts-declaration-area').innerHTML = `
                    <div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:16px;padding:24px 20px;margin-bottom:16px;">
                        <div style="font-size:0.78em;color:#C9A84C;font-weight:700;letter-spacing:1px;text-align:center;margin-bottom:10px;">🔓 풀잎 등급 달성 시 오픈</div>
                        <div style="font-size:1.1em;font-weight:700;color:#fff;text-align:center;margin-bottom:14px;">마음이 힘들 때 꺼내 먹는<br>🧪 확언 처방전</div>
                        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
                            <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;font-size:0.85em;color:rgba(255,255,255,0.9);">
                                💔 거절당한 날 → 자존감 회복 확언 영상
                            </div>
                            <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;font-size:0.85em;color:rgba(255,255,255,0.9);">
                                😔 자신이 없을 때 → 자기확신 확언 영상
                            </div>
                            <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;font-size:0.85em;color:rgba(255,255,255,0.9);">
                                🌀 불안하고 흔들릴 때 → 마음 안정 확언 영상
                            </div>
                        </div>
                        <div style="background:rgba(201,168,76,0.15);border-radius:12px;padding:12px 14px;margin-bottom:14px;border-left:3px solid #C9A84C;">
                            <div style="font-size:0.8em;font-weight:700;color:#C9A84C;margin-bottom:6px;">🧠 뇌과학이 증명한 효과</div>
                            <div style="font-size:0.76em;color:rgba(255,255,255,0.8);line-height:1.8;">
                                확언 콘텐츠를 보면 뇌의 <b style="color:#C9A84C;">vmPFC(내측 전전두엽)</b>가 활성화되며,<br>
                                스트레스 반응이 줄고 <b style="color:#C9A84C;">실제 행동 변화</b>로 이어집니다.<br>
                                <span style="font-size:0.88em;opacity:0.7;">— Falk et al., PNAS 2015 · Dutcher et al., SCAN 2020</span>
                            </div>
                        </div>
                        <div style="background:rgba(201,168,76,0.2);border-radius:10px;padding:10px 14px;margin-bottom:14px;text-align:center;">
                            <div style="font-size:0.8em;color:#C9A84C;font-weight:700;">🌱 현재: ${LEVELS[getLevel(getPoints())].emoji} ${LEVELS[getLevel(getPoints())].name}</div>
                            <div style="font-size:0.76em;color:rgba(255,255,255,0.7);margin-top:2px;">풀잎까지 <b style="color:#C9A84C;">${Math.max(0,150-getPoints())}PT</b> 남았어요! (약 6일)</div>
                        </div>
                        <button onclick="switchView('home')" style="width:100%;background:var(--accent-color);color:var(--primary-color);border:none;border-radius:12px;padding:12px;font-size:0.9em;font-weight:700;cursor:pointer;">🌿 오늘 확언 보러 가기</button>
                    </div>
                    <div style="font-size:0.78em;color:var(--text-muted);text-align:center;margin-top:8px;line-height:1.6;">
                        풀잎 달성 후 <b>실천 탭</b>을 다시 누르면 확언 처방전이 열려요 🌿
                    </div>`;
            } else {
                initShortsView();
            }
        } else if(viewName==='settings'){
            document.getElementById('view-settings').classList.add('active');
            initSettings();
        } else if(viewName==='completion'){
            document.getElementById('view-celebration').classList.add('active');
            document.getElementById('nav-calendar').classList.add('active');
        }
        window.scrollTo(0,0);
    }

    // ====================================================
    // ★ 심리테스트 전체 시스템
    // ====================================================
    // ====================================================
    // ★ 심리테스트 v3.0 — BFI-44 + Rosenberg + VIA
    // 출처: John, Donahue & Kentle (1991) / Rosenberg (1965) / Peterson & Seligman (2004)
    // ====================================================

    // 16가지 동물 유형 (E/O/A/C 4축 조합)

    // BFI-44 문항 (John, Donahue & Kentle, 1991) — 세계 표준 성격 검사

    const EMOJI_SCALE = ['😫','😟','😐','🙂','😊','😄','🤩'];

    // ★ 빠른 테스트용 단축 문항
    // ── 간편 테스트: BFI 20문항 + RSE 5문항 (축당 정/역 2문항씩 균형) ──
    const BFI_ITEMS_SHORT = [
        // E: 사교성 1+역1, 주도성 1+역1
        BFI_ITEMS.find(i=>i.id==='E1'),  BFI_ITEMS.find(i=>i.id==='E6'),
        BFI_ITEMS.find(i=>i.id==='E11'), BFI_ITEMS.find(i=>i.id==='E10'),
        // O: 지적탐구 1+역1, 예술감수성 1+역1
        BFI_ITEMS.find(i=>i.id==='O1'),  BFI_ITEMS.find(i=>i.id==='O4'),
        BFI_ITEMS.find(i=>i.id==='O9'),  BFI_ITEMS.find(i=>i.id==='O10'),
        // A: 공감능력 1+역1, 협력성 1+역1
        BFI_ITEMS.find(i=>i.id==='A1'),  BFI_ITEMS.find(i=>i.id==='A4'),
        BFI_ITEMS.find(i=>i.id==='A9'),  BFI_ITEMS.find(i=>i.id==='A8'),
        // C: 계획성 1+역1, 성취지향 1+역1
        BFI_ITEMS.find(i=>i.id==='C1'),  BFI_ITEMS.find(i=>i.id==='C4'),
        BFI_ITEMS.find(i=>i.id==='C7'),  BFI_ITEMS.find(i=>i.id==='C8'),
        // N: 불안 1+역1, 감정기복 1+역1
        BFI_ITEMS.find(i=>i.id==='N1'),  BFI_ITEMS.find(i=>i.id==='N2'),
        BFI_ITEMS.find(i=>i.id==='N7'),  BFI_ITEMS.find(i=>i.id==='N6')
    ];
    const RSE_ITEMS_SHORT = [
        RSE_ITEMS.find(i=>i.id==='R1'), RSE_ITEMS.find(i=>i.id==='R7'), RSE_ITEMS.find(i=>i.id==='R9'),
        RSE_ITEMS.find(i=>i.id==='R2'), RSE_ITEMS.find(i=>i.id==='R6')
    ];
    // ── 4. 간편 테스트용 VIA 배열 (6대 덕목 핵심 1문항씩 총 6문항) ──
    const VIA_ITEMS_SHORT = [
        VIA_ITEMS.find(i=>i.id==='V2'),  // 지혜 (통찰/조언)
        VIA_ITEMS.find(i=>i.id==='V4'),  // 용기 (끈기/목표달성)
        VIA_ITEMS.find(i=>i.id==='V5'),  // 인간애 (이타심/도움)
        VIA_ITEMS.find(i=>i.id==='V7'),  // 정의 (공정성)
        VIA_ITEMS.find(i=>i.id==='V10'), // 절제 (감정통제)
        VIA_ITEMS.find(i=>i.id==='V12')  // 초월 (긍정/유머)
    ];

    let pA = {}; // psychAnswers
    let pStep = 0;
    let pMode = 'full';
    let pFontSize = 'normal'; // 'normal' | 'large' // 'full' | 'quick'
    const P_TOTAL = (typeof INFO_ITEMS !== 'undefined') ? INFO_ITEMS.length + BFI_ITEMS.length + RSE_ITEMS.length + VIA_ITEMS.length : 0;
    function getPTotal(){ return INFO_ITEMS.length + (pMode==='quick'?BFI_ITEMS_SHORT:BFI_ITEMS).length + (pMode==='quick'?RSE_ITEMS_SHORT:RSE_ITEMS).length + (pMode==='quick'?VIA_ITEMS_SHORT:VIA_ITEMS).length; }
    function getBFI(){ return pMode==='quick' ? BFI_ITEMS_SHORT : BFI_ITEMS; }
    function getRSE(){ return pMode==='quick' ? RSE_ITEMS_SHORT : RSE_ITEMS; }
    function getVIA(){ return pMode==='quick' ? VIA_ITEMS_SHORT : VIA_ITEMS; }

    // ★ 동물 유형별 추천 확언 - 직접 day 번호로 이동
    // ★ 동물 유형별 추천 확언 - 직접 day 번호로 이동 및 자동 스크롤
    function goToAnimalTheme(animalEmoji){
        // 동물 → 시작 day 번호 직접 매핑
        var dayMap = {
            '🦁':213,'🐘':121,'🦋':335,'🐺':274,
            '🐋':91, '🐆':244,'🦊':182,'🐢':182,
            '🦉':60, '🐯':213,'🦌':152,'🦅':244,
            '🐝':32, '🦢':335,'🐱':152,'🦒':1
        };
        var targetDay = dayMap[animalEmoji] || 1;
        
        // ★ bypassCap=true로 미래 날짜도 허용
        window._bypassDateCap = true; 
        goToFav(targetDay, true);
        
        // 정확한 위치로 부드럽게 스크롤 및 강조 애니메이션
        setTimeout(function(){
            var wrapBox = document.getElementById('affirmation-box-wrap');
            if(wrapBox){
                // 확언 박스가 화면 정중앙에 오도록 스크롤 (block: 'center')
                wrapBox.scrollIntoView({behavior:'smooth', block:'center'});
                
                // 맞춤 확언임을 알리는 시각적 강조 효과 (금빛 테두리 애니메이션)
                var innerBox = wrapBox.querySelector('.affirmation-box');
                if(innerBox){
                    var oldShadow = innerBox.style.boxShadow;
                    var oldTransition = innerBox.style.transition;
                    innerBox.style.transition = 'box-shadow 0.5s ease-in-out';
                    innerBox.style.boxShadow = '0 0 0 4px #C9A84C, 0 10px 30px rgba(201,168,76,0.5)';
                    
                    // 1.8초 후 원래대로 복귀
                    setTimeout(function(){
                        innerBox.style.boxShadow = oldShadow;
                        setTimeout(function(){ innerBox.style.transition = oldTransition; }, 500);
                    }, 1800);
                }
                
                showToast(`✨ ${animalEmoji} 유형에게 가장 어울리는 맞춤 확언이에요!`);
            }
        }, 400); // 화면 전환(switchView)이 끝날 시간을 고려해 0.4초 대기
    }

        // ★ 동물 유형별 추천 확언 day 매핑
    function getAnimalAffirmationDay(animalEmoji){
        const MAP = {
            '🦁': 213,  // 사자 → 용기 (Day 213)
            '🐘': 121,  // 코끼리 → 가족과 나 (Day 121)
            '🦋': 335,  // 나비 → 완성된 나 (Day 335)
            '🐺': 274,  // 늑대 → 관계 맺기 (Day 274)
            '🐋': 91,   // 고래 → 감정의 주인 되기 (Day 91)
            '🐆': 244,  // 표범 → 삶의 주도권 (Day 244)
            '🦊': 182,  // 여우 → 습관과 뇌의 과학 (Day 182)
            '🐢': 182,  // 거북이 → 습관과 뇌의 과학 (Day 182)
            '🦉': 60,   // 올빼미 → 상처받은 나를 이해하기 (Day 60)
            '🐯': 213,  // 호랑이 → 용기 (Day 213)
            '🦌': 152,  // 사슴 → 자존감의 회복 (Day 152)
            '🦅': 244,  // 독수리 → 삶의 주도권 (Day 244)
            '🐝': 32,   // 꿀벌 → 관계를 다시 보다 (Day 32)
            '🦢': 335,  // 백조 → 완성된 나 (Day 335)
            '🐱': 152,  // 고양이 → 자존감의 회복 (Day 152)
            '🦒': 1,    // 기린 → 새로 시작하는 나 (Day 1)
        };
        return MAP[animalEmoji] || 1;
    }

        // ★ 심리테스트 미리보기 카드 렌더링 (완료 여부에 따라 잠금/해제)
    function renderPsychPreview(){
        const CATEGORIES = [
            { icon:'💕', title:'연애 스타일', desc:'나는 어떤 방식으로 사랑하는 사람인가?', key:'love' },
            { icon:'💼', title:'일 스타일', desc:'내가 빛나는 환경은 어떤 곳인가?', key:'work' },
            { icon:'👥', title:'관계 스타일', desc:'친구 사이에서 나는 어떤 존재인가?', key:'friend' },
            { icon:'🌧️', title:'위기 대처법', desc:'힘들 때 나는 어떻게 회복하는가?', key:'hard' },
            { icon:'💰', title:'소비 성향', desc:'돈과 나의 관계는 어떠한가?', key:'money' },
            { icon:'🌱', title:'자존감 점수', desc:'지금 내 자존감은 몇 점인가?', key:'rse' },
            { icon:'✨', title:'핵심 강점', desc:'내가 몰랐던 나의 슈퍼파워는?', key:'via' },
        ];

        const saved = safeGetItem('psych_result_v2','');
        const done = !!saved;

        const makeHTML = (done) => CATEGORIES.map(cat => {
            if(done){
                return `<div onclick="showCategoryDetail('${cat.key}')"
                    style="background:var(--card-bg);border-radius:12px;padding:12px 14px;
                    border:1px solid #1B4332;display:flex;align-items:center;gap:12px;cursor:pointer;">
                    <span style="font-size:1.3em;flex-shrink:0;">${cat.icon}</span>
                    <div style="flex:1;">
                        <div style="font-size:0.88em;font-weight:700;color:#1B4332;">${cat.title}</div>
                        <div style="font-size:0.78em;color:var(--text-muted);margin-top:1px;">${cat.desc}</div>
                    </div>
                    <span style="font-size:0.8em;color:#1B4332;font-weight:700;white-space:nowrap;">결과 보기 🔓</span>
                </div>`;
            } else {
                return `<div style="background:var(--card-bg);border-radius:12px;padding:12px 14px;
                    border:1px solid var(--border-color);display:flex;align-items:center;gap:12px;opacity:0.75;">
                    <span style="font-size:1.3em;flex-shrink:0;">${cat.icon}</span>
                    <div>
                        <div style="font-size:0.88em;font-weight:700;color:var(--text-color);">${cat.title}</div>
                        <div style="font-size:0.78em;color:var(--text-muted);margin-top:1px;">${cat.desc}</div>
                    </div>
                    <span style="margin-left:auto;font-size:1.1em;">🔒</span>
                </div>`;
            }
        }).join('');

        // 즐겨찾기 탭 카드 업데이트
        const el = document.getElementById('psych-preview-list');
        if(el) el.innerHTML = makeHTML(done);

        // 심리테스트 모달 내부 카드 업데이트
        const mel = document.getElementById('psych-modal-preview');
        if(mel) mel.innerHTML = makeHTML(done);
    }

    // ★ 카테고리별 결과 팝업
    window.showCategoryDetail = function(key){
        const saved = safeGetItem('psych_result_v2','');
        if(!saved) return;
        const result = JSON.parse(saved);
        const s = result.scores;

        const catData = {
            love:   getLoveStyle(s),
            work:   getWorkStyle(s),
            friend: getFriendStyle(s),
            hard:   getHardStyle(s),
            money:  getMoneyStyle(s),
            rse:    getRseStyle(s.RSE),
            via:    getViaStyle(result.viaStrengths),
        };

        const cat = catData[key];
        const title = cat.title;
        const desc = cat.desc;
        const tip = cat.tip || '';
        const extra = key === 'rse'
            ? `<div style="background:var(--border-color);border-radius:6px;height:10px;margin:10px 0;">
                <div style="background:linear-gradient(90deg,#C9A84C,#1B4332);height:100%;border-radius:6px;width:${cat.score}%;"></div>
               </div>
               <div style="text-align:center;font-size:1.2em;font-weight:700;color:#1B4332;margin-bottom:6px;">${cat.score}점 / 100점</div>`
            : key === 'via'
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
                ${(cat.strengths||[]).map((s,i)=>`<span style="background:${i===0?'#1B4332':'var(--border-color)'};color:${i===0?'#fff':'var(--text-color)'};padding:4px 12px;border-radius:20px;font-size:0.82em;font-weight:700;">${i===0?'👑 ':''}${s}</span>`).join('')}
               </div>`
            : '';

        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:flex-end;justify-content:center;';
        modal.innerHTML = `
            <div style="background:var(--bg-color);border-radius:24px 24px 0 0;padding:28px 24px 40px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;">
                <div style="width:40px;height:4px;background:var(--border-color);border-radius:2px;margin:0 auto 20px;"></div>
                <div style="font-size:1.15em;font-weight:700;color:#1B4332;margin-bottom:14px;">${title}</div>
                ${extra}
                <div style="font-size:0.92em;line-height:1.9;color:var(--text-color);margin-bottom:14px;">${desc}</div>
                ${tip ? `<div style="background:#F0F7F4;border-radius:10px;padding:12px 14px;font-size:0.85em;color:#1B4332;margin-bottom:14px;">${tip}</div>` : ''}
                ${cat.video ? `<a href="${cat.video.url}" target="_blank"
                    style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#fff;border:1.5px solid #1B4332;border-radius:12px;text-decoration:none;margin-bottom:14px;">
                    <span style="font-size:1.4em;">📺</span>
                    <div style="flex:1;">
                        <div style="font-size:0.75em;color:#888;margin-bottom:2px;">이 영상이 도움될 거예요</div>
                        <div style="font-size:0.88em;font-weight:700;color:#1B4332;">${cat.video.label}</div>
                    </div>
                    <span style="font-size:1em;color:#1B4332;">▶</span>
                </a>` : ''}
                <button onclick="this.closest('div[style*=fixed]').remove()"
                    style="width:100%;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:0.95em;font-weight:700;cursor:pointer;">
                    닫기
                </button>
            </div>`;
        modal.addEventListener('click', e => { if(e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    window.startPsychTest = function(){
        const existing = document.getElementById('psych-modal');
        if(existing) existing.remove();

        const saved = safeGetItem('psych_result_v2','');
        const done = !!saved;
        let prevResult = null;
        if(done) try { prevResult = JSON.parse(saved); } catch(e){}
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

        const resultBanner = done && prevResult ? `
            <div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border:none;border-radius:16px;padding:20px;margin-bottom:16px;">
                <div style="text-align:center;margin-bottom:14px;">
                    <div style="font-size:0.75em;color:rgba(255,255,255,0.6);font-weight:700;margin-bottom:4px;">나의 확언 동물 유형</div>
                    <span style="font-size:3em;display:block;margin-bottom:6px;">${prevResult.animal.animal}</span>
                    <div style="font-size:1.15em;font-weight:900;color:#fff;">${prevResult.animal.name}${prevResult.variantKey ? '-'+prevResult.variantKey : ''}</div>
                    ${(prevResult.variant && prevResult.variant.label) ? `<div style="font-size:0.88em;color:#C9A84C;font-weight:700;margin-top:2px;">${prevResult.variant.label}</div>` : ''}
                    <div style="font-size:0.78em;color:rgba(255,255,255,0.55);margin-top:4px;">"${prevResult.animal.title}"</div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
                    <button onclick="viewMyPsychResult()" style="min-height:44px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;">📋 전체 결과 보기</button>
                    <button onclick="sharePsychMyResult()" style="min-height:44px;background:var(--card-bg);color:#1B4332;border:2px solid #1B4332;border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;">${prevResult.animal.animal} 내 결과 공유</button>
                </div>
                <button onclick="sharePsychInvite()" style="width:100%;min-height:40px;background:var(--card-bg);color:var(--text-muted);border:1px solid var(--border-color);border-radius:12px;font-size:0.85em;cursor:pointer;margin-bottom:8px;">💌 친구에게 테스트 추천하기</button>
                ${isStandalone
                    ? `<button onclick="downloadPsychPDF()" style="width:100%;min-height:40px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.85em;font-weight:700;cursor:pointer;margin-top:8px;">📄 결과지 PDF 저장</button>`
                    : `<button onclick="downloadPsychPDF()" style="width:100%;min-height:40px;background:#C9A84C;color:#1B4332;border:none;border-radius:12px;font-size:0.85em;font-weight:700;cursor:pointer;margin-top:8px;">📲 앱 설치하기 → 결과 저장</button>`}
                <div style="text-align:center;margin-top:10px;">
                    <button onclick="psychStartReal()" style="background:none;border:none;font-size:0.8em;color:var(--text-muted);cursor:pointer;text-decoration:underline;">🔄 다시 테스트하기</button>
                </div>
            </div>` : '';

        const modal = document.createElement('div');
        modal.id = 'psych-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:var(--bg-color);overflow-y:auto;display:flex;flex-direction:column;';
        modal.innerHTML = `
        <div style="min-height:100vh;display:flex;flex-direction:column;">
            <div style="background:#1B4332;padding:16px 20px;display:flex;align-items:center;gap:12px;">
                <button onclick="document.getElementById('psych-modal').remove();"
                    style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:1.3em;cursor:pointer;padding:0;">✕</button>
                <span style="font-size:0.9em;color:rgba(255,255,255,0.8);font-weight:700;">인생2막라디오 × 확언 유형 검사</span>
            </div>
            <div style="background:linear-gradient(160deg,#1B4332 0%,#2D6A4F 60%,#1B4332 100%);padding:32px 24px 28px;text-align:center;">
                <div style="font-size:0.85em;color:#C9A84C;font-weight:700;letter-spacing:2px;margin-bottom:14px;">🧠 3가지 과학 검사 기반</div>
                <div style="font-size:2.2em;font-weight:900;color:#fff;line-height:1.25;margin-bottom:14px;">나는 어떤<br>사람일까?</div>
                <div style="font-size:0.92em;color:rgba(255,255,255,0.85);line-height:1.9;">일·관계·위기·소비·자존감까지<br><b style="color:#C9A84C;">내가 몰랐던 나의 진짜 모습</b>을 알게 돼요</div>
            </div>
            <div style="background:#F0F7F4;padding:14px 20px;display:flex;justify-content:center;gap:16px;flex-wrap:wrap;">
                <div style="font-size:0.78em;color:#1B4332;font-weight:700;">🔬 세계 52개국 검증</div>
                <div style="font-size:0.78em;color:#1B4332;font-weight:700;">📊 정확도 약 90%</div>
                <div style="font-size:0.78em;color:#1B4332;font-weight:700;">⏱️ 약 10분 소요</div>
            </div>
            <div style="padding:20px;">
            ${resultBanner}
            <div style="margin-bottom:20px;">
                <div style="font-size:1em;font-weight:700;color:var(--text-color);margin-bottom:12px;">✅ 이런 걸 알 수 있어요</div>
                <div style="display:flex;flex-direction:column;gap:8px;" id="psych-modal-preview"></div>
            </div>
            <div style="background:var(--card-bg);border-radius:16px;padding:18px;margin-bottom:16px;border:1px solid var(--border-color);">
                <div style="font-size:0.9em;font-weight:700;color:var(--text-color);margin-bottom:14px;">🔬 어떤 검사로 분석하나요?</div>
                <div style="display:flex;flex-direction:column;gap:14px;">
                    <div style="display:flex;gap:12px;align-items:flex-start;">
                        <div style="background:#1B4332;color:#fff;border-radius:8px;padding:4px 8px;font-size:0.72em;font-weight:700;white-space:nowrap;flex-shrink:0;">Big 5</div>
                        <div>
                            <div style="font-size:0.85em;font-weight:700;color:var(--text-color);">BFI-44 성격 검사</div>
                            <div style="font-size:0.75em;color:var(--text-muted);margin-top:2px;">John, Donahue & Kentle (1991)</div>
                            <div style="font-size:0.75em;color:#1B4332;margin-top:4px;line-height:1.6;">전 세계 심리학자가 가장 많이 사용하는<br>표준 성격 검사. 44문항으로 외향성·개방성·<br>친화성·성실성·정서안정성을 정밀 측정해요.</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:12px;align-items:flex-start;">
                        <div style="background:#C9A84C;color:#1B4332;border-radius:8px;padding:4px 8px;font-size:0.72em;font-weight:700;white-space:nowrap;flex-shrink:0;">RSE</div>
                        <div>
                            <div style="font-size:0.85em;font-weight:700;color:var(--text-color);">Rosenberg 자존감 척도</div>
                            <div style="font-size:0.75em;color:var(--text-muted);margin-top:2px;">Rosenberg (1965)</div>
                            <div style="font-size:0.75em;color:#1B4332;margin-top:4px;line-height:1.6;">60년간 전 세계 52개국에서 검증된<br>가장 신뢰도 높은 자존감 측정 도구.<br>신뢰도(α) 0.88로 학술적으로 검증돼 있어요.</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:12px;align-items:flex-start;">
                        <div style="background:#2D6A4F;color:#fff;border-radius:8px;padding:4px 8px;font-size:0.72em;font-weight:700;white-space:nowrap;flex-shrink:0;">VIA</div>
                        <div>
                            <div style="font-size:0.85em;font-weight:700;color:var(--text-color);">VIA 강점 검사</div>
                            <div style="font-size:0.75em;color:var(--text-muted);margin-top:2px;">Peterson & Seligman (2004)</div>
                            <div style="font-size:0.75em;color:#1B4332;margin-top:4px;line-height:1.6;">긍정심리학의 창시자 셀리그만 교수팀이<br>개발한 강점 발견 도구. 나만의 슈퍼파워를<br>찾아드려요.</div>
                        </div>
                    </div>
                </div>
            </div>
            <div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:16px;padding:18px;margin-bottom:16px;text-align:center;">
                <div style="font-size:0.78em;color:#C9A84C;font-weight:700;margin-bottom:8px;">🧠 뇌과학이 말하는 자기이해의 힘</div>
                <div style="font-size:0.88em;color:#fff;line-height:1.8;">"자기 자신을 정확히 이해하는 사람은<br>정서 조절 능력이 <b style="color:#C9A84C;">최대 40% 더 높습니다"</b></div>
                <div style="font-size:0.72em;color:rgba(255,255,255,0.5);margin-top:8px;">— Duval & Wicklund, 1972</div>
            </div>
            <div style="background:#FFF8E7;border-radius:12px;padding:14px 16px;margin-bottom:20px;font-size:0.8em;color:#7A5500;line-height:1.8;">
                ⏱️ <b>약 10분 소요</b>  ·  🆓 완전 무료<br>
                📊 <b>정확도 약 90%</b> (BFI-44 기준)<br>
                🔄 30일 후 재검사로 변화를 숫자로 확인할 수 있어요
            </div>
            <div style="background:#F0F7F4;border-radius:16px;padding:16px;margin-bottom:12px;">
                <div style="font-size:0.85em;font-weight:700;color:#1B4332;text-align:center;margin-bottom:12px;">
                    검사 방식을 선택해주세요
                </div>
                <div style="display:flex;flex-direction:column;gap:10px;">
                    <button id="psych-quick-btn"
                        style="width:100%;min-height:64px;background:#fff;color:#1B4332;border:2px solid #1B4332;border-radius:14px;font-size:0.95em;font-weight:700;cursor:pointer;display:flex;align-items:center;padding:0 18px;gap:12px;text-align:left;">
                        <span style="font-size:1.7em;">⚡</span>
                        <div>
                            <div style="font-size:1em;font-weight:900;">빠른 테스트</div>
                            <div style="font-size:0.78em;color:#666;margin-top:2px;">약 5분 · 31문항</div>
                        </div>
                    </button>
                    <button id="psych-full-btn"
                        style="width:100%;min-height:64px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:0.95em;font-weight:700;cursor:pointer;display:flex;align-items:center;padding:0 18px;gap:12px;text-align:left;">
                        <span style="font-size:1.7em;">🔬</span>
                        <div>
                            <div style="font-size:1em;font-weight:900;">정밀 테스트</div>
                            <div style="font-size:0.78em;color:rgba(255,255,255,0.75);margin-top:2px;">약 13분 · 78문항 · 정확도 90%</div>
                        </div>
                    </button>
                </div>
            </div>
            <button onclick="sharePsychInvite()"
                style="width:100%;min-height:48px;background:var(--card-bg);color:#1B4332;border:2px solid #1B4332;border-radius:16px;font-size:0.95em;font-weight:700;cursor:pointer;margin-bottom:12px;">
                📤 친구에게 심리테스트 추천하기
            </button>
            <div style="text-align:center;font-size:0.78em;color:var(--text-muted);margin-bottom:30px;">약 10분 소요 · 무료 · 결과 저장됨</div>
            </div>
        </div>`;
        document.body.appendChild(modal);
        // ★ 빠른/정밀 버튼 이벤트 바인딩
        var _qb = document.getElementById('psych-quick-btn');
        var _fb = document.getElementById('psych-full-btn');
        if(_qb) _qb.addEventListener('click', function(){
            pMode = 'quick';
            document.getElementById('psych-modal').remove();
            psychStartReal('quick');
        });
        if(_fb) _fb.addEventListener('click', function(){
            pMode = 'full';
            document.getElementById('psych-modal').remove();
            psychStartReal('full');
        });
        setTimeout(renderPsychPreview, 100);
    }

    // ★ 전체 결과 다시 보기
    window.viewMyPsychResult = function(){
        const saved = safeGetItem('psych_result_v2','');
        if(!saved){ showToast('먼저 테스트를 완료해주세요!'); return; }
        const result = JSON.parse(saved);
        document.getElementById('psych-modal')?.remove();
        showPsychResult(result);
    }

    function sendPsychToSheet(result){
        if(SHEET_API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL') return;

        var pA = result.pAnswers || {};
        var af = result.allFacets || {};
        var via = result.viaScores || {};

        // ── B. BFI 원점수 (56개) ──
        var bfiRaw = {};
        ['E1','E2','E3','E4','E5','E6','E7','E8','E9','E10','E11','E12',
         'O1','O2','O3','O4','O5','O6','O7','O8','O9','O10','O11','O12',
         'A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','A12',
         'C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','C11','C12',
         'N1','N2','N3','N4','N5','N6','N7','N8'
        ].forEach(function(id){
            bfiRaw['bfi_'+id] = pA['bfi_'+id] || pA[id] || '';
        });

        // ── C. RSE 원점수 (10개) ──
        var rseRaw = {};
        ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10'].forEach(function(id){
            rseRaw['rse_'+id] = pA['rse_'+id] || pA[id] || '';
        });

        // ── D. VIA 원점수 (12개) ──
        var viaRaw = {};
        ['V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12'].forEach(function(id){
            viaRaw['via_'+id] = pA['via_'+id] || pA[id] || '';
        });

        // ── G. VIA 덕목 점수 계산 ──
        function viaAvg(ids){ 
            var vals = ids.map(function(id){ return Number(pA['via_'+id]||pA[id]||0); }).filter(function(v){ return v>0; });
            return vals.length ? Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length*20) : ''; // 1~5점 → 0~100
        }
        var viaScores = {
            via_지혜:    viaAvg(['V1','V2']),
            via_용기:    viaAvg(['V3','V4']),
            via_인간애:  viaAvg(['V5','V6']),
            via_정의:    viaAvg(['V7','V8']),
            via_절제:    viaAvg(['V9','V10']),
            via_초월:    viaAvg(['V11','V12'])
        };

        // ── 궁합 정보 ──
        var compatName = '';
        try {
            if(typeof ANIMAL_FACET_MAP !== 'undefined' && result.animal && result.variantKey) {
                var fc = ANIMAL_FACET_MAP[result.animal.animal];
                if(fc && fc.variants[result.variantKey] && fc.variants[result.variantKey].compatible) {
                    var cp = fc.variants[result.variantKey].compatible;
                    compatName = (cp.name||'') + '-' + (cp.variant||'') + ' ' + (cp.label||'');
                }
            }
        } catch(e){}

        var payload = Object.assign({
            action:      'psych_result_v2',
            // A. 메타데이터
            nickname:    safeGetItem('my_nickname','미설정'),
            email:       safeGetItem('my_email',''),
            date:        result.date,
            mode:        pMode || 'full',
            elapsed_sec: result._elapsedSec || '',
            age:         result.info ? result.info.age : '',
            region:      result.info ? result.info.region : '',
            route:       result.info ? result.info.route : '',
            // E. 페이싯 점수
            facet_sociability:     af.sociability||'',
            facet_assertiveness:   af.assertiveness||'',
            facet_intellect:       af.intellect||'',
            facet_aesthetics:      af.aesthetics||'',
            facet_compassion:      af.compassion||'',
            facet_cooperation:     af.cooperation||'',
            facet_order:           af.order||'',
            facet_industriousness: af.industriousness||'',
            facet_anxiety:         af.anxiety||'',
            facet_volatility:      af.volatility||'',
            // F. Big5 축 점수
            E: result.scores.E, O: result.scores.O,
            A: result.scores.A, C: result.scores.C,
            N: result.scores.N, RSE: result.scores.RSE,
            // H. 결과
            animalType:  result.animal ? result.animal.name : '',
            typeKey:     result.typeKey || '',
            variantKey:  result.variantKey || '',
            variantLabel: (result.variant && result.variant.label) ? result.variant.label : '',
            strengths:   result.viaStrengths ? result.viaStrengths.join(',') : '',
            compat:      compatName,
            mbtiAccurate: result.mbtiAccurate || '',
            animalFull:  (result.animal ? result.animal.name : '') + (result.variantKey ? '-' + result.variantKey : ''),
            animalEmoji: result.animal ? result.animal.animal : ''
        }, bfiRaw, rseRaw, viaRaw, viaScores);

        fetch(SHEET_API_URL, {
            method:'POST', mode:'no-cors',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
        }).catch(function(){});
    }

    function getScoreBar(score, color='#1B4332'){
        return `<div style="background:var(--border-color);border-radius:6px;height:8px;margin:4px 0;">
            <div style="background:${color};height:100%;border-radius:6px;width:${score}%;"></div></div>`;
    }

    function getLevelText(score){
        if(score >= 75) return '매우 높음';
        if(score >= 55) return '높은 편';
        if(score >= 45) return '보통';
        if(score >= 25) return '낮은 편';
        return '매우 낮음';
    }

    function getOverallDesc(s, animal, af){
        af = af || {};
        var soc  = af.sociability    != null ? af.sociability    : s.E;
        var ast  = af.assertiveness  != null ? af.assertiveness  : s.E;
        var itl  = af.intellect      != null ? af.intellect      : s.O;
        var aes  = af.aesthetics     != null ? af.aesthetics     : s.O;
        var cmp  = af.compassion     != null ? af.compassion     : s.A;
        var coo  = af.cooperation    != null ? af.cooperation    : s.A;
        var ord  = af.order          != null ? af.order          : s.C;
        var ind  = af.industriousness!= null ? af.industriousness: s.C;
        var anx  = af.anxiety        != null ? af.anxiety        : (100-s.N);
        var vol  = af.volatility     != null ? af.volatility     : (100-s.N);

        // E축: 사교성 × 주도성
        var socH = soc >= 50, astH = ast >= 50;
        var E = (socH && astH)  ? '사람들과 함께할 때 에너지가 올라오고, 자연스럽게 분위기를 이끄는 편이에요. 새로운 사람을 만나는 것도 두렵지 않고, 필요한 순간엔 먼저 나서서 방향을 제시해요.'
              : (socH && !astH) ? '사람들과 어울리는 걸 즐기고 모임에서 에너지를 얻어요. 다만 지휘하거나 앞장서기보다 함께 만들어가는 방식을 더 편하게 느껴요.'
              : (!socH && astH) ? '많은 사람과 어울리는 자리보다 한두 명과 깊이 나누는 대화에서 편안함을 느껴요. 그런데 정작 중요한 순간엔 망설이지 않고 의견을 분명하게 말하고 방향을 제시하는 편이에요. 조용해 보이지만 필요할 때는 앞에 서는 사람이에요.'
              :                   '혼자만의 시간에서 진짜 에너지를 얻어요. 앞에 나서기보다 깊이 생각하고 필요한 것만 조용히 실행하는 스타일이에요.';

        // O축: 지적탐구 × 예술감수성
        var itlH = itl >= 50, aesH = aes >= 50;
        var O = (itlH && aesH)  ? '새로운 아이디어와 이론을 탐구하는 걸 즐기면서, 아름다운 것에도 깊이 감동받아요. 논리와 감성이 함께 작동하는 드문 조합이에요.'
              : (itlH && !aesH) ? '복잡한 개념과 원리를 파고드는 것을 즐겨요. 아이디어의 구조와 논리에 끌리는 편이고, 분석적인 방식으로 세상을 이해해요.'
              : (!itlH && aesH) ? '이론보다는 감각과 감성으로 세상을 받아들여요. 아름다운 것에 민감하게 반응하고, 예술적 자극에서 깊은 울림을 느껴요.'
              :                   '검증된 방법과 익숙한 환경에서 안정감을 느껴요. 추상적인 이론보다 구체적이고 실용적인 것에서 가치를 찾아요.';

        // A축: 공감능력 × 협력성
        var cmpH = cmp >= 50, cooH = coo >= 50;
        var A = (cmpH && cooH)  ? '상대의 감정을 빠르게 알아차리고, 함께 맞춰가는 과정을 자연스럽게 즐겨요. 사람을 배려하는 것이 부담이 아니라 자연스러운 방식이에요.'
              : (cmpH && !cooH) ? '상대의 마음을 잘 읽고 깊이 공감하는 편이에요. 다만 팀 안에서 내 방식을 고집하는 경향이 있고, 협력보다 독립적으로 움직이는 게 더 편할 때도 있어요.'
              : (!cmpH && cooH) ? '감정보다 결과와 효율을 먼저 생각하는 편이에요. 그렇지만 팀 안에서 맡은 역할은 확실히 해내고, 공동의 목표를 위해 기꺼이 맞춰가요.'
              :                   '독립적이고 자신의 기준이 명확해요. 감정보다 사실을, 화합보다 솔직함을 중요하게 여기는 편이에요.';

        // C축: 계획성 × 성취지향
        var ordH = ord >= 50, indH = ind >= 50;
        var C = (ordH && indH)  ? '목표를 세우고 체계적으로 실행하는 데 강해요. 시작한 일은 끝까지 해내는 책임감이 있고, 높은 기준을 스스로에게 요구해요.'
              : (ordH && !indH) ? '계획적으로 움직이고 루틴을 지키는 걸 중요하게 여겨요. 큰 야망보다는 지금 하는 일을 안정적으로 잘 해내는 것에서 만족을 느껴요.'
              : (!ordH && indH) ? '즉흥적이고 유연하게 움직이는 편이지만, 하고자 하는 일에 대한 욕심과 의지는 강해요. 루틴보다 열정이 먼저예요.'
              :                   '즉흥적이고 자유로운 방식에서 실력이 나와요. 엄격한 계획보다 흐름에 맞게 움직이고, 창의적으로 문제를 해결해요.';

        // N축: 불안(낮을수록 안정) × 감정기복(낮을수록 안정)
        // anxiety/volatility 점수가 낮을수록 안정적
        var anxH = anx < 50, volH = vol < 50; // 낮으면 안정(HIGH안정)
        var N = (anxH && volH)  ? '정서적으로 매우 안정적이에요. 스트레스 상황에서도 냉정함을 유지하고, 주변에 심리적 안전감을 줘요.'
              : (anxH && !volH) ? '큰 걱정 없이 낙천적인 편이에요. 다만 감정이 한번 흔들리면 기복이 크게 올 수 있어요. 전반적으로는 긍정적인 에너지가 강해요.'
              : (!anxH && volH) ? '미래에 대한 걱정이 많은 편이지만, 감정 자체는 비교적 안정적으로 유지해요. 불안을 준비와 계획으로 다스리는 편이에요.'
              :                   '감수성이 풍부하고 감정을 깊이 느껴요. 걱정도 많고 감정 기복도 있지만, 그만큼 세상을 섬세하게 이해하고 공감 능력이 탁월해요.';

        return `<b>${animal.name}</b>인 당신에 대해 BFI-44가 알려주는 이야기예요.<br><br>` +
            `<b>🌊 에너지의 방향:</b> ${E}<br><br>` +
            `<b>💡 사고와 경험:</b> ${O}<br><br>` +
            `<b>🤝 관계의 방식:</b> ${A}<br><br>` +
            `<b>⚙️ 실행과 목표:</b> ${C}<br><br>` +
            `<b>🌡️ 감정의 온도:</b> ${N}`;
    }


    // ★ 핵심 원칙: 모든 스타일 함수는 동물 유형과 동일한 50% 기준 사용
    // E>=50=외향(☀️), E<50=내향(🌙)
    // O>=50=개방(🔥), O<50=실용(🌱)
    // A>=50=친화(🤝), A<50=독립(🦋)
    // C>=50=성실(⚡), C<50=유연(💭)

    function getLoveStyle(s){
        let title, desc, strength, caution, tip;
        const video = { url:'https://youtube.com/shorts/eF7D2lUPQII', label:'감정 표현이 어려운 당신에게' };
        // E, A, N 기반 (연애는 외향성+친화성+신경증 조합)
        const hiE = s.E >= 50, hiA = s.A >= 50, hiN = s.N >= 50;

        if(hiA && hiN){
            title = '💕 깊이 사랑하고 깊이 상처받는 연인';
            desc = `당신은 사랑에 진심을 다하는 사람이에요. 친화성(${s.A}%)이 높아 상대를 세심하게 배려하지만, 정서 민감도(신경증 ${s.N}%)도 높아 상대의 반응에 깊이 영향 받아요. 관계에서 확신과 안정감이 중요하며, 사랑받고 있다는 신호가 없으면 불안이 커질 수 있어요. ${hiE ? '외향적 에너지로 감정을 적극 표현하는 편이에요.' : '내향적으로 감정을 내면에서 많이 처리하는 편이에요.'}`;
            strength = '🌟 강점: 깊은 공감과 헌신. 상대의 감정을 세밀하게 감지하는 능력. 진정성 있는 사랑.';
            caution = '⚠️ 주의: 상대 반응에 과도한 의미 부여. 자신의 필요를 말하지 못하다 감정이 쌓임.';
            tip = '💡 성장 팁: Gottman(1994)의 연구에서 즉각적인 감정 표현이 관계 만족도를 높이는 핵심이에요. "나는 지금 이래서 서운해"를 바로 말하는 연습이 필요해요.';
        } else if(hiA && !hiN){
            title = '💕 안정적이고 헌신적인 동반자';
            desc = `당신은 사랑하는 사람에게 든든한 닻 같은 존재예요. 친화성(${s.A}%)이 높아 진심으로 배려하고, 정서 안정성(신경증 ${s.N}%)이 좋아 흔들리지 않는 관계의 기반을 만들어요. ${hiE ? '활발한 표현으로 상대를 기쁘게 하는 타입이에요.' : '조용하지만 행동으로 사랑을 보여주는 타입이에요.'} 갈등에서도 차분하게 해결책을 찾으며, 상대가 당신 곁에서 심리적 안전함을 느껴요.`;
            strength = '🌟 강점: 감정적 안정감과 배려의 균형. 장기 신뢰 관계 유지 능력. 갈등 시 차분한 대처.';
            caution = '⚠️ 주의: "괜찮은 척"하다 상대가 당신의 진짜 필요를 모를 수 있어요.';
            tip = '💡 성장 팁: 상대가 힘들 때 "어떻게 도와줄까?" 전에 "많이 힘들었겠다"로 감정을 먼저 인정해주세요.';
        } else if(!hiA && !hiN){
            title = '💕 독립적이고 자유로운 파트너';
            desc = `사랑이란 각자의 공간을 존중하면서 함께하는 것이라고 생각해요. 친화성(${s.A}%)이 낮아 집착보다 자유를 중시하고, 정서 안정성(신경증 ${s.N}%)이 좋아 상대 행동에 쉽게 흔들리지 않아요. ${hiE ? '직접적이고 솔직한 애정 표현을 선호해요.' : '언어보다 행동으로 사랑을 표현하는 타입이에요.'} 관계의 주도권을 중요하게 여기며, 서로 성장하는 파트너십을 이상적으로 봐요.`;
            strength = '🌟 강점: 건강한 자아 경계. 집착 없는 신뢰 관계. 상대 독립성 존중.';
            caution = '⚠️ 주의: 감정 표현 부족으로 상대가 사랑받지 못한다고 느낄 수 있어요.';
            tip = '💡 성장 팁: Chapman(1992)의 사랑의 언어에서 언어적 인정은 많은 사람의 주요 사랑 언어예요. 하루 한 번 "고마워"를 의식적으로 말해보세요.';
        } else {
            title = '💕 신중하게 마음을 여는 연인';
            desc = `관계가 안전하다고 확신될 때까지 시간이 필요한 타입이에요. 친화성(${s.A}%)이 낮아 쉽게 마음을 열지 않지만, 정서 민감도(신경증 ${s.N}%)가 높아 내면에서는 관계에 깊이 영향받아요. ${hiE ? '겉으로는 사교적이지만 진짜 마음을 여는 데는 시간이 걸려요.' : '소수의 깊고 진실된 관계를 선호해요.'} 한번 신뢰가 쌓이면 누구보다 깊고 진한 사랑을 해요.`;
            strength = '🌟 강점: 신뢰 후의 깊은 진정성. 경솔하지 않은 자기보호. 관계의 지속성.';
            caution = '⚠️ 주의: 과도한 신중함이 좋은 인연을 놓칠 수 있어요.';
            tip = '💡 성장 팁: 70% 확신에서 시작하는 용기가 더 많은 기회를 만들어줘요. 완벽한 타이밍은 오지 않아요.';
        }
        return { title, desc, strength, caution, tip, video };
    }

    function getWorkStyle(s){
        let title, desc, strength, caution, tip;
        const video = { url:'https://youtube.com/shorts/Q3vJyOXh9Y0', label:'그냥 이대로 살다가는 안 됩니다' };
        // C, O 기반 (일 스타일은 성실성+개방성 핵심)
        const hiC = s.C >= 50, hiO = s.O >= 50;

        if(hiC && hiO){
            title = '💼 혁신적 전략가';
            desc = `아이디어를 현실로 만드는 능력을 가졌어요. 개방성(${s.O}%)에서 나오는 창의적 발상과 성실성(${s.C}%)에서 나오는 실행력이 결합돼요. ${s.C >= 65 ? '높은 성실성으로 체계적으로 실행해요.' : '유연한 방식으로 창의성을 발휘해요.'} ${s.O >= 65 ? '풍부한 아이디어를 끊임없이 생성해요.' : '실용적 창의성으로 현실적 혁신을 만들어요.'} Barrick & Mount(1991)의 메타분석에서 성실성과 개방성 조합이 창의적 직무에서 가장 높은 성과를 냈어요.`;
            strength = '🌟 강점: 큰 그림과 세부 실행을 동시에. 기존 방식 개선 능력. 창의적이고 전략적인 문제 해결.';
            caution = '⚠️ 주의: 아이디어가 많아 우선순위 설정이 어려울 수 있어요.';
            tip = '💡 성장 팁: 60% 준비됐을 때 시작하고 나머지는 실행하며 채우는 방식이 더 큰 성과를 만들어요.';
        } else if(hiC && !hiO){
            title = '💼 탁월한 완수자';
            desc = `맡은 일을 반드시 끝내는 강력한 책임감이 있어요. 성실성(${s.C}%)이 높아 꼼꼼하고 체계적이며 신뢰도가 매우 높아요. ${s.C >= 65 ? '매우 체계적이고 규칙을 잘 따라요.' : '중요한 일에서 체계를 갖추는 신뢰로운 사람이에요.'} 안정적이고 예측 가능한 환경에서 최고의 실력을 발휘해요. Friedman et al.(1993)의 종단연구에서 성실성 높은 개인이 직업 만족도와 수명 모두에서 우위를 보였어요.`;
            strength = '🌟 강점: 높은 신뢰도와 책임감. 체계적 업무 처리. 마감 준수. 장기 프로젝트에서 특히 빛남.';
            caution = '⚠️ 주의: 완벽주의가 번아웃으로 이어질 수 있어요.';
            tip = '💡 성장 팁: "충분히 좋은 것(good enough)"을 받아들이는 연습이 필요해요. 80% 완성이 더 빠른 성과를 만들기도 해요.';
        } else if(!hiC && hiO){
            title = '💼 자유로운 창작자';
            desc = `자신만의 방식으로 일할 때 진짜 실력이 나와요. 개방성(${s.O}%)이 높아 창의적 아이디어가 넘치지만, 성실성(${s.C}%)이 낮아 체계적 실행이 도전이 될 수 있어요. ${s.O >= 65 ? '풍부한 상상력과 예술적 감수성이 강점이에요.' : '실용적 창의성으로 새로운 방식을 탐색해요.'} 예술, 기획, 연구, 콘텐츠 창작에서 빛나요.`;
            strength = '🌟 강점: 독창적인 아이디어. 새로운 관점에서 문제 접근. 창의적 환경에서의 몰입과 열정.';
            caution = '⚠️ 주의: 마감 관리와 루틴 유지가 어려울 수 있어요.';
            tip = '💡 성장 팁: 창의 작업(오전)과 루틴 업무(오후)를 시간대별로 분리해보세요.';
        } else {
            title = '💼 유연한 상황 대응자';
            desc = `상황 변화에 빠르게 적응하는 능력이 있어요. 성실성(${s.C}%)과 개방성(${s.O}%) 모두 중간 수준으로, 너무 경직되지도 산만하지도 않은 균형 잡힌 스타일이에요. ${s.E >= 50 ? '적극적으로 새 역할과 기회를 탐색해요.' : '신중하게 자신의 영역에서 깊이를 쌓아요.'} 팀 환경에서 다양한 역할을 맡을 수 있어요.`;
            strength = '🌟 강점: 다양한 상황 적응 유연성. 팀 내 다리 역할. 실용적 결과 도출.';
            caution = '⚠️ 주의: 한 분야 깊은 전문성이 부족할 수 있어요.';
            tip = '💡 성장 팁: "내가 전문가가 되고 싶은 한 가지"를 정하고 집중 투자해보세요.';
        }
        return { title, desc, strength, caution, tip, video };
    }

    function getFriendStyle(s){
        let title, desc, strength, caution, tip, video;
        // ★ 핵심: E>=50=외향(사람에서 에너지), A>=50=친화(따뜻한 관계)
        const hiE = s.E >= 50, hiA = s.A >= 50;

        if(hiE && hiA){
            title = '👥 따뜻하고 활기찬 연결자';
            desc = `사람들과 함께할 때 에너지가 충전되고(외향성 ${s.E}%), 진심으로 타인을 배려하는(친화성 ${s.A}%) 사람이에요. ${s.E >= 65 ? '어디서든 자연스럽게 분위기를 살리는 에너자이저예요.' : '적당한 에너지로 따뜻한 분위기를 만들어요.'} ${s.A >= 65 ? '배려와 공감이 탁월해 주변에서 힘을 얻어요.' : '협력적이면서도 자신의 의견도 말할 줄 알아요.'} Berkman & Syme(1979)의 연구에서 이런 사회적 연결성이 강한 사람들이 심리적 웰빙과 신체 건강 모두에서 높은 수치를 보였어요.`;
            strength = '🌟 강점: 새로운 환경에서 빠른 친화력. 갈등 시 중재 능력. 팀 사기를 높이는 긍정 에너지. 폭넓은 인간 네트워크.';
            caution = '⚠️ 주의: 모든 사람과 좋은 관계를 유지하려다 자신을 소진할 수 있어요.';
            tip = '💡 성장 팁: 관계의 폭만큼 깊이도 중요해요. 특별히 깊이 연결하고 싶은 3~5명에게 집중적인 시간을 투자해보세요.';
            video = { url:'https://youtube.com/shorts/7ZXaUCHowXM', label:'외로움이 줄어드는 과학적 방법' };
        } else if(hiE && !hiA){
            title = '👥 솔직하고 활력 넘치는 친구';
            desc = `에너지가 넘치고 솔직한 사람이에요. 외향성(${s.E}%)이 높아 새로운 사람 만나기를 즐기지만, 친화성(${s.A}%)이 낮아 모든 사람에게 맞추려 하지 않아요. ${s.E >= 65 ? '사회적 자극을 즐기며 다양한 사람들과 어울려요.' : '선택적으로 에너지를 써서 의미 있는 관계를 만들어요.'} 가식 없는 진정성 있는 관계를 가장 중요하게 여겨요.`;
            strength = '🌟 강점: 가식 없는 진정성. 솔직한 피드백. 에너지 넘치는 대화. 충성스럽고 확실한 관계.';
            caution = '⚠️ 주의: 솔직함이 때로 상처가 될 수 있어요.';
            tip = '💡 성장 팁: Gottman(1994)의 "비판 vs 불만" 구별 — "넌 왜 항상 그래"(비판)가 아닌 "이번엔 이게 불편했어"(불만)로 표현하면 관계가 깊어져요.';
            video = { url:'https://youtube.com/shorts/7ZXaUCHowXM', label:'외로움이 줄어드는 과학적 방법' };
        } else if(!hiE && hiA){
            title = '👥 깊고 진한 관계의 고수';
            desc = `넓은 인맥보다 깊은 신뢰를 선택하는 사람이에요. 내향적(외향성 ${s.E}%)이라 새로운 사람에게 마음을 여는 데 시간이 걸리지만, 친화성(${s.A}%)이 높아 한번 신뢰가 쌓이면 그 누구보다 깊고 지속적인 우정을 만들어요. ${s.A >= 65 ? '깊은 공감과 배려로 친구들이 의지하는 존재예요.' : '진심 어린 지지를 아끼지 않아요.'} "친구 1명"이지만 20년 지기인 관계들이 주변에 많아요.`;
            strength = '🌟 강점: 깊고 지속적인 관계 형성. 비밀 보관자. 진심 어린 지지와 공감. 관계에서의 일관성.';
            caution = '⚠️ 주의: 새로운 환경에서 외로움을 느낄 수 있어요.';
            tip = '💡 성장 팁: 새 사람을 만날 때 판단하려 하지 말고 지금 이 순간을 즐기는 연습을 해보세요.';
            video = { url:'https://youtube.com/shorts/n39bewOVsfM', label:'착하게 살수록 외로워지는 진짜 이유' };
        } else {
            title = '👥 선택적으로 연결하는 독립인';
            desc = `관계에서 질을 무엇보다 중요하게 여겨요. 내향적(외향성 ${s.E}%)이고 독립적(친화성 ${s.A}%)이어서 혼자 있는 시간이 편하고, 많은 사람들과 어울리는 것보다 혼자 생각하고 재충전하는 것을 선호해요. ${s.E < 35 ? '깊은 내향성으로 자신만의 풍부한 내면 세계를 가지고 있어요.' : '선택적으로 에너지를 배분하는 현명한 사람이에요.'} 소수의 신중하게 선택된 관계에서 진정한 연결을 경험해요.`;
            strength = '🌟 강점: 신중한 관계 선택. 혼자 있는 능력. 자아 안정성.';
            caution = '⚠️ 주의: 고립감을 느낄 수 있어요. Cacioppo & Patrick(2008) 연구에서 만성적 고독감은 건강에 영향을 미쳐요.';
            tip = '💡 성장 팁: 같은 관심사를 가진 소규모 그룹에서 시작하면 자연스럽게 깊은 관계가 형성돼요.';
            video = { url:'https://youtube.com/shorts/n39bewOVsfM', label:'착하게 살수록 외로워지는 진짜 이유' };
        }
        return { title, desc, strength, caution, tip, video };
    }

    function getHardStyle(s){
        let title, desc, strength, caution, tip, video;
        const stab = 100 - s.N;
        const hiStab = stab >= 50;

        if(stab >= 70){
            title = '🌧️ 바위 같은 정서적 안정감';
            desc = `위기 상황에서 흔들리지 않는 사람이에요. 정서 안정성(${stab}%)이 매우 높아 스트레스 상황에서도 냉정함을 유지하고 주변에 심리적 안전감을 줘요. Gray(1987)의 강화 민감성 이론에서 당신의 행동억제 체계(BIS)가 낮게 설정되어 위협 자극에 덜 민감해요. ${s.C >= 50 ? '체계적으로 문제를 분석하고 해결책을 찾아요.' : '유연하게 상황을 받아들이고 적응해요.'}`;
            strength = '🌟 강점: 위기 상황의 리더십. 명확한 판단력. 주변에 안정감 제공. 번아웃 저항력.';
            caution = '⚠️ 주의: 감정을 너무 억누르다 한꺼번에 터질 수 있어요.';
            tip = '💡 성장 팁: 힘들 때 도움을 요청하는 것이 약함이 아니에요. 가장 신뢰하는 사람에게 속마음을 털어놓는 연습을 해보세요.';
            video = { url:'https://youtube.com/shorts/TqLR5ZaaBpY', label:'힘들 때 딱 한 사람만 있으면 됩니다' };
        } else if(hiStab){
            title = '🌧️ 균형 잡힌 감정 조절자';
            desc = `감정이 있지만 잘 다스리는 편이에요. 정서 안정성(${stab}%)이 중간 이상으로, 힘든 일이 있으면 잠깐 흔들리지만 비교적 빠르게 자리를 잡아요. ${s.C >= 50 ? '체계적인 문제 해결로 위기를 돌파해요.' : '유연하게 상황을 받아들이며 회복해요.'} 과도하게 감정적이지도, 지나치게 억압하지도 않는 균형 있는 정서 조절 능력이에요.`;
            strength = '🌟 강점: 감정과 이성의 균형. 충분한 자기 정리 능력. 극단적 반응 없는 상황 대처.';
            caution = '⚠️ 주의: 혼자 정리하다 도움받을 타이밍을 놓칠 수 있어요.';
            tip = '💡 성장 팁: Pennebaker(1997) 연구에서 힘든 감정을 15~20분 글로 쓰는 것만으로도 면역력과 심리적 회복이 향상됐어요.';
            video = { url:'https://youtube.com/shorts/TqLR5ZaaBpY', label:'힘들 때 딱 한 사람만 있으면 됩니다' };
        } else {
            title = '🌧️ 풍부한 감수성의 소유자';
            desc = `감정을 아주 깊이 느끼는 사람이에요. 정서 민감도(신경증 ${s.N}%)가 높아 작은 자극에도 강하게 반응하고 상처가 오래 가는 편이에요. 하지만 이것은 약점이 아니에요 — 같은 이유로 타인의 아픔을 그 누구보다 잘 이해하고, 공감 능력과 예술적 감수성이 탁월해요. Nettle(2006)의 진화심리학에서 높은 신경증은 위험 감지 능력이 뛰어난 적응적 형질이에요. ${s.A >= 50 ? '깊은 공감으로 주변 사람들에게 위로가 되는 존재예요.' : '감수성이 창의적 에너지의 원천이 돼요.'}`;
            strength = '🌟 강점: 탁월한 공감 능력. 풍부한 내면 세계. 예술적 감수성. 진정성 있는 감정 표현.';
            caution = '⚠️ 주의: 부정적 감정이 되풀이되는 반추(rumination) 패턴에 빠질 수 있어요.';
            tip = '💡 성장 팁: 확언이 당신에게 특히 강력해요! 뇌의 신경가소성 연구에서 긍정적 자기대화 반복이 전전두엽-편도체 연결을 실제로 강화해요.';
            video = { url:'https://youtube.com/shorts/xwh3GA5FMO0', label:'상처 받았을 때 가장 먼저 해야 할 것' };
        }
        return { title, desc, strength, caution, tip, video };
    }

    function getMoneyStyle(s){
        const hiC = s.C >= 50, hiO = s.O >= 50, hiE = s.E >= 50;
        if(hiC && !hiO) return { title:'💰 계획적인 관리자', desc:`성실성(${s.C}%)이 높고 실용적(개방성 ${s.O}%)이어서 지출을 꼼꼼히 관리하고 충동구매를 잘 참아요. 장기 목표를 위해 현재를 절제하는 힘이 있어요.`, tip:'💡 가끔은 나를 위한 작은 사치도 괜찮아요. 삶의 질도 중요해요!' };
        if(hiC && hiO) return { title:'💰 전략적 투자자', desc:`성실성(${s.C}%)과 개방성(${s.O}%)이 모두 높아 체계적이면서도 새로운 기회에 열려 있어요. 안정적 저축과 창의적 투자를 균형 있게 해요.`, tip:'💡 새로운 투자 기회를 탐색하되, 리스크 분석을 먼저 하는 습관을 유지하세요.' };
        if(!hiC && hiO) return { title:'💰 경험에 투자하는 사람', desc:`개방성(${s.O}%)이 높아 물건보다 경험에 돈 쓰기를 좋아해요. 여행, 배움, 새로운 경험이라면 지갑이 열려요.`, tip:'💡 경험 투자는 좋지만 기본 저축도 병행하면 더 자유로워질 수 있어요.' };
        return { title:'💰 균형 잡힌 소비자', desc:`크게 아끼지도 크게 쓰지도 않는 균형 잡힌 소비 패턴이에요. 나름의 기준이 있는 소비자예요.`, tip:'💡 나만의 소비 기준을 한 번 글로 적어보세요. 더 만족스러운 소비 생활이 돼요.' };
    }

    function getRseStyle(rse){
        let title, desc, strength, growth, tip, video;
        if(rse >= 75){
            title = '🌱 안정적이고 건강한 자존감';
            desc = `자존감(${rse}점)이 상위 범위에 있어요. 나 자신을 있는 그대로 받아들이고 타인의 비판에 흔들리지 않는 내적 중심이 잡혀 있어요. Eisenberger et al.(2011)의 연구에서 높은 자존감을 가진 사람들은 사회적 거절 자극에 뇌의 고통 반응(anterior insula)이 약하게 나타났어요 — 같은 상황에서도 덜 아픈 뇌를 가진 거예요.`;
            strength = '🌟 이 자존감이 주는 것들: 비판을 성장 기회로 보는 유연성. 관계에서 집착하지 않는 여유. 어려운 결정을 내릴 때의 자기 신뢰.';
            growth = '🌱 유지와 성장: 삶의 큰 변화(이직, 이별, 은퇴) 시기에도 흔들릴 수 있어요. 꾸준한 확언이 이 안정감의 닻이 돼요.';
            tip = '💡 30일 후 재검사로 변화를 수치로 확인해보세요!';
        } else if(rse >= 50){
            title = '🌱 성장 가능성이 높은 자존감';
            desc = `자존감(${rse}점)이 평균 범위에 있어요. 좋은 날과 흔들리는 날이 공존하는 것 — 그게 지금의 당신이에요. Northoff et al.(2006)의 연구에서 긍정적 자기서사(positive self-narrative)의 반복이 내측 전전두피질의 활성화 패턴을 바꿀 수 있어요. 지금 이 시간이 성장의 출발점이에요.`;
            strength = '🌟 지금의 강점: 자신을 성장시키려는 의지. 완벽하지 않아도 앞으로 나아가는 용기.';
            growth = '🌱 성장 방향: 자존감은 성취로 쌓는 게 아니에요. "나는 지금 이대로 충분하다"는 것을 지금 받아들이는 연습이 더 중요해요.';
            tip = '💡 매일 아침 눈 뜨자마자 확언을 3번 소리 내어 읽어보세요. 뇌는 반복으로 자기상을 업데이트해요.';
            video = { url:'https://youtube.com/shorts/brz6XesFoN8', label:'거절당한 고통, 당신 잘못이 아닙니다' };
        } else {
            title = '🌱 회복이 필요한 자존감';
            desc = `지금 자존감(${rse}점)이 낮은 시기를 보내고 있어요. 나 자신을 소중히 여기기가 어렵고 부정적인 생각이 많이 드는 시간일 수 있어요. 그런데 중요한 건, 이것을 알아챈 것 자체가 이미 변화의 시작이에요. 자존감은 고정된 것이 아니에요. Clark(2005)의 연구에서 반복적인 긍정적 자기대화와 행동 변화가 자존감을 실질적으로 높였어요.`;
            strength = '🌟 지금 필요한 것: 자신에게 친절하게 대하는 연습. 작은 성공 경험 쌓기. 부정적 내면의 목소리에 맞서는 새 이야기 만들기.';
            growth = '🌱 첫 번째 단계: 오늘 잘한 일 1가지를 찾아보세요. "오늘 물 한 잔 마셨다"도 시작이에요.';
            tip = '💡 확언 앱을 매일 여는 것 자체가 이미 자신을 향한 사랑의 행동이에요. 매일 조금씩, 뇌는 반드시 변해요.';
            video = { url:'https://youtube.com/shorts/brz6XesFoN8', label:'거절당한 고통, 당신 잘못이 아닙니다' };
        }
        return { title, score: rse, desc, strength, growth, tip, video };
    }

    function getViaStyle(strengths){
        const top = strengths ? strengths[0] : '호기심';
        const descs = {
            '호기심':'새로운 것을 배우고 탐험하는 것이 삶의 원동력이에요. 알면 알수록 더 알고 싶어지는 타입이에요.',
            '안정감':'익숙하고 검증된 것에서 깊은 만족을 느껴요. 신뢰할 수 있는 루틴과 관계가 삶의 기반이에요.',
            '협동심':'함께 만들어가는 것에서 큰 보람을 느껴요. 팀의 시너지를 이끌어내는 능력이 탁월해요.',
            '자기주도':'스스로 결정하고 실행하는 것에서 에너지를 얻어요. 독립적으로 일할 때 가장 빛나요.',
            '감성지능':'감정을 읽고 표현하는 능력이 뛰어나요. 사람들이 당신 곁에서 위로를 느끼는 이유예요.',
            '자기조절':'감정을 잘 다스리고 차분하게 상황을 바라보는 힘이 있어요. 위기 상황에서 특히 빛나요.',
            '친절함':'사람들을 진심으로 챙기는 마음이 최고의 강점이에요. 주변에서 당신의 따뜻함에 힘을 얻어요.',
            '정직함':'솔직하고 투명한 것이 최고의 강점이에요. 사람들이 당신을 신뢰하는 이유예요.',
            '신중성':'충분히 생각하고 행동하는 신중함이 강점이에요. 실수가 적고 결정의 질이 높아요.',
            '활력':'행동으로 뛰어드는 에너지가 넘쳐요. 시작하는 힘이 탁월하고 주변에 동기를 부여해요.',
            '감사':'일상의 작은 것에서도 행복을 찾는 능력이에요. 같은 상황에서도 더 많은 기쁨을 느껴요.',
            '희망':'더 나은 미래를 그리며 현재를 사는 힘이에요. 어려운 상황에서도 가능성을 보는 눈이 있어요.',
            '창의성':'기존과 다른 방식으로 세상을 보고 만들어가는 힘이에요.',
            '공감능력':'타인의 감정을 섬세하게 감지하고 이해하는 능력이에요.',
        };
        return {
            title: `✨ 핵심 강점: ${top}`,
            strengths: strengths || [],
            desc: descs[top] || '당신만의 고유한 강점이 있어요.',
        };
    }



    // ★ 결과지 이미지 저장 (앱 설치 시에만)
    // ★ 게이팅이 적용된 다운로드 함수
    window.downloadPsychPDF = function(){
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
        const nick = safeGetItem('my_nickname','');
        const email = safeGetItem('my_email','');

        // ★ 게이팅 체크: 닉네임/이메일이 없거나 앱 설치 상태가 아니면 모달 표시
        if(!nick || !email || !isStandalone){
            document.getElementById('psych-gating-modal').style.display = 'flex';
            return;
        }

        // 이미 조건 충족 시 기존 로직 실행 (결과지 생성)
        generatePsychPDF(); 
    }

    // ★ 실제 PDF 생성 로직 (기존 downloadPsychPDF의 내용)
    function generatePsychPDF(){
        const saved = safeGetItem('psych_result_v2','');
        if(!saved){ showToast('먼저 테스트를 완료해주세요!'); return; }
        const r = JSON.parse(saved);
        const s = r.scores;
        const raw = r.rawScores || {};
        const love   = getLoveStyle(s);
        const work   = getWorkStyle(s);
        const friend = getFriendStyle(s);
        const hard   = getHardStyle(s);
        const money  = getMoneyStyle(s);
        const rse    = getRseStyle(s.RSE);
        const via    = getViaStyle(r.viaStrengths);
        const overall = getOverallDesc(s, r.animal, r.allFacets);
        const nick   = safeGetItem('my_nickname','') || '나';
        const today  = getTodayStr();

        const rseLevel = s.RSE>=75?'높음 — 안정적 자기가치감'
            :s.RSE>=50?'평균 — 상황에 따라 변동'
            :s.RSE>=25?'낮음 — 자기비판 경향':'매우 낮음';

        // 경계선 요인
        const borderAxes = [];
        if(s.E>=42&&s.E<=58) borderAxes.push('외향성');
        if(s.O>=42&&s.O<=58) borderAxes.push('개방성');
        if(s.A>=42&&s.A<=58) borderAxes.push('친화성');
        if(s.C>=42&&s.C<=58) borderAxes.push('성실성');
        const borderHTML = borderAxes.length > 0
            ? '<div class="border-alert">💡 <b>경계선 안내:</b> '+borderAxes.join(', ')+' 요인이 50% 근처에 있어요. 반대 유형의 특성도 함께 가질 수 있어요. 30일 후 재검사로 확인해보세요.</div>'
            : '';

        // Big5 바 HTML
        const bfi5 = [
            ['외향성','E','내향적','외향적','사람과 교류에서 에너지를 얻는 정도'],
            ['개방성','O','실용 추구','변화 추구','새로운 경험과 창의성에 대한 개방도'],
            ['친화성','A','독립적','관계 중심','타인을 배려하고 협력하는 경향'],
            ['성실성','C','유연함','계획적','목표 지향적이고 체계적으로 행동하는 정도'],
            ['안정성','N','예민함','안정적','정서 안정과 스트레스 대처 능력'],
        ];
        const barsHTML = bfi5.map(function(item){
            const label=item[0], ax=item[1], low=item[2], high=item[3], tip=item[4];
            const score = ax==='N' ? 100-s[ax] : s[ax];
            const rawVal = ax==='N' ? (raw[ax]?(8-parseFloat(raw[ax])).toFixed(1):'-') : (raw[ax]||'-');
            const isBorder = score>=42&&score<=58;
            const desc = score>=65 ? high+'이 강한 편이에요' : score<40 ? low+'인 편이에요' : '중간 수준이에요 (경계형)';
            return '<div class="bar-wrap">'
                +'<div class="bar-header">'
                +'<span class="bar-label">'+label+(isBorder?' ⚠️':'')+'</span>'
                +'<span class="bar-score">'+score+'% <span class="bar-raw">('+rawVal+'점/7)</span></span>'
                +'</div>'
                +'<div class="bar-bg'+(isBorder?' bar-border':'')+'"><div class="bar-fill" style="width:'+score+'%"></div></div>'
                +'<div class="bar-desc">'+desc+' · '+tip+'</div>'
                +'</div>';
        }).join('');

        // VIA 강점 태그
        const viaTagsHTML = (r.viaStrengths||[]).map(function(sv,i){
            return '<span class="strength-tag '+(i>0?'sec':'')+'">'+( i===0?'👑 ':'')+sv+'</span>';
        }).join('');

        // 확언 방향
        let afHTML = '';
        if(s.RSE<60) afHTML += '<div class="af-item">💚 자기가치감 강화 — "나는 지금 이대로 충분하다"</div>';
        if(s.N>60)   afHTML += '<div class="af-item">🌊 정서 안정 — "나는 감정을 인정하면서도 흔들리지 않는다"</div>';
        if(s.C<45)   afHTML += '<div class="af-item">⚡ 실천력 강화 — "나는 오늘 작은 한 걸음을 완수한다"</div>';
        if(s.A>=65&&s.N>=50) afHTML += '<div class="af-item">🤝 자기돌봄 — "나는 나 자신도 소중히 돌볼 자격이 있다"</div>';
        if(s.E<45)   afHTML += '<div class="af-item">🌙 내향의 강점 — "나의 깊은 사고와 관찰력은 나만의 강점이다"</div>';
        afHTML += '<div class="af-item">✨ 꾸준한 실천 — "매일 조금씩, 나는 반드시 변화한다"</div>';

        const css = [
            '*{margin:0;padding:0;box-sizing:border-box;}',
            'body{font-family:"Apple SD Gothic Neo","Malgun Gothic",sans-serif;background:#F5F3EF;color:#333;font-size:14px;line-height:1.7;}',
            '.page{max-width:100%;margin:0;padding:16px;box-sizing:border-box;}',
            '.header{background:linear-gradient(135deg,#1B4332,#2D6A4F);color:#fff;border-radius:20px;padding:40px 32px;text-align:center;margin-bottom:20px;}',
            '.badge{display:inline-block;background:rgba(212,168,67,0.2);border:1px solid rgba(212,168,67,0.5);border-radius:20px;padding:6px 20px;font-size:12px;color:#C9A84C;font-weight:700;margin-bottom:16px;letter-spacing:2px;}',
            '.animal{font-size:80px;margin-bottom:8px;}',
            '.type-name{font-size:32px;font-weight:900;color:#C9A84C;margin-bottom:4px;}',
            '.type-title{font-size:18px;color:rgba(255,255,255,0.85);margin-bottom:4px;}',
            '.mbti{font-size:13px;color:rgba(255,255,255,0.5);}',
            '.intro{font-size:15px;color:rgba(255,255,255,0.9);margin-top:14px;padding:14px 20px;background:rgba(255,255,255,0.1);border-radius:12px;line-height:1.8;text-align:left;}',
            '.date{font-size:12px;color:rgba(255,255,255,0.4);margin-top:16px;}',
            '.card{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);}',
            '.card-title{font-size:16px;font-weight:700;color:#1B4332;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #F0F7F4;display:flex;align-items:center;gap:8px;}',
            '.overall-text{font-size:14px;line-height:2;color:#444;}',
            '.bar-wrap{margin-bottom:14px;}',
            '.bar-header{display:flex;justify-content:space-between;margin-bottom:5px;font-size:13px;}',
            '.bar-label{font-weight:700;color:#333;}',
            '.bar-score{font-weight:700;color:#1B4332;}',
            '.bar-raw{font-size:11px;color:#aaa;font-weight:400;margin-left:4px;}',
            '.bar-bg{background:#F0F0F0;border-radius:10px;height:10px;overflow:hidden;margin-bottom:4px;}',
            '.bar-fill{height:100%;border-radius:10px;background:linear-gradient(90deg,#1B4332,#52B788);}',
            '.bar-border{border:2px dashed #C9A84C!important;}',
            '.bar-desc{font-size:12px;color:#888;}',
            '.rse-wrap{text-align:center;padding:16px;background:#F0F7F4;border-radius:12px;margin-bottom:12px;}',
            '.rse-score{font-size:48px;font-weight:900;color:#1B4332;}',
            '.rse-level{display:inline-block;background:#1B4332;color:#C9A84C;padding:4px 16px;border-radius:20px;font-size:12px;font-weight:700;margin-top:8px;}',
            '.style-box{background:#F8FBF8;border-left:4px solid #1B4332;border-radius:0 12px 12px 0;padding:16px;margin-bottom:12px;}',
            '.style-title{font-size:14px;font-weight:700;color:#1B4332;margin-bottom:8px;}',
            '.style-desc{font-size:13px;color:#555;line-height:1.8;margin-bottom:8px;}',
            '.style-strength{font-size:13px;color:#2D6A4F;margin-bottom:6px;}',
            '.style-caution{font-size:13px;color:#C9A84C;margin-bottom:6px;}',
            '.style-tip{font-size:12px;color:#888;font-style:italic;background:#FFF8E7;padding:8px 12px;border-radius:8px;margin-top:8px;}',
            '.strength-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}',
            '.strength-tag{background:#1B4332;color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;}',
            '.strength-tag.sec{background:#F0F7F4;color:#1B4332;}',
            '.border-alert{background:#FFF8E7;border:1px solid #C9A84C;border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#7A5500;line-height:1.7;}',
            '.cite{font-size:11px;color:#aaa;font-style:italic;margin-top:8px;}',
            '.footer{text-align:center;padding:24px;color:#aaa;font-size:12px;}',
            '.app-name{color:#1B4332;font-weight:700;font-size:14px;margin-bottom:4px;}',
            '.affirmation-box{background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:16px;padding:20px;color:#fff;}',
            '.af-title{font-size:14px;font-weight:700;color:#C9A84C;margin-bottom:12px;}',
            '.af-item{font-size:13px;line-height:1.9;color:rgba(255,255,255,0.9);margin-bottom:6px;padding-left:12px;border-left:2px solid rgba(201,168,76,0.4);}',
            '@media print{body{background:#fff;}.page{max-width:100%;padding:10px;}.card{box-shadow:none;border:1px solid #eee;page-break-inside:avoid;}.no-print{display:none!important;}}',
        ].join('');

        const html = '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">'
            +'<meta name="viewport" content="width=device-width,initial-scale=1">'
            +'<title>'+nick+'님의 성격 분석 결과지</title>'
            +'<style>'+css+'</style></head><body><div class="page">'

            // 인쇄 버튼
            +'<div class="no-print" style="text-align:right;margin-bottom:12px;">'
            +'<button onclick="window.print()" style="background:#1B4332;color:#fff;border:none;padding:10px 24px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;">🖨️ PDF로 저장 / 인쇄</button>'
            +'</div>'

            // 헤더
            +'<div class="header">'
            +'<div class="badge">인생2막라디오 확언앱 · 64유형 성격 분석 결과지 v4.0</div>'
            +'<div class="animal">'+r.animal.animal+'</div>'
            // ★ ANIMAL_FACET_MAP에서 항상 최신 라벨/서술 읽기
            +(function(){
                var _vk = r.variantKey || 'A';
                var _fm = (typeof ANIMAL_FACET_MAP !== 'undefined' &&
                    ANIMAL_FACET_MAP[r.animal.animal] &&
                    ANIMAL_FACET_MAP[r.animal.animal].variants[_vk])
                    ? ANIMAL_FACET_MAP[r.animal.animal].variants[_vk] : null;
                var _label     = (_fm && _fm.label)     ? _fm.label     : (r.variant&&r.variant.label?r.variant.label:r.animal.name);
                var _narrative = (_fm && _fm.narrative) ? _fm.narrative : (r.variant&&r.variant.narrative?r.variant.narrative:(r.animal.desc||r.animal.tagline||''));
                var _mbti      = r.animal.animal ? (function(){
                    var MBTI_MAP = {'🦁':'ENTJ','🐺':'INTJ','🦅':'ESTJ','🦫':'ISTJ','🐘':'ENFJ','🐋':'INFJ','🦝':'ESFJ','🐢':'ISFJ','🐒':'ENTP','🦊':'INTP','🦦':'ENFP','🦌':'INFP','🐯':'ESTP','🐆':'ISTP','🦢':'ESFP','🐱':'ISFP'};
                    return MBTI_MAP[r.animal.animal] || r.animal.mbti || '-';
                })() : '-';
                // 궁합 정보
                var _compat = (_fm && _fm.compatible) ? _fm.compatible : null;
                var _compatStr = _compat
                    ? (' 💑 ' + _compat.name + (_compat.variant ? '-'+_compat.variant : '') + ' · ' + (_compat.label||''))
                    : '';
                return '<div class="type-name">'+r.animal.name+(r.variantKey?'-'+r.variantKey:'')+'</div>'
                    +'<div style="font-size:18px;color:#C9A84C;font-weight:700;margin:4px 0;">'+_label+'</div>'
                    +'<div class="type-title">'+r.animal.title+'</div>'
                    +'<div class="mbti">MBTI: '+_mbti+'</div>'
                    +(_compatStr ? '<div style="font-size:14px;color:#C9A84C;margin:4px 0;">최고의 궁합'+_compatStr+'</div>' : '')
                    +'<div class="intro">'+_narrative+'</div>'
                    +'<div class="date">검사일: '+today+' · '+nick+'님</div>';
            })()
            +'</div>'

            // 경계선 알림
            + borderHTML

            // 64유형 변형 카드
            +(function(){
                var _vk = r.variantKey || 'A';
                var _fm = (typeof ANIMAL_FACET_MAP !== 'undefined' &&
                    ANIMAL_FACET_MAP[r.animal.animal] &&
                    ANIMAL_FACET_MAP[r.animal.animal].variants[_vk])
                    ? ANIMAL_FACET_MAP[r.animal.animal].variants[_vk] : null;
                var _lb = (_fm&&_fm.label) ? _fm.label : (r.variant&&r.variant.label?r.variant.label:'');
                var _nr = (_fm&&_fm.narrative) ? _fm.narrative : (r.variant&&r.variant.narrative?r.variant.narrative:'');
                if(!_lb) return '';
                return '<div class="card" style="background:linear-gradient(135deg,#1B4332,#2D6A4F);color:#fff;border:none;">'
                    +'<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:6px;letter-spacing:1px;">나의 64유형 정밀 프로필</div>'
                    +'<div style="font-size:22px;font-weight:900;color:#C9A84C;margin-bottom:4px;">'
                    +r.animal.animal+' '+r.animal.name+'-'+_vk+'</div>'
                    +'<div style="font-size:15px;font-weight:700;color:#C9A84C;margin-bottom:10px;">'+_lb+'</div>'
                    +(_nr ? '<div style="font-size:12px;color:rgba(255,255,255,0.85);line-height:1.8;">'+_nr+'</div>' : '')
                    +'</div>';
            })()

            // 전반적 성격 서술
            +'<div class="card">'
            +'<div class="card-title">🧬 BFI-44가 분석한 나의 성격</div>'
            +'<div class="overall-text">'+overall+'</div>'
            +'<p class="cite">📚 John, O.P., Donahue, E.M., & Kentle, R.L. (1991). The Big Five Inventory. UC Berkeley.</p>'
            +'</div>'

            // Big5
            +'<div class="card">'
            +'<div class="card-title">🧠 성격 5요인 수치 분석 (BFI-44 · 44문항)</div>'
            +'<div style="font-size:12px;color:#888;margin-bottom:12px;padding:8px 12px;background:#F8F8F8;border-radius:8px;">📊 1점=전혀 아님 · 4점=보통 · 7점=매우 그렇다 · 50% 기준 높음/낮음 구분</div>'
            + barsHTML
            +'<p class="cite">📚 신뢰도 α=.79~.88 · 세계 52개국 이상 검증</p>'
            +'</div>'

            +'<div class="card">'            +'<div class="card-title">🔬 세부 성향 10가지 분석</div>'            +(function(){                var _af=r.allFacets||{};                var _s=r.scores||{};                function _f(k,ax){ var v=_af[k]; return (v&&v!==50)?v:Math.round(ax||50); }                var _axes=[                    {label:'외향성',items:[['사교성',_f('sociability',_s.E)],['주도성',_f('assertiveness',_s.E)]],color:'#3B82F6'},                    {label:'개방성',items:[['지적호기심',_f('intellect',_s.O)],['예술감수성',_f('aesthetics',_s.O)]],color:'#8B5CF6'},                    {label:'친화성',items:[['공감능력',_f('compassion',_s.A)],['협력성',_f('cooperation',_s.A)]],color:'#EC4899'},                    {label:'성실성',items:[['계획성',_f('order',_s.C)],['성취지향',_f('industriousness',_s.C)]],color:'#F59E0B'},                    {label:'안정성',items:[['불안관리',100-_f('anxiety',_s.N)],['감정조절',100-_f('volatility',_s.N)]],color:'#10B981'}                ];                return _axes.map(function(ax){                    return '<div style="margin-bottom:14px;">'                        +'<div style="font-size:11px;font-weight:800;color:'+ax.color+';margin-bottom:6px;">'+ax.label+'</div>'                        +ax.items.map(function(it){                            return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">'                                +'<div style="width:72px;font-size:12px;color:#333;">'+it[0]+'</div>'                                +'<div style="flex:1;background:#EFEFEF;border-radius:4px;height:11px;">'                                +'<div style="width:'+it[1]+'%;background:'+ax.color+';height:11px;border-radius:4px;"></div></div>'                                +'<div style="width:34px;font-size:12px;font-weight:700;color:'+ax.color+';text-align:right;">'+it[1]+'%</div>'                                +'</div>';                        }).join('')+'</div>';                }).join('');            })()            +'</div>'

            // 자존감
            +'<div class="card">'
            +'<div class="card-title">🌱 자존감 분석 (Rosenberg Self-Esteem Scale)</div>'
            +'<div class="rse-wrap">'
            +'<div class="rse-score">'+s.RSE+'점</div>'
            +'<div style="font-size:13px;color:#555;margin-top:4px;">100점 만점 기준</div>'
            +'<div class="rse-level">'+rseLevel+'</div>'
            +'</div>'
            +'<div class="style-box">'
            +'<div class="style-title">'+rse.title+'</div>'
            +'<div class="style-desc">'+rse.desc+'</div>'
            +'<div class="style-strength">'+rse.strength+'</div>'
            +'<div class="style-tip">'+rse.tip+'</div>'
            +'</div>'
            +'<p class="cite">📚 Rosenberg, M. (1965). Society and the Adolescent Self-Image. α=.88</p>'
            +'</div>'

            // 연애
            +'<div class="card"><div class="card-title">💕 연애 스타일</div>'
            +'<div class="style-box">'
            +'<div class="style-title">'+love.title+'</div>'
            +'<div class="style-desc">'+love.desc+'</div>'
            +'<div class="style-strength">'+love.strength+'</div>'
            +'<div class="style-caution">'+love.caution+'</div>'
            +'<div class="style-tip">'+love.tip+'</div>'
            +'</div></div>'

            // 일
            +'<div class="card"><div class="card-title">💼 일 스타일</div>'
            +'<div class="style-box">'
            +'<div class="style-title">'+work.title+'</div>'
            +'<div class="style-desc">'+work.desc+'</div>'
            +'<div class="style-strength">'+work.strength+'</div>'
            +'<div class="style-caution">'+work.caution+'</div>'
            +'<div class="style-tip">'+work.tip+'</div>'
            +'</div></div>'

            // 관계
            +'<div class="card"><div class="card-title">👥 관계 스타일</div>'
            +'<div class="style-box">'
            +'<div class="style-title">'+friend.title+'</div>'
            +'<div class="style-desc">'+friend.desc+'</div>'
            +'<div class="style-strength">'+friend.strength+'</div>'
            +'<div class="style-caution">'+friend.caution+'</div>'
            +'<div class="style-tip">'+friend.tip+'</div>'
            +'</div></div>'

            // 위기
            +'<div class="card"><div class="card-title">🌧️ 위기 대처 스타일</div>'
            +'<div class="style-box">'
            +'<div class="style-title">'+hard.title+'</div>'
            +'<div class="style-desc">'+hard.desc+'</div>'
            +'<div class="style-strength">'+hard.strength+'</div>'
            +'<div class="style-caution">'+hard.caution+'</div>'
            +'<div class="style-tip">'+hard.tip+'</div>'
            +'</div></div>'

            // 소비
            +'<div class="card"><div class="card-title">💰 소비 성향</div>'
            +'<div class="style-box">'
            +'<div class="style-title">'+money.title+'</div>'
            +'<div class="style-desc">'+money.desc+'</div>'
            +'<div class="style-tip">'+money.tip+'</div>'
            +'</div></div>'

            // VIA 강점
            +'<div class="card"><div class="card-title">✨ 핵심 강점 (VIA Character Strengths)</div>'
            +'<div class="style-box">'
            +'<div class="style-title">'+via.title+'</div>'
            +'<div class="style-desc">'+via.desc+'</div>'
            +'</div>'
            +'<div class="strength-tags">'+viaTagsHTML+'</div>'
            +'<p class="cite">📚 Peterson, C., & Seligman, M.E.P. (2004). Character Strengths and Virtues. Oxford University Press.</p>'
            +'</div>'

            // 확언 방향
            +'<div class="card"><div class="card-title">🌿 나를 위한 확언 방향</div>'
            +'<div class="affirmation-box">'
            +'<div class="af-title">지금 나에게 가장 필요한 확언 테마</div>'
            + afHTML
            +'<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:12px;">📚 뇌의 신경가소성 연구: 21~66일 반복적 자기대화가 자기인식을 변화시킵니다.</div>'
            +'</div></div>'

            // 30일 재검사
            +'<div class="card" style="border:2px solid #C9A84C;">'
            +'<div class="card-title" style="color:#C9A84C;">🔄 30일 후 재검사 권장</div>'
            +'<p style="font-size:13px;color:#555;line-height:1.8;">지금부터 매일 확언을 실천하고 30일 후 재검사를 해보세요.<br>자존감 점수와 스트레스 안정성이 실제로 변화했는지 수치로 확인할 수 있어요.<br><b style="color:#1B4332;">확언의 효과를 데이터로 증명하세요!</b></p>'
            +'<p class="cite">📚 Roberts, B.W. et al. (2006). 성격 변화는 최소 3~4주 행동 변화 누적 필요. Psychological Bulletin, 132(1).</p>'
            +'</div>'

            // 푸터
            +'<div class="footer">'
            +'<div class="app-name">인생2막라디오 확언앱</div>'
            +'<div>BFI-44 · Rosenberg Self-Esteem Scale · VIA Character Strengths 기반</div>'
            +'<div>정확도 약 90% · 세계 52개국 검증 학술 도구</div>'
            +'<div style="margin-top:4px;">life2radio.github.io/pumsok</div>'
            +'<div style="margin-top:8px;font-size:11px;">※ 이 결과지는 학술 도구 기반의 참고 자료이며, 전문적 심리 진단을 대체하지 않습니다.</div>'
            +'</div>'

            +'</div></body></html>';

        const w = window.open('', '_blank');
        if(w){
            w.document.write(html);
            w.document.close();
            // 새 탭이 로드된 후 body에 max-width 100% 적용
            setTimeout(function(){
                try {
                    var s = w.document.createElement('style');
                    s.textContent = '.page{max-width:100%!important;padding:12px!important;box-sizing:border-box!important;} body{font-size:13px!important;}';
                    w.document.head.appendChild(s);
                } catch(e){}
            }, 300);
        } else {
            showToast('팝업이 차단됐어요. 팝업 허용 후 다시 시도해주세요!');
        }
    }

    // ★ 심리테스트 게이팅 처리
    window.processPsychGating = function(){
        const nick = document.getElementById('gt-nick').value.trim();
        const email = document.getElementById('gt-email').value.trim();
        
        if(!nick || !email){ 
            showToast('이름과 이메일을 모두 입력해주세요! 😊'); 
            return; 
        }
        
        // 1. 정보 저장
        safeSetItem('my_nickname', nick);
        safeSetItem('my_email', email);
        
        // 2. 모달 닫기
        document.getElementById('psych-gating-modal').style.display = 'none';

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
        
        if(isStandalone){
            // 이미 앱을 설치한 유저라면 팝업 유도 없이 즉시 결과지 생성!
            generatePsychPDF(); 
            showToast('🎉 정보가 등록되고 결과지가 저장됐어요!');
        } else {
            // 앱 미설치 유저라면 보류 상태로 만들고 설치 유도
            safeSetItem('pending_psych_save', '1');
            if(pwaInstallPrompt){
                installFromPrompt();
            } else {
                // pwaInstallPrompt 없으면 설치 안내 페이지로 이동
                setTimeout(function(){
                    showInstallPrompt && showInstallPrompt();
                }, 400);
            }
        }
    }

    // ★ 앱 설치 후 최종 저장 처리
    window.finalizePendingSave = function(){
        safeSetItem('pending_psych_save', '0'); // 플래그 초기화
        document.getElementById('psych-save-confirm-modal').style.display = 'none';
        
        // 결과지 생성 함수 호출
        generatePsychPDF(); 
        showToast('🎉 결과 저장이 완료되었습니다!');
    }

    window.downloadPsychResult = function(){
        const saved = safeGetItem('psych_result_v2','');
        if(!saved){ showToast('먼저 테스트를 완료해주세요!'); return; }
        let r;
        try { r = JSON.parse(saved); } catch(e){ showToast('결과 데이터 오류'); return; }
        if(!r || !r.animal || !r.scores){ showToast('결과 데이터가 없어요. 테스트를 다시 완료해주세요.'); return; }
        // ⏳ 토스트 제거 - 사용자 제스처 컨텍스트 유지
        try {
        const s = r.scores;

        const W = 800;
        const FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";
        const PAD = 56;
        const BAR_W = W - PAD*2;

        // ─── 텍스트 줄바꿈 함수 (픽셀 단위) ───
        function wrapText(ctx, text, maxW){
            const lines = [];
            let cur = '';
            for(let i=0; i<text.length; i++){
                const test = cur + text[i];
                if(ctx.measureText(test).width > maxW){
                    if(cur) lines.push(cur);
                    cur = text[i];
                } else { cur = test; }
            }
            if(cur) lines.push(cur);
            return lines;
        }

        // ─── Big5 상세 설명 ───
        const bfi5 = [
            { label:'외향성', score:s.E,
              hi:'사람들과 함께할 때 에너지가 충전돼요. 활발하고 사교적이며 새로운 만남을 즐겨요. 도파민 보상 체계가 활성화되어 긍정적 정서가 높아요.',
              mid:'내향과 외향의 균형을 가진 양방향형이에요. 상황에 따라 혼자도, 사람들과도 편안하게 지낼 수 있어요.',
              lo:'혼자만의 시간에서 에너지를 회복하는 내향형이에요. 깊은 사색과 집중력이 뛰어나고 소수의 깊은 관계를 선호해요.' },
            { label:'개방성', score:s.O,
              hi:'창의적이고 호기심이 넘쳐요. 새로운 아이디어와 경험을 사랑하며 예술적 감수성이 풍부해요.',
              mid:'새로운 것과 익숙한 것 사이에서 균형을 잘 잡아요. 실용성과 창의성을 적절히 활용해요.',
              lo:'실용적이고 안정적인 것을 선호해요. 검증된 방식과 익숙한 환경에서 최고의 결과를 내요.' },
            { label:'친화성', score:s.A,
              hi:'따뜻하고 배려심이 깊어요. 타인과 협력하고 조화를 소중히 여기며 공감 능력이 탁월해요.',
              mid:'협력과 독립 사이에서 유연하게 대응해요. 상황에 맞게 배려와 주장을 균형 있게 발휘해요.',
              lo:'독립적이고 자기 기준이 명확해요. 직설적이며 결과를 중시하는 실용적인 사고를 가졌어요.' },
            { label:'성실성', score:s.C,
              hi:'체계적이고 목표 지향적이에요. 시작한 일은 반드시 끝내는 강한 책임감과 자기절제력이 있어요.',
              mid:'계획성과 유연성의 균형을 갖고 있어요. 중요한 일엔 체계를 갖추고 상황에 따라 유연하게 대응해요.',
              lo:'자유롭고 즉흥적이에요. 창의성과 유연한 적응력이 강점이며 새로운 방식을 탐구하기를 좋아해요.' },
            { label:'정서안정성', score:100-s.N,
              hi:'스트레스 상황에서도 침착하고 안정적이에요. 어려운 상황에서 주변에 심리적 안정감을 줘요.',
              mid:'감정과 안정감 사이에서 균형을 유지해요. 힘든 상황에서도 비교적 빠르게 회복하는 편이에요.',
              lo:'감수성이 풍부하고 감정을 깊이 느끼는 편이에요. 예술적 감수성과 공감 능력이 탁월해요.' },
        ];

        const rseDesc = s.RSE>=75 ? '자신을 있는 그대로 받아들이는 안정적인 자기가치감을 갖고 있어요. 타인의 비판에 흔들리지 않는 내적 중심이 잡혀 있어요.'
            : s.RSE>=50 ? '좋은 날과 흔들리는 날이 공존해요. 확언을 꾸준히 실천하면 자존감이 단계적으로 높아질 수 있어요.'
            : '지금 자기가치감이 낮은 시기를 보내고 있어요. 매일 확언으로 나를 채워가면 반드시 변화가 시작돼요.';

        // ─── 높이 계산을 위한 임시 캔버스 ───
        const tmpC = document.createElement('canvas');
        tmpC.width = W; tmpC.height = 100;
        const tmpCtx = tmpC.getContext('2d');
        if(!tmpCtx.roundRect){
            tmpCtx.roundRect = function(x,y,w,h,r){
                this.beginPath(); this.moveTo(x+r,y); this.lineTo(x+w-r,y);
                this.quadraticCurveTo(x+w,y,x+w,y+r); this.lineTo(x+w,y+h-r);
                this.quadraticCurveTo(x+w,y+h,x+w-r,y+h); this.lineTo(x+r,y+h);
                this.quadraticCurveTo(x,y+h,x,y+h-r); this.lineTo(x,y+r);
                this.quadraticCurveTo(x,y,x+r,y); this.closePath();
            };
        }

        // 소개글 줄 수 계산
        tmpCtx.font = '15px ' + FONT;
        const introText = r.animal.desc || r.animal.tagline || '';
        const introLines = wrapText(tmpCtx, introText, BAR_W);

        // Big5 설명 줄 수 계산
        tmpCtx.font = '14px ' + FONT;
        let bfiDescLines = 0;
        for(const item of bfi5){
            const desc = item.score>=60?item.hi:item.score<40?item.lo:item.mid;
            bfiDescLines += wrapText(tmpCtx, desc, BAR_W).length;
        }

        // RSE 설명 줄 수 계산
        const rseLines = wrapText(tmpCtx, rseDesc, BAR_W).length;

        const totalH = 
            80  +               // 배지
            130 +               // 동물+이름
            introLines*24+50 +  // 소개글
            50  +               // Big5 타이틀
            bfi5.length*85 +    // Big5 항목 (레이블+바)
            bfiDescLines*22+bfi5.length*16 + // Big5 설명
            40  +               // 구분선
            50  +               // RSE 타이틀
            60  +               // RSE 바+점수
            rseLines*22+20 +    // RSE 설명
            40  +               // VIA 구분
            70  +               // VIA
            60;                 // 푸터

        // ─── 실제 캔버스 ───
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        // roundRect 폴리필 (구형 Android Chrome 대비)
        if(!ctx.roundRect){
            ctx.roundRect = function(x,y,w,h,r){
                this.beginPath();
                this.moveTo(x+r,y);
                this.lineTo(x+w-r,y);
                this.quadraticCurveTo(x+w,y,x+w,y+r);
                this.lineTo(x+w,y+h-r);
                this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
                this.lineTo(x+r,y+h);
                this.quadraticCurveTo(x,y+h,x,y+h-r);
                this.lineTo(x,y+r);
                this.quadraticCurveTo(x,y,x+r,y);
                this.closePath();
            };
        }

        // 배경
        const grad = ctx.createLinearGradient(0,0,0,totalH);
        grad.addColorStop(0,'#152E20');
        grad.addColorStop(0.4,'#1B4332');
        grad.addColorStop(1,'#0D1F13');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,W,totalH);

        // 원 장식
        ctx.beginPath(); ctx.arc(W-40,50,180,0,Math.PI*2);
        ctx.fillStyle='rgba(212,168,67,0.05)'; ctx.fill();
        ctx.beginPath(); ctx.arc(40,totalH-60,140,0,Math.PI*2);
        ctx.fillStyle='rgba(45,106,79,0.1)'; ctx.fill();

        let Y = 24;

        // ─── 배지 ───
        const badgeTxt = '인생2막라디오  ·  성격 분석 결과';
        ctx.font = 'bold 14px ' + FONT;
        ctx.textAlign = 'center';
        const bW = ctx.measureText(badgeTxt).width + 50;
        ctx.fillStyle = 'rgba(212,168,67,0.18)';
        ctx.beginPath(); ctx.roundRect(W/2-bW/2, Y, bW, 34, 17); ctx.fill();
        ctx.strokeStyle = 'rgba(212,168,67,0.45)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.roundRect(W/2-bW/2, Y, bW, 34, 17); ctx.stroke();
        ctx.fillStyle = '#C9A84C';
        ctx.fillText(badgeTxt, W/2, Y+22);
        Y += 50;

        // ─── 동물 ───
        ctx.font = '72px serif';
        ctx.fillText(r.animal.animal, W/2, Y+72);
        Y += 88;

        // ─── 유형명 ───
        ctx.fillStyle='#C9A84C'; ctx.font='bold 34px '+FONT;
        ctx.fillText(r.animal.name, W/2, Y);
        Y += 36;
        ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='18px '+FONT;
        ctx.fillText('"' + r.animal.title + '"', W/2, Y);
        Y += 26;
        ctx.fillStyle='rgba(255,255,255,0.38)'; ctx.font='13px '+FONT;
        ctx.fillText('MBTI 유사: ' + (r.animal.mbti||'-'), W/2, Y);
        Y += 30;

        // ─── 소개글 ───
        ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='15px '+FONT;
        ctx.textAlign='left';
        const iLines = wrapText(ctx, introText, BAR_W);
        for(const ln of iLines){ ctx.fillText(ln, PAD, Y); Y += 24; }
        Y += 28;

        // ─── 구분선 ───
        ctx.strokeStyle='rgba(201,168,67,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(PAD,Y); ctx.lineTo(W-PAD,Y); ctx.stroke();
        Y += 28;

        // ─── Big5 타이틀 ───
        ctx.fillStyle='#C9A84C'; ctx.font='bold 16px '+FONT; ctx.textAlign='center';
        ctx.fillText('🧠  성격 5요인 분석 (BFI-44)', W/2, Y);
        Y += 34;

        // ─── Big5 항목들 ───
        for(const item of bfi5){
            const {label, score} = item;
            const isBorder = score>=42&&score<=58;
            const descText = score>=60?item.hi:score<40?item.lo:item.mid;

            // 레이블 + 점수
            ctx.textAlign='left';
            ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='bold 16px '+FONT;
            ctx.fillText(label+(isBorder?' ⚠':''), PAD, Y);
            ctx.fillStyle=isBorder?'#FFC107':'#C9A84C';
            ctx.textAlign='right'; ctx.font='bold 16px '+FONT;
            ctx.fillText(score+'%', W-PAD, Y);
            Y += 12;

            // 바 배경
            ctx.fillStyle='rgba(255,255,255,0.1)';
            ctx.beginPath(); ctx.roundRect(PAD,Y,BAR_W,14,7); ctx.fill();
            // 50% 기준선
            ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1;
            ctx.beginPath(); ctx.moveTo(PAD+BAR_W/2,Y-1); ctx.lineTo(PAD+BAR_W/2,Y+15); ctx.stroke();
            // 바 채우기
            ctx.fillStyle=isBorder?'#FFC107':score>=65?'#52B788':score<40?'#74C69D':'#40916C';
            ctx.beginPath(); ctx.roundRect(PAD,Y,Math.round(BAR_W*score/100),14,7); ctx.fill();
            Y += 22;

            // 설명 (여러 줄)
            ctx.fillStyle='rgba(255,255,255,0.52)'; ctx.font='13px '+FONT;
            ctx.textAlign='left';
            const dLines = wrapText(ctx, descText, BAR_W);
            for(const dl of dLines){ ctx.fillText(dl, PAD, Y); Y += 20; }
            Y += 16;
        }

        // ─── 자존감 ───
        ctx.strokeStyle='rgba(201,168,67,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(PAD,Y); ctx.lineTo(W-PAD,Y); ctx.stroke();
        Y += 26;

        ctx.fillStyle='#C9A84C'; ctx.font='bold 16px '+FONT; ctx.textAlign='center';
        ctx.fillText('🌱  자존감 (Rosenberg Self-Esteem Scale)', W/2, Y);
        Y += 28;

        const rseLevel = s.RSE>=75?'높음':s.RSE>=50?'평균':s.RSE>=25?'낮음':'매우 낮음';
        const rseClr = s.RSE>=75?'#52B788':s.RSE>=50?'#C9A84C':'#FF8A80';
        ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='bold 16px '+FONT;
        ctx.fillText('자존감 점수', PAD, Y);
        ctx.fillStyle=rseClr; ctx.textAlign='right';
        ctx.fillText(s.RSE+'점  ·  '+rseLevel, W-PAD, Y);
        Y += 12;

        ctx.fillStyle='rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.roundRect(PAD,Y,BAR_W,14,7); ctx.fill();
        ctx.fillStyle=rseClr;
        ctx.beginPath(); ctx.roundRect(PAD,Y,Math.round(BAR_W*s.RSE/100),14,7); ctx.fill();
        Y += 24;

        ctx.fillStyle='rgba(255,255,255,0.52)'; ctx.font='13px '+FONT; ctx.textAlign='left';
        const rLines = wrapText(ctx, rseDesc, BAR_W);
        for(const rl of rLines){ ctx.fillText(rl, PAD, Y); Y += 20; }
        Y += 26;

        // ─── VIA ───
        ctx.strokeStyle='rgba(201,168,67,0.3)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(PAD,Y); ctx.lineTo(W-PAD,Y); ctx.stroke();
        Y += 26;

        ctx.fillStyle='#C9A84C'; ctx.font='bold 16px '+FONT; ctx.textAlign='center';
        ctx.fillText('✨  핵심 강점 (VIA Character Strengths)', W/2, Y);
        Y += 28;
        ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='17px '+FONT;
        ctx.fillText((r.viaStrengths||[]).slice(0,3).join('   ·   '), W/2, Y);
        Y += 36;

        // ─── 푸터 ───
        ctx.strokeStyle='rgba(201,168,67,0.2)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(PAD,Y); ctx.lineTo(W-PAD,Y); ctx.stroke();
        Y += 18;
        ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.font='12px '+FONT;
        ctx.fillText('BFI-44  ·  Rosenberg  ·  VIA 기반  ·  정확도 약 90%  ·  세계 52개국 검증', W/2, Y);
        Y += 22;
        ctx.fillStyle='#C9A84C'; ctx.font='bold 14px '+FONT;
        ctx.fillText('life2radio.github.io/pumsok/', W/2, Y);

        // 실제 높이로 크롭
        const finalH = Y + 28;
        const fc = document.createElement('canvas');
        fc.width = W; fc.height = finalH;
        fc.getContext('2d').drawImage(canvas,0,0);

        } catch(e) {
            showToast('이미지 생성 오류: ' + (e.message||String(e)));
            console.error('downloadPsychResult error:', e);
            return;
        }

        // ★ dataURL 전역 저장 + 확언카드와 동일한 방식
        window._psychResultDataUrl = fc.toDataURL('image/png');
        window._psychResultName = '인생확언_' + r.animal.name + '_결과지.png';
        const link = document.createElement('a');
        link.download = window._psychResultName;
        link.href = window._psychResultDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('📥 결과지가 저장됐어요!');
    }
    window.psychStartReal = function(mode){
        window._psychMode = mode || 'full';
        const lastDate = safeGetItem('psych_last_date', '');
        const lastMode = safeGetItem('psych_mode_backup', '') || 'full';

        // ① 간편→정밀 업그레이드: 30일 제한 없음, 혜택 안내만
        if(lastDate && mode === 'full' && lastMode === 'quick'){
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `
                <div style="background:#fff;border-radius:20px;padding:28px 24px;width:90%;max-width:360px;text-align:center;">
                    <div style="font-size:40px;margin-bottom:12px;">🔬</div>
                    <div style="font-size:1.05em;font-weight:700;color:#1B4332;margin-bottom:10px;">정밀 테스트로 업그레이드!</div>
                    <div style="font-size:0.88em;color:#555;line-height:1.8;margin-bottom:12px;">
                        간편 테스트보다 훨씬 정확한<br>결과를 알 수 있어요.
                    </div>
                    <div style="background:#F0F7F4;border-radius:10px;padding:14px;font-size:0.83em;color:#1B4332;line-height:1.9;margin-bottom:18px;text-align:left;">
                        🧬 <b>정밀 테스트에서만 알 수 있는 것들</b><br>
                        ✅ 더 정확한 MBTI 유형 (페이싯 기반)<br>
                        ✅ 10가지 세부 성향 심층 분석<br>
                        ✅ 연애·일·소비 스타일까지<br>
                        ✅ 자존감(RSE) + 핵심 강점(VIA) 포함
                    </div>
                    <div style="display:flex;gap:10px;">
                        <button onclick="this.closest('div[style*=fixed]').remove();"
                            style="flex:1;min-height:48px;background:#F0F0F0;color:#555;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">
                            나중에
                        </button>
                        <button onclick="this.closest('div[style*=fixed]').remove();window._doPsychStart('full');"
                            style="flex:1;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">
                            지금 시작하기
                        </button>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            return;
        }

        // ② 같은 유형 재검사: 30일 경고
        if(lastDate && lastMode === mode){
            const last = new Date(lastDate);
            const now = new Date();
            const diffDays = Math.floor((now - last) / (1000 * 60 * 60 * 24));
            if(diffDays < 30){
                const modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
                modal.innerHTML = `
                    <div style="background:#fff;border-radius:20px;padding:28px 24px;width:90%;max-width:360px;text-align:center;">
                        <div style="font-size:40px;margin-bottom:12px;">🔄</div>
                        <div style="font-size:1.05em;font-weight:700;color:#1B4332;margin-bottom:10px;">마지막 검사로부터 ${diffDays}일이 지났어요</div>
                        <div style="font-size:0.88em;color:#555;line-height:1.8;margin-bottom:6px;">
                            즉시 재검사는 기억 효과로 인해<br>
                            비슷한 결과가 나올 수 있어요.
                        </div>
                        <div style="background:#F0F7F4;border-radius:10px;padding:12px;font-size:0.82em;color:#1B4332;line-height:1.7;margin-bottom:18px;">
                            📚 BFI-44 검사-재검사 신뢰도는<br>
                            <b>30일 간격</b>일 때 가장 의미 있어요.<br>
                            확언 효과 측정에도 30일이 필요해요.
                        </div>
                        <div style="font-size:0.82em;color:#888;margin-bottom:16px;">
                            그래도 지금 하시겠어요?
                        </div>
                        <div style="display:flex;gap:10px;">
                            <button onclick="this.closest('div[style*=fixed]').remove();"
                                style="flex:1;min-height:48px;background:#F0F0F0;color:#555;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">
                                나중에 할게요
                            </button>
                            <button onclick="this.closest('div[style*=fixed]').remove();window._doPsychStart(window._psychMode||'full');"
                                style="flex:1;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">
                                지금 할게요
                            </button>
                        </div>
                    </div>`;
                document.body.appendChild(modal);
                return;
            }
        }

        // ③ 제한 없음: 바로 시작
        pMode = mode || 'full';
        _doPsychStart(mode);
    }

    window._doPsychStart = function(mode){
        pMode = mode || 'full';
        // ★ psych_last_date는 결과 계산 시에만 저장 (중간에 종료해도 30일 제한 없음)
        pA = {}; pStep = 0; window._psychStartTime = Date.now();
        showPsychStep(0);
    }

    function getPsychQuestion(step){
        const BFI = getBFI(), RSE = getRSE(), VIA = getVIA();
        if(step < INFO_ITEMS.length) return { type:'info', data: INFO_ITEMS[step] };
        step -= INFO_ITEMS.length;
        if(step < BFI.length) return { type:'bfi', data: BFI[step] };
        step -= BFI.length;
        if(step < RSE.length) return { type:'rse', data: RSE[step] };
        step -= RSE.length;
        return { type:'via', data: VIA[step] };
    }

    function showPsychStep(step){
        const existing = document.getElementById('psych-modal');
        // ★ 같은 step 재렌더 시 스크롤 위치 저장
        let _savedScroll = 0;
        if(existing){
            _savedScroll = existing.scrollTop;
            existing.remove();
        }

        const progress = Math.round(step / getPTotal() * 100);
        const qInfo = getPsychQuestion(step);
        const { type, data } = qInfo;

        let sectionLabel = type === 'info' ? '📋 기본 정보'
            : type === 'bfi' ? '🧠 성격 검사'
            : type === 'rse' ? '🌱 자존감 검사'
            : '✨ 강점 찾기';

        let contentHTML = '';

        if(type === 'info'){
            const sel = pA['info_'+data.key];
            const extraVal = data.extraKey ? (pA[data.extraKey]||'') : '';
            const showExtra = data.extraKey && sel === data.extraTrigger;
            const fs = pFontSize==='large' ? '1.1em' : '0.95em';
            contentHTML = `<div style="display:flex;flex-direction:column;gap:8px;">
                ${data.opts.map(o=>`
                <button onclick="pA['info_${data.key}']='${o}';showPsychStep(${step});"
                    style="padding:16px;border-radius:12px;
                    border:${sel===o?'3px solid #1B4332':'2px solid var(--border-color)'};
                    background:${sel===o?'#E8F5E9':'var(--card-bg)'};
                    color:${sel===o?'#1B4332':'var(--text-color)'};
                    font-size:${pFontSize==='large'?'1.1em':'0.95em'};
                    font-weight:${sel===o?'700':'400'};cursor:pointer;text-align:left;
                    box-shadow:${sel===o?'0 0 0 3px rgba(27,67,50,0.2)':'none'};
                    transition:all 0.15s;">
                    <span style="margin-right:8px">${sel===o?'✅':'⬜'}</span>${o}</button>`).join('')}
                ${showExtra ? `<div style="margin-top:4px;">
                    <input id="psych-extra-input" type="text" placeholder="${data.extraPlaceholder||''}"
                        value="${extraVal}"
                        oninput="pA['${data.extraKey}']=this.value"
                        style="width:100%;padding:12px 14px;font-size:${pFontSize==='large'?'1.1em':'0.95em'};border:2px solid #1B4332;border-radius:10px;box-sizing:border-box;outline:none;">
                </div>` : ''}
            </div>`;
        }
        else if(type === 'bfi' || type === 'rse'){
            const key = type+'_'+data.id;
            const sel = pA[key] || null;
            const LABELS = [
                {t:'전혀 아니다', e:'😫', bg:'#f1f8e9'},
                {t:'아니다',      e:'😟', bg:'#dcedc8'},
                {t:'약간 아니다', e:'😐', bg:'#e8f5e9'},
                {t:'보통이다',    e:'🙂', bg:'#fff9c4'},
                {t:'약간 그렇다', e:'😊', bg:'#fff3e0'},
                {t:'그렇다',      e:'😄', bg:'#ffe0b2'},
                {t:'매우 그렇다', e:'🤩', bg:'#ffccbc'},
            ];
            contentHTML = `
                <div style="margin-bottom:16px;">
                    <div style="font-size:0.88em;color:var(--text-muted);text-align:center;margin-bottom:7px;font-weight:600;">
                        ✋ 나와 얼마나 일치하는지 눌러주세요
                    </div>
                    <div style="display:flex;flex-direction:column;gap:5px;">
                    ${LABELS.map((lb,i) => {
                        const v = i+1;
                        const picked = sel===v;
                        const btnFontSz = pFontSize==='large' ? '1.15em' : '1.08em';
                        const btnH = pFontSize==='large' ? '56px' : '48px';
                        return '<button onclick="pA[\''+key+'\']='+(v)+'; showPsychStep('+step+');"'
                            +' style="width:100%;min-height:'+btnH+';border-radius:16px;'
                            +'border:'+(picked?'4px solid #1B4332':'2px solid #e0e0e0')+';'
                            +'background:'+(picked?'#E8F5E9':lb.bg)+';'
                            +'color:'+(picked?'#1B4332':'#333')+';'
                            +'font-weight:'+(picked?'900':'600')+';'
                            +'cursor:pointer;display:flex;align-items:center;'
                            +'gap:10px;padding:0 14px;transition:all 0.15s;'
                            +'box-shadow:'+(picked?'0 0 0 3px rgba(27,67,50,0.25)':'none')+';">'
                            +'<span style="font-size:1.6em;min-width:32px;text-align:center;">'+(picked?'✅':lb.e)+'</span>'
                            +'<span style="flex:1;font-size:'+btnFontSz+';text-align:left;line-height:1.4;">'+(lb.t)+'</span>'
                            +'<span style="font-size:0.85em;opacity:'+(picked?'1':'0.45')+';min-width:28px;text-align:right;font-weight:700;color:'+(picked?'#1B4332':'#aaa')+';">'+(v)+'점</span>'
                            +'</button>';
                    }).join('')}
                    </div>
                </div>`;
        }
        else if(type === 'via'){
            const key = 'via_'+data.id;
            const sel = pA[key];
            contentHTML = `<div style="display:flex;flex-direction:column;gap:12px;">
                ${data.opts.map((o,i)=>`
                <button onclick="pA['${key}']=${i};showPsychStep(${step});"
                    style="padding:20px 18px;border-radius:16px;
                    border:${sel===i?'4px solid #1B4332':'2px solid #ddd'};
                    background:${sel===i?'#E8F5E9':'var(--card-bg)'};
                    color:${sel===i?'#1B4332':'var(--text-color)'};
                    font-size:${pFontSize==='large'?'1.25em':'1.1em'};
                    font-weight:${sel===i?'900':'600'};cursor:pointer;text-align:left;line-height:1.6;
                    display:flex;align-items:center;gap:12px;
                    box-shadow:${sel===i?'0 0 0 3px rgba(27,67,50,0.25)':'none'};
                    transition:all 0.15s;">
                    <span style="font-size:1.4em">${sel===i?'✅':'⬜'}</span>
                    <span style="flex:1">${o}</span>
                    </button>`).join('')}
            </div>`;
        }

        const modal = document.createElement('div');
        modal.id = 'psych-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:var(--bg-color);overflow-y:auto;display:flex;flex-direction:column;';
        modal.innerHTML = `
            <div style="background:#1B4332;padding:14px 20px;position:sticky;top:0;z-index:1;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <button onclick="(function(){ var _inTest = typeof pStep!=='undefined' && typeof getPTotal==='function' && pStep > 0 && pStep < getPTotal(); if(_inTest){ showPsychExitConfirm(function(){ document.getElementById('psych-modal').remove(); document.body.style.overscrollBehavior=''; }); } else { document.getElementById('psych-modal').remove(); document.body.style.overscrollBehavior=''; } })();"
                        style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:1.3em;cursor:pointer;padding:0;">✕</button>
                    <div style="flex:1;">
                        <div style="display:flex;justify-content:space-between;font-size:0.75em;color:rgba(255,255,255,0.7);margin-bottom:4px;">
                            <span>${sectionLabel}</span>
                            <span>${step+1} / ${getPTotal()}</span>
                        </div>
                        <div style="background:rgba(255,255,255,0.2);border-radius:4px;height:5px;">
                            <div style="background:#C9A84C;height:100%;border-radius:4px;width:${progress}%;transition:width 0.3s;"></div>
                        </div>
                    </div>
                    <button onclick="pFontSize=pFontSize==='large'?'normal':'large';showPsychStep(${step});"
                        style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:8px;color:#fff;font-size:0.85em;font-weight:700;cursor:pointer;padding:6px 10px;white-space:nowrap;">
                        ${pFontSize==='large'?'🔡 보통':'🔠 크게'}
                    </button>
                </div>
            </div>
            <div style="flex:1;padding:14px 20px 80px;">
                <div style="margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                    <span style="background:#1B4332;color:#C9A84C;border-radius:20px;padding:4px 14px;font-size:0.85em;font-weight:700;">
                        ${step+1}번 문항
                    </span>
                </div>
                <div style="font-size:${pFontSize==='large'?'1.2em':'1.0em'};font-weight:700;color:var(--text-color);margin-bottom:12px;line-height:1.55;">
                    ${data.text}
                </div>
                ${contentHTML}
            </div>
            <div style="position:sticky;bottom:0;padding:14px 20px;background:var(--bg-color);border-top:1px solid var(--border-color);display:flex;gap:10px;">
                ${step > 0 ? `<button onclick="showPsychStep(${step-1})"
                    style="flex:1;min-height:50px;background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:14px;font-size:0.95em;font-weight:700;cursor:pointer;">← 이전</button>` : ''}
                <button onclick="psychGoNext(${step})"
                    style="flex:2;min-height:50px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;">
                    ${step < getPTotal()-1 ? '다음 →' : '결과 보기 🎉'}
                </button>
            </div>`;
        document.body.appendChild(modal);

        // ★ 심리테스트 중 당겨서 나가기 완전 차단
        // overscroll (pull-to-refresh) 차단
        modal.style.overscrollBehavior = 'contain';
        document.body.style.overscrollBehavior = 'none';

        // 최상단에서 더 당기거나 최하단에서 더 내리는 동작 차단
        var _touchStartY = 0;
        modal.addEventListener('touchstart', function(e){
            _touchStartY = e.touches[0].clientY;
        }, {passive: true});
        modal.addEventListener('touchmove', function(e){
            var scrollTop = modal.scrollTop;
            var scrollHeight = modal.scrollHeight;
            var clientHeight = modal.clientHeight;
            var touchY = e.touches[0].clientY;
            var isAtTop = scrollTop <= 0 && touchY > _touchStartY;
            var isAtBottom = scrollTop + clientHeight >= scrollHeight && touchY < _touchStartY;
            if(isAtTop || isAtBottom){
                e.preventDefault();
            }
        }, {passive: false});

        // ★ 스크롤 위치 복원
        if(_savedScroll > 0){
            requestAnimationFrame(function(){
                modal.scrollTop = _savedScroll;
            });
        }
    }

    window.psychGoNext = function(step){
        const qInfo = getPsychQuestion(step);
        const { type, data } = qInfo;
        // 유효성 검사
        if(type === 'info' && !pA['info_'+data.key]){ showToast('선택해주세요!'); return; }
        if((type === 'bfi'||type === 'rse') && !pA[type+'_'+data.id]){ showToast('감정을 선택해주세요!'); return; }
        if(type === 'via' && pA['via_'+data.id] === undefined){ showToast('선택해주세요!'); return; }

        if(step < getPTotal() - 1){ showPsychStep(step + 1); }
        else { showPsychEmailStep(); }
    }

    function showPsychEmailStep(){
        // 이미 이메일 있으면 바로 결과
        const savedEmail = safeGetItem('my_email','');
        if(savedEmail){
            calcAndShowResult();
            return;
        }

        const existing = document.getElementById('psych-modal');
        if(existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'psych-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:var(--bg-color);overflow-y:auto;display:flex;flex-direction:column;';
        modal.innerHTML =
            '<div style="background:#1B4332;padding:14px 20px;position:sticky;top:0;z-index:1;">'
            + '<div style="display:flex;align-items:center;gap:12px;">'
            + '<button id="psych-email-close" style="background:none;border:none;color:rgba(255,255,255,0.7);font-size:1.3em;cursor:pointer;padding:0;">✕</button>'
            + '<div style="flex:1;text-align:center;font-size:0.9em;color:rgba(255,255,255,0.8);font-weight:700;">거의 다 됐어요! 🎉</div>'
            + '</div></div>'
            + '<div style="flex:1;padding:32px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">'
            + '<div style="font-size:64px;margin-bottom:16px;">📱</div>'
            + '<div style="font-size:1.3em;font-weight:900;color:var(--primary-color);margin-bottom:10px;">이메일을 등록하면 결과가 저장돼요!</div>'
            + '<div style="font-size:0.9em;color:var(--text-muted);line-height:1.8;margin-bottom:28px;">'
            + '이메일을 등록하면 앱에 결과가 저장되고<br>30일 후 변화를 숫자로 비교할 수 있어요.<br>'
            + '<span style="color:#C9A84C;font-weight:700;">이메일 없이도 결과 확인 가능해요!</span>'
            + '</div>'
            + '<div style="width:100%;max-width:360px;">'
            + '<button id="psych-google-btn" style="width:100%;padding:14px;font-size:1em;border:1.5px solid #4285F4;border-radius:12px;background:#fff;color:#444;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:12px;">'
            + '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>'
            + '구글 계정에서 이메일 가져오기</button>'
            + '<input id="psych-email-input" type="email" placeholder="또는 이메일 직접 입력"'
            + ' style="width:100%;padding:13px 16px;font-size:1em;border:1.5px solid #ddd;border-radius:12px;box-sizing:border-box;text-align:center;outline:none;margin-bottom:12px;">'
            + '<button onclick="window._savePsychEmail()" style="width:100%;min-height:56px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1.05em;font-weight:700;cursor:pointer;margin-bottom:10px;">등록하고 결과 보기 🎉</button>'
            + '<button onclick="calcAndShowResult()" style="width:100%;min-height:48px;background:none;border:1px solid #ddd;border-radius:14px;font-size:0.9em;color:var(--text-muted);cursor:pointer;">이메일 없이 결과 보기</button>'
            + '</div></div>';
        document.body.appendChild(modal);
        document.getElementById('psych-email-close').addEventListener('click', function(){
            document.getElementById('psych-modal').remove();
        });

        // 구글 버튼 이벤트
        document.getElementById('psych-google-btn').addEventListener('click', function(){
            // ★ 심리테스트 답변을 localStorage에 백업 (구글 이동 전 보호)
            try { safeSetItem('psych_answers_backup', JSON.stringify(pA)); } catch(e){}
            safeSetItem('psych_mode_backup', pMode || 'full');

            var isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
            if(isMobile){
                // 모바일: 새 탭만 시도, 실패 시 직접 입력 안내 (리디렉션 절대 금지)
                var scope = encodeURIComponent('email profile');
                var redirectUri = encodeURIComponent('https://life2radio.github.io/pumsok/');
                var url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id='+GOOGLE_CLIENT_ID
                    +'&redirect_uri='+redirectUri+'&response_type=token&scope='+scope+'&prompt=select_account';
                var newTab = window.open(url, '_blank');
                if(!newTab){
                    // 새 탭 차단 → 리디렉션 없이 안내만
                    showToast('⚠️ 팝업이 차단됐어요. 이메일을 직접 입력해주세요!');
                    var inp = document.getElementById('psych-email-input');
                    if(inp){ inp.focus(); inp.scrollIntoView({behavior:'smooth'}); }
                    return;
                }
                // 새 탭에서 postMessage로 이메일 전달받기
                window.addEventListener('message', function _pe(e){
                    if(e.data && e.data.type === 'oauth_email'){
                        window.removeEventListener('message', _pe);
                        var inp = document.getElementById('psych-email-input');
                        if(inp && e.data.email) inp.value = e.data.email;
                        if(e.data.name && !safeGetItem('my_nickname','')) {
                            safeSetItem('my_nickname', e.data.name);
                        }
                        showToast('✅ 이메일이 입력됐어요! 결과 보기를 눌러주세요.');
                    }
                });
            } else {
                // PC: 기존 팝업 방식 유지
                window._googleOneTap();
                window.addEventListener('message', function _pe(e){
                    if(e.data && e.data.type === 'oauth_email'){
                        window.removeEventListener('message', _pe);
                        var inp = document.getElementById('psych-email-input');
                        if(inp && e.data.email) inp.value = e.data.email;
                        if(e.data.name && !safeGetItem('my_nickname','')) {
                            safeSetItem('my_nickname', e.data.name);
                        }
                        showToast('✅ 이메일이 입력됐어요! 결과 보기를 눌러주세요.');
                    }
                });
            }
        });
    }

    window._savePsychEmail = function(){
        const val = (document.getElementById('psych-email-input')?.value || '').trim();
        if(val){
            safeSetItem('my_email', val);
            const ei = document.getElementById('user-email-input');
            if(ei) ei.value = val;
            // ★ 심리테스트 이메일 등록 = 앱 가입으로 인정
            if(safeGetItem('onboarding_done','') !== '1'){
                safeSetItem('onboarding_done', '1');
                addPoint(30, '심리테스트가입보너스', 'psych_join_bonus');
            }
        }
        // ★ 혹시 리디렉션으로 답변이 날아갔다면 백업에서 복원
        if(Object.keys(pA).length === 0){
            try {
                var backup = safeGetItem('psych_answers_backup','');
                if(backup) { pA = JSON.parse(backup); }
            } catch(e){}
        }
        // 백업 데이터 정리
        safeSetItem('psych_answers_backup','');
        safeSetItem('psych_mode_backup','');
        // 기존 이메일 모달 제거 후 결과 표시
        var _em = document.getElementById('psych-modal');
        if(_em) _em.remove();
        calcAndShowResult();
    }

    // ════════════════════════════════════════════════════
    // 심리결과 → 미래편지/일기 이동 핸들러
    window._goToLetter = function() {
        var m = document.getElementById('psych-modal');
        if(m) m.remove();
        setTimeout(function(){
            switchView('memo');
            setTimeout(function(){ switchMemoTab('letter'); }, 100);
        }, 200);
    };
    window._goToDiary = function() {
        var m = document.getElementById('psych-modal');
        if(m) m.remove();
        setTimeout(function(){
            switchView('memo');
            setTimeout(function(){ switchMemoTab('diary'); }, 100);
        }, 200);
    };

    // ════════════════════════════════════════════════════
    // ════════════════════════════════════════════════════
    // 64유형 맞춤 내러티브 (이야기 형식 — 그래프와 역할 분리)
    // 그래프: 수치 표시 / 이야기: 삶의 방식·강점·성향 묘사
    // ════════════════════════════════════════════════════
    function buildPersonalNarrative(variantLabel, fs, scores, variantKey) {
        // 축 점수 (항상 정확) — 내러티브의 실제 기반
        var E = scores.E || 50, O = scores.O || 50;
        var A = scores.A || 50, C = scores.C || 50;
        var stab = 100 - (scores.N || 50);

        // facet 점수 유효성 체크 (전부 50이면 재검사 전 기본값)
        var facetVals = [fs.sociability, fs.assertiveness, fs.compassion,
                         fs.cooperation, fs.order, fs.industriousness];
        var facetValid = facetVals.some(function(v){ return v && v !== 50; });

        // 실제 사용할 점수 결정
        var soc = facetValid ? (fs.sociability||E) : E;
        var ast = facetValid ? (fs.assertiveness||E) : E;
        var com = facetValid ? (fs.compassion||A) : A;
        var coo = facetValid ? (fs.cooperation||A) : A;
        var ord = facetValid ? (fs.order||C) : C;
        var ind = facetValid ? (fs.industriousness||C) : C;
        var int_ = facetValid ? (fs.intellect||O) : O;

        function lv(s){ return s >= 65 ? 'H' : s < 38 ? 'L' : 'M'; }

        // ── 이야기 블록 (수치 없는 행동·성향 묘사) ──
        var introByE = {
            H: '방 안에 들어서면 분위기가 달라지는 사람입니다. 에너지를 나눌수록 더 커지고, 사람들을 자연스럽게 끌어당기는 힘이 있어요.',
            M: '내향도 외향도 아닌, 상황을 읽고 그에 맞게 자신을 조율하는 사람입니다. 필요할 때 무대에 서고, 필요할 때 조용히 관찰해요.',
            L: '말보다 생각이 먼저인 사람입니다. 혼자만의 시간에서 에너지를 충전하고, 소수의 깊은 관계를 넓은 인맥보다 훨씬 소중히 여겨요.'
        };
        var bodyByAC = {
            HH: '타인의 감정을 섬세하게 읽으면서도, 목표를 향해 체계적으로 전진합니다. 따뜻하지만 결코 흐지부지되지 않아요.',
            HM: '공감이 강점이에요. 주변 사람들이 힘들 때 가장 먼저 알아채고, 자신의 방식으로 조용히 곁에 있어줍니다.',
            HL: '사람을 깊이 이해하지만 타협은 잘 하지 않아요. 신념이 강하고, 자신이 옳다고 생각하는 방향으로 끝까지 밀어붙이는 편입니다.',
            MH: '뚜렷한 목표의식과 실행력이 있어요. 감정보다는 효율과 결과를 우선시하지만, 주변 사람들을 배려하는 마음도 잊지 않아요.',
            MM: '균형 잡힌 사람입니다. 혼자서도, 함께서도 잘 해내고요. 과하지도 부족하지도 않은 적당한 조화를 본능적으로 찾아요.',
            ML: '원칙과 자신만의 방식이 있는 사람이에요. 남들이 어떻게 하든 자기 기준대로 움직이고, 그 일관성이 신뢰를 만들어요.',
            LH: '논리적이고 체계적이에요. 감정보다 데이터와 근거를 믿고, 계획된 방식으로 목표를 달성하는 데 탁월합니다.',
            LM: '냉철한 판단력이 있어요. 감정에 휩쓸리지 않고 현실을 있는 그대로 보는 눈이 있어, 위기에 특히 강합니다.',
            LL: '자유로운 영혼이에요. 틀에 얽매이지 않고, 자신만의 리듬으로 세상을 살아갑니다. 뜻밖의 창의성이 강점이에요.'
        };
        var stabilityLine = {
            H: '감정적으로 매우 안정적이에요. 큰 사건 앞에서도 흔들리지 않는 평온함이, 주변 사람들에게 든든한 버팀목이 되어줍니다.',
            M: '감정 기복이 크지 않아요. 어지간한 일엔 동요하지 않고, 꾸준히 자신의 페이스를 유지합니다.',
            L: '감수성이 풍부한 사람입니다. 세상을 누구보다 깊이 느끼고, 그 풍부한 내면이 창의성과 공감력의 원천이 되어요.'
        };
        var openLine = {
            H: '새로운 아이디어와 가능성에 열려 있어요. 호기심이 삶의 원동력이고, 다양한 분야를 넘나드는 사고가 특기입니다.',
            M: '익숙한 것과 새로운 것을 적절히 섞어 갑니다. 급격한 변화보다는 검증된 방식 위에서 창의성을 발휘해요.',
            L: '검증된 것을 믿습니다. 유행보다 본질, 새로움보다 깊이를 추구하고, 그 일관성이 전문성의 뿌리가 돼요.'
        };

        // 핵심 정체성 태그 (점수 기반)
        var tags = [];
        if(com > 60 && coo < 55) tags.push('공감하는 신념의 리더');
        if(ind > 65 && ord < 45) tags.push('유연한 목표 추구자');
        if(int_ > 65 && soc < 45) tags.push('고독한 탐구자');
        if(soc > 65 && com > 65)  tags.push('따뜻한 연결자');
        if(ast > 65 && ord > 65)  tags.push('강인한 실행가');
        if(stab > 70)             tags.push('흔들리지 않는 기둥');
        if(stab < 35)             tags.push('섬세한 감성의 소유자');
        if(O > 70 && soc < 45)   tags.push('조용한 통찰가');
        if(tags.length === 0)     tags.push(variantLabel);

        var acKey = lv(A) + lv(C);
        var intro  = introByE[lv(E)] || introByE['M'];
        var body   = bodyByAC[acKey] || bodyByAC['MM'];
        var stabLine = stabilityLine[lv(stab)] || stabilityLine['M'];
        var openDesc  = openLine[lv(O)] || openLine['M'];

        var tagHTML = tags.slice(0,2).map(function(t){
            return '<b style="color:#1B4332;">' + t + '</b>';
        }).join(', ');

        return [
            '당신은 <b>' + variantLabel + '</b>입니다.',
            '&nbsp;',
            intro,
            '&nbsp;',
            body,
            '&nbsp;',
            openDesc,
            '&nbsp;',
            stabLine,
            '&nbsp;',
            '한 마디로 당신은 ' + tagHTML + '입니다.'
        ].join('<br>');
    }


    // ════════════════════════════════════════════════════
    // 🔬 심리테스트 점수 분석 디버그 뷰
    // ════════════════════════════════════════════════════
    window.showPsychDebug = function() {
        const r = window._lastPsychResult;
        if (!r) { showToast('결과를 먼저 완료해주세요!'); return; }
        const d = r._debug || {};
        const s = r.scores || {};
        const fs10 = (d.allFacets10) || {};
        const td = d.typeDecision || {};
        const vd = d.variantDecision || {};

        function bar(pct, color) {
            var p = Math.max(0, Math.min(100, pct||0));
            return '<div style="background:#eee;border-radius:6px;height:10px;width:100%;margin-top:4px;">' +
                   '<div style="background:' + color + ';height:10px;border-radius:6px;width:' + p + '%;"></div></div>';
        }
        function row(label, pct, color, note) {
            var lvl = pct >= 65 ? '높음 ↑' : pct < 38 ? '낮음 ↓' : '보통';
            return '<div style="margin-bottom:12px;">' +
                   '<div style="display:flex;justify-content:space-between;font-size:0.85em;">' +
                   '<span style="font-weight:700;">' + label + '</span>' +
                   '<span style="color:' + color + ';font-weight:700;">' + pct + '% · ' + lvl + '</span>' +
                   '</div>' + bar(pct, color) +
                   (note ? '<div style="font-size:0.75em;color:#888;margin-top:3px;">' + note + '</div>' : '') +
                   '</div>';
        }

        const html = '<div class="psych-debug-wrap" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:200000;overflow-y:auto;">' +
        '<div style="background:var(--bg-color);max-width:480px;margin:0 auto;min-height:100vh;padding:24px 20px 80px;">' +

        // 헤더
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div style="font-size:1.1em;font-weight:900;color:#1B4332;">🔬 내 점수 상세 분석</div>' +
        '<button id="psych-debug-close" style="background:none;border:none;font-size:1.3em;cursor:pointer;">✕</button>' +
        '</div>' +

        // ── STEP 1: Big5 축 점수 ──
        '<div style="background:var(--card-bg);border-radius:14px;padding:18px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.9em;font-weight:900;color:#1B4332;margin-bottom:14px;">📊 STEP 1 · Big5 축 점수</div>' +
        row('외향성 (E)', s.E||0, '#4ECDC4', '50% 이상=외향(☀️), 미만=내향(🌙) → ' + (td.E_label||'-')) +
        row('개방성 (O)', s.O||0, '#9B59B6', '50% 이상=개방(🔥), 미만=신중(🌱) → ' + (td.O_label||'-')) +
        row('친화성 (A)', s.A||0, '#E91E63', '50% 이상=친화(🤝), 미만=독립(🧊) → ' + (td.A_label||'-')) +
        row('성실성 (C)', s.C||0, '#FF9800', '50% 이상=성실(⚡), 미만=유연(💭) → ' + (td.C_label||'-')) +
        row('안정성 (N)', 100-(s.N||0), '#4CAF50', 'N점수를 반전 → 안정성으로 표시') +
        '</div>' +

        // ── STEP 2: 동물 결정 ──
        '<div style="background:#E8F5E9;border-radius:14px;padding:18px;margin-bottom:14px;border:2px solid #1B4332;">' +
        '<div style="font-size:0.9em;font-weight:900;color:#1B4332;margin-bottom:10px;">🐾 STEP 2 · 동물 결정 과정</div>' +
        '<div style="font-size:0.85em;line-height:2.2;color:#333;">' +

        '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:4px;">① 1차: Big5 축 점수 기반 (초기 분류)</div>' +
        '<div style="padding-left:8px;">E=' + (s.E||0) + '% → <b>' + (td.E_symbol||'?') + '</b> (' + (td.E_label||'-') + ')</div>' +
        '<div style="padding-left:8px;">O=' + (s.O||0) + '% → <b>' + (td.O_symbol||'?') + '</b> (' + (td.O_label||'-') + ')</div>' +
        '<div style="padding-left:8px;">A=' + (s.A||0) + '% → <b>' + (td.A_symbol||'?') + '</b> (' + (td.A_label||'-') + ')</div>' +
        '<div style="padding-left:8px;">C=' + (s.C||0) + '% → <b>' + (td.C_symbol||'?') + '</b> (' + (td.C_label||'-') + ')</div>' +
        '<div style="padding-left:8px;border-top:1px dashed #aaa;margin-top:4px;padding-top:4px;">' +
        '1차 typeKey = <b>' + (td.typeKey||'?') + '</b> → ' + (td.animal||'?') + '</div>' +

        (r.mbtiAccurate && r.mbtiAccurate !== (function(){var m={'ENTJ':'🦁','INTJ':'🐺','ESTJ':'🦅','ISTJ':'🦫','ENFJ':'🐘','INFJ':'🐋','ESFJ':'🦝','ISFJ':'🐢','ENTP':'🐒','INTP':'🦊','ENFP':'🦦','INFP':'🦌','ESTP':'🐯','ISTP':'🐆','ESFP':'🦢','ISFP':'🐱'}; var mbtiMap={'🦁':'ENTJ','🐺':'INTJ','🦅':'ESTJ','🦫':'ISTJ','🐘':'ENFJ','🐋':'INFJ','🦝':'ESFJ','🐢':'ISFJ','🐒':'ENTP','🦊':'INTP','🦦':'ENFP','🦌':'INFP','🐯':'ESTP','🐆':'ISTP','🦢':'ESFP','🐱':'ISFP'}; return mbtiMap[r.animal&&r.animal.animal]||''; }()) ?
        '<div style="background:#fff3cd;border-radius:8px;padding:8px;margin-top:8px;">' +
        '<div style="font-size:0.78em;font-weight:700;color:#856404;margin-bottom:4px;">② 2차: 페이싯 정밀 MBTI로 교체됨 ⚡</div>' +
        '<div style="padding-left:8px;">사교성=' + (fs10['사교성']||0) + '% → E/I 재판별</div>' +
        '<div style="padding-left:8px;">지적호기심=' + (fs10['지적호기심']||0) + '% → N/S 재판별</div>' +
        '<div style="padding-left:8px;">공감능력=' + (fs10['공감능력']||0) + '% → F/T 재판별</div>' +
        '<div style="padding-left:8px;">계획성=' + (fs10['계획성']||0) + '% → J/P 재판별</div>' +
        '<div style="padding-left:8px;border-top:1px dashed #C9A84C;margin-top:4px;padding-top:4px;">' +
        '정밀 MBTI = <b>' + r.mbtiAccurate + '</b></div>' +
        '</div>'
        : '<div style="font-size:0.78em;color:#888;margin-top:4px;padding-left:8px;">② 페이싯 결과와 동일 — 교체 없음</div>') +

        '<div style="background:#C8E6C9;border-radius:8px;padding:8px;margin-top:8px;font-size:1.05em;font-weight:900;color:#1B4332;">' +
        '최종 동물: ' + (r.animal ? r.animal.animal + ' ' + r.animal.name : '-') + '</div>' +
        '</div></div>' +

        // ── STEP 3: 10개 세부 facet ──
        '<div style="background:var(--card-bg);border-radius:14px;padding:18px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.9em;font-weight:900;color:#1B4332;margin-bottom:14px;">🎯 STEP 3 · 10개 세부 점수</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.82em;">' +
        ['사교성','주도성','지적호기심','예술감수성','공감능력','협력성','계획성','성취지향','불안관리','감정조절'].map(function(k) {
            var v = fs10[k] || 0;
            var col = v >= 65 ? '#1B4332' : v < 38 ? '#E91E63' : '#888';
            return '<div style="background:#f8f8f8;border-radius:8px;padding:8px;border-left:3px solid ' + col + ';">' +
                   '<div style="font-weight:700;">' + k + '</div>' +
                   '<div style="font-size:1.1em;font-weight:900;color:' + col + ';">' + v + '%</div>' +
                   '</div>';
        }).join('') +
        '</div></div>' +

        // ── STEP 4: A/B/C/D 결정 ──
        '<div style="background:#FFF8E7;border-radius:14px;padding:18px;margin-bottom:14px;border:2px solid #C9A84C;">' +
        '<div style="font-size:0.9em;font-weight:900;color:#856404;margin-bottom:10px;">🔑 STEP 4 · A/B/C/D 결정</div>' +
        '<div style="font-size:0.85em;line-height:2.0;color:#333;">' +
        '<div>' + (vd.f1_label||'-') + ' = <b>' + (vd.f1_score||0) + '%</b> → ' + ((vd.f1_score||0) >= 50 ? '✅ HIGH' : '❌ LOW') + '</div>' +
        '<div>' + (vd.f2_label||'-') + ' = <b>' + (vd.f2_score||0) + '%</b> → ' + ((vd.f2_score||0) >= 50 ? '✅ HIGH' : '❌ LOW') + '</div>' +
        '<div style="border-top:1px dashed #C9A84C;margin-top:8px;padding-top:8px;">' +
        'HIGH+HIGH=A / HIGH+LOW=B / LOW+HIGH=C / LOW+LOW=D</div>' +
        '<div style="font-size:1.15em;font-weight:900;color:#856404;margin-top:4px;">' +
        '→ <b>' + (r.animal ? r.animal.animal + ' ' + r.animal.name + '-' + (r.variantKey||'?') : '-') + '</b></div>' +
        '</div></div>' +

        '</div></div>';

        document.body.insertAdjacentHTML('beforeend', html);
        setTimeout(function(){
            var cl = document.getElementById('psych-debug-close');
            if(cl) cl.addEventListener('click', function(){
                var wrap = document.querySelector('.psych-debug-wrap');
                if(wrap) wrap.remove();
            });
        }, 100);
    };

    // getVariantDescription: ANIMAL_FACET_MAP 기반 64유형 프로필 반환
    // ════════════════════════════════════════════════════
    window.getVariantDescription = function(animalEmoji, variantKey) {
        if (typeof ANIMAL_FACET_MAP === 'undefined' || !ANIMAL_FACET_MAP[animalEmoji]) return null;
        var facetEntry = ANIMAL_FACET_MAP[animalEmoji];
        var variants   = facetEntry.variants || {};
        var variant    = variants[variantKey] || variants['A'] || {};

        // PSYCH_ANIMALS에서 narrative/strengths/cautions 가져오기
        var animalData = null;
        Object.keys(PSYCH_ANIMALS).forEach(function(k) {
            if (PSYCH_ANIMALS[k].animal === animalEmoji) animalData = PSYCH_ANIMALS[k];
        });

        return {
            label:       variant.label || facetEntry.name,
            narrative:   animalData ? (animalData.desc      || '') : '',
            strengths:   animalData ? (animalData.strengths || []) : [],
            cautions:    animalData ? (animalData.cautions  || []) : [],
            celebrities: variant.celebs || []
        };
    };

    
    // ════════════════════════════════════════════════════════
    // ★ 정밀 MBTI 계산 (페이싯 핵심값 기반 — BFI 점수와 완전 독립)
    // 사교성→E/I / 지적탐구→N/S / 공감능력→F/T / 계획성→J/P
    // ════════════════════════════════════════════════════════
    function calcAccurateMBTI(af, mode) {
        // 간편테스트(quick)는 문항 부족으로 정확도 낮음 → 계산 안 함
        if (mode === 'quick') return null;

        // allFacets 없으면 계산 불가
        if (!af) return null;

        // ── 각 축 페이싯 값 추출 (변수명 mbti_ 접두어로 N 충돌 방지) ──
        var mbti_EI  = af.sociability     != null ? af.sociability     : null;
        var mbti_NS  = af.intellect       != null ? af.intellect       : null;
        var mbti_FT  = af.compassion      != null ? af.compassion      : null;
        var mbti_JP  = af.order           != null ? af.order           : null;

        // 보조 페이싯 (경계선 46~54% 구간에서만 사용)
        var mbti_EI2 = af.assertiveness   != null ? af.assertiveness   : null;
        var mbti_NS2 = af.aesthetics      != null ? af.aesthetics      : null;
        var mbti_FT2 = af.cooperation     != null ? af.cooperation     : null;
        var mbti_JP2 = af.industriousness != null ? af.industriousness : null;

        // 하나라도 null이면 계산 불가
        if (mbti_EI===null || mbti_NS===null || mbti_FT===null || mbti_JP===null) return null;

        // ── 판별 함수 (경계선 처리 포함) ──
        // 50% 이상 → 해당 축 방향 / 미만 → 반대 방향
        // 경계선(46~54%): 2차 페이싯 보조
        function decide(primary, secondary, highChar, lowChar) {
            if (primary >= 55) return highChar;
            if (primary <= 45) return lowChar;
            // 46~54% 경계선 → 보조 페이싯
            if (secondary !== null) {
                return secondary >= 50 ? highChar : lowChar;
            }
            // 보조도 없으면 50 기준 단순 결정
            return primary >= 50 ? highChar : lowChar;
        }

        var ei = decide(mbti_EI,  mbti_EI2,  '☀️', '🌙');
        var ns = decide(mbti_NS,  mbti_NS2,  '🔥', '🌱');
        var ft = decide(mbti_FT,  mbti_FT2,  '🤝', '🧊');
        var jp = decide(mbti_JP,  mbti_JP2,  '⚡', '💭');

        // ── 이모지 → MBTI 텍스트 변환 ──
        var E = ei === '☀️' ? 'E' : 'I';
        var N = ns === '🔥' ? 'N' : 'S';
        var F = ft === '🤝' ? 'F' : 'T';
        var J = jp === '⚡' ? 'J' : 'P';

        return E + N + F + J;
    }

    function calcAndShowResult(){
        if(!safeGetItem('my_email','')) window._psychNoEmailResult = true;
        safeSetItem('psych_last_date', new Date().toISOString().slice(0,10));
        // 소요시간 계산
        if(window._psychStartTime) {
            var _elapsed = Math.round((Date.now() - window._psychStartTime) / 1000);
            pA['_elapsed_sec'] = _elapsed;
        }
        
        // 1. 기본 Big 5 채점
        const bfi = { E:[], O:[], A:[], C:[], N:[] };
        getBFI().forEach(item => {
            let raw = pA['bfi_'+item.id] || 4;
            if(item.rev) raw = 8 - raw;
            bfi[item.axis].push(raw);
        });
        
        const scores = {};
        const rawScores = {}; 
        ['E','O','A','C','N'].forEach(ax => {
            const avg = bfi[ax].reduce((a,b)=>a+b,0)/bfi[ax].length;
            scores[ax] = Math.round((avg-1)/6*100);
            rawScores[ax] = Math.round(avg*100)/100;
        });

        // 2. 동물 판별 (16마리)
        const E = scores.E >= 50 ? '☀️' : '🌙';
        const O = scores.O >= 50 ? '🔥' : '🌱';
        const A = scores.A >= 50 ? '🤝' : '🧊';
        const C = scores.C >= 50 ? '⚡' : '💭';
        const typeKey = E+O+A+C;
        const animalData = PSYCH_ANIMALS[typeKey] || PSYCH_ANIMALS['🌙🌱🤝💭'];

        // 3. Facet 정밀 채점
        const calcFacet = (facetName) => {
            const items = getBFI().filter(it => it.facet === facetName);
            let sum = 0, count = 0;
            items.forEach(it => {
                const val = pA['bfi_'+it.id];
                if(val !== undefined){
                    const raw = it.rev ? 8 - val : val;
                    sum += raw;
                    count++;
                }
            });
            return count === 0 ? 4 : sum / count;
        };

        const f_compassion    = calcFacet('compassion');
        const f_cooperation   = calcFacet('cooperation');
        const f_industriousness = calcFacet('industriousness');
        const f_order         = calcFacet('order');
        const f_intellect     = calcFacet('intellect');
        const f_aesthetics    = calcFacet('aesthetics');
        const f_sociability   = calcFacet('sociability');
        const f_assertiveness = calcFacet('assertiveness');

        // 4. A/B/C/D 타입 판별
        let variantKey = 'A';
        let facetData = {};
        const animal_emoji = animalData.animal;

        // 2차 허들: 75% = 5.5 (1~7점 척도에서 1 + 0.75×6 = 5.5)
        // 그룹 분류: TJ / FJ / NP / SP
        const H1 = 5.5; // 75% 임계값 — 동물 결정에 사용된 페이싯
        const H2 = 4.0; // 50% 임계값 — 동물 결정에 미사용 페이싯

        if (['🦁','🐺','🦅','🦫'].includes(animal_emoji)) {
            // TJ 그룹: 계획성(사용-J/75%) × 성취지향(미사용/50%)
            const h1 = f_order >= H1, h2 = f_industriousness >= H2;
            variantKey = (h1 && h2) ? 'A' : (h1 && !h2) ? 'B' : (!h1 && h2) ? 'C' : 'D';
            facetData = { l1: '계획/체계', s1: Math.round((f_order-1)/6*100), l2: '성취 지향', s2: Math.round((f_industriousness-1)/6*100) };
        } else if (['🐘','🐋','🦝','🐢'].includes(animal_emoji)) {
            // FJ 그룹: 공감능력 × 협력성 (친화성 A의 두 페이싯)
            const h1 = f_compassion >= H1, h2 = f_cooperation >= H2;
            variantKey = (h1 && h2) ? 'A' : (h1 && !h2) ? 'B' : (!h1 && h2) ? 'C' : 'D';
            facetData = { l1: '공감 능력', s1: Math.round((f_compassion-1)/6*100), l2: '협력/조율', s2: Math.round((f_cooperation-1)/6*100) };
        } else if (['🐒','🦊','🦦','🦌'].includes(animal_emoji)) {
            // NP 그룹: 지적탐구 × 예술감수성 (개방성 O의 두 페이싯)
            const h1 = f_intellect >= H1, h2 = f_aesthetics >= H2;
            variantKey = (h1 && h2) ? 'A' : (h1 && !h2) ? 'B' : (!h1 && h2) ? 'C' : 'D';
            facetData = { l1: '지적 탐구', s1: Math.round((f_intellect-1)/6*100), l2: '예술 감수성', s2: Math.round((f_aesthetics-1)/6*100) };
        } else if (['🐯','🐆','🦢','🐱'].includes(animal_emoji)) {
            // SP 그룹: 사교성 × 주도성 (외향성 E의 두 페이싯)
            const h1 = f_sociability >= H1, h2 = f_assertiveness >= H2;
            variantKey = (h1 && h2) ? 'A' : (h1 && !h2) ? 'B' : (!h1 && h2) ? 'C' : 'D';
            facetData = { l1: '사교성', s1: Math.round((f_sociability-1)/6*100), l2: '주도/통제', s2: Math.round((f_assertiveness-1)/6*100) };
        }

        // 5. 64가지 프로필
        // getVariantDescription 없으면 기본값 사용
        const variantProfile = (typeof window.getVariantDescription === 'function')
            ? window.getVariantDescription(animal_emoji, variantKey)
            : {
                label: animalData.name,
                narrative: animalData.desc || '',
                strengths: animalData.strengths || [],
                cautions: animalData.cautions || [],
                celebrities: animalData.celebrities || []
              };

        // 6. RSE, VIA 채점
        let rseTotal = 0;
        getRSE().forEach(item => {
            let raw = pA['rse_'+item.id] || 4;
            if(item.rev) raw = 8 - raw;
            rseTotal += raw;
        });
        const _rseLen = getRSE().length;
        scores.RSE = Math.round((rseTotal - _rseLen) / (_rseLen * 6) * 100);
        const viaStrengths = VIA_ITEMS.map(item => item.str[pA['via_'+item.id] || 0]);

        // 7. 전체 Facet 점수 저장 (심층 분석용)
        const f_anxiety    = calcFacet('anxiety');
        const f_volatility = calcFacet('volatility');
        const allFacets = {
            sociability:     Math.round((f_sociability-1)/6*100),
            assertiveness:   Math.round((f_assertiveness-1)/6*100),
            intellect:       Math.round((f_intellect-1)/6*100),
            aesthetics:      Math.round((f_aesthetics-1)/6*100),
            compassion:      Math.round((f_compassion-1)/6*100),
            cooperation:     Math.round((f_cooperation-1)/6*100),
            order:           Math.round((f_order-1)/6*100),
            industriousness: Math.round((f_industriousness-1)/6*100),
            anxiety:         Math.round((f_anxiety-1)/6*100),
            volatility:      Math.round((f_volatility-1)/6*100),
        };

        // 8. 결과 저장 (pA 개별 답변도 저장 → 언제든 facet 재계산 가능)
        const result = {
            typeKey, animal: animalData, scores, rawScores, viaStrengths,
            variant: variantProfile, variantKey, facetData, allFacets,
            pAnswers: Object.assign({}, pA),
            _elapsedSec: pA['_elapsed_sec'] || '',
            _mode: pMode || 'full',
            info: { route: pA['info_route'], age: pA['info_age'], region: pA['info_region'] },
            date: getTodayStr(),
            _debug: {
                typeDecision: {
                    E_score: scores.E, E_symbol: E, E_label: scores.E >= 50 ? '외향(☀️)' : '내향(🌙)',
                    O_score: scores.O, O_symbol: O, O_label: scores.O >= 50 ? '개방(🔥)' : '신중(🌱)',
                    A_score: scores.A, A_symbol: A, A_label: scores.A >= 50 ? '친화(🤝)' : '독립(🧊)',
                    C_score: scores.C, C_symbol: C, C_label: scores.C >= 50 ? '성실(⚡)' : '유연(💭)',
                    typeKey: typeKey, animal: animalData.name
                },
                variantDecision: {
                    variantKey: variantKey,
                    f1_label: facetData.l1, f1_score: facetData.s1,
                    f2_label: facetData.l2, f2_score: facetData.s2,
                    rule: facetData.l1 + ' ' + (facetData.s1>=50?'↑HIGH':'↓LOW') + ' / ' + facetData.l2 + ' ' + (facetData.s2>=50?'↑HIGH':'↓LOW')
                },
                allFacets10: {
                    사교성: Math.round((f_sociability-1)/6*100),
                    주도성: Math.round((f_assertiveness-1)/6*100),
                    지적호기심: Math.round((f_intellect-1)/6*100),
                    예술감수성: Math.round((f_aesthetics-1)/6*100),
                    공감능력: Math.round((f_compassion-1)/6*100),
                    협력성: Math.round((f_cooperation-1)/6*100),
                    계획성: Math.round((f_order-1)/6*100),
                    성취지향: Math.round((f_industriousness-1)/6*100),
                    불안관리: Math.round((1-(f_anxiety||4)/7)*100),
                    감정조절: Math.round((1-(f_volatility||4)/7)*100)
                }
            }
        };

        // ★ 정밀 MBTI 계산 (기존 typeKey·동물유형 완전 독립)
        var _mbtiAccurate = calcAccurateMBTI(allFacets, pMode);
        if (_mbtiAccurate) {
            result.mbtiAccurate = _mbtiAccurate;
        }

        // ★ B안: mbtiAccurate 기반으로 동물·variantKey 재결정
        if (_mbtiAccurate && pMode !== 'quick') {
            var MBTI_TO_ANIMAL = {
                'ENTJ':'🦁','INTJ':'🐺','ESTJ':'🦅','ISTJ':'🦫',
                'ENFJ':'🐘','INFJ':'🐋','ESFJ':'🦝','ISFJ':'🐢',
                'ENTP':'🐒','INTP':'🦊','ENFP':'🦦','INFP':'🦌',
                'ESTP':'🐯','ISTP':'🐆','ESFP':'🦢','ISFP':'🐱'
            };
            var _accurateEmoji = MBTI_TO_ANIMAL[_mbtiAccurate];
            if (_accurateEmoji && _accurateEmoji !== result.animal.animal) {
                // 새 동물 객체 찾기 (PSYCH_ANIMALS 역조회)
                var _newAnimalData = null;
                Object.keys(PSYCH_ANIMALS).forEach(function(k) {
                    if (PSYCH_ANIMALS[k].animal === _accurateEmoji) _newAnimalData = PSYCH_ANIMALS[k];
                });
                if (_newAnimalData) {
                    // 새 동물 그룹에 맞는 variantKey 재계산
                    var _newVK = 'A';
                    var _newFacetData = {};
                    var TJ = ['🦁','🐺','🦅','🦫'], FJ = ['🐘','🐋','🦝','🐢'];
                    var NP = ['🐒','🦊','🦦','🦌'], SP = ['🐯','🐆','🦢','🐱'];
                    if (TJ.includes(_accurateEmoji)) {
                        var h1 = f_order >= H1, h2 = f_industriousness >= H2;
                        _newVK = (h1&&h2)?'A':(h1)?'B':(!h1&&h2)?'C':'D';
                        _newFacetData = { l1:'계획/체계', s1:Math.round((f_order-1)/6*100), l2:'성취 지향', s2:Math.round((f_industriousness-1)/6*100) };
                    } else if (FJ.includes(_accurateEmoji)) {
                        var h1 = f_compassion >= H1, h2 = f_cooperation >= H2;
                        _newVK = (h1&&h2)?'A':(h1)?'B':(!h1&&h2)?'C':'D';
                        _newFacetData = { l1:'공감 능력', s1:Math.round((f_compassion-1)/6*100), l2:'협력/조율', s2:Math.round((f_cooperation-1)/6*100) };
                    } else if (NP.includes(_accurateEmoji)) {
                        var h1 = f_intellect >= H1, h2 = f_aesthetics >= H2;
                        _newVK = (h1&&h2)?'A':(h1)?'B':(!h1&&h2)?'C':'D';
                        _newFacetData = { l1:'지적 탐구', s1:Math.round((f_intellect-1)/6*100), l2:'예술 감수성', s2:Math.round((f_aesthetics-1)/6*100) };
                    } else if (SP.includes(_accurateEmoji)) {
                        var h1 = f_sociability >= H1, h2 = f_assertiveness >= H2;
                        _newVK = (h1&&h2)?'A':(h1)?'B':(!h1&&h2)?'C':'D';
                        _newFacetData = { l1:'사교성', s1:Math.round((f_sociability-1)/6*100), l2:'주도/통제', s2:Math.round((f_assertiveness-1)/6*100) };
                    }
                    // 새 variantProfile
                    var _newVariantProfile = (typeof window.getVariantDescription === 'function')
                        ? window.getVariantDescription(_accurateEmoji, _newVK)
                        : { label: _newAnimalData.name, narrative: '', strengths: [], cautions: [], celebrities: [] };
                    // result 업데이트
                    result.animal         = _newAnimalData;
                    result.variantKey     = _newVK;
                    result.facetData      = _newFacetData;
                    result.variant        = _newVariantProfile;
                    result._originalTypeKey = result.typeKey; // 원본 보존
                }
            }
        }

        safeSetItem('psych_result_v2', JSON.stringify(result));
        renderPsychPreview();
        sendPsychToSheet(result);
        showPsychResult(result);
    }

    // ── 글자 크기 조절 함수 ──
    var _psychFontStep = 0; // -2 ~ +3 단계
    var _psychFontSteps = [0.82, 0.91, 1.0, 1.1, 1.2, 1.32];
    var _psychFontLabels = ['작게', '작게', '기본', '크게', '크게', '매우크게'];
    window._psychFontUp = function() {
        if (_psychFontStep >= _psychFontSteps.length - 1) return;
        _psychFontStep++;
        _applyPsychFont();
    };
    window._psychFontDown = function() {
        if (_psychFontStep <= 0) return;
        _psychFontStep--;
        _applyPsychFont();
    };
    function _applyPsychFont() {
        var content = document.getElementById('psych-result-content');
        var label = document.getElementById('psych-font-label');
        if (content) content.style.fontSize = _psychFontSteps[_psychFontStep] + 'em';
        if (label) label.textContent = _psychFontLabels[_psychFontStep];
    }

    function showPsychResult(result){
        window._lastPsychResult = result; // 이미지 저장용 전역 보관
        var _resultMode = result._mode || result.mode || pMode || 'full';
        // 빠른테스트 localStorage에서 불러올 때도 mode 확인
        if (!result._mode && !result.mode) {
            var _savedMode = typeof safeGetItem === 'function' ? safeGetItem('psych_mode_backup','') : '';
            if (_savedMode === 'quick') _resultMode = 'quick';
        }
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
        var modal = document.getElementById('psych-modal');
        if(!modal){
            modal = document.createElement('div');
            modal.id = 'psych-modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:var(--bg-color);overflow-y:auto;';
            document.body.appendChild(modal);
        }

        // ── [1] 데이터 추출 ──
        const { scores, viaStrengths, variant, allFacets } = result;

        // ★ B안: mbtiAccurate 기반으로 동물 재결정 (동물↔MBTI 일관성)
        var animal = result.animal || {};
        if (result.mbtiAccurate && _resultMode !== 'quick') {
            var _MBTI_TO_EMOJI = {'ENTJ':'🦁','INTJ':'🐺','ESTJ':'🦅','ISTJ':'🦫','ENFJ':'🐘','INFJ':'🐋','ESFJ':'🦝','ISFJ':'🐢','ENTP':'🐒','INTP':'🦊','ENFP':'🦦','INFP':'🦌','ESTP':'🐯','ISTP':'🐆','ESFP':'🦢','ISFP':'🐱'};
            var _targetEmoji = _MBTI_TO_EMOJI[result.mbtiAccurate];
            if (_targetEmoji && _targetEmoji !== animal.animal) {
                Object.keys(PSYCH_ANIMALS).forEach(function(tk) {
                    if (PSYCH_ANIMALS[tk].animal === _targetEmoji) animal = PSYCH_ANIMALS[tk];
                });
            }
        }
        // pAnswers 있으면 facet 재계산 (정확한 점수)
        var _recalcFacets = {};
        if (result.pAnswers && typeof BFI_ITEMS !== 'undefined') {
            var _pA = result.pAnswers;
            var _calcF = function(facetName) {
                var items = BFI_ITEMS.filter(function(it){ return it.facet === facetName; });
                var sum = 0, cnt = 0;
                items.forEach(function(it){
                    var val = _pA['bfi_' + it.id];
                    if (val !== undefined) {
                        sum += it.rev ? (8 - val) : val;
                        cnt++;
                    }
                });
                return cnt === 0 ? null : Math.round((sum/cnt - 1) / 6 * 100);
            };
            ['sociability','assertiveness','intellect','aesthetics',
             'compassion','cooperation','order','industriousness',
             'anxiety','volatility'].forEach(function(f){
                var v = _calcF(f);
                if (v !== null) _recalcFacets[f] = v;
            });
        }

        const fs = Object.keys(_recalcFacets).length > 0
            ? _recalcFacets          // pAnswers로 정확히 재계산
            : (allFacets || {});     // 폴백: 저장된 allFacets

        // facet 점수 조회 — 50이면 axis score로 대체 (50=미계산 기본값)
        function _fs(key, axisScore) {
            var s = fs[key];
            if (s !== undefined && s !== null && s !== 50) return s;
            // s가 50이거나 없으면 → axis score 사용
            return Math.round(axisScore || 50);
        }

        // ★ 항상 ANIMAL_FACET_MAP에서 최신 라벨/내러티브 읽기
        var _fmVariant = (typeof ANIMAL_FACET_MAP !== 'undefined' &&
            ANIMAL_FACET_MAP[animal.animal] &&
            ANIMAL_FACET_MAP[animal.animal].variants[_vKey])
            ? ANIMAL_FACET_MAP[animal.animal].variants[_vKey] : null;
        const vLabel     = (_fmVariant && _fmVariant.label)     ? _fmVariant.label     : (variant ? variant.label     : animal.name);
        const vNarrative = (_fmVariant && _fmVariant.narrative) ? _fmVariant.narrative : (variant ? variant.narrative : (animal.desc || ''));
        // 강점/주의점: 항상 ANIMAL_STRENGTH_MAP에서 재조회 (저장 결과 호환)
        var vStrengths = [];
        var vCautions  = [];
        if (typeof ANIMAL_STRENGTH_MAP !== 'undefined' && ANIMAL_STRENGTH_MAP[animal.animal]) {
            vStrengths = ANIMAL_STRENGTH_MAP[animal.animal].strengths || [];
            vCautions  = ANIMAL_STRENGTH_MAP[animal.animal].cautions  || [];
        }
        // 폴백: ANIMAL_STRENGTH_MAP 없으면 저장된 데이터 사용
        if (vStrengths.length === 0) {
            vStrengths = (variant && variant.strengths) ? variant.strengths : (animal.strengths || []);
        }
        if (vCautions.length === 0) {
            vCautions = (variant && variant.cautions) ? variant.cautions : (animal.cautions || []);
        }
        // 유명인 데이터: ANIMAL_FACET_MAP + EXTRA_CELEBS 합산 (4~5명)
        var _vKey = result.variantKey || 'A';

        // ★ variant label/narrative를 항상 ANIMAL_FACET_MAP에서 최신으로 읽기 (캐시 무시)
        if (typeof ANIMAL_FACET_MAP !== 'undefined' &&
            ANIMAL_FACET_MAP[animal.animal] &&
            ANIMAL_FACET_MAP[animal.animal].variants[_vKey]) {
            var _freshV = ANIMAL_FACET_MAP[animal.animal].variants[_vKey];
            if (_freshV.label)     { if(result.variant) result.variant.label     = _freshV.label; }
            if (_freshV.narrative) { if(result.variant) result.variant.narrative = _freshV.narrative; }
            if (_freshV.compatible && result.compatible) {
                result.compatible.label = _freshV.compatible.label;
            }
        }

    // MBTI 연결 이유 맵
    // 동물별 MBTI 연결 이유 (A/B/C/D 모두 같은 MBTI)
    var _MBTI_REASONS = {
        '🦁': { mbti:'ENTJ', msg:'당신은 세상을 향해 에너지를 발산하고(E), 보이지 않는 가능성과 큰 그림을 봐요(N). 감정보다 논리와 목표로 판단하고(T), 계획을 세워 통제하는 것이 자연스러운 분이에요(J). 이 조합이 바로 ENTJ예요 💪' },
        '🐺': { mbti:'INTJ', msg:'당신은 조용히 내면에서 에너지를 충전하고(I), 큰 그림과 가능성을 직관으로 봐요(N). 감정보다 논리로 판단하며(T), 계획을 세워 확실히 마무리하는 것이 편한 분이에요(J). 이 조합이 바로 INTJ예요 🔭' },
        '🦅': { mbti:'ESTJ', msg:'당신은 세상을 향해 에너지를 발산하고(E), 현실과 경험을 중시해요(S). 논리와 원칙으로 판단하며(T), 계획을 세워 체계적으로 실행하는 것이 자연스러운 분이에요(J). 이 조합이 바로 ESTJ예요 🏛️' },
        '🦫': { mbti:'ISTJ', msg:'당신은 조용히 혼자 에너지를 충전하고(I), 실제로 검증된 것을 신뢰해요(S). 원칙과 논리로 판단하며(T), 체계적인 계획으로 끝까지 완수하는 것이 편한 분이에요(J). 이 조합이 바로 ISTJ예요 💎' },
        '🐘': { mbti:'ENFJ', msg:'당신은 세상을 향해 에너지를 발산하고(E), 가능성과 사람의 잠재력을 봐요(N). 따뜻한 감성으로 판단하며(F), 계획을 세워 사람들을 이끄는 것이 자연스러운 분이에요(J). 이 조합이 바로 ENFJ예요 🌈' },
        '🐋': { mbti:'INFJ', msg:'당신은 조용히 내면에서 에너지를 충전하고(I), 사람의 깊은 가능성을 직관으로 봐요(N). 따뜻한 감성으로 판단하며(F), 의미 있는 목표를 향해 체계적으로 나아가는 분이에요(J). 이 조합이 바로 INFJ예요 💙' },
        '🦝': { mbti:'ESFJ', msg:'당신은 세상을 향해 에너지를 발산하고(E), 현실과 사람들의 필요를 세심하게 챙겨요(S). 따뜻한 감성으로 판단하며(F), 계획적으로 사람들을 돌보는 것이 자연스러운 분이에요(J). 이 조합이 바로 ESFJ예요 ☀️' },
        '🐢': { mbti:'ISFJ', msg:'당신은 조용히 혼자 에너지를 충전하고(I), 실제 경험과 현실을 소중히 여겨요(S). 따뜻한 감성으로 판단하며(F), 묵묵히 계획을 세워 사람들을 헌신적으로 돌보는 분이에요(J). 이 조합이 바로 ISFJ예요 🕊️' },
        '🐒': { mbti:'ENTP', msg:'당신은 세상을 향해 에너지를 발산하고(E), 가능성과 새로운 아이디어를 탐구해요(N). 논리와 호기심으로 판단하며(T), 계획보다 상황에 따라 유연하게 움직이는 분이에요(P). 이 조합이 바로 ENTP예요 🧠' },
        '🦊': { mbti:'INTP', msg:'당신은 조용히 혼자 에너지를 충전하고(I), 이론과 가능성의 세계를 탐구해요(N). 차가운 논리로 진리를 파헤치며(T), 계획보다 탐구와 발견을 즐기는 분이에요(P). 이 조합이 바로 INTP예요 🔬' },
        '🦦': { mbti:'ENFP', msg:'당신은 세상을 향해 에너지를 발산하고(E), 사람과 가능성에서 영감을 받아요(N). 따뜻한 감성으로 판단하며(F), 계획보다 즉흥적인 열정으로 움직이는 자유로운 분이에요(P). 이 조합이 바로 ENFP예요 🔥' },
        '🦌': { mbti:'INFP', msg:'당신은 조용히 혼자 에너지를 충전하고(I), 깊은 내면의 가치와 가능성을 봐요(N). 따뜻하고 섬세한 감성으로 판단하며(F), 계획보다 영감과 흐름을 따라가는 분이에요(P). 이 조합이 바로 INFP예요 🌸' },
        '🐯': { mbti:'ESTP', msg:'당신은 세상을 향해 에너지를 발산하고(E), 지금 이 순간의 현실과 감각을 즐겨요(S). 논리와 결과로 판단하며(T), 계획보다 즉흥적인 행동과 스릴을 좋아하는 분이에요(P). 이 조합이 바로 ESTP예요 ⚡' },
        '🐆': { mbti:'ISTP', msg:'당신은 조용히 혼자 에너지를 충전하고(I), 현실적이고 실용적인 것을 중시해요(S). 냉철한 논리로 판단하며(T), 계획보다 자유롭고 독립적으로 행동하는 분이에요(P). 이 조합이 바로 ISTP예요 🎯' },
        '🦢': { mbti:'ESFP', msg:'당신은 세상을 향해 에너지를 발산하고(E), 지금 이 순간의 아름다움과 사람을 즐겨요(S). 따뜻한 감성으로 판단하며(F), 계획보다 즉흥적인 경험과 즐거움을 사랑하는 분이에요(P). 이 조합이 바로 ESFP예요 ✨' },
        '🐱': { mbti:'ISFP', msg:'당신은 조용히 혼자 에너지를 충전하고(I), 아름다운 현실의 감각을 소중히 해요(S). 따뜻하고 섬세한 감성으로 판단하며(F), 계획보다 자유롭게 자신의 감각을 따르는 분이에요(P). 이 조합이 바로 ISFP예요 🌺' },
    };;
        var vCelebs = [];
        if (typeof ANIMAL_FACET_MAP !== 'undefined' &&
            ANIMAL_FACET_MAP[animal.animal] &&
            ANIMAL_FACET_MAP[animal.animal].variants[_vKey]) {
            vCelebs = ANIMAL_FACET_MAP[animal.animal].variants[_vKey].celebs || [];
        }
        // EXTRA_CELEBS 추가 (4~5명으로 확장)
        var _extraKey = animal.animal + _vKey;
        if (typeof EXTRA_CELEBS !== 'undefined' && EXTRA_CELEBS[_extraKey]) {
            vCelebs = vCelebs.concat(EXTRA_CELEBS[_extraKey]);
        }
        // 폴백
        if (vCelebs.length === 0) {
            vCelebs = (variant && variant.celebrities) ? variant.celebrities : (animal.celebrities || []);
        }

        // ── [2] 기존 스타일 함수 ──
        const love   = getLoveStyle(scores);
        const work   = getWorkStyle(scores);
        const friend = getFriendStyle(scores);
        const hard   = getHardStyle(scores);
        const money  = getMoneyStyle(scores);
        const rse    = getRseStyle(scores.RSE);
        const via    = getViaStyle(viaStrengths);

        // ── [3] 빠른테스트 배지/CTA ──
        const _qBadge  = pMode==='quick' ? '<div style="background:rgba(255,193,7,0.2);border:1px solid rgba(255,193,7,0.4);border-radius:20px;padding:5px 16px;font-size:0.78em;color:#FFC107;font-weight:700;margin-bottom:10px;display:inline-block;">⚡ 빠른 테스트 결과</div>' : '';
        const _precCTA = pMode==='quick' ? '<div style="background:#FFF8E7;border-radius:16px;padding:16px;margin-bottom:14px;border:1px solid #F0D080;text-align:center;"><div style="font-size:0.88em;font-weight:700;color:#856404;margin-bottom:8px;">🔬 더 정확한 결과를 원하신다면?</div><div style="font-size:0.82em;color:#856404;line-height:1.7;margin-bottom:12px;">정밀 테스트(78문항)로 연애·일·소비 스타일까지 완전 분석해보세요!<br><span style="font-size:0.9em;opacity:0.85;">✅ 정밀 테스트 완료 시 더 정확한 MBTI 유형도 함께 알려드려요</span></div><button id="_precisionBtn" style="background:#1B4332;color:#fff;border:none;border-radius:12px;padding:10px 24px;font-size:0.88em;font-weight:700;cursor:pointer;">🔬 정밀 테스트 시작하기</button></div>' : '';

        // ── [4] Facet 텍스트 테이블 ──
        const _FT = {
            sociability:     ['혼자만의 시간이 에너지의 원천이에요','소수의 깊은 관계를 선호해요','상황에 따라 사교성이 달라져요','사람들과 어울리는 것을 즐겨요','모임이 삶의 활력소예요'],
            assertiveness:   ['배려와 지지로 영향력을 줘요','뒤에서 조용히 힘을 보태요','필요할 때 앞에 나서요','결정적 순간엔 자연스럽게 리더가 돼요','타고난 주도력으로 길을 열어요'],
            intellect:       ['경험과 실용적 지식을 중시해요','관심 분야에 집중적으로 파고들어요','필요할 때 깊이 탐구해요','다양한 이론과 아이디어를 탐색해요','철학과 이론의 세계에 빠져들어요'],
            aesthetics:      ['기능과 실용을 우선시해요','가끔 아름다움에 감동받아요','감수성과 실용성의 균형이 잡혀 있어요','섬세하게 아름다움을 감상해요','예술과 아름다움에 깊이 몰입해요'],
            compassion:      ['논리와 사실로 상황을 이해해요','감정은 인식하되 거리를 유지해요','공감하면서도 균형을 유지해요','타인의 감정에 민감하게 반응해요','상대방 마음을 먼저 읽어요'],
            cooperation:     ['나만의 방식과 기준을 지켜요','독립적으로 결정하고 추진해요','상황에 따라 협력 여부를 결정해요','팀워크를 자연스럽게 실천해요','팀을 위해 기꺼이 양보하고 조율해요'],
            order:           ['즉흥성과 유연함이 최대 강점이에요','큰 방향만 잡고 흘러가요','필요할 때 계획을 세워요','체계적이고 꼼꼼하게 진행해요','완벽한 계획 수립이 안심이 돼요'],
            industriousness: ['과정 자체를 즐기며 여유롭게 살아요','의미 있을 때 전력을 다해요','목표와 여유의 균형을 맞춰요','시작한 일은 끝까지 해내요','목표 달성이 삶의 원동력이에요'],
            anxiety_inv:     ['걱정과 불안이 자주 찾아와요','미래와 결과를 자주 걱정해요','가끔 불안하지만 잘 극복해요','크게 걱정하지 않고 흘러가요','긍정적이고 낙천적인 삶을 살아요'],
            volatility_inv:  ['감정이 강하고 직접적으로 표현돼요','기분 변화가 눈에 띄는 편이에요','감정 기복이 있지만 조절 가능해요','대체로 안정적으로 감정을 조절해요','흔들리지 않는 내면의 평온함이에요'],
        };

        function _ft(type, score) {
            var arr = _FT[type] || ['','','','',''];
            var idx = score >= 80 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0;
            return arr[idx];
        }

        function _lvl(score) {
            return score >= 80 ? '매우 높음' : score >= 60 ? '높은 편' : score >= 40 ? '보통' : score >= 20 ? '낮은 편' : '매우 낮음';
        }

        function _bar(score, color) {
            var w = Math.min(100, Math.max(0, score || 0));
            return '<div style="flex:1;background:#D8EDE4;border-radius:4px;height:8px;margin:0 8px;">' +
                   '<div style="background:' + color + ';height:100%;border-radius:4px;width:' + w + '%;"></div></div>';
        }

        function renderFacetRow(label, score, color, ftType) {
            var s = score || 0;
            return '<div style="display:flex;align-items:center;margin-bottom:4px;">' +
                   '<span style="width:72px;font-size:0.75em;color:#444;font-weight:700;">' + label + '</span>' +
                   _bar(s, color) +
                   '<span style="width:34px;font-size:0.75em;color:' + color + ';font-weight:800;text-align:right;">' + s + '%</span>' +
                   '</div>' +
                   '<div style="font-size:0.72em;color:#888;margin:0 0 13px 80px;line-height:1.4;font-style:italic;">"' + _ft(ftType, s) + '"</div>';
        }

        // ── [5] SEC 2: Big5 Facet 블록 ──
        var _stability = 100 - (scores.N || 0);
        var _anxInv    = 100 - (fs.anxiety    || 0);
        var _voltInv   = 100 - (fs.volatility || 0);

        var big5Data = [
            { label:'📊 외향성',  score: scores.E||0, color:'#2196F3',
              f1l:'사교성',    f1s: _fs('sociability',   scores.E),  f1t:'sociability',
              f2l:'주도성',    f2s: _fs('assertiveness', scores.E),  f2t:'assertiveness' },
            { label:'📊 개방성',  score: scores.O||0, color:'#9C27B0',
              f1l:'지적 호기심', f1s: _fs('intellect',  scores.O),  f1t:'intellect',
              f2l:'예술 감수성', f2s: _fs('aesthetics', scores.O),  f2t:'aesthetics' },
            { label:'📊 친화성',  score: scores.A||0, color:'#E91E63',
              f1l:'공감 능력', f1s: _fs('compassion',   scores.A),  f1t:'compassion',
              f2l:'협력성',    f2s: _fs('cooperation',  scores.A),  f2t:'cooperation' },
            { label:'📊 성실성',  score: scores.C||0, color:'#FF9800',
              f1l:'계획성',    f1s: _fs('order',           scores.C),  f1t:'order',
              f2l:'성취 지향', f2s: _fs('industriousness', scores.C),  f2t:'industriousness' },
            { label:'📊 안정성',  score: _stability,  color:'#4CAF50',
              f1l:'불안 관리', f1s: _fs('anxiety_inv',    _stability), f1t:'anxiety_inv',
              f2l:'감정 조절', f2s: _fs('volatility_inv', _stability), f2t:'volatility_inv' },
        ];

        var sec2 = big5Data.map(function(item) {
            return '<div style="background:#F8FCF9;border-radius:12px;padding:14px 14px 6px;margin-bottom:10px;border:1px solid #D0E8DC;">' +
                   '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
                   '<span style="font-size:0.88em;font-weight:800;color:#1B4332;">' + item.label + '</span>' +
                   '<span style="font-size:0.78em;background:#1B4332;color:#fff;padding:3px 10px;border-radius:12px;font-weight:700;">' + item.score + '% · ' + _lvl(item.score) + '</span>' +
                   '</div>' +
                   '<div style="background:#D0E8DC;border-radius:4px;height:4px;margin-bottom:12px;">' +
                   '<div style="background:' + item.color + ';height:100%;border-radius:4px;width:' + item.score + '%;"></div></div>' +
                   renderFacetRow(item.f1l, item.f1s, item.color, item.f1t) +
                   renderFacetRow(item.f2l, item.f2s, item.color, item.f2t) +
                   '</div>';
        }).join('');

        // ── [6] SEC 3: 유명인 설명 테이블 ──
        var _celebDesc = {
            '오프라 윈프리':     '트라우마를 극복하고 공감의 힘으로 수백만 명의 삶을 변화시킨 미디어의 제왕',
            '박지성':            '조용하지만 결정적인 활약으로 맨유와 한국 축구의 역사를 바꾼 리더',
            '달라이 라마':       '깊은 자비와 포용으로 세계 평화를 이끄는 정신적 지도자',
            '유재석':            '따뜻한 배려와 공감력으로 모든 이를 빛나게 하는 국민 MC',
            '넬슨 만델라':       '27년의 감옥에서도 신념을 잃지 않고 화해와 평화를 이룬 지도자',
            '한강':              '인간의 고통을 깊이 공감하며 노벨문학상을 받은 작가',
            '워런 버핏':         '느리고 꾸준한 복리의 힘으로 세계 최고 투자자가 된 인물',
            '손흥민':            '묵묵히 노력하며 아시아 최고 선수로 성장한 글로벌 스타',
            '일론 머스크':       '불가능한 목표를 현실로 만드는 비전의 혁신가',
            '이건희':            '삼성을 세계 1등 기업으로 이끈 전략적 리더십의 아이콘',
            '빌 게이츠':         '체계적인 계획과 실행력으로 세상을 바꾼 테크 선구자',
            '정주영':            '맨손으로 현대를 일군 한국 경제의 신화',
            '스티브 잡스':       '사용자를 깊이 이해하면서도 자신의 비전에 절대 타협하지 않은 혁신가',
            '이순신':            '절망적인 상황에서도 신념과 전략으로 나라를 지킨 불굴의 리더',
            '니체':              '기존의 모든 가치를 의심하며 인류 철학을 혁신한 사상가',
            '방탄소년단 RM':     '깊은 사유와 예술성으로 K팝의 지평을 넓힌 아티스트',
            '레오나르도 다빈치': '예술과 과학을 넘나들며 인류 역사상 가장 창의적인 천재',
            '세종대왕':          '백성을 위한 끝없는 창의와 열정으로 한글을 만든 왕',
            '마크 저커버그':     '독특한 관점으로 소셜네트워크를 발명한 테크 혁신가',
            '김영하':            '날카로운 통찰로 한국 현대소설의 새 지평을 연 작가',
            '모차르트':          '천재적 음악성으로 클래식 음악의 정점을 찍은 불세출의 작곡가',
            '박완서':            '섬세한 감수성으로 한국 현대사의 아픔을 담아낸 문학의 어머니',
            '빈센트 반 고흐':    '고독과 열정 속에서 인류에게 영원한 아름다움을 남긴 화가',
            '헤르만 헤세':       '내면 세계의 탐구를 통해 인간의 본질을 그린 소설가',
            '버락 오바마':       '공감과 소통으로 미국 최초 흑인 대통령이 된 연설의 마스터',
            '신동엽':            '따뜻한 유머와 뛰어난 순발력으로 사랑받는 엔터테이너',
            '아놀드 슈워제네거': '강인한 의지로 보디빌더에서 배우, 정치인까지 된 도전의 상징',
            '이종범':            '국내외를 누빈 한국 야구 역사의 레전드',
            '오드리 헵번':       '우아함과 따뜻한 인간애로 배우를 넘어 박애주의자가 된 아이콘',
            '아이유':            '섬세한 감수성과 진정성으로 모든 세대를 아우르는 아티스트',
            '제니퍼 애니스톤':   '친근한 매력과 자연스러운 에너지로 전 세계의 사랑을 받는 배우',
            '이효리':            '자유롭고 당당한 에너지로 한국 대중문화를 이끄는 아이콘',
            '조르주 오웰':       '인류의 고통을 이해하면서도 전체주의에 맞서 신념을 지킨 저항자',
        };

        var sec3 = vCelebs.slice(0,3).map(function(celeb) {
            var celebName, celebDesc;
            if (typeof celeb === 'object' && celeb !== null && celeb.name) {
                // 새 형식: {name, desc}
                celebName = celeb.name;
                celebDesc = celeb.desc || '당신과 비슷한 성격 유형으로 분석된 인물이에요';
            } else {
                // 구 형식: 문자열
                celebName = celeb;
                celebDesc = _celebDesc[celeb] || '당신과 비슷한 성격 유형으로 분석된 인물이에요';
            }
            return '<div style="background:#fff;border-radius:10px;padding:14px;' +
                   'border-left:4px solid #C9A84C;box-shadow:0 2px 6px rgba(0,0,0,0.05);margin-bottom:10px;">' +
                   '<div style="font-size:0.92em;font-weight:800;color:#1B4332;margin-bottom:6px;">👤 ' + celebName + '</div>' +
                   '<div style="font-size:0.8em;color:var(--text-color);line-height:1.7;word-break:keep-all;">' + celebDesc + '</div>' +
                   '</div>';
        }).join('');

        // ── [7] SEC 4: 강점/주의점 ──
        var sec4strengths = vStrengths.map(function(s, i) {
            return '<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">' +
                   '<span style="background:#1B4332;color:#fff;border-radius:50%;width:22px;height:22px;min-width:22px;display:flex;align-items:center;justify-content:center;font-size:0.7em;font-weight:800;">' + (i+1) + '</span>' +
                   '<div style="font-size:0.85em;color:#1B4332;line-height:1.7;">' + s + '</div></div>';
        }).join('');

        var sec4cautions = vCautions.map(function(c, i) {
            return '<div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">' +
                   '<span style="background:#E65100;color:#fff;border-radius:50%;width:22px;height:22px;min-width:22px;display:flex;align-items:center;justify-content:center;font-size:0.7em;font-weight:800;">' + (i+1) + '</span>' +
                   '<div style="font-size:0.85em;color:#B93C00;line-height:1.7;">' + c + '</div></div>';
        }).join('');

        // ── [8] 스타일 카드 렌더러 ──
        function styleCard(cat) {
            return '<div style="background:#F8FCF9;border-radius:12px;padding:16px;margin-bottom:10px;border:1px solid #D0E8DC;">' +
                   '<div style="font-size:0.9em;font-weight:800;color:#1B4332;margin-bottom:8px;">' + cat.title + '</div>' +
                   '<div style="font-size:0.83em;line-height:1.85;color:var(--text-color);margin-bottom:10px;">' + cat.desc + '</div>' +
                   (cat.strength ? '<div style="background:#E8F5E9;border-radius:8px;padding:10px 12px;font-size:0.8em;color:#1B4332;margin-bottom:8px;line-height:1.6;">' + cat.strength + '</div>' : '') +
                   (cat.caution  ? '<div style="background:#FFF8E7;border-radius:8px;padding:10px 12px;font-size:0.8em;color:#856404;margin-bottom:8px;line-height:1.6;">' + cat.caution  + '</div>' : '') +
                   '<div style="background:#E0F2F1;border-radius:8px;padding:10px 12px;font-size:0.8em;color:#00695C;line-height:1.6;margin-bottom:' + (cat.video ? '10px' : '0') + ';">🎯 ' + cat.tip + '</div>' +
                   (cat.video ? '<a href="' + cat.video.url + '" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;border:1.5px solid #1B4332;border-radius:10px;text-decoration:none;">' +
                   '<span style="font-size:1.2em;">📺</span>' +
                   '<div style="flex:1;"><div style="font-size:0.72em;color:#888;margin-bottom:2px;">이 영상이 도움될 거예요</div>' +
                   '<div style="font-size:0.82em;font-weight:700;color:#1B4332;">' + cat.video.label + '</div></div>' +
                   '<span style="font-size:0.9em;color:#1B4332;">▶</span></a>' : '') +
                   '</div>';
        }

        // ── [9] SEC 7: 자존감 ──
        var rseScore  = scores.RSE || 0;
        var rseLevel  = rseScore >= 80 ? '매우 높음' : rseScore >= 60 ? '높은 편' : rseScore >= 40 ? '보통' : rseScore >= 20 ? '낮은 편' : '성장 필요';
        var rseColor  = rseScore >= 60 ? '#1B4332' : rseScore >= 40 ? '#E65100' : '#C62828';
        var rseAffirmMap = {
            '매우 높음': '나는 나 자신을 깊이 사랑하고 온전히 신뢰한다',
            '높은 편':   '나는 매일 조금씩 더 나를 사랑하고 있다',
            '보통':      '나는 충분히 가치 있는 사람이다',
            '낮은 편':   '오늘도 나는 최선을 다했다. 그것으로 충분하다',
            '성장 필요': '나는 변화할 수 있고 반드시 성장할 수 있다',
        };
        var rseAffirm = rseAffirmMap[rseLevel] || '나는 충분히 가치 있는 사람이다';

        // ── [10] SEC 8: VIA 강점 활용법 ──
        var _viaUsage = {
            '호기심':    { tip:'매일 하나씩 새로운 것을 배워보세요',             shine:'새로운 분야를 탐험할 때' },
            '신중성':    { tip:'중요한 결정 전 하루를 두고 충분히 생각하세요',    shine:'복잡한 문제를 해결할 때' },
            '용기':      { tip:'작은 두려움에 도전하는 것부터 시작하세요',        shine:'어려운 결정을 내려야 할 때' },
            '공감':      { tip:'오늘 주변 한 사람에게 진심으로 귀 기울여 보세요', shine:'누군가 힘들어할 때' },
            '창의성':    { tip:'매일 10분, 새로운 아이디어를 자유롭게 적어보세요', shine:'새로운 문제에 접근할 때' },
            '감사':      { tip:'매일 감사한 것 3가지를 기록해보세요',            shine:'힘든 상황에서도 좋은 면을 찾을 때' },
            '희망':      { tip:'이루고 싶은 미래를 구체적으로 그려보세요',        shine:'포기하고 싶을 때' },
            '자기통제':  { tip:'작은 습관 하나를 꾸준히 지켜보세요',             shine:'유혹이 강할 때' },
            '지혜':      { tip:'경험에서 배운 것을 다른 사람과 나눠보세요',       shine:'중요한 조언을 해야 할 때' },
            '사랑':      { tip:'소중한 사람에게 오늘 사랑을 표현해보세요',        shine:'관계가 위기일 때' },
            '리더십':    { tip:'소규모 모임에서 먼저 방향을 제시해보세요',        shine:'팀이 방향을 잃었을 때' },
            '팀워크':    { tip:'오늘 동료의 일을 하나 도와주세요',               shine:'함께 목표를 이루어야 할 때' },
        };
        var topVia     = (viaStrengths && viaStrengths[0]) || '';
        var viaUsageTip = _viaUsage[topVia] || { tip:'매일 이 강점을 의식적으로 사용해보세요', shine:'나다운 순간' };

        // ── [11] SEC 9: 동물별 맞춤 확언 ──
        var _animalAffirm = {
            '🦁': ['나는 강함과 따뜻함을 동시에 가진 사람이다','내 영향력으로 주변을 더 나은 곳으로 만든다','나는 비전을 향해 사람들을 이끄는 힘이 있다'],
            '🐘': ['나는 모든 관계를 소중히 품고 기억한다','나의 포용력은 세상을 따뜻하게 한다','나는 함께할 때 더 강해진다'],
            '🦅': ['나는 높은 곳에서 큰 그림을 본다','목표를 향한 나의 추진력은 강하고 명확하다','나는 불가능을 가능으로 만드는 사람이다'],
            '🐒': ['나는 창의적이고 새로운 가능성을 계속 찾는다','나의 호기심이 세상을 더 풍부하게 만든다','나는 변화 속에서 기회를 발견한다'],
            '🦝': ['나는 어디서든 사람들과 자연스럽게 연결된다','나의 영리함과 따뜻함이 세상을 밝힌다','나는 실행력으로 꿈을 현실로 만든다'],
            '🦦': ['나는 따뜻하고 유연하게 세상을 받아들인다','내 곁의 사람들은 나로 인해 편안해진다','나는 즐거움 속에서 성장한다'],
            '🦫': ['나는 준비된 자가 기회를 잡는다는 것을 안다','나의 성실함이 최고의 경쟁력이다','나는 하나씩 꾸준히 쌓아가는 힘이 있다'],
            '🦊': ['나는 날카로운 통찰로 핵심을 꿰뚫는다','내 아이디어는 세상을 새롭게 본다','나는 남다른 관점으로 가치를 만든다'],
            '🐺': ['나는 신념을 지키면서 유연하게 나아간다','결정적 순간에 나는 빛을 발한다','나는 깊이 생각하고 강하게 행동한다'],
            '🐋': ['나는 깊은 공감으로 세상을 품는다','내 마음의 깊이는 무한한 가능성이다','나는 천천히 그러나 확실하게 변화를 만든다'],
            '🐆': ['나는 준비가 됐을 때 아무도 막을 수 없다','나만의 속도와 방식으로 목표에 도달한다','나는 조용하지만 강한 사람이다'],
            '🦢': ['나는 깊은 감수성으로 세상을 아름답게 본다','내 내면의 우아함이 세상에 빛을 더한다','나는 나만의 예술로 세상과 연결된다'],
            '🐢': ['나는 천천히, 그러나 절대 포기하지 않는다','꾸준함이 내 가장 강한 무기다','나는 끝까지 해내는 사람이다'],
            '🐱': ['나는 나답게 살기로 한다','깊은 곳에서 우러나오는 나의 따뜻함을 믿는다','나는 자유롭게, 그리고 진실되게 살아간다'],
            '🐯': ['나는 두려운 채로 시작하고 결국 해낸다','나의 강인함은 내가 생각하는 것보다 크다','나는 새로운 길을 여는 사람이다'],
            '🦌': ['나는 내면의 풍요로움으로 세상을 본다','나만의 아름다운 세계가 있다','나는 섬세함으로 세상에 가치를 더한다'],
        };
        var myAffirms = _animalAffirm[animal.animal] || ['나는 오늘도 성장하고 있다','나는 충분히 가치 있는 사람이다','나는 나만의 방식으로 빛난다'];

        var sec9 = myAffirms.map(function(a) {
            return '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:12px;padding:14px 16px;margin-bottom:8px;">' +
                   '<div style="font-size:0.75em;color:#C9A84C;font-weight:700;margin-bottom:5px;">🌿 오늘의 확언</div>' +
                   '<div style="font-size:0.88em;color:#fff;line-height:1.75;font-weight:500;">"' + a + '"</div></div>';
        }).join('');

        // ── [12] 궁합 동물 ──
        // 궁합 동물: ANIMAL_FACET_MAP의 compatible 정보 사용
        var _compatInfo = null;
        if (typeof ANIMAL_FACET_MAP !== 'undefined' &&
            ANIMAL_FACET_MAP[animal.animal] &&
            ANIMAL_FACET_MAP[animal.animal].variants[_vKey] &&
            ANIMAL_FACET_MAP[animal.animal].variants[_vKey].compatible) {
            _compatInfo = ANIMAL_FACET_MAP[animal.animal].variants[_vKey].compatible;
        }
        var compatible = _compatInfo
            ? { animal: _compatInfo.emoji, name: _compatInfo.name, variant: _compatInfo.variant || '', variantLabel: _compatInfo.label, reason: _compatInfo.reason || '' }
            : { animal:'🦁', name:'사자형', variantLabel:'', reason:'' };

        // ── [13] 이메일 등록 여부 ──
        var _hasEmail = safeGetItem('my_email','') !== '';
        var _ctaEmail = _hasEmail
            ? '<div style="background:rgba(201,168,76,0.2);border-radius:10px;padding:12px;font-size:0.85em;color:#C9A84C;font-weight:700;text-align:center;">✅ 이미 등록됨 — 30일 뒤 성장 비교를 받을 수 있어요!</div>'
            : '<button onclick="document.getElementById(\'psych-modal\').remove();setTimeout(function(){showPsychRegisterPopup&&showPsychRegisterPopup();},200);" style="width:100%;min-height:48px;background:#C9A84C;color:#1B4332;border:none;border-radius:12px;font-size:0.95em;font-weight:900;cursor:pointer;">📧 이메일 등록하고 30일 후 비교받기</button>';

        // ── [14] 전체 모달 렌더링 ──
        try {
        modal.innerHTML =
        '<div style="background:var(--bg-color);min-height:100vh;padding-bottom:180px;">' +

        // ── 글자 크기 조절 바 ──
        '<div style="position:sticky;top:0;z-index:100;background:rgba(27,67,50,0.95);padding:7px 16px;display:flex;align-items:center;justify-content:flex-end;gap:8px;border-bottom:1px solid rgba(201,168,76,0.2);">' +
        '<span style="font-size:0.73em;color:rgba(255,255,255,0.55);margin-right:4px;">글자 크기</span>' +
        '<button onclick="window._psychFontDown()" style="width:32px;height:32px;background:rgba(255,255,255,0.1);border:none;border-radius:6px;color:#fff;font-size:1em;cursor:pointer;">A-</button>' +
        '<span id="psych-font-label" style="font-size:0.72em;color:rgba(255,255,255,0.6);min-width:30px;text-align:center;">기본</span>' +
        '<button onclick="window._psychFontUp()" style="width:32px;height:32px;background:rgba(255,255,255,0.1);border:none;border-radius:6px;color:#fff;font-size:1.1em;cursor:pointer;">A+</button>' +
        '</div>' +

        // 콘텐츠 래퍼
        '<div id="psych-result-content" style="font-size:1em;">' +

        // HEADER
        '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);padding:44px 20px 32px;text-align:center;">' +
        '<div style="font-size:0.78em;color:rgba(255,255,255,0.65);margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">나의 확언 동물 유형</div>' +
        _qBadge +
        '<div style="font-size:86px;margin-bottom:8px;line-height:1.1;">' + animal.animal + '</div>' +
        '<div style="font-size:1.55em;font-weight:900;color:#fff;margin-bottom:4px;">' + animal.name + '</div>' +
        '<div style="margin-bottom:10px;display:inline-block;">' +
        '<div style="background:rgba(201,168,76,0.18);border:1.5px solid rgba(201,168,76,0.5);border-radius:16px;padding:6px 18px;display:inline-block;">' +
        '<div style="font-size:1em;font-weight:900;color:#C9A84C;">' + animal.animal + ' ' + animal.name + '-' + _vKey + '</div>' +
        '<div style="font-size:0.82em;color:rgba(255,255,255,0.85);font-weight:700;margin-top:2px;">' + vLabel + '</div>' +
        '</div></div>' +
        '<div style="font-size:0.83em;color:rgba(255,255,255,0.72);">' + animal.title + '</div>' +
        '<div style="margin-top:14px;display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">' +
        ((_resultMode !== 'quick') ? '<span style="background:rgba(255,255,255,0.14);color:#fff;padding:4px 12px;border-radius:20px;font-size:0.78em;">MBTI: ' + (function(){
    // ★ 정밀 MBTI 우선 (정밀테스트에서만 계산됨)
    if(result.mbtiAccurate) return result.mbtiAccurate;
    if(typeof ANIMAL_FACET_MAP!=='undefined' && ANIMAL_FACET_MAP[animal.animal] && ANIMAL_FACET_MAP[animal.animal].variants[_vKey] && ANIMAL_FACET_MAP[animal.animal].variants[_vKey].mbti){
        return ANIMAL_FACET_MAP[animal.animal].variants[_vKey].mbti;
    }
    return animal.mbti;
})() + '</span>' : '') +
        '<span style="background:rgba(201,168,76,0.22);color:#C9A84C;padding:4px 12px;border-radius:20px;font-size:0.78em;font-weight:700;">💑 궁합: ' + compatible.animal + ' ' + compatible.name + (compatible.variant ? '-'+compatible.variant : '') + (compatible.variantLabel ? ' · '+compatible.variantLabel : '') + '</span>' +
        '</div></div>' +

        '<div style="padding:16px 16px 0;">' +
        _precCTA +

        // SEC 1: 당신의 진짜 이야기 (facet 점수 기반 맞춤 내러티브)
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:12px;">🔬 당신의 진짜 이야기</div>' +
        '<div style="font-size:0.87em;line-height:2.0;color:var(--text-color);">' +
        (function(){ try { return buildPersonalNarrative(vLabel, fs, scores, _vKey); } catch(e){ return '<span style="color:#888;font-size:0.85em;">나의 성격을 분석 중이에요...</span>'; } })() +
        '</div>' +

        // 강점 / 약점 / 성장 카드 (ANIMAL_FACET_MAP 기반)
        (function(){
            var _fm = (typeof ANIMAL_FACET_MAP!=='undefined' && ANIMAL_FACET_MAP[animal.animal] && ANIMAL_FACET_MAP[animal.animal].variants[_vKey]) || {};
            if(!_fm.strength) return '';
            return '<div style="background:#E8F5E9;border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid #C8E6C9;">' +
            '<div style="font-size:0.8em;font-weight:800;color:#1B4332;margin-bottom:8px;">✨ 핵심 강점</div>' +
            '<div style="font-size:0.88em;line-height:1.9;color:#222;">' + (_fm.strength||'') + '</div>' +
            '</div>' +
            '<div style="background:#FFF3E0;border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid #FFE0B2;">' +
            '<div style="font-size:0.8em;font-weight:800;color:#E65100;margin-bottom:8px;">⚠️ 치명적 약점</div>' +
            '<div style="font-size:0.88em;line-height:1.9;color:#222;">' + (_fm.weakness||'') + '</div>' +
            '</div>' +
            '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:16px;padding:20px;margin-bottom:14px;">' +
            '<div style="font-size:0.8em;font-weight:800;color:#C9A84C;margin-bottom:8px;">🌱 인생 2막 성장 포인트</div>' +
            '<div style="font-size:0.88em;line-height:1.9;color:rgba(255,255,255,0.92);">' + (_fm.growth||'') + '</div>' +
            '</div>';
        })() +

        '</div>' +

        // MBTI 연결 이유 카드 (정밀 MBTI 우선, 동물 MBTI 폴백)
        (function(){
            if(_resultMode === 'quick') return '';
            // ★ mbtiAccurate 있으면 해당 MBTI 설명 우선 사용
            var _displayMBTI = (result.mbtiAccurate) ? result.mbtiAccurate : null;
            var _animalMR = _MBTI_REASONS[animal.animal];
            if(!_displayMBTI && !_animalMR) return '';
            // 표시할 MBTI 결정
            var _finalMBTI = _displayMBTI || (_animalMR && _animalMR.mbti);
            // 해당 MBTI의 설명 찾기 (동물 이모지→MBTI 역매핑)
            var _msgToUse = '';
            if(_displayMBTI) {
                // mbtiAccurate에 맞는 동물 이모지 찾아서 설명 가져오기
                var MBTI_TO_ANIMAL = {'ENTJ':'🦁','INTJ':'🐺','ESTJ':'🦅','ISTJ':'🦫','ENFJ':'🐘','INFJ':'🐋','ESFJ':'🦝','ISFJ':'🐢','ENTP':'🐒','INTP':'🦊','ENFP':'🦦','INFP':'🦌','ESTP':'🐯','ISTP':'🐆','ESFP':'🦢','ISFP':'🐱'};
                var _accurateAnimal = MBTI_TO_ANIMAL[_displayMBTI];
                var _accurateMR = _accurateAnimal ? _MBTI_REASONS[_accurateAnimal] : null;
                _msgToUse = _accurateMR ? _accurateMR.msg : (_animalMR ? _animalMR.msg : '');
            } else {
                _msgToUse = _animalMR ? _animalMR.msg : '';
            }
            var _mbtiDiffNote = (_displayMBTI && _animalMR && _displayMBTI !== _animalMR.mbti)
                ? '<div style="font-size:0.75em;color:#888;margin-top:6px;line-height:1.6;">* 동물 유형(' + animal.name + ')의 기본 MBTI(' + _animalMR.mbti + ')와 다른 결과예요. 페이싯 정밀 분석 기준이에요.</div>'
                : '';
            return '<div style="background:var(--card-bg);border-radius:14px;padding:16px;margin-bottom:14px;border:1px solid var(--border-color);">' +
            '<div style="font-size:0.78em;color:#C9A84C;font-weight:800;margin-bottom:8px;">🧬 나는 왜 ' + _finalMBTI + '일까요?</div>' +
            '<div style="font-size:0.86em;color:var(--text-color);line-height:1.9;word-break:keep-all;">' + _msgToUse + '</div>' +
            _mbtiDiffNote +
            '</div>';
        })() +

        // 궁합 이유 카드
        (compatible.reason ? (
        '<div style="background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.04));border:1px solid rgba(201,168,76,0.35);border-radius:16px;padding:18px;margin-bottom:14px;">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
        '<span style="font-size:2em;">' + compatible.animal + '</span>' +
        '<div>' +
        '<div style="font-size:0.8em;font-weight:900;color:#C9A84C;margin-bottom:2px;">' +
            animal.name + '-' + _vKey + ' · ' + vLabel + ' 와 최고의 궁합</div>' +
        '<div style="font-size:0.9em;font-weight:900;color:#1B4332;margin:4px 0;">💑 ' + compatible.name + (compatible.variant ? '-'+compatible.variant : '') + (compatible.variantLabel ? ' · ' + compatible.variantLabel : '') + '</div>' +

        '</div></div>' +
        '<div style="font-size:0.86em;line-height:1.95;color:var(--text-color);word-break:keep-all;">' + compatible.reason + '</div>' +
        '</div>'
        ) : '') +

        // SEC 2: Big5 Facet 심층 분석
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:4px;">📊 Big 5 성격 심층 분석</div>' +
        '<div style="font-size:0.73em;color:var(--text-muted);margin-bottom:6px;">각 성격 요인을 구성하는 두 가지 세부 성향까지 분석했어요</div>' +
        (function(){
            // MBTI 4개 축 페이싯 판별 안내 (B안: 동물도 mbtiAccurate 기준으로 변경됨)
            if(!result.mbtiAccurate || _resultMode === 'quick') return '';
            return '<div style="font-size:0.72em;color:#C9A84C;background:rgba(201,168,76,0.1);border-radius:8px;padding:10px 12px;margin-bottom:12px;line-height:1.9;">' +
            '💡 <b>MBTI 4개 축 페이싯 정밀 판별 안내</b><br>' +
            'Big5 전체 축 점수와 MBTI가 다르게 나올 수 있어요. 각 MBTI 차원은 아래 페이싯으로만 판별해요.<br>' +
            '• <b>E/I</b> — 외향성(E) 전체가 아닌 <b>사교성 페이싯</b>만으로 판별해요.<br>' +
            '&nbsp;&nbsp;주도성이 높아도 사교성이 낮으면 I형으로 나올 수 있어요.<br>' +
            '• <b>N/S</b> — 개방성(O) 전체가 아닌 <b>지적탐구 페이싯</b>만으로 판별해요.<br>' +
            '&nbsp;&nbsp;예술감수성이 높아도 지적탐구가 낮으면 S형으로 나올 수 있어요.<br>' +
            '• <b>F/T</b> — 친화성(A) 전체가 아닌 <b>공감능력 페이싯</b>만으로 판별해요.<br>' +
            '&nbsp;&nbsp;협력성이 높아도 공감능력이 낮으면 T형으로 나올 수 있어요.<br>' +
            '• <b>J/P</b> — 성실성(C) 전체가 아닌 <b>계획성 페이싯</b>만으로 판별해요.<br>' +
            '&nbsp;&nbsp;성취지향이 높아도 계획성이 낮으면 P형으로 나올 수 있어요.' +
            '</div>';
        })() +
        sec2 +
        '<div style="font-size:0.7em;color:var(--text-muted);margin-top:4px;">출처: BFI-44 (John, Donahue & Kentle, 1991) · 세계 표준 학술 검사</div>' +
        '</div>' +

        // ★ 인사이트 카드: 경계선 설명 + 선택적 몰입형
        (function(){
            var _af = allFacets || {};
            var _s  = scores   || {};
            var insights = [];

            // 페이싯 점수 읽기
            var soc  = _af.sociability     != null ? _af.sociability     : _s.E;
            var intl = _af.intellect       != null ? _af.intellect       : _s.O;
            var comp = _af.compassion      != null ? _af.compassion      : _s.A;
            var ord  = _af.order           != null ? _af.order           : _s.C;
            var ind  = _af.industriousness != null ? _af.industriousness : _s.C;

            // ① 선택적 몰입형 (성취지향 낮음 + 지적탐구 높음)
            if (ind < 30 && intl > 70) {
                insights.push('<div style="background:#E8F5E9;border-left:4px solid #1B4332;border-radius:0 10px 10px 0;padding:14px;margin-bottom:10px;">' +
                '<div style="font-size:0.82em;font-weight:900;color:#1B4332;margin-bottom:6px;">🔥 선택적 초집중형이에요</div>' +
                '<div style="font-size:0.83em;color:#333;line-height:1.8;">성취지향이 낮게 나왔지만 지적 호기심이 매우 높다면, ' +
                '관심 없는 일은 철저히 외면하지만 <b>한번 꽂히면 밥도 잊고 몰입</b>하는 패턴이에요. ' +
                '이건 게으름이 아니라 <b>희귀한 강점</b>이에요. ' +
                '관심 분야에서만큼은 세상 누구보다 깊이 파고들 수 있어요.</div></div>');
            }

            // ① 사회화된 T형 (공감능력 낮음 + 협력성 높음)
            var coop = _af.cooperation != null ? _af.cooperation : _s.A;
            if (comp < 30 && coop > 70) {
                insights.push('<div style="background:#F0FDF4;border-left:4px solid #22C55E;border-radius:0 10px 10px 0;padding:14px;margin-bottom:10px;">' +
                '<div style="font-size:0.82em;font-weight:900;color:#15803D;margin-bottom:6px;">🤝 사회화된 T형 패턴이에요</div>' +
                '<div style="font-size:0.83em;color:#333;line-height:1.8;">공감능력이 낮게 나왔지만 협력성이 높다면, ' +
                '결정은 늘 논리로 하지만 <b>관계와 팀워크를 소중히 여기는 법을 익히신 T형</b>이에요. ' +
                '이건 T형의 성숙한 발전이에요. ' +
                '감정보다 원칙이 먼저지만, 사람들과 잘 지내는 방법을 아는 분이에요.</div></div>');
            }

            // ② E/I 경계선 (사교성 46~54%)
            if (soc >= 46 && soc <= 54) {
                insights.push('<div style="background:#EFF6FF;border-left:4px solid #3B82F6;border-radius:0 10px 10px 0;padding:14px;margin-bottom:10px;">' +
                '<div style="font-size:0.82em;font-weight:900;color:#1D4ED8;margin-bottom:6px;">🔍 E/I 경계선이에요</div>' +
                '<div style="font-size:0.83em;color:#333;line-height:1.8;">사교성이 중간대예요. ' +
                '사람들과 어울린 뒤 <b>혼자만의 시간이 꼭 필요하다면 I형</b>, ' +
                '오히려 더 있고 싶다면 E형에 가까워요. ' +
                '앞장서서 일을 주도하는 것과 에너지 충전 방향은 다를 수 있어요.</div></div>');
            }

            // ③ N/S 경계선 (지적탐구 46~54%)
            if (intl >= 46 && intl <= 54) {
                insights.push('<div style="background:#F5F3FF;border-left:4px solid #7C3AED;border-radius:0 10px 10px 0;padding:14px;margin-bottom:10px;">' +
                '<div style="font-size:0.82em;font-weight:900;color:#6D28D9;margin-bottom:6px;">🔍 N/S 경계선이에요</div>' +
                '<div style="font-size:0.83em;color:#333;line-height:1.8;">직관과 현실 감각을 균형 있게 쓰는 분이에요. ' +
                '중요한 결정 앞에서 <b>\"왜\"보다 \"어떻게\"가 먼저 떠오르면 S형</b>, ' +
                '원리와 이유가 먼저라면 N형에 가까워요.</div></div>');
            }

            // ④ F/T 경계선 (공감능력 46~54%)
            if (comp >= 46 && comp <= 54) {
                insights.push('<div style="background:#FFF0F3;border-left:4px solid #EC4899;border-radius:0 10px 10px 0;padding:14px;margin-bottom:10px;">' +
                '<div style="font-size:0.82em;font-weight:900;color:#BE185D;margin-bottom:6px;">🔍 F/T 경계선이에요</div>' +
                '<div style="font-size:0.83em;color:#333;line-height:1.8;">논리와 감정을 모두 쓸 줄 아는 균형형이에요. ' +
                '중요한 결정 앞에서 <b>"옳은가"가 먼저 떠오르면 T형</b>, ' +
                '"이 사람이 어떻게 느낄까"가 먼저라면 F형이에요. ' +
                '사회생활로 공감을 익혔지만 결정은 늘 논리로 한다면 <b>사회화된 T형</b>일 수 있어요.</div></div>');
            }

            // ⑤ J/P 경계선 (계획성 46~54%)
            if (ord >= 46 && ord <= 54) {
                insights.push('<div style="background:#FFFBEB;border-left:4px solid #F59E0B;border-radius:0 10px 10px 0;padding:14px;margin-bottom:10px;">' +
                '<div style="font-size:0.82em;font-weight:900;color:#B45309;margin-bottom:6px;">🔍 J/P 경계선이에요</div>' +
                '<div style="font-size:0.83em;color:#333;line-height:1.8;">계획성이 중간대예요. ' +
                '중요한 일은 철저히 계획하지만 사소한 일은 즉흥적으로 한다면 <b>선택적 계획형 P</b>예요. ' +
                '진짜 J형은 여행 짐도 2주 전에 싸고, 메뉴도 미리 정해야 편하답니다.</div></div>');
            }

            if (insights.length === 0) return '';
            return '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
            '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:4px;">💡 나에 대해 더 알아보기</div>' +
            '<div style="font-size:0.73em;color:var(--text-muted);margin-bottom:14px;">점수 패턴에서 발견한 특별한 인사이트예요</div>' +
            insights.join('') + '</div>';
        })() +

        // SEC 3: 닮은 유명인
        (vCelebs.length > 0 ?
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:4px;">🎬 당신과 닮은 유명인</div>' +
        '<div style="font-size:0.73em;color:var(--text-muted);margin-bottom:10px;">같은 성격 유형으로 분석된 실제 인물들이에요</div>' +
        '<div style="background:rgba(201,168,76,0.08);border-radius:12px;padding:14px;border:1px solid rgba(201,168,76,0.2);">' +
        sec3 +
        '</div></div>' : '') +

        // SEC 4: 강점/주의 카드 제거 (ANIMAL_FACET_MAP 카드로 대체됨)


        // SEC 5: 연애 & 관계 스타일
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:14px;">💑 연애 & 관계 스타일</div>' +
        styleCard(love) +
        styleCard(friend) +
        '</div>' +

        // SEC 6: 일 & 성취 스타일
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:14px;">💼 일 & 성취 스타일</div>' +
        styleCard(work) +
        styleCard(hard) +
        styleCard(money) +
        '</div>' +

        // SEC 7: 자존감 심층 분석
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:14px;">🪞 자존감 심층 분석</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
        '<div style="flex:1;background:var(--border-color);border-radius:6px;height:12px;">' +
        '<div style="background:' + rseColor + ';height:100%;border-radius:6px;width:' + rseScore + '%;"></div></div>' +
        '<span style="font-size:1.1em;font-weight:800;color:' + rseColor + ';">' + rseScore + '점</span>' +
        '<span style="font-size:0.78em;background:' + rseColor + ';color:#fff;padding:3px 10px;border-radius:12px;font-weight:700;">' + rseLevel + '</span>' +
        '</div>' +
        '<div style="font-size:0.84em;line-height:1.9;color:var(--text-color);margin-bottom:12px;">' + rse.desc + '</div>' +
        (rse.strength ? '<div style="background:#E8F5E9;border-radius:10px;padding:12px 14px;font-size:0.8em;color:#1B4332;margin-bottom:8px;line-height:1.65;">💡 ' + rse.strength + '</div>' : '') +
        (rse.growth   ? '<div style="background:#FFF8E7;border-radius:10px;padding:12px 14px;font-size:0.8em;color:#856404;margin-bottom:8px;line-height:1.65;">🌱 ' + rse.growth + '</div>' : '') +
        '<div style="background:#E0F2F1;border-radius:10px;padding:12px 14px;font-size:0.8em;color:#00695C;margin-bottom:12px;line-height:1.65;">🎯 ' + rse.tip + '</div>' +
        '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:12px;padding:14px;">' +
        '<div style="font-size:0.73em;color:#C9A84C;font-weight:700;margin-bottom:6px;">🌿 자존감 강화 추천 확언</div>' +
        '<div style="font-size:0.88em;color:#fff;font-weight:600;line-height:1.75;">"' + rseAffirm + '"</div>' +
        '</div>' +
        '<div style="font-size:0.7em;color:var(--text-muted);margin-top:10px;">출처: Rosenberg Self-Esteem Scale (1965) · 60년간 52개국 검증</div>' +
        '</div>' +

        // SEC 8: VIA 핵심 강점 활용법
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:14px;">👑 VIA 핵심 강점 활용법</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">' +
        (via.strengths||[]).map(function(s,i) {
            return '<span style="background:' + (i===0?'#1B4332':'var(--border-color)') + ';color:' + (i===0?'#fff':'var(--text-color)') + ';padding:5px 12px;border-radius:20px;font-size:0.82em;font-weight:700;">' + (i===0?'👑 ':'') + s + '</span>';
        }).join('') +
        '</div>' +
        '<div style="font-size:0.84em;line-height:1.85;color:var(--text-color);margin-bottom:14px;">' + via.desc + '</div>' +
        (topVia ?
        '<div style="background:#F0F7F4;border-radius:12px;padding:14px;margin-bottom:8px;">' +
        '<div style="font-size:0.8em;font-weight:800;color:#1B4332;margin-bottom:10px;">👑 \'' + topVia + '\' 강점 — 이렇게 써보세요</div>' +
        '<div style="display:flex;gap:10px;margin-bottom:8px;">' +
        '<span style="font-size:1.1em;">📅</span>' +
        '<div style="font-size:0.82em;color:#1B4332;line-height:1.7;">' + viaUsageTip.tip + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;">' +
        '<span style="font-size:1.1em;">✨</span>' +
        '<div style="font-size:0.82em;color:#555;line-height:1.7;"><b>' + viaUsageTip.shine + '</b> 가장 빛나요</div>' +
        '</div></div>' : '') +
        '<div style="font-size:0.7em;color:var(--text-muted);">출처: VIA Character Strengths (Peterson & Seligman, 2004)</div>' +
        '</div>' +

        // SEC 9: 나에게 맞는 확언 3개
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:4px;">🌿 나에게 맞는 확언 3가지</div>' +
        '<div style="font-size:0.73em;color:var(--text-muted);margin-bottom:14px;">' + animal.animal + ' ' + animal.name + '에게 특별히 선별된 확언이에요</div>' +
        sec9 +
        '<button onclick="document.getElementById(\'psych-modal\').remove();switchView(\'home\');" ' +
        'style="width:100%;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;margin-top:10px;">' +
        '🌿 지금 바로 확언 시작하기 →</button>' +
        '</div>' +

        // SEC 10-A: 미래편지 & 일기쓰기
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:4px;">✍️ 성장을 가속하는 글쓰기</div>' +
        '<div style="font-size:0.73em;color:var(--text-muted);margin-bottom:14px;">뇌과학이 증명한 두 가지 글쓰기의 힘</div>' +

        // 미래편지
        '<div style="background:#F0F7F4;border-radius:12px;padding:14px;margin-bottom:10px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="font-size:1.3em;">💌</span>' +
        '<div style="font-size:0.9em;font-weight:800;color:#1B4332;">미래의 나에게 편지 쓰기</div>' +
        '</div>' +
        '<div style="font-size:0.8em;color:var(--text-color);line-height:1.8;margin-bottom:10px;">' +
        'Markus & Nurius(1986)의 <b>가능한 자아 이론</b>에서, 미래 자신에게 편지를 쓰는 행위는 ' +
        '뇌의 목표 추구 회로(전전두엽)를 강화해요. 현재의 나와 미래의 나를 연결하면 ' +
        '<b>자기통제력이 높아지고</b>, 목표를 향한 동기가 지속되며, 실제 행동 변화로 이어질 확률이 2배 높아져요.' +
        '</div>' +
        '<button onclick="window._goToLetter()" ' +
        'style="width:100%;min-height:44px;background:#1B4332;color:#fff;border:none;border-radius:10px;font-size:0.87em;font-weight:700;cursor:pointer;">' +
        '💌 지금 미래의 나에게 편지 쓰기 →</button>' +
        '</div>' +

        // 일기쓰기
        '<div style="background:#FFF8E7;border-radius:12px;padding:14px;">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="font-size:1.3em;">📔</span>' +
        '<div style="font-size:0.9em;font-weight:800;color:#856404;">오늘의 일기 쓰기</div>' +
        '</div>' +
        '<div style="font-size:0.8em;color:var(--text-color);line-height:1.8;margin-bottom:10px;">' +
        'Pennebaker(1997)의 <b>표현적 글쓰기 연구</b>에서, 하루 15~20분 감정 일기를 4일간 쓴 것만으로 ' +
        '면역세포(T림프구) 활성도가 증가하고, 스트레스 호르몬이 감소했어요. ' +
        '글로 감정을 처리하면 뇌의 편도체 반응이 낮아지고 <b>심리적 회복력이 높아져요.</b>' +
        '</div>' +
        '<button onclick="window._goToDiary()" ' +
        'style="width:100%;min-height:44px;background:#C9A84C;color:#1B4332;border:none;border-radius:10px;font-size:0.87em;font-weight:700;cursor:pointer;">' +
        '📔 지금 오늘의 일기 쓰기 →</button>' +
        '</div>' +
        '</div>' +

        // SEC 10: 공유 & 다운로드 & 30일 성장 추적
        '<div style="background:var(--card-bg);border-radius:16px;padding:20px;margin-bottom:14px;border:1px solid var(--border-color);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:14px;">📤 결과 공유 & 저장</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;">' +
        '<div style="display:flex;gap:8px;margin-bottom:0;">' +
        '<button onclick="window.downloadPsychImage(window._lastPsychResult)" style="flex:1;min-height:52px;background:linear-gradient(135deg,#1B4332,#2D6A4F);color:#fff;border:none;border-radius:12px;font-size:0.85em;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;"><span>📸</span>이미지 저장</button>' +
        '<button onclick="downloadPsychPDF()" style="flex:1;min-height:52px;background:linear-gradient(135deg,#C9A84C,#E8C96A);color:#1B4332;border:none;border-radius:12px;font-size:0.85em;font-weight:900;cursor:pointer;">📄 결과지</button>' +
        '</div>' +
        '<button onclick="sharePsychMyResult()" style="width:100%;min-height:44px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.87em;font-weight:700;cursor:pointer;">' +
        animal.animal + ' 내 결과 공유하기 📤</button>' +
        '<button onclick="sharePsychInvite()" style="width:100%;min-height:40px;background:var(--card-bg);color:#1B4332;border:2px solid #1B4332;border-radius:12px;font-size:0.85em;font-weight:700;cursor:pointer;">' +
        '💌 친구에게 테스트 추천하기</button>' +
        '<button onclick="showPsychDebug()" style="width:100%;min-height:40px;background:none;border:1px dashed #aaa;border-radius:12px;font-size:0.82em;color:var(--text-muted);cursor:pointer;margin-top:4px;">' +
        '🔬 내 점수 분석 자세히 보기</button>' +
        '</div></div>' +

        // ★ 프리미엄 심층 분석 (결제 예정)
        '<div style="background:linear-gradient(135deg,#0A0A0A,#1a1a2e);border-radius:16px;padding:22px 20px;margin-bottom:14px;border:1.5px solid rgba(201,168,76,0.5);">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<span>👑</span>' +
        '<div style="font-size:1em;font-weight:900;color:#C9A84C;">프리미엄 심층 분석 리포트</div>' +
        '<div style="font-size:0.72em;background:#C9A84C;color:#000;padding:2px 8px;border-radius:20px;font-weight:900;margin-left:auto;white-space:nowrap;">₩9,900</div>' +
        '</div>' +
        '<div style="font-size:0.72em;color:rgba(255,255,255,0.45);margin-bottom:14px;">현재 결과지보다 5배 더 깊은 분석 · PDF 20페이지</div>' +
        '<div style="font-size:0.82em;color:rgba(255,255,255,0.75);line-height:2.0;margin-bottom:16px;">' +
        '💑 <b style="color:#C9A84C;">연애 스타일</b> — 사랑받는 방식·갈등 패턴·이상형<br>' +
        '💼 <b style="color:#C9A84C;">직장 스타일</b> — 최적 역할·상사·동료 대처법<br>' +
        '💸 <b style="color:#C9A84C;">소비·돈 스타일</b> — 충동 패턴·재정 관리 약점<br>' +
        '😤 <b style="color:#C9A84C;">스트레스 반응</b> — 무너지는 순간·회복 전략<br>' +
        '🧭 <b style="color:#C9A84C;">인생 2막 로드맵</b> — 이 유형에게 맞는 50대 이후 방향<br>' +
        '🎯 <b style="color:#C9A84C;">맞춤 확언 20선</b> — 유형별 뇌과학 기반 확언 처방' +
        '</div>' +
        '<button onclick="window._premiumPayAlert()" style="width:100%;min-height:52px;background:linear-gradient(135deg,#C9A84C,#E8B84B);color:#000;border:none;border-radius:14px;font-size:1em;font-weight:900;cursor:pointer;">👑 지금 구매하기 ₩9,900</button>' +
        '<div style="font-size:0.72em;color:rgba(255,255,255,0.35);text-align:center;margin-top:8px;">준비중 · 곧 오픈</div>' +
        '</div>' +

        // 30일 성장 추적
        '<div style="background:linear-gradient(135deg,#0D2818,#1B4332);border-radius:16px;padding:24px 20px;margin-bottom:14px;text-align:center;">' +
        '<div style="font-size:1.05em;font-weight:900;color:#C9A84C;margin-bottom:8px;">📈 30일 성장 추적</div>' +
        '<div style="font-size:0.83em;color:rgba(255,255,255,0.8);line-height:1.85;margin-bottom:16px;">지금 등록하면 30일 뒤 재검사로<br>나의 <b style="color:#C9A84C;">성장 변화를 수치로</b> 확인할 수 있어요</div>' +
        _ctaEmail +
        '</div>' +

        '</div>' +
        '</div>' +
        '</div>' +

        '<div id="psych-result-cta" style="position:fixed;bottom:0;left:0;width:100%;z-index:100000;background:rgba(27,67,50,0.97);backdrop-filter:blur(8px);padding:12px 16px;display:flex;align-items:center;gap:12px;border-top:1px solid rgba(201,168,76,0.3);box-sizing:border-box;">' +
        '<div style="flex:1;"><div id="psych-cta-title" style="font-size:0.85em;font-weight:700;color:#C9A84C;">맞춤 확언 받아보기</div>' +
        '<div style="font-size:0.72em;color:rgba(255,255,255,0.55);">매일 무료로 · 지금 바로 시작</div></div>' +
        '<button id="psych-result-cta-btn" style="background:#C9A84C;color:#1B4332;border:none;border-radius:12px;padding:10px 20px;font-size:0.9em;font-weight:900;cursor:pointer;white-space:nowrap;">🌿 확언 시작하기</button>' +
        '</div>' +
        '</div>';

        } catch(e) {
            console.error('showPsychResult 에러:', e);
            showToast('결과 표시 오류: ' + e.message);
            return;
        }

        setTimeout(function(){
            var ctaBtn = document.getElementById('psych-result-cta-btn');
            if(ctaBtn){
                ctaBtn.addEventListener('click', function(){
                    document.getElementById('psych-modal').remove();
                    setTimeout(function(){
                        if(safeGetItem('onboarding_done','') !== '1'){
                            typeof showInstallPrompt === 'function' ? showInstallPrompt() : initOnboarding();
                        } else {
                            switchView('home');
                        }
                    }, 200);
                });
            }
            var precBtn = document.getElementById('_precisionBtn');
            if(precBtn){
                precBtn.addEventListener('click', function(){
                    document.getElementById('psych-modal').remove();
                    pMode='full'; psychStartReal('full');
                });
            }

            // 미등록 사용자 → 결과 확인 후 3초 뒤 등록 팝업 자동 표시
            if(!safeGetItem('my_nickname','') || !safeGetItem('my_email','')){
                setTimeout(function(){ showPsychRegisterPopup && showPsychRegisterPopup(); }, 3000);
            }
        }, 100);
    }


    // ★ 전체 결과 다시 보기 (버그 수정: 모달 제거하지 않고 바로 결과 표시)
    window.viewMyPsychResult = function(){
        const saved = safeGetItem('psych_result_v2','');
        if(!saved){ showToast('먼저 테스트를 완료해주세요!'); return; }
        const result = JSON.parse(saved);
        // 기존 모달이 있으면 결과지로 교체, 없으면 새로 생성
        let modal = document.getElementById('psych-modal');
        if(!modal){
            modal = document.createElement('div');
            modal.id = 'psych-modal';
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:var(--bg-color);overflow-y:auto;';
            document.body.appendChild(modal);
        }
        showPsychResult(result);
    }

    // ★ 내 결과 공유 (유형별 상세 소개 포함)
    // ★ 결과 링크 생성 함수
    window.getPsychResultUrl = function(){
        const saved = safeGetItem('psych_result_v2','');
        if(!saved) return null;
        try {
            // 핵심 데이터만 인코딩 (URL 길이 최소화)
            const r = JSON.parse(saved);
            const compact = {
                a: r.typeKey || '',          // 동물 키
                s: r.scores,                 // 점수
                v: r.viaStrengths || [],     // VIA 강점
            };
            const encoded = btoa(encodeURIComponent(JSON.stringify(compact)));
            return 'https://life2radio.github.io/pumsok/?r=' + encoded;
        } catch(e){ return null; }
    };

    window.sharePsychMyResult = function(){
        const saved = safeGetItem('psych_result_v2','');
        if(!saved){ showToast('먼저 테스트를 완료해주세요!'); return; }
        const r = JSON.parse(saved);
        const s = r.scores;

        const animalDesc = {
            '🦁':'타고난 리더십과 따뜻한 공감력을 동시에 가진 사람이에요. 강하면서도 사람을 품는 카리스마가 있고, 변화를 두려워하지 않고 앞장서는 존재예요. 주변에서 자연스럽게 따르게 만드는 힘이 있어요.',
            '🐘':'기억력과 포용력이 탁월한 수호자예요. 주변 모두를 품어주는 따뜻함이 최고의 강점이고, 한 번 만든 관계는 평생 소중히 지키는 사람이에요. 천천히 성장하지만 그 깊이는 누구도 따라오지 못해요.',
            '🦅':'높은 곳에서 큰 그림을 보는 선구자예요. 명확한 비전과 강한 추진력으로 불가능을 가능으로 만들고, 사람들에게 나아갈 방향을 제시하는 타고난 선구자예요. 목표를 정하면 반드시 해내는 사람이에요.',
            '🦋':'끊임없이 변화하고 아름답게 성장하는 사람이에요. 어떤 환경에서도 유연하게 적응하고, 자유로운 영혼으로 세상을 날아다녀요. 변화 자체가 당신의 본질이고, 그 과정에서 더욱 빛나요.',
            '🐬':'어디서든 웃음꽃을 피우는 에너자이저예요. 사람과 사람을 이어주는 천부적인 재능이 있고, 넘치는 에너지로 주변을 활기차게 만들어요. 꾸준함과 긍정으로 세상을 밝히는 존재예요.',
            '🦢':'겉으로 우아해 보이지만 내면에서 끊임없이 노력하는 사람이에요. 자신만의 기준과 심미안이 뛰어나고, 조용하지만 오래 기억에 남는 인상을 주는 사람이에요. 성장에 대한 의지가 남달라요.',
            '🐝':'말보다 행동으로 증명하는 실천가예요. 작은 것도 꼼꼼히 챙기고, 꾸준한 노력으로 달콤한 결실을 만들어내요. 혼자서도 묵묵히 자신의 역할을 다하는 진정한 실천가예요.',
            '🐱':'자유롭고 독립적이지만, 마음을 열면 누구보다 깊이 연결되는 사람이에요. 나만의 방식이 분명하고, 감정을 행동으로 표현하는 직관적인 사람이에요. 자신만의 세계가 뚜렷해요.',
            '🐺':'조용하지만 결정적인 순간에 누구보다 빠르게 행동하는 본능의 리더예요. 의리와 신뢰를 가장 중요한 가치로 여기고, 한 번 마음을 준 사람에게는 끝까지 함께해요.',
            '🐋':'바다처럼 깊고 넓은 마음을 가진 공감자예요. 조용하지만 존재만으로도 주변을 안정시키는 힘이 있고, 깊은 사유를 통해 세상을 이해하는 방식이 남달라요. 상대의 마음을 가장 잘 아는 사람이에요.',
            '🐆':'조용하지만 폭발적인 에너지를 품고 있는 혁신가예요. 준비가 됐을 때 누구도 막을 수 없고, 자신만의 방식으로 변화를 만들어내요. 목표를 향해 거침없이 질주하는 사람이에요.',
            '🦊':'번뜩이는 직관과 날카로운 통찰력을 가진 탐험가예요. 남들이 놓치는 것을 포착하고, 겉으로 조용해 보이지만 내면에는 끊임없이 탐험 중인 지적 호기심이 넘쳐요. 새로운 가능성을 늘 찾고 있어요.',
            '🐢':'느리지만 절대 포기하지 않는 동반자예요. 꾸준함이 최고의 전략임을 몸으로 아는 사람이에요. 가까운 사람을 위해서라면 어떤 어려움도 묵묵히 감당하는 따뜻한 힘이 있어요.',
            '🦉':'말보다 깊은 눈빛으로 상대를 이해하는 치유자예요. 혼자만의 시간 속에서 진짜 힘을 얻고, 천천히 그러나 확실하게 주변을 치유해요. 무리하지 않고 자신의 리듬을 지키는 것이 가장 큰 강점이에요.',
            '🐯':'뜨거운 열정과 강인한 의지로 새로운 길을 여는 개척자예요. 도전을 즐기고 실패도 성장의 재료로 삼아요. 한 번 목표를 정하면 반드시 해내는 불굴의 의지가 있어요.',
            '🦌':'남들이 보지 못하는 아름다움을 발견하는 몽상가예요. 내면 세계가 풍부하고 감수성이 뛰어나 예술적 영감이 넘쳐요. 혼자만의 사색 속에서 세상을 이해하는 깊이가 남달라요.',
        };

        const desc = animalDesc[r.animal.animal] || r.animal.tagline;
        const text = `나는 ${r.animal.animal} ${r.animal.name}이에요!
"${r.animal.title}"

${desc}

✨ 핵심 강점: ${(r.viaStrengths||[]).slice(0,2).join(' · ')}
🔤 MBTI 연관: ${r.animal.mbti}

너는 어떤 유형이야? 🧠
👉 https://life2radio.github.io/pumsok/?psych=1`;
        window._sendShareLog('심리결과공유', r.animal.name);
        if(navigator.share){ navigator.share({ text }).catch(()=>{}); }
        else { navigator.clipboard?.writeText(text).then(()=> showToast('📋 결과가 복사됐어요!')); }
    }

    // ★ 친구에게 테스트 추천 (앱 링크 + 🧠 버튼 안내)
    window.sharePsychInvite = function(){
        const text = `🧠 나는 어떤 사람일까?
— 성격·자존감·강점 무료 심리검사

심리학자들이 60년간 연구한 검사 3가지를 통해
나의 성격, 자존감, 핵심 강점을 분석해드려요.

일 스타일 · 관계 방식 · 위기 대처법 · 소비 성향까지
나도 몰랐던 내 모습을 알 수 있어요.

무료 · 약 10분 · 정확도 90% · 16가지 동물 유형

👇 아래 링크에서 바로 시작하세요
https://life2radio.github.io/pumsok/?psych=1`;
        window._sendShareLog('심리테스트추천공유');
        if(navigator.share){ navigator.share({ text }).catch(()=>{}); }
        else { navigator.clipboard?.writeText(text).then(()=> showToast('📋 복사됐어요! 카톡에 붙여넣기 하세요')); }
    }


        // ★ Google One Tap - 이메일만 가져오기
    const GOOGLE_CLIENT_ID = '960491976015-2d0jequkprvnp5g267i16q4mrgd96qr3.apps.googleusercontent.com';

    window._googleOneTap = function(){
        const redirectUri = encodeURIComponent('https://life2radio.github.io/pumsok/');
        const scope = encodeURIComponent('email profile');
        const url = 'https://accounts.google.com/o/oauth2/v2/auth?client_id='+GOOGLE_CLIENT_ID
            +'&redirect_uri='+redirectUri+'&response_type=token&scope='+scope+'&prompt=select_account';

        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

        if(!isMobile){
            // PC: 팝업 방식
            const popup = window.open(url, 'google_oauth', 'width=500,height=600,scrollbars=yes');
            const timer = setInterval(function(){
                try {
                    if(popup && popup.closed){ clearInterval(timer); return; }
                    if(popup && popup.location && popup.location.hash){
                        const hash = popup.location.hash;
                        clearInterval(timer);
                        popup.close();
                        const params = new URLSearchParams(hash.substring(1));
                        const token = params.get('access_token');
                        if(token){
                            fetch('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' + token)
                                .then(function(r){ return r.json(); })
                                .then(function(info){
                                    const emailEl = document.getElementById('nm-email') || document.getElementById('ob-email-input');
                                    const nickEl  = document.getElementById('nm-nick')  || document.getElementById('ob-nick-input');
                                    if(emailEl && info.email) emailEl.value = info.email;
                                    if(nickEl  && !nickEl.value && info.name) nickEl.value = info.name;
                                    showToast('✅ 구글 이메일이 입력됐어요!');
                                }).catch(function(){ showToast('이메일을 직접 입력해주세요'); });
                        }
                    }
                } catch(e) {}
            }, 500);
            setTimeout(function(){ clearInterval(timer); if(popup && !popup.closed) popup.close(); }, 30000);
        } else {
            // 모바일: 새 탭으로 열기 (앱 닫힘 방지)
            const nickEl2 = document.getElementById('nm-nick') || document.getElementById('ob-nick-input');
            if(nickEl2 && nickEl2.value) safeSetItem('oauth_pending_nick_tmp', nickEl2.value);
            const newTab = window.open(url, '_blank');
            if(!newTab){
                // 새 탭 차단된 경우 → 절대 리디렉션 금지, 직접 입력 안내
                showToast('⚠️ 팝업이 차단됐어요. 이메일을 직접 입력해주세요!');
                const _emailInp = document.getElementById('nm-email') || document.getElementById('ob-email-input') || document.getElementById('psych-email-input');
                if(_emailInp){ _emailInp.focus(); _emailInp.scrollIntoView({behavior:'smooth'}); }
            }
            // 새 탭에서 postMessage로 이메일 전달받기
            window.addEventListener('message', function _oauthMsg(e){
                if(e.data && e.data.type === 'oauth_email'){
                    window.removeEventListener('message', _oauthMsg);
                    const emailEl = document.getElementById('nm-email') || document.getElementById('ob-email-input');
                    const nickEl3 = document.getElementById('nm-nick') || document.getElementById('ob-nick-input');
                    if(emailEl && e.data.email) emailEl.value = e.data.email;
                    if(nickEl3 && !nickEl3.value && e.data.name) nickEl3.value = e.data.name;
                    safeSetItem('oauth_pending_email','');
                    safeSetItem('oauth_pending_name','');
                    showToast('✅ 구글 계정 정보가 입력됐어요! 이름 확인 후 저장해주세요 😊');
                }
            });
        }
    }

    // ★ 설치없이 이용하기 → 닉네임/이메일 등록 팝업
    window.showNicknameModal = function(){
        // OAuth 리디렉션으로 받아온 이메일 — 자동저장 아닌 필드에만 채우기
        const _pendingEmail = safeGetItem('oauth_pending_email','');
        const _pendingName  = safeGetItem('oauth_pending_name','');
        const _pendingNickTmp = safeGetItem('oauth_pending_nick_tmp','');
        // 카톡 인앱브라우저일 때 → URL 복사 + 크롬으로 이동
        if(/KAKAOTALK/i.test(navigator.userAgent)){
            const url = 'https://life2radio.github.io/pumsok/';
            if(navigator.clipboard){
                navigator.clipboard.writeText(url).catch(()=>{
                    const t = document.createElement('textarea');
                    t.value = url; document.body.appendChild(t);
                    t.select(); document.execCommand('copy');
                    document.body.removeChild(t);
                });
            } else {
                const t = document.createElement('textarea');
                t.value = url; document.body.appendChild(t);
                t.select(); document.execCommand('copy');
                document.body.removeChild(t);
            }
            showToast('✅ 주소가 복사됐어요! 크롬 주소창에 붙여넣기 하세요');
            setTimeout(()=>{
                window.open('intent://life2radio.github.io/pumsok/#Intent;scheme=https;package=com.android.chrome;end', '_blank');
            }, 500);
            return;
        }
        // 이미 등록한 경우 — OAuth pending 없으면 바로 온보딩
        const existNick = safeGetItem('my_nickname','');
        const existEmail = safeGetItem('my_email','');
        const _hasPending = safeGetItem('oauth_pending_email','') !== '';
        if(existNick && existEmail && !_hasPending){ initOnboarding(); return; }

        const modal = document.createElement('div');
        modal.id = 'nickname-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#FFFFFF;border-radius:24px;padding:32px 24px;width:90%;max-width:380px;text-align:center;">
                <div style="font-size:36px;margin-bottom:10px;">🏅</div>
                <div style="font-size:1.15em;font-weight:700;color:#1B4332;margin-bottom:6px;">잠깐! 이름을 알려주세요</div>
                <div style="font-size:0.88em;color:#666;line-height:1.7;margin-bottom:20px;">
                    이름과 이메일을 등록하시면<br>
                    <b style="color:#1B4332;">매일의 감정 변화와 성장을 수치로 추적</b>할 수 있고,<br>
                    30일 뒤 <b style="color:#1B4332;">나의 성장 리포트</b>를 받아볼 수 있어요 📊
                </div>
                <input id="nm-nick" type="text" maxlength="15" placeholder="이름 또는 별명 (예: 전주 60대 주부)"
                    style="width:100%;padding:12px 14px;font-size:1em;border:2px solid #1B4332;border-radius:10px;box-sizing:border-box;text-align:center;outline:none;margin-bottom:10px;">
                ${/KAKAOTALK/i.test(navigator.userAgent) ? `
                <div style="background:#FFF8E7;border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:0.85em;color:#856404;text-align:left;line-height:1.7;">
                    💡 카톡에서는 구글 이메일 가져오기가 안 돼요.<br>이메일을 직접 입력해주세요.
                </div>` : `
                <button onclick="window._googleOneTap()" style="width:100%;padding:11px 14px;font-size:0.95em;border:1.5px solid #4285F4;border-radius:10px;box-sizing:border-box;background:#fff;color:#444;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
                    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
                    구글 계정에서 이메일 가져오기
                </button>`}
                <input id="nm-email" type="email" placeholder="이메일 직접 입력"
                    style="width:100%;padding:12px 14px;font-size:0.95em;border:1.5px solid #C8DDD2;border-radius:10px;box-sizing:border-box;text-align:center;outline:none;margin-bottom:16px;">
                <label for="nm-privacy-agree" style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:14px;padding:10px 12px;background:#F8F8F8;border-radius:10px;">
                    <input type="checkbox" id="nm-privacy-agree" style="width:20px;height:20px;min-width:20px;margin-top:1px;cursor:pointer;accent-color:#1B4332;">
                    <span style="font-size:13px;color:#555;line-height:1.6;">
                        이름·이메일을 서비스 개선 목적으로 수집하는 것에 동의합니다.
                    </span>
                </label>
                <button onclick="window._saveNicknameModal()" style="width:100%;min-height:52px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;">
                    등록하고 시작하기 🌿
                </button>
                <button onclick="document.getElementById('nickname-modal').remove();" style="width:100%;min-height:40px;background:none;border:none;color:#aaa;font-size:0.88em;cursor:pointer;margin-top:4px;">
                    나중에 할게요
                </button>
            </div>`;
        document.body.appendChild(modal);

        // 기존 값 채우기
        if(existNick) document.getElementById('nm-nick').value = existNick;
        if(existEmail) document.getElementById('nm-email').value = existEmail;

        // ★ OAuth 구글 계정 정보 → 필드에 자동 채우기 (사용자가 확인 후 버튼 클릭)
        const nmNick = document.getElementById('nm-nick');
        const nmEmail = document.getElementById('nm-email');
        if(_pendingEmail && nmEmail && !nmEmail.value) nmEmail.value = _pendingEmail;
        if(_pendingName && nmNick && !nmNick.value) nmNick.value = _pendingName;
        if(_pendingNickTmp && nmNick && !nmNick.value) nmNick.value = _pendingNickTmp;
        if(_pendingEmail || _pendingName || _pendingNickTmp){
            safeSetItem('oauth_pending_email','');
            safeSetItem('oauth_pending_name','');
            safeSetItem('oauth_pending_nick_tmp','');
            setTimeout(function(){ showToast('✅ 구글 계정 정보가 입력됐어요! 이름 확인 후 저장해주세요 😊'); }, 300);
        }
    }

    window._saveNicknameModal = function(){
        // ★ 동의 체크를 가장 먼저 확인
        const agreed = document.getElementById('nm-privacy-agree');
        if(!agreed || !agreed.checked){ showToast('아래 개인정보 수집 동의를 먼저 체크해주세요! ☑️'); return; }
        const nick  = (document.getElementById('nm-nick')?.value || '').trim();
        const email = (document.getElementById('nm-email')?.value || '').trim();
        if(!nick){ showToast('이름을 입력해주세요!'); return; }
        if(!email){ showToast('이메일을 입력해주세요!'); return; }
        safeSetItem('my_nickname', nick);
        safeSetItem('my_email', email);
        const ni = document.getElementById('nickname-input');
        if(ni) ni.value = nick;
        const ei = document.getElementById('user-email-input');
        if(ei) ei.value = email;
        const se = document.getElementById('story-email');
        if(se) se.value = email;
        document.getElementById('nickname-modal')?.remove();

        // ★ 관리자 모드: 특정 이름+이메일 조합 시 최고등급 부여
        if(nick === '인생2막관리자' && email === 'life2radio@gmail.com'){
            // 이전 포인트 저장 (복원용)
            if(safeGetItem('admin_mode','') !== '1'){
                safeSetItem('pre_admin_points', String(getPoints()));
            }
            safeSetItem('admin_mode','1');
            setPoints(9999);
            // PDF 전체 해제
            [10,20,30,40].forEach(function(t){ safeSetItem('pdf_unlocked_'+t,'1'); });
            renderPointBar();
            showToast('👑 관리자 모드 활성화! 모든 기능을 테스트할 수 있어요.');
            safeSetItem('onboarding_done','1');
            return;
        }

        window._sendUserUpdate();
        window._sendUserRegister('이름모달등록');
        // ★ 이름+이메일 등록 완료 → 첫 방문 포인트 지급
        const _savedNick = safeGetItem('my_nickname','');
        const _savedEmail = safeGetItem('my_email','');
        if(_savedNick && _savedEmail) checkFirstVisit();
        initOnboarding();
    }

    // ★ 닉네임/이메일 전체 동기화
    function syncNicknameEmail(){
        const nick = safeGetItem('my_nickname','');
        const email = safeGetItem('my_email','');
        // 설정 탭
        const ni = document.getElementById('nickname-input');
        if(ni) ni.value = nick;
        const ei = document.getElementById('user-email-input');
        if(ei) ei.value = email;
        // 사연 탭
        const sn = document.getElementById('story-name');
        if(sn && nick && !sn.value) sn.value = nick;
        const se = document.getElementById('story-email');
        if(se && email) se.value = email;
        // 온보딩
        const oni = document.getElementById('ob-nick-input');
        if(oni && nick) oni.value = nick;
        const oei = document.getElementById('ob-email-input');
        if(oei && email) oei.value = email;
        // 닉네임 모달
        const mni = document.getElementById('nm-nick');
        if(mni && nick) mni.value = nick;
        const mei = document.getElementById('nm-email');
        if(mei && email) mei.value = email;
    }

    window.saveNickname = function(){
        const val = (document.getElementById('nickname-input')?.value || '').trim();
        if(!val || val.length < 2){
            showToast('이름은 2글자 이상 입력해주세요!');
            return;
        }
        const prev = safeGetItem('my_nickname','');
        if(prev && prev !== val){
            if(!confirm('이름을 변경하시겠습니까?\n\n이전: ' + prev + '\n변경: ' + val)) return;
        }
        safeSetItem('my_nickname', val);
        syncNicknameEmail();

        // ★ 관리자 모드 체크
        const curEmail = safeGetItem('my_email','');
        if(val === '인생2막관리자' && curEmail === 'life2radio@gmail.com'){
            if(safeGetItem('admin_mode','') !== '1'){
                safeSetItem('pre_admin_points', String(getPoints()));
            }
            safeSetItem('admin_mode','1');
            setPoints(9999);
            [10,20,30,40].forEach(function(t){ safeSetItem('pdf_unlocked_'+t,'1'); });
            renderPointBar();
            showToast('👑 관리자 모드 활성화!');
            return;
        }
        // ★ 관리자 모드 해제: 이전 포인트 복원
        if(safeGetItem('admin_mode','') === '1'){
            safeSetItem('admin_mode','');
            const prev = parseInt(safeGetItem('pre_admin_points','0'))||0;
            setPoints(prev);
            [10,20,30,40].forEach(function(t){ safeSetItem('pdf_unlocked_'+t,''); });
            renderPointBar();
            showToast('👤 관리자 모드 해제. 포인트 복원됐어요.');
            return;
        }

        showToast('🏅 이름이 저장됐어요!');
        window._sendUserUpdate();
        window._sendUserRegister('이름설정');
    }

    window.saveUserEmail = function(){
        const val = (document.getElementById('user-email-input')?.value || '').trim();
        if(!val){ showToast('이메일을 입력해주세요!'); return; }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if(!emailRegex.test(val)){
            showToast('올바른 이메일 형식이 아니에요!\n예: abc@gmail.com');
            return;
        }
        const prev = safeGetItem('my_email','');
        if(prev && prev !== val){
            if(!confirm('이메일을 변경하시겠습니까?\n\n이전: ' + prev + '\n변경: ' + val)) return;
        }
        safeSetItem('my_email', val);
        syncNicknameEmail();

        // ★ 관리자 모드 체크 (이메일 저장 시)
        const curNick = safeGetItem('my_nickname','');
        if(val === 'life2radio@gmail.com' && curNick === '인생2막관리자'){
            if(safeGetItem('admin_mode','') !== '1'){
                safeSetItem('pre_admin_points', String(getPoints()));
            }
            safeSetItem('admin_mode','1');
            setPoints(9999);
            [10,20,30,40].forEach(function(t){ safeSetItem('pdf_unlocked_'+t,'1'); });
            renderPointBar();
            showToast('👑 관리자 모드 활성화!');
            return;
        }

        showToast('📧 이메일이 저장됐어요!');
        window._sendUserUpdate();
        window._sendUserRegister('이메일설정');
        // ★ 대기 중인 레벨업 처리
        if(_pendingLevelUp >= 0){
            const idx = _pendingLevelUp;
            _pendingLevelUp = -1;
            setTimeout(()=> showLevelUp(idx), 500);
        }
    }

    // 앱 설치 가이드 아코디언
    window.toggleInstallGuide = function(){
        const body = document.getElementById('install-guide-body');
        const arrow = document.getElementById('install-guide-arrow');
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
    }

    // 알림 가이드 아코디언
    window.toggleNotifGuide = function(){
        const body = document.getElementById('notif-guide-body');
        const arrow = document.getElementById('notif-guide-arrow');
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
    }

    // 아코디언 열기/닫기
    window.toggleSurveyAccordion = function(){
        const body = document.getElementById('survey-accordion-body');
        const arrow = document.getElementById('survey-accordion-arrow');
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        arrow.style.transform = isOpen ? '' : 'rotate(180deg)';
        if(!isOpen) initSurveyButtons();
    }

    // 설문 저장 + 닫기
    window.saveSurveyWithConfirm = function(){
        const existing = safeGetItem('survey_saved','');
        if(existing){
            if(!confirm('정보를 변경하시겠습니까?')) return;
        }
        saveSurvey();
        // 닫기
        document.getElementById('survey-accordion-body').style.display = 'none';
        document.getElementById('survey-accordion-arrow').style.transform = '';
        document.getElementById('survey-saved-label').textContent = '✅ 저장됨 · 수정하려면 클릭';
        safeSetItem('survey_saved','1');
    }

    window.saveFamilySender = function(){
        const val = document.getElementById('family-sender-input').value.trim();
        if(!val){ showToast('이름을 입력해주세요'); return; }
        safeSetItem('family_sender', val);
        showToast('💌 보내는 분 서명이 저장됐어요!');
    }

    window.saveFamilyReceiver = function(){
        const val = document.getElementById('family-receiver-input').value.trim();
        if(!val){ showToast('이름을 입력해주세요'); return; }
        safeSetItem('family_receiver', val);
        showToast('💌 받는 분 이름이 저장됐어요!');
    }

    
    window.initApp = function(){
        applyStoredSettings();



        // ★ ?r= 결과 공유 링크 처리
        if(window._sharedResult){
            const fakeResult = window._sharedResult;
            window._sharedResult = null;
            currentMode = safeGetItem('app_mode','A');
            selectedDateObj = new Date(todayObj);
            switchMode(currentMode);
            isBgmOn = safeGetItem('bgm_state','off')==='on';
            updateBgmUI(); initBanner(); renderPointBar(); switchView('home');
            setTimeout(function(){
                const m = document.createElement('div');
                m.id = 'psych-modal';
                m.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;background:var(--bg-color);overflow-y:auto;';
                document.body.appendChild(m);
                showPsychResult(fakeResult);
                const banner = document.createElement('div');
                banner.id = 'shared-result-banner';
                banner.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#C9A84C;color:#1B4332;text-align:center;padding:10px 16px;font-size:0.9em;font-weight:700;z-index:100000;box-sizing:border-box;';
                // 배너 설정 완료
                document.body.appendChild(banner);
            }, 500);
            return;
        }
        restoreNotifSchedule();
        initSolidarity();
        loadSheetData();
        setTimeout(renderPsychPreview, 500);

        // ★ OAuth 리디렉션 후 복귀 처리 (oauth_in_progress 플래그로도 감지)
        const _oauthInProgress = safeGetItem('oauth_in_progress','') === '1';
        if(_oauthInProgress){ safeSetItem('oauth_in_progress',''); }
        const _pendingEmail = safeGetItem('oauth_pending_email','');
        if(_pendingEmail || _oauthInProgress){
            // OAuth 복귀: 이메일/이름을 직접 저장하지 않고 모달에서 확인 후 저장
            // (pending 키는 showNicknameModal에서 필드에 채워주고 사용자가 확인)
            currentMode=safeGetItem('app_mode','A');
            selectedDateObj=new Date(todayObj);
            switchMode(currentMode);
            isBgmOn=safeGetItem('bgm_state','off')==='on';
            updateBgmUI();
            initBanner();
            renderPointBar();
            switchView('home');
            // 등록 팝업 표시 (필수 아님 - 나중에 할게요로 건너뛸 수 있음)
            if(!safeGetItem('my_nickname','') || !safeGetItem('my_email','')){
                setTimeout(function(){
                    if(window.showNicknameModal) window.showNicknameModal();
                }, 300);
                initOnboarding();
            } else {
                if(_pendingEmail) showToast('✅ 구글 이메일이 연결됐어요!');
                initOnboarding();
            }
            return;
        }

        // ★ 설치 팝업 → 온보딩 순서
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                          || navigator.standalone === true;
        if(isStandalone){
            initOnboarding();
        } else {
            showInstallPrompt();
        }
        currentMode=safeGetItem('app_mode','A');
        selectedDateObj=new Date(todayObj);
        switchMode(currentMode);
        isBgmOn=safeGetItem('bgm_state','off')==='on';
        updateBgmUI();
        initBanner();
        renderPointBar();
        // ★ URL 파라미터로 탭 직접 이동
        if(typeof _tabParam !== 'undefined' && (_tabParam==='story' || _tabParam==='daejim')) {
            switchView('story');
            history.replaceState(null, '', location.pathname);
        } else {
            switchView('home');
        }
        // ★ 기존 등록 완료 사용자: 첫 방문 포인트 미지급 시 지급
        if(safeGetItem('onboarding_done','') === '1'){
            setTimeout(function(){ checkFirstVisit(); }, 1500);
        }

        // ★ 앱 설치 후 실행 시 '보류 중인 심리테스트 결과'가 있으면 팝업 표시
        // (isStandalone 변수는 위에서 이미 선언했으므로 지웁니다)
        const pendingSave = safeGetItem('pending_psych_save', '');

        if(isStandalone && pendingSave === '1'){
            setTimeout(() => {
                document.getElementById('psych-save-confirm-modal').style.display = 'flex';
            }, 1000);
        }
    }

    function showInstallPrompt(){
        // ★ 심리테스트 링크로 왔을 때는 설치 팝업 건너뜀
        if(window._psychMode){ initOnboarding(); return; }
        // ★ 기존 사용 이력 있으면 설치 팝업 건너뜀 (크롬 재접속 시 첫 화면 방지)
        const _hasExistingData = (parseInt(safeGetItem('user_points','0'))||0) > 0
            || safeGetJSON('completed_dates',[]).length > 0
            || safeGetItem('my_nickname','') !== '';
        if(_hasExistingData){ initOnboarding(); return; }
        safeSetItem('install_prompt_v10','1');
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);

        const modal = document.createElement('div');
        modal.id = 'install-first-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;';

        let installContent = '';

        const isKakaoIOS = /KAKAOTALK/i.test(navigator.userAgent);

        if(isIOS){
            if(isKakaoIOS){
                // 카카오톡 인앱브라우저 → Safari 안내
                const currentUrl = location.href;
                installContent = `
                <div style="background:#FFF3CD;border-radius:14px;padding:14px 16px;margin-bottom:14px;text-align:left;">
                    <div style="font-size:0.85em;color:#856404;line-height:2.4;font-weight:600;">
                        1️⃣ 아래 <b>공유버튼 □↑</b> 탭<br>
                        2️⃣ <b>"Safari로 열기"</b> 선택<br>
                        3️⃣ Safari 하단 <b>공유버튼 □↑</b> 탭<br>
                        4️⃣ 아래 스크롤 → <b>"홈 화면에 추가"</b><br>
                        5️⃣ 오른쪽 상단 <b>"추가"</b> 탭
                    </div>
                </div>
                <button id="ios-copy-btn" style="width:100%;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:0.95em;font-weight:700;cursor:pointer;margin-bottom:8px;">📋 링크 복사하기 (Safari에 붙여넣기)</button>
                <button onclick="document.getElementById('install-first-modal').remove(); showNicknameModal();" style="width:100%;min-height:44px;background:none;border:1px solid #1B4332;border-radius:14px;font-size:0.9em;color:#1B4332;font-weight:600;cursor:pointer;">설치없이 이용하기</button>`;
            } else {
                installContent = `
                <div style="background:#F0F7F4;border-radius:14px;padding:16px 18px;margin-bottom:16px;text-align:left;">
                    <div style="font-size:0.88em;color:#1B4332;line-height:2.2;font-weight:600;">
                        1️⃣ 아래 <b>공유 버튼 □↑</b> 탭<br>
                        2️⃣ <b>"홈 화면에 추가"</b> 선택<br>
                        3️⃣ 오른쪽 상단 <b>"추가"</b> 탭
                    </div>
                </div>
                <button onclick="document.getElementById('install-first-modal').remove(); initOnboarding();" style="width:100%;min-height:52px;background:#1B4332;color:#FFFFFF;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;margin-bottom:10px;">확인했어요! 앱 시작하기 ✓</button>
                <button onclick="document.getElementById('install-first-modal').remove(); showNicknameModal();" style="width:100%;min-height:44px;background:none;border:1px solid #1B4332;border-radius:14px;font-size:0.9em;color:#1B4332;font-weight:600;cursor:pointer;">설치없이 이용하기</button>`;
            }
        } else if(isAndroid){
            installContent = `
                <button id="install-pwa-btn" onclick="installFromPrompt()" style="width:100%;min-height:60px;background:#1B4332;color:#FFFFFF;border:none;border-radius:14px;font-size:1.1em;font-weight:700;cursor:pointer;margin-bottom:10px;">📲 홈화면에 앱 설치하기</button>
                <button onclick="document.getElementById('install-first-modal').remove(); showNicknameModal();" style="width:100%;min-height:44px;background:none;border:1px solid #1B4332;border-radius:14px;font-size:0.9em;color:#1B4332;font-weight:600;cursor:pointer;">설치없이 이용하기</button>`;
        } else {
            installFromPromptDone();
            return;
        }

        modal.innerHTML = `
            <div style="background:#FFFFFF;border-radius:24px;padding:32px 24px;width:90%;max-width:380px;text-align:center;">
                <div style="font-size:48px;margin-bottom:10px;">📲</div>
                <div style="font-size:1.2em;font-weight:700;color:#1B4332;margin-bottom:8px;">앱으로 저장하면 더 편해요!</div>
                <div style="font-size:0.88em;color:#666;line-height:1.7;margin-bottom:20px;">
                    홈화면에 추가하면<br>
                    <b style="color:#1B4332;">앱처럼 바로 열 수 있어요.</b><br>
                    매일 아침 확언을 놓치지 마세요 🌿
                </div>
                ${installContent}
            </div>`;
        document.body.appendChild(modal);
        // iOS 카카오톡 링크 복사 버튼
        var iosBtn = document.getElementById('ios-copy-btn');
        if(iosBtn){
            iosBtn.addEventListener('click', function(){
                var url = location.href;
                if(navigator.clipboard){
                    navigator.clipboard.writeText(url).then(function(){
                        iosBtn.textContent = '✅ 복사됐어요! Safari에서 붙여넣기 하세요';
                    });
                } else {
                    var ta = document.createElement('textarea');
                    ta.value = url; document.body.appendChild(ta);
                    ta.select(); document.execCommand('copy');
                    document.body.removeChild(ta);
                    iosBtn.textContent = '✅ 복사됐어요! Safari에서 붙여넣기 하세요';
                }
            });
        }
    }

    window.tryInstallOrGuide = function(){
        if(pwaInstallPrompt){
            installFromPrompt();
        } else {
            // pwaInstallPrompt 없으면 안내 표시
            const guide = document.getElementById('install-guide');
            if(guide) guide.style.display = 'block';
            showToast('브라우저 메뉴(⋮) → 홈 화면에 추가를 눌러주세요');
        }
    }

    window.installFromPrompt = async function(){
        if(!pwaInstallPrompt){
            // 이벤트 아직 안 왔으면 버튼 대기 상태로
            const btn = document.getElementById('install-pwa-btn');
            if(btn){ btn.textContent = '⏳ 잠시만요...'; btn.disabled = true; }
            window._pendingInstallClick = true;
            return;
        }
        const btn = document.getElementById('install-pwa-btn');
        if(btn){ btn.textContent = '⏳ 설치 중...'; btn.disabled = true; }
        document.getElementById('install-first-modal')?.remove();
        try {
            pwaInstallPrompt.prompt();
            const result = await pwaInstallPrompt.userChoice;
            pwaInstallPrompt = null;
            if(result.outcome === 'accepted'){
                showToast('🎉 설치 완료! 홈화면에서 확인해보세요');
                window._sendAppInstall(); // ★ 앱 설치 기록
            }
        } catch(e) {
            showToast('브라우저 메뉴(⋮) → 홈 화면에 추가를 눌러주세요');
        }
        initOnboarding();
    }

    function installFromPromptDone(){
        initOnboarding();
    }

    /* ===== 날짜 탐색 ===== */
    window.changeSelectedDate=function(delta){if(typeof window.stopTTS==='function')stopTTS();selectedDateObj.setDate(selectedDateObj.getDate()+delta);renderScreen();}
    window.resetToToday=function(){if(typeof window.stopTTS==='function')stopTTS();selectedDateObj=new Date(todayObj);renderScreen();}
    window.goToDate=function(y,m,d){selectedDateObj=new Date(y,m-1,d);selectedDateObj.setHours(0,0,0,0);switchView('home');}

    /* ===== 홈 렌더 ===== */
    window.switchMode=function(mode){if(typeof window.stopTTS==='function')stopTTS();currentMode=mode;safeSetItem('app_mode',mode);document.getElementById('tab-a').className='tab-btn'+(mode==='A'?' active':'');document.getElementById('tab-b').className='tab-btn'+(mode==='B'?' active':'');selectedDateObj=new Date(todayObj);renderScreen();}
    window.startJourney=function(){safeSetItem('start_date_B',getTodayStr());selectedDateObj=new Date(todayObj);renderScreen();}
    /* ===== ★ 감정 기반 추천 메시지 데이터 ===== */
    const EMOTION_MESSAGES = [
        { title:"💙 마음이 무거운 날이죠", text:"그래도 괜찮아요. 오늘 이 확언이 당신 곁에 있어요. 천천히, 함께 읽어봐요." },
        { title:"💚 조금 흐린 날이네요", text:"아직 하루가 남아 있어요. 확언 하나가 마음의 날씨를 바꿔줄 거예요." },
        { title:"🌿 평범한 하루예요", text:"평범한 날도 소중해요. 오늘도 한 걸음, 나를 위해 읽어봐요." },
        { title:"☀️ 좋은 하루네요!", text:"이 기분 그대로 오늘의 확언과 함께라면 더 빛날 거예요!" },
        { title:"🌟 에너지가 넘치는 날!", text:"최고의 하루예요! 이 확언이 오늘을 더 특별하게 만들어 줄 거예요." }
    ];

    window.selectMood=function(type,idx){
        if(!isToday)return;
        safeSetItem(`mood_${type}_${getFormatDate(selectedDateObj)}`,idx);
        renderMood(type);
        if(type==='before'){
            let t=document.getElementById('affirmation-blur-target'),m=document.getElementById('unlock-msg');
            if(t)t.classList.remove('blurred-content');
            if(m)m.style.display='none';
            showEmotionRecommend(idx);
            showMoodReasonQuestion(idx); // ★ 감정 원인 질문
        }
        if(type==='after'){
            addPoint(1,'기분체크','mood_check');
            checkMoodRiseStreak();
            const completed=safeGetJSON('completed_dates',[]);
            checkStoryCard(completed.length);
            showPastMe(idx); // ★ 과거의 나
            checkRandomGift(); // ★ 랜덤 선물
            renderKeyQuestion(); // ★ 기분 후 선택 시 핵심질문 표시
            setTimeout(renderShortsPointSummary, 200); // ★ 실천 탭 갱신
        }
    }

    /* ===== ① 감정 기반 유튜브 추천 강화 ===== */

    function analyzeRecentMood(){
        // 최근 7일 감정 분석
        let sadCount=0, neutralCount=0, happyCount=0;
        for(let i=0;i<7;i++){
            const d = new Date(todayObj);
            d.setDate(d.getDate()-i);
            const val = safeGetItem(`mood_before_${getFormatDate(d)}`, null);
            if(val===null) continue;
            const v = parseInt(val);
            if(v<=1) sadCount++;
            else if(v===2) neutralCount++;
            else happyCount++;
        }
        const total = sadCount+neutralCount+happyCount;
        if(total===0) return 'default';
        if(sadCount/total >= 0.5) return 'sad';
        if(neutralCount/total >= 0.5) return 'neutral';
        if(happyCount/total >= 0.5) return 'happy';
        return 'default';
    }

    function showEmotionRecommend(beforeIdx){
        const box   = document.getElementById('emotion-recommend');
        const title = document.getElementById('recommend-title');
        const text  = document.getElementById('recommend-text');
        if(!box) return;

        // 오늘 기분 + 최근 패턴 종합
        const recentPattern = analyzeRecentMood();
        let rec = MOOD_YT_RECOMMEND.find(r=> r.pattern===recentPattern) || MOOD_YT_RECOMMEND[3];

        // 오늘 개별 기분별 즉각 메시지 (기존 유지)
        const immediateMsg = [
            {title:'💙 마음이 무거운 날이죠', text:'그래도 괜찮아요. 오늘 이 확언이 당신 곁에 있어요.'},
            {title:'💚 조금 흐린 날이네요', text:'아직 하루가 남아 있어요. 확언 하나가 마음의 날씨를 바꿔줄 거예요.'},
            {title:'🌿 평범한 하루예요', text:'평범한 날도 소중해요. 오늘도 한 걸음, 나를 위해 읽어봐요.'},
            {title:'☀️ 좋은 하루네요!', text:'이 기분 그대로 오늘의 확언과 함께라면 더 빛날 거예요!'},
            {title:'🌟 에너지가 넘치는 날!', text:'최고의 하루예요! 이 확언이 오늘을 더 특별하게 만들어 줄 거예요.'}
        ];
        const msg = immediateMsg[beforeIdx] || immediateMsg[2];
        title.textContent = msg.title;
        text.textContent  = msg.text;

        // 유튜브 추천 (최신 에피소드 or 패턴 기반)
        const ytBox   = document.getElementById('yt-recommend-box');
        const ytLink  = document.getElementById('yt-recommend-link');
        const ytTitle = document.getElementById('yt-recommend-title');
        const ytDesc  = document.getElementById('yt-recommend-desc');
        if(ytBox){
            // 최신 에피소드 있으면 우선
            if(latestEpisode && latestEpisode.title){
                ytTitle.textContent = latestEpisode.title;
                ytDesc.textContent  = '인생2막라디오 최신 에피소드';
                ytLink.href = latestEpisode.url;
            } else {
                ytTitle.textContent = rec.ytTitle;
                ytDesc.textContent  = rec.ytDesc;
                ytLink.href = rec.ytUrl;
            }
            ytBox.style.display = 'block';
        }
        box.style.display = 'block';
        trackEvent('emotion_recommend_shown', {mood_idx: beforeIdx, pattern: recentPattern});
    }

    /* ===== ⑧ 감정 원인 질문 ===== */

    function showMoodReasonQuestion(beforeIdx){
        const box = document.getElementById('mood-reason-box');
        if(!box) return;
        // 😔 😐 일 때만 질문 — 다른 기분 선택 시 박스 숨김
        if(beforeIdx > 2){
            box.style.display = 'none';
            return;
        }
        const type = beforeIdx <= 1 ? 'sad' : 'neutral';
        const data = MOOD_REASONS[type];
        document.getElementById('mood-reason-question').textContent = data.question;
        const optEl = document.getElementById('mood-reason-options');
        optEl.innerHTML = data.options.map((o,i)=>
            `<button onclick="selectMoodReason(${i},${beforeIdx})" style="text-align:left;padding:11px 16px;background:var(--bg-color);border:1px solid var(--border-color);border-radius:10px;font-size:0.88em;font-weight:600;color:var(--text-color);cursor:pointer;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='var(--border-color)'">${o.text}</button>`
        ).join('');
        document.getElementById('mood-reason-result').style.display = 'none';
        box.style.display = 'block';
    }

    window.selectMoodReason = function(optIdx, beforeIdx){
        const type = beforeIdx <= 1 ? 'sad' : 'neutral';
        const reply = MOOD_REASONS[type].options[optIdx].reply;
        const resultEl = document.getElementById('mood-reason-result');
        const optEl    = document.getElementById('mood-reason-options');
        optEl.style.display = 'none';
        resultEl.textContent = '🌿 ' + reply;
        resultEl.style.display = 'block';
        // 저장
        safeSetItem(`mood_reason_${getTodayStr()}`, MOOD_REASONS[type].options[optIdx].text);
    }

    /* ===== ④ 변화 스토리 카드 ===== */
    function checkStoryCard(completedCount){
        const milestones = [7,30,100,200,300];
        const milestone = milestones.find(m=> completedCount===m);
        if(!milestone) return;
        const key = `story_card_shown_${milestone}`;
        if(safeGetItem(key,'') === '1') return;
        safeSetItem(key,'1');
        setTimeout(()=> showStoryCard(milestone, completedCount), 1200);
    }

    function showStoryCard(milestone, total){
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9995;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#FFFFFF;border-radius:24px;padding:28px 24px;width:90%;max-width:380px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
                <div style="font-size:48px;margin-bottom:12px;">${milestone===300?'🏆':milestone>=100?'🌟':milestone>=30?'🌻':'🌱'}</div>
                <div style="font-size:1.3em;font-weight:700;color:#1B4332;margin-bottom:6px;">${milestone}일 달성!</div>
                <div style="font-size:0.9em;color:#666;margin-bottom:20px;line-height:1.6;">
                    ${milestone}일 동안 매일 확언과 함께하셨어요.<br>당신의 변화를 카드로 만들어드릴게요!
                </div>
                <canvas id="story-canvas" style="width:100%;border-radius:14px;margin-bottom:16px;display:block;"></canvas>
                <div style="display:flex;gap:10px;margin-bottom:10px;">
                    <button onclick="downloadStoryCard()" style="flex:1;min-height:50px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">저장하기</button>
                    <button onclick="shareStoryCard()" style="flex:1;min-height:50px;background:#C9A84C;color:#1B4332;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">공유하기</button>
                </div>
                <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;min-height:44px;background:none;border:1px solid #E8E5E0;border-radius:12px;font-size:0.88em;font-weight:600;color:#888;cursor:pointer;">닫기</button>
            </div>`;
        document.body.appendChild(modal);
        launchConfetti();
        drawStoryCard(modal.querySelector('#story-canvas'), milestone, total);
    }

    function drawStoryCard(canvas, milestone, total){
        const W=600, H=600;
        canvas.width=W; canvas.height=H;
        const ctx=canvas.getContext('2d');
        // 배경
        const g=ctx.createLinearGradient(0,0,0,H);
        g.addColorStop(0,'#1B4332'); g.addColorStop(1,'#0D2B20');
        ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
        // 장식 원
        ctx.beginPath(); ctx.arc(W-60,60,150,0,Math.PI*2);
        ctx.fillStyle='rgba(201,168,76,0.08)'; ctx.fill();
        ctx.beginPath(); ctx.arc(60,H-60,120,0,Math.PI*2);
        ctx.fillStyle='rgba(201,168,76,0.06)'; ctx.fill();
        // 골드 선
        ctx.strokeStyle='#C9A84C'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(50,50); ctx.lineTo(W-50,50); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(50,H-50); ctx.lineTo(W-50,H-50); ctx.stroke();
        // 타이틀
        ctx.fillStyle='#C9A84C';
        ctx.font='bold 22px "Apple SD Gothic Neo",sans-serif';
        ctx.textAlign='center';
        ctx.fillText('나는 이렇게 변하고 있다', W/2, 100);
        // 일수
        ctx.fillStyle='#FFFFFF';
        ctx.font='bold 100px "Apple SD Gothic Neo",sans-serif';
        ctx.fillText(milestone, W/2, 240);
        ctx.font='bold 32px "Apple SD Gothic Neo",sans-serif';
        ctx.fillText('일째 함께', W/2, 290);
        // 통계
        const cd=safeGetJSON('completed_dates',[]);
        let moodUp=0;
        cd.forEach(ds=>{ const b=safeGetItem(`mood_before_${ds}`,null),a=safeGetItem(`mood_after_${ds}`,null); if(b!==null&&a!==null&&parseInt(a)>parseInt(b))moodUp++; });
        const streak=calcCurrentStreak(cd);
        ctx.fillStyle='rgba(255,255,255,0.7)';
        ctx.font='22px "Apple SD Gothic Neo",sans-serif';
        ctx.fillText(`총 ${total}일 완료 · 최장 ${streak}일 연속 · 기분 상승 ${moodUp}회`, W/2, 360);
        // 구분선
        ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(80,390); ctx.lineTo(W-80,390); ctx.stroke();
        // 확언
        const dc=(total-1)%affirmationsData.length;
        const todayText=affirmationsData[dc]?affirmationsData[dc].text.substring(0,30)+'...':'';
        ctx.fillStyle='rgba(255,255,255,0.85)';
        ctx.font='18px "Apple SD Gothic Neo",sans-serif';
        ctx.fillText(todayText, W/2, 430);
        // 워터마크
        ctx.fillStyle='rgba(201,168,76,0.8)';
        ctx.font='bold 20px "Apple SD Gothic Neo",sans-serif';
        ctx.fillText('🌿 인생2막라디오 · 365일 확언', W/2, H-70);
    }

    window.downloadStoryCard = function(){
        const canvas = document.querySelector('#story-canvas');
        if(!canvas) return;
        const a=document.createElement('a');
        a.download=`인생2막_변화스토리.png`;
        a.href=canvas.toDataURL('image/png');
        a.click();
        showToast('스토리 카드가 저장됐어요!');
    }

    window.shareStoryCard = function(){
        const canvas = document.querySelector('#story-canvas');
        if(!canvas) return;
        canvas.toBlob(async blob=>{
            const file=new File([blob],'변화스토리.png',{type:'image/png'});
            if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
                await navigator.share({files:[file],title:'인생2막 변화 스토리',text:'365일 확언으로 이렇게 변하고 있어요 🌿'});
            } else { downloadStoryCard(); }
        },'image/png');
    }

    /* ===== ★ 연속 긍정 변화 배지 ===== */
    const MOOD_RISE_BADGES = [
        { days:3,  icon:'🌱', label:'3일 연속 마음이 밝아졌어요!' },
        { days:7,  icon:'🌻', label:'7일 연속! 확언이 마음을 바꾸고 있어요!' },
        { days:14, icon:'🌟', label:'14일 연속! 당신의 긍정이 빛나고 있어요!' },
        { days:30, icon:'🏅', label:'30일 연속! 진짜 변화를 만들고 있어요!' }
    ];

    function checkMoodRiseStreak(){
        const dateStr = getFormatDate(selectedDateObj);
        const beforeVal = safeGetItem(`mood_before_${dateStr}`, null);
        const afterVal  = safeGetItem(`mood_after_${dateStr}`, null);
        if(beforeVal === null || afterVal === null) return;

        // 오늘 기분이 올랐는지 체크
        const rose = parseInt(afterVal) > parseInt(beforeVal);
        safeSetItem(`mood_rose_${dateStr}`, rose ? '1' : '0');

        // 연속 기간 계산
        let streak = 0;
        let d = new Date(selectedDateObj);
        while(true){
            const ds = getFormatDate(d);
            const v = safeGetItem(`mood_rose_${ds}`, null);
            if(v === '1') { streak++; d.setDate(d.getDate()-1); }
            else break;
        }

        // 오늘 오른 경우 화면에 메시지 표시
        const riseMsg = document.getElementById('mood-rise-msg');
        const riseIcon = document.getElementById('mood-rise-icon');
        const riseText = document.getElementById('mood-rise-text');
        if(rose && riseMsg){
            riseMsg.style.display = 'block';
            // 배지 찾기 (가장 높은 달성 배지)
            let badge = null;
            for(let b of MOOD_RISE_BADGES){
                if(streak >= b.days) badge = b;
            }
            if(badge){
                riseIcon.textContent = badge.icon;
                riseText.textContent = `${streak}일째 ${badge.label}`;
                // 새로 달성한 배지 저장
                let earned = safeGetJSON('earned_badges',[]);
                let badgeId = `mood_rise_${badge.days}`;
                if(!earned.includes(badgeId)){
                    earned.push(badgeId);
                    safeSetJSON('earned_badges', earned);
                    // ★ 30일 연속 기분 상승 배지 → +10PT
                    if(badge.days === 30){
                        addPoint(10, '기분상승30일배지', 'mood_rise_30_bonus');
                        setTimeout(()=> showToast(`🏅 ${badge.label} +10PT 지급!`), 600);
                    } else {
                        setTimeout(()=> showToast(`새 배지: ${badge.icon} ${badge.label}`), 600);
                    }
                    renderDashboard();
                }
            } else {
                riseIcon.textContent = '⬆️';
                riseText.textContent = `${streak}일 연속 기분 상승 중! 확언이 효과를 내고 있어요 💚`;
            }
        } else if(riseMsg){
            riseMsg.style.display = 'none';
        }
    }
    function renderMood(type){
        const EMOJIS_LIST = ['😔','😐','🙂','😊','😄']; // 강제 선언으로 오류 원천 차단
        const saved = safeGetItem(`mood_${type}_${getFormatDate(selectedDateObj)}`, null);
        const ct = document.getElementById(`mood-${type}-container`);
        if(!ct) return; // 컨테이너가 없으면 에러 방지
        
        let html = '';
        EMOJIS_LIST.forEach((em, idx) => {
            const ac = (saved == idx) ? ' active' : '';
            const dis = isToday ? '' : ' disabled';
            html += `<button class="mood-btn${ac}" ${dis} onclick="selectMood('${type}',${idx})">${em}</button>`;
        });
        ct.innerHTML = html;
    }

    window.completeToday=function(){if(!isToday)return;try{const ts=getFormatDate(selectedDateObj);let completed=safeGetJSON('completed_dates',[]);if(!completed.includes(ts)){completed.push(ts);safeSetJSON('completed_dates',completed);updateCompleteButton();renderStreakProtectHome();let streak=calcCurrentStreak(completed);checkStreakBadges(streak);showInsightIfNeeded(completed.length);renderScreen();
        trackEvent('complete_affirmation', {day_count: completed.length, streak: streak});
        checkStoryCard(completed.length);
        showCompleteReward(completed.length, streak); // ★ 감정 보상 + 공유 유도
        addPoint(1,'확언완료','complete'); checkStreakBonus(streak);
        setTimeout(renderShortsPointSummary, 200);
        window._sendUserUpdate(); // ★ 시트 전송
    }}catch(e){}}

    function updateCompleteButton(){const btn=document.getElementById('btn-complete');if(!btn)return;const icon='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="margin-right:6px;flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';if(!isToday){btn.style.display='none';}else{btn.style.display='flex';const completed=safeGetJSON('completed_dates',[]);if(completed.includes(getFormatDate(selectedDateObj))){btn.innerHTML=icon+'완료됨';btn.disabled=true;}else{btn.innerHTML=icon+'오늘 완료 체크';btn.disabled=false;}}}

    window.renderScreen = function renderScreen(){
        // (확언 강제 이동: _forceAffirmDay 사용)
        const sv=document.getElementById('start-view'),av=document.getElementById('affirmation-view');
        isToday=(getFormatDate(selectedDateObj)===getFormatDate(todayObj));
        document.getElementById('readonly-banner').style.display=isToday?'none':'block';
        let dayCount=1,prev=document.getElementById('btn-prev-date'),next=document.getElementById('btn-next-date');
        if(currentMode==='A'){
            sv.style.display='none';av.style.display='block';
            let minA=new Date(todayObj.getFullYear(),0,1);
            if(selectedDateObj<minA)selectedDateObj=new Date(minA);
            if(selectedDateObj>todayObj && !window._bypassDateCap) selectedDateObj=new Date(todayObj);
            dayCount=Math.floor((selectedDateObj-minA)/86400000)+1;
            document.getElementById('date-label').innerText=`${selectedDateObj.getFullYear()}년 ${selectedDateObj.getMonth()+1}월 ${selectedDateObj.getDate()}일`;
            document.getElementById('day-label').innerText=`365일 중 ${dayCount}일째`;
            document.getElementById('day-label').onclick=()=>switchView('calendar');
            prev.disabled=(getFormatDate(selectedDateObj)===getFormatDate(minA));
            next.disabled=isToday;
        } else {
            const ss=safeGetItem('start_date_B',null);
            if(!ss){sv.style.display='block';av.style.display='none';return;}
            sv.style.display='none';av.style.display='block';
            let pts=ss.split('-'),minB=new Date(pts[0],pts[1]-1,pts[2]);
            if(selectedDateObj<minB)selectedDateObj=new Date(minB);
            // ✅ 모드 B에서도 bypass 플래그를 허용하도록 수정!
            if(selectedDateObj>todayObj && !window._bypassDateCap) selectedDateObj=new Date(todayObj); 
            dayCount=Math.floor((selectedDateObj-minB)/86400000)+1;
            if(dayCount<1)dayCount=1;
            document.getElementById('date-label').innerText=`${selectedDateObj.getFullYear()}년 ${selectedDateObj.getMonth()+1}월 ${selectedDateObj.getDate()}일`;
            document.getElementById('day-label').innerText=`${dayCount}일차`;
            document.getElementById('day-label').onclick=()=>switchView('calendar');
            prev.disabled=(getFormatDate(selectedDateObj)===getFormatDate(minB));
            next.disabled=isToday;
        }
        window._bypassDateCap = false; // 공통으로 마지막에 플래그 초기화
        const di=(dayCount-1)%affirmationsData.length,data=affirmationsData[di];
        const mb=safeGetItem(`mood_before_${getFormatDate(selectedDateObj)}`,null);
        let overlay='',cc='';
        if(isToday&&mb===null){cc='blurred-content';overlay=`<div class="unlock-message" id="unlock-msg">오늘 기분을 선택하면<br>확언이 열립니다 🔓</div>`;}
        const actionDoneKey = `action_done_${getFormatDate(selectedDateObj)}`;
        const actionDone = safeGetItem(actionDoneKey, '') === '1';
        const photoDone = safeGetItem('pt_daily_action_photo_'+getTodayStr(),'') === '1';
        const actionBtnHtml = isToday ? `
            <div style="padding:14px 18px 16px;border-top:1px solid rgba(201,168,76,0.15);margin-top:14px;">
                <button id="action-done-btn" onclick="toggleActionDone()"
                  style="width:100%;min-height:52px;border-radius:12px;
                  background:${actionDone?'var(--primary-color)':'rgba(27,67,50,0.06)'};
                  color:${actionDone?'#fff':'#1B4332'};
                  border:2px solid ${actionDone?'var(--primary-color)':'rgba(27,67,50,0.25)'};
                  font-size:0.95em;font-weight:800;cursor:pointer;
                  display:flex;align-items:center;justify-content:center;gap:10px;
                  margin-bottom:8px;transition:all 0.2s;">
                  <span style="font-size:1.3em;">${actionDone?'✅':'☐'}</span>
                  <span>${actionDone?'오늘 실천했어요!':'했어요! 체크하기'}</span>
                </button>
                <button onclick="openActionPhoto()"
                  style="width:100%;min-height:40px;border-radius:10px;
                  background:${photoDone?'#C9A84C':'transparent'};
                  color:${photoDone?'#fff':'#C9A84C'};
                  border:1.5px solid ${photoDone?'#C9A84C':'rgba(201,168,76,0.4)'};
                  font-size:0.82em;font-weight:700;cursor:pointer;">
                  ${photoDone?'📸 사진 인증 완료!':'📸 사진으로 인증하면 +5PT'}
                </button>
            </div>` : '';
        document.getElementById('affirmation-box-wrap').innerHTML=`${overlay}<div class="${cc}" id="affirmation-blur-target"><div class="affirmation-box"><div class="theme-text" id="theme-text">"${data.theme}"</div><div class="affirmation-text" id="affirmation-text">${data.text}</div></div><button class="btn-fav" id="btn-fav-main" onclick="toggleFavorite()" style="width:100%;border-radius:0;margin:0;border-left:2px solid var(--accent-color);border-right:2px solid var(--accent-color);"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="margin-right:5px;flex-shrink:0;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>즐겨찾기 추가</button><div style="background:var(--card-bg);border-radius:0 0 12px 12px;margin-bottom:20px;border:2px solid var(--accent-color);border-top:none;overflow:hidden;">
  <div style="background:linear-gradient(90deg,#1B4332,#2D6A4F);padding:10px 18px;display:flex;align-items:center;gap:8px;">
    <span style="font-size:1.15em;">☐</span>
    <span style="font-size:0.82em;font-weight:800;color:#C9A84C;letter-spacing:0.5px;">오늘 해볼까요? · 딱 1분이면 돼요</span>
  </div>
  <div style="padding:16px 18px 0;">
    <div style="font-size:1.05em;font-weight:500;color:var(--text-color);line-height:1.75;" id="action-text">${data.action}</div>
  </div>
  ${actionBtnHtml}
</div></div>`;
        const ep=document.getElementById('btn-episode');
        if(data.episode&&data.episode.trim()!==''){
            ep.style.display='flex';
            ep.href=data.episode;
            ep.setAttribute('onclick', "addPoint(2,'영상클릭','episode_visit')");
            // ② 확언 근거 감성 훅
            ep.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;gap:3px;width:100%;">
                <div style="font-size:0.78em;color:rgba(255,255,255,0.7);">이 확언은 그냥 말이 아닙니다. 이유가 있어요.</div>
                <div style="font-size:0.92em;font-weight:700;">오늘 이야기 들어보기 🎬</div>
            </div>`;
        }
        else{ep.style.display='none';}
        const cd=safeGetJSON('completed_dates',[]),tp=document.getElementById('tomorrow-preview');
        if(isToday&&cd.includes(getFormatDate(selectedDateObj))){
            let nd=affirmationsData[dayCount%affirmationsData.length];
            let wds=nd.text.split(' ');
            document.getElementById('tmrw-theme').innerText=`[${nd.theme}]`;
            document.getElementById('tmrw-text').innerText=wds.slice(0,3).join(' ')+' ...';
            tp.style.display='block';
        } else {tp.style.display='none';}
        renderMood('before');renderMood('after');updateCompleteButton();renderStreakProtectHome();
        renderHomeYTRecommend();
        renderNicknameGreeting();
        check100DayNotify();
        // checkFirstVisit은 온보딩 완료 후 실행 (등록 전 레벨업 팝업 방지)
        renderAbsenceBanner(null);
        renderOracleBtn(); // 배너만 표시 (삭감/하락은 initApp에서만)
        // 기분 전 제목에 닉네임 적용
        const _mbt = document.getElementById('mood-before-title');
        if(_mbt){ const _n=safeGetItem('my_nickname',''); _mbt.textContent = _n ? `${_n}님, 오늘 확언을 보기 전 지금 기분은 어떠세요?` : '오늘 확언을 보기 전 지금 기분은 어떠세요?'; }

        // 핵심질문은 기분(후) 선택 시에만 표시 — 이미 선택된 경우 바로 표시
        const afterSaved = safeGetItem(`mood_after_${getFormatDate(selectedDateObj)}`, null);
        if(afterSaved !== null){
            renderKeyQuestion();
        } else {
            const kqBox = document.getElementById('key-question-box');
            if(kqBox) kqBox.style.display = 'none';
        }
        // ★ 즐겨찾기 버튼 상태 업데이트
        updateFavButton(dayCount);
    }

    /* ===== 스트릭 ===== */
    function calcCurrentStreak(completedDates){let streak=0,d=new Date(todayObj),ts=getFormatDate(d);if(completedDates.includes(ts)){while(completedDates.includes(getFormatDate(d))){streak++;d.setDate(d.getDate()-1);}}else{d.setDate(d.getDate()-1);while(completedDates.includes(getFormatDate(d))){streak++;d.setDate(d.getDate()-1);}}return streak;}
    function renderStreakProtectHome(){
        let d=new Date(todayObj),ts=getFormatDate(d);d.setDate(d.getDate()-1);let ys=getFormatDate(d);
        let cd=safeGetJSON('completed_dates',[]),streak=calcCurrentStreak(cd);
        let et=Math.floor(cd.length/30),ut=safeGetJSON('used_tickets',0),ct=et-ut;
        let html=`🔥 ${streak}일 연속 달성 중!`;
        if(!cd.includes(ts)&&!cd.includes(ys)&&ct>0&&streak===0)html=`🔥 스트릭이 끊길 위기! <button class="btn-sub" style="font-size:16px;padding:6px 12px;margin-left:10px;cursor:pointer;border:none;border-radius:8px;font-weight:bold;" onclick="useTicket()">보호권 사용(남음:${ct})</button>`;
        document.getElementById('streak-display-home').innerHTML=html;
        // 완료 기록 없는 새 사용자 → 결석 카운터 강제 리셋
        if(cd.length === 0){
            safeSetItem('revival_absent_days','0');
        }
        // 결석일 자동 계산: 한 번이라도 완료한 적 있고, 오늘+어제 모두 미완료 시 결석 누적
        else if(!cd.includes(ts)&&!cd.includes(ys)){
            var abKey='revival_absent_last_date', lastDate=safeGetItem(abKey,'');
            if(lastDate!==ts){
                var ab=parseInt(safeGetItem('revival_absent_days','0'))||0;
                safeSetItem('revival_absent_days',String(ab+1));
                safeSetItem(abKey,ts);
            }
        }
        // 완료한 날이면 결석 카운터 리셋
        if(cd.includes(ts)) safeSetItem('revival_absent_days','0');
        renderStreakMilestone();
    }
    window.useTicket=function(){
        let d=new Date(todayObj);d.setDate(d.getDate()-1);
        let ys=getFormatDate(d),cd=safeGetJSON('completed_dates',[]);
        if(!cd.includes(ys)){cd.push(ys);safeSetJSON('completed_dates',cd);let u=safeGetJSON('used_tickets',0);safeSetJSON('used_tickets',u+1);showToast('보호권 사용! 스트릭이 유지됩니다.');renderScreen();}
    }

    /* ===== 달력 ===== */
    let calYear=todayObj.getFullYear(),calMonth=todayObj.getMonth()+1;
    window.currentAvgMood='+0';
    window.changeMonth=function(delta){calMonth+=delta;if(calMonth<1){calMonth=12;calYear--;}else if(calMonth>12){calMonth=1;calYear++;}renderCalendar();}
    window.renderCalendar = function renderCalendar(){
        try{
            document.getElementById('cal-month-title').innerText=`${calYear}년 ${calMonth}월`;
            const fd=new Date(calYear,calMonth-1,1),fdw=fd.getDay(),dim=new Date(calYear,calMonth,0).getDate();
            let cd=safeGetJSON('completed_dates',[]),mc=0,html='';
            for(let i=0;i<fdw;i++)html+=`<div class="cal-cell"></div>`;
            for(let d=1;d<=dim;d++){
                let ds=`${calYear}-${calMonth}-${d}`,cd2=new Date(calYear,calMonth-1,d);
                let ic=cd.includes(ds),if2=cd2>todayObj;
                if(ic)mc++;
                let cc='cal-circle';
                if(ic)cc+=' checked';else if(if2)cc+=' future';else cc+=' unchecked';
                if(!if2)cc+=' clickable';
                let ce=!if2?`onclick="goToDate(${calYear},${calMonth},${d})"`:'' ;
                // ★ 이모지 달력: 완료한 날은 기분 이모지 표시
                let cellContent = d;
                if(ic){
                    let moodAfterVal = safeGetItem(`mood_after_${ds}`, null);
                    if(moodAfterVal !== null){
                        cellContent = `<span style="font-size:22px;">${EMOJIS[parseInt(moodAfterVal)]}</span>`;
                        cc += ' emoji-day';
                    }
                }
                html+=`<div class="cal-cell"><div class="${cc}" ${ce}>${cellContent}</div></div>`;
            }
            document.getElementById('cal-grid-days').innerHTML=html;
            document.getElementById('cal-stat-month').innerText=`이번 달 ${mc}일 완료 / 총 ${dim}일`;
            let st=calcCurrentStreak(cd);
            document.getElementById('cal-stat-streak').innerText=`🔥 ${st}일 연속 중!`;
            document.getElementById('cal-stat-rate').innerText=`이번 달 완료율: ${Math.round((mc/dim)*100)}%`;
            setTimeout(()=>{drawMoodGraph(calYear,calMonth,dim);renderDashboard();renderMonthlyMission();},50);
            renderBadgeList();
        }catch(e){console.error(e);}
    }
    function renderMonthlyMission(){
        const ms = `${todayObj.getFullYear()}_${todayObj.getMonth()+1}`;
        const cd = safeGetJSON('completed_dates',[]);
        let mc = 0;
        const ym = `${todayObj.getFullYear()}-${String(todayObj.getMonth()+1).padStart(2,'0')}`;
        for(let s of cd){ if(s.startsWith(ym)) mc++; }
        const memoCnt = safeGetJSON(`memo_count_${ms}`,0);
        const favCnt  = safeGetJSON('favorites',[]).length;
        const alreadyDone = safeGetJSON('earned_badges',[]).includes(`mission_${ms}`);

        // 3가지 미션 달성 체크
        const m1 = mc >= 20;
        const m2 = memoCnt >= 5;
        const m3 = favCnt >= 3;
        const doneCount = [m1,m2,m3].filter(Boolean).length;
        const pct = Math.round((doneCount/3)*100);

        const pt = document.getElementById('mission-progress-text');
        const bar = document.getElementById('mission-bar');
        const rt  = document.getElementById('mission-reward-text');
        if(!pt || !bar || !rt) return;

        pt.innerHTML =
            `${m1?'✅':'⬜'} 이번 달 20일 이상 체크 (${mc}/20일)<br>` +
            `${m2?'✅':'⬜'} 필사·일기 5번 이상 (${memoCnt}/5회)<br>` +
            `${m3?'✅':'⬜'} 즐겨찾기 3개 이상 (${favCnt}/3개)`;

        bar.style.width = pct + '%';
        bar.style.background = alreadyDone ? '#C9A84C' : 'var(--primary-color)';

        if(alreadyDone){
            rt.innerHTML = '<b style="color:#C9A84C;">🏅 이번 달 미션 완료! +10PT 수령 완료</b>';
        } else if(doneCount === 3){
            rt.innerHTML = '<b style="color:var(--primary-color);">🎉 모두 달성! 달력 탭을 다시 열면 +10PT 지급돼요</b>';
        } else {
            rt.innerHTML = `${3-doneCount}개 더 달성하면 <b style="color:var(--primary-color);">+10PT</b> 보너스!`;
        }
    }

    function renderDashboard(){
        let cd=safeGetJSON('completed_dates',[]);
        let favs=safeGetJSON('favorites',[]);
        let badge=safeGetJSON('earned_badges',[]).length;
        const et=document.getElementById('dash-total'),em=document.getElementById('dash-mood'),ef=document.getElementById('dash-fav'),eb=document.getElementById('dash-badge');
        if(et)et.innerText=cd.length;
        if(ef)ef.innerText=favs.length;
        if(eb)eb.innerText=badge;
        if(em)em.innerText=window.currentAvgMood;
    }
    function checkMissions(){
        let ms=`${todayObj.getFullYear()}_${todayObj.getMonth()+1}`;
        let cd=safeGetJSON('completed_dates',[]),mc=0;
        for(let s of cd){if(s.startsWith(`${todayObj.getFullYear()}-${todayObj.getMonth()+1}-`))mc++;}
        let memoCnt=safeGetJSON(`memo_count_${ms}`,0);
        let favCnt=safeGetJSON('favorites',[]).length;
        const m1=document.getElementById('miss-1'),m2=document.getElementById('miss-2'),m3=document.getElementById('miss-3');
        if(m1){if(mc>=20){m1.innerText='✅ 이번 달 20일 이상 체크하기';m1.classList.add('done');}else{m1.innerText=`☐ 이번 달 20일 이상 체크하기 (${mc}/20)`;m1.classList.remove('done');}}
        if(m2){if(memoCnt>=5){m2.innerText='✅ 메모 5번 이상 쓰기';m2.classList.add('done');}else{m2.innerText=`☐ 메모 5번 이상 쓰기 (${memoCnt}/5)`;m2.classList.remove('done');}}
        if(m3){if(favCnt>=3){m3.innerText='✅ 즐겨찾기 3개 이상 모으기';m3.classList.add('done');}else{m3.innerText=`☐ 즐겨찾기 3개 이상 모으기 (${favCnt}/3)`;m3.classList.remove('done');}}
        if(mc>=20&&memoCnt>=5&&favCnt>=3){let earned=safeGetJSON('earned_badges',[]),bid=`mission_${ms}`;if(!earned.includes(bid)){earned.push(bid);safeSetJSON('earned_badges',earned); addPoint(10,'월간미션완료',`monthly_${ms}`); showToast('🏅 이달의 미션 완료! +10PT 적립!'); launchConfetti(); renderBadgeList();renderDashboard();}}
    }
    function drawMoodGraph(year,month,dim){
        try{
            const canvas=document.getElementById('mood-chart');if(!canvas)return;
            const ctx=canvas.getContext('2d'),wrapper=canvas.parentElement;
            if(!wrapper||wrapper.clientWidth===0)return;
            let dpr=window.devicePixelRatio||1,w=wrapper.clientWidth,h=260;
            canvas.width=w*dpr;canvas.height=h*dpr;canvas.style.width=w+'px';canvas.style.height=h+'px';
            ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
            let bd=[],ad=[],td=0,dc2=0;
            for(let d=1;d<=dim;d++){let bs=safeGetItem(`mood_before_${year}-${month}-${d}`,null),as2=safeGetItem(`mood_after_${year}-${month}-${d}`,null);let bv=bs!==null?parseInt(bs)+1:null,av=as2!==null?parseInt(as2)+1:null;bd.push(bv);ad.push(av);if(bv!==null&&av!==null){td+=(av-bv);dc2++;}}
            let at=document.getElementById('chart-avg-text');
            if(dc2>0){let avg=(td/dc2).toFixed(1),sg=avg>0?'+':'';window.currentAvgMood=sg+avg;at.innerText=`이번 달 평균 기분 변화: ${window.currentAvgMood}단계`;}
            else{window.currentAvgMood='+0';at.innerText='이번 달 평균 기분 변화: 기록 없음';}
            const px=35,py=25,dw=w-px*2,dh=h-py*2;
            ctx.strokeStyle='#EEEEEE';ctx.lineWidth=1;ctx.fillStyle='#666666';ctx.font='16px "Malgun Gothic",sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
            for(let i=1;i<=5;i++){let y2=py+dh-((i-1)/4)*dh;ctx.beginPath();ctx.moveTo(px,y2);ctx.lineTo(w-px+20,y2);ctx.stroke();ctx.fillText(i,px-10,y2);}
            ctx.textAlign='center';ctx.textBaseline='top';
            for(let d=1;d<=dim;d++){if(d===1||d===dim||d%5===0){let x=px+((d-1)/(dim-1))*dw;ctx.fillText(d,x,py+dh+10);}}
            function dl(data,color){ctx.strokeStyle=color;ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();let st=false;for(let d=1;d<=dim;d++){if(data[d-1]!==null){let x=px+((d-1)/(dim-1))*dw,y2=py+dh-((data[d-1]-1)/4)*dh;if(!st){ctx.moveTo(x,y2);st=true;}else{ctx.lineTo(x,y2);}}}ctx.stroke();ctx.fillStyle=color;for(let d=1;d<=dim;d++){if(data[d-1]!==null){let x=px+((d-1)/(dim-1))*dw,y2=py+dh-((data[d-1]-1)/4)*dh;ctx.beginPath();ctx.arc(x,y2,4,0,2*Math.PI);ctx.fill();}}}
            dl(bd,'#4A90E2');dl(ad,'#D4A843');
        }catch(e){}
    }

    /* ===== 배지 ===== */
    function checkStreakBadges(sc){
        try{
            let earned=safeGetJSON('earned_badges',[]),ne=null;
            for(let b of BADGES){if(sc>=b.target&&!earned.includes('streak_'+b.target)){earned.push('streak_'+b.target);ne=b;}}
            if(ne){
                safeSetJSON('earned_badges',earned);
                // ★ 연속 달성 배지 → 포인트+등급 직행
                const streakRewards = {
                    100: { pts:1200, msg:'🏔️ 100일 연속! 인생2막러 등급 직행!' },
                    200: { pts:1850, msg:'☁️ 200일 연속! 라디오스타 등급 직행!' },
                    300: { pts:2390, msg:'✨ 300일 연속! 인생챔피언 직행!' },
                };
                if(streakRewards[ne.target]){
                    const rw = streakRewards[ne.target];
                    const cur = getPoints();
                    if(cur < rw.pts){
                        const diff = rw.pts - cur;
                        setPoints(rw.pts);
                        if(typeof renderPointBar==='function') renderPointBar();
                        setTimeout(()=>{ showToast(rw.msg+` +${diff}PT 지급!`); launchConfetti(); }, 500);
                    }
                }
                if(ne.target===365){switchView('completion');}
                else{
                    document.getElementById('badge-modal-icon').innerText=ne.icon;
                    document.getElementById('badge-modal-title').innerText=`${ne.target}일 스트릭 달성!`;
                    document.getElementById('badge-modal-desc').innerText=`"${ne.name}"\n진심으로 축하합니다!`;
                    document.getElementById('badge-modal').style.display='flex';
                    if(ne.target===7) { setTimeout(showSubscribeNudge,600); }
                }
            }
        }catch(e){}
    }
    window.closeBadgeModal=function(){document.getElementById('badge-modal').style.display='none';}
    function showInsightIfNeeded(len){if(len>0&&len%3===0){let ls=safeGetItem('insight_last_shown',''),ts=getTodayStr();if(ls!==ts){let rn=Math.floor(Math.random()*INSIGHTS.length);document.getElementById('insight-desc').innerText=`"${INSIGHTS[rn]}"`;document.getElementById('insight-modal').style.display='flex';safeSetItem('insight_last_shown',ts);}}}
    function renderBadgeList(){
        try{
            let earned=safeGetJSON('earned_badges',[]),html='';
            for(let b of BADGES){let ie=earned.includes('streak_'+b.target),cls=ie?'badge-item earned':'badge-item locked';if(b.target===365)cls+=' full-width';html+=`<div class="${cls}"><div class="badge-icon">${b.icon}</div><div class="badge-days">${b.target}일 연속 달성</div><div class="badge-name">${b.name}</div></div>`;}
            // ★ 긍정 변화 배지
            html += '<div style="grid-column:1/-1;font-size:14px;font-weight:700;color:var(--primary-color);margin-top:14px;margin-bottom:4px;white-space:nowrap;">😊 기분 상승 배지 <span style="font-weight:500;font-size:12px;">(30일 연속 달성 시 +10PT!)</span></div>';
            for(let b of MOOD_RISE_BADGES){
                let ie=earned.includes(`mood_rise_${b.days}`),cls=ie?'badge-item earned':'badge-item locked';
                html+=`<div class="${cls}"><div class="badge-icon">${b.icon}</div><div class="badge-days">${b.days}일 연속 상승</div><div class="badge-name">${b.label.replace(/\d+일 연속 /,'')}</div></div>`;
            }
            let ms=`${todayObj.getFullYear()}_${todayObj.getMonth()+1}`;
            if(earned.includes(`mission_${ms}`))html+=`<div class="badge-item earned full-width" style="margin-top:10px;"><div class="badge-icon">🏅</div><div class="badge-days">이달의 미션 클리어</div><div class="badge-name">이번 달을 훌륭하게 보내셨습니다!</div></div>`;
            document.getElementById('badge-list-container').innerHTML=html;
        }catch(e){}
    }
    window.shareSNS=function(){if(navigator.share){navigator.share({title:'품속 완주!',text:'제가 매일 꾸준히 365일 확언을 완주했습니다. 함께 긍정의 힘을 채워보세요! 🌱'}).catch(e=>{});}else{alert('완주를 축하합니다!');}}

    /* ===== ★ 7단계: 메모(필사) + 일기장 ===== */

    // ---- 필사 탭 ----
    window.switchMemoTab = function(tab){
        document.getElementById('memo-tab-a').className = 'tab-btn' + (tab==='write'?' active':'');
        document.getElementById('memo-tab-c').className = 'tab-btn' + (tab==='free'?' active':'');
        document.getElementById('memo-tab-d').className = 'tab-btn' + (tab==='letter'?' active':'');
        document.getElementById('memo-tab-b').className = 'tab-btn' + (tab==='diary'?' active':'');
        document.getElementById('memo-write-view').style.display  = tab==='write'?'block':'none';
        document.getElementById('memo-free-view').style.display   = tab==='free'?'block':'none';
        document.getElementById('memo-letter-view').style.display = tab==='letter'?'block':'none';
        document.getElementById('memo-diary-view').style.display  = tab==='diary'?'block':'none';
        if(tab==='write')  initMemoWrite();
        if(tab==='free')   initFreeNote();
        if(tab==='letter') initLetterView();
        if(tab==='diary')  initDiary();
    }

    // ---- 자유메모 ----
    function initFreeNote(){
        const body = document.getElementById('free-note-body');
        if(body){
            body.oninput = ()=>{
                document.getElementById('free-note-count').textContent = body.value.length + '자';
            };
        }
        renderFreeNoteList();
    }

    window.saveFreeNote = function(){
        const title = document.getElementById('free-note-title').value.trim();
        const body  = document.getElementById('free-note-body').value.trim();
        if(!body){ showToast('내용을 입력해주세요!'); return; }
        const notes = safeGetJSON('free_notes',[]);
        notes.unshift({ id: Date.now(), title: title||'제목 없음', body: body, date: getTodayStr() });
        safeSetJSON('free_notes', notes);
        document.getElementById('free-note-title').value = '';
        document.getElementById('free-note-body').value = '';
        document.getElementById('free-note-count').textContent = '0자';
        showToast('📌 메모가 저장됐어요!');
        renderFreeNoteList();
    }

    function renderFreeNoteList(){
        const notes = safeGetJSON('free_notes',[]);
        const el = document.getElementById('free-note-list');
        if(!notes.length){
            el.innerHTML = '<div style="text-align:center;color:#aaa;padding:30px;font-size:18px;">아직 저장된 메모가 없어요 📌</div>';
            return;
        }
        el.innerHTML = notes.map((n,i)=>`
            <div class="memo-card" onclick="expandFreeNote(${i})" id="free-card-${i}">
                <div class="memo-card-top">
                    <div class="memo-card-meta">
                        <span class="memo-card-day">${n.date}</span>
                    </div>
                    <button class="memo-card-del" onclick="event.stopPropagation();deleteFreeNote(${i})">삭제</button>
                </div>
                <div style="font-size:18px;font-weight:bold;color:var(--primary-color);margin-bottom:5px;">${n.title}</div>
                <div class="memo-card-text" id="free-body-${i}" style="max-height:60px;overflow:hidden;transition:max-height 0.3s;">${n.body}</div>
                <div style="font-size:15px;color:#aaa;margin-top:4px;" id="free-more-${i}">${n.body.length>80?'▼ 더 보기':''}</div>
            </div>`).join('');
    }

    window.expandFreeNote = function(i){
        const bodyEl = document.getElementById(`free-body-${i}`);
        const moreEl = document.getElementById(`free-more-${i}`);
        if(!bodyEl) return;
        if(bodyEl.style.maxHeight === '60px' || bodyEl.style.maxHeight === ''){
            bodyEl.style.maxHeight = '1000px';
            if(moreEl) moreEl.textContent = '▲ 접기';
        } else {
            bodyEl.style.maxHeight = '60px';
            const notes = safeGetJSON('free_notes',[]);
            if(moreEl) moreEl.textContent = notes[i]&&notes[i].body.length>80 ? '▼ 더 보기' : '';
        }
    }

    window.deleteFreeNote = function(i){
        const notes = safeGetJSON('free_notes',[]);
        notes.splice(i,1);
        safeSetJSON('free_notes', notes);
        renderFreeNoteList();
        showToast('삭제됐어요');
    }

    function initMemoWrite(){
        // 오늘 확언 표시
        const affirmEl = document.getElementById('affirmation-text');
        const el = document.getElementById('memo-today-affirmation');
        if(affirmEl && !affirmEl.closest('.blurred-content')){
            el.textContent = affirmEl.innerText;
        } else {
            // 데이터에서 직접 가져오기
            const dc = getDayCountNow();
            const data = affirmationsData[(dc-1)%affirmationsData.length];
            el.textContent = data.text;
        }
        // 입력창 글자수
        const input = document.getElementById('memo-input');
        input.addEventListener('input', ()=>{
            document.getElementById('memo-char-count').textContent = input.value.length + '자';
        });
        renderMemoList();
    }

    window.saveMemo = function(){
        const input = document.getElementById('memo-input');
        const text = input.value.trim();
        if(!text){ showToast('내용을 입력해주세요!'); return; }

        // 확언 글자 수의 80% 이상 입력해야 완료
        const affirmEl = document.getElementById('memo-today-affirmation');
        if(affirmEl && affirmEl.textContent && affirmEl.textContent !== '확언을 불러오는 중...'){
            const affirmLen = affirmEl.textContent.replace(/\s/g,'').length;
            const inputLen  = text.replace(/\s/g,'').length;
            const required  = Math.floor(affirmLen * 0.8);
            if(inputLen < required){
                showToast(`조금 더 써보세요! 확언의 80% 이상 써야 저장돼요 (${inputLen}/${affirmLen}자)`);
                return;
            }
        }
        addPoint(1,'필사','memo');
        setTimeout(renderShortsPointSummary, 200);
        const memos = safeGetJSON('memos', []);
        memos.unshift({ date: getTodayStr(), text: text, ts: Date.now() });
        safeSetJSON('memos', memos);
        input.value = '';
        document.getElementById('memo-char-count').textContent = '0자';
        showToast('✏️ 필사가 저장됐어요!');
        // 미션 카운트
        let y=todayObj.getFullYear(),m=todayObj.getMonth()+1;
        safeSetJSON(`memo_count_${y}_${m}`, safeGetJSON(`memo_count_${y}_${m}`,0)+1);
        checkMissions(); renderDashboard();
        renderMemoList();
    }

    function renderMemoList(){
        const memos = safeGetJSON('memos', []);
        const el = document.getElementById('memo-list');
        if(!memos.length){
            el.innerHTML = '<div style="text-align:center;color:#aaa;padding:30px;font-size:18px;">아직 필사 기록이 없어요 ✏️</div>';
            return;
        }
        el.innerHTML = memos.map((m,i)=>`
            <div class="memo-card">
                <button class="memo-card-del" onclick="deleteMemo(${i})">삭제</button>
                <div class="memo-card-date">${m.date}</div>
                <div class="memo-card-text">${m.text}</div>
            </div>`).join('');
    }

    window.deleteMemo = function(i){
        const memos = safeGetJSON('memos',[]);
        memos.splice(i,1);
        safeSetJSON('memos', memos);
        renderMemoList();
        showToast('삭제됐어요');
    }

    // ---- 일기장 + PIN ----
    let pinBuffer = '';
    let pinMode = 'check'; // 'check' | 'set' | 'confirm'
    let pinTemp = '';
    let diaryUnlocked = false;

    function initDiary(){
        diaryUnlocked = false;
        const hasPin = safeGetItem('diary_pin', null);
        document.getElementById('diary-lock-screen').style.display = 'block';
        document.getElementById('diary-content-screen').style.display = 'none';
        pinBuffer = ''; pinTemp = '';
        updatePinDots();
        buildPinPad();
        // 힌트 영역 초기화
        const hintTxt = document.getElementById('pin-hint-text');
        if(hintTxt) hintTxt.style.display = 'none';
        document.getElementById('pin-hint-input-area').style.display = 'none';
        if(!hasPin){
            pinMode = 'set';
            document.getElementById('diary-lock-title').textContent = '일기장 비밀번호 설정';
            document.getElementById('diary-lock-sub').textContent = '처음 사용이에요. 4자리 PIN을 설정해주세요.';
            document.getElementById('pin-hint-area').style.display = 'none';
            document.getElementById('pin-hint-input-area').style.display = 'block';
        } else {
            pinMode = 'check';
            document.getElementById('diary-lock-title').textContent = '🔒 비밀번호를 입력하세요';
            document.getElementById('diary-lock-sub').textContent = '';
            document.getElementById('pin-hint-area').style.display = 'block';
            renderPinHintArea();
        }
    }

    window.showPinHint = function(){
        const hint = safeGetItem('diary_pin_hint','');
        const el = document.getElementById('pin-hint-text');
        if(!el) return;
        el.textContent = hint ? '💡 힌트: ' + hint : '설정된 힌트가 없어요.';
        el.style.display = 'block';
    }

    function renderPinHintArea(){
        const hint = safeGetItem('diary_pin_hint','');
        const showSec   = document.getElementById('hint-show-section');
        const setSec    = document.getElementById('hint-set-section');
        const resetSec  = document.getElementById('reset-confirm-section');
        const forgetSec = document.getElementById('forget-pin-section');
        const hintTxt   = document.getElementById('pin-hint-text');
        const inline    = document.getElementById('pin-hint-inline');
        if(resetSec)  resetSec.style.display  = 'none';
        if(hintTxt)   hintTxt.style.display   = 'none';
        if(inline)    inline.style.display    = 'none';
        if(hint){
            if(showSec) showSec.style.display = 'block';
            if(setSec)  setSec.style.display  = 'none';
        } else {
            if(showSec) showSec.style.display = 'none';
            if(setSec)  setSec.style.display  = 'block';
        }
        if(forgetSec) forgetSec.style.display = 'block';
    }

    window.toggleHintInput = function(){
        const el = document.getElementById('pin-hint-inline');
        if(el) el.style.display = el.style.display==='none' ? 'block' : 'none';
    }

    window.saveQuickHint = function(){
        const val = document.getElementById('pin-hint-quick').value.trim();
        if(!val){ showToast('힌트를 입력해주세요'); return; }
        safeSetItem('diary_pin_hint', val);
        showToast('💡 힌트가 저장됐어요!');
        renderPinHintArea();
    }

    window.resetPin = function(){
        const hint = safeGetItem('diary_pin_hint','');
        const showSec   = document.getElementById('hint-show-section');
        const setSec    = document.getElementById('hint-set-section');
        const resetSec  = document.getElementById('reset-confirm-section');
        const forgetSec = document.getElementById('forget-pin-section');
        const preview   = document.getElementById('reset-hint-preview');
        if(preview) preview.innerHTML = hint
            ? `<div style="font-size:17px;color:var(--primary-color);font-weight:bold;background:#FFF8E7;padding:10px 14px;border-radius:10px;border:1px solid var(--accent-color);margin-bottom:12px;">💡 힌트: ${hint}</div>`
            : '';
        if(showSec)   showSec.style.display   = 'none';
        if(setSec)    setSec.style.display    = 'none';
        if(forgetSec) forgetSec.style.display = 'none';
        if(resetSec)  resetSec.style.display  = 'block';
    }

    window.hideResetConfirm = function(){
        const resetSec = document.getElementById('reset-confirm-section');
        if(resetSec) resetSec.style.display = 'none';
        renderPinHintArea();
    }

    window.confirmResetPin = function(){
        safeSetItem('diary_pin','');
        safeSetItem('diary_pin_hint','');
        pinBuffer = ''; pinTemp = '';
        pinMode = 'set';
        document.getElementById('pin-hint-area').style.display = 'none';
        document.getElementById('pin-hint-input-area').style.display = 'block';
        const inp = document.getElementById('pin-hint-input');
        if(inp) inp.value = '';
        document.getElementById('diary-lock-title').textContent = '새 비밀번호 설정';
        document.getElementById('diary-lock-sub').textContent = '새로 사용할 4자리 비밀번호를 입력하세요.';
        updatePinDots();
        showToast('비밀번호가 초기화됐어요. 새로 설정해주세요.');
    }

    window.changePinMode = function(){
        // 일기 잠금 후 비밀번호 변경 모드로 진입
        diaryUnlocked = false;
        pinBuffer = ''; pinTemp = '';
        pinMode = 'set';
        document.getElementById('diary-content-screen').style.display = 'none';
        document.getElementById('diary-lock-screen').style.display = 'block';
        document.getElementById('diary-lock-title').textContent = '🔑 새 비밀번호 설정';
        document.getElementById('diary-lock-sub').textContent = '새로 사용할 4자리 비밀번호를 입력하세요.';
        document.getElementById('pin-hint-area').style.display = 'none';
        document.getElementById('pin-hint-input-area').style.display = 'block';
        document.getElementById('pin-hint-input').value = safeGetItem('diary_pin_hint','');
        updatePinDots();
        buildPinPad();
    }

    function buildPinPad(){
        const pad = document.getElementById('pin-pad');
        const nums = [1,2,3,4,5,6,7,8,9,'',0,'←'];
        pad.innerHTML = nums.map(n => {
            if(n==='') return '<div></div>';
            if(n==='←') return `<button class="pin-key" onclick="clearPin()">←</button>`;
            return `<button class="pin-key" onclick="inputPin(${n})">${n}</button>`;
        }).join('');
    }

    window.inputPin = function(n){
        if(pinBuffer.length >= 4) return;
        pinBuffer += n;
        updatePinDots();
        if(pinBuffer.length === 4) setTimeout(processPinInput, 200);
    }

    window.clearPin = function(){
        pinBuffer = pinBuffer.slice(0,-1);
        updatePinDots();
    }

    function updatePinDots(){
        document.querySelectorAll('.pin-dot').forEach((dot,i)=>{
            dot.classList.toggle('filled', i < pinBuffer.length);
        });
    }

    function processPinInput(){
        const hasPin = safeGetItem('diary_pin', null);
        if(pinMode === 'set'){
            pinTemp = pinBuffer;
            pinBuffer = '';
            updatePinDots();
            pinMode = 'confirm';
            document.getElementById('diary-lock-title').textContent = 'PIN 확인';
            document.getElementById('diary-lock-sub').textContent = '같은 PIN을 한 번 더 입력하세요.';
            document.getElementById('pin-hint-input-area').style.display = 'none';
        } else if(pinMode === 'confirm'){
            if(pinBuffer === pinTemp){
                safeSetItem('diary_pin', pinBuffer);
                // 힌트 저장
                const hintEl = document.getElementById('pin-hint-input');
                if(hintEl && hintEl.value.trim()){
                    safeSetItem('diary_pin_hint', hintEl.value.trim());
                } else {
                    safeSetItem('diary_pin_hint', '');
                }
                showToast('🔓 비밀번호가 설정됐어요!');
                openDiaryContent();
            } else {
                pinBuffer = ''; pinTemp = '';
                updatePinDots();
                pinMode = 'set';
                document.getElementById('diary-lock-title').textContent = '다시 설정해요';
                document.getElementById('diary-lock-sub').textContent = 'PIN이 달라요. 다시 설정해주세요.';
                document.getElementById('pin-hint-input-area').style.display = 'block';
                showToast('PIN이 일치하지 않아요');
            }
        } else {
            if(pinBuffer === hasPin){
                openDiaryContent();
            } else {
                pinBuffer = '';
                updatePinDots();
                document.getElementById('diary-lock-sub').textContent = '❌ 틀렸어요. 다시 입력해주세요.';
                showToast('PIN이 틀렸어요');
            }
        }
    }

    function openDiaryContent(){
        diaryUnlocked = true;
        document.getElementById('diary-lock-screen').style.display = 'none';
        document.getElementById('diary-content-screen').style.display = 'block';
        // 달력 초기화
        diaryCalYear  = todayObj.getFullYear();
        diaryCalMonth = todayObj.getMonth() + 1;
        selectedDiaryDate = getTodayStr();
        renderDiaryCal();
        loadDiaryForDate(selectedDiaryDate);
        // 글자수 카운터
        document.getElementById('diary-input').addEventListener('input', function(){
            document.getElementById('diary-char-count').textContent = this.value.length + '자';
        });
    }

    // ---- 일기 달력 ----
    let diaryCalYear  = todayObj.getFullYear();
    let diaryCalMonth = todayObj.getMonth() + 1;
    let selectedDiaryDate = getTodayStr();

    function renderDiaryCal(){
        const y = diaryCalYear, m = diaryCalMonth;
        document.getElementById('diary-cal-title').textContent = `${y}년 ${m}월`;
        const fd   = new Date(y, m-1, 1).getDay();
        const dim  = new Date(y, m, 0).getDate();
        const grid = document.getElementById('diary-cal-grid');
        if(!grid) return;

        let html = '';
        for(let i=0; i<fd; i++) html += '<div></div>';

        for(let d=1; d<=dim; d++){
            const ds   = `${y}-${m}-${d}`;
            const txt  = safeGetItem(`diary_${ds}`, null);
            const hasDiary = txt && txt.trim();
            const isToday2 = (ds === getTodayStr());
            const isSelected = (ds === selectedDiaryDate);

            let bg    = 'transparent';
            let color = 'var(--text-muted)';
            let dot   = '';

            if(isSelected){
                bg    = 'var(--primary-color)';
                color = '#FFFFFF';
            } else if(isToday2){
                bg    = '#E8F0E9';
                color = 'var(--primary-color)';
            }

            if(hasDiary && !isSelected){
                dot = `<div style="width:5px;height:5px;border-radius:50%;background:var(--accent-color);margin:1px auto 0;"></div>`;
            } else if(hasDiary && isSelected){
                dot = `<div style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.7);margin:1px auto 0;"></div>`;
            }

            html += `<div onclick="selectDiaryDate('${ds}')" style="cursor:pointer;padding:5px 2px;border-radius:8px;background:${bg};">
                <div style="font-size:0.82em;font-weight:600;color:${color};">${d}</div>
                ${dot || '<div style="height:6px;"></div>'}
            </div>`;
        }
        grid.innerHTML = html;
    }

    window.diaryCalPrev = function(){
        diaryCalMonth--;
        if(diaryCalMonth < 1){ diaryCalMonth = 12; diaryCalYear--; }
        renderDiaryCal();
    }
    window.diaryCalNext = function(){
        diaryCalMonth++;
        if(diaryCalMonth > 12){ diaryCalMonth = 1; diaryCalYear++; }
        renderDiaryCal();
    }

    window.selectDiaryDate = function(ds){
        selectedDiaryDate = ds;
        renderDiaryCal();
        loadDiaryForDate(ds);
    }

    function loadDiaryForDate(ds){
        const parts = ds.split('-');
        const label = `${parts[0]}년 ${parseInt(parts[1])}월 ${parseInt(parts[2])}일 일기`;
        document.getElementById('diary-date-label').textContent = label;
        const saved = safeGetItem(`diary_${ds}`, '');
        const input = document.getElementById('diary-input');
        input.value = saved;
        document.getElementById('diary-char-count').textContent = saved.length + '자';
        // 저장 버튼이 현재 날짜를 참조하도록
        input.dataset.targetDate = ds;
    }

    window.lockDiary = function(){
        diaryUnlocked = false;
        initDiary();
    }

    window.saveDiary = function(){
        if(!diaryUnlocked) return;
        const input = document.getElementById('diary-input');
        const targetDate = input.dataset.targetDate || getTodayStr();
        safeSetItem(`diary_${targetDate}`, input.value);
        addPoint(1,'일기','diary');
        showToast('일기가 저장됐어요');
        renderDiaryCal(); // 달력에 점 업데이트
    }

    function renderDiaryList(){
        const entries = [];
        for(let i=0;i<30;i++){
            const d = new Date(todayObj);
            d.setDate(d.getDate()-i);  // 오늘(i=0)부터 포함
            const ds = getFormatDate(d);
            const txt = safeGetItem(`diary_${ds}`, null);
            if(txt && txt.trim()) entries.push({date:ds, text:txt, isToday: i===0});
        }
        const el = document.getElementById('diary-list');
        if(!entries.length){
            el.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px;font-size:18px;">아직 저장된 일기가 없어요 📖</div>';
            return;
        }
        el.innerHTML = entries.map(e=>`
            <div class="memo-card">
                <div class="memo-card-date">${e.isToday ? '오늘 · ' : ''}${e.date}</div>
                <div class="memo-card-text" style="max-height:80px;overflow:hidden;">
                    ${e.text.substring(0,80)}${e.text.length>80?'...':''}
                </div>
            </div>`).join('');
    }

    // switchView에서 메모 탭 초기화 완료 (위의 switchView 함수 내부에 통합됨)

    /* ===== ★ 9-3단계: 통계 강화 ===== */
    function renderEnhancedStats(){
        const cd = safeGetJSON('completed_dates',[]);
        if(!cd.length){
            ['stat-total-days','stat-best-streak','stat-mood-up-days','stat-fav-count',
             'weekday-chart','theme-rank-list','mood-rise-stats'].forEach(id=>{
                const el=document.getElementById(id);
                if(el) el.innerHTML='';
            });
            return;
        }

        // ① 4개 요약 카드
        const totalDays = cd.length;
        // 최장 스트릭 계산
        const sortedDates = [...cd].sort();
        let bestStreak=0, curStreak=1;
        for(let i=1;i<sortedDates.length;i++){
            const prev=new Date(sortedDates[i-1]);
            const cur=new Date(sortedDates[i]);
            const diff=(cur-prev)/86400000;
            if(diff===1){ curStreak++; bestStreak=Math.max(bestStreak,curStreak); }
            else curStreak=1;
        }
        bestStreak=Math.max(bestStreak,curStreak);
        // 기분 상승 일수
        let moodUpDays=0;
        cd.forEach(ds=>{
            const b=safeGetItem(`mood_before_${ds}`,null);
            const a=safeGetItem(`mood_after_${ds}`,null);
            if(b!==null&&a!==null&&parseInt(a)>parseInt(b)) moodUpDays++;
        });
        const favCount = safeGetJSON('favorites',[]).length;

        const cards=[
            {id:'stat-total-days',   val:totalDays,   label:'총 완료 일수', unit:'일'},
            {id:'stat-best-streak',  val:bestStreak,  label:'최장 연속 달성', unit:'일'},
            {id:'stat-mood-up-days', val:moodUpDays,  label:'기분 상승 일수', unit:'일'},
            {id:'stat-fav-count',    val:favCount,    label:'즐겨찾기 확언', unit:'개'},
        ];
        cards.forEach(c=>{
            const el=document.getElementById(c.id);
            if(el) el.innerHTML=`<div class="stat-val">${c.val}<span style="font-size:18px;">${c.unit}</span></div><div class="stat-label">${c.label}</div>`;
        });

        // ② 요일별 완료 패턴
        const weekCounts=[0,0,0,0,0,0,0];
        cd.forEach(ds=>{
            const parts=ds.split('-');
            const d=new Date(parts[0],parts[1]-1,parts[2]);
            weekCounts[d.getDay()]++;
        });
        const maxW=Math.max(...weekCounts,1);
        const wEl=document.getElementById('weekday-chart');
        if(wEl){
            wEl.innerHTML=weekCounts.map((cnt,i)=>{
                const pct=Math.round((cnt/maxW)*80);
                const color=i===0?'#D32F2F':i===6?'#4A90E2':'var(--primary-color)';
                return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;">
                    <span style="font-size:14px;color:#666;font-weight:bold;">${cnt}</span>
                    <div style="width:100%;max-width:36px;height:${pct}px;background:${color};border-radius:6px 6px 0 0;opacity:0.85;min-height:4px;"></div>
                </div>`;
            }).join('');
        }

        // ③ 테마별 랭킹
        const themeCounts={};
        cd.forEach(ds=>{
            const parts=ds.split('-');
            const dayOfYear=Math.floor((new Date(parts[0],parts[1]-1,parts[2])-new Date(parts[0],0,1))/86400000)+1;
            const data=affirmationsData[(dayOfYear-1)%affirmationsData.length];
            if(data) themeCounts[data.theme]=(themeCounts[data.theme]||0)+1;
        });
        const sortedThemes=Object.entries(themeCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
        const maxT=sortedThemes[0]?sortedThemes[0][1]:1;
        const tEl=document.getElementById('theme-rank-list');
        if(tEl){
            tEl.innerHTML=sortedThemes.length
                ? sortedThemes.map(([theme,cnt],i)=>`
                    <div style="margin-bottom:10px;">
                        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;margin-bottom:4px;">
                            <span style="color:var(--primary-color);">${i+1}. ${theme}</span>
                            <span style="color:#888;">${cnt}일</span>
                        </div>
                        <div style="background:#E8E5E0;border-radius:6px;height:10px;">
                            <div style="background:var(--accent-color);border-radius:6px;height:10px;width:${Math.round(cnt/maxT*100)}%;"></div>
                        </div>
                    </div>`).join('')
                : '<div style="color:#aaa;font-size:17px;">아직 데이터가 없어요</div>';
        }

        // ④ 기분 상승 통계
        const totalWithMood = cd.filter(ds=>
            safeGetItem(`mood_before_${ds}`,null)!==null &&
            safeGetItem(`mood_after_${ds}`,null)!==null
        ).length;
        const upRate = totalWithMood ? Math.round(moodUpDays/totalWithMood*100) : 0;
        const mEl=document.getElementById('mood-rise-stats');
        if(mEl){
            mEl.innerHTML=`
                <div style="display:flex;gap:12px;margin-bottom:12px;">
                    <div style="flex:1;background:#F0F7F4;border-radius:12px;padding:14px;text-align:center;">
                        <div style="font-size:26px;font-weight:bold;color:var(--primary-color);">${upRate}%</div>
                        <div style="font-size:15px;color:#666;font-weight:bold;margin-top:4px;">확언 후 기분 상승률</div>
                    </div>
                    <div style="flex:1;background:#FFF8E7;border-radius:12px;padding:14px;text-align:center;">
                        <div style="font-size:26px;font-weight:bold;color:var(--primary-color);">${totalWithMood}</div>
                        <div style="font-size:15px;color:#666;font-weight:bold;margin-top:4px;">기분 기록 일수</div>
                    </div>
                </div>
                <div style="background:#E8E5E0;border-radius:8px;height:14px;">
                    <div style="background:linear-gradient(90deg,var(--primary-color),#52B788);border-radius:8px;height:14px;width:${upRate}%;transition:width 0.8s;"></div>
                </div>
                <div style="font-size:15px;color:#888;margin-top:6px;text-align:right;">${moodUpDays}/${totalWithMood}일 상승</div>`;
        }
    }
    window.openSearch = function(){
        const modal = document.getElementById('search-modal');
        modal.style.display = 'block';
        setTimeout(()=> document.getElementById('search-input').focus(), 100);
        document.getElementById('search-results').innerHTML =
            '<div style="text-align:center;color:#aaa;padding:40px 0;font-size:18px;">검색어를 입력하세요 🔍</div>';
    }

    window.closeSearch = function(){
        document.getElementById('search-modal').style.display = 'none';
        document.getElementById('search-input').value = '';
        document.getElementById('search-results').innerHTML = '';
    }

    window.doSearch = function(query){
        const q = query.trim();
        const el = document.getElementById('search-results');
        if(!q){
            el.innerHTML = '<div style="text-align:center;color:#aaa;padding:40px 0;font-size:18px;">검색어를 입력하세요 🔍</div>';
            return;
        }
        const kw = q.toLowerCase();
        const results = affirmationsData.filter(d=>
            d.text.toLowerCase().includes(kw) ||
            d.theme.toLowerCase().includes(kw) ||
            d.action.toLowerCase().includes(kw)
        );
        if(!results.length){
            el.innerHTML = '<div style="text-align:center;color:#aaa;padding:40px 0;font-size:18px;">검색 결과가 없어요 😢<br><span style="font-size:16px;">다른 키워드로 찾아보세요</span></div>';
            return;
        }
        // 결과 렌더링 — 검색어 하이라이트 포함
        function highlight(text){
            return text.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
                '<mark style="background:#FFF8E7;color:var(--primary-color);border-radius:3px;padding:0 2px;">$1</mark>');
        }
        el.innerHTML = `<div style="font-size:16px;color:#888;margin-bottom:14px;font-weight:bold;">${results.length}개 발견</div>` +
        results.map(d=>{
            const textMatched   = d.text.toLowerCase().includes(kw);
            const themeMatched  = d.theme.toLowerCase().includes(kw);
            const actionMatched = d.action.toLowerCase().includes(kw);

            // 행동 지침이 매칭됐으면 표시
            const actionHtml = actionMatched ? `
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid #F0EDE8;">
                    <div style="font-size:11px;color:var(--accent-color);font-weight:700;letter-spacing:0.8px;margin-bottom:4px;">행동 지침에서 일치</div>
                    <div style="font-size:15px;color:#666;line-height:1.6;">${highlight(d.action.length>80 ? d.action.substring(0,80)+'...' : d.action)}</div>
                </div>` : '';

            return `
            <div onclick="goToSearchResult(${d.day})" style="background:#FFFFFF;border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid #E8E5E0;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.boxShadow='none'">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-size:15px;color:var(--accent-color);font-weight:bold;">${highlight(d.theme)}</span>
                    <span style="font-size:15px;color:#aaa;font-weight:bold;">Day ${d.day}</span>
                </div>
                <div style="font-size:17px;color:#333;line-height:1.6;">${highlight(d.text.length>80 ? d.text.substring(0,80)+'...' : d.text)}</div>
                ${actionHtml}
            </div>`;
        }).join('');
    }

    window.goToSearchResult = function(dayNum){
        closeSearch();
        // dayNum에 해당하는 날짜로 이동
        if(currentMode === 'A'){
            const minA = new Date(todayObj.getFullYear(),0,1);
            const target = new Date(minA.getTime() + (dayNum-1)*86400000);
            if(target <= todayObj){
                selectedDateObj = target;
                switchView('home');
                return;
            }
        } else {
            const ss = safeGetItem('start_date_B', null);
            if(ss){
                const pts = ss.split('-');
                const minB = new Date(pts[0], pts[1]-1, pts[2]);
                const target = new Date(minB.getTime() + (dayNum-1)*86400000);
                if(target <= todayObj){
                    selectedDateObj = target;
                    switchView('home');
                    return;
                }
            }
        }
        // 미래 날짜인 경우 확언만 미리보기 (토스트)
        const data = affirmationsData[(dayNum-1) % affirmationsData.length];
        showToast(`Day ${dayNum}: ${data.theme}`);
        switchView('home');
    }
    /* ===== 앱 공유하기 ===== */
    /* ===== PWA 홈화면 설치 ===== */
    let pwaInstallPrompt = null;

    window.addEventListener('beforeinstallprompt', (e)=>{
        e.preventDefault();
        pwaInstallPrompt = e;
        // 버튼을 이미 눌렀는데 이벤트가 늦게 왔으면 즉시 설치창 실행
        if(window._pendingInstallClick){
            window._pendingInstallClick = false;
            installFromPrompt();
            return;
        }
        // 첫 방문 설치 팝업 버튼 업데이트
        const btn = document.getElementById('install-pwa-btn');
        if(btn){
            btn.textContent = '📲 홈화면에 앱 설치하기';
            btn.style.background = '#1B4332';
            btn.onclick = installFromPrompt;
        }
        // 공유 모달이 열려있으면 즉시 설치 버튼 표시
        const modal = document.getElementById('share-app-modal');
        if(modal && modal.style.display !== 'none'){
            const pwaSec = document.getElementById('pwa-install-section');
            const androidSec = document.getElementById('android-manual-section');
            if(androidSec) androidSec.style.display = 'none';
            if(pwaSec) pwaSec.style.display = 'block';
        }
    });

    window.shareApp = function(){
        const modal = document.getElementById('share-app-modal');
        modal.style.display = 'flex';

        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);
        const pwaSec = document.getElementById('pwa-install-section');
        const iosSec = document.getElementById('ios-install-section');
        const androidSec = document.getElementById('android-manual-section');
        if(pwaSec) pwaSec.style.display = 'none';
        if(iosSec) iosSec.style.display = 'none';
        if(androidSec) androidSec.style.display = 'none';

        if(pwaInstallPrompt){
            // 안드로이드 자동 설치 버튼
            if(pwaSec) pwaSec.style.display = 'block';
        } else if(isIOS){
            // 아이폰 단계 안내
            if(iosSec) iosSec.style.display = 'block';
        } else {
            // 안드로이드 수동 or PC - 항상 안내 표시
            if(androidSec) androidSec.style.display = 'block';
        }
    }

    window.installPWA = async function(){
        if(!pwaInstallPrompt) return;
        pwaInstallPrompt.prompt();
        const result = await pwaInstallPrompt.userChoice;
        if(result.outcome === 'accepted'){
            showToast('폰에 꺼내두기됐어요! 😊');
            pwaInstallPrompt = null;
            document.getElementById('share-app-modal').style.display = 'none';
            window._sendAppInstall(); // ★ 앱 설치 기록
        }
    }

    const APP_URL = 'https://life2radio.github.io/pumsok/';
    const KAKAO_1ON1_URL = 'https://open.kakao.com/o/sKUKl3pi';

    window.shareAppFile = function(){
        document.getElementById('share-app-modal').style.display = 'none';
        // 카카오톡 URL 스킴으로 직접 공유
        const kakaoUrl = 'kakaotalk://send?text=' + encodeURIComponent('🌿 인생2막라디오 365일 확언 앱\n홈화면에 추가하면 앱처럼 매일 열려요!\n\n👉 ' + APP_URL);
        const opened = window.open(kakaoUrl, '_blank');
        // 카톡 앱이 없거나 열리지 않으면 네이티브 공유 시트
        setTimeout(()=>{
            if(!opened || opened.closed){
                if(navigator.share){
                    navigator.share({
                        title: '품속 | 인생2막라디오',
                        text:  '🌿 매일 나를 위한 한 문장. 홈화면에 추가해서 매일 열어보세요!',
                        url:   APP_URL
                    }).catch(()=> showShareFallback());
                } else {
                    showShareFallback();
                }
            }
        }, 1500);
    }

    function showShareFallback(){
        // 링크 복사 + 안내 팝업
        copyToClipboard(APP_URL);
        const g = document.createElement('div');
        g.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
        g.innerHTML = `<div style="background:#FFFFFF;border-radius:20px;padding:28px 22px;width:88%;max-width:360px;text-align:center;">
            <div style="font-size:28px;margin-bottom:10px;">📋</div>
            <div style="font-size:1em;font-weight:700;color:#1B4332;margin-bottom:8px;">링크가 복사됐어요!</div>
            <div style="font-size:0.88em;color:#666;line-height:1.7;margin-bottom:6px;">카카오톡을 열고<br>붙여넣기 하시면 돼요</div>
            <div style="background:#F5F5F5;border-radius:10px;padding:10px;font-size:0.8em;color:#1B4332;margin-bottom:16px;word-break:break-all;">${APP_URL}</div>
            <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">확인</button>
        </div>`;
        document.body.appendChild(g);
    }

    window.shareAppLink = function(){
        addPoint(2,'앱소개공유','share_app');
        window._sendShareLog('앱링크공유');
        const url = 'https://life2radio.github.io/pumsok/';
        const text = '🌿 인생2막라디오 365일 확언 앱\n매일 나를 위한 한 문장. 무료예요 😊';
        if(navigator.share){
            navigator.share({ title:'365일 확언 | 인생2막라디오', text: text, url: url })
                .catch(()=>{ _copyUrl(url); });
        } else {
            _copyUrl(url);
        }
        document.getElementById('share-app-modal').style.display='none';
    }

    function _copyUrl(url){
        if(navigator.clipboard){
            navigator.clipboard.writeText(url).then(()=> showToast('링크가 복사됐어요! 카톡에 붙여넣기 해보세요 😊'));
        } else {
            const t = document.createElement('textarea');
            t.value = url; document.body.appendChild(t);
            t.select(); document.execCommand('copy');
            document.body.removeChild(t);
            showToast('링크가 복사됐어요! 카톡에 붙여넣기 해보세요 😊');
        }
    }

    window.shareAppMessage = function(){
        addPoint(2,'앱소개공유','share_app');
        window._sendShareLog('앱메시지공유');
        const msg = `🌿 인생2막라디오 365일 확언 앱

오늘 하루, 나를 위한 한 문장을 읽는 것부터 시작해보세요.
홈화면에 추가하면 앱처럼 매일 바로 열려요. 무료예요.

이런 분들께 딱 맞아요 💚
• 매일 나에게 좋은 말 한마디 해주고 싶은 분
• 감정 기록을 남기고 싶은 분
• 바쁜 아침에도 딱 1분이면 되는 루틴을 찾는 분

📱 주요 기능
✅ 1월~12월 365개 확언 — 매일 자동으로 바뀌어요
✅ 기분 체크 (전/후 비교) — 내 감정 변화가 보여요
✅ 소리 듣기 & 따라 읽기 — 귀로도 마음으로도 새겨요
✅ 달력 기록 — 내가 걸어온 날들이 한눈에
✅ 일기장 (비밀번호 잠금) — 나만의 비밀 공간
✅ 확언 카드 — 가족·친구에게 아침 인사로 보내요
✅ 300일 달성하면 특별한 선물이 기다려요 🎁

👉 지금 바로 열어보세요
https://life2radio.github.io/pumsok/

인생2막라디오 유튜브 채널\nhttps://www.youtube.com/@SecondActRadio`;

        if(navigator.share){
            navigator.share({
                title: '품속 | 인생2막라디오',
                text:  msg,
                url:   'https://life2radio.github.io/pumsok/'
            }).catch(()=>{ copyToClipboard(msg); showToast('소개 문구가 복사됐어요! 붙여넣기 해보세요 😊'); });
        } else {
            copyToClipboard(msg);
            showToast('소개 문구가 복사됐어요! 붙여넣기 해보세요 😊');
        }
        document.getElementById('share-app-modal').style.display = 'none';
    }
    /* ===== ② 홈 다이어리 진행바 ===== */

    // ★ 오늘의 5개 미션 체크
    function getTodayMissionStatus(){
        const today = getTodayStr();
        return {
            listen:   safeGetItem('pt_daily_listen_'+today,'')   === '1',
            stt:      safeGetItem('pt_daily_stt_'+today,'')      === '1',
            complete: safeGetItem('pt_daily_complete_'+today,'') === '1',
            moodBefore: safeGetItem('mood_before_'+today,'')     !== '',
            moodAfter:  safeGetItem('mood_after_'+today,'')      !== '',
        };
    }

    function countTodayMissions(){
        const m = getTodayMissionStatus();
        return [m.listen, m.stt, m.complete, m.moodBefore, m.moodAfter].filter(Boolean).length;
    }



    // ★ 포인트로 패자부활 (10PT = 결석 1일 삭제)
    window.reviveWithPoints = function(){
        var pts = getPoints();
        var absent = parseInt(safeGetItem('revival_absent_days','0'))||0;
        if(absent <= 0){ showToast('현재 결석이 없어요!'); return; }
        if(pts < 10){ showToast('포인트가 부족해요! (필요: 10PT, 보유: '+pts+'PT)'); return; }
        // 10PT 차감
        var currentPts = parseInt(safeGetItem('total_points','0'))||0;
        safeSetItem('total_points', String(currentPts - 10));
        // 결석 1일 삭제
        var newAbsent = Math.max(0, absent - 1);
        safeSetItem('revival_absent_days', String(newAbsent));
        showToast('✅ 10PT 사용! 결석 1일이 삭제됐어요 (남은 결석: '+newAbsent+'일)');
        renderPointBar();
        renderStreakMilestone();
    };

    window.closeMissionModal = function(){ var m=document.getElementById('mission-criteria-modal'); if(m)m.remove(); };
    window.showStreakCriteria = function(){
        const m = getTodayMissionStatus();
        const done = countTodayMissions();
        const items = [
            {label:'🔊 소리 듣기',      done: m.listen},
            {label:'🎙️ 따라 읽기',     done: m.stt},
            {label:'✅ 확언 완료 체크',  done: m.complete},
            {label:'😊 확언 전 기분 체크', done: m.moodBefore},
            {label:'💚 확언 후 기분 체크', done: m.moodAfter},
        ];
        const old = document.getElementById('mission-criteria-modal');
        if(old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'mission-criteria-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:8000;display:flex;align-items:flex-end;justify-content:center;';
        const inner = document.createElement('div');
        inner.style.cssText = 'background:var(--bg-color);border-radius:20px 20px 0 0;padding:24px 20px 44px;width:100%;max-width:600px;box-sizing:border-box;';
        inner.innerHTML =
            '<div style="font-size:1em;font-weight:700;color:var(--primary-color);margin-bottom:6px;">🔥 연속 달성 기준</div>' +
            '<div style="font-size:0.8em;color:var(--text-muted);margin-bottom:16px;line-height:1.6;">아래 5가지를 모두 완료하면 오늘의 연속 달성이 인정돼요!</div>' +
            items.map(function(it){
                return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-color);">' +
                    '<span style="font-size:1.2em;">' + (it.done ? '✅' : '⬜') + '</span>' +
                    '<span style="font-size:0.9em;color:' + (it.done ? 'var(--primary-color)' : 'var(--text-muted)') + ';font-weight:' + (it.done ? '700' : '400') + ';">' + it.label + '</span>' +
                    '</div>';
            }).join('') +
            '<div style="margin-top:16px;text-align:center;font-size:0.88em;font-weight:700;color:' + (done===5?'var(--primary-color)':'var(--accent-color)') + ';">' +
            (done===5 ? '🎉 오늘 미션 완료! 연속 달성 인정!' : done + ' / 5개 완료 — ' + (5-done) + '개 남았어요') + '</div>' +
            '<button onclick="closeMissionModal()" style="margin-top:14px;width:100%;min-height:44px;background:var(--primary-color);color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">확인</button>';
        modal.appendChild(inner);
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
    };

    function renderDailyMissionBadge(){
        const done = countTodayMissions();
        const el = document.getElementById('daily-mission-badge');
        if(!el) return;
        if(done === 5){
            el.style.display = 'block';
            el.textContent = '🎉 오늘의 미션 완료!';
            el.style.color = 'var(--primary-color)';
            el.style.fontWeight = '700';
        } else {
            el.style.display = 'block';
            el.textContent = '📋 오늘의 미션 ' + done + '/5 완료';
            el.style.color = 'var(--text-muted)';
            el.style.fontWeight = '400';
        }
    }

    function renderStreakMilestone(){
        const cd = safeGetJSON('completed_dates', []);
        const streak = calcCurrentStreak(cd);
        const today = getFormatDate(todayObj);
        const yesterday = getFormatDate(new Date(todayObj.getTime() - 86400000));

        // 결석일 계산: 연속달성 시작일부터 오늘까지 - 실제 완료일
        const absentDays = safeGetItem('revival_absent_days', null) !== null
            ? parseInt(safeGetItem('revival_absent_days', '0'))
            : 0;

        // 마일스톤 구간 결정 (각 구간 = 20% 폭)
        const milestones = [0, 7, 30, 100, 200, 300];
        const icons      = ['', '🏅', '🥈', '🏔️', '☁️', '✨'];
        let segIdx = 0;
        for(let i = 1; i < milestones.length; i++){
            if(streak < milestones[i]){ segIdx = i - 1; break; }
            if(i === milestones.length - 1) segIdx = milestones.length - 2;
        }
        const prevMile = milestones[segIdx];
        const nextMile = milestones[segIdx + 1];
        const nextIcon = icons[segIdx + 1];
        // 현재 구간 내 진행률 → 전체 바에서의 위치 (구간당 20%)
        const segPct  = (nextMile > prevMile)
            ? (streak - prevMile) / (nextMile - prevMile)
            : 1;
        const totalPct = Math.min(100, Math.round((segIdx * 20) + segPct * 20));

        // 진행바 업데이트
        const fill = document.getElementById('streak-milestone-fill');
        const lbl  = document.getElementById('streak-milestone-label');
        const nxt  = document.getElementById('streak-milestone-next');
        if(fill) fill.style.width = totalPct + '%';
        if(lbl)  lbl.textContent = '🔥 ' + streak + '일 연속 달성 중!';
        if(nxt)  nxt.textContent = Math.max(0, nextMile - streak) + '일 더! → ' + nextIcon + nextMile + '일 달성';

        // 결석 표시
        const revivalArea = document.getElementById('streak-revival-area');
        const absentEl    = document.getElementById('streak-absent-count');
        const absent = parseInt(safeGetItem('revival_absent_days', '0')) || 0;

        renderDailyMissionBadge();
        if(revivalArea){
            // ★ 스트릭 > 0 이고 완료 이력 있을 때만 결석 배너 표시
            const completedDates = safeGetJSON('completed_dates', []);
            if(absent > 0 && absent <= 10 && streak > 0 && completedDates.length > 0){
                setTimeout(function(){
                    revivalArea.style.display = 'block';
                    revivalArea.style.background = absent >= 7 ? '#FFE0E0' : '#FFF3CD';
                }, 600);
                if(absentEl) absentEl.textContent = absent;
                // 포인트 버튼 정보 업데이트
                var ptInfo = document.getElementById('revival-pt-info');
                if(ptInfo){ var p=getPoints(); ptInfo.textContent = p>=10 ? '보유 '+p+'PT (사용 가능)' : '보유 '+p+'PT — 부족'; ptInfo.style.color = p>=10 ? '' : '#E63946'; }
            } else if(absent > 10){
                // 11일 이상: 스트릭 리셋
                safeSetItem('revival_absent_days', '0');
                safeSetJSON('completed_dates', []);
                safeSetItem('streak_reset_date', getFormatDate(todayObj));
                revivalArea.style.display = 'none';
                showToast('😢 결석 11일로 스트릭이 초기화됐어요. 다시 시작해요! 🌱');
                setTimeout(function(){ renderStreakProtectHome(); }, 500);
            } else {
                revivalArea.style.display = 'none';
            }
        }
    }

    /* ===== ④ 배지 보관함 다이어리 카드 렌더링 ===== */
    function renderDiaryPromoCard(){
        const cd    = safeGetJSON('completed_dates',[]);
        const total = cd.length;
        const pct   = Math.min(Math.round(total/300*100), 100);
        const fill  = document.getElementById('diary-promo-fill');
        const prog  = document.getElementById('diary-promo-progress');
        const btnW  = document.getElementById('diary-promo-btn-wrap');
        const icon  = document.getElementById('diary-promo-icon');
        const desc  = document.getElementById('diary-promo-desc');
        if(!fill) return;

        fill.style.width = pct + '%';
        prog.textContent = `${total} / 300일`;

        if(total >= 300){
            icon.textContent = '🎉';
            desc.textContent = '300일을 달성하셨어요! 다이어리 신청 버튼을 눌러 신청해보세요.';
            btnW.innerHTML = `<button onclick="openDiaryApply()" style="background:var(--primary-color);color:var(--accent-color);border:none;border-radius:10px;padding:8px 16px;font-size:0.82em;font-weight:700;cursor:pointer;white-space:nowrap;">신청하기</button>`;
        } else if(total >= 200){
            desc.textContent = `거의 다 왔어요! 앞으로 ${300-total}일만 더하면 다이어리를 드려요 🌿`;
            btnW.innerHTML = `<div style="font-size:0.78em;color:#8B6914;font-weight:700;">${pct}% 달성</div>`;
        } else if(total >= 100){
            desc.textContent = `${300-total}일 남았어요. 꾸준히 하고 계시는 거 맞아요! 응원합니다 💚`;
            btnW.innerHTML = `<div style="font-size:0.78em;color:#8B6914;font-weight:700;">${pct}% 달성</div>`;
        } else {
            btnW.innerHTML = `<div style="font-size:0.78em;color:#8B6914;font-weight:700;">${pct}% 달성</div>`;
        }
    }
    function check300DayBanner(){
        const cd = safeGetJSON('completed_dates',[]);
        if(cd.length < 300){ document.getElementById('diary-300-banner').style.display='none'; return; }
        // 1년(365일) 안에 달성했는지 체크
        const firstDate = cd.sort()[0];
        if(!firstDate) return;
        const first = new Date(firstDate.split('-')[0], firstDate.split('-')[1]-1, firstDate.split('-')[2]);
        const daysPassed = Math.floor((todayObj - first) / 86400000);
        if(daysPassed <= 365){
            document.getElementById('diary-300-banner').style.display = 'block';
        }
    }

    window.openDiaryApply = function(){
        document.getElementById('diary-apply-modal').style.display = 'block';
        window.scrollTo(0,0);
    }

    window.submitDiaryApply = function(){
        const name    = document.getElementById('apply-name').value.trim();
        const phone   = document.getElementById('apply-phone').value.trim();
        const addr    = document.getElementById('apply-address').value.trim();
        const addr2   = document.getElementById('apply-address2').value.trim();
        const email   = document.getElementById('apply-email').value.trim();
        const inclMemo      = document.getElementById('include-memo').checked;
        const inclDiary     = document.getElementById('include-diary').checked;
        const inclAffirm    = document.getElementById('include-affirmation').checked;

        if(!name)  { showToast('이름을 입력해주세요'); return; }
        if(!phone) { showToast('연락처를 입력해주세요'); return; }
        if(!addr)  { showToast('배송 주소를 입력해주세요'); return; }

        // 데이터 수집
        const cd = safeGetJSON('completed_dates',[]).sort();
        let dataText = `[인생2막 확언 다이어리 신청]\n\n`;
        dataText += `━━━ 신청자 정보 ━━━\n`;
        dataText += `이름: ${name}\n연락처: ${phone}\n주소: ${addr} ${addr2}\n이메일: ${email||'없음'}\n`;
        dataText += `신청일: ${getTodayStr()}\n총 달성일수: ${cd.length}일\n\n`;

        // 필사 데이터
        if(inclMemo){
            const memos = safeGetJSON('memos',[]);
            if(memos.length){
                dataText += `━━━ 필사 기록 (${memos.length}개) ━━━\n`;
                memos.forEach(m=>{ dataText += `[${m.date}]\n${m.text}\n\n`; });
            }
        }

        // 일기 데이터
        if(inclDiary){
            dataText += `━━━ 일기 기록 ━━━\n`;
            for(let i=0;i<730;i++){
                const d=new Date(todayObj); d.setDate(d.getDate()-i);
                const ds=getFormatDate(d);
                const txt=safeGetItem(`diary_${ds}`,null);
                if(txt&&txt.trim()){
                    const p=ds.split('-');
                    dataText+=`[${p[0]}년 ${parseInt(p[1])}월 ${parseInt(p[2])}일]\n${txt.trim()}\n\n`;
                }
            }
        }

        // 완료 확언 목록
        if(inclAffirm){
            dataText += `━━━ 완료한 확언 (${cd.length}일) ━━━\n`;
            cd.forEach(ds=>{
                const p=ds.split('-');
                const dayNum=Math.floor((new Date(p[0],p[1]-1,p[2])-new Date(p[0],0,1))/86400000)+1;
                const data=affirmationsData[(dayNum-1)%affirmationsData.length];
                dataText+=`[${ds}] ${data?data.text.substring(0,30)+'...':''}\n`;
            });
        }

        // 이메일 전송
        const subject = encodeURIComponent(`[인생2막 다이어리 신청] ${name} · ${cd.length}일 달성`);
        const body    = encodeURIComponent(dataText);
        window.location.href = `mailto:life2radio@gmail.com?subject=${subject}&body=${body}`;

        // 신청 완료 기록
        safeSetItem('diary_applied', getTodayStr());
        showToast('📬 신청 이메일이 열렸어요! 전송 후 완료!');
        setTimeout(()=>{ document.getElementById('diary-apply-modal').style.display='none'; }, 2000);
    }
    /* ===== 가족에게 보내기 ===== */
    window.shareToFamily = function(){
        const affirmEl = document.getElementById('affirmation-text');
        if(!affirmEl || !affirmEl.innerText.trim()){
            showToast('먼저 기분을 선택해 확언을 열어주세요!'); return;
        }
        // 모달 열기
        const modal = document.getElementById('family-share-modal');
        modal.style.display = 'flex';
        // 배경 클릭 시 닫기
        modal.onclick = function(e){ if(e.target===modal) modal.style.display='none'; };
        // 이전 선택값 복원
        const savedSender   = safeGetItem('family_sender','');
        const savedReceiver = safeGetItem('family_receiver','');
        document.getElementById('fs-sender').value   = savedSender;
        document.getElementById('fs-receiver').value = savedReceiver;
        if(savedSender)   highlightChip('s', savedSender);
        if(savedReceiver) highlightChip('r', savedReceiver);
        updateFamilyPreview();
    }

    window.setFamilySender = function(val){
        document.getElementById('fs-sender').value = val;
        highlightChip('s', val);
        updateFamilyPreview();
    }
    window.setFamilyReceiver = function(val){
        document.getElementById('fs-receiver').value = val;
        highlightChip('r', val);
        updateFamilyPreview();
    }

    function highlightChip(type, val){
        document.querySelectorAll(`.fam-chip[id^="chip-${type}-"]`).forEach(el => {
            el.classList.toggle('active', el.id === `chip-${type}-${val}`);
        });
    }

    window.updateFamilyPreview = function(){
        const sender   = document.getElementById('fs-sender').value.trim()   || '나';
        const receiver = document.getElementById('fs-receiver').value.trim() || '가족';
        const affirmEl = document.getElementById('affirmation-text');
        const affirmText = affirmEl ? affirmEl.innerText.trim() : '';
        const today = getTodayStr().replace(/(\d+)-(\d+)-(\d+)/, '$1년 $2월 $3일');

        // 맺음말 카테고리별 자동 결정
        const parentWords  = ['엄마','아빠','부모님','어머니','아버지','할머니','할아버지'];
        const partnerWords = ['남편','아내','여보','자기','오빠','언니'];
        const isToParent  = parentWords.some(w => receiver.includes(w));
        const isToPartner = partnerWords.some(w => receiver.includes(w));
        const closing = isToParent  ? `오늘도 건강하세요! 사랑해요 💚`
                      : isToPartner ? `오늘도 수고해요! 사랑해 💚`
                      :               `오늘도 힘내렴! 사랑해 💚`;

        const msg = `🌿 ${today} ${receiver}에게 보내는 ${sender}의 확언이에요\n\n"${affirmText}"\n\n매일 이 확언으로 하루를 시작하고 있어 😊\n${receiver}, ${closing}\n\n— ${sender}\n\n📱 확언 앱: https://life2radio.github.io/pumsok/\n📺 인생2막라디오: https://www.youtube.com/@SecondActRadio`;
        const preview = document.getElementById('family-preview');
        if(preview) preview.value = msg;
    }

    window.sendFamilyMessage = function(){
        const sender   = document.getElementById('fs-sender').value.trim();
        const receiver = document.getElementById('fs-receiver').value.trim();
        if(!sender)  { showToast('보내는 분을 입력해주세요'); return; }
        if(!receiver){ showToast('받는 분을 입력해주세요');   return; }
        safeSetItem('family_sender',   sender);
        safeSetItem('family_receiver', receiver);
        // textarea에서 직접 편집된 내용 그대로 사용
        const msg = document.getElementById('family-preview').value.trim();
        if(!msg){ showToast('문구를 입력해주세요'); return; }
        document.getElementById('family-share-modal').style.display = 'none';
        addPoint(2,'가족공유','share_family');
        window._sendShareLog('가족공유');
        if(navigator.share){
            navigator.share({ title:`${sender}의 확언`, text: msg })
                .catch(function(e){ if(e.name!=='AbortError'){ copyToClipboard(msg); showToast('클립보드에 복사됐어요 📋'); } });
        } else {
            copyToClipboard(msg);
            showToast('클립보드에 복사됐어요 📋');
        }
        trackEvent('share_to_family');
    }

    window.shareToFamilyFromCard = function(){
        addPoint(2,'가족카드공유','share_family_card');
        window._sendShareLog('가족카드공유');
        const canvas = document.getElementById('share-canvas');
        const affirmEl = document.getElementById('affirmation-text');
        const sender   = safeGetItem('family_sender','엄마') || '엄마';
        const receiver = safeGetItem('family_receiver','우리 딸') || '우리 딸';
        const today    = getTodayStr().replace(/(\d+)-(\d+)-(\d+)/, '$1년 $2월 $3일');
        const parentWords  = ['엄마','아빠','부모님','어머니','아버지','할머니','할아버지'];
        const partnerWords = ['남편','아내','여보','자기','오빠','언니'];
        const isToParent  = parentWords.some(w => receiver.includes(w));
        const isToPartner = partnerWords.some(w => receiver.includes(w));
        const closing = isToParent  ? '오늘도 건강하세요! 사랑해요 💚'
                      : isToPartner ? '오늘도 수고해요! 사랑해 💚'
                      :               '오늘도 힘내렴! 사랑해 💚';
        const msg = '🌿 ' + today + ' ' + receiver + '에게 보내는 ' + sender + '의 확언이에요\n\n"' + (affirmEl?affirmEl.innerText.trim():'') + '"\n\n매일 이 확언으로 하루를 시작하고 있어 😊\n' + receiver + ', ' + closing + '\n\n— ' + sender + '\n\n📱 확언 앱: https://life2radio.github.io/pumsok/';

        document.getElementById('share-modal').style.display='none';

        // ① 카드 이미지 먼저 저장
        if(canvas){
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png');
            a.download = '확언카드.png';
            a.click();
        }

        // ② 0.8초 후 응원메시지 공유창
        setTimeout(function(){
            if(navigator.share){
                navigator.share({
                    title: receiver + '에게 보내는 오늘의 확언 💚',
                    text: msg
                }).catch(function(e){ if(e.name!=='AbortError') copyToClipboard(msg); });
            } else {
                copyToClipboard(msg);
                showToast('📋 응원메시지 복사됐어요! 카카오톡에 붙여넣기 하세요');
            }
        }, 800);

        showToast('📥 카드 저장 후 응원메시지 공유창이 열려요!');
        trackEvent('share_to_family_card');
    }
    function showPastMe(afterIdx){
        const EMOJIS_LIST=['😔','😐','🙂','😊','😄'];
        const box=document.getElementById('past-me-box');
        if(!box) return;
        let pastIdx=null,pastDays=0,pastDateStr='';
        for(let days of [7,14,30]){
            const d=new Date(todayObj);d.setDate(d.getDate()-days);
            const ds=getFormatDate(d),val=safeGetItem(`mood_before_${ds}`,null);
            if(val!==null){pastIdx=parseInt(val);pastDays=days;const p=ds.split('-');pastDateStr=`${parseInt(p[1])}월 ${parseInt(p[2])}일`;break;}
        }
        if(pastIdx===null){box.style.display='none';return;}
        const diff=afterIdx-pastIdx;
        const changeMap={'-4':'많이 힘드셨죠','-3':'조금 힘드셨네요','-2':'약간 낮아졌어요','-1':'조금 낮아졌어요','0':'비슷한 상태예요','1':'조금 좋아졌어요','2':'밝아지고 있어요','3':'많이 좋아지셨네요','4':'정말 많이 좋아지셨어요'};
        const msgs={positive:['당신, 지금 분명히 나아지고 있어요 🌱','확언이 조금씩 마음을 바꾸고 있어요 💚'],negative:['힘든 날이 있어도 괜찮아요. 여기 있다는 것 자체가 대단해요','오늘 여기 온 것만으로도 충분해요 💙'],same:['꾸준히 유지하고 있어요. 그것만으로도 충분해요 🌿']};
        const type=diff>0?'positive':diff<0?'negative':'same';
        const msg=msgs[type][Math.floor(Math.random()*msgs[type].length)];
        document.getElementById('past-me-emoji').textContent=EMOJIS_LIST[pastIdx];
        document.getElementById('now-me-emoji').textContent=EMOJIS_LIST[afterIdx];
        document.getElementById('past-me-date').textContent=`${pastDays}일 전 (${pastDateStr})`;
        document.getElementById('past-me-label').textContent=`${pastDays}일 전과 비교`;
        document.getElementById('past-me-change').textContent=changeMap[String(diff)]||'';
        document.getElementById('past-me-msg').textContent=msg;
        box.style.display='block';
    }

    /* ===== ② 정체성 라벨 시스템 ===== */
    const IDENTITY_LABELS=[
        {days:365,label:'인생2막의 완주자',desc:'365일을 완주한 당신. 이미 삶이 달라졌어요.'},
        {days:300,label:'흔들리지 않는 사람',desc:'300일. 웬만한 것으로는 당신을 막을 수 없어요.'},
        {days:100,label:'변화를 만드는 사람',desc:'100일 이상 꾸준히 자신을 돌본 사람이에요.'},
        {days:30,label:'나를 돌보는 사람',desc:'한 달 동안 매일 나를 위한 시간을 냈어요.'},
        {days:14,label:'습관을 만드는 사람',desc:'2주! 뇌에 새로운 회로가 생기기 시작했어요.'},
        {days:7,label:'용기 있는 시작자',desc:'7일을 해낸 당신은 이미 보통이 아니에요.'},
        {days:1,label:'오늘을 선택한 사람',desc:'오늘 확언을 선택한 당신은 이미 변화 중이에요.'},
    ];
    function renderIdentityLabel(){
        const box=document.getElementById('identity-box');
        if(!box) return;
        const cd=safeGetJSON('completed_dates',[]);
        const found=IDENTITY_LABELS.find(l=>cd.length>=l.days);
        if(!found){box.style.display='none';return;}
        const _iNick = safeGetItem('my_nickname','');
        document.getElementById('identity-label').textContent=_iNick ? `"${_iNick}님은 ${found.label}입니다"` : `"나는 ${found.label}입니다"`;
        document.getElementById('identity-desc').textContent=(_iNick ? `${_iNick}님, ` : '') + found.desc;
        box.style.display='block';
    }

    /* ===== ③ 랜덤 특별 메시지 ===== */
    const RANDOM_GIFTS=[
        {title:'🎁 오늘의 특별 확언',msg:'"나는 충분히 해왔고,\n앞으로도 충분히 할 수 있다."'},
        {title:'💌 오늘의 응원',msg:'뇌과학자들이 말해요.\n꾸준함은 재능보다 강하다고.\n\n당신이 매일 여기 오는 것, 그게 바로 그 꾸준함이에요.'},
        {title:'🌟 인생2막 메시지',msg:'"인생 2막이 두려운 건\n그만큼 소중한 것들이 많다는 증거예요."'},
        {title:'🌿 오늘의 선물',msg:'50세 이후의 뇌는\n더 깊이 생각하고 더 넓게 이해해요.\n\n당신의 나이는 강점이에요.'},
        {title:'🎊 깜짝 응원!',msg:'오늘 여기 들어온 당신에게\n조용히 박수를 보내요 👏\n\n쉽지 않은데 오셨잖아요.'},
    ];
    function checkRandomGift(){
        if(safeGetItem('last_random_gift','')=== getTodayStr()) return;
        if(Math.random()>0.2) return;
        safeSetItem('last_random_gift', getTodayStr());
        const gift=RANDOM_GIFTS[Math.floor(Math.random()*RANDOM_GIFTS.length)];
        setTimeout(()=>{
            const modal=document.createElement('div');
            modal.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#FFFFFF;border-radius:20px;padding:28px 24px;width:88%;max-width:340px;text-align:center;z-index:9997;box-shadow:0 20px 60px rgba(0,0,0,0.15);';
            modal.innerHTML=`<div style="font-size:1.1em;font-weight:700;color:var(--primary-color);margin-bottom:14px;">${gift.title}</div><div style="font-size:0.92em;color:var(--text-color);line-height:1.8;white-space:pre-wrap;margin-bottom:20px;">${gift.msg}</div><button onclick="this.parentElement.remove()" style="width:100%;min-height:48px;background:var(--primary-color);color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">감사해요 🌿</button>`;
            document.body.appendChild(modal);
            launchConfetti();
        },2000);
    }

    /* ===== ④ 미래편지 (무제한) ===== */

    let _letterOpenDate = null; // 선택된 개봉일

    function initLetterView(){
        migrateLetter(); // 기존 데이터 마이그레이션
        const input = document.getElementById('letter-input');
        if(input) input.addEventListener('input', ()=>{
            document.getElementById('letter-char-count').textContent = input.value.length + '자';
        });
        // 기본 개봉일: 1년 후
        setLetterDate(1,'year');
        showLetterList();
    }

    let _letterIsNextDay = false;
    window.setLetterDate = function(amount, unit){
        _letterIsNextDay = (unit === 'day' && amount === 1);
        const d = new Date(todayObj);
        if(unit === 'day')        d.setDate(d.getDate() + amount);
        else if(unit === 'month') d.setMonth(d.getMonth() + amount);
        else                      d.setFullYear(d.getFullYear() + amount);
        _letterOpenDate = getFormatDate(d);
        document.getElementById('letter-open-date-input').value = _letterOpenDate;
        ['ldbtn-1d','ldbtn-1m','ldbtn-3m','ldbtn-6m','ldbtn-1y'].forEach(id=>{
            document.getElementById(id)?.classList.remove('active');
        });
        const map = {'1day':'ldbtn-1d','1month':'ldbtn-1m','3month':'ldbtn-3m','6month':'ldbtn-6m','1year':'ldbtn-1y'};
        const key = amount+unit;
        if(map[key]) document.getElementById(map[key])?.classList.add('active');
    }

    window.onLetterDateChange = function(){
        const v = document.getElementById('letter-open-date-input').value;
        if(v) {
            _letterOpenDate = v;
            ['ldbtn-1m','ldbtn-3m','ldbtn-6m','ldbtn-1y'].forEach(id=>{
                document.getElementById(id)?.classList.remove('active');
            });
        }
    }

    window.showLetterWrite = function(){
        document.getElementById('letter-write-section').style.display = 'block';
        document.getElementById('letter-list-section').style.display = 'none';
        document.getElementById('letter-detail-section').style.display = 'none';
        document.getElementById('letter-input').value = '';
        document.getElementById('letter-char-count').textContent = '0자';
        setLetterDate(1,'year');
    }

    window.showLetterList = function(){
        document.getElementById('letter-write-section').style.display = 'none';
        document.getElementById('letter-list-section').style.display = 'block';
        document.getElementById('letter-detail-section').style.display = 'none';
        renderLetterList();
    }

    window.closeLetterDetail = function(){
        showLetterList();
    }

    function renderLetterList(){
        const letters = safeGetJSON('future_letters', []);
        const container = document.getElementById('letter-list-container');
        if(!container) return;

        // D-day 알림 배너 - 봉인 기간별 맞춤 알림
        const alerts = [];
        letters.forEach((lt, idx) => {
            if(lt.opened) return;
            const _od = new Date(lt.openDate);
            const _openMid = new Date(_od.getFullYear(), _od.getMonth(), _od.getDate());
            const _todayMid = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
            const daysLeft = Math.round((_openMid - _todayMid) / 86400000);
            const writtenDate = new Date(lt.writtenDate || getTodayStr());
            const totalDays = Math.ceil((new Date(lt.openDate) - writtenDate) / 86400000);

            // 봉인 기간에 따라 알림 시점 결정
            let milestones, labels;
            if(totalDays <= 2){
                // 내일 봉인: 당일 D-DAY만
                milestones = [];
                labels = [];
            } else if(totalDays <= 35){
                // 1개월 봉인: 7일 전, 하루 전
                milestones = [7, 1];
                labels = ['일주일', '하루'];
            } else if(totalDays <= 100){
                // 3개월 봉인: 한 달 전, 7일 전, 하루 전
                milestones = [30, 7, 1];
                labels = ['한 달', '일주일', '하루'];
            } else if(totalDays <= 200){
                // 6개월 봉인: 3개월 전, 7일 전, 하루 전
                milestones = [91, 7, 1];
                labels = ['3개월', '일주일', '하루'];
            } else {
                // 1년 봉인: 9개월, 6개월, 3개월, 한 달, 7일, 하루 전
                milestones = [273, 182, 91, 30, 7, 1];
                labels = ['9개월', '6개월', '3개월', '한 달', '일주일', '하루'];
            }

            milestones.forEach((m, mi) => {
                if(daysLeft === m) alerts.push({label: labels[mi], idx, daysLeft, openDate: lt.openDate});
            });
            const canOpenNow = lt.openTimestamp ? Date.now() >= lt.openTimestamp : daysLeft <= 0;
            if(canOpenNow) alerts.push({label: 'D-DAY', idx, daysLeft, openDate: lt.openDate});
        });

        let html = '';
        alerts.forEach(a => {
            const color = a.daysLeft <= 0 ? '#C9A84C' : '#1B4332';
            html += `<div style="background:${a.daysLeft<=0?'#FFF8E8':'#F0F7F4'};border-radius:12px;padding:12px 16px;margin-bottom:10px;border-left:4px solid ${color};">
                <div style="font-size:0.82em;font-weight:700;color:${color};">${a.daysLeft<=0?'🎉 지금 열 수 있어요!':'⏰ '+a.label+' 전 알림'}</div>
                <div style="font-size:0.8em;color:#666;margin-top:2px;">${a.openDate} 개봉 예정</div>
                ${a.daysLeft<=0?`<button onclick="viewLetter(${a.idx})" style="margin-top:8px;background:#C9A84C;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:0.82em;font-weight:700;cursor:pointer;">📬 편지 열어보기</button>`:''}
            </div>`;
        });

        if(letters.length === 0){
            html += `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
                <div style="font-size:48px;margin-bottom:12px;">✉️</div>
                <div style="font-size:0.9em;">아직 편지가 없어요<br>미래의 나에게 첫 편지를 써보세요!</div>
            </div>`;
        } else {
            letters.slice().reverse().forEach((lt, ri) => {
                const idx = letters.length - 1 - ri;
                const _od = new Date(lt.openDate);
            const _openMid = new Date(_od.getFullYear(), _od.getMonth(), _od.getDate());
            const _todayMid = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
            const daysLeft = Math.round((_openMid - _todayMid) / 86400000);
                const isOpen = lt.opened || (lt.openTimestamp ? Date.now() >= lt.openTimestamp : daysLeft <= 0);
                const p = lt.openDate.split('-');
                const dateStr = `${p[0]}년 ${parseInt(p[1])}월 ${parseInt(p[2])}일`;
                const preview = lt.text.substring(0, 30) + (lt.text.length > 30 ? '...' : '');
                html += `<div onclick="viewLetter(${idx})" style="background:var(--card-bg);border-radius:14px;padding:16px;margin-bottom:10px;border:1px solid var(--border-color);cursor:pointer;display:flex;align-items:center;gap:14px;">
                    <div style="font-size:36px;">${isOpen ? '📬' : '📮'}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.88em;font-weight:700;color:var(--primary-color);">${dateStr} 개봉</div>
                        <div style="font-size:0.8em;color:var(--text-muted);margin-top:2px;">${lt.opened ? preview : '🔒 봉인됨'}</div>
                        <div style="font-size:0.78em;margin-top:4px;color:${daysLeft<=0?'#C9A84C':daysLeft<=7?'#E07000':'var(--text-muted)'};">
                            ${daysLeft<=0 ? '📬 열 수 있어요!' : 'D-'+daysLeft}
                        </div>
                    </div>
                    <div style="font-size:0.75em;color:var(--text-muted);">${lt.writtenDate}</div>
                </div>`;
            });
        }
        container.innerHTML = html;
    }

    window.openLetterById = function(idx){ window.viewLetter(idx); };
        window.viewLetter = function(idx){
        const letters = safeGetJSON('future_letters', []);
        const lt = letters[idx];
        if(!lt) return;
        const _od = new Date(lt.openDate);
            const _openMid = new Date(_od.getFullYear(), _od.getMonth(), _od.getDate());
            const _todayMid = new Date(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
            const daysLeft = Math.round((_openMid - _todayMid) / 86400000);
        const canOpen = lt.openTimestamp ? Date.now() >= lt.openTimestamp : daysLeft <= 0;
        const p = lt.openDate.split('-');
        const dateStr = `${p[0]}년 ${parseInt(p[1])}월 ${parseInt(p[2])}일`;

        document.getElementById('letter-list-section').style.display = 'none';
        document.getElementById('letter-detail-section').style.display = 'block';

        const box = document.getElementById('letter-detail-box');
        if(lt.opened || canOpen){
            if(!lt.opened){ letters[idx].opened = true; safeSetJSON('future_letters', letters); launchConfetti(); showToast('💌 미래의 나에게 보낸 편지예요!'); }
            box.innerHTML = `
            <div style="text-align:center;margin-bottom:16px;">
                <div style="font-size:48px;">💌</div>
                <div style="font-size:0.82em;color:var(--text-muted);margin-top:6px;">${lt.writtenDate} 작성 → ${dateStr} 개봉</div>
            </div>
            <div style="background:var(--card-bg);border-radius:14px;padding:20px;border:1px solid var(--border-color);margin-bottom:16px;">
                <div style="font-size:0.78em;color:var(--accent-color);font-weight:700;margin-bottom:12px;">과거의 나로부터 온 편지</div>
                <div id="letter-text-content-${idx}" style="font-size:0.95em;color:var(--text-color);line-height:1.8;white-space:pre-wrap;">${lt.text}</div>
            </div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
                <button onclick="shareLetter(${idx})" style="flex:1;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.85em;font-weight:700;cursor:pointer;">📮 편지지로 공유</button>
                <button onclick="downloadLetterTxt(${idx})" style="flex:1;min-height:48px;background:var(--card-bg);color:var(--primary-color);border:1px solid var(--border-color);border-radius:12px;font-size:0.85em;font-weight:700;cursor:pointer;">💾 텍스트 저장</button>
            </div>
            <canvas id="letter-canvas-${idx}" style="display:none;"></canvas>`;
        } else {
            box.innerHTML = `<div style="text-align:center;padding:30px 0;">
                <div style="font-size:64px;margin-bottom:14px;">📮</div>
                <div style="font-size:1em;font-weight:700;color:var(--primary-color);margin-bottom:8px;">봉인된 편지</div>
                <div style="font-size:0.88em;color:var(--text-muted);margin-bottom:20px;">${dateStr}에 열립니다</div>
                <div style="background:var(--card-bg);border-radius:14px;padding:20px;margin-bottom:16px;">
                    <div style="font-size:0.8em;color:var(--text-muted);margin-bottom:6px;">개봉까지</div>
                    <div style="font-size:3em;font-weight:700;color:var(--primary-color);">${lt.openTimestamp ? Math.max(0,Math.ceil((lt.openTimestamp-Date.now())/3600000))+'시간' : 'D-'+daysLeft}</div>
                </div>
                <button onclick="deleteLetterById(${idx})" style="background:none;border:none;font-size:0.82em;color:#999;cursor:pointer;text-decoration:underline;">편지 삭제하기</button>
            </div>`;
        }
    }

    window.shareLetter = async function(idx){
        const letters = safeGetJSON('future_letters', []);
        const lt = letters[idx];
        if(!lt) return;

        showToast('편지지 만드는 중... 잠깐만요 💌');

        // 폰트 로드
        await document.fonts.load('20px "Nanum Pen Script"').catch(()=>{});

        const canvas = document.getElementById('letter-canvas-' + idx);
        if(!canvas) return;

        const W = 800, PADDING = 60, LINE_H = 44, FONT_SIZE = 22;
        const text = lt.text;

        // 텍스트 줄 나누기
        const ctx0 = canvas.getContext('2d');
        ctx0.font = FONT_SIZE + 'px "Nanum Pen Script", serif';
        const maxW = W - PADDING * 2;
        const rawLines = text.split('\n');
        const lines = [];
        rawLines.forEach(raw => {
            const words = raw.split('');
            let line = '';
            for(let ch of words){
                const test = line + ch;
                if(ctx0.measureText(test).width > maxW){ lines.push(line); line = ch; }
                else line = test;
            }
            lines.push(line);
        });

        const H = PADDING * 2 + 120 + lines.length * LINE_H + 80;
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // 배경 - 크림색 편지지
        ctx.fillStyle = '#FDF6E3';
        ctx.fillRect(0, 0, W, H);

        // 왼쪽 빨간 선 (편지지 여백선)
        ctx.strokeStyle = '#F0C0C0';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(PADDING - 10, 0); ctx.lineTo(PADDING - 10, H); ctx.stroke();

        // 가로 줄
        ctx.strokeStyle = '#E8DCC8';
        ctx.lineWidth = 0.8;
        for(let y = 140; y < H - 60; y += LINE_H){
            ctx.beginPath(); ctx.moveTo(PADDING - 10, y); ctx.lineTo(W - PADDING + 10, y); ctx.stroke();
        }

        // 상단 장식 - 인생2막라디오
        ctx.fillStyle = '#1B4332';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('인생2막라디오 · 미래의 나에게 쓰는 편지', W/2, 40);

        // 날짜
        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.fillText(lt.writtenDate + ' 작성', W - PADDING + 10, 40);
        ctx.textAlign = 'left';

        // 구분선
        ctx.strokeStyle = '#C9A84C';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(PADDING - 10, 55); ctx.lineTo(W - PADDING + 10, 55); ctx.stroke();

        // 수신인
        ctx.fillStyle = '#1B4332';
        ctx.font = 'bold 18px "Nanum Pen Script", serif';
        ctx.fillText('미래의 나에게,', PADDING, 90);

        // 본문
        ctx.fillStyle = '#2C2C2C';
        ctx.font = FONT_SIZE + 'px "Nanum Pen Script", serif';
        let y = 130;
        lines.forEach(line => {
            ctx.fillText(line, PADDING, y);
            y += LINE_H;
        });

        // 마무리
        ctx.fillStyle = '#1B4332';
        ctx.font = 'italic 16px "Nanum Pen Script", serif';
        ctx.textAlign = 'right';
        ctx.fillText('과거의 나로부터  💚', W - PADDING + 10, H - 30);

        // 하단 워터마크
        ctx.fillStyle = '#C9A84C';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('인생2막라디오 365일 확언 앱', W/2, H - 10);

        // 공유 또는 다운로드
        canvas.toBlob(async (blob) => {
            const file = new File([blob], '미래의나에게_편지.png', {type: 'image/png'});
            if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
                try{
                    await navigator.share({ files:[file], title:'미래의 나에게 쓴 편지', text:'인생2막라디오 365일 확언 앱에서 작성한 편지예요 💌' });
                } catch(e){
                    downloadCanvasImage(canvas);
                }
            } else {
                downloadCanvasImage(canvas);
            }
        }, 'image/png');
    }

    function downloadCanvasImage(canvas){
        const a = document.createElement('a');
        a.download = '미래의나에게_편지.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
        showToast('편지 이미지가 저장됐어요! 📮');
    }

    window.downloadLetterTxt = function(idx){
        const letters = safeGetJSON('future_letters', []);
        const lt = letters[idx];
        if(!lt) return;
        const content = '미래의 나에게,\n\n' + lt.text + '\n\n' + lt.writtenDate + ' 과거의 나로부터\n--- 인생2막라디오 365일 확언 앱 ---';
        const blob = new Blob([content], {type:'text/plain;charset=utf-8'});
        const a = document.createElement('a');
        a.download = '미래의나에게_편지_' + lt.writtenDate + '.txt';
        a.href = URL.createObjectURL(blob);
        a.click();
        showToast('텍스트 파일이 저장됐어요! 💾');
    }

    window.deleteLetterById = function(idx){
        if(!confirm('이 편지를 삭제할까요?')) return;
        const letters = safeGetJSON('future_letters', []);
        letters.splice(idx, 1);
        safeSetJSON('future_letters', letters);
        showLetterList();
        showToast('편지가 삭제됐어요');
    }

    window.saveLetter = function(){
        const text = document.getElementById('letter-input').value.trim();
        if(!text){ showToast('편지 내용을 써주세요'); return; }
        if(!_letterOpenDate){ showToast('개봉일을 선택해주세요'); return; }
        if(!_letterIsNextDay && _letterOpenDate <= getTodayStr()){ showToast('개봉일은 오늘 이후로 설정해주세요'); return; }

        const letters = safeGetJSON('future_letters', []);
        const isNextDay = _letterIsNextDay || false;
        const entry = { text, writtenDate: getTodayStr(), openDate: _letterOpenDate, opened: false };
        if(isNextDay) entry.openTimestamp = Date.now() + 24*60*60*1000; // 24시간 후
        letters.push(entry);
        safeSetJSON('future_letters', letters);

        showToast('💌 편지가 봉인됐어요!');
        launchConfetti();
        addPoint(1,'미래편지','letter');
        showLetterList();
    }

    // 기존 데이터 마이그레이션 (future_letter → future_letters)
    function migrateLetter(){
        const old = safeGetItem('future_letter', null);
        if(old && old !== '' && old !== 'null'){
            try{
                const d = JSON.parse(old);
                if(d && d.text){
                    const letters = safeGetJSON('future_letters', []);
                    if(!letters.find(l => l.writtenDate === d.writtenDate)){
                        letters.push({ text: d.text, writtenDate: d.writtenDate||getTodayStr(), openDate: d.openDate, opened: false });
                        safeSetJSON('future_letters', letters);
                    }
                    safeSetItem('future_letter', '');
                }
            } catch(e){}
        }
    }

    /* ===== ⑤ 행동 지침 완료 체크 ===== */
    window.openActionPhoto = function(){
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'camera';
        input.style.display = 'none';
        input.onchange = function(e){
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = function(ev){
                const photoDone = safeGetItem('pt_daily_action_photo_'+getTodayStr(),'') === '1';
                const modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
                modal.innerHTML =
                    '<div style="font-size:0.88em;color:#C9A84C;font-weight:700;margin-bottom:12px;">📸 오늘의 실천 인증</div>' +
                    '<img src="' + ev.target.result + '" style="max-width:100%;max-height:50vh;border-radius:12px;object-fit:contain;">' +
                    '<div style="font-size:0.75em;color:rgba(255,255,255,0.5);margin-top:8px;">이미지는 저장되지 않아요 · 카톡에서 직접 첨부해주세요</div>' +
                    '<div style="display:flex;flex-direction:column;gap:10px;margin-top:16px;width:100%;max-width:360px;">' +
                    '<a id="action-send-btn" href="https://open.kakao.com/o/sKUKl3pi" target="_blank" ' +
                    'onclick="setTimeout(function(){ var btn=document.getElementById(\'action-complete-btn\'); if(btn){ btn.style.display=\'flex\'; } }, 300);" ' +
                    'style="min-height:52px;background:#FEE500;color:#3C1E1E;border-radius:10px;font-size:0.9em;font-weight:700;cursor:pointer;text-decoration:none;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8px;">💌 인생2막♡라디오에 인증 보내기<span style="font-size:0.75em;font-weight:600;margin-top:2px;">누르면 +5PT 적립!</span></a>' +
                    '<button id="action-complete-btn" ' +
                    (photoDone ? 'onclick="this.closest(\'[style*=fixed]\').remove(); renderScreen();" style="display:none;min-height:52px;background:#888;color:#fff;border:none;border-radius:10px;font-size:0.9em;font-weight:700;cursor:pointer;align-items:center;justify-content:center;">✅ 오늘 이미 인증 완료!</button>' : 'onclick="addPoint(5,\'행동지침사진\',\'action_photo\'); this.closest(\'[style*=fixed]\').remove(); renderScreen(); showToast(\'🎉 +5PT 실천 인증 완료!\'); launchConfetti();" style="display:none;min-height:52px;background:#1B4332;color:#fff;border:none;border-radius:10px;font-size:0.9em;font-weight:700;cursor:pointer;align-items:center;justify-content:center;">✅ 실천 완료! (+5PT)</button>') +
                    '</div>' +
                    '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="margin-top:12px;background:none;border:none;color:rgba(255,255,255,0.4);font-size:0.85em;cursor:pointer;">닫기</button>';
                document.body.appendChild(modal);
            };
            reader.readAsDataURL(file);
        };
        document.body.appendChild(input);
        input.click();
    }

    window.toggleActionDone=function(){
        const key=`action_done_${getFormatDate(selectedDateObj)}`;
        if(safeGetItem(key,'') === '1') return; // 이미 완료면 변경 불가
        safeSetItem(key,'1');
        const btn=document.getElementById('action-done-btn');
        if(btn){
            btn.style.background='var(--primary-color)';
            btn.style.color='#FFFFFF';
            btn.style.borderColor='var(--primary-color)';
            btn.textContent='✓ 오늘 행동 실천 완료!';
            btn.style.cursor='default';
        }
        showToast('🌿 행동을 실천하셨군요! 오늘 하루 대단해요');
    }

    const ONBOARDING_STEPS = [
        {
            finger:'👇', badge:'1 / 4',
            title:'오늘 기분을 먼저 체크해요',
            desc:'이모지를 누르면 오늘의 확언이 열려요.\n매일 기분을 기록하면 나중에 변화를 볼 수 있어요 😊',
            highlight: null
        },
        {
            finger:'👇', badge:'2 / 4',
            title:'확언을 소리내어 읽어보세요',
            desc:'"따라 읽기" 버튼을 누르고 확언을 소리내어 읽으면\n뇌에 더 깊이 새겨진다는 걸 알고 계셨나요?',
            highlight: null
        },
        {
            finger:'☑️', badge:'3 / 4',
            title:'오늘 완료 체크로 하루를 마무리해요',
            desc:'매일 체크하면 달력에 기록이 남아요.\n365일을 채우는 그날까지 함께할게요! 🌿',
            highlight: null
        },
        {
            finger:'🏅', badge:'4 / 4',
            title:'나의 성장을 수치로 확인해요',
            desc:'매일의 기분과 확언을 기록하면,\n30일 뒤 감정 변화와 나의 성장을 수치로 확인할 수 있어요! 📊',
            highlight: null,
            isNickname: true
        }
    ];
    let obStep = 0;

    function initOnboarding(){
        if(safeGetItem('onboarding_done','') === '1') return;
        // 딜레이 없이 즉시 표시
        showOnboardingStep(0);
        document.getElementById('onboarding-overlay').style.display = 'block';
    }

    function showOnboardingStep(step){
        obStep = step;
        const s = ONBOARDING_STEPS[step];
        document.getElementById('onboarding-finger').textContent  = s.finger;
        document.getElementById('onboarding-step-badge').textContent = s.badge;
        document.getElementById('onboarding-title').textContent   = s.title;
        document.getElementById('onboarding-desc').textContent    = s.desc;
        document.getElementById('onboarding-next').textContent    = step < ONBOARDING_STEPS.length-1 ? '다음 →' : '시작하기 🌿';

        // 닉네임+이메일 입력창
        let nickArea = document.getElementById('ob-nickname-area');
        if(s.isNickname){
            if(!nickArea){
                nickArea = document.createElement('div');
                nickArea.id = 'ob-nickname-area';
                nickArea.style.cssText = 'margin:14px 0 4px;';
                nickArea.innerHTML = `
                    <input id="ob-nick-input" type="text" maxlength="15" placeholder="이름 또는 별명 (예: 전주 60대 주부)"
                        style="width:100%;padding:12px 14px;font-size:1em;border:2px solid #1B4332;border-radius:10px;box-sizing:border-box;text-align:center;outline:none;margin-bottom:8px;">
                    <button onclick="window._googleOneTap()" style="width:100%;padding:11px 14px;font-size:0.95em;border:1.5px solid #4285F4;border-radius:10px;box-sizing:border-box;background:#fff;color:#444;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">
                        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
                        구글 계정에서 이메일 가져오기
                    </button>
                    <input id="ob-email-input" type="email" placeholder="또는 직접 입력"
                        style="width:100%;padding:12px 14px;font-size:0.95em;border:1.5px solid #C8DDD2;border-radius:10px;box-sizing:border-box;text-align:center;outline:none;">
                    <label for="ob-privacy-agree" style="margin-top:10px;display:flex;align-items:flex-start;gap:8px;cursor:pointer;">
                        <input type="checkbox" id="ob-privacy-agree" style="width:18px;height:18px;min-width:18px;margin-top:2px;cursor:pointer;accent-color:#1B4332;">
                        <span style="font-size:11px;color:#aaa;line-height:1.6;text-align:left;">이름·이메일을 서비스 개선 목적으로 수집하는 것에 동의합니다.</span>
                    </label>
                    <div style="font-size:11px;color:#999;margin-top:8px;text-align:center;">☑ 이름과 이메일로 가입하겠습니다 (선택)</div>`;
                const formContainer = document.getElementById('ob-form-container');
                if(formContainer){
                    formContainer.innerHTML = '';
                    formContainer.appendChild(nickArea);
                    formContainer.style.display = 'block';
                } else {
                    document.getElementById('onboarding-next').parentNode.insertBefore(nickArea, document.getElementById('onboarding-next'));
                }
            }
            nickArea.style.display = 'block';
            const existing = safeGetItem('my_nickname','');
            const existingEmail = safeGetItem('my_email','');
            if(existing) document.getElementById('ob-nick-input').value = existing;
            if(existingEmail) document.getElementById('ob-email-input').value = existingEmail;
        } else {
            if(nickArea) nickArea.style.display = 'none';
            const fc = document.getElementById('ob-form-container');
            if(fc) fc.style.display = 'none';
        }

        // 점 업데이트
        document.querySelectorAll('.ob-dot').forEach((d,i)=> d.classList.toggle('active', i===step));
        const card = document.getElementById('onboarding-card');
        card.style.top  = '50%';
        card.style.left = '50%';
        card.style.transform = 'translate(-50%,-50%)';
    }

    window.nextOnboarding = function(){
        if(obStep < ONBOARDING_STEPS.length - 1){
            // 다음 단계로
            const nextStep = obStep + 1;
            showOnboardingStep(nextStep);
        } else {
            // 마지막 단계 (닉네임 입력 페이지)
            const obAgree = document.getElementById('ob-privacy-agree');
            const nickInput  = document.getElementById('ob-nick-input');
            const emailInput = document.getElementById('ob-email-input');
            
            const hasNick  = nickInput  && nickInput.value.trim();
            const hasEmail = emailInput && emailInput.value.trim();
            const isChecked = obAgree && obAgree.checked;

            // ★ 이름이나 이메일을 입력했는데 체크박스 미체크 → 경고 후 차단
            if((hasNick || hasEmail) && !isChecked){
                showToast('아래 개인정보 수집 동의를 먼저 체크해주세요! ☑️');
                // 체크박스 강조
                if(obAgree){
                    obAgree.style.outline = '3px solid #C9A84C';
                    setTimeout(function(){ obAgree.style.outline = ''; }, 2000);
                }
                return;
            }

            // ★ 체크박스 체크한 경우 → 필수 입력 검증 후 저장
            if(isChecked){
                if(!hasNick){ showToast('이름을 입력해주세요!'); return; }
                if(!hasEmail){ showToast('이메일을 입력해주세요!'); return; }
                // 정보 저장
                safeSetItem('my_nickname', nickInput.value.trim());
                safeSetItem('my_email', emailInput.value.trim());
                const ni = document.getElementById('nickname-input');
                if(ni) ni.value = nickInput.value.trim();
                const ei = document.getElementById('user-email-input');
                if(ei) ei.value = emailInput.value.trim();
                const se = document.getElementById('story-email');
                if(se) se.value = emailInput.value.trim();
                window._sendUserUpdate();
            }

            // 등록 여부와 관계없이 온보딩 완료
            skipOnboarding();
        }
    }

    window.skipOnboarding = function(){
        document.getElementById('onboarding-overlay').style.display = 'none';
        safeSetItem('onboarding_done','1');
        
        // ★ 강제 팝업(showNicknameModal) 띄우는 로직 완전히 삭제!
        // 유저는 아무런 방해나 강요 없이 곧바로 앱의 핵심 가치(오늘의 확언)를 체험하게 됩니다.
        checkFirstVisit(); 
    }

    /* ===== 명예의 전당 ===== */
    function render100DayCertButton(){
        const sec = document.getElementById('cert-100-section');
        if(!sec) return;
        const cd   = safeGetJSON('completed_dates', []);
        const nick = safeGetItem('my_nickname', '');
        const sent = safeGetItem('notified_100day', '') === '1';

        if(cd.length < 100){
            // 아직 100일 미달성
            sec.innerHTML = `<div style="text-align:center;font-size:0.82em;color:rgba(255,255,255,0.5);">현재 ${cd.length}일 달성 · 100일 달성 시 인증 가능해요</div>`;
        } else if(sent){
            // 이미 전송
            sec.innerHTML = `<div style="text-align:center;font-size:0.82em;color:var(--accent-color);">✅ 인증 이메일을 보내셨어요! 곧 호명해드려요 🎙<br><button onclick="safeSetItem('notified_100day',''); render100DayCertButton();" style="margin-top:8px;background:none;border:none;font-size:0.8em;color:rgba(255,255,255,0.4);cursor:pointer;text-decoration:underline;">다시 보내기</button></div>`;
        } else {
            // 100일 이상 + 미전송
            sec.innerHTML = `
                <button onclick="send100DayEmail('${nick||'익명'}', ${cd.length})" style="width:100%;min-height:50px;background:var(--accent-color);color:#1B4332;border:none;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;margin-bottom:8px;">
                    📧 100일 달성 인증 이메일 보내기
                </button>
                <button onclick="safeSetItem('notified_100day','1'); render100DayCertButton();" style="width:100%;min-height:40px;background:none;border:1px solid rgba(255,255,255,0.2);border-radius:12px;font-size:0.85em;color:rgba(255,255,255,0.5);cursor:pointer;">
                    괜찮아요, 보내지 않을게요
                </button>
                <div style="font-size:0.78em;color:rgba(255,255,255,0.5);text-align:center;margin-top:8px;">보내시면 유튜브 영상에서 이름을 불러드려요 🎙</div>`;
        }
    }
    // ★ 구글 시트에서 챔피언 닉네임 목록도 관리 가능 (추후 연동)
    // 지금은 100일 이상 달성한 로컬 유저 표시
    function renderHallOfFame(){
        const el = document.getElementById('hall-of-fame-list');
        if(!el) return;
        const cd = safeGetJSON('completed_dates',[]);
        if(cd.length >= 100){
            // 본인이 100일 이상이면 내 닉네임 표시 (설정에서 입력 가능하도록)
            const myName = safeGetItem('my_nickname','');
            if(myName){
                el.innerHTML = `<div style="background:rgba(212,168,67,0.2);border:1px solid var(--accent-color);border-radius:20px;padding:6px 16px;font-size:0.88em;color:var(--accent-color);font-weight:700;">${myName} 🏅 ${cd.length}일</div>`;
                return;
            }
        }
        el.innerHTML = `<div style="font-size:0.85em;color:rgba(255,255,255,0.6);text-align:center;width:100%;line-height:1.7;">100일 달성 시 이름이 여기 올라가요!<br>이름은 설정에서 입력할 수 있어요.</div>`;
    }
    // ★ 매주 Shorts 영상 올릴 때 이 목록에 날짜:코드 추가하세요
    // 형식: 'YYYY-M-D': '코드4자리'
    const SECRET_CODES = {
        // 예시 (실제 영상 올린 후 채워넣으세요)
        // '2026-4-10': '1234',
        // '2026-4-17': '5678',
    };

    window.checkSecretCode = function(){
        const input  = document.getElementById('secret-code-input').value.trim();
        const result = document.getElementById('secret-code-result');
        if(input.length !== 4){ result.textContent = '4자리 코드를 입력해주세요'; return; }

        const today   = `${todayObj.getFullYear()}-${todayObj.getMonth()+1}-${todayObj.getDate()}`;
        const correct = SECRET_CODES[today];
        // ★ 오늘 날짜+코드 조합으로 중복 체크 (날짜별로 다른 코드면 여러 번 가능)
        const usedKey = `secret_used_${today}_${input}`;

        if(safeGetItem(usedKey, null)){
            result.textContent = '✅ 이 코드는 이미 입력하셨어요!'; return;
        }
        if(!correct){
            result.textContent = '오늘의 코드가 아직 없어요. 영상을 확인해보세요!'; return;
        }
        if(input === correct){
            safeSetItem(usedKey, '1');
            // 패자부활: 결석 1일 삭제
            var ab=parseInt(safeGetItem('revival_absent_days','0'))||0; if(ab>0){ safeSetItem('revival_absent_days',String(ab-1)); showToast('🎉 코드 입력 완료! 결석 1일이 삭제됐어요!'); }

            // 누적 코드 카운트 증가
            const totalCodes = (parseInt(safeGetItem('total_secret_codes','0'))||0) + 1;
            safeSetItem('total_secret_codes', String(totalCodes));

            // 배지 저장
            let earned = safeGetJSON('earned_badges',[]);
            const badgeId = `secret_${today}`;
            if(!earned.includes(badgeId)){ earned.push(badgeId); safeSetJSON('earned_badges', earned); }

            result.textContent = '';
            document.getElementById('secret-code-input').value = '';
            launchConfetti();

            // ★ 코드 포인트 지급
            addPoint(10, '시크릿코드', `secret_pt_${today}`);
            // 누적 보너스
            if(totalCodes === 5)  addPoint(30, '코드5개달성', 'secret_bonus_5');
            if(totalCodes === 10) addPoint(80, '코드10개달성', 'secret_bonus_10');
            if(totalCodes === 20) addPoint(200, '코드20개달성', 'secret_bonus_20');

            // 오늘의 특별 콘텐츠 가져오기
            const todayContent = (window.SECRET_CONTENTS && window.SECRET_CONTENTS[today]) || null;
            showSecretSuccess(totalCodes, todayContent);
            checkLevelRecovery(); // 등급 하락 상태면 회복
        } else {
            result.textContent = '❌ 코드가 맞지 않아요. 영상 끝을 다시 확인해보세요!';
        }
    }

    // PDF 해금 정보 (구글 스프레드시트 앱설정에서 URL 관리)
    const PDF_REWARDS = [
        { threshold: 10, label: '1~3월 확언 PDF', months: '1월~3월 (90일)', urlKey: 'pdf_url_1' },
        { threshold: 20, label: '4~6월 확언 PDF', months: '4월~6월 (91일)', urlKey: 'pdf_url_2' },
        { threshold: 30, label: '7~9월 확언 PDF', months: '7월~9월 (92일)', urlKey: 'pdf_url_3' },
        { threshold: 40, label: '10~12월 확언 PDF', months: '10월~12월 (92일)', urlKey: 'pdf_url_4' },
    ];

    function showSecretSuccess(totalCodes, content){
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9998;display:flex;align-items:center;justify-content:center;';

        // PDF 해금 체크
        const unlockedPdf = PDF_REWARDS.find(r =>
            totalCodes === r.threshold &&
            safeGetItem(`pdf_unlocked_${r.threshold}`, '') !== '1'
        );
        if(unlockedPdf) {
            safeSetItem(`pdf_unlocked_${unlockedPdf.threshold}`, '1');
            window._sendPdfAccess(unlockedPdf.label); // ★ PDF 해금 로그
        }

        // 남은 코드 수 계산
        const nextPdf = PDF_REWARDS.find(r => totalCodes < r.threshold);
        const remaining = nextPdf ? nextPdf.threshold - totalCodes : 0;

        let contentHtml = '';
        if(content && content.text){
            contentHtml = `
                <div style="background:#F0F7F4;border-radius:12px;padding:14px 16px;margin:12px 0;text-align:left;">
                    <div style="font-size:0.75em;font-weight:700;color:#1B4332;letter-spacing:0.5px;margin-bottom:6px;">🔓 오늘의 숨겨진 ${content.type||'이야기'}</div>
                    <div style="font-size:0.92em;color:#333;line-height:1.7;font-weight:600;">${content.text}</div>
                </div>`;
        }

        let pdfHtml = '';
        if(unlockedPdf){
            const pdfUrl = safeGetItem(unlockedPdf.urlKey, '') || '#';
            pdfHtml = `
                <div style="background:linear-gradient(135deg,#C9A84C,#E8C97A);border-radius:12px;padding:14px 16px;margin:12px 0;text-align:center;">
                    <div style="font-size:0.82em;font-weight:700;color:#1B4332;margin-bottom:6px;">🎁 특별 선물이 해금됐어요!</div>
                    <div style="font-size:0.95em;font-weight:700;color:#1B4332;margin-bottom:10px;">${unlockedPdf.label}</div>
                    <a href="${pdfUrl}" target="_blank" style="display:block;background:#1B4332;color:#C9A84C;padding:10px;border-radius:10px;font-size:0.9em;font-weight:700;text-decoration:none;">📄 PDF 받기</a>
                </div>`;
        }

        let progressHtml = '';
        if(nextPdf && !unlockedPdf){
            progressHtml = `<div style="font-size:0.8em;color:#888;margin-top:8px;">🎁 ${nextPdf.label}까지 ${remaining}개 남았어요!</div>`;
        }

        modal.innerHTML = `
            <div style="background:#FFFFFF;border-radius:20px;padding:28px 22px;width:90%;max-width:360px;text-align:center;max-height:90vh;overflow-y:auto;">
                <div style="font-size:48px;margin-bottom:8px;">🏅</div>
                <div style="font-size:1.2em;font-weight:700;color:#1B4332;margin-bottom:4px;">코드 인증 성공!</div>
                <div style="font-size:0.85em;color:#888;margin-bottom:4px;">누적 ${totalCodes}개 달성</div>
                ${contentHtml}
                ${pdfHtml}
                ${progressHtml}
                <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;margin-top:14px;">확인</button>
            </div>`;
        document.body.appendChild(modal);
        setTimeout(()=>{ if(modal.parentNode) modal.remove(); }, 8000);
    }

    // 이미 해금된 PDF 다시 받기 (달력 탭 등에서 접근)
    window.openUnlockedPdf = function(threshold){
        const pdf = PDF_REWARDS.find(r => r.threshold === threshold);
        if(!pdf) return;
        const url = safeGetItem(pdf.urlKey, '');
        if(url && url !== '#') window.open(url, '_blank');
        else showToast('PDF 링크가 아직 설정되지 않았어요');
    }
    let sttRecognition = null;

    /* ===== 💥 완료 후 감정 보상 + 공유 유도 ===== */


    function showSTTSuccessPopup(totalDays, streak){
        var old = document.getElementById('stt-reward-modal');
        if(old) old.remove();
        var tomorrow = new Date(todayObj);
        tomorrow.setDate(tomorrow.getDate()+1);
        var tomorrowStr = (tomorrow.getMonth()+1)+'월 '+tomorrow.getDate()+'일';
        var nick = safeGetItem('my_nickname','');
        var nickTxt = nick ? nick+'님, ' : '';
        var modal = document.createElement('div');
        modal.id = 'stt-reward-modal';
        modal.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;z-index:9000;background:rgba(0,0,0,0.5);display:flex;align-items:flex-end;justify-content:center;top:0;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#1B4332;border-radius:24px 24px 0 0;padding:32px 24px 44px;width:100%;max-width:600px;text-align:center;';
        box.innerHTML =
            '<div style="font-size:1.3em;font-weight:700;color:#fff;margin-bottom:8px;">🎉 따라읽기 완료!</div>' +
            '<div style="font-size:0.9em;color:rgba(255,255,255,0.75);margin-bottom:20px;">' + nickTxt + '뇌에 긍정의 힘이 새겨졌어요!</div>' +
            '<div style="background:rgba(255,255,255,0.1);border-radius:14px;padding:16px;margin-bottom:20px;">' +
            '<div style="font-size:0.85em;color:rgba(255,255,255,0.7);margin-bottom:4px;">내일도 이어가시겠어요? 🌿</div>' +
            '<div style="font-size:0.95em;color:#D4A843;font-weight:700;">' + tomorrowStr + ' 확언으로 '+(streak+1)+'일 연속 달성해봐요!</div>' +
            '</div>' +
            '<button id="stt-share-btn" style="width:100%;min-height:52px;background:#D4A843;color:#1B4332;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;margin-bottom:10px;">오늘 확언 공유하기</button>' +
            '<button id="stt-close-btn" style="width:100%;background:none;border:none;color:rgba(255,255,255,0.5);font-size:0.9em;cursor:pointer;padding:8px;">닫기</button>';
        modal.appendChild(box);
        document.body.appendChild(modal);
        document.getElementById('stt-share-btn').addEventListener('click', function(){
            shareAfterComplete();
            modal.remove();
        });
        document.getElementById('stt-close-btn').addEventListener('click', function(){
            modal.remove();
        });
        modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
    }

    function showCompleteReward(totalDays, streak){
        if(safeGetItem(`reward_shown_${getTodayStr()}`,'') === '1') return;
        safeSetItem(`reward_shown_${getTodayStr()}`, '1');
        let reward = null;
        for(let r of [...COMPLETE_REWARDS].reverse()){ if(totalDays >= r.days){ reward=r; break; } }
        const _nick = safeGetItem('my_nickname','');
        const _nickPrefix = _nick ? `${_nick}님, ` : '';
        const msg = reward ? reward.msg : _nickPrefix + REWARD_MSGS[Math.floor(Math.random()*REWARD_MSGS.length)];
        const sub = reward ? reward.sub : `${streak}일 연속 달성 중이에요!`;
        const modal = document.createElement('div');
        modal.id = 'complete-reward-modal';
        modal.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);width:92%;max-width:380px;z-index:8000;animation:rewardSlideUp 0.4s ease;';
        modal.innerHTML = `<style>@keyframes rewardSlideUp{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}</style>
            <div style="background:var(--primary-color);border-radius:18px;padding:20px 20px 16px;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
                <div style="font-size:1.05em;font-weight:700;color:#FFFFFF;margin-bottom:4px;">${msg}</div>
                <div style="font-size:0.82em;color:rgba(255,255,255,0.75);margin-bottom:14px;">${sub}</div>
                <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:12px 14px;margin-bottom:14px;text-align:center;">
                    <div style="font-size:0.82em;color:rgba(255,255,255,0.7);margin-bottom:6px;" id="reward-continue-text">내일도 이어가시겠어요? 🌿</div>
                    <div style="font-size:0.78em;color:rgba(255,255,255,0.55);" id="reward-tomorrow-label"></div>
                </div>
                <div style="display:flex;gap:8px;">
                    <button onclick="shareAfterComplete()" style="flex:1;min-height:44px;background:var(--accent-color);color:var(--primary-color);border:none;border-radius:10px;font-size:0.85em;font-weight:700;cursor:pointer;">오늘 확언 공유하기</button>
                </div>
                <button onclick="document.getElementById('complete-reward-modal').remove()" style="width:100%;min-height:38px;background:none;border:none;font-size:0.8em;color:rgba(255,255,255,0.45);cursor:pointer;margin-top:8px;">닫기</button>
            </div>`;
        document.body.appendChild(modal);

        // 내일 날짜 표시
        const tmr = new Date(todayObj); tmr.setDate(tmr.getDate()+1);
        const tLabel = document.getElementById('reward-tomorrow-label');
        if(tLabel){
            const d = `${tmr.getMonth()+1}월 ${tmr.getDate()}일`;
            const cd2 = safeGetJSON('completed_dates',[]);
            const streak2 = calcCurrentStreak(cd2);
            tLabel.textContent = `${d} 확언으로 ${streak2+1}일 연속 달성해봐요!`;
        }
        // 닉네임 있으면 '내일도 이어가시겠어요?' 텍스트 업데이트
        const _ct = document.getElementById('reward-continue-text');
        if(_ct){ const _n=safeGetItem('my_nickname',''); _ct.textContent = _n ? `${_n}님, 내일도 이어가시겠어요? 🌿` : '내일도 이어가시겠어요? 🌿'; }
        setTimeout(()=>{ const m=document.getElementById('complete-reward-modal'); if(m)m.remove(); }, 8000);
    }


    window.shareAfterComplete = function(){
        addPoint(2,'공유','share_aff');
        window._sendShareLog('확언공유');
        const affirmEl = document.getElementById('affirmation-text');
        if(!affirmEl) return;
        const today = getTodayStr().replace(/(\d+)-(\d+)-(\d+)/, '$1년 $2월 $3일');
        const text = `🌿 ${today} 오늘의 확언\n\n"${affirmEl.innerText.trim()}"\n\n매일 아침 나를 위한 확언 한 문장 💚\n\n📱 확언 앱: https://life2radio.github.io/pumsok/\n📺 인생2막라디오: https://www.youtube.com/@SecondActRadio`;
        if(navigator.share){ navigator.share({title:'오늘의 확언 💚', text}).catch(function(e){ if(e.name!=='AbortError') copyToClipboard(text); }); }
        else { copyToClipboard(text); }
        document.getElementById('complete-reward-modal')?.remove();
        trackEvent('share_after_complete');
    }

        

    function renderShortsPointSummary(){
        try{
            const today = getTodayStr();
            function isDone(key){ return safeGetItem('pt_daily_'+key+'_'+today,'') === '1'; }
            const ITEMS = [
                {icon:'☑️', label:'확언 완료', key:'complete', pt:1, action:"goToHomeElement('btn-complete')"},
                {icon:'🔊', label:'소리 듣기', key:'listen', pt:1, action:"goToHomeElement('btn-listen')"},
                {icon:'🎙', label:'따라읽기', key:'stt', pt:1, action:"goToHomeElement('btn-stt')"},
                {icon:'😊', label:'기분 체크', key:'mood_check', pt:1, action:"goToHomeElement('affirmation-view')"},
                {icon:'📸', label:'실천 인증', key:'action_photo', pt:5, action:"switchView('home');setTimeout(()=>openActionPhoto(),400)"},
                {icon:'✏️', label:'필사', key:'memo', pt:1, action:"switchView('memo');setTimeout(()=>switchMemoTab('write'),100)"},
                {icon:'📔', label:'일기', key:'diary', pt:1, action:"switchView('memo');setTimeout(()=>switchMemoTab('diary'),100)"},
                {icon:'📤', label:'확언 공유', key:'share_aff', pt:2, action:"switchView('home');setTimeout(shareAfterComplete,300)"},
                {icon:'🌅', label:'카드 공유', key:'share_card', pt:2, action:"switchView('home');setTimeout(openShareCard,300)"},
                {icon:'💚', label:'가족 공유', key:'share_family', pt:2, action:"switchView('home');setTimeout(shareToFamily,300)"},
                {icon:'✨', label:'한마디 공유', key:'share_oracle', pt:2, action:"switchView('home');setTimeout(openOracle,300)"},
                {icon:'📺', label:'쇼츠 보기', key:'shorts_visit', pt:2, action:"addPoint(2,'쇼츠클릭','shorts_visit');window.open('https://www.youtube.com/@SecondActRadio/shorts','_blank')"},
                {icon:'🎬', label:'영상 보기', key:'episode_visit', pt:2, action:"addPoint(2,'영상클릭','episode_visit');var _ep=document.getElementById('btn-episode');var _href=_ep?_ep.getAttribute('href'):'';var _url=(_href&&_href!=='#'&&_href.indexOf('youtube')>-1)?_ep.href:'https://www.youtube.com/@SecondActRadio';window.open(_url,'_blank')"},
            ];
            let earned = 0, done = 0;
            ITEMS.forEach(item => {
                if(isDone(item.key)){ earned += item.pt; done++; }
            });
            earned = Math.min(earned, 23);
            const pct = Math.round(earned/23*100);

            const bar = document.getElementById('shorts-pt-bar');
            const doneEl = document.getElementById('shorts-pt-done');
            const scoreEl = document.getElementById('shorts-pt-score');
            const itemsEl = document.getElementById('shorts-pt-items');
            if(!bar) return;

            bar.style.width = pct + '%';
            bar.style.background = pct >= 100 ? '#1B4332' : pct >= 60 ? '#C9A84C' : 'var(--primary-color)';
            doneEl.textContent = '✓ ' + done + ' / ' + ITEMS.length + '개 항목';
            scoreEl.textContent = earned + ' / 23 PT';
            scoreEl.style.color = pct >= 100 ? '#1B4332' : '#C9A84C';

            itemsEl.innerHTML = ITEMS.map(item => {
                const d = isDone(item.key);
                return '<div onclick="' + item.action + '" style="display:flex;align-items:center;gap:6px;padding:7px 8px;border-radius:8px;background:' +
                    (d ? '#F0F7F4' : 'var(--card-bg)') + ';border:1px solid ' + (d ? '#C8DDD2' : 'var(--border-color)') + ';cursor:pointer;">' +
                    '<span style="font-size:14px;flex-shrink:0;">' + item.icon + '</span>' +
                    '<span style="font-size:12px;flex:1;color:' + (d ? 'var(--primary-color)' : 'var(--text-muted)') + ';font-weight:' + (d ? '700' : '400') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + item.label + '</span>' +
                    '<span style="font-size:12px;font-weight:700;color:' + (d ? '#1B4332' : '#C9A84C') + ';flex-shrink:0;">' + (d ? '✓' : '+' + item.pt + 'P') + '</span>' +
                    '</div>';
            }).join('');
        }catch(e){}
    }


    window.openKakaoWithConsent = function(){
        const old = document.getElementById('kakao-consent-modal');
        if(old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'kakao-consent-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:7000;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
        const inner = document.createElement('div');
        inner.style.cssText = 'background:var(--bg-color);border-radius:20px;padding:24px 20px;width:100%;max-width:400px;box-sizing:border-box;';
        inner.innerHTML =
            '<div style="text-align:center;margin-bottom:16px;">' +
            '<div style="font-size:28px;margin-bottom:6px;">💬</div>' +
            '<div style="font-size:1em;font-weight:700;color:var(--primary-color);">카카오 오픈채팅으로 연결해요</div>' +
            '<div style="font-size:0.8em;color:var(--text-muted);margin-top:4px;line-height:1.6;">이메일을 남겨주시면 답변과 채널 소식을<br>직접 보내드릴 수 있어요</div></div>' +
            '<input id="kakao-consent-email" type="email" placeholder="이메일 주소 (예: abc@gmail.com)" ' +
            'style="width:100%;box-sizing:border-box;font-size:0.9em;padding:12px 14px;border:1.5px solid var(--border-color);border-radius:10px;background:var(--bg-color);color:var(--text-color);outline:none;margin-bottom:10px;">' +
            '<label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;font-size:0.8em;color:var(--text-muted);line-height:1.6;margin-bottom:16px;">' +
            '<input type="checkbox" id="kakao-consent-check" style="width:16px;height:16px;margin-top:2px;flex-shrink:0;accent-color:var(--primary-color);">' +
            '<span>인생2막라디오 소식과 채널 정보를 이메일로 받는 것에 동의합니다. <span style="opacity:0.7;">(언제든 철회 가능)</span></span></label>' +
            '<button id="kakao-go-btn" style="width:100%;min-height:48px;background:#FEE500;color:#3A1D1D;border:none;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;margin-bottom:8px;">✅ 이메일 등록 후 카카오로 연결</button>' +
            '<button id="kakao-skip-btn" style="width:100%;min-height:40px;background:none;border:none;font-size:0.82em;color:var(--text-muted);cursor:pointer;">이메일 없이 그냥 연결할게요</button>';
        modal.appendChild(inner);
        document.body.appendChild(modal);
        document.getElementById('kakao-go-btn').onclick = function(){
            const email = document.getElementById('kakao-consent-email').value.trim();
            const agreed = document.getElementById('kakao-consent-check').checked;
            // 이메일 필수
            if(!email){ showToast('이메일 주소를 입력해주세요 📧'); return; }
            if(!email.includes('@')){ showToast('올바른 이메일 주소를 입력해주세요'); return; }
            // 체크박스 필수
            if(!agreed){ showToast('소식 수신 동의를 체크해주세요 ☑️'); return; }
            if(email){
                const emails = safeGetJSON('marketing_emails',[]);
                if(!emails.includes(email)){ emails.push(email); safeSetJSON('marketing_emails',emails); }
                fetch('https://formspree.io/f/xqewzqqg',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({유형:'카카오_마케팅동의',이메일:email,동의:'동의'})}).catch(()=>{});
                showToast('✅ 이메일이 등록됐어요!');
            }
            modal.remove();
            onStoryKakaoClick();
            setTimeout(function(){ window.open('https://open.kakao.com/o/sKUKl3pi','_blank'); }, 300);
        };
        document.getElementById('kakao-skip-btn').onclick = function(){
            modal.remove();
            // 이메일 없이 그냥 연결 → 외부 링크 열기
            window.open('https://open.kakao.com/o/sKUKl3pi','_blank');
        };
        modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
    };

    // ★ 사연 카카오 오픈채팅 관련
    function getStoryKakaoKey(){
        return 'story_kakao_' + todayObj.getFullYear() + '_' + (todayObj.getMonth()+1);
    }
    window.onStoryKakaoClick = function(){
        var key = getStoryKakaoKey();
        var done = safeGetItem(key,'') === '1';
        if(!done){
            setTimeout(function(){
                var btn = document.getElementById('story-kakao-done-btn');
                if(btn) btn.style.display = 'flex';
            }, 600);
        }
    };
    window.onStoryKakaoDone = function(){
        var key = getStoryKakaoKey();
        addPoint(10,'사연보내기_카카오', key);
        safeSetItem(key,'1');
        showToast('💛 +10PT 적립! 사연 감사해요 😊');
        launchConfetti();
        var btn = document.getElementById('story-kakao-done-btn');
        if(btn) btn.style.display = 'none';
        var msg = document.getElementById('story-kakao-done-msg');
        if(msg) msg.style.display = 'block';
    };
    function initStoryKakaoUI(){
        var key = getStoryKakaoKey();
        var done = safeGetItem(key,'') === '1';
        var btn = document.getElementById('story-kakao-done-btn');
        var msg = document.getElementById('story-kakao-done-msg');
        if(!btn || !msg) return;
        if(done){
            btn.style.display = 'none';
            msg.style.display = 'block';
        } else {
            btn.style.display = 'none';
            msg.style.display = 'none';
        }
    }

    window.setTomorrowRemind = function(){
        if(!('Notification' in window)){
            showToast('이 브라우저는 알림을 지원하지 않아요');
            return;
        }

        if(Notification.permission === 'granted'){
            document.getElementById('complete-reward-modal')?.remove();
            showToast('✅ 이미 알림이 설정되어 있어요! 설정에서 시간을 조정해보세요 🌿');
            setTimeout(()=> switchView('settings'), 1000);
            return;
        }

        if(Notification.permission === 'denied'){
            document.getElementById('complete-reward-modal')?.remove();
            // 차단된 경우 상세 안내 모달
            const guide = document.createElement('div');
            guide.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
            guide.innerHTML = `
                <div style="background:#FFFFFF;border-radius:20px;padding:28px 22px;width:88%;max-width:360px;text-align:center;">
                    <div style="font-size:36px;margin-bottom:12px;">🔔</div>
                    <div style="font-size:1em;font-weight:700;color:#1B4332;margin-bottom:10px;">알림 허용 방법</div>
                    <div style="background:#F5F5F5;border-radius:12px;padding:16px;margin-bottom:16px;text-align:left;">
                        <div style="font-size:0.88em;color:#333;line-height:2;">
                            📱 <b>안드로이드</b><br>
                            주소창 왼쪽 <b>🔒 자물쇠</b> 탭<br>
                            → <b>권한</b> → <b>알림 허용</b><br><br>
                            🍎 <b>아이폰 Safari</b><br>
                            주소창 왼쪽 <b>AA</b> 탭<br>
                            → <b>웹사이트 설정</b> → <b>알림 허용</b>
                        </div>
                    </div>
                    <div style="font-size:0.82em;color:#888;margin-bottom:16px;">설정 후 페이지를 새로고침해주세요</div>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">확인했어요</button>
                </div>`;
            document.body.appendChild(guide);
            return;
        }

        // 권한 미결정 → 안내 먼저 보여주고 요청
        document.getElementById('complete-reward-modal')?.remove();

        const preGuide = document.createElement('div');
        preGuide.id = 'notif-pre-guide';
        preGuide.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:20px;box-sizing:border-box;';
        preGuide.innerHTML = `
            <div style="background:#1B4332;border-radius:16px;padding:16px 20px;width:88%;max-width:360px;text-align:center;margin-bottom:16px;">
                <div style="font-size:0.82em;color:rgba(255,255,255,0.7);margin-bottom:4px;">👆 화면 위쪽을 확인해주세요</div>
                <div style="font-size:0.95em;font-weight:700;color:#C9A84C;">"허용" 또는 "Allow" 버튼을 눌러주세요!</div>
            </div>
            <div style="animation:arrowBounce 0.8s ease-in-out infinite;font-size:48px;">☝️</div>
            <div style="background:#FFFFFF;border-radius:20px;padding:24px 22px;width:88%;max-width:360px;text-align:center;margin-top:16px;">
                <div style="font-size:36px;margin-bottom:10px;">🔔</div>
                <div style="font-size:1em;font-weight:700;color:#1B4332;margin-bottom:8px;">매일 아침편지 알림 받기</div>
                <div style="font-size:0.85em;color:#666;line-height:1.6;margin-bottom:16px;">
                    지금 화면 위쪽에 팝업이 떴어요.<br>
                    <b style="color:#1B4332;">"허용"</b>을 눌러주시면<br>
                    내일부터 확언 알림이 와요 🌿
                </div>
                <button onclick="document.getElementById('notif-pre-guide').remove()" style="width:100%;min-height:48px;background:#F5F5F5;color:#888;border:none;border-radius:12px;font-size:0.9em;font-weight:600;cursor:pointer;">취소</button>
            </div>
            <style>@keyframes arrowBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}</style>`;
        document.body.appendChild(preGuide);

        // 팝업 안내 보여준 직후 권한 요청
        setTimeout(()=>{
            Notification.requestPermission().then(perm=>{
                document.getElementById('notif-pre-guide')?.remove();
                if(perm === 'granted'){
                    showToast('✅ 알림이 설정됐어요! 내일 아침 확언 알림이 올 거예요 🌿');
                    setTimeout(()=> switchView('settings'), 800);
                } else if(perm === 'denied'){
                    showToast('알림이 차단됐어요. 브라우저 설정에서 허용해주세요');
                }
            });
        }, 300);
    }

    /* ===== 💥 홈 오늘 추천 영상 1개 + 감정 훅 ===== */
    const YT_EMOTION_HOOKS = {
        sad:     '"왜 이렇게 힘든 걸까?" → 이 영상에서 이유를 알 수 있어요 🎬',
        neutral: '"무기력함을 끊는 방법" → 3분이면 달라져요 🎬',
        happy:   '"이 좋은 흐름, 더 키우는 법" → 지금 딱 맞는 영상이에요 🎬',
        default: '"오늘 당신에게 꼭 필요한 이야기" → 지금 바로 확인해보세요 🎬',
    };

    /* ===== ① 오늘의 핵심 질문 티저 ===== */
    // 테마별 질문 + 연결 영상 타입 정의


    // ★ 에피소드 DB - 키워드 매핑

    // 키워드 선택 → 매칭 영상 찾기 (점수 기반)
    function findMatchingEpisode(selectedKeywords){
        if(!selectedKeywords.length) return null;
        let scored = EPISODE_DB.map(ep => {
            const score = selectedKeywords.filter(k => ep.keywords.includes(k)).length;
            return { ...ep, score };
        }).filter(ep => ep.score > 0);
        if(!scored.length) return EPISODE_DB[EPISODE_DB.length-1]; // 최신 에피소드 fallback
        const maxScore = Math.max(...scored.map(e => e.score));
        const top = scored.filter(e => e.score === maxScore);
        return top[Math.floor(Math.random() * top.length)]; // 동점이면 랜덤
    }

    function renderKeyQuestion(){
        const box = document.getElementById('key-question-box');
        if(!box) return;

        // dayCount를 직접 계산 (renderScreen과 동일한 로직)
        const msPerDay = 86400000;
        const startOf2026 = new Date(2026, 0, 1);
        const localDayCount = Math.floor((selectedDateObj - startOf2026) / msPerDay) + 1;
        const di   = (localDayCount - 1) % affirmationsData.length;
        const data = affirmationsData[di];
        if(!data){ box.style.display='none'; return; }

        const theme = data.theme || '';
        // 테마 키워드 매칭
        let matched = THEME_QUESTIONS.default;
        for(let key of Object.keys(THEME_QUESTIONS)){
            if(key !== 'default' && theme.includes(key)){
                matched = THEME_QUESTIONS[key]; break;
            }
        }

        document.getElementById('key-question-text').textContent = matched.q;

        // ③ Shorts vs 롱폼 문구 구분
        const isShorts = matched.type === 'shorts';
        document.getElementById('key-question-duration').textContent =
            isShorts ? '📱 Shorts · 1분 이내'
                     : '🎙 인생2막라디오 에피소드';

        // 링크 연결 (에피소드 있으면 해당 URL, 없으면 채널)
        const link = document.getElementById('key-question-link');
        if(data.episode && data.episode.trim()){
            // 실제 에피소드 있을 때 → 약속 유지
            link.href = data.episode;
            document.getElementById('key-question-cta').textContent =
                isShorts ? '1분이면 충분해요 — 답이 여기 있어요 🎬'
                         : '이 이야기에서 이유를 알 수 있어요 🎬';
        } else if(latestEpisode && latestEpisode.url){
            // 최신 에피소드만 있을 때 → 부드러운 초대
            link.href = latestEpisode.url;
            document.getElementById('key-question-cta').textContent = '비슷한 감정, 함께 이야기해요 🎙';
        } else {
            // 채널만 있을 때 → 박스 숨김 (약속 불이행 방지)
            box.style.display = 'none';
            return;
        }

        box.style.display = 'block';
        renderKeywordChips();
    }


    // ★ 키워드 칩 UI
    const ALL_KEYWORDS = [
        {label:'💔 상처', key:'상처'},
        {label:'😔 외로움', key:'외로움'},
        {label:'🌱 자존감', key:'자존감'},
        {label:'😰 거절당함', key:'거절당함'},
        {label:'🤝 인간관계', key:'인간관계'},
        {label:'👨‍👩‍👧 가족관계', key:'가족관계'},
        {label:'😴 번아웃', key:'번아웃'},
        {label:'😶 우울', key:'우울'},
        {label:'🫶 위로', key:'위로'},
        {label:'💚 감정회복', key:'감정회복'},
        {label:'🙅 거절못함', key:'거절못함'},
        {label:'🌀 마음치유', key:'마음치유'},
        {label:'🚀 변화/성장', key:'변화'},
        {label:'🎭 가짜인연', key:'가짜인연'},
        {label:'💛 착한사람', key:'착한사람'},
        {label:'🔗 헌신/배려', key:'헌신'},
    ];
    let selectedKeywords = [];

    function renderKeywordChips(){
        const container = document.getElementById('keyword-chips');
        if(!container) return;
        selectedKeywords = [];
        container.innerHTML = '';
        ALL_KEYWORDS.forEach(function(kw){
            const btn = document.createElement('button');
            btn.textContent = kw.label;
            btn.dataset.key = kw.key;
            btn.style.cssText = 'padding:5px 12px;border-radius:20px;border:1.5px solid var(--border-color);background:var(--card-bg);color:var(--text-muted);font-size:0.78em;cursor:pointer;transition:all 0.2s;';
            btn.addEventListener('click', function(){ toggleKeyword(btn, kw.key); });
            container.appendChild(btn);
        });
        const findBtn = document.getElementById('keyword-find-btn');
        if(findBtn) findBtn.style.display = 'none';
    }

    window.toggleKeyword = function(el, key){
        const idx = selectedKeywords.indexOf(key);
        if(idx > -1){
            selectedKeywords.splice(idx, 1);
            el.style.background = 'var(--card-bg)';
            el.style.color = 'var(--text-muted)';
            el.style.borderColor = 'var(--border-color)';
        } else {
            selectedKeywords.push(key);
            el.style.background = 'var(--primary-color)';
            el.style.color = '#fff';
            el.style.borderColor = 'var(--primary-color)';
        }
        const btn = document.getElementById('keyword-find-btn');
        if(btn) btn.style.display = selectedKeywords.length > 0 ? 'block' : 'none';
    };

    window.openKeywordEpisode = function(){
        const ep = findMatchingEpisode(selectedKeywords);
        if(!ep){ showToast('매칭되는 영상이 없어요'); return; }
        showToast('🎬 ' + ep.title);
        setTimeout(()=>{ window.open(ep.url, '_blank'); }, 300);
    };


    /* ===== ③ Shorts/롱폼 문구 구분 (홈 추천 카드) ===== */
    function renderHomeYTRecommend(){
        const box = document.getElementById('home-yt-recommend');
        if(!box) return;
        const availableShorts = (typeof SHORTS_DATA !== 'undefined')
            ? SHORTS_DATA.filter(s=>s.url&&s.url.trim()!=='') : [];
        const hasContent = (latestEpisode&&latestEpisode.title) || availableShorts.length>0;
        if(!hasContent){
            // fallback: 최신 에피소드 하드코딩
            document.getElementById('home-yt-title').textContent = '좋게 변하려 하면 가까운 사람이 멀어지는 이유';
            document.getElementById('home-yt-hook').textContent = '오늘 당신에게 꼭 필요한 이야기예요 🎬';
            const lnk = document.getElementById('home-yt-link');
            if(lnk) lnk.href = 'https://www.youtube.com/watch?v=t7QbS_CJJso&list=PLD0aoVhJxK0qyi9nBysVexOtXJeI77J6O';
            const durEl = document.getElementById('home-yt-duration');
            if(durEl) durEl.textContent = '🎙 에피소드 · 인생2막라디오';
            box.style.display = 'block';
            return;
        }

        const pattern = analyzeRecentMood();
        // 감정별 훅 (Shorts/롱폼 구분)
        const HOOKS = {
            sad: {
                episode: '왜 이렇게 힘든 건지 — 이 이야기에서 이유를 알 수 있어요 🎬',
                shorts:  '딱 1분 — 지금 이 감정의 이유가 여기 있어요 🎬'
            },
            neutral: {
                episode: '무기력함을 끊는 방법 — 지금 당신에게 꼭 맞는 이야기예요 🎬',
                shorts:  '1분이면 충분해요 — 다시 불꽃을 찾아드릴게요 🎬'
            },
            happy: {
                episode: '이 좋은 흐름을 더 키우는 법 — 오늘 딱 맞는 이야기예요 🎬',
                shorts:  '1분 — 이 에너지 계속 이어가는 방법이에요 🎬'
            },
            default: {
                episode: '오늘 당신에게 꼭 필요한 이야기예요 🎬',
                shorts:  '1분이면 충분해요 — 오늘 당신에게 필요한 것 🎬'
            }
        };

        let title, url, isShort = false;
        if(latestEpisode&&latestEpisode.title){
            title=latestEpisode.title; url=latestEpisode.url; isShort=false;
        } else if(availableShorts.length>0){
            const s=availableShorts[0]; title=s.title; url=s.url; isShort=true;
        }

        const hookSet = HOOKS[pattern] || HOOKS.default;
        const hook    = isShort ? hookSet.shorts : hookSet.episode;
        const durText = isShort ? '📱 Shorts · 1분 이내' : '🎙 에피소드 · 인생2막라디오';

        document.getElementById('home-yt-title').textContent = title;
        document.getElementById('home-yt-hook').textContent  = hook;
        document.getElementById('home-yt-link').href         = url;

        // 재생 시간 표시 추가
        const durEl = document.getElementById('home-yt-duration');
        if(durEl) durEl.textContent = durText;

        box.style.display = 'block';
    }

    window.startSTT = function(){
        const affirmEl = document.getElementById('affirmation-text');
        if(!affirmEl || affirmEl.closest('.blurred-content')){
            showToast('먼저 기분을 선택해 확언을 열어주세요!'); return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if(!SR){ showToast('음성인식 미지원 브라우저예요. 안드로이드 Chrome에서 사용해주세요!'); return; }

        // file:// 환경에서는 마이크 사용 불가 안내
        if(location.protocol === 'file:'){
            const g = document.createElement('div');
            g.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
            g.innerHTML = `
                <div style="background:#FFFFFF;border-radius:20px;padding:28px 22px;width:88%;max-width:360px;text-align:center;">
                    <div style="font-size:36px;margin-bottom:10px;">🎤</div>
                    <div style="font-size:1em;font-weight:700;color:#1B4332;margin-bottom:10px;">인터넷 주소에서 사용 가능해요</div>
                    <div style="font-size:0.88em;color:#666;line-height:1.7;margin-bottom:16px;">
                        음성인식은 보안상 파일로 열 때는<br>작동하지 않아요.<br><br>
                        <b style="color:#1B4332;">GitHub Pages에 올린 후</b><br>
                        인터넷 주소로 접속하면<br>
                        정상 작동해요 🌿
                    </div>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">확인</button>
                </div>`;
            document.body.appendChild(g);
            return;
        }

        startSTTCore(affirmEl);
    }

    function startSTTCore(affirmEl){
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if(!SR) return;
        if(sttRecognition){ try{ sttRecognition.stop(); }catch(e){} sttRecognition = null; }
        sttActive = true; sttRetryCount = 0;
        let sessionFinal = ''; // 재시작해도 누적 유지

        const sttBox=document.getElementById('stt-box');
        const sttStatus=document.getElementById('stt-status');
        const sttResult=document.getElementById('stt-result-text');
        const sttWave=document.getElementById('stt-wave');
        if(sttBox) sttBox.style.display='block';
        if(sttResult) sttResult.textContent='';
        if(sttStatus) sttStatus.textContent='🎤 확언을 소리내어 읽어주세요...';
        if(sttWave) sttWave.style.display='flex';

        const target = affirmEl.innerText.replace(/\s+/g,' ').trim();

        function createRec(){
            const r = new SR(); // sessionFinal은 startSTTCore 스코프에서 공유
            r.lang='ko-KR';
            r.continuous=true;
            r.interimResults=true;
            r.maxAlternatives=1;
            r.onstart=function(){ if(sttStatus) sttStatus.textContent='🎤 읽고 계신 내용이 인식되고 있어요...'; };
            r.onresult=function(e){
                let interim='';
                for(let i=e.resultIndex;i<e.results.length;i++){
                    if(e.results[i].isFinal) sessionFinal+=e.results[i][0].transcript;
                    else interim+=e.results[i][0].transcript;
                }
                const combined=sessionFinal+interim;
                const progress=Math.min(Math.round(calcSimilarity(combined,target)*100),100);
                const bar=document.getElementById('stt-progress-bar');
                const resultEl=document.getElementById('stt-result-text');
                if(bar) bar.style.width=progress+'%';
                if(resultEl) resultEl.textContent=progress+'%';
                if(combined && calcSimilarity(combined,target)>0.75){
                    sttActive=false; try{r.stop();}catch(e){} sttRecognition=null; sttSuccess();
                }
            };
            r.onend=function(){
                if(!sttActive) return;
                if(sttRetryCount<5){
                    sttRetryCount++;
                    setTimeout(()=>{
                        if(!sttActive) return;
                        try{ sttRecognition=createRec(); sttRecognition.start(); }
                        catch(err){ stopSTT(); }
                    }, 300);
                } else { stopSTT(); showToast('음성을 인식하지 못했어요. 다시 눌러보세요 😊'); }
            };
            r.onerror=function(e){
                if(!sttActive) return;
                sttActive=false; sttRecognition=null;
                if(sttBox) sttBox.style.display='none';
                if(e.error==='not-allowed'){
                    const g=document.createElement('div');
                    g.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
                    g.innerHTML=`<div style="background:#FFFFFF;border-radius:20px;padding:28px 22px;width:88%;max-width:360px;text-align:center;"><div style="font-size:36px;margin-bottom:10px;">🎤</div><div style="font-size:1em;font-weight:700;color:#1B4332;margin-bottom:12px;">마이크 허용이 필요해요</div><div style="background:#F5F5F5;border-radius:12px;padding:14px;margin-bottom:16px;text-align:left;font-size:0.88em;color:#333;line-height:2;">📱 <b>안드로이드</b><br>주소창 🔒 탭 → <b>마이크 허용</b><br><br>🍎 <b>아이폰</b><br>설정 → Safari → <b>마이크 허용</b></div><button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;min-height:48px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">확인</button></div>`;
                    document.body.appendChild(g);
                } else if(e.error==='no-speech'){
                    return; // no-speech는 무시 (멈춤 허용)
                } else if(e.error==='network'){
                    showToast('인터넷 연결을 확인해주세요');
                } else {
                    showToast('음성인식 오류: '+e.error);
                }
            };
            return r;
        }

        try{ sttRecognition=createRec(); sttRecognition.start(); }
        catch(e){ stopSTT(); showToast('음성인식을 시작할 수 없어요. 크롬 브라우저를 사용해보세요.'); }
    }


    // 수동 완료 버튼
    window.sttManualSuccess = function(){
        sttActive = false;
        sttRetryCount = 0;
        if(sttRecognition){ try{ sttRecognition.stop(); }catch(e){} sttRecognition = null; }
        sttSuccess();
    }

    window.stopSTT = function(){
        sttActive=false; sttRetryCount=0;
        if(sttRecognition){ try{ sttRecognition.stop(); }catch(e){} sttRecognition=null; }
        const box=document.getElementById('stt-box');
        if(box) box.style.display='none';
    }

    function calcSimilarity(spoken, target){
        // 한글/숫자만 남기고 정리
        const clean = s => s.replace(/[^가-힣a-z0-9]/gi, ' ').trim().toLowerCase();
        const sp = clean(spoken);
        const tg = clean(target);
        if(!tg.length) return 0;

        // 어절(단어) 단위로 분리
        const spWords = sp.split(/\s+/).filter(w => w.length >= 1);
        const tgWords = tg.split(/\s+/).filter(w => w.length >= 1);
        if(!tgWords.length) return 0;

        // 목표 어절 중 몇 개가 인식됐는지 체크 (앞 2글자 이상 일치)
        let matched = 0;
        const used = new Set();
        for(const tw of tgWords){
            const stem = tw.substring(0, Math.min(tw.length, 2));
            for(let i=0; i<spWords.length; i++){
                if(!used.has(i) && spWords[i].includes(stem)){
                    matched++; used.add(i); break;
                }
            }
        }
        return matched / tgWords.length;
    }

    function sttSuccess(){
        const box = document.getElementById('stt-box');
        document.getElementById('stt-status').textContent = '🎉 완벽해요! 뇌에 긍정의 힘이 새겨졌습니다!';
        document.getElementById('stt-wave').style.display = 'none';
        box.style.display = 'block';
        launchConfetti();
        // 완료 처리 + 팝업 (이미 완료돼도 팝업은 항상 표시)
        const cd = safeGetJSON('completed_dates',[]);
        addPoint(1,'따라읽기','stt');
        if(!cd.includes(getFormatDate(selectedDateObj))){
            completeToday(); // 완료 처리
            // STT 성공 팝업 (completeToday의 reward_shown 무시하고 항상)
            setTimeout(function(){ const cd2=safeGetJSON('completed_dates',[]); showSTTSuccessPopup(cd2.length, calcCurrentStreak(cd2)); }, 400);
        } else {
            // 이미 완료됐어도 따라읽기 성공 팝업 표시 (reward_shown 무시)
            const streak = calcCurrentStreak(cd);
            showSTTSuccessPopup(cd.length, streak);
        }
        setTimeout(()=>{ box.style.display='none'; document.getElementById('stt-wave').style.display='flex'; }, 3500);
    }

    function launchConfetti(){
        const colors=['#1B4332','#C9A84C','#52B788','#FFD700','#FF6B6B','#74C69D'];
        for(let i=0;i<60;i++){
            const el=document.createElement('div');
            el.className='confetti';
            el.style.cssText=`left:${Math.random()*100}vw;top:-10px;background:${colors[Math.floor(Math.random()*colors.length)]};animation-delay:${Math.random()}s;width:${Math.random()*8+6}px;height:${Math.random()*8+6}px;`;
            document.body.appendChild(el);
            setTimeout(()=>el.remove(), 3000);
        }
    }

    /* ===== ★ 닉네임 인사말 ===== */
    function renderNicknameGreeting(){
        const nick = safeGetItem('my_nickname', '');
        const box  = document.getElementById('nickname-greeting-box');
        if(!box) return;
        if(!nick){ box.style.display='none'; return; }

        const today     = getTodayStr();
        const lastVisit = safeGetItem('last_visit_date', '');
        const cd        = safeGetJSON('completed_dates', []);
        const isFirstEver = cd.length === 0 && !lastVisit;

        // 방문일 기록 (오늘 처음 열었을 때만)
        if(lastVisit !== today){
            safeSetItem('last_visit_date', today);
        }

        const yesterday = (()=>{ const d=new Date(todayObj); d.setDate(d.getDate()-1); return getFormatDate(d); })();
        const daysDiff  = lastVisit ? Math.floor((new Date(today) - new Date(lastVisit)) / 86400000) : 999;

        let msg = '';
        if(isFirstEver){
            msg = `처음 오셨군요! 반가워요 😊`;
        } else if(lastVisit === today){
            // 오늘 이미 방문 기록 있음 → 재접속
            msg = `오늘도 오셨군요! 대단해요 🌿`;
        } else if(daysDiff <= 1){
            msg = `어제에 이어 오늘도! 연속 중이에요 💚`;
        } else if(daysDiff <= 3){
            msg = `며칠 만이에요! 잘 오셨어요 🌿`;
        } else if(daysDiff <= 6){
            msg = `일주일이 다 됐네요! 반가워요 😊`;
        } else {
            msg = `오랜만이에요! 오늘부터 다시 함께해요 🌱`;
        }

        document.getElementById('nickname-greeting-text').textContent = `${nick}님, ${msg}`;
        box.style.display = 'block';
    }

    /* ===== ★ 100일 달성 이메일 알림 ===== */
    function check100DayNotify(){
        const cd = safeGetJSON('completed_dates', []);
        if(cd.length < 100) return;
        if(safeGetItem('notified_100day', '') === '1') return; // 이메일 전송 완료 시에만 생략

        const nick = safeGetItem('my_nickname', '익명');
        const g = document.createElement('div');
        g.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9998;display:flex;align-items:center;justify-content:center;';
        g.innerHTML = `
            <div style="background:#FFFFFF;border-radius:24px;padding:28px 22px;width:90%;max-width:380px;text-align:center;">
                <div style="font-size:52px;margin-bottom:10px;">🌟</div>
                <div style="font-size:1.3em;font-weight:700;color:#1B4332;margin-bottom:8px;">100일 달성!</div>
                <div style="font-size:0.9em;color:#555;line-height:1.7;margin-bottom:20px;">
                    <b>${nick}</b>님, 100일을 해내셨어요!<br>
                    인생2막라디오에 알려주시면<br>
                    유튜브 영상에서 직접 이름을 불러드려요 🎙
                </div>
                <button onclick="send100DayEmail('${nick}', ${cd.length})" style="width:100%;min-height:52px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;margin-bottom:10px;">📧 인생2막라디오에 알리기</button>
                <button onclick="safeSetItem('notified_100day','1'); this.closest('div[style*=fixed]').remove();" style="width:100%;min-height:44px;background:none;border:1px solid #E8E5E0;border-radius:12px;font-size:0.88em;color:#888;cursor:pointer;margin-bottom:8px;">괜찮아요, 보내지 않을게요</button>
                <button onclick="this.closest('div[style*=fixed]').remove();" style="width:100%;min-height:40px;background:none;border:none;font-size:0.82em;color:#bbb;cursor:pointer;">나중에 할게요</button>
            </div>`;
        document.body.appendChild(g);
    }

    window.send100DayEmail = function(nick, days){
        const subject = encodeURIComponent(`[100일 달성 인증] ${nick}님`);
        const body    = encodeURIComponent(
            `안녕하세요 인생2막라디오!\n\n이름: ${nick}\n달성일수: ${days}일\n달성날짜: ${getTodayStr()}\n\n100일을 달성했어요! 🌟`
        );
        window.location.href = `mailto:life2radio@gmail.com?subject=${subject}&body=${body}`;
        safeSetItem('notified_100day', '1');
        document.querySelectorAll('div[style*="position:fixed"]').forEach(el=>{
            if(el.innerHTML.includes('100일 달성')) el.remove();
        });
        showToast('📧 이메일 앱이 열렸어요! 전송해주세요 😊');
    }

    /* ===== ★ 포인트 시스템 ===== */
    const LEVELS = [
        {name:'씨앗',             emoji:'🌱', min:0},
        {name:'새싹',             emoji:'🌿', min:50},
        {name:'풀잎',             emoji:'🍀', min:150},
        {name:'확언러 (나무)',    emoji:'🌳', min:350},
        {name:'실천가 (숲)',      emoji:'🌲', min:680},
        {name:'인생2막러 (산)',   emoji:'🏔️', min:1150},
        {name:'라디오스타 (구름)',emoji:'☁️', min:1780},
        {name:'인생챔피언 (빛)', emoji:'✨', min:2300},
    ];

    // [탑(TOP)이 개선한 포인트 중앙 관리 로직]
    function getPoints() { 
        let pts = appState.get('user', 'points');
        // 기존 유저의 포인트가 남아있다면, 새 심장으로 안전하게 이사시킴 (데이터 증발 방지)
        if (pts === 0 && localStorage.getItem('user_points')) {
            pts = parseInt(localStorage.getItem('user_points')) || 0;
            appState.set('user', 'points', pts);
        }
        return pts; 
    }
    function setPoints(p) { 
        const finalPts = Math.max(0, p);
        appState.set('user', 'points', finalPts); 
        localStorage.setItem('user_points', String(finalPts)); // 구버전 안전 호환용
    }

    function getLevel(pts){
        let lv = 0;
        for(let i=0;i<LEVELS.length;i++){ if(pts>=LEVELS[i].min) lv=i; }
        return lv;
    }

    // 포인트 지급 (하루 1회 제한 있는 항목은 key 전달)
    const DAILY_MAX_PT = 23;

    let _pendingLevelUp = -1; // 레벨업 대기 인덱스

    window.addPoint = function(amount, reason, dailyKey){
        if(dailyKey){
            const k = `pt_daily_${dailyKey}_${getTodayStr()}`;
            if(safeGetItem(k,'') === '1') return; // 오늘 이미 지급
            safeSetItem(k,'1');
        }

        // 하루 최대 25점 한도 체크 (첫방문 30pt는 예외)
        if(reason !== '첫 방문 기념'){
            const todayKey = `pt_today_total_${getTodayStr()}`;
            const todayTotal = parseInt(safeGetItem(todayKey,'0'))||0;
            if(todayTotal >= DAILY_MAX_PT) return; // 한도 초과
            const actual = Math.min(amount, DAILY_MAX_PT - todayTotal);
            safeSetItem(todayKey, String(todayTotal + actual));
            amount = actual;
            if(amount <= 0) return;
        }

        const before = getPoints();
        const after  = before + amount;
        setPoints(after);

        const lvBefore = getLevel(before);
        const lvAfter  = getLevel(after);

        // 포인트 애니메이션
        showPointAnim(amount);

        // 포인트 바 업데이트
        renderPointBar();

        // 레벨업 체크
        if(lvAfter > lvBefore){
            setTimeout(()=> showLevelUp(lvAfter), 800);
            
            // ★ 새싹 달성(레벨 1)했는데 아직 등록 안 했으면 등록 모달 표시
            if(lvAfter === 1){ // 새싹 레벨
                const nick = safeGetItem('my_nickname','');
                const email = safeGetItem('my_email','');
                if(!nick || !email){
                    setTimeout(()=> showSproutRegistrationModal(), 2000);
                }
            }
        }

        // 점수 삭감 타이머 갱신
        safeSetItem('last_activity_date', getTodayStr());
    }

    // ★ 새싹 달성 등록 유도 모달
    function showSproutRegistrationModal(){
        const modal = document.createElement('div');
        modal.id = 'sprout-registration-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(3px);
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 24px;
                padding: 32px 24px;
                width: 90%;
                max-width: 380px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="font-size: 56px; margin-bottom: 16px;">🌱</div>
                
                <div style="
                    font-size: 1.3em;
                    font-weight: 900;
                    color: #1B4332;
                    margin-bottom: 12px;
                ">새싹이 되셨어요!</div>
                
                <div style="
                    font-size: 0.95em;
                    color: #666;
                    line-height: 1.8;
                    margin-bottom: 28px;
                ">
                    축하합니다! 🎉<br><br>
                    이제 커뮤니티 참여와<br>
                    매일 아침 확언 알림을<br>
                    받을 수 있어요!
                </div>
                
                <div style="
                    background: #f5f5f5;
                    border-radius: 15px;
                    padding: 16px;
                    margin-bottom: 22px;
                    text-align: left;
                ">
                    <div style="
                        font-size: 0.85em;
                        font-weight: 700;
                        color: #1B4332;
                        margin-bottom: 8px;
                    ">이름 또는 닉네임</div>
                    <input 
                        type="text" 
                        id="sprout-nick-input"
                        placeholder="예: 전주 60대"
                        style="
                            width: 100%;
                            padding: 11px;
                            border: 1.5px solid #ddd;
                            border-radius: 8px;
                            font-size: 0.95em;
                            margin-bottom: 12px;
                            box-sizing: border-box;
                            outline: none;
                        "
                    >
                    
                    <div style="
                        font-size: 0.85em;
                        font-weight: 700;
                        color: #1B4332;
                        margin-bottom: 8px;
                    ">이메일</div>
                    <button id="sprout-google-btn" style="width:100%;padding:11px;font-size:0.9em;border:1.5px solid #4285F4;border-radius:8px;background:#fff;color:#444;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
                        <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
                        G 구글 계정에서 이메일 가져오기
                    </button>
                    <input 
                        type="email" 
                        id="sprout-email-input"
                        placeholder="또는 이메일 직접 입력"
                        style="
                            width: 100%;
                            padding: 11px;
                            border: 1.5px solid #ddd;
                            border-radius: 8px;
                            font-size: 0.95em;
                            box-sizing: border-box;
                            outline: none;
                        "
                    >
                </div>
                
                <button 
                    onclick="processSproutRegistration()"
                    style="
                        width: 100%;
                        min-height: 56px;
                        background: #1B4332;
                        color: white;
                        border: none;
                        border-radius: 14px;
                        font-size: 1.05em;
                        font-weight: 900;
                        cursor: pointer;
                        margin-bottom: 10px;
                        box-shadow: 0 8px 20px rgba(27,67,50,0.3);
                    "
                >
                    지금 등록하기 🌿
                </button>
                
                <div style="font-size:0.78em;color:#aaa;line-height:1.6;margin-top:4px;">
                    이름과 이메일 등록 후 새싹 등업이 완료돼요 🌱<br>
                    등록 정보는 성장 리포트 발송에만 사용돼요
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // 구글 버튼 이벤트
        var _sproutGoogleBtn = document.getElementById('sprout-google-btn');
        if(_sproutGoogleBtn) _sproutGoogleBtn.addEventListener('click', function(){
            window._googleOneTap();
            window.addEventListener('message', function _sproutMsg(e){
                if(e.data && e.data.type === 'oauth_email'){
                    window.removeEventListener('message', _sproutMsg);
                    var emailEl = document.getElementById('sprout-email-input');
                    var nickEl  = document.getElementById('sprout-nick-input');
                    if(emailEl && e.data.email) emailEl.value = e.data.email;
                    if(nickEl  && !nickEl.value && e.data.name) nickEl.value = e.data.name;
                    showToast('✅ 구글 계정 정보가 입력됐어요!');
                }
            });
        });
    }

    // ★ 새싹 등록 처리
    window.processSproutRegistration = function(){
        const nickInput = document.getElementById('sprout-nick-input');
        const emailInput = document.getElementById('sprout-email-input');
        
        if(!nickInput || !nickInput.value.trim()){
            showToast('이름을 입력해주세요!');
            return;
        }
        if(!emailInput || !emailInput.value.trim()){
            showToast('이메일을 입력해주세요!');
            return;
        }
        
        // 정보 저장
        safeSetItem('my_nickname', nickInput.value.trim());
        safeSetItem('my_email', emailInput.value.trim());
        
        // UI 업데이트
        const ni = document.getElementById('nickname-input');
        if(ni) ni.value = nickInput.value.trim();
        const ei = document.getElementById('user-email-input');
        if(ei) ei.value = emailInput.value.trim();
        const se = document.getElementById('story-email');
        if(se) se.value = emailInput.value.trim();
        
        // 모달 닫기
        const modal = document.getElementById('sprout-registration-modal');
        if(modal) modal.remove();
        
        showToast('🎉 가입 완료되었습니다!');
    }

    // ★ 그룹채팅 접근 권한 체크 (새싹 등급 이상 필수)
    window.checkLevelAndOpenGroupChat = function(){
        const pts = getPoints();
        const lvl = getLevel(pts);
        
        // 새싹 등급(lvl >= 1) 체크
        if(lvl < 1){
            // 새싹 미달 → 게이팅 모달
            showGroupChatGatedModal();
            return;
        }
        
        // 새싹 등급 이상 → 그룹채팅 오픈
        addPoint(2,'앱소개공유','share_app');
        window.open('https://open.kakao.com/o/gr3RC2pi','_blank');
    }

    // ★ 그룹 채팅 게이팅 모달
    function showGroupChatGatedModal(){
        const modal = document.createElement('div');
        modal.id = 'group-chat-gated-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(3px);
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 24px;
                padding: 32px 24px;
                width: 90%;
                max-width: 380px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="font-size: 52px; margin-bottom: 16px;">🔒</div>
                
                <div style="
                    font-size: 1.25em;
                    font-weight: 900;
                    color: #1B4332;
                    margin-bottom: 12px;
                ">커뮤니티는 새싹부터!</div>
                
                <div style="
                    font-size: 0.95em;
                    color: #666;
                    line-height: 1.8;
                    margin-bottom: 24px;
                ">
                    새싹 등급이 되면<br>
                    <strong style="color: #1B4332;">그룹 채팅 커뮤니티에</strong><br>
                    참여할 수 있어요!<br><br>
                    <span style="font-size: 0.9em;">확언을 읽고 포인트를<br>모으면 금방이에요 🌱</span>
                </div>
                
                <div style="
                    background: #FFF8E7;
                    border-left: 4px solid #C9A84C;
                    padding: 12px;
                    border-radius: 8px;
                    margin-bottom: 22px;
                    font-size: 0.85em;
                    color: #555;
                    text-align: left;
                ">
                    💡 <strong>팁:</strong> 매일 확언을 읽고, 기분을 선택하면<br>
                    금방 새싹이 될 수 있어요!
                </div>
                
                <button 
                    onclick="document.getElementById('group-chat-gated-modal').remove(); switchView('home')"
                    style="
                        width: 100%;
                        min-height: 54px;
                        background: #1B4332;
                        color: white;
                        border: none;
                        border-radius: 14px;
                        font-size: 1em;
                        font-weight: 900;
                        cursor: pointer;
                        margin-bottom: 10px;
                    "
                >
                    확언 읽으러 가기 🌿
                </button>
                
                <button 
                    onclick="document.getElementById('group-chat-gated-modal').remove()"
                    style="
                        width: 100%;
                        min-height: 44px;
                        background: none;
                        border: none;
                        color: #999;
                        font-size: 0.9em;
                        cursor: pointer;
                        text-decoration: underline;
                    "
                >
                    닫기
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // 포인트 떠오르는 애니메이션
    function showPointAnim(amount){
        const el = document.createElement('div');
        const size  = amount >= 50 ? 28 : amount >= 10 ? 22 : 16;
        const icon  = amount >= 50 ? '💫' : amount >= 10 ? '🌟' : '✨';
        el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:120px;z-index:99999;font-size:'+size+'px;font-weight:700;color:#C9A84C;pointer-events:none;animation:ptFloat 1.6s ease forwards;white-space:nowrap;';
        el.textContent = icon + ' +' + amount + 'PT';
        document.body.appendChild(el);
        setTimeout(function(){ if(el.parentNode) el.remove(); }, 1700);
    }

    // 레벨업 팝업
    function showLevelUp(lvIdx){
        const lv = LEVELS[lvIdx];

        // ★ 이름+이메일 미등록 시 → 레벨업 보류 + 등록 팝업
        const nick = safeGetItem('my_nickname','');
        const email = safeGetItem('my_email','');
        if(!nick || !email){
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `
                <div style="background:#FFFFFF;border-radius:24px;padding:32px 24px;width:90%;max-width:360px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:12px;">${lv.emoji}</div>
                    <div style="font-size:1.1em;font-weight:700;color:#1B4332;margin-bottom:8px;">${lv.name} 등급까지 왔어요!</div>
                    <div style="font-size:0.88em;color:#555;line-height:1.8;margin-bottom:20px;">
                        레벨업 기록을 저장하려면<br>
                        <b style="color:#1B4332;">이름과 이메일 등록</b>이 필요해요.<br>
                        등록하면 바로 레벨업이 확정돼요! 🎉
                    </div>
                    <button onclick="this.closest('div[style*=fixed]').remove();showNicknameModal();_pendingLevelUp=${lvIdx};"
                        style="width:100%;min-height:52px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;margin-bottom:10px;">
                        🏅 등록하고 레벨업 받기
                    </button>
                    <button onclick="this.closest('div[style*=fixed]').remove();"
                        style="width:100%;min-height:44px;background:none;border:1px solid #CCC;border-radius:14px;font-size:0.9em;color:#888;cursor:pointer;">
                        나중에 할게요
                    </button>
                </div>`;
            document.body.appendChild(modal);
            return; // 등록 전까지 레벨업 팝업 보류
        }

        window._sendLevelUp(lv.name);
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#FFFFFF;border-radius:24px;padding:32px 24px;width:90%;max-width:360px;text-align:center;">
                <div style="font-size:64px;margin-bottom:8px;">${lv.emoji}</div>
                <div style="font-size:0.85em;color:#C9A84C;font-weight:700;letter-spacing:1px;margin-bottom:6px;">LEVEL UP!</div>
                <div style="font-size:1.4em;font-weight:700;color:#1B4332;margin-bottom:8px;">${lv.name} 등급 달성!</div>
                <div style="font-size:0.88em;color:#666;line-height:1.7;margin-bottom:20px;">
                    꾸준히 함께해주셔서 감사해요 🌿<br>앞으로도 매일 함께해요!
                </div>
                <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;min-height:50px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">감사해요! 🎉</button>
            </div>`;
        document.body.appendChild(modal);
        launchConfetti();
    }

    // 점수 삭감 (7일 이상 결석)
    function checkPointDeduction(){
        const last = safeGetItem('last_activity_date','');
        if(!last) return;
        const diff = Math.floor((todayObj - new Date(last)) / 86400000);
        if(diff === 0) return;

        // ① 포인트 삭감 (3일째부터 하루 1점)
        if(diff >= 3){
            const deduct = diff - 2; // 3일째부터 1점씩
            const alreadyKey = `pt_deduct_${getTodayStr()}`;
            if(safeGetItem(alreadyKey,'') !== '1'){
                safeSetItem(alreadyKey,'1');
                const before = getPoints();
                setPoints(before - deduct);
            }
        }

        // ② 등급 하락 (15일째)
        if(diff >= 15){
            const alreadyDrop = `pt_lvdrop_${safeGetItem('last_activity_date','')}`;
            if(safeGetItem(alreadyDrop,'') !== '1'){
                safeSetItem(alreadyDrop,'1');
                const curLv = parseInt(safeGetItem('user_level_override','-1'));
                const calcLv = getLevel(getPoints());
                const baseLv = curLv >= 0 ? curLv : calcLv;
                if(baseLv > 0){
                    const newLv = baseLv - 1;
                    safeSetItem('user_level_override', String(newLv));
                    showLevelDrop(newLv);
                }
            }
        }

        // ③ 경고 배너 표시
        renderAbsenceBanner(diff);
    }

    // 등급 하락 팝업
    function showLevelDrop(lvIdx){
        const lv = LEVELS[lvIdx];
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#FFFFFF;border-radius:24px;padding:32px 24px;width:90%;max-width:360px;text-align:center;">
                <div style="font-size:52px;margin-bottom:8px;">😔</div>
                <div style="font-size:1.1em;font-weight:700;color:#C0392B;margin-bottom:8px;">등급이 하락했어요</div>
                <div style="font-size:1.3em;font-weight:700;color:#1B4332;margin-bottom:12px;">${lv.emoji} ${lv.name}</div>
                <div style="font-size:0.88em;color:#666;line-height:1.7;margin-bottom:20px;">
                    15일 이상 자리를 비우셨군요.<br>
                    오늘 유튜브 쇼츠를 보고<br>
                    <b style="color:#1B4332;">시크릿 코드를 입력하면<br>등급이 즉시 회복돼요! 📺</b>
                </div>
                <button onclick="this.closest('div[style*=fixed]').remove()" style="width:100%;min-height:50px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">확인했어요</button>
            </div>`;
        document.body.appendChild(modal);
    }

    // 결석 경고 배너 렌더링
    function renderAbsenceBanner(diff){
        const existing = document.getElementById('absence-banner');
        if(existing) existing.remove();
        if(diff === null || diff === undefined){
            const last = safeGetItem('last_activity_date','');
            if(!last) return;
            diff = Math.floor((todayObj - new Date(last)) / 86400000);
        }
        if(diff < 7) return;
        let msg = '', color = '', bg = '';
        if(diff >= 14){
            msg = '🔴 내일이면 등급이 하락해요!! 지금 확언 완료하세요!';
            color = '#C0392B'; bg = '#FFF0EE';
        } else if(diff >= 10){
            msg = '🚨 ' + diff + '일째예요! ' + (15-diff) + '일 후 등급이 하락해요!';
            color = '#E07000'; bg = '#FFF8EE';
        } else {
            msg = '⚠️ ' + diff + '일째예요! 오늘 확언 완료하면 등급 유지!';
            color = '#1B4332'; bg = '#FFFBE6';
        }
        const banner = document.createElement('div');
        banner.id = 'absence-banner';
        banner.style.cssText = 'background:'+bg+';border-left:4px solid '+color+';padding:12px 16px;margin-bottom:12px;border-radius:10px;font-size:0.88em;font-weight:700;color:'+color+';line-height:1.5;';
        banner.textContent = msg;
        const affView = document.getElementById('affirmation-view');
        if(affView) affView.insertBefore(banner, affView.firstChild);
    }

    // 시크릿 코드 성공 시 등급 회복
    function checkLevelRecovery(){
        const dropped = safeGetItem('user_level_override','-1');
        if(dropped === '-1') return; // 하락 없음
        const calcLv = getLevel(getPoints());
        const droppedLv = parseInt(dropped);
        if(droppedLv < calcLv){
            // 포인트 기준 등급이 더 높으면 override 제거
            safeSetItem('user_level_override','-1');
            return;
        }
        // 코드 입력으로 회복
        const recovered = droppedLv + 1;
        safeSetItem('user_level_override', String(Math.min(recovered, LEVELS.length-1)));
        showToast(`🎉 등급이 회복됐어요! ${LEVELS[Math.min(recovered, LEVELS.length-1)].emoji}`);
        launchConfetti();
        // override가 calcLv 이상이면 제거
        if(recovered >= calcLv) safeSetItem('user_level_override','-1');
    }

    // 첫 방문 포인트
    // ★ 심리테스트 이메일없이 이탈 후 등록 팝업
    function showPsychRegisterPopup(){
        // 이미 등록돼 있으면 실행 안 함
        if(safeGetItem('my_nickname','') && safeGetItem('my_email','')) return;
        // 팝업 중복 방지
        if(document.getElementById('psych-register-popup')) return;

        const pop = document.createElement('div');
        pop.id = 'psych-register-popup';
        pop.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
        pop.innerHTML = `
            <div style="background:var(--bg-color);border-radius:24px;padding:28px 24px;width:100%;max-width:360px;text-align:center;">
                <div style="font-size:48px;margin-bottom:12px;">🎉</div>
                <div style="font-size:1.2em;font-weight:900;color:var(--primary-color);margin-bottom:8px;">결과를 저장해드릴게요!</div>
                <div style="font-size:0.88em;color:var(--text-muted);line-height:1.8;margin-bottom:20px;">
                    이름과 이메일을 등록하면<br>
                    <b style="color:var(--accent-color);">30포인트</b>를 드리고<br>
                    30일 후 성장을 비교할 수 있어요!
                </div>
                <input id="preg-name" type="text" placeholder="닉네임 (예: 김영희)"
                    style="width:100%;padding:13px 16px;font-size:1em;border:1.5px solid #ddd;border-radius:12px;box-sizing:border-box;margin-bottom:10px;text-align:center;outline:none;">
                <button id="preg-google-btn" style="width:100%;padding:12px;font-size:0.95em;border:1.5px solid #4285F4;border-radius:12px;background:#fff;color:#444;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
                    <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/></svg>
                    G 구글 계정에서 이메일 가져오기
                </button>
                <input id="preg-email" type="email" placeholder="또는 이메일 직접 입력"
                    style="width:100%;padding:13px 16px;font-size:1em;border:1.5px solid #ddd;border-radius:12px;box-sizing:border-box;margin-bottom:16px;text-align:center;outline:none;">
                <button id="preg-submit"
                    style="width:100%;min-height:52px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;margin-bottom:10px;">
                    ✅ 등록하고 30PT 받기
                </button>
                <button id="preg-skip"
                    style="width:100%;min-height:40px;background:none;border:none;font-size:0.85em;color:var(--text-muted);cursor:pointer;">
                    나중에 하기
                </button>
            </div>`;
        document.body.appendChild(pop);

        // 구글 버튼 이벤트
        document.getElementById('preg-google-btn').addEventListener('click', function(){
            window._googleOneTap();
            window.addEventListener('message', function _pregMsg(e){
                if(e.data && e.data.type === 'oauth_email'){
                    window.removeEventListener('message', _pregMsg);
                    var emailEl = document.getElementById('preg-email');
                    var nameEl  = document.getElementById('preg-name');
                    if(emailEl && e.data.email) emailEl.value = e.data.email;
                    if(nameEl  && !nameEl.value && e.data.name) nameEl.value = e.data.name;
                    showToast('✅ 구글 계정 정보가 입력됐어요!');
                }
            });
        });

        document.getElementById('preg-submit').addEventListener('click', function(){
            const name = (document.getElementById('preg-name').value || '').trim();
            const email = (document.getElementById('preg-email').value || '').trim();
            if(!name){ showToast('닉네임을 입력해주세요!'); return; }
            safeSetItem('my_nickname', name);
            if(email) safeSetItem('my_email', email);
            safeSetItem('onboarding_done', '1');
            pop.remove();
            addPoint(30, '심리테스트가입보너스', 'psych_join_bonus');
            renderPointBar();
            // 환영 팝업
            setTimeout(function(){ checkFirstVisit(); }, 300);
        });

        document.getElementById('preg-skip').addEventListener('click', function(){
            pop.remove();
        });
    }

        function checkFirstVisit(){
        // 이름 없어도 첫 방문 30PT 지급 (등록은 새싹 등업 시에만 필수)
        // ★ 단일 키 사용 (PWA/크롬 구분 없이 동일)
        const KEY = 'pt_first_visit';
        if(safeGetItem(KEY,'') === '1') return;
        if(safeGetItem('pt_first_standalone','') === '1'){
            safeSetItem(KEY,'1'); return;
        }
        if(getPoints() >= 30){
            safeSetItem(KEY,'1'); return;
        }
        safeSetItem(KEY,'1');
        safeSetItem('pt_first_standalone','1');

        // ★ 첫 방문 환영 팝업
        const _nick = safeGetItem('my_nickname','') || '새 친구';
        setTimeout(function(){
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML =
                '<div style="background:#fff;border-radius:24px;padding:32px 24px;width:88%;max-width:340px;text-align:center;">'
                + '<div style="font-size:52px;margin-bottom:12px;">🌿</div>'
                + '<div style="font-size:1.3em;font-weight:900;color:#1B4332;margin-bottom:8px;">'+ _nick +'님, 환영해요!</div>'
                + '<div style="font-size:0.9em;color:#555;line-height:1.9;margin-bottom:8px;">'
                + '오늘부터 매일 한 문장으로<br><b style="color:#1B4332;">나를 바꾸는 365일 여정</b>이 시작돼요.<br><br>'
                + '첫 방문 기념으로 <b style="color:#C9A84C;">+30PT</b>가 적립됐어요 🎉'
                + '</div>'
                + '<div style="font-size:0.78em;color:#aaa;margin-bottom:18px;">매일 확언 완료 시 포인트가 쌓여요</div>'
                + '<button onclick="this.closest(\'div[style*=fixed]\').remove();" style="width:100%;min-height:52px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;">오늘 확언 보러 가기 🌱</button>'
                + '</div>';
            document.body.appendChild(modal);
            addPoint(30, '첫 방문 기념');
        }, 800);
        setTimeout(sendUserDataToSheet, 3000);
    }

    // ★ 사용자 데이터 구글 시트 전송
    function sendUserDataToSheet(){
        if(SHEET_API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL') return;
        try {
            const cd = safeGetJSON('completed_dates', []);
            const pts = getPoints();
            const lvIdx = getLevel(pts);
            const nick = safeGetItem('my_nickname', '');
            const today = getTodayStr();
            const startDate = safeGetItem('start_date_B', '') || safeGetItem('app_install_date', today);
            // 앱 설치일 기록
            if(!safeGetItem('app_install_date','')) safeSetItem('app_install_date', today);
            const streak = calcCurrentStreak(cd);
            const userData = {
                action: 'user_log',
                nickname:   nick || '미설정',
                email:      safeGetItem('my_email',''),
                device_id:  _getDeviceId(),
                date:       today,
                installDate: startDate,
                totalDays:  cd.length,
                streak:     streak,
                points:     pts,
                level:      LEVELS[lvIdx].name,
                lastVisit:  today,
                device:     /Android/i.test(navigator.userAgent) ? '안드로이드' : /iPhone|iPad/i.test(navigator.userAgent) ? '아이폰' : 'PC'
            };
            fetch(SHEET_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(userData)
            }).catch(()=>{});
        } catch(e) {}
    }

    // ★ 매일 접속 시 업데이트 (닉네임 설정 후, 완료 체크 후)
    // ====================================================
    // ★ 기기 고유 ID 생성/관리
    // ====================================================
    function _getDeviceId(){
        let did = safeGetItem('device_id','');
        if(!did){
            did = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
            safeSetItem('device_id', did);
        }
        return did;
    }

    // ★ 통합 데이터 전송 시스템
    // ====================================================
    function _sheetSend(data){
        if(SHEET_API_URL === 'YOUR_GOOGLE_APPS_SCRIPT_URL') return;
        // 카톡/인앱브라우저 CORS 차단 시 조용히 실패
        try {
            fetch(SHEET_API_URL, {
                method:'POST', mode:'no-cors',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify(data)
            }).catch(()=>{});
        } catch(e){}
    }
    function _getNick(){ return safeGetItem('my_nickname','미설정'); }
    function _getEmail(){ return safeGetItem('my_email',''); }

    // ① 닉네임/이메일 등록
    window._sendUserRegister = function(trigger){
        _sheetSend({
            action: 'user_register',
            nickname: _getNick(),
            email: _getEmail(),
            device_id: _getDeviceId(),
            trigger: trigger || '설정',
            date: getTodayStr()
        });
    }

    // ★ 앱 설치 기록
    window._sendAppInstall = function(){
        const key = 'app_install_reported';
        if(safeGetItem(key,'') === '1') return; // 중복 방지
        safeSetItem(key, '1');
        _sheetSend({
            action: 'app_install',
            nickname: _getNick(),
            email: _getEmail(),
            device_id: _getDeviceId(),
            date: getTodayStr()
        });
    }

    // ★ 공유 기록
    window._sendShareLog = function(shareType, extra){
        _sheetSend({
            action: 'share_log',
            nickname: _getNick(),
            email: _getEmail(),
            device_id: _getDeviceId(),
            share_type: shareType,
            extra: extra || '',
            date: getTodayStr()
        });
    }

    // ② 레벨업
    window._sendLevelUp = function(levelName){
        _sheetSend({
            action: 'level_up',
            nickname: _getNick(),
            email: _getEmail(),
            level: levelName,
            date: getTodayStr()
        });
    }

    // ③ 연속달성 마일스톤 (100/200/300일)
    window._sendStreakMilestone = function(days){
        _sheetSend({
            action: 'streak_milestone',
            nickname: _getNick(),
            email: _getEmail(),
            days: days,
            date: getTodayStr()
        });
    }

    // ④ 사연 보내기
    window._sendStoryLog = function(){
        _sheetSend({
            action: 'story_sent',
            nickname: _getNick(),
            email: _getEmail(),
            date: getTodayStr()
        });
    }

    // ⑤ 설문 정보 저장
    window._sendSurveyLog = function(surveyData){
        _sheetSend({
            action: 'survey_saved',
            nickname: _getNick(),
            email: _getEmail(),
            data: surveyData,
            date: getTodayStr()
        });
    }

    // ⑥ PDF 접근
    window._sendPdfAccess = function(pdfName){
        _sheetSend({
            action: 'pdf_access',
            nickname: _getNick(),
            email: _getEmail(),
            pdf: pdfName,
            date: getTodayStr()
        });
    }

    // ⑦ 행동 로그 (확언완료/즐겨찾기/공유 등)
    window._sendActionLog = function(action, detail){
        _sheetSend({
            action: 'action_log',
            nickname: _getNick(),
            email: _getEmail(),
            event: action,
            detail: detail || '',
            date: getTodayStr()
        });
    }

    window._sendUserUpdate = function(){
        setTimeout(sendUserDataToSheet, 1000);
    }

    // 연속 달성 보너스
    function checkStreakBonus(streak){
        const key = `pt_streak_bonus_${streak}`;
        if(safeGetItem(key,'') === '1') return;
        const bonuses = {7:10, 30:50, 100:200, 365:500};
        if(bonuses[streak]){
            safeSetItem(key,'1');
            addPoint(bonuses[streak], `${streak}일 연속 보너스`);
            showToast(`🔥 ${streak}일 연속 달성! +${bonuses[streak]}PT 보너스!`);
            // ★ 마일스톤 전송 (100/200/300일)
            if([100,200,300].includes(streak)){
                window._sendStreakMilestone(streak);
            }
        }
    }

    function renderPointBar(){
        const pts = getPoints();
        const lvIdx = getLevel(pts);
        const lv = LEVELS[lvIdx];
        const nextLv = LEVELS[lvIdx + 1];

        document.getElementById('point-bar-emoji').textContent = lv.emoji;
        document.getElementById('point-bar-level').textContent = lv.name;
        document.getElementById('point-bar-pts').textContent = pts + ' PT';

        let pct = 100;
        if(nextLv){
            const range = nextLv.min - lv.min;
            const prog  = pts - lv.min;
            pct = Math.min(100, Math.round((prog / range) * 100));
        }
        document.getElementById('point-bar-progress').style.width = pct + '%';
    }

    window.openLevelGuide = function(){
        const pts = getPoints();
        const lvIdx = getLevel(pts);
        const lv = LEVELS[lvIdx];
        const nextLv = LEVELS[lvIdx + 1];

        document.getElementById('lg-emoji').textContent = lv.emoji;
        document.getElementById('lg-name').textContent = lv.name + ' 등급';
        document.getElementById('lg-pts').textContent = pts + ' PT';

        let pct = 100, nextTxt = '최고 등급 달성! 🎉';
        if(nextLv){
            const range = nextLv.min - lv.min;
            const prog  = pts - lv.min;
            pct = Math.min(100, Math.round((prog / range) * 100));
            nextTxt = '다음 등급 ' + nextLv.emoji + ' ' + nextLv.name + '까지 ' + (nextLv.min - pts) + ' PT';
        }
        document.getElementById('lg-bar').style.width = pct + '%';
        document.getElementById('lg-next').textContent = nextTxt;

        // 등급별 혜택 + PDF URL
        const BENEFITS = [
            { text: '앱 기본 기능 전체 이용', pdf: null, diary: false },
            { text: '🔓 오늘의 한마디 해금!', pdf: null, diary: false },
            { text: '🧪 확언 처방전 오픈! (오늘의 선언 탭)', pdf: null, diary: false },
            { text: '📄 1~3월 확언 PDF 해금', pdf: 'pdf_url_1', diary: false },
            { text: '📄 4~6월 확언 PDF 해금', pdf: 'pdf_url_2', diary: false },
            { text: '📄 7~9월 확언 PDF 해금', pdf: 'pdf_url_3', diary: false },
            { text: '📄 10~12월 확언 PDF 해금', pdf: 'pdf_url_4', diary: false },
            { text: '🎁 365일 완전판 확언 다이어리 선물', pdf: null, diary: true },
        ];

        // 등급 목록 렌더링
        let html = '';
        LEVELS.forEach((l, i) => {
            const isCur = i === lvIdx;
            const isDone = pts >= l.min;
            const b = BENEFITS[i];
            const pdfUrl = b.pdf ? safeGetItem(b.pdf, '') : '';
            const canDownload = isDone && b.pdf && pdfUrl;
            const canDiary = isDone && b.diary;

            // 우측 버튼 (잠금/PDF/다이어리)
            let rightBtn = '';
            if(b.pdf){
                if(canDownload){
                    rightBtn = `<a href="${pdfUrl}" target="_blank" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;background:#C9A84C;color:#fff;border-radius:10px;padding:8px 10px;font-size:0.7em;font-weight:700;text-decoration:none;text-align:center;min-width:52px;line-height:1.3;">📄<br>PDF</a>`;
                } else {
                    rightBtn = `<div style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;background:rgba(201,168,76,0.12);border:1px dashed #C9A84C;border-radius:10px;padding:8px 10px;font-size:0.68em;color:#C9A84C;text-align:center;min-width:52px;line-height:1.4;">🔒<br>PDF<br>대기중</div>`;
                }
            } else if(b.diary){
                if(canDiary){
                    rightBtn = `<button onclick="openDiaryApplyForm()" style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;background:#C9A84C;color:#fff;border:none;border-radius:10px;padding:8px 10px;font-size:0.7em;font-weight:700;cursor:pointer;text-align:center;min-width:52px;line-height:1.3;">🎁<br>신청</button>`;
                } else {
                    rightBtn = `<div style="display:flex;align-items:center;justify-content:center;flex-direction:column;gap:2px;background:rgba(201,168,76,0.12);border:1px dashed #C9A84C;border-radius:10px;padding:8px 10px;font-size:0.68em;color:#C9A84C;text-align:center;min-width:52px;line-height:1.4;">🔒<br>다이어리<br>대기중</div>`;
                }
            } else {
                rightBtn = isDone ? `<span style="color:#C9A84C;font-size:1.1em;">✓</span>` : '';
            }

            html += `<div style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;margin-bottom:8px;background:${isCur?'linear-gradient(135deg,#1B4332,#2D6A4F)':isDone?'#F0F7F4':'var(--card-bg)'};border:1px solid ${isCur?'transparent':isDone?'#C8DDD2':'var(--border-color)'};">
                <span style="font-size:28px;">${l.emoji}</span>
                <div style="flex:1;">
                    <div style="font-size:0.9em;font-weight:700;color:${isCur?'#C9A84C':isDone?'#1B4332':'var(--text-muted)'};">${l.name} ${isCur?'← 현재':''}</div>
                    <div style="font-size:0.75em;color:${isCur?'rgba(255,255,255,0.6)':'var(--text-muted)'};">${l.min.toLocaleString()} PT 이상</div>
                    <div style="font-size:0.78em;margin-top:3px;color:${isCur?'rgba(255,255,255,0.85)':isDone?'#1B4332':'var(--text-muted)'};">혜택: ${b.text}</div>
                </div>
                ${rightBtn}
            </div>`;
        });
        document.getElementById('lg-level-list').innerHTML = html;
        document.getElementById('level-guide-modal').style.display = 'block';
    }

    window.openPointGuide = function(){
        const pts = getPoints();
        const today = getTodayStr();
        document.getElementById('pg-pts').textContent = pts + ' PT';

        // 오늘 적립 완료 여부 확인 함수
        function isDone(key){ return safeGetItem('pt_daily_'+key+'_'+today,'') === '1'; }

        // 항목 행 생성
        function row(icon, label, pt, key, action, desc){
            const done = isDone(key);
            return `<div onclick="${action}" style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border-color);cursor:pointer;background:${done?'#F0F7F4':'transparent'};">
                <span style="font-size:18px;">${icon}</span>
                <div style="flex:1;">
                    <div style="font-size:0.88em;font-weight:600;color:var(--text-color);">${label}</div>
                    <div style="font-size:0.73em;color:var(--text-muted);">${desc} →</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:0.88em;font-weight:700;color:#C9A84C;">+${pt}PT</span>
                    ${done ? '<span style="font-size:1em;color:#1B4332;">✓</span>' : '<span style="font-size:0.75em;color:#ccc;">○</span>'}
                </div>
            </div>`;
        }

        const closeAndGo = (action) => `document.getElementById('point-guide-modal').style.display='none'; ${action}`;

        // 오늘 적립 현황 계산
        const DAILY_ITEMS = [
            {key:'complete',pt:1}, {key:'listen',pt:1}, {key:'stt',pt:1},
            {key:'mood_check',pt:1}, {key:'action_photo',pt:5},
            {key:'memo',pt:1}, {key:'diary',pt:1},
            {key:'share_aff',pt:2}, {key:'share_card',pt:2},
            {key:'share_family',pt:2}, {key:'share_oracle',pt:2},
            {key:'shorts_visit',pt:2}, {key:'episode_visit',pt:2},
        ];
        const DAILY_MAX = 23;
        let todayEarned = 0, todayDone = 0;
        DAILY_ITEMS.forEach(item => {
            if(isDone(item.key)){ todayEarned += item.pt; todayDone++; }
        });
        todayEarned = Math.min(todayEarned, DAILY_MAX);
        const todayLeft = Math.max(0, DAILY_MAX - todayEarned);
        const pct = Math.round((todayEarned / DAILY_MAX) * 100);
        const barColor = pct >= 100 ? '#1B4332' : pct >= 60 ? '#C9A84C' : '#888';
        const todayStatus = pct >= 100
            ? `🎉 오늘 최대 적립 완료! (${DAILY_MAX}PT)`
            : todayLeft > 0
                ? `${todayLeft}PT만 더 하면 오늘 100% 달성!`
                : `오늘 ${todayEarned}PT 적립 중`;

        const progressHtml = `
            <div style="background:var(--card-bg);border-radius:14px;padding:16px;margin-bottom:12px;border:1px solid var(--border-color);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-size:0.88em;font-weight:700;color:var(--primary-color);">📊 오늘의 적립 현황</div>
                    <div style="font-size:0.88em;font-weight:700;color:${barColor};">${todayEarned} / ${DAILY_MAX} PT</div>
                </div>
                <div style="background:#E8E5E0;border-radius:20px;height:10px;overflow:hidden;margin-bottom:8px;">
                    <div style="height:100%;width:${pct}%;background:${barColor};border-radius:20px;transition:width 0.4s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-size:0.78em;color:var(--text-muted);">✓ ${todayDone} / ${DAILY_ITEMS.length}개 항목 완료</div>
                    <div style="font-size:0.78em;font-weight:700;color:${pct>=100?'#1B4332':'#C9A84C'};">${todayStatus}</div>
                </div>
            </div>`;

        const html = `
            <div style="background:var(--card-bg);border-radius:14px;overflow:hidden;margin-bottom:16px;border:1px solid var(--border-color);">
                ${row('☑️','확언 완료 체크',1,'complete', closeAndGo("goToHomeElement('btn-complete')"),'홈 화면 완료 버튼')}
                ${row('🔊','소리 듣기',1,'listen', closeAndGo("goToHomeElement('btn-listen')"),'홈 화면 → 소리 듣기 버튼')}
                ${row('🎙','따라읽기 완료',1,'stt', closeAndGo("goToHomeElement('btn-stt')"),'홈 화면 따라읽기 버튼')}
                ${row('😊','확언 후 기분 체크',1,'mood_check', closeAndGo("goToHomeElement('affirmation-view')"),'홈 화면 → 기분 이모지 선택')}
                ${row('📸','오늘의 실천 인증',5,'action_photo', closeAndGo("switchView('home');setTimeout(()=>openActionPhoto(),400)"),'홈 화면 → 실천 인증 버튼')}
                ${row('✏️','필사 저장',1,'memo', closeAndGo("switchView('memo'); setTimeout(()=>switchMemoTab('write'),100)"),'메모장 → 필사 탭')}
                ${row('📔','일기 저장',1,'diary', closeAndGo("switchView('memo'); setTimeout(()=>switchMemoTab('diary'),100)"),'메모장 → 일기장 탭')}
                ${row('📤','오늘 확언 공유',2,'share_aff', closeAndGo("shareAfterComplete()"),'홈 → 완료 후 공유 버튼')}
                ${row('🌅','아침 인사 카드 공유',2,'share_card', closeAndGo("openShareCard()"),'홈 화면 → 아침 인사 카드')}
                ${row('💚','가족에게 보내기',2,'share_family', closeAndGo("goToHomeElement('affirmation-view'); setTimeout(()=>shareToFamily(),300)"),'홈 화면 → 가족에게 보내기')}
                ${getLevel(pts) >= 1
                    ? row('✨','오늘의 한마디 공유',2,'share_oracle', closeAndGo("openOracle()"),'홈 화면 → 오늘의 한마디')
                    : `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border-color);background:#F8F8F8;opacity:0.6;">
                        <span style="font-size:18px;">🔒</span>
                        <div style="flex:1;">
                            <div style="font-size:0.88em;font-weight:600;color:#999;">오늘의 한마디 공유</div>
                            <div style="font-size:0.73em;color:#bbb;">🌿 새싹 달성 후 이용 가능해요</div>
                        </div>
                        <span style="font-size:0.88em;font-weight:700;color:#ccc;">+2PT</span>
                    </div>`
                }
                ${row('📺','쇼츠 보러가기',2,'shorts_visit', "addPoint(2,'쇼츠클릭','shorts_visit'); window.open('https://www.youtube.com/@SecondActRadio/shorts','_blank'); setTimeout(()=>openPointGuide(),300)",'유튜브 쇼츠 채널')}
                ${row('🎬','오늘의 영상 보기',2,'episode_visit', "addPoint(2,'영상클릭','episode_visit'); document.getElementById('point-guide-modal').style.display='none'; var _ep=document.getElementById('btn-episode'); var _href=_ep?_ep.getAttribute('href'):''; var _url=(_href&&_href!=='#'&&_href.indexOf('youtube')>-1)?_ep.href:'https://www.youtube.com/@SecondActRadio'; window.open(_url,'_blank');",'홈 화면 → 이야기 들어보기 버튼')}
            </div>
            <div style="font-size:0.78em;color:var(--text-muted);text-align:center;margin-bottom:4px;">✓ 표시는 오늘 이미 적립한 항목이에요. 자정에 초기화돼요.</div>`;

        document.getElementById('pg-items').innerHTML = progressHtml + html;
        document.getElementById('point-guide-modal').style.display = 'block';
    }

    // 오늘의 한마디 버튼 잠금/해금
    function renderOracleBtn(){
        const wrap = document.getElementById('oracle-btn-wrap');
        if(!wrap) return;
        const pts = getPoints();
        const lvIdx = getLevel(pts);
        const unlocked = lvIdx >= 1; // 새싹(1) 이상
        const needed = 50 - pts;

        if(unlocked){
            wrap.innerHTML = `<button class="btn-oracle" onclick="openOracle()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="margin-right:6px;flex-shrink:0;"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>오늘의 한마디</button>`;
        } else {
            wrap.innerHTML = `
                <button onclick="openPointGuide()" style="width:100%;min-height:52px;background:#E8E5E0;color:#888;border:none;border-radius:var(--radius-sm);cursor:pointer;font-size:0.85em;font-weight:700;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:8px;">
                    🔒 오늘의 한마디
                    <span style="background:#C9A84C;color:#fff;border-radius:20px;padding:2px 10px;font-size:0.78em;">🌿 새싹 달성 시 오픈</span>
                </button>
                <div style="text-align:center;font-size:0.78em;color:#C9A84C;font-weight:600;margin-top:-10px;margin-bottom:14px;">
                    ${needed > 0 ? `🌱 ${needed}PT만 더 모으면 새싹이 돼요!` : '오늘 확언 완료하면 새싹이 돼요! 🌿'}
                </div>`;
        }
    }

    window.shareOracle = function(){
        addPoint(2,'한마디공유','share_oracle');
        window._sendShareLog('한마디공유');
        const text = document.getElementById('oracle-affirmation-text')?.innerText || '';
        const theme = document.getElementById('oracle-theme-text')?.innerText || '';
        const msg = `✨ 오늘의 한마디\n\n${theme}\n"${text}"\n\n— 인생2막라디오 365일 확언 앱\n📱 확언 앱: https://life2radio.github.io/pumsok/\n📺 채널: https://www.youtube.com/@SecondActRadio`;
        if(navigator.share){
            navigator.share({title:'오늘의 한마디', text:msg}).catch(function(e){ if(e.name!=='AbortError') copyToClipboard(msg); });
        } else {
            copyToClipboard(msg);
        }
    }

    window.openDiaryApplyForm = function(){
        document.getElementById('level-guide-modal').style.display = 'none';
        document.getElementById('diary-apply-form-modal').style.display = 'block';
    }

    window.submitDiaryApply = function(){
        const name    = document.getElementById('diary-form-name').value.trim();
        const phone   = document.getElementById('diary-form-phone').value.trim();
        const address = document.getElementById('diary-form-address').value.trim();
        const agreed  = document.getElementById('diary-form-agree').checked;

        if(!name)    { showToast('성함을 입력해주세요'); return; }
        if(!phone)   { showToast('연락처를 입력해주세요'); return; }
        if(!address) { showToast('배송 주소를 입력해주세요'); return; }
        if(!agreed)  { showToast('개인정보 수집 및 이용에 동의해주세요'); return; }

        // 이메일로 신청 정보 전송
        const subject = encodeURIComponent('[365일 확언 다이어리 신청] ' + name);
        const body    = encodeURIComponent(
            '성함: ' + name + '\n' +
            '연락처: ' + phone + '\n' +
            '주소: ' + address + '\n\n' +
            '--- 앱 정보 ---\n' +
            '닉네임: ' + (safeGetItem('my_nickname','미설정')) + '\n' +
            '포인트: ' + getPoints() + ' PT\n' +
            '신청일: ' + getTodayStr()
        );
        window.open('mailto:life2radio@gmail.com?subject=' + subject + '&body=' + body);

        // 신청 완료 표시
        safeSetItem('diary_365_applied', '1');
        document.getElementById('diary-apply-form-modal').style.display = 'none';
        launchConfetti();
        showToast('🎉 신청이 완료됐어요! 이메일로 확인해드릴게요 😊');
    }

    // 홈화면 특정 요소로 스크롤 이동
    window.goToHomeElement = function(elementId){
        document.getElementById('point-guide-modal').style.display = 'none';
        switchView('home');
        setTimeout(()=>{
            const el = document.getElementById(elementId);
            if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); }
        }, 400);
    }

    /* ===== ② 가상 연대감 카운터 ===== */
    function initSolidarity(){
        const el=document.getElementById('solidarity-count');
        if(!el) return;
        const hour=new Date().getHours();
        // 밤10시(22)~아침8시(7): 30~99명, 나머지: 시간대별
        const base=( hour>=22 || hour<8 ) ? 30
                 : hour>=8&&hour<10  ? 300
                 : hour>=10&&hour<13 ? 1200
                 : hour>=13&&hour<18 ? 800
                 : hour>=18&&hour<22 ? 1500 : 600;
        const max =( hour>=22 || hour<8 ) ? 99 : base+300;
        let count=base+Math.floor(Math.random()*(max-base));
        el.textContent=count.toLocaleString();
        setInterval(()=>{
            count+=Math.floor(Math.random()*5)-2;
            if(count<base) count=base;
            if(count>max)  count=max;
            el.textContent=count.toLocaleString();
        }, 30000);
    }


    // ════════════════════════════════════════
    // 💌 사연 보내기 모달 (전역 접근 가능)
    // ════════════════════════════════════════

    window.closeStoryOverlay = function() { var m=document.getElementById('story-overlay-modal'); if(m)m.style.display='none'; };
    window.openStoryModal = function() {
        var existing = document.getElementById('story-overlay-modal');
        if(existing) { existing.style.display = 'flex'; return; }

        var overlay = document.createElement('div');
        overlay.id = 'story-overlay-modal';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
        overlay.innerHTML =
            '<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;padding:24px 20px 40px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
            '<div style="font-size:1.1em;font-weight:900;color:#1B4332;">💌 사연 보내기</div>' +
            '<button onclick="closeStoryOverlay()" style="background:none;border:none;font-size:1.4em;cursor:pointer;color:#888;">✕</button>' +
            '</div>' +
            '<div style="font-size:0.82em;color:#888;margin-bottom:16px;line-height:1.7;">다짐을 이뤄가는 이야기, 확언으로 변화된 삶을 나눠주세요.<br>많은 분들께 위로와 용기가 됩니다 🌿</div>' +
            '<div style="margin-bottom:12px;">' +
            '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">제목</div>' +
            '<input id="som-title" type="text" placeholder="제목을 입력해주세요" maxlength="50" ' +
            'style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.9em;box-sizing:border-box;">' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
            '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">이름 (선택)</div>' +
            '<input id="som-name" type="text" placeholder="닉네임 또는 이름" maxlength="20" ' +
            'style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.9em;box-sizing:border-box;">' +
            '</div>' +
            '<div style="margin-bottom:12px;">' +
            '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">이메일 (선택 · 답장 원하시면 입력)</div>' +
            '<input id="som-email" type="email" placeholder="example@email.com" ' +
            'style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.9em;box-sizing:border-box;">' +
            '</div>' +
            '<div style="margin-bottom:20px;">' +
            '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">사연 내용</div>' +
            '<textarea id="som-body" rows="6" placeholder="나의 이야기를 자유롭게 써주세요" maxlength="1000" ' +
            'style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.88em;box-sizing:border-box;resize:none;"></textarea>' +
            '</div>' +
            '<button onclick="sendStoryOverlay()" ' +
            'style="width:100%;padding:15px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;">💌 사연 보내기</button>' +
            '</div>';

        overlay.addEventListener('click', function(e) {
            if(e.target === overlay) overlay.style.display = 'none';
        });
        document.body.appendChild(overlay);
    };

    window.sendStoryOverlay = async function() {
        var title = (document.getElementById('som-title')||{}).value || '';
        var name  = (document.getElementById('som-name')||{}).value  || '';
        var email = (document.getElementById('som-email')||{}).value || '';
        var body  = (document.getElementById('som-body')||{}).value  || '';
        if(!title.trim()) { showToast('제목을 입력해주세요'); return; }
        if(!body.trim())  { showToast('사연 내용을 입력해주세요'); return; }

        var emailBody = name ? '[이름] ' + name + '\n\n' + body : body;

        // 오늘의 확언 포함
        var ae = document.getElementById('affirmation-text');
        var de = document.getElementById('day-label');
        if(ae && de) emailBody += '\n\n——\n오늘의 확언 (' + de.innerText + ')\n"' + ae.innerText + '"';

        var FORMSPREE_ID = 'xqewzqqg';
        try {
            var res = await fetch('https://formspree.io/f/' + FORMSPREE_ID, {
                method:'POST',
                headers:{'Content-Type':'application/json','Accept':'application/json'},
                body: JSON.stringify({
                    이름: name||'익명',
                    제목: title,
                    사연: emailBody,
                    이메일: email
                })
            });
            if(res.ok) {
                showToast('💌 사연이 전송됐어요! +10PT 적립됐어요 😊');
                addPoint && addPoint(10, '사연보내기', 'story_send_' + getFormatDate(new Date()));
                window._sendStoryLog && window._sendStoryLog();
                // 패자부활
                var t = new Date();
                var revKey = 'revival_story_' + t.getFullYear() + '_' + (t.getMonth()+1);
                if(!safeGetItem(revKey,'')) {
                    var ab = parseInt(safeGetItem('revival_absent_days','0'))||0;
                    if(ab > 0) {
                        var del = Math.min(ab, 7);
                        safeSetItem('revival_absent_days', String(ab-del));
                        safeSetItem(revKey, '1');
                        showToast('🎉 패자부활! 결석 ' + del + '일이 삭제됐어요!');
                    }
                }
                // 입력창 초기화
                ['som-title','som-name','som-email','som-body'].forEach(function(id) {
                    var el = document.getElementById(id);
                    if(el) el.value = '';
                });
                closeStoryOverlay();
            } else throw new Error();
        } catch(e) {
            window.location.href = 'mailto:life2radio@gmail.com?subject=' +
                encodeURIComponent('[인생2막라디오 사연] ' + title) +
                '&body=' + encodeURIComponent(emailBody);
        }
    };

    // showStorySendModal도 openStoryModal로 연결
    window.showStorySendModal = window.openStoryModal;

    /* ===== ③ Formspree 사연 전송 ===== */
    // ★ https://formspree.io 에서 무료 폼 생성 후 ID 교체
    const FORMSPREE_ID = 'xqewzqqg';
    // 이메일 CF 마스킹 방지 - JS로 조립
    const _em = ['life2radio','gmail.com'].join('@');
    document.addEventListener('DOMContentLoaded', function(){
        var el = document.getElementById('story-email-display');
        if(el) el.textContent = _em;
    });

    window.sendStory = async function(){
        const title=document.getElementById('story-title').value.trim();
        const body2=document.getElementById('story-body').value.trim();
        const name=document.getElementById('story-name').value.trim();
        if(!title){ showToast('제목을 입력해주세요'); return; }
        if(!body2) { showToast('사연 내용을 입력해주세요'); return; }

        let emailBody = name ? `[이름] ${name}\n\n${body2}` : body2;
        if(affirmInclude){
            const ae=document.getElementById('affirmation-text'), de=document.getElementById('day-label');
            if(ae&&de) emailBody+=`\n\n——\n오늘의 확언 (${de.innerText})\n"${ae.innerText}"`;
        }

        if(FORMSPREE_ID!=='YOUR_FORM_ID'){
            try{
                const res=await fetch(`https://formspree.io/f/${FORMSPREE_ID}`,{
                    method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
                    body:JSON.stringify({이름:name||'익명', 제목:title, 사연:emailBody, 이메일:document.getElementById('story-email')?.value.trim()||'', 마케팅동의:document.getElementById('story-marketing')?.checked?'동의':'미동의'})
                });
                if(res.ok){
                    showToast('💌 사연이 전송됐어요! +10PT 적립됐어요 😊');
                    addPoint(10,'사연보내기',`story_send_${todayObj.getFullYear()}_${todayObj.getMonth()+1}`);
                    window._sendStoryLog(); // ★ 사연 전송 로그
                    // 패자부활: 월 1회, 결석 최대 7일 삭제
                    var revKey='revival_story_'+todayObj.getFullYear()+'_'+(todayObj.getMonth()+1);
                    if(!safeGetItem(revKey,'')){
                        var ab=parseInt(safeGetItem('revival_absent_days','0'))||0;
                        if(ab>0){
                            var del=Math.min(ab,7);
                            safeSetItem('revival_absent_days',String(ab-del));
                            safeSetItem(revKey,'1');
                            showToast('🎉 패자부활! 결석 '+del+'일이 삭제됐어요!');
                        }
                    }
                    ['story-title','story-body','story-name'].forEach(id=>{ const el=document.getElementById(id); if(el)el.value=''; });
                    document.getElementById('story-char-count').textContent='0자';
                } else throw new Error();
            } catch(e){ window.location.href=`mailto:life2radio@gmail.com?subject=${encodeURIComponent('[인생2막라디오 사연] '+title)}&body=${encodeURIComponent(emailBody)}`; }
        } else {
            window.location.href=`mailto:life2radio@gmail.com?subject=${encodeURIComponent('[인생2막라디오 사연] '+title)}&body=${encodeURIComponent(emailBody)}`;
        }
    }

    function downloadTxt(filename, text){
        const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename;
        a.click(); URL.revokeObjectURL(url);
        showToast('다운로드됐어요!');
    }
    function shareText(title, text){
        if(navigator.share){ navigator.share({title, text}).catch(()=> copyToClipboard(text)); }
        else { copyToClipboard(text); }
    }
    function copyToClipboard(text){
        if(navigator.clipboard){
            navigator.clipboard.writeText(text)
                .then(()=> showToast('📋 클립보드에 복사됐어요!'))
                .catch(()=>{
                    const ta=document.createElement('textarea');
                    ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
                    document.body.appendChild(ta); ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showToast('📋 복사됐어요!');
                });
        } else {
            const ta=document.createElement('textarea');
            ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('📋 복사됐어요!');
        }
    }
    window.shareDiaryEntry = function(){
        const input=document.getElementById('diary-input');
        const ds=input.dataset.targetDate||getTodayStr();
        const text=input.value.trim();
        if(!text){ showToast('작성된 일기가 없어요'); return; }
        const parts=ds.split('-');
        const title=`${parts[0]}년 ${parseInt(parts[1])}월 ${parseInt(parts[2])}일 일기`;
        shareText(title, `[${title}]\n\n${text}`);
    }
    window.downloadAllDiary = function(){
        let result='[ 인생2막라디오 — 나의 일기장 ]\n\n', count=0;
        for(let i=0;i<730;i++){
            const d=new Date(todayObj); d.setDate(d.getDate()-i);
            const ds=getFormatDate(d), txt=safeGetItem(`diary_${ds}`,null);
            if(txt&&txt.trim()){
                const p=ds.split('-');
                result+=`━━━━━━━━━━━━━━━━━━━━\n${p[0]}년 ${parseInt(p[1])}월 ${parseInt(p[2])}일\n━━━━━━━━━━━━━━━━━━━━\n${txt.trim()}\n\n`;
                count++;
            }
        }
        if(!count){ showToast('저장된 일기가 없어요'); return; }
        downloadTxt(`인생2막라디오_일기장_${getTodayStr()}.txt`, result+`총 ${count}개의 일기`);
    }
    window.downloadAllMemo = function(){
        const memos=safeGetJSON('memos',[]);
        if(!memos.length){ showToast('저장된 필사가 없어요'); return; }
        let result='[ 인생2막라디오 — 나의 필사 기록 ]\n\n';
        memos.forEach(m=>{ result+=`━━━━━━━━━━━━━━━━━━━━\n${m.date}\n━━━━━━━━━━━━━━━━━━━━\n${m.text.trim()}\n\n`; });
        downloadTxt(`인생2막라디오_필사_${getTodayStr()}.txt`, result+`총 ${memos.length}개의 필사`);
    }
    window.downloadAllFreeNote = function(){
        const notes=safeGetJSON('free_notes',[]);
        if(!notes.length){ showToast('저장된 메모가 없어요'); return; }
        let result='[ 인생2막라디오 — 나의 메모 ]\n\n';
        notes.forEach(n=>{ result+=`━━━━━━━━━━━━━━━━━━━━\n${n.date}  ${n.title}\n━━━━━━━━━━━━━━━━━━━━\n${n.body.trim()}\n\n`; });
        downloadTxt(`인생2막라디오_메모_${getTodayStr()}.txt`, result+`총 ${notes.length}개의 메모`);
    }

    function initSettings(){
        renderSurvey();
        syncNicknameEmail(); // ★ 닉네임/이메일 동기화
        const surveyLabel = document.getElementById('survey-saved-label');
        if(surveyLabel){
            surveyLabel.textContent = safeGetItem('survey_saved','') === '1'
                ? '✅ 저장됨 · 수정하려면 클릭' : '선택 사항 · 클릭해서 열기';
        }
        // 닉네임/이메일 현재값 채우기
        const nick = safeGetItem('my_nickname','');
        const ni = document.getElementById('nickname-input');
        if(ni) ni.value = nick;
        const email = safeGetItem('my_email','');
        const ei = document.getElementById('user-email-input');
        if(ei) ei.value = email;
        // 글자 크기
        const fs = safeGetItem('setting_fontsize','normal');
        ['normal','large','xlarge'].forEach(s=>{
            const btn = document.getElementById('size-'+s);
            if(btn) btn.className = 'setting-size-btn' + (fs===s?' active':'');
        });
        // 다크모드
        const dark = safeGetItem('setting_dark','off')==='on';
        updateDarkToggle(dark);
        // 기본 모드
        const mode = safeGetItem('app_mode','A');
        ['A','B'].forEach(m=>{
            const btn = document.getElementById('mode-btn-'+m);
            if(btn) btn.className = 'setting-mode-btn' + (mode===m?' active':'');
        });
        // 배경음악 자동
        const bgmAuto = safeGetItem('setting_bgm_auto','off')==='on';
        updateBgmAutoToggle(bgmAuto);
        initNotifSettings();
        // 설정탭 사연 보내기 버튼 동적 추가
        if (!document.getElementById('settings-story-btn-wrap')) {
            var shareSection = document.querySelector('#view-settings [onclick="shareApp()"]');
            if (shareSection) {
                var storyBtnWrap = document.createElement('div');
                storyBtnWrap.id = 'settings-story-btn-wrap';
                storyBtnWrap.style.cssText = 'margin-top:10px;';
                storyBtnWrap.innerHTML = '<button onclick="openStoryModal&&openStoryModal()" style="width:100%;min-height:48px;background:transparent;border:1.5px solid var(--primary-color);border-radius:12px;font-size:0.9em;font-weight:700;color:var(--primary-color);cursor:pointer;">💌 사연 보내기</button>';
                shareSection.parentNode.appendChild(storyBtnWrap);
            }
        }
    }

    window.setFontSize = function(size){
        safeSetItem('setting_fontsize', size);
        applyFontSize(size);
        ['normal','large','xlarge'].forEach(s=>{
            const btn = document.getElementById('size-'+s);
            if(btn) btn.className = 'setting-size-btn' + (size===s?' active':'');
        });
        showToast('글자 크기가 변경됐어요');
    }

    function applyFontSize(size){
        const root = document.documentElement;
        if(size === 'large'){
            root.style.setProperty('--font-base', '21px');
            root.style.setProperty('--font-sm',   '16px');
            root.style.setProperty('--font-md',   '18px');
            root.style.setProperty('--font-lg',   '23px');
            root.style.setProperty('--font-xl',   '25px');
        } else if(size === 'xlarge'){
            root.style.setProperty('--font-base', '24px');
            root.style.setProperty('--font-sm',   '18px');
            root.style.setProperty('--font-md',   '21px');
            root.style.setProperty('--font-lg',   '26px');
            root.style.setProperty('--font-xl',   '28px');
        } else {
            root.style.setProperty('--font-base', '18px');
            root.style.setProperty('--font-sm',   '14px');
            root.style.setProperty('--font-md',   '16px');
            root.style.setProperty('--font-lg',   '20px');
            root.style.setProperty('--font-xl',   '22px');
        }
    }

    window.toggleDarkMode = function(){
        const isDark = document.body.classList.toggle('dark-mode');
        safeSetItem('setting_dark', isDark?'on':'off');
        updateDarkToggle(isDark);
        showToast(isDark?'🌙 다크모드 켜짐':'☀️ 라이트모드 켜짐');
    }
    function updateDarkToggle(on){
        const tog  = document.getElementById('dark-toggle');
        const thumb= document.getElementById('dark-toggle-thumb');
        if(!tog) return;
        tog.style.background  = on ? 'var(--primary-color)' : '#E8E5E0';
        thumb.style.left      = on ? '29px' : '3px';
    }

    window.setDefaultMode = function(mode){
        safeSetItem('app_mode', mode);
        ['A','B'].forEach(m=>{
            const btn = document.getElementById('mode-btn-'+m);
            if(btn) btn.className = 'setting-mode-btn' + (mode===m?' active':'');
        });
        currentMode = mode;
        switchMode(mode);
        showToast('기본 모드가 변경됐어요. 홈 화면에 반영됐어요!');
    }

    window.toggleBgmAuto = function(){
        const cur = safeGetItem('setting_bgm_auto','off')==='on';
        const next = !cur;
        safeSetItem('setting_bgm_auto', next?'on':'off');
        updateBgmAutoToggle(next);
        showToast(next?'🎵 자동 시작 켜짐':'음악 자동 시작 꺼짐');
    }
    function updateBgmAutoToggle(on){
        const tog  = document.getElementById('bgm-auto-toggle');
        const thumb= document.getElementById('bgm-auto-thumb');
        if(!tog) return;
        tog.style.background = on ? 'var(--primary-color)' : '#E8E5E0';
        thumb.style.left     = on ? '29px' : '3px';
    }

    // ★ 초기화 확인 창
    window.confirmReset = function(){
        // 체크박스 먼저 확인
        const check = document.getElementById('reset-confirm-check');
        if(!check || !check.checked){
            showToast('⚠️ 먼저 체크박스를 클릭해주세요!');
            return;
        }
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:20px;padding:28px 24px;width:88%;max-width:340px;text-align:center;">
                <div style="font-size:36px;margin-bottom:10px;">⚠️</div>
                <div style="font-size:1.1em;font-weight:700;color:#C0392B;margin-bottom:8px;">정말 초기화할까요?</div>
                <div style="font-size:0.88em;color:#666;line-height:1.7;margin-bottom:20px;">
                    <b>모든 기록이 완전히 삭제돼요.</b><br>
                    완료 체크, 기분, 메모, 일기,<br>포인트까지 되돌릴 수 없어요.
                </div>
                <div style="display:flex;gap:10px;">
                    <button onclick="this.closest('div[style*=fixed]').remove(); if(document.getElementById('reset-confirm-check')) document.getElementById('reset-confirm-check').checked=false;" style="flex:1;min-height:48px;background:#F5F5F5;color:#333;border:none;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;">취소</button>
                    <button onclick="this.closest('div[style*=fixed]').remove(); resetAppData();" style="flex:1;min-height:48px;background:#D32F2F;color:#fff;border:none;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;">초기화</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    // ★ 설문 렌더링
    const SURVEYS = {
        age:   { key:'survey_age',   items:['40대','50대','60대','70대 이상','비공개'] },
        route: { key:'survey_route', items:['인생2막라디오 유튜브','지인 공유','검색','광고','기타'] },
        type:  { key:'survey_type',  items:['단순 평범하게','생각이 많은 편','감성적인 편','활동적인 편','기타'] },
        mood:  { key:'survey_mood',  items:['대체로 즐거워요','잔잔한 편이에요','우울할 때가 많아요','신경이 예민해요','들쭉날쭉해요'] },
        happy: { key:'survey_happy', items:['책 읽을 때','산책할 때','운동할 때','음악 들을 때','잠잘 때','영화 볼 때','일기 쓸 때','요리할 때','여행할 때','가족과 함께'] },
    };

    function renderSurvey(){
        Object.entries(SURVEYS).forEach(([name, cfg])=>{
            const el = document.getElementById('survey-' + name);
            if(!el) return;
            const saved = safeGetItem(cfg.key, '');
            el.innerHTML = cfg.items.map(item => {
                const active = saved === item;
                return `<button onclick="selectSurvey('${cfg.key}','${item}',this.parentNode)" style="padding:7px 14px;border-radius:20px;font-size:0.85em;font-weight:600;cursor:pointer;border:1.5px solid ${active?'var(--primary-color)':'var(--border-color)'};background:${active?'var(--primary-color)':'var(--card-bg)'};color:${active?'#fff':'var(--text-color)'};">${item}</button>`;
            }).join('');
        });
    }

    window.selectSurvey = function(key, val, container){
        safeSetItem(key, val);
        // 버튼 스타일 업데이트
        container.querySelectorAll('button').forEach(btn => {
            const active = btn.textContent === val;
            btn.style.border = `1.5px solid ${active?'var(--primary-color)':'var(--border-color)'}`;
            btn.style.background = active ? 'var(--primary-color)' : 'var(--card-bg)';
            btn.style.color = active ? '#fff' : 'var(--text-color)';
        });
    }

    window.saveSurvey = function(){
        // 설문 데이터 수집
        const surveyData = {
            age: safeGetItem('survey_age',''),
            route: safeGetItem('survey_route',''),
            type: safeGetItem('survey_type',''),
            mood: safeGetItem('survey_mood',''),
            happy: safeGetItem('survey_happy',''),
        };
        showToast('😊 저장됐어요! 감사해요!');
        window._sendUserUpdate();
        window._sendSurveyLog(surveyData); // ★ 설문 로그
    }

    window.resetAppData = function(){
        const area = document.querySelector('#view-settings');
        // 인라인 확인 UI
        const confirmBox = document.createElement('div');
        confirmBox.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);width:90%;max-width:400px;background:#FFFFFF;border-radius:16px;padding:24px;box-shadow:0 8px 30px rgba(0,0,0,0.2);z-index:9999;text-align:center;border:2px solid #D32F2F;';
        confirmBox.innerHTML = `
            <div style="font-size:20px;font-weight:bold;color:#D32F2F;margin-bottom:10px;">⚠️ 정말 초기화할까요?</div>
            <div style="font-size:17px;color:#555;margin-bottom:20px;line-height:1.6;">모든 기록이 영구 삭제됩니다.<br>되돌릴 수 없어요.</div>
            <div style="display:flex;gap:10px;">
                <button onclick="doResetApp()" style="flex:1;min-height:52px;font-size:18px;font-weight:bold;background:#D32F2F;color:#fff;border:none;border-radius:12px;cursor:pointer;">초기화</button>
                <button onclick="this.closest('div[style]').remove()" style="flex:1;min-height:52px;font-size:18px;font-weight:bold;background:#E8E5E0;color:#333;border:none;border-radius:12px;cursor:pointer;">취소</button>
            </div>`;
        document.body.appendChild(confirmBox);
    }

    window.doResetApp = function(){
        const keys = ['completed_dates','favorites','memos','free_notes','earned_badges','used_tickets',
            'fav_count_total','memo_count_total','insight_last_shown','subscribe_nudge_shown',
            'banner_hidden_date','start_date_B'];
        keys.forEach(k=> { try{localStorage.removeItem(k);}catch(e){} });
        // 일기 삭제
        for(let i=0;i<365;i++){
            const d=new Date(todayObj); d.setDate(d.getDate()-i);
            try{localStorage.removeItem(`diary_${getFormatDate(d)}`);}catch(e){}
            try{localStorage.removeItem(`mood_rose_${getFormatDate(d)}`);}catch(e){}
        }
        document.querySelectorAll('div[style*="position:fixed"]').forEach(el=>el.remove());
        showToast('✅ 초기화 완료! 새로 시작해요.');
        setTimeout(()=> location.reload(), 1500);
    }

    // initApp에서 저장된 설정 적용
    function applyStoredSettings(){
        applyFontSize(safeGetItem('setting_fontsize','normal'));
        if(safeGetItem('setting_dark','off')==='on') document.body.classList.add('dark-mode');
        const nick = safeGetItem('my_nickname','');
        const ni = document.getElementById('nickname-input');
        if(ni && nick) ni.value = nick;
        // 이메일 로딩
        const email = safeGetItem('my_email','');
        const ei = document.getElementById('user-email-input');
        if(ei) ei.value = email;
        const se = document.getElementById('story-email');
        if(se && email) se.value = email;
        const sender = safeGetItem('family_sender','');
        const si = document.getElementById('family-sender-input');
        if(si) si.value = sender || '';
        const receiver = safeGetItem('family_receiver','');
        const ri = document.getElementById('family-receiver-input');
        if(ri) ri.value = receiver || '';
    }
    let affirmInclude = true;

    window.toggleAffirmInclude = function(){
        affirmInclude = !affirmInclude;
        const box = document.getElementById('affirm-check');
        box.style.background = affirmInclude ? 'var(--primary-color)' : '#E8E5E0';
        box.innerHTML = affirmInclude
            ? '<span style="color:#fff;font-size:16px;font-weight:bold;">✓</span>'
            : '';
    }

    function initStoryView(){
        // 닉네임/이메일 자동 입력
        const nick = safeGetItem('my_nickname','');
        const email = safeGetItem('my_email','');
        const nameEl = document.getElementById('story-name');
        const emailEl = document.getElementById('story-email');
        if(nameEl && nick && !nameEl.value) nameEl.value = nick;
        if(emailEl && email && !emailEl.value) emailEl.value = email;

        // 글자수 카운터
        const body = document.getElementById('story-body');
        if(body){
            body.addEventListener('input', ()=>{
                document.getElementById('story-char-count').textContent = body.value.length + '자';
            });
        }
        // 체크박스 초기화
        affirmInclude = true;
        const box = document.getElementById('affirm-check');
        if(box){
            box.style.background = 'var(--primary-color)';
            box.innerHTML = '<span style="color:#fff;font-size:16px;font-weight:bold;">✓</span>';
        }
    }

    window.sendStory = function(){
        const title = document.getElementById('story-title').value.trim();
        const body  = document.getElementById('story-body').value.trim();
        const name  = document.getElementById('story-name').value.trim();

        if(!title){ showToast('제목을 입력해주세요'); return; }
        if(!body)  { showToast('사연 내용을 입력해주세요'); return; }

        let emailBody = '';
        if(name) emailBody += `[이름] ${name}\n\n`;
        emailBody += body;

        // 오늘 확언 포함
        if(affirmInclude){
            const affirmEl = document.getElementById('affirmation-text');
            const dayEl    = document.getElementById('day-label');
            if(affirmEl && dayEl){
                emailBody += `\n\n——————————\n오늘의 확언 (${dayEl.innerText})\n"${affirmEl.innerText}"`;
            }
        }

        const to      = 'life2radio@gmail.com';
        const subject = encodeURIComponent(`[인생2막라디오 사연] ${title}`);
        const bodyEnc = encodeURIComponent(emailBody);

        window.location.href = `mailto:${to}?subject=${subject}&body=${bodyEnc}`;
    }

    /* ===== ★ 10단계: 알림 설정 ===== */
    function initNotifSettings(){
        const statusBox  = document.getElementById('notif-status-box');
        const timeBox    = document.getElementById('notif-time-box');
        const requestBox = document.getElementById('notif-request-box');
        if(!statusBox) return;

        if(!('Notification' in window)){
            statusBox.style.background='#FFF0F0';
            statusBox.style.color='#D32F2F';
            statusBox.style.background='#FFF8E7';statusBox.style.color='#7B5800';statusBox.innerHTML='<div style="font-size:0.9em;font-weight:700;">⚠️ 이 환경에서는 알림을 받을 수 없어요</div><div style="font-size:0.82em;margin-top:6px;color:#555;line-height:1.7;">파일로 실행 중이라 브라우저 알림이 작동하지 않아요.<br>대신 폰에 꺼내두기 후 폰 알람 앱을 활용해보세요!</div>';
            return;
        }

        const perm = Notification.permission;
        const savedTime = safeGetItem('notif_time','');

        if(perm === 'granted'){
            statusBox.style.background='#F0F7F4';
            statusBox.style.color='var(--primary-color)';
            statusBox.textContent = savedTime
                ? `✅ 알림이 설정되어 있어요 — 매일 ${savedTime}`
                : '✅ 알림 권한이 허용됐어요. 시간을 설정해주세요.';
            timeBox.style.display='block';
            requestBox.style.display='none';
            if(savedTime) document.getElementById('notif-time-input').value = savedTime;
        } else if(perm === 'denied'){
            statusBox.style.background='#FFF8E7';
            statusBox.style.color='#7B5800';
            statusBox.innerHTML=`
                <div style="font-size:0.95em;font-weight:700;margin-bottom:10px;">⚠️ 이 방식으로는 알림을 받기 어려워요</div>
                <div style="font-size:0.85em;color:#555;line-height:1.8;margin-bottom:12px;">
                    이 앱은 파일로 실행되고 있어요. 파일 방식에서는 브라우저 알림이 작동하지 않아요.<br>
                    대신 아래 방법을 추천해요!
                </div>
                <div style="background:#FFFFFF;border-radius:10px;padding:14px;border:1px solid #E8D88A;">
                    <div style="font-size:0.88em;font-weight:700;color:var(--primary-color);margin-bottom:6px;">✅ 추천 — 폰에 꺼내두기 + 폰 알람 사용</div>
                    <div style="font-size:0.82em;color:#444;line-height:1.8;">
                        1️⃣ 아래 <b>"내 폰에 앱으로 꺼내두기"</b> 안내대로 추가<br>
                        2️⃣ 폰 기본 <b>알람 앱</b>에서 원하는 시간에 알람 설정<br>
                        3️⃣ 알람 울리면 홈화면 아이콘 탭 → 바로 확언 시작
                    </div>
                </div>`;
            timeBox.style.display='none';
            requestBox.style.display='none';
        } else {
            statusBox.style.background='#FFF8E7';
            statusBox.style.color='#8B6914';
            statusBox.textContent='💡 알림 허용을 하면 매일 정해진 시간에 확언 알림을 받을 수 있어요.';
            timeBox.style.display='none';
            requestBox.style.display='block';
        }
    }

    window.requestNotifPermission = async function(){
        try{
            const result = await Notification.requestPermission();
            if(result === 'granted'){
                showToast('🔔 알림이 허용됐어요! 시간을 설정해주세요.');
                initNotifSettings();
                scheduleTestNotif();
            } else {
                showToast('알림이 차단됐어요. 브라우저 설정에서 허용해주세요.');
                initNotifSettings();
            }
        } catch(e){ showToast('알림 설정 중 오류가 발생했어요.'); }
    }

    function scheduleTestNotif(){
        setTimeout(()=>{
            if(Notification.permission==='granted'){
                new Notification('🌿 품속', {
                    body:'알림이 정상적으로 설정됐어요! 매일 확언으로 하루를 시작해보세요 😊',
                    icon:''
                });
            }
        }, 1500);
    }

    window.setNotifPreset = function(time){
        document.getElementById('notif-time-input').value = time;
        saveNotifTime(time);
    }

    window.saveNotifTime = function(presetTime){
        const time = presetTime || document.getElementById('notif-time-input').value;
        if(!time){ showToast('시간을 선택해주세요'); return; }
        safeSetItem('notif_time', time);
        // ServiceWorker 없이는 실제 백그라운드 알림 불가 → 탭 열려있을 때 알림 예약
        scheduleNotifForToday(time);
        showToast(`🔔 매일 ${time}에 알림이 설정됐어요!`);
        initNotifSettings();
    }

    window.cancelNotif = function(){
        safeSetItem('notif_time','');
        showToast('🔕 알림이 꺼졌어요.');
        initNotifSettings();
    }

    function scheduleNotifForToday(timeStr){
        if(Notification.permission!=='granted') return;
        const [h,m] = timeStr.split(':').map(Number);
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
        if(target <= now) target.setDate(target.getDate()+1);
        const delay = target - now;
        // 탭이 열려있는 동안만 유효 (ServiceWorker 없이 가능한 방법)
        clearTimeout(window._notifTimer);
        window._notifTimer = setTimeout(()=>{
            const dc = getDayCountNow();
            const data = affirmationsData[(dc-1)%affirmationsData.length];
            new Notification('🌿 오늘의 확언', {
                body: data.text.substring(0,60)+'...',
                icon:''
            });
        }, delay);
    }

    // 앱 시작 시 저장된 알림 시간 복원
    function restoreNotifSchedule(){
        const time = safeGetItem('notif_time','');
        if(time && Notification.permission==='granted'){
            scheduleNotifForToday(time);
        }
    }
    // ★ 영상 업로드 시 url만 채워넣으면 됩니다. url이 빈 문자열이면 "준비중"으로 표시

    // 현재 확언 테마와 가장 가까운 Shorts 추천
    function getTodayMatchedShorts(){
        const affirmEl = document.getElementById('affirmation-text');
        const themeEl  = document.getElementById('theme-text');
        const todayTheme = themeEl ? themeEl.innerText.replace(/["""]/g,'').trim() : '';
        // 테마 키워드 매칭
        const keywords = ['감사','용기','자존감','관계','감정','성장','현재','치유','습관','주도권','회복','자기수용','건강','완성'];
        let matched = SHORTS_DATA.filter(s=> todayTheme.includes(s.theme) || s.theme.split('').some(c=> todayTheme.includes(c)));
        if(!matched.length) matched = [SHORTS_DATA[Math.floor(Math.random()*SHORTS_DATA.length)]];
        return matched[0];
    }

    function initShortsView(){
        // 오늘의 추천
        const matched = getTodayMatchedShorts();
        const todayCard = document.getElementById('today-shorts-card');
        if(todayCard){
            todayCard.innerHTML = renderShortsCard(matched, true);
        }
        // 전체 목록
        const listEl = document.getElementById('shorts-list');
        if(listEl){
            listEl.innerHTML = SHORTS_DATA.map(s=> renderShortsCard(s, false)).join('');
        }
    }

    function renderShortsCard(s, featured){
        const hasUrl = s.url && s.url.trim() !== '';
        const badge = `<span style="background:${featured?'var(--primary-color)':'#E8E5E0'};color:${featured?'#fff':'#666'};font-size:13px;font-weight:bold;padding:3px 10px;border-radius:20px;">${s.theme}</span>`;
        const epBadge = `<span style="font-size:14px;color:#888;font-weight:bold;">EP.${String(s.ep).padStart(2,'0')}</span>`;
        const btn = hasUrl
            ? `<a href="${s.url}" target="_blank" style="display:inline-block;background:var(--primary-color);color:#fff;font-size:15px;font-weight:bold;padding:8px 18px;border-radius:20px;text-decoration:none;white-space:nowrap;">▶ 보러가기</a>`
            : `<span style="background:#F0F0F0;color:#aaa;font-size:15px;font-weight:bold;padding:8px 18px;border-radius:20px;">🔜 준비중</span>`;
        return `<div style="background:#FFFFFF;border:1px solid #E8E5E0;border-radius:14px;padding:16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:12px;${featured?'border-color:var(--accent-color);':''}">
            <div style="flex:1;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">${epBadge}${badge}</div>
                <div style="font-size:18px;font-weight:bold;color:var(--primary-color);line-height:1.4;">${s.title}</div>
              </div>
            <div style="flex-shrink:0;">${btn}</div>
        </div>`;
    }

    // ===== 앱 시작 =====
    document.addEventListener('DOMContentLoaded', function(){
        // ★ 필사 입력창 붙여넣기 차단
        document.addEventListener('paste', function(e){
            if(e.target && e.target.id === 'memo-input'){
                e.preventDefault();
                showToast('붙여넣기는 안 돼요! 직접 손으로 써보세요 ✏️');
            }
        });

        // ★ 등급/포인트 텍스트 자동 클릭 연결
        function linkLevelAndPoint(){
            // PT 텍스트 포함 요소 → 포인트 가이드
            document.querySelectorAll('[id^="shorts-pt"]').forEach(el => {
                if(!el.onclick) el.style.cursor = 'pointer';
            });
            // 등급명 텍스트 포함 span/div → 등급 가이드
            const levelNames = ['씨앗','새싹','풀잎','확언러','실천가','인생2막러','라디오스타','인생챔피언'];
            document.querySelectorAll('.affirmation-view, #view-home, #view-calendar, #view-shorts').forEach(view => {
                view.querySelectorAll('span, div').forEach(el => {
                    // 직접 텍스트만 있고 자식 없는 요소만
                    if(el.children.length === 0 && el.onclick === null){
                        const txt = el.textContent.trim();
                        if(levelNames.some(n => txt.includes(n) && txt.length < 30)){
                            el.style.cursor = 'pointer';
                            el.onclick = openLevelGuide;
                        }
                        if(txt.includes('PT') && txt.length < 15 && /\d/.test(txt)){
                            el.style.cursor = 'pointer';
                            el.onclick = openPointGuide;
                        }
                    }
                });
            });
        }
        setTimeout(linkLevelAndPoint, 1500);

        // ★ 구글 OAuth 처리
        const _oauthHash = window.location.hash;
        if(_oauthHash && _oauthHash.includes('access_token')){
            const _oauthParams = new URLSearchParams(_oauthHash.substring(1));
            const _oauthToken = _oauthParams.get('access_token');
            if(_oauthToken){
                history.replaceState(null, '', window.location.pathname);
                fetch('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' + _oauthToken)
                    .then(function(r){ return r.json(); })
                    .then(function(info){
                        if(info.email){
                            // 새 탭에서 열린 경우: opener에게 postMessage 후 탭 닫기
                            if(window.opener && !window.opener.closed){
                                window.opener.postMessage({
                                    type: 'oauth_email',
                                    email: info.email,
                                    name: info.name || ''
                                }, '*');
                                setTimeout(function(){ window.close(); }, 500);
                            } else {
                                // 리디렉션으로 온 경우: 기존 방식
                                safeSetItem('oauth_pending_email', info.email);
                                if(info.name) safeSetItem('oauth_pending_name', info.name);
                            }
                        }
                    }).catch(function(){});
            }
        }

        // ★ #psych 해시 & 카카오톡 처리 — 가장 먼저 실행
        const _urlParams = new URLSearchParams(window.location.search);
        const _hasPsychParam = _urlParams.get('psych')==='1' || window.location.hash === '#psych';
        const _rParam = _urlParams.get('r');  // ★ 결과 공유 링크
        const _tabParam = _urlParams.get('tab') || window.location.hash.replace('#','');  // ★ 탭 직접 이동
        const _isKakao = /KAKAOTALK/i.test(navigator.userAgent);
        const _isAndroid = /Android/i.test(navigator.userAgent);

        // ★ ?r= 결과 공유 링크 처리 (최우선)
        if(_rParam){
            history.replaceState(null, '', location.pathname);
            try {
                const compact = JSON.parse(decodeURIComponent(atob(_rParam)));
                const animalData = PSYCH_ANIMALS[compact.a];
                if(animalData && compact.s){
                    window._sharedResult = { typeKey:compact.a, animal:animalData, scores:compact.s, viaStrengths:compact.v||[] };
                }
            } catch(e){ console.log('결과 링크 오류', e); }
        }

        if((_hasPsychParam || _rParam) && _isKakao){
            // 카톡 → 크롬으로 이동 (결과 링크 포함해서)
            const _destUrl = _rParam
                ? 'https://life2radio.github.io/pumsok/?r=' + encodeURIComponent(_rParam)
                : (window.getPsychResultUrl() || 'https://life2radio.github.io/pumsok/?psych=1');
            history.replaceState(null, '', window.location.pathname);
            const psychUrl = _destUrl;
            const pm = document.createElement('div');
            pm.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.82);z-index:999999;display:flex;align-items:center;justify-content:center;';
            pm.innerHTML = `
                <div style="background:#FFFFFF;border-radius:24px;padding:32px 24px;width:90%;max-width:380px;text-align:center;">
                    <div style="font-size:48px;margin-bottom:12px;">🧠</div>
                    <div style="font-size:1.15em;font-weight:700;color:#1B4332;margin-bottom:8px;">크롬에서 열어야 결과가 저장돼요!</div>
                    <div style="font-size:0.88em;color:#555;line-height:1.9;margin-bottom:20px;">
                        카카오톡에서는 심리테스트 결과가<br>
                        저장되지 않아요.<br>
                        아래 버튼을 누르면 크롬이 열려요.<br><br>
                        크롬 주소창에 <b>붙여넣기</b>만 하면<br>
                        <b style="color:#1B4332;">결과가 저장되는 심리테스트</b>를 시작할 수 있어요 😊
                    </div>
                    <button id="psych-chrome-btn2" style="width:100%;min-height:56px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;margin-bottom:10px;">
                        🌿 인생확언 앱에서 심리테스트 시작하기
                    </button>
                </div>`;
            document.body.appendChild(pm);
            document.getElementById('psych-chrome-btn2').addEventListener('click', function(){
                const t = document.createElement('textarea');
                t.value = psychUrl; document.body.appendChild(t);
                t.select(); document.execCommand('copy'); document.body.removeChild(t);
                if(navigator.clipboard) navigator.clipboard.writeText(psychUrl).catch(()=>{});
                this.textContent = '✅ 주소 복사됨! 크롬 열리면 붙여넣기 하세요';
                this.style.background = '#2E7D32';
                setTimeout(()=>{
                    window.open('intent://life2radio.github.io/pumsok/?psych=1#Intent;scheme=https;package=com.android.chrome;end','_blank');
                }, 400);
            });
            // initApp은 "그냥 여기서" 버튼 클릭 시에만 실행

        } else if(_isKakao && _isAndroid && !_hasPsychParam){
            // 일반 카톡 → 기존 설치 안내 팝업
            const appUrl = 'https://life2radio.github.io/pumsok/';
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.82);z-index:999999;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `
                <div style="background:#FFFFFF;border-radius:24px;padding:32px 24px;width:90%;max-width:380px;text-align:center;">
                    <div style="font-size:40px;margin-bottom:12px;">🌿</div>
                    <div style="font-size:1.15em;font-weight:700;color:#1B4332;margin-bottom:8px;">크롬에서 열어야 설치돼요!</div>
                    <div style="font-size:0.88em;color:#555;line-height:1.9;margin-bottom:20px;">
                        카카오톡에서는 앱 설치가 안 돼요.<br>
                        아래 버튼을 누르면<br>
                        <b style="color:#1B4332;">주소가 자동 복사되고 크롬이 열려요.</b><br><br>
                        크롬 주소창에 <b>붙여넣기</b>만 하면 끝! 😊
                    </div>
                    <button id="kakao-chrome-btn" style="width:100%;min-height:56px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1em;font-weight:700;cursor:pointer;">
                        🌿 인생확언 앱 열기
                    </button>
                </div>`;
            document.body.appendChild(modal);
            document.getElementById('kakao-chrome-btn').addEventListener('click', function(){
                const t = document.createElement('textarea');
                t.value = appUrl; document.body.appendChild(t);
                t.select(); document.execCommand('copy'); document.body.removeChild(t);
                if(navigator.clipboard) navigator.clipboard.writeText(appUrl).catch(()=>{});
                this.textContent = '✅ 주소 복사됨! 크롬 열리면 붙여넣기 하세요';
                this.style.background = '#2E7D32';
                setTimeout(()=>{
                    window.open('intent://life2radio.github.io/pumsok/#Intent;scheme=https;package=com.android.chrome;end','_blank');
                }, 400);
            });
            window.initApp();

        } else {
            // 일반 크롬/사파리
            if(_hasPsychParam){
                // ★ 심리테스트 모드: 설치 팝업 건너뛰고 바로 심리테스트
                window._psychMode = true;
                history.replaceState(null, '', window.location.pathname);
                window.initApp();
                window._psychMode = false;
                setTimeout(()=>{ startPsychTest(); }, 600);
            } else {
                window.initApp();
            }
        }

        // ★ 심리테스트 종료 확인 커스텀 다이얼로그
        function showPsychExitConfirm(onConfirm) {
            var existing = document.getElementById('psych-exit-confirm');
            if (existing) existing.remove();
            var box = document.createElement('div');
            box.id = 'psych-exit-confirm';
            box.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
            box.innerHTML = '<div style="background:#fff;border-radius:18px;padding:28px 24px;width:86%;max-width:320px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.18);">'
                + '<div style="font-size:0.78em;font-weight:800;color:#1B4332;margin-bottom:10px;letter-spacing:0.5px;">🧠 인생확언앱 알림</div>'
                + '<div style="font-size:1em;font-weight:700;color:#222;margin-bottom:6px;">심리테스트를 종료할까요?</div>'
                + '<div style="font-size:0.85em;color:#888;margin-bottom:22px;line-height:1.6;">진행 중인 답변은 저장되지 않아요.</div>'
                + '<div style="display:flex;gap:10px;">'
                + '<button id="psych-exit-cancel" style="flex:1;min-height:44px;background:#f5f5f5;color:#555;border:none;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;">취소</button>'
                + '<button id="psych-exit-ok" style="flex:1;min-height:44px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;">종료</button>'
                + '</div></div>';
            document.body.appendChild(box);
            document.getElementById('psych-exit-cancel').addEventListener('click', function(){ box.remove(); });
            document.getElementById('psych-exit-ok').addEventListener('click', function(){
                box.remove();
                if (typeof onConfirm === 'function') onConfirm();
            });
        }

        // ★ psych-modal 제거 시 overscrollBehavior 자동 복원
        (function(){
            var _psychObserver = new MutationObserver(function(mutations){
                mutations.forEach(function(m){
                    m.removedNodes.forEach(function(node){
                        if(node.id === 'psych-modal'){
                            document.body.style.overscrollBehavior = '';
                        }
                    });
                });
            });
            _psychObserver.observe(document.body, {childList: true});
        })();

        // ★ 뒤로가기 처리 시스템
        // 항상 뒤로가기를 가로채기 위해 dummy state push
        history.pushState(null, null, location.href);

        window.addEventListener('popstate', function(e){
            // 다음 뒤로가기도 가로채기 위해 즉시 dummy state 재push
            history.pushState(null, null, location.href);

            // ── 1순위: 검색 모달 ──
            var searchModal = document.getElementById('search-modal');
            if(searchModal && searchModal.style.display !== 'none'){
                searchModal.style.display = 'none';
                return;
            }

            // ── 2순위: 공유 모달들 ──
            var shareModal = document.getElementById('share-modal');
            if(shareModal && shareModal.style.display !== 'none'){
                shareModal.style.display = 'none';
                return;
            }
            var shareAppModal = document.getElementById('share-app-modal');
            if(shareAppModal && shareAppModal.style.display !== 'none'){
                shareAppModal.style.display = 'none';
                return;
            }

            // ── 3순위: BGM 모달 ──
            var bgmModal = document.getElementById('bgm-modal');
            if(bgmModal && bgmModal.style.display !== 'none'){
                bgmModal.style.display = 'none';
                return;
            }

            // ── 3.5순위: 심리테스트 모달 ──
            var psychModal = document.getElementById('psych-modal');
            if (psychModal) {
                var _inTest = typeof pStep!=='undefined' && typeof getPTotal==='function' && pStep > 0 && pStep < getPTotal();
                if (_inTest) {
                    showPsychExitConfirm(function(){
                        psychModal.remove();
                        document.body.style.overscrollBehavior = '';
                    });
                } else {
                    psychModal.remove();
                    document.body.style.overscrollBehavior = '';
                }
                return;
            }

            // ── 4순위: 기타 팝업 (style 속성에 fixed 포함된 것) ──
            var skipIds = ['main-app','onboarding-overlay','search-modal',
                'share-modal','share-app-modal','bgm-modal','toast-container'];
            var allDivs = document.querySelectorAll('body > div');
            var popup = null;
            for(var i = allDivs.length - 1; i >= 0; i--){
                var el = allDivs[i];
                if(skipIds.indexOf(el.id) !== -1) continue;
                var css = el.getAttribute('style') || '';
                if(css.indexOf('fixed') !== -1 && el.style.display !== 'none'){
                    popup = el; break;
                }
            }
            if(popup){
                try { popup.remove(); } catch(er){ popup.style.display = 'none'; }
                return;
            }

            // ── 5순위: 이전 뷰로 이동 ──
            if(window._viewHistory && window._viewHistory.length > 0){
                var prev = window._viewHistory.pop();
                window.switchView(prev, true);
                return;
            }

            // ── 6순위: 홈이 아니면 홈으로 ──
            if(window._currentView && window._currentView !== 'home'){
                window._viewHistory = [];
                window.switchView('home', true);
                return;
            }

            // ── 7순위: 홈에서 두 번 뒤로가기 ──
            if(window._backPressedOnce){
                window._backPressedOnce = false;
                window.history.go(-(window.history.length));
                return;
            }
            window._backPressedOnce = true;
            showToast('한 번 더 누르면 앱을 나가요.');
            setTimeout(function(){ window._backPressedOnce = false; }, 2000);
        });
    });

// ============================================================
// ★ 결과 이미지 저장 (앱 미설치 → 게이팅 / 설치 → PNG 저장)
// ============================================================
window.downloadPsychImage = function(result) {
    var r = result || window._lastPsychResult;
    if (!r || !r.animal) { showToast('결과를 먼저 완료해주세요!'); return; }

    // 미등록 → 게이팅 모달
    var nick  = safeGetItem('my_nickname','');
    var email = safeGetItem('my_email','');
    if (!nick || !email) {
        var gm = document.getElementById('psych-gating-modal');
        if (gm) { gm.style.display = 'flex'; }
        else { showToast('📸 이름·이메일을 먼저 등록해주세요!'); }
        return;
    }

    // ── 이미지 미리보기 모달 표시 함수 ──
    function showImagePreviewModal(dataUrl, blob, filename) {
        // 기존 모달 제거
        var exist = document.getElementById('img-preview-modal');
        if (exist) exist.remove();

        var modal = document.createElement('div');
        modal.id = 'img-preview-modal';
        modal.style.cssText = [
            'position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;',
            'background:rgba(0,0,0,0.92);display:flex;flex-direction:column;',
            'align-items:center;justify-content:center;padding:16px;box-sizing:border-box;'
        ].join('');

        var img = document.createElement('img');
        img.src = dataUrl;
        img.style.cssText = 'max-width:100%;max-height:60vh;border-radius:16px;border:2px solid #C9A84C;';

        var hint = document.createElement('div');
        hint.style.cssText = 'color:rgba(255,255,255,0.6);font-size:0.78em;margin:12px 0 4px;text-align:center;';
        hint.textContent = '이미지를 길게 눌러 저장하거나, 아래 버튼을 이용하세요';

        var btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:10px;width:100%;max-width:380px;margin-top:8px;';

        // 갤러리 저장 버튼
        var btnSave = document.createElement('button');
        btnSave.style.cssText = [
            'flex:1;padding:14px 0;background:#C9A84C;color:#1B4332;',
            'border:none;border-radius:12px;font-size:0.92em;font-weight:900;cursor:pointer;'
        ].join('');
        btnSave.textContent = '📥 갤러리 저장';
        btnSave.onclick = function() {
            if (blob && navigator.share && navigator.canShare) {
                var file = new File([blob], filename, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    navigator.share({ files: [file], title: r.animal.name + ' 성격 유형' })
                        .then(function(){ showToast('✅ 저장 완료!'); modal.remove(); })
                        .catch(function(){ _fallbackDownload(dataUrl, r, r.variantKey||'A'); modal.remove(); });
                    return;
                }
            }
            _fallbackDownload(dataUrl, r, r.variantKey||'A');
            modal.remove();
        };

        // 공유하기 버튼
        var btnShare = document.createElement('button');
        btnShare.style.cssText = [
            'flex:1;padding:14px 0;background:#1B4332;color:#fff;',
            'border:1px solid #C9A84C;border-radius:12px;font-size:0.92em;font-weight:900;cursor:pointer;'
        ].join('');
        btnShare.textContent = '📤 공유하기';
        btnShare.onclick = function() {
            if (blob && navigator.share) {
                var file = new File([blob], filename, { type: 'image/png' });
                navigator.share({ files: [file], title: r.animal.name + ' 성격 유형', text: '나의 64유형 심리테스트 결과예요! 💚' })
                    .then(function(){ modal.remove(); })
                    .catch(function(){});
            } else if (navigator.share) {
                navigator.share({ title: r.animal.name, text: '나의 64유형 심리테스트 결과예요!' }).catch(function(){});
                modal.remove();
            }
        };

        // 닫기 버튼
        var btnClose = document.createElement('button');
        btnClose.style.cssText = [
            'position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.15);',
            'color:#fff;border:none;border-radius:50%;width:36px;height:36px;',
            'font-size:1.1em;cursor:pointer;display:flex;align-items:center;justify-content:center;'
        ].join('');
        btnClose.textContent = '✕';
        btnClose.onclick = function() { modal.remove(); };

        modal.style.position = 'fixed';
        btnRow.appendChild(btnSave);
        btnRow.appendChild(btnShare);
        modal.appendChild(btnClose);
        modal.appendChild(img);
        modal.appendChild(hint);
        modal.appendChild(btnRow);

        // 배경 클릭 시 닫기
        modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    showToast('📸 이미지를 만들고 있어요...');
    var W = 1080, H = 1080;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var FONT = '"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';

    // 배경
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1B4332');
    grad.addColorStop(0.6, '#0D2B20');
    grad.addColorStop(1, '#050F0A');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // 골드 테두리
    ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 6;
    ctx.strokeRect(44, 44, W-88, H-88);
    ctx.lineWidth = 1.5; ctx.strokeRect(56, 56, W-112, H-112);

    // 후광
    var glow = ctx.createRadialGradient(W/2, 320, 0, W/2, 320, 260);
    glow.addColorStop(0, 'rgba(201,168,76,0.22)');
    glow.addColorStop(1, 'rgba(201,168,76,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(W/2, 320, 260, 0, Math.PI*2); ctx.fill();

    // 동물 이모지
    ctx.font = '190px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(r.animal.animal, W/2, 310);

    // 64유형 배지
    var _vKey = r.variantKey || 'A';
    var variantLabel = (r.variant && r.variant.label) ? r.variant.label : r.animal.name;
    ctx.font = 'bold 34px ' + FONT; ctx.fillStyle = '#C9A84C';
    ctx.fillText(r.animal.name + '-' + _vKey + '  ' + variantLabel, W/2, 520);

    // 동물 이름
    ctx.font = '900 82px ' + FONT; ctx.fillStyle = '#FFFFFF';
    ctx.fillText(r.animal.name, W/2, 615);

    // MBTI
    if (r.animal.mbti) {
        ctx.font = '500 32px ' + FONT; ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('MBTI: ' + r.animal.mbti, W/2, 680);
    }

    // 구분선
    ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(160, 720); ctx.lineTo(W-160, 720); ctx.stroke();

    // 대표 유명인
    var celebName = '';
    if (r.variant && r.variant.celebrities && r.variant.celebrities.length > 0) {
        var c0 = r.variant.celebrities[0];
        celebName = typeof c0 === 'object' ? c0.name : String(c0);
    }
    if (celebName) {
        ctx.font = 'bold 30px ' + FONT; ctx.fillStyle = '#C9A84C';
        ctx.fillText('👥 닮은 리더: ' + celebName, W/2, 775);
    }

    // Big5 점수
    var s = r.scores || {};
    var sc = ['외향 '+(s.E||0)+'%','개방 '+(s.O||0)+'%','친화 '+(s.A||0)+'%','성실 '+(s.C||0)+'%','안정 '+(100-(s.N||0))+'%'].join('  ');
    ctx.font = '400 26px ' + FONT; ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText(sc, W/2, 845);

    // 닉네임
    if (nick) {
        ctx.font = '400 28px ' + FONT; ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText(nick + ' 님의 성격 유형', W/2, 910);
    }

    // 워터마크
    ctx.font = '400 24px ' + FONT; ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('🌿 인생2막라디오 · 64유형 심리테스트', W/2, 975);

    // ── 캔버스 완성 후 미리보기 모달 표시 ──
    setTimeout(function() {
        try {
            var dataUrl = canvas.toDataURL('image/png');
            var filename = '인생2막_' + r.animal.name + '-' + _vKey + '.png';
            // blob 생성 후 미리보기 모달
            canvas.toBlob(function(blob) {
                showImagePreviewModal(dataUrl, blob, filename);
            }, 'image/png');
        } catch(e) { showToast('이미지 생성 오류: ' + e.message); }
    }, 300);
};

function _fallbackDownload(dataUrl, r, _vKey) {
    try {
        var link = document.createElement('a');
        link.download = '인생확언_' + r.animal.name + '-' + _vKey + '.png';
        link.href = dataUrl;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        showToast('✅ 이미지가 저장됐어요!');
    } catch(e) {
        // 마지막 수단: 새 탭에서 이미지 열기
        var w = window.open();
        if(w) { w.document.write('<img src="' + dataUrl + '" style="max-width:100%">'); }
        showToast('📸 이미지를 길게 눌러 저장하세요!');
    }
}


// ════════════════════════════════════════════════════
// 🎯 다짐 기능 (VOW SYSTEM)
// ════════════════════════════════════════════════════

// ── nav·뷰 동적 초기화 (index.html 무수정) ──
function initVowNavAndView() {
    // 1. 네비 텍스트 + 아이콘 + 배지 교체
    var navBtn = document.getElementById('nav-story');
    if (navBtn) {
        navBtn.dataset.vowInited = '1';
        navBtn.style.position = 'relative';
        // 아이콘 교체
        var svg = navBtn.querySelector('svg');
        if (svg) svg.innerHTML = '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>';
        // 텍스트 교체
        var span = navBtn.querySelector('.nav-text');
        if (span) span.textContent = '다짐';
        // 배지 추가
        if (!document.getElementById('vow-badge')) {
            var badge = document.createElement('span');
            badge.id = 'vow-badge';
            badge.style.cssText = 'display:none;position:absolute;top:2px;right:6px;width:8px;height:8px;background:#E53E3E;border-radius:50%;';
            navBtn.appendChild(badge);
        }
    }

    // 2. view-story 안에 vow-main-wrap 주입
    var viewStory = document.getElementById('view-story');
    if (viewStory && !document.getElementById('vow-main-wrap')) {
        viewStory.innerHTML = '<div id="vow-main-wrap"></div>';
    }
}

function renderVowView() {
    var wrap = document.getElementById('vow-main-wrap');
    if (!wrap) return;
    var vow = safeGetJSON('vow_data', null);
    if (!vow || !vow.confirmed) {
        renderVowSetup(wrap);
    } else {
        renderVowMain(wrap, vow);
    }
    updateVowBadge();
}

// ── 스텝 트래킹 ──
var _vowStep = 1;
var _vowDraft = {};

// ── STEP 1~2: 세팅 화면 ──
function renderVowSetup(wrap) {
    wrap.innerHTML =
        '<div style="padding:0 0 80px;">' +

        // 뇌과학 섹션 (접기/펼치기)
        '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:16px;padding:20px;margin-bottom:20px;">' +
        '<div style="font-size:1.15em;font-weight:900;color:#fff;margin-bottom:6px;">🎯 매일 다짐하면 뇌가 바뀐다</div>' +
        '<div style="font-size:0.82em;color:rgba(255,255,255,0.8);line-height:1.6;margin-bottom:12px;">록펠러·나폴레온 힐이 공통으로 했던 단 하나의 습관</div>' +
        '<button onclick="toggleVowScience()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:7px 14px;color:#fff;font-size:0.8em;cursor:pointer;" id="vow-science-btn">📖 뇌과학 근거 보기 ▼</button>' +
        '<div id="vow-science-body" style="display:none;margin-top:14px;font-size:0.82em;color:rgba(255,255,255,0.9);line-height:1.8;">' +
        '<b>🧠 망상활성계(RAS) 원리</b><br>뇌간 위쪽에 있는 망상활성계는 "내가 중요하다고 선언한 것"을 자동으로 탐지합니다. 매일 목표를 소리 내어 읽으면 RAS가 활성화되어, 일상 속에서 목표에 필요한 정보·기회·사람을 무의식이 자동으로 걸러 냅니다.<br><br>' +
        '<b>📚 구현 의도 연구 (Gollwitzer, 1999)</b><br>뉴욕대 심리학과 Peter Gollwitzer 교수 연구: "언제, 어디서, 무엇을"을 구체적으로 선언한 그룹이 그렇지 않은 그룹보다 목표 달성률이 2~3배 높았습니다.<br><br>' +
        '<b>🎙 생성 효과 (MacLeod et al., 2010)</b><br>소리 내어 읽으면 눈으로만 읽을 때보다 기억 정착률이 약 10% 높습니다. 매일 두 번, 소리 내어 읽는 것이 핵심입니다.<br><br>' +
        '<b>🏆 유명인 사례</b><br>' +
        '• 존 D. 록펠러: 매일 아침 자신의 재정 목표를 소리 내어 읽었습니다<br>' +
        '• 짐 캐리: 무명 시절 "5년 뒤 내 출연료는 1,000만 달러"라고 쓴 수표를 지갑에 넣고 매일 읽었습니다<br>' +
        '• 무하마드 알리: 경기 전 "나는 세상에서 가장 위대하다"를 반복 선언했습니다<br>' +
        '• 오프라 윈프리: 매일 아침 감사 일기 + 목표 선언을 30년간 지속했습니다<br><br>' +
        '<a href="https://youtube.com/@SecondActRadio" target="_blank" style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:8px;padding:8px 14px;color:#fff;text-decoration:none;font-size:0.85em;">🎬 영상으로 보기 →</a>' +
        '</div></div>' +

        // 세팅 카드
        '<div style="background:#fff;border-radius:16px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,0.07);">' +
        '<div style="font-size:1em;font-weight:900;color:#1B4332;margin-bottom:18px;">✍️ 나의 다짐 만들기</div>' +

        // 닉네임
        '<div style="margin-bottom:14px;">' +
        '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">이름 또는 닉네임</div>' +
        '<input id="vow-name" type="text" placeholder="예: 드림" maxlength="10" style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.92em;box-sizing:border-box;">' +
        '</div>' +

        // 목표 금액
        '<div style="margin-bottom:14px;">' +
        '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">목표 금액</div>' +
        '<input id="vow-amount" type="text" placeholder="예: 1억원" maxlength="20" style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.92em;box-sizing:border-box;">' +
        '</div>' +

        // 목표 날짜
        '<div style="margin-bottom:14px;">' +
        '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">목표 날짜</div>' +
        '<input id="vow-target-date" type="date" style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.92em;box-sizing:border-box;">' +
        '</div>' +

        // 내가 줄 가치
        '<div style="margin-bottom:14px;">' +
        '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">그 대가로 내가 줄 것 (어떤 가치로?)</div>' +
        '<textarea id="vow-value" placeholder="예: 유튜브, 앱, 책, 강의를 통해 40대 분들에게 인생2막을 여는 방법을 전합니다" rows="3" maxlength="100" style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.88em;box-sizing:border-box;resize:none;"></textarea>' +
        '</div>' +

        // 시작일
        '<div style="margin-bottom:14px;">' +
        '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:6px;">시작일</div>' +
        '<input id="vow-start-date" type="date" style="width:100%;padding:11px 14px;border:1.5px solid #ddd;border-radius:10px;font-size:0.92em;box-sizing:border-box;">' +
        '</div>' +

        // 수행 횟수
        '<div style="margin-bottom:20px;">' +
        '<div style="font-size:0.78em;font-weight:700;color:#555;margin-bottom:8px;">하루 수행 횟수</div>' +
        '<div style="display:flex;gap:10px;">' +
        '<button onclick="selectVowCount(1)" id="vow-count-1" style="flex:1;padding:12px;border:2px solid #ddd;border-radius:10px;background:#fff;font-size:0.88em;cursor:pointer;">☀️ 하루 1회</button>' +
        '<button onclick="selectVowCount(2)" id="vow-count-2" style="flex:1;padding:12px;border:2px solid #ddd;border-radius:10px;background:#fff;font-size:0.88em;cursor:pointer;">☀️🌙 하루 2회</button>' +
        '</div></div>' +

        '<button onclick="generateVowSentences()" style="width:100%;padding:14px;background:linear-gradient(135deg,#1B4332,#2D6A4F);border:none;border-radius:12px;color:#fff;font-size:0.95em;font-weight:700;cursor:pointer;">✨ 나의 다짐 문장 만들기</button>' +
        '</div>' +

        // 선택 영역 (숨김)
        '<div id="vow-sentence-wrap" style="display:none;margin-top:20px;background:#fff;border-radius:16px;padding:22px;box-shadow:0 2px 12px rgba(0,0,0,0.07);">' +
        '<div style="font-size:0.95em;font-weight:900;color:#1B4332;margin-bottom:14px;">📝 다짐 문장을 선택해주세요</div>' +
        '<div id="vow-sentence-list"></div>' +
        '<div id="vow-edit-wrap" style="display:none;margin-top:12px;">' +
        '<div style="font-size:0.78em;color:#888;margin-bottom:6px;">직접 수정 (확정 전에만 가능)</div>' +
        '<textarea id="vow-custom-text" rows="4" style="width:100%;padding:11px 14px;border:1.5px solid #C9A84C;border-radius:10px;font-size:0.88em;box-sizing:border-box;resize:none;"></textarea>' +
        '</div>' +
        '<button onclick="confirmVow()" id="vow-confirm-btn" style="display:none;width:100%;padding:14px;background:linear-gradient(135deg,#C9A84C,#D4A843);border:none;border-radius:12px;color:#fff;font-size:0.95em;font-weight:700;cursor:pointer;margin-top:14px;">🎯 이 문장으로 다짐 시작하기</button>' +
        '</div>' +

        '<div style="margin-top:20px;height:1px;background:#eee;"></div>' +
        '<div style="margin-top:20px;padding:18px;background:#F9F9F9;border-radius:14px;border:1px solid #eee;">' +
        '<div style="font-size:0.88em;font-weight:800;color:#1B4332;margin-bottom:6px;">💌 사연 보내기</div>' +
        '<div style="font-size:0.8em;color:#888;line-height:1.7;margin-bottom:12px;">확언으로 변화된 삶, 힘든 마음, 이루어가는 이야기를 나눠주세요.<br>많은 분들께 위로와 용기가 됩니다 🌿</div>' +
        '<button onclick="openStoryModal && openStoryModal()" style="width:100%;padding:13px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">💌 사연 보내기</button>' +
        '</div>' +

        '</div>';

    // 오늘 날짜 기본값
    var today = new Date();
    var yy = today.getFullYear();
    var mm = String(today.getMonth()+1).padStart(2,'0');
    var dd = String(today.getDate()).padStart(2,'0');
    var todayStr = yy+'-'+mm+'-'+dd;
    var el = document.getElementById('vow-start-date');
    if(el) el.value = todayStr;

    _vowDraft.count = 1;
    selectVowCount(1);
}

window.toggleVowScience = function() {
    var body = document.getElementById('vow-science-body');
    var btn = document.getElementById('vow-science-btn');
    if (!body) return;
    if (body.style.display === 'none') {
        body.style.display = 'block';
        if(btn) btn.textContent = '📖 뇌과학 근거 접기 ▲';
    } else {
        body.style.display = 'none';
        if(btn) btn.textContent = '📖 뇌과학 근거 보기 ▼';
    }
};

window.selectVowCount = function(n) {
    _vowDraft.count = n;
    var b1 = document.getElementById('vow-count-1');
    var b2 = document.getElementById('vow-count-2');
    if(b1) b1.style.border = n===1 ? '2px solid #1B4332' : '2px solid #ddd';
    if(b1) b1.style.background = n===1 ? '#E8F5E9' : '#fff';
    if(b2) b2.style.border = n===2 ? '2px solid #1B4332' : '2px solid #ddd';
    if(b2) b2.style.background = n===2 ? '#E8F5E9' : '#fff';
};

window.generateVowSentences = function() {
    var name = (document.getElementById('vow-name')||{}).value.trim();
    var amount = (document.getElementById('vow-amount')||{}).value.trim();
    var targetDate = (document.getElementById('vow-target-date')||{}).value;
    var value = (document.getElementById('vow-value')||{}).value.trim();
    var startDate = (document.getElementById('vow-start-date')||{}).value;

    if(!name||!amount||!targetDate||!value||!startDate) {
        showToast('모든 항목을 입력해주세요!'); return;
    }

    _vowDraft = { name, amount, targetDate, value, startDate, count: _vowDraft.count||1 };

    // 날짜 표시용
    var d = new Date(targetDate);
    var dateStr = d.getFullYear()+'년 '+(d.getMonth()+1)+'월 '+d.getDate()+'일';

    var sentences = [
        // A: 정체성 선언형
        dateStr+', 나 '+name+'은(는) '+amount+'을(를) 이뤄낸 사람이다.\n나는 '+value+'.',
        // B: 직설적 단언형
        '나 '+name+'은(는) '+dateStr+'까지 '+amount+'을(를) 손에 쥔다.\n그 대가로, '+value+'.',
        // C: 짧고 강한형
        dateStr+'. 나 '+name+', '+amount+'을(를) 가진다.\n'+value+'.'
    ];

    _vowDraft.sentences = sentences;

    var wrap = document.getElementById('vow-sentence-wrap');
    var list = document.getElementById('vow-sentence-list');
    if(!wrap||!list) return;

    list.innerHTML = '';
    sentences.forEach(function(s, i) {
        var label = ['A. 정체성 선언형','B. 직설적 단언형','C. 짧고 강한형'][i];
        list.innerHTML +=
            '<div onclick="selectVowSentence('+i+')" id="vow-s-'+i+'" style="border:2px solid #ddd;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;">' +
            '<div style="font-size:0.72em;font-weight:700;color:#888;margin-bottom:6px;">'+label+'</div>' +
            '<div style="font-size:0.88em;line-height:1.8;color:#333;white-space:pre-line;">'+s+'</div>' +
            '</div>';
    });

    wrap.style.display = 'block';
    wrap.scrollIntoView({behavior:'smooth'});
};

window.selectVowSentence = function(i) {
    _vowDraft.selectedIdx = i;
    _vowDraft.sentences.forEach(function(_, j) {
        var el = document.getElementById('vow-s-'+j);
        if(el) { el.style.border = j===i ? '2px solid #1B4332' : '2px solid #ddd'; el.style.background = j===i ? '#E8F5E9' : '#fff'; }
    });
    var editWrap = document.getElementById('vow-edit-wrap');
    var ta = document.getElementById('vow-custom-text');
    var confirmBtn = document.getElementById('vow-confirm-btn');
    if(editWrap) editWrap.style.display = 'block';
    if(ta) ta.value = _vowDraft.sentences[i];
    if(confirmBtn) confirmBtn.style.display = 'block';
};

window.confirmVow = function() {
    var ta = document.getElementById('vow-custom-text');
    var finalText = ta ? ta.value.trim() : _vowDraft.sentences[_vowDraft.selectedIdx];
    if(!finalText) { showToast('문장을 선택해주세요!'); return; }

    var vow = {
        confirmed: true,
        name: _vowDraft.name,
        amount: _vowDraft.amount,
        targetDate: _vowDraft.targetDate,
        startDate: _vowDraft.startDate,
        value: _vowDraft.value,
        count: _vowDraft.count,
        text: finalText,
        checks: {}
    };
    safeSetJSON('vow_data', vow);
    showToast('🎯 다짐이 시작됐어요!');
    var wrap = document.getElementById('vow-main-wrap');
    if(wrap) renderVowMain(wrap, vow);
};

// ── STEP 3: 메인 다짐 화면 ──
function renderVowMain(wrap, vow) {
    // ★ 즉시 마이그레이션 (숫자→객체)
    if(vow.checks) {
        var needSave = false;
        Object.keys(vow.checks).forEach(function(k) {
            if(typeof vow.checks[k] === 'number') {
                vow.checks[k] = {morning: vow.checks[k] >= 1, evening: false};
                needSave = true;
            }
        });
        if(needSave) safeSetJSON('vow_data', vow);
    }

    var today = getFormatDate(new Date());
    var checks = vow.checks || {};
    var maxCount = vow.count || 1;

    // D-Day 계산
    var now = new Date(); now.setHours(0,0,0,0);
    var target = new Date(vow.targetDate); target.setHours(0,0,0,0);
    var start = new Date(vow.startDate); start.setHours(0,0,0,0);
    var dday = Math.ceil((target - now) / 86400000);
    var ddayText = dday > 0 ? 'D-' + dday : dday === 0 ? 'D-DAY' : 'D+' + Math.abs(dday);

    // 총 일수 & 진행일
    var totalDays = Math.ceil((target - start) / 86400000);
    var elapsedDays = Math.ceil((now - start) / 86400000);
    if(elapsedDays < 0) elapsedDays = 0;

    // 수행 체크 표시
    // 시간대 기반 체크 데이터 파싱
    var todayData = checks[today] || {morning:false, evening:false};
    if(typeof todayData === 'number') {
        // 구버전 숫자 → 새 형식으로 마이그레이션
        // evening은 시간대를 알 수 없으므로 false로 처리
        todayData = {morning: todayData >= 1, evening: false};
    }
    var morningDone = todayData.morning || false;
    var eveningDone = todayData.evening || false;

    // ── 수행 카드 디자인 ──
    function makeCheckCard(done, emoji, label, doneBg, doneBorder) {
        if(done) {
            return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;background:'+doneBg+';border:2px solid '+doneBorder+';border-radius:12px;padding:10px 18px;">' +
                '<span style="font-size:1.4em;">'+emoji+'</span>' +
                '<span style="font-size:0.95em;">✅</span>' +
                '<span style="font-size:0.68em;font-weight:800;color:'+doneBorder+';">'+label+' 완료</span>' +
                '</div>';
        } else {
            return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;background:#F5F5F5;border:2px dashed #ddd;border-radius:12px;padding:10px 18px;">' +
                '<span style="font-size:1.4em;filter:grayscale(0.6);opacity:0.5;">'+emoji+'</span>' +
                '<span style="font-size:0.95em;color:#ddd;">○</span>' +
                '<span style="font-size:0.68em;font-weight:700;color:#bbb;">'+label+'</span>' +
                '</div>';
        }
    }

    var checkHTML = '';
    if(maxCount === 1) {
        checkHTML = '<div style="display:flex;justify-content:center;">' +
            makeCheckCard(morningDone, '☀️', '오늘', '#F0FAF4', '#1B4332') +
            '</div>';
    } else {
        checkHTML =
            '<div style="display:flex;gap:14px;justify-content:center;">' +
            makeCheckCard(morningDone, '☀️', '아침', '#FFFBEA', '#F59E0B') +
            makeCheckCard(eveningDone, '🌙', '저녁', '#F0FAF4', '#1B4332') +
            '</div>';
    }

    // 달력 (시작일 ~ 오늘)
    var calHTML = renderVowCalendar(vow);

    wrap.innerHTML =
        '<div style="padding:0 0 80px;">' +

        // ── 항상 보이는 두 가지 약속 ──
        '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:16px;padding:18px 20px;margin-bottom:14px;">' +
        '<div style="font-size:0.78em;font-weight:800;color:#A8D5BA;letter-spacing:1px;margin-bottom:10px;">📌 매일 두 가지 약속</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">' +
        '<div style="display:flex;gap:12px;align-items:flex-start;">' +
        '<div style="min-width:24px;height:24px;background:#C9A84C;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72em;font-weight:900;color:#fff;flex-shrink:0;margin-top:1px;">1</div>' +
        '<div style="font-size:0.88em;color:#fff;line-height:1.7;font-weight:600;">눈뜨자마자 한 번, 잠들기 직전 한 번<br><span style="color:#A8D5BA;font-weight:400;">반드시 소리내어 읽는다</span></div>' +
        '</div>' +
        '<div style="display:flex;gap:12px;align-items:flex-start;">' +
        '<div style="min-width:24px;height:24px;background:#C9A84C;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72em;font-weight:900;color:#fff;flex-shrink:0;margin-top:1px;">2</div>' +
        '<div style="font-size:0.88em;color:#fff;line-height:1.7;font-weight:600;">읽을 때 그 장면이 이루어진 모습을<br><span style="color:#A8D5BA;font-weight:400;">머릿속에 또렷이 그린다</span></div>' +
        '</div>' +
        '</div></div>' +

        // ── 펼쳐보기: 이유 + 성공 사례 ──
        '<div style="background:#fff;border-radius:16px;border:1px solid #E8E5E0;margin-bottom:14px;overflow:hidden;">' +
        '<div onclick="toggleVowWhy()" style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px;cursor:pointer;">' +
        '<div style="font-size:0.88em;font-weight:800;color:#1B4332;">🧠 왜 이걸 매일 해야 할까?</div>' +
        '<div id="vow-why-arrow" style="font-size:1em;color:#888;transition:transform 0.3s;">▼</div>' +
        '</div>' +
        '<div id="vow-why-body" style="display:none;padding:0 18px 18px;">' +

        // 뇌과학
        '<div style="background:#F0FAF4;border-radius:12px;padding:14px;margin-bottom:12px;">' +
        '<div style="font-size:0.8em;font-weight:800;color:#1B4332;margin-bottom:8px;">🔬 뇌과학이 말하는 이유</div>' +
        '<div style="font-size:0.82em;color:#444;line-height:1.8;margin-bottom:8px;"><b>① 망상활성계(RAS)</b><br>뇌에는 수백만 개의 정보 중 중요한 것만 걸러내는 필터가 있어요. 목표를 매일 선언하면 뇌가 그것을 중요한 것으로 등록하고, 하루 종일 관련 기회·정보·사람을 자동으로 포착합니다.</div>' +
        '<div style="font-size:0.82em;color:#444;line-height:1.8;margin-bottom:8px;"><b>② 구현 의도 효과 (Gollwitzer, 1999)</b><br>목표를 구체적으로 선언한 그룹이 그렇지 않은 그룹보다 달성률이 2~3배 높았습니다.</div>' +
        '<div style="font-size:0.82em;color:#444;line-height:1.8;"><b>③ 소리내어 읽기 (생성 효과)</b><br>눈으로만 읽는 것보다 소리내어 읽으면 기억 정착률이 훨씬 높아집니다. 입으로 말하고 귀로 듣는 이중 자극이 무의식에 더 깊이 새겨져요.</div>' +
        '</div>' +

        // 성공 사례
        '<div style="background:#FFFDF5;border-radius:12px;padding:14px;border:1px solid #C9A84C22;">' +
        '<div style="font-size:0.8em;font-weight:800;color:#C9A84C;margin-bottom:10px;">👑 매일 했더니 달라진 사람들</div>' +
        '<div style="font-size:0.82em;color:#444;line-height:1.8;margin-bottom:8px;"><b>존 D. 록펠러</b><br>매일 아침 재정 목표를 소리내어 읽었습니다. 500명의 백만장자를 연구한 나폴레온 힐은 이것이 그들의 공통된 단 하나의 습관이었다고 밝혔어요.</div>' +
        '<div style="font-size:0.82em;color:#444;line-height:1.8;margin-bottom:8px;"><b>짐 캐리</b><br>무명 시절 자신에게 1,000만 달러짜리 수표를 써서 매일 지갑에 넣고 읽었습니다. 5년 후 정확히 그 금액을 받았어요.</div>' +
        '<div style="font-size:0.82em;color:#444;line-height:1.8;margin-bottom:8px;"><b>무하마드 알리</b><br>경기 전 나는 세상에서 가장 위대하다를 반복 선언했습니다. 그는 이것이 실제 경기력에 영향을 준다고 믿었어요.</div>' +
        '<div style="font-size:0.82em;color:#444;line-height:1.8;"><b>오프라 윈프리</b><br>매일 아침 목표 선언을 30년간 지속했습니다. 그녀는 이것이 자신의 삶을 바꾼 가장 중요한 습관이라고 했어요.</div>' +
        '</div></div></div>' +

        // D-Day 카드
        '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:20px;padding:28px 20px;text-align:center;margin-bottom:16px;">' +
        '<div style="font-size:3.5em;font-weight:900;color:#C9A84C;letter-spacing:-1px;">'+ddayText+'</div>' +
        '<div style="font-size:0.82em;color:rgba(255,255,255,0.7);margin-top:4px;">'+vow.targetDate+' 까지 · 총 '+totalDays+'일 중 '+elapsedDays+'일째</div>' +
        '</div>' +

        // 선언문 카드
        '<div style="background:#FFFDF5;border:1.5px solid #C9A84C33;border-radius:16px;padding:20px;margin-bottom:16px;">' +
        '<div style="font-size:0.75em;font-weight:700;color:#C9A84C;margin-bottom:10px;">🎯 나의 다짐</div>' +
        '<div style="font-size:0.95em;line-height:1.9;color:#333;white-space:pre-line;font-weight:600;">'+vow.text+'</div>' +
        '</div>' +

        // 버튼 먼저 (선언문 바로 아래)
        '<div style="background:#fff;border-radius:16px;padding:18px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">' +
        '<button id="vow-tts-btn" onclick="vowTTS()" style="width:100%;padding:14px;background:#E8F5E9;border:1.5px solid #1B4332;border-radius:12px;color:#1B4332;font-size:0.95em;font-weight:800;cursor:pointer;margin-bottom:10px;">🔊 따라해보세요</button>' +
        '<button onclick="startVowSTT()" id="vow-stt-btn" style="width:100%;padding:14px;background:#fff;border:1.5px solid #C9A84C;border-radius:12px;color:#C9A84C;font-size:0.95em;font-weight:800;cursor:pointer;">🎙 소리내어 읽기</button>' +
        '<div id="vow-stt-status" style="font-size:0.78em;color:#aaa;text-align:center;margin-top:6px;min-height:18px;"></div>' +
        '</div>' +

        // 오늘 수행 (작게)
        '<div style="background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.05);">' +
        '<div style="font-size:0.75em;font-weight:700;color:#888;margin-bottom:10px;">오늘 수행 현황</div>' +
        '<div style="margin-bottom:8px;">'+checkHTML+'</div>' +
        '<div style="text-align:right;">' +
        '<button onclick="resetTodayVow()" style="background:none;border:none;font-size:0.68em;color:#ccc;cursor:pointer;text-decoration:underline;">오늘 기록 초기화</button>' +
        '</div>' +
        '</div>' +

        // 카카오 알림 유도
        '<div style="background:linear-gradient(135deg,#FEE500,#FDD835);border-radius:14px;padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">' +
        '<div style="font-size:1.8em;">💛</div>' +
        '<div>' +
        '<div style="font-size:0.85em;font-weight:900;color:#3C1E1E;margin-bottom:2px;">매일 아침·저녁 다짐 알림 받기</div>' +
        '<div style="font-size:0.75em;color:#5C3E1E;line-height:1.5;">카카오톡 오픈채팅에 참여하시면<br>매일 다짐 시간에 알림을 보내드려요 🌿</div>' +
        '<a href="https://open.kakao.com/o/gr3RC2pi" target="_blank" style="display:inline-block;margin-top:8px;background:#3C1E1E;color:#FEE500;padding:7px 16px;border-radius:20px;font-size:0.78em;font-weight:700;text-decoration:none;">오픈채팅 참여하기 →</a>' +
        '</div></div>' +

        // 달력
        '<div style="background:#fff;border-radius:16px;padding:18px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<div style="font-size:0.85em;font-weight:900;color:#1B4332;">📅 수행 기록</div>' +
        '<div style="font-size:0.78em;color:#888;">시작일부터 오늘까지</div>' +
        '</div>' +
        calHTML +
        '</div>' +

        // 새로 시작하기
        '<div style="text-align:center;padding-top:8px;">' +
        '<button onclick="resetVow()" style="background:none;border:none;color:#bbb;font-size:0.78em;cursor:pointer;text-decoration:underline;">새로운 다짐으로 다시 시작하기</button>' +
        '</div>' +

        // 사연 보내기 (하단)
        '<div style="margin-top:24px;background:#F9F9F9;border-radius:14px;padding:16px 18px;border:1px solid #eee;">' +
        '<div style="font-size:0.82em;color:#888;margin-bottom:8px;">다짐을 이루는 과정의 이야기를 들려주세요</div>' +
        '<button onclick="openStoryModal && openStoryModal()" style="background:#1B4332;border:none;border-radius:10px;padding:10px 20px;color:#fff;font-size:0.85em;font-weight:700;cursor:pointer;">💌 인생2막라디오에 사연 보내기</button>' +
        '</div>' +

        '</div>';
}

// ── 달력 렌더링 ──
function renderVowCalendar(vow) {
    var checks = vow.checks || {};
    var start = new Date(vow.startDate); start.setHours(0,0,0,0);
    var today = new Date(); today.setHours(0,0,0,0);
    var maxCount = vow.count || 1;

    var days = [];
    var cur = new Date(start);
    while(cur <= today) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate()+1);
    }
    if(days.length === 0) return '<div style="color:#aaa;font-size:0.82em;text-align:center;padding:12px;">아직 기록이 없어요</div>';

    // 요일 헤더
    var html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;">';
    ['일','월','화','수','목','금','토'].forEach(function(d) {
        html += '<div style="font-size:0.68em;color:#aaa;padding-bottom:4px;">'+d+'</div>';
    });

    // 첫날 요일 맞추기
    var firstDow = days[0].getDay();
    for(var i=0; i<firstDow; i++) {
        html += '<div></div>';
    }

    days.forEach(function(d) {
        var key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        var raw = checks[key] || 0;
        var isToday = key === getFormatDate(new Date());

        // 새 구조({morning,evening}) / 구 구조(숫자) 모두 지원
        var doneCount = 0;
        if(typeof raw === 'object' && raw !== null) {
            if(raw.morning) doneCount++;
            if(raw.evening) doneCount++;
        } else {
            doneCount = raw;
        }

        var full = doneCount >= maxCount;
        var half = doneCount > 0 && !full;
        var bg = full ? '#1B4332' : half ? '#A8D5B5' : '#f5f5f5';
        var color = full ? '#fff' : half ? '#1B4332' : '#ccc';
        var border = isToday ? '2px solid #C9A84C' : '2px solid transparent';
        html += '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;background:'+bg+';color:'+color+';font-size:0.72em;font-weight:700;border:'+border+';">'+d.getDate()+'</div>';
    });

    html += '</div>';
    return html;
}

// ── TTS (따라해보세요) ──
var _vowTTSPlaying = false;
window.vowTTS = function() {
    var vow = safeGetJSON('vow_data', null);
    if(!vow) return;
    if(!window.speechSynthesis) { showToast('음성 기능을 지원하지 않아요'); return; }

    // 재생 중이면 정지
    if(_vowTTSPlaying) {
        window.speechSynthesis.cancel();
        _vowTTSPlaying = false;
        var btn = document.getElementById('vow-tts-btn');
        if(btn) btn.textContent = '🔊 따라해보세요';
        return;
    }

    // 재생 시작
    window.speechSynthesis.cancel();
    var utt = new SpeechSynthesisUtterance(vow.text);
    utt.lang = 'ko-KR';
    utt.rate = 0.85;
    utt.onstart = function() {
        _vowTTSPlaying = true;
        var btn = document.getElementById('vow-tts-btn');
        if(btn) btn.textContent = '⏹ 정지하기';
    };
    utt.onend = function() {
        _vowTTSPlaying = false;
        var btn = document.getElementById('vow-tts-btn');
        if(btn) btn.textContent = '🔊 따라해보세요';
        vowMarkCheck();
    };
    utt.onerror = function() {
        _vowTTSPlaying = false;
        var btn = document.getElementById('vow-tts-btn');
        if(btn) btn.textContent = '🔊 따라해보세요';
    };
    window.speechSynthesis.speak(utt);
    showToast('🔊 함께 소리내어 읽어보세요!');
};

// ── STT (소리내어 읽기) ──
var _vowRecognition = null;
window.startVowSTT = function() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) { showToast('이 브라우저는 음성 인식을 지원하지 않아요'); return; }
    var btn = document.getElementById('vow-stt-btn');
    var status = document.getElementById('vow-stt-status');
    if(_vowRecognition) { _vowRecognition.stop(); _vowRecognition = null; if(btn) btn.textContent='🎙 소리내어 읽기'; if(status) status.textContent=''; return; }
    _vowRecognition = new SpeechRecognition();
    _vowRecognition.lang = 'ko-KR';
    _vowRecognition.continuous = false;
    _vowRecognition.interimResults = true;
    _vowRecognition.onstart = function() { if(btn) btn.textContent='⏹ 읽기 중지'; if(status) status.textContent='🎙 듣고 있어요...'; };
    _vowRecognition.onresult = function(e) { var t=''; for(var i=e.resultIndex;i<e.results.length;i++) t+=e.results[i][0].transcript; if(status) status.textContent=t; };
    _vowRecognition.onend = function() { _vowRecognition=null; if(btn) btn.textContent='🎙 소리내어 읽기'; if(status) status.textContent='✅ 완료! 수행 체크됐어요'; vowMarkCheck(); setTimeout(function(){if(status)status.textContent='';},2000); };
    _vowRecognition.onerror = function() { _vowRecognition=null; if(btn) btn.textContent='🎙 소리내어 읽기'; };
    _vowRecognition.start();
};

// ── 수행 체크 (시간대 기반: 오전5시~오후4시=아침, 오후4시~자정=저녁) ──
function getVowSlot() {
    var h = new Date().getHours();
    // 아침: 5~15시 / 저녁: 16~23시 및 0~4시
    if(h >= 5 && h < 16) return 'morning';
    return 'evening';
}

function vowMarkCheck() {
    var vow = safeGetJSON('vow_data', null);
    if(!vow) return;
    var today = getFormatDate(new Date());
    vow.checks = vow.checks || {};
    var todayData = vow.checks[today] || {morning:false, evening:false};
    if(typeof todayData === 'number') {
        // 구버전 숫자 → 새 형식으로 마이그레이션
        // evening은 시간대를 알 수 없으므로 false로 처리
        todayData = {morning: todayData >= 1, evening: false};
    }
    var slot = getVowSlot();
    var maxCount = vow.count || 1;

    // 1회 설정: 슬롯 무관하게 morning만 사용
    if(maxCount === 1) {
        todayData.morning = true;
    } else {
        // 2회 설정: 시간대 기반 체크
        todayData[slot] = true;
    }

    vow.checks[today] = todayData;
    safeSetJSON('vow_data', vow);
    updateVowBadge();
    var wrap = document.getElementById('vow-main-wrap');
    if(wrap) renderVowMain(wrap, vow);

    // 완료 토스트
    if(maxCount === 1 && todayData.morning) {
        showToast('오늘 다짐 완료! 🎉 내일도 함께해요');
    } else if(maxCount === 2) {
        if(slot === 'morning') showToast('아침 다짐 완료! ☀️ 저녁에 한 번 더!');
        else showToast('저녁 다짐 완료! 🌙 오늘 하루 수고했어요!');
    }
}


window.toggleVowWhy = function() {
    var body = document.getElementById('vow-why-body');
    var arrow = document.getElementById('vow-why-arrow');
    if(!body) return;
    if(body.style.display === 'none') {
        body.style.display = 'block';
        if(arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
        body.style.display = 'none';
        if(arrow) arrow.style.transform = 'rotate(0deg)';
    }
};
// ── 리셋 ──
window.resetVow = function() {
    if(!confirm('다짐을 초기화하고 새로 시작할까요?')) return;
    safeSetItem('vow_data', null);
    var wrap = document.getElementById('vow-main-wrap');
    if(wrap) renderVowView();
};

// ── 오늘 수행 기록만 리셋 (잘못된 데이터 수정용) ──
window.resetTodayVow = function() {
    var vow = safeGetJSON('vow_data', null);
    if(!vow) return;
    var today = getFormatDate(new Date());
    vow.checks = vow.checks || {};
    vow.checks[today] = {morning: false, evening: false};
    safeSetJSON('vow_data', vow);
    showToast('오늘 수행 기록이 초기화됐어요');
    var wrap = document.getElementById('vow-main-wrap');
    if(wrap) renderVowMain(wrap, vow);
};

// ── 전체 checks 데이터 마이그레이션 (숫자→객체) ──
window.migrateVowChecks = function() {
    var vow = safeGetJSON('vow_data', null);
    if(!vow || !vow.checks) return;
    var changed = false;
    Object.keys(vow.checks).forEach(function(key) {
        var v = vow.checks[key];
        if(typeof v === 'number') {
            vow.checks[key] = {morning: v >= 1, evening: false};
            changed = true;
        }
    });
    if(changed) {
        safeSetJSON('vow_data', vow);
        showToast('✅ 데이터 마이그레이션 완료');
        var wrap = document.getElementById('vow-main-wrap');
        if(wrap) renderVowMain(wrap, vow);
    }
};

// ── 배지 업데이트 ──
function updateVowBadge() {
    var badge = document.getElementById('vow-badge');
    if(!badge) return;
    var vow = safeGetJSON('vow_data', null);
    if(!vow || !vow.confirmed) { badge.style.display='none'; return; }
    var today = getFormatDate(new Date());
    var todayRaw = (vow.checks||{})[today] || {morning:false, evening:false};
    if(typeof todayRaw === 'number') todayRaw = {morning: todayRaw>=1, evening: false};
    var maxC = vow.count || 1;
    var done = maxC === 1 ? todayRaw.morning : (todayRaw.morning && todayRaw.evening);
    badge.style.display = done ? 'none' : 'block';
}

// ── 사연 보내기 모달 ──
window.showStorySendModal = function() {
    showToast('사연 보내기 준비 중이에요 💌');
};

// 앱 초기화 시 배지 업데이트 (nav 초기화 후)
// 배지는 탭 진입 시 initVowNavAndView 후 updateVowBadge 호출로 처리

    // ════════════════════════════════════════
    // 🎯 다짐 기능 (Daejim)
    // ════════════════════════════════════════

    var _daejimCount = 1; // 1회 or 2회

    // 도입 섹션 접기/펼치기
    window.toggleDaejimIntro = function() {
        var el = document.getElementById('daejim-intro-content');
        var arrow = document.getElementById('daejim-intro-arrow');
        if (!el) return;
        if (el.style.display === 'none') {
            el.style.display = 'block';
            arrow.style.transform = 'rotate(180deg)';
        } else {
            el.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
        }
    };

    // 수행 횟수 선택
    window.selectDaejimCount = function(n) {
        _daejimCount = n;
        var b1 = document.getElementById('daejim-count-1');
        var b2 = document.getElementById('daejim-count-2');
        if (n === 1) {
            b1.style.background = '#1B4332'; b1.style.color = '#fff'; b1.style.borderColor = '#1B4332';
            b2.style.background = 'transparent'; b2.style.color = 'var(--text-color)'; b2.style.borderColor = 'var(--border-color)';
        } else {
            b2.style.background = '#1B4332'; b2.style.color = '#fff'; b2.style.borderColor = '#1B4332';
            b1.style.background = 'transparent'; b1.style.color = 'var(--text-color)'; b1.style.borderColor = 'var(--border-color)';
        }
        safeSetItem('daejim_count', n);
    };

    // STEP 이동
    window.showDaejimStep = function(n) {
        [1,2,3].forEach(function(i) {
            var el = document.getElementById('daejim-step' + i);
            if (el) el.style.display = (i === n) ? 'block' : 'none';
            var ind = document.getElementById('dstep-' + i);
            if (ind) ind.style.background = (i <= n) ? '#1B4332' : '#E8E5E0';
        });
        if (n === 3) renderDaejimMain();
    };

    // 문장 생성
    window.generateDaejimSentences = function() {
        var amount  = (document.getElementById('daejim-amount')      || {}).value || '';
        var date    = (document.getElementById('daejim-target-date') || {}).value || '';
        var value   = (document.getElementById('daejim-value')       || {}).value || '';
        var nick    = (document.getElementById('daejim-nickname')     || {}).value || '나';
        var start   = (document.getElementById('daejim-start-date')  || {}).value || '';

        if (!amount || !date || !value || !nick) {
            showToast('모든 항목을 입력해주세요 🙏'); return;
        }

        // 저장
        safeSetItem('daejim_amount', amount);
        safeSetItem('daejim_target_date', date);
        safeSetItem('daejim_value', value);
        safeSetItem('daejim_nickname', nick);
        safeSetItem('daejim_start_date', start || getFormatDate(new Date()));
        safeSetItem('daejim_count', _daejimCount);

        // 날짜 포맷
        var d = new Date(date);
        var ymd = (d.getFullYear()) + '년 ' + (d.getMonth()+1) + '월 ' + d.getDate() + '일';

        // 3가지 문장 템플릿
        var sentences = [
            ymd + ', 나 ' + nick + '은 ' + amount + '을 이뤄낸 사람이다. 나는 ' + value + '을 통해 많은 분들께 진심 어린 가치를 전하는 작가이자 크리에이터다.',
            ymd + '까지 나 ' + nick + '은 ' + amount + '을 손에 쥔다. 그 대가로 나는 ' + value + '로 세상에 가치를 펼쳐 보인다.',
            nick + '. ' + amount + '. ' + ymd + '. ' + value + '로 많은 이들의 삶을 바꾼다. 나는 이미 그 길 위에 있다.'
        ];

        var labels = ['✨ 정체성 선언형', '💪 직설적 단언형', '⚡ 짧고 강한형'];
        var html = '';
        sentences.forEach(function(s, i) {
            html += '<div onclick="selectDaejimSentence(' + i + ')" id="ds-card-' + i + '" ' +
                'style="border:2px solid ' + (i===0?'#1B4332':'var(--border-color)') + ';border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer;background:' + (i===0?'#f0faf4':'var(--bg-color)') + ';">' +
                '<div style="font-size:0.75em;font-weight:700;color:#1B4332;margin-bottom:6px;">' + labels[i] + '</div>' +
                '<div style="font-size:0.85em;line-height:1.8;color:var(--text-color);white-space:pre-line;">' + s + '</div>' +
                '</div>';
        });
        document.getElementById('daejim-sentences').innerHTML = html;
        document.getElementById('daejim-custom-text').value = sentences[0];
        showDaejimStep(2);
    };

    window.selectDaejimSentence = function(i) {
        var cards = [0,1,2];
        cards.forEach(function(j) {
            var c = document.getElementById('ds-card-' + j);
            if (!c) return;
            c.style.borderColor = (i===j) ? '#1B4332' : 'var(--border-color)';
            c.style.background  = (i===j) ? '#f0faf4' : 'var(--bg-color)';
        });
        // 해당 문장을 textarea에 복사
        var amount  = safeGetItem('daejim_amount','');
        var date    = safeGetItem('daejim_target_date','');
        var value   = safeGetItem('daejim_value','');
        var nick    = safeGetItem('daejim_nickname','나');
        var d = new Date(date);
        var ymd = d.getFullYear() + '년 ' + (d.getMonth()+1) + '월 ' + d.getDate() + '일';
        var sentences = [
            ymd + ', 나 ' + nick + '은 ' + amount + '을 이뤄낸 사람이다. 나는 ' + value + '을 통해 많은 분들께 진심 어린 가치를 전하는 작가이자 크리에이터다.',
            ymd + '까지 나 ' + nick + '은 ' + amount + '을 손에 쥔다. 그 대가로 나는 ' + value + '로 세상에 가치를 펼쳐 보인다.',
            nick + '. ' + amount + '. ' + ymd + '. ' + value + '로 많은 이들의 삶을 바꾼다. 나는 이미 그 길 위에 있다.'
        ];
        document.getElementById('daejim-custom-text').value = sentences[i];
    };

    window.confirmDaejimSentence = function() {
        var text = (document.getElementById('daejim-custom-text') || {}).value || '';
        if (!text.trim()) { showToast('선언문을 입력해주세요'); return; }
        safeSetItem('daejim_text', text);
        safeSetItem('daejim_confirmed', '1');
        showDaejimStep(3);
    };

    // 메인 화면 렌더링
    function renderDaejimMain() {
        var text       = safeGetItem('daejim_text','');
        var targetDate = safeGetItem('daejim_target_date','');
        var startDate  = safeGetItem('daejim_start_date', getFormatDate(new Date()));
        var count      = parseInt(safeGetItem('daejim_count','1'));
        var records    = safeGetJSON('daejim_records', {});

        // 선언문
        var mainText = document.getElementById('daejim-main-text');
        if (mainText) mainText.innerText = text;

        // D-Day
        var ddayEl = document.getElementById('daejim-dday');
        var labelEl = document.getElementById('daejim-target-label');
        if (ddayEl && targetDate) {
            var today = new Date(); today.setHours(0,0,0,0);
            var target = new Date(targetDate); target.setHours(0,0,0,0);
            var diff = Math.ceil((target - today) / (1000*60*60*24));
            if (diff > 0) {
                ddayEl.textContent = 'D-' + diff;
                ddayEl.style.color = '#fff';
            } else if (diff === 0) {
                ddayEl.textContent = 'D-Day';
                ddayEl.style.color = '#C9A84C';
            } else {
                ddayEl.textContent = 'D+' + Math.abs(diff);
                ddayEl.style.color = '#A8D5BA';
                checkDaejimGoal();
            }
            var td = new Date(targetDate);
            if (labelEl) labelEl.textContent = td.getFullYear() + '년 ' + (td.getMonth()+1) + '월 ' + td.getDate() + '일 목표';
        }

        // 체크 도트
        renderDaejimDots(count, records);

        // 스트릭/총일수/달성률
        renderDaejimStats(records, startDate, targetDate);

        // 달력
        renderDaejimCalendar(records, startDate);
    }

    function renderDaejimDots(count, records) {
        var today = getFormatDate(new Date());
        var rec = records[today] || 0;
        var el = document.getElementById('daejim-check-dots');
        if (!el) return;
        var html = '';
        for (var i = 1; i <= count; i++) {
            var done = rec >= i;
            html += '<div style="width:40px;height:40px;border-radius:50%;background:' +
                (done ? '#1B4332' : '#E8E5E0') + ';display:flex;align-items:center;justify-content:center;font-size:1.4em;">' +
                (done ? '✅' : '○') + '</div>';
        }
        el.innerHTML = html;
    }

    function renderDaejimStats(records, startDate, targetDate) {
        var start = new Date(startDate); start.setHours(0,0,0,0);
        var end   = new Date(targetDate); end.setHours(0,0,0,0);
        var today = new Date(); today.setHours(0,0,0,0);
        var totalDays = Math.ceil((end - start) / (1000*60*60*24));
        var passedDays = Math.ceil((today - start) / (1000*60*60*24));
        var pct = totalDays > 0 ? Math.min(100, Math.round(passedDays / totalDays * 100)) : 0;

        // 총 수행일
        var doneDays = Object.keys(records).filter(function(k) { return records[k] > 0; }).length;
        // 연속 스트릭
        var streak = 0;
        var cur = new Date(); cur.setHours(0,0,0,0);
        while (true) {
            var key = getFormatDate(cur);
            if (records[key] && records[key] > 0) { streak++; cur.setDate(cur.getDate()-1); }
            else break;
        }

        var el1 = document.getElementById('daejim-streak');
        var el2 = document.getElementById('daejim-total');
        var el3 = document.getElementById('daejim-progress-pct');
        if (el1) el1.textContent = streak;
        if (el2) el2.textContent = doneDays;
        if (el3) el3.textContent = pct + '%';
    }

    function renderDaejimCalendar(records, startDate) {
        var el = document.getElementById('daejim-calendar');
        if (!el) return;
        var today = new Date(); today.setHours(0,0,0,0);
        var start = new Date(startDate); start.setHours(0,0,0,0);
        // 이번 달 표시
        var y = today.getFullYear(), m = today.getMonth();
        var firstDay = new Date(y, m, 1);
        var lastDay  = new Date(y, m+1, 0);
        var html = '';
        // 요일 헤더
        ['일','월','화','수','목','금','토'].forEach(function(d) {
            html += '<div style="font-weight:700;color:#888;padding:2px 0;">' + d + '</div>';
        });
        // 빈칸
        for (var i = 0; i < firstDay.getDay(); i++) {
            html += '<div></div>';
        }
        // 날짜
        for (var d2 = 1; d2 <= lastDay.getDate(); d2++) {
            var dt = new Date(y, m, d2); dt.setHours(0,0,0,0);
            var key = getFormatDate(dt);
            var rec = records[key] || 0;
            var isToday = dt.getTime() === today.getTime();
            var isFuture = dt > today;
            var inRange = dt >= start;
            var bg = '#F5F5F5', color = '#ccc';
            if (inRange && !isFuture) {
                if (rec > 0) { bg = '#1B4332'; color = '#fff'; }
                else { bg = '#FFE0E0'; color = '#e57373'; }
            }
            if (isToday) { bg = rec > 0 ? '#1B4332' : '#C9A84C'; color = '#fff'; }
            html += '<div style="border-radius:50%;width:28px;height:28px;margin:2px auto;display:flex;align-items:center;justify-content:center;background:' + bg + ';color:' + color + ';font-size:0.75em;font-weight:' + (isToday?'900':'400') + ';">' + d2 + '</div>';
        }
        el.innerHTML = html;
    }

    // TTS + 자동 체크
    window.doTTS_daejim = function() {
        var text = safeGetItem('daejim_text','');
        if (!text) { showToast('선언문이 없어요'); return; }
        var count = parseInt(safeGetItem('daejim_count','1'));
        var records = safeGetJSON('daejim_records', {});
        var today = getFormatDate(new Date());
        var rec = records[today] || 0;

        if (rec >= count) { showToast('오늘 수행을 모두 완료했어요! 🎉'); return; }

        if (typeof speechSynthesis !== 'undefined') {
            var utt = new SpeechSynthesisUtterance(text.replace(/[\r\n]/g,' '));
            utt.lang = 'ko-KR'; utt.rate = 0.9;
            utt.onend = function() {
                records[today] = rec + 1;
                safeSetJSON('daejim_records', records);
                renderDaejimDots(count, records);
                renderDaejimStats(records, safeGetItem('daejim_start_date', today), safeGetItem('daejim_target_date',''));
                renderDaejimCalendar(records, safeGetItem('daejim_start_date', today));
                if (records[today] >= count) {
                    showToast('오늘 다짐 완료! 🎉 대단해요!');
                    addPoint(5, '다짐수행', 'daejim_' + today + '_' + records[today]);
                } else {
                    showToast('1회 완료! 저녁에 한 번 더 해주세요 🌙');
                }
            };
            speechSynthesis.speak(utt);
            showToast('소리내어 따라 읽어보세요 🗣️');
        } else {
            showToast('이 기기는 음성 기능을 지원하지 않아요');
        }
    };

    // 목표 달성 체크
    function checkDaejimGoal() {
        var shown = safeGetItem('daejim_goal_shown','');
        if (shown === '1') return;
        safeSetItem('daejim_goal_shown','1');
        setTimeout(function() {
            if (confirm('🎉 목표 날짜가 됐어요! 이뤄내셨나요? 인증서를 받으시겠어요?')) {
                showToast('인증서 기능은 곧 오픈됩니다! 💚');
                // 사연 탭으로 연결
                if (confirm('이뤄낸 이야기를 많은 분들께 나눠주세요 💌 사연 보내기로 이동할까요?')) {
                    openStoryModal && openStoryModal();
                }
            }
        }, 800);
    }

    // 뷰 진입 시 초기화

    // ════════════════════════════════════════
    // 🎯 다짐 탭 HTML 동적 주입
    // ════════════════════════════════════════
    function injectDaejimHTML() {
        var el = document.getElementById('view-story');
        if (!el || el.getAttribute('data-daejim-injected')) return;
        el.setAttribute('data-daejim-injected', '1');
        el.innerHTML = [
            '<div style="padding:16px 16px 120px;">',

            // 도입 섹션
            '<div style="background:#1B4332;border-radius:18px;padding:20px;margin-bottom:18px;">',
            '<div onclick="toggleDaejimIntro()" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">',
            '<div>',
            '<div style="font-size:0.75em;color:#A8D5BA;font-weight:700;letter-spacing:1px;margin-bottom:4px;">록펠러의 습관</div>',
            '<div style="font-size:1.05em;font-weight:900;color:#fff;">🧠 왜 매일 소리내어 읽어야 할까?</div>',
            '</div>',
            '<div id="daejim-intro-arrow" style="font-size:1.4em;color:#A8D5BA;transition:transform 0.3s;">▼</div>',
            '</div>',
            '<div id="daejim-intro-content" style="display:none;margin-top:16px;">',

            // 뇌과학
            '<div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:12px;">',
            '<div style="font-size:0.85em;font-weight:800;color:#C9A84C;margin-bottom:10px;">🔬 뇌과학이 말하는 이유</div>',
            '<div style="font-size:0.83em;color:#E8F5E9;line-height:1.9;margin-bottom:10px;"><b style="color:#fff;">① 망상활성계(RAS) 활성화</b><br>뇌에는 수백만 개의 정보 중 중요한 것만 걸러내는 필터가 있어요. 목표를 매일 소리내어 읽으면, 뇌가 그것을 중요한 것으로 등록하고 하루 종일 관련 기회와 정보를 자동으로 포착하기 시작합니다.</div>',
            '<div style="font-size:0.83em;color:#E8F5E9;line-height:1.9;margin-bottom:10px;"><b style="color:#fff;">② 구현 의도 효과</b><br>심리학자 피터 골비처(Peter Gollwitzer) 연구에 따르면, 목표를 언제, 무엇을처럼 구체적으로 선언할수록 실행률이 2~3배 상승합니다.</div>',
            '<div style="font-size:0.83em;color:#E8F5E9;line-height:1.9;"><b style="color:#fff;">③ 소리내어 읽기 (생성 효과)</b><br>눈으로만 읽는 것보다 소리내어 읽으면 기억 정착률이 훨씬 높아집니다. 입으로 말하고 귀로 듣는 이중 자극이 무의식에 더 깊이 새겨지기 때문이에요.</div>',
            '</div>',

            // 유명인
            '<div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:12px;">',
            '<div style="font-size:0.85em;font-weight:800;color:#C9A84C;margin-bottom:10px;">👑 그들도 이렇게 했습니다</div>',
            '<div style="font-size:0.83em;color:#E8F5E9;line-height:1.9;margin-bottom:10px;"><b style="color:#fff;">존 D. 록펠러</b><br>매일 아침 자신의 재정 목표를 소리내어 선언했습니다. 500명의 백만장자를 연구한 나폴레온 힐은 이것이 그들의 공통된 하나의 습관이었다고 밝혔어요.</div>',
            '<div style="font-size:0.83em;color:#E8F5E9;line-height:1.9;margin-bottom:10px;"><b style="color:#fff;">짐 캐리</b><br>무명 시절, 자신에게 1,000만 달러짜리 수표를 써서 매일 지갑에 넣고 다녔습니다. 5년 후 영화 한 편으로 정확히 그 금액을 받았습니다.</div>',
            '<div style="font-size:0.83em;color:#E8F5E9;line-height:1.9;"><b style="color:#fff;">오프라 윈프리</b><br>나는 이미 성공한 사람이다를 매일 선언했습니다. 이것이 자신의 삶을 바꾼 핵심 습관이라고 여러 인터뷰에서 밝혔어요.</div>',
            '</div>',

            // 룰
            '<div style="background:rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin-bottom:16px;">',
            '<div style="font-size:0.85em;font-weight:800;color:#C9A84C;margin-bottom:10px;">📌 두 가지 룰 (반드시 지켜주세요)</div>',
            '<div style="font-size:0.83em;color:#E8F5E9;line-height:2;"><b style="color:#fff;">룰 1.</b> 반드시 소리내어 읽으세요. 속으로만 읽으면 효과가 절반 이하입니다.<br><br><b style="color:#fff;">룰 2.</b> 읽을 때 그 장면을 머릿속으로 그리세요. 통장에 찍힌 숫자, 책이 서점에 진열된 모습, 강의장에서 박수받는 순간. 감정까지 끌어오세요.</div>',
            '</div>',

            // 유튜브 버튼
            '<button id="daejim-shorts-btn" onclick="window.open(\'\',\'_blank\')" style="width:100%;padding:14px;background:rgba(255,0,0,0.15);border:1px solid rgba(255,80,80,0.4);border-radius:12px;color:#fff;font-size:0.88em;font-weight:700;cursor:pointer;margin-bottom:10px;">▶ 영상으로 보기 (유튜브 쇼츠)</button>',

            // 카카오
            '<button onclick="window.open(\'https://open.kakao.com/o/gr3RC2pi\',\'_blank\')" style="width:100%;padding:14px;background:#FEE500;border:none;border-radius:12px;color:#391B1B;font-size:0.88em;font-weight:800;cursor:pointer;">💬 다짐 알림 카카오채널 입장하기</button>',
            '<div style="font-size:0.75em;color:#A8D5BA;text-align:center;margin-top:6px;">매일 아침·저녁 다짐 시간을 알려드려요</div>',
            '</div></div>',

            // STEP 영역
            '<div id="daejim-setup-area">',
            '<div id="daejim-step-indicator" style="display:flex;gap:8px;margin-bottom:16px;">',
            '<div id="dstep-1" style="flex:1;height:4px;border-radius:2px;background:#1B4332;"></div>',
            '<div id="dstep-2" style="flex:1;height:4px;border-radius:2px;background:#E8E5E0;"></div>',
            '<div id="dstep-3" style="flex:1;height:4px;border-radius:2px;background:#E8E5E0;"></div>',
            '</div>',

            // STEP 1
            '<div id="daejim-step1">',
            '<div style="font-size:1em;font-weight:900;color:var(--primary-color);margin-bottom:16px;">✏️ 나의 다짐 설정</div>',
            _inputField('daejim-amount','목표 금액','예: 1억원, 5천만원','text'),
            _inputField('daejim-target-date','목표 날짜','','date'),
            _inputField('daejim-value','내가 줄 가치 (어떤 방법으로?)','예: 유튜브, 앱, 책, 강의','text'),
            _inputField('daejim-nickname','닉네임 또는 이름','예: 드림, 영희','text'),
            '<div style="background:#fff;border-radius:14px;padding:18px;border:1px solid var(--border-color);margin-bottom:12px;">',
            '<label style="font-size:0.8em;font-weight:700;color:#888;display:block;margin-bottom:10px;">하루 수행 횟수</label>',
            '<div style="display:flex;gap:10px;">',
            '<button onclick="selectDaejimCount(1)" id="daejim-count-1" style="flex:1;padding:12px;border:2px solid #1B4332;border-radius:10px;background:#1B4332;color:#fff;font-size:0.88em;font-weight:700;cursor:pointer;">하루 1회</button>',
            '<button onclick="selectDaejimCount(2)" id="daejim-count-2" style="flex:1;padding:12px;border:2px solid var(--border-color);border-radius:10px;background:transparent;color:var(--text-color);font-size:0.88em;font-weight:700;cursor:pointer;">아침 + 저녁 2회</button>',
            '</div></div>',
            _inputField('daejim-start-date','시작일','','date'),
            '<button onclick="generateDaejimSentences()" style="width:100%;padding:16px;background:#1B4332;color:#fff;border:none;border-radius:14px;font-size:1em;font-weight:800;cursor:pointer;">나의 선언문 만들기 →</button>',
            '</div>',

            // STEP 2
            '<div id="daejim-step2" style="display:none;">',
            '<div style="font-size:1em;font-weight:900;color:var(--primary-color);margin-bottom:6px;">✨ 선언문을 선택하세요</div>',
            '<div style="font-size:0.8em;color:#888;margin-bottom:16px;">마음에 드는 것을 고르고, 직접 수정도 가능해요</div>',
            '<div id="daejim-sentences"></div>',
            '<div style="margin-top:14px;"><div style="font-size:0.8em;font-weight:700;color:#888;margin-bottom:6px;">✏️ 직접 수정</div>',
            '<textarea id="daejim-custom-text" rows="4" style="width:100%;padding:12px;border:1.5px solid var(--border-color);border-radius:10px;font-size:0.9em;background:var(--bg-color);color:var(--text-color);outline:none;resize:none;box-sizing:border-box;line-height:1.7;"></textarea></div>',
            '<div style="display:flex;gap:10px;margin-top:14px;">',
            '<button onclick="showDaejimStep(1)" style="flex:1;padding:14px;background:transparent;border:1.5px solid var(--border-color);border-radius:12px;color:var(--text-color);font-size:0.9em;cursor:pointer;">← 다시 입력</button>',
            '<button onclick="confirmDaejimSentence()" style="flex:2;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.95em;font-weight:800;cursor:pointer;">이 문장으로 확정 →</button>',
            '</div></div>',

            // STEP 3
            '<div id="daejim-step3" style="display:none;">',
            '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:20px;padding:24px;text-align:center;margin-bottom:16px;">',
            '<div style="font-size:0.78em;color:#A8D5BA;font-weight:700;margin-bottom:4px;">목표까지</div>',
            '<div id="daejim-dday" style="font-size:3em;font-weight:900;color:#fff;letter-spacing:-1px;">D-???</div>',
            '<div id="daejim-target-label" style="font-size:0.78em;color:#A8D5BA;margin-top:4px;"></div>',
            '</div>',
            '<div style="background:#fff;border-radius:16px;padding:20px;border:1px solid var(--border-color);margin-bottom:16px;">',
            '<div style="font-size:0.75em;font-weight:700;color:#888;margin-bottom:10px;">📜 나의 선언문</div>',
            '<div id="daejim-main-text" style="font-size:0.95em;line-height:1.9;color:var(--text-color);font-weight:600;word-break:keep-all;"></div>',
            '</div>',
            '<div style="background:#fff;border-radius:16px;padding:20px;border:1px solid var(--border-color);margin-bottom:16px;">',
            '<div style="font-size:0.78em;font-weight:700;color:#888;margin-bottom:12px;">오늘의 수행</div>',
            '<div id="daejim-check-dots" style="display:flex;gap:12px;justify-content:center;margin-bottom:16px;"></div>',
            '<button onclick="doTTS_daejim()" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;">🔊 따라 읽기 (소리내어)</button>',
            '</div>',
            '<div style="background:#fff;border-radius:16px;padding:16px;border:1px solid var(--border-color);margin-bottom:16px;display:flex;gap:16px;justify-content:center;text-align:center;">',
            '<div><div id="daejim-streak" style="font-size:1.8em;font-weight:900;color:#1B4332;">0</div><div style="font-size:0.75em;color:#888;">연속 일수</div></div>',
            '<div style="width:1px;background:#eee;"></div>',
            '<div><div id="daejim-total" style="font-size:1.8em;font-weight:900;color:#1B4332;">0</div><div style="font-size:0.75em;color:#888;">총 수행일</div></div>',
            '<div style="width:1px;background:#eee;"></div>',
            '<div><div id="daejim-progress-pct" style="font-size:1.8em;font-weight:900;color:#C9A84C;">0%</div><div style="font-size:0.75em;color:#888;">달성률</div></div>',
            '</div>',
            '<div style="background:#fff;border-radius:16px;padding:18px;border:1px solid var(--border-color);margin-bottom:16px;">',
            '<div style="font-size:0.78em;font-weight:700;color:#888;margin-bottom:12px;">📅 수행 기록</div>',
            '<div id="daejim-calendar" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:0.7em;"></div>',
            '</div>',
            '<button onclick="showDaejimStep(1)" style="width:100%;padding:13px;background:transparent;border:1.5px solid var(--border-color);border-radius:12px;color:#888;font-size:0.85em;cursor:pointer;margin-bottom:10px;">🔄 새 다짐 시작하기</button>',
            '</div></div>',

            // 구분선 + 사연보내기
            '<div style="height:1px;background:var(--border-color);margin:24px 0;"></div>',
            '<div style="background:#fff;border-radius:16px;padding:20px;border:1px solid var(--border-color);">',
            '<div style="font-size:0.95em;font-weight:800;color:var(--primary-color);margin-bottom:6px;">✉️ 사연 보내기</div>',
            '<div style="font-size:0.82em;color:#888;line-height:1.7;margin-bottom:16px;">다짐을 이뤄낸 이야기, 확언으로 변화된 삶, 힘든 마음을 나눠주세요.</div>',
            '<button onclick="openStoryModal && openStoryModal()" style="width:100%;padding:14px;background:var(--primary-color);color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">💌 사연 보내기</button>',
            '</div>',

            '</div>'
        ].join('');
    }

    function _inputField(id, label, placeholder, type) {
        return '<div style="background:#fff;border-radius:14px;padding:18px;border:1px solid var(--border-color);margin-bottom:12px;">' +
            '<label style="font-size:0.8em;font-weight:700;color:#888;display:block;margin-bottom:6px;">' + label + '</label>' +
            '<input id="' + id + '" type="' + type + '" placeholder="' + placeholder + '" ' +
            'style="width:100%;padding:12px;border:1.5px solid var(--border-color);border-radius:10px;font-size:0.95em;background:var(--bg-color);color:var(--text-color);outline:none;box-sizing:border-box;">' +
            '</div>';
    }

    function initDaejimView() {
        injectDaejimHTML();
        var confirmed = safeGetItem('daejim_confirmed','');
        if (confirmed === '1') {
            showDaejimStep(3);
        } else {
            showDaejimStep(1);
            // 오늘 날짜를 시작일 기본값으로
            var startInput = document.getElementById('daejim-start-date');
            if (startInput) startInput.value = getFormatDate(new Date());
            // 저장된 값 복원
            var fields = {
                'daejim-amount': 'daejim_amount',
                'daejim-target-date': 'daejim_target_date',
                'daejim-value': 'daejim_value',
                'daejim-nickname': 'daejim_nickname',
            };
            Object.keys(fields).forEach(function(id) {
                var el = document.getElementById(id);
                var val = safeGetItem(fields[id],'');
                if (el && val) el.value = val;
            });
            var cnt = parseInt(safeGetItem('daejim_count','1'));
            selectDaejimCount(cnt);
        }
    }

// ★ vow checks 자동 마이그레이션 (숫자→객체 형식)
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
        try {
            var vow = safeGetJSON('vow_data', null);
            if(!vow || !vow.checks) return;
            var changed = false;
            Object.keys(vow.checks).forEach(function(key) {
                var v = vow.checks[key];
                if(typeof v === 'number') {
                    vow.checks[key] = {morning: v >= 1, evening: false};
                    changed = true;
                }
            });
            if(changed) safeSetJSON('vow_data', vow);
        } catch(e) {}
    }, 500);
});

// ★ 사연 탭 → 다짐 탭 이름 변경 (DOM 완전 로드 후)
document.addEventListener('DOMContentLoaded', function() {
    function changeSayeonToDAejim() {
        var navBtn = document.getElementById('nav-story');
        if (!navBtn) return;
        var txt = navBtn.querySelector('.nav-text');
        if (txt) txt.textContent = '다짐';
        var svg = navBtn.querySelector('svg');
        if (svg) {
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.innerHTML = '<path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z"/>';
        }
    }
    // 즉시 시도
    changeSayeonToDAejim();
    // 혹시 늦게 렌더링되면 재시도
    setTimeout(changeSayeonToDAejim, 300);
    setTimeout(changeSayeonToDAejim, 800);
});

// ════════════════════════════════════════
// 품속 앱 초기화 추가 기능
// ════════════════════════════════════════

(function initPumsok() {
    document.addEventListener('DOMContentLoaded', function() {

        // ① 헤더 타이틀 변경
        var ht = document.getElementById('app-title') ||
                 document.querySelector('.app-title') ||
                 document.querySelector('header span');
        // 동적으로 헤더에 품속 삽입
        var header = document.querySelector('#app-header') ||
                     document.querySelector('header');

        // ② 사연 탭 → 다짐 탭으로 변경
        var navStory = document.getElementById('nav-story');
        if(navStory) {
            var txt = navStory.querySelector('.nav-text') ||
                      navStory.querySelector('span');
            if(txt) txt.textContent = '다짐';
        }
        setTimeout(function() {
            var navStory2 = document.getElementById('nav-story');
            if(navStory2) {
                var txt2 = navStory2.querySelector('.nav-text') ||
                           navStory2.querySelector('span');
                if(txt2) txt2.textContent = '다짐';
            }
        }, 500);

        // ③ 아침/저녁 루틴 배지 초기화
        updatePumsokRoutineBadge();
    });
})();

// ── 아침/저녁 루틴 탭 ──
var PUMSOK_ROUTINE_KEY = 'pumsok_routine_v1';

function getPumsokSlot() {
    var h = new Date().getHours();
    return (h >= 5 && h < 16) ? 'morning' : 'evening';
}

function getPumsokRecord() {
    return safeGetJSON ? safeGetJSON(PUMSOK_ROUTINE_KEY, {}) :
           JSON.parse(localStorage.getItem(PUMSOK_ROUTINE_KEY) || '{}');
}

function setPumsokRecord(rec) {
    if(safeSetJSON) safeSetJSON(PUMSOK_ROUTINE_KEY, rec);
    else localStorage.setItem(PUMSOK_ROUTINE_KEY, JSON.stringify(rec));
}

function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth()+1).padStart(2,'0') + '-' +
        String(d.getDate()).padStart(2,'0');
}

function updatePumsokRoutineBadge() {
    // 루틴 미완료 시 배지 표시 (추후 네비게이션 연결)
}

// ── 아침 루틴 렌더 ──
window.renderMorningRoutine = function(el) {
    if(!el) return;
    var td = getTodayStr();
    var rec = getPumsokRecord();
    var todayRec = (rec[td] && rec[td].morning) || {};
    var steps = ['silence','vow','affirmation','memo','stretch'];
    var done = steps.filter(function(s){ return todayRec[s]; }).length;

    el.innerHTML = [
        '<div style="padding:16px 16px 100px;">',

        // 상단 카드
        '<div style="background:linear-gradient(135deg,#1B4332,#2D6A4F);border-radius:20px;padding:20px;margin-bottom:16px;">',
        '<div style="font-size:0.78em;color:rgba(255,255,255,0.7);margin-bottom:4px;">🌅 아침 루틴 — 이불 속에서 시작하는 하루</div>',
        '<div style="font-size:1.15em;font-weight:900;color:#fff;margin-bottom:12px;">좋은 아침이에요 🌿</div>',
        '<div style="background:rgba(255,255,255,0.2);border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px;">',
        '<div style="background:#C9A84C;height:100%;width:'+Math.round(done/5*100)+'%;border-radius:4px;transition:width 0.4s;"></div>',
        '</div>',
        '<div style="font-size:0.75em;color:rgba(255,255,255,0.7);">'+done+'/5 완료</div>',
        '</div>',

        // STEP 1: 숨 고르기
        makePumsokStep(1, '🧘', '숨 고르기',
            '눈을 감고 조용히 호흡에 집중하세요. 이불 속 온기를 느끼며 1분.',
            todayRec.silence,
            '<button onclick="startPumsokSilence()" id="pumsok-silence-btn" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">'+(todayRec.silence ? '✅ 완료' : '▶ 1분 타이머 시작')+'</button>'
        ),

        // STEP 2: 나의 다짐
        makePumsokStep(2, '🎯', '나의 다짐',
            '소리내어 선언하고 이루어진 장면을 그려보세요.',
            todayRec.vow,
            '<button onclick="goVowRoutine()" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">'+(todayRec.vow ? '✅ 완료' : '🎯 다짐하러 가기')+'</button>'
        ),

        // STEP 3: 오늘의 확언
        makePumsokStep(3, '✨', '오늘의 확언',
            '뇌과학 기반 오늘의 확언 한 줄을 소리내어 읽으세요.',
            todayRec.affirmation,
            '<button onclick="goAffirmationRoutine()" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">'+(todayRec.affirmation ? '✅ 완료' : '📖 확언 읽기')+'</button>'
        ),

        // STEP 4: 아침낙서
        makePumsokStep(4, '✏️', '아침낙서',
            '3분 타이머. 머릿속에 떠오르는 것 무엇이든 쏟아내세요.',
            todayRec.memo,
            '<button onclick="goMemoRoutine()" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">'+(todayRec.memo ? '✅ 완료' : '✏️ 낙서하러 가기')+'</button>'
        ),

        // STEP 5: 침대 스트레칭
        makePumsokStep(5, '🤸', '침대 스트레칭',
            '이불 속에서 시작해 몸을 깨워요. 1분이면 충분해요.',
            todayRec.stretch,
            '<div style="display:flex;gap:8px;">'+
            '<button onclick="openStretchVideo()" style="flex:1;padding:13px;background:transparent;border:1.5px solid #1B4332;border-radius:12px;color:#1B4332;font-size:0.9em;font-weight:700;cursor:pointer;">영상 보기</button>'+
            (todayRec.stretch ? '<button disabled style="flex:1;padding:13px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;">✅ 완료</button>' :
            '<button onclick="markStretch()" style="flex:1;padding:13px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;">완료 체크</button>')+
            '</div>'
        ),

        done===5 ?
        '<div style="background:linear-gradient(135deg,#C9A84C,#E8C97A);border-radius:16px;padding:20px;text-align:center;margin-top:8px;">'+
        '<div style="font-size:2.5em;margin-bottom:8px;">🎉</div>'+
        '<div style="font-size:1.05em;font-weight:900;color:#1B4332;">오늘 아침 루틴 완료!</div>'+
        '<div style="font-size:0.82em;color:#2D6A4F;margin-top:4px;">이불 속에서 기적이 시작됐어요</div>'+
        '</div>' : '',

        '</div>'
    ].join('');
};

// ── 저녁 루틴 렌더 ──
window.renderEveningRoutine = function(el) {
    if(!el) return;
    var td = getTodayStr();
    var rec = getPumsokRecord();
    var todayRec = (rec[td] && rec[td].evening) || {};
    var steps = ['memory','gratitude','vow_check','breath'];
    var done = steps.filter(function(s){ return todayRec[s]; }).length;

    el.innerHTML = [
        '<div style="padding:16px 16px 100px;">',

        '<div style="background:linear-gradient(135deg,#0D2B1F,#1B4332);border-radius:20px;padding:20px;margin-bottom:16px;">',
        '<div style="font-size:0.78em;color:rgba(255,255,255,0.7);margin-bottom:4px;">🌙 저녁 루틴 — 이불 속에서 닫는 하루</div>',
        '<div style="font-size:1.15em;font-weight:900;color:#fff;margin-bottom:12px;">오늘도 수고하셨어요 🌙</div>',
        '<div style="background:rgba(255,255,255,0.2);border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px;">',
        '<div style="background:#C9A84C;height:100%;width:'+Math.round(done/4*100)+'%;border-radius:4px;transition:width 0.4s;"></div>',
        '</div>',
        '<div style="font-size:0.75em;color:rgba(255,255,255,0.7);">'+done+'/4 완료</div>',
        '</div>',

        // STEP 1: 기억노트
        makePumsokStep(1, '🧠', '기억노트',
            '오늘 가장 기억에 남는 장면 하나를 소설처럼 적어보세요. 공간·사람·시간·감정.',
            todayRec.memory,
            '<button onclick="goMemoryNote()" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">'+(todayRec.memory ? '✅ 완료' : '🧠 기억 기록하기')+'</button>'
        ),

        // STEP 2: 감사한 줄
        makePumsokStep(2, '💛', '감사한 줄',
            '오늘 감사한 것 딱 하나만. 작은 것도 좋아요.',
            todayRec.gratitude,
            '<button onclick="goGratitude()" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">'+(todayRec.gratitude ? '✅ 완료' : '💛 감사 기록하기')+'</button>'
        ),

        // STEP 3: 다짐 확인
        makePumsokStep(3, '🎯', '다짐 확인',
            '잠들기 전 나의 다짐을 한 번 더 소리내어 읽어요.',
            todayRec.vow_check,
            '<button onclick="goVowCheck()" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">'+(todayRec.vow_check ? '✅ 완료' : '🎯 다짐 확인하기')+'</button>'
        ),

        // STEP 4: 수면 호흡
        makePumsokStep(4, '😴', '수면 호흡',
            '4초 들이쉬고 → 7초 멈추고 → 8초 내쉬기. 3번 반복하면 잠이 와요.',
            todayRec.breath,
            '<button onclick="startPumsokBreath()" id="pumsok-breath-btn" style="width:100%;padding:14px;background:#1B4332;color:#fff;border:none;border-radius:12px;font-size:1em;font-weight:700;cursor:pointer;">'+(todayRec.breath ? '✅ 완료' : '😴 호흡 시작')+'</button>'
        ),

        done===4 ?
        '<div style="background:linear-gradient(135deg,#0D2B1F,#1B4332);border-radius:16px;padding:20px;text-align:center;margin-top:8px;">'+
        '<div style="font-size:2.5em;margin-bottom:8px;">🌙</div>'+
        '<div style="font-size:1.05em;font-weight:900;color:#C9A84C;">오늘 저녁 루틴 완료!</div>'+
        '<div style="font-size:0.82em;color:#A8D5BA;margin-top:4px;">편안한 밤 되세요. 내일도 함께해요.</div>'+
        '</div>' : '',

        '</div>'
    ].join('');
};

function makePumsokStep(num, icon, title, desc, done, actionHTML) {
    return '<div style="background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;border:1.5px solid '+(done?'#1B4332':'#E8E5E0')+';">'+
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'+
        '<div style="width:28px;height:28px;border-radius:50%;background:'+(done?'#1B4332':'#E8E5E0')+';display:flex;align-items:center;justify-content:center;color:'+(done?'#fff':'#999')+';font-size:0.8em;font-weight:900;flex-shrink:0;">'+num+'</div>'+
        '<div style="font-size:1em;font-weight:800;color:#1A1A1A;">'+icon+' '+title+'</div>'+
        '</div>'+
        '<div style="font-size:0.85em;color:#666;margin-bottom:12px;line-height:1.6;">'+desc+'</div>'+
        actionHTML+
        '</div>';
}

window.markPumsokStep = function(step) {
    var td = getTodayStr();
    var rec = getPumsokRecord();
    if(!rec[td]) rec[td] = {};
    if(!rec[td].morning) rec[td].morning = {};
    rec[td].morning[step] = true;
    setPumsokRecord(rec);
    // 루틴 탭 새로고침
    var el = document.getElementById('pumsok-morning');
    if(el) window.renderMorningRoutine(el);
};

window.markPumsokEveStep = function(step) {
    var td = getTodayStr();
    var rec = getPumsokRecord();
    if(!rec[td]) rec[td] = {};
    if(!rec[td].evening) rec[td].evening = {};
    rec[td].evening[step] = true;
    setPumsokRecord(rec);
    var el = document.getElementById('pumsok-evening');
    if(el) window.renderEveningRoutine(el);
};

// ── 침묵 타이머 ──
var _pumsokSilenceTimer = null;
var _pumsokSilenceSec = 60;
var _pumsokSilenceRunning = false;

window.startPumsokSilence = function() {
    var td = getTodayStr();
    var rec = getPumsokRecord();
    if(rec[td] && rec[td].morning && rec[td].morning.silence) {
        showToast && showToast('오늘 이미 완료했어요 ✅'); return;
    }
    if(_pumsokSilenceRunning) {
        clearInterval(_pumsokSilenceTimer);
        _pumsokSilenceRunning = false;
        _pumsokSilenceSec = 60;
        var btn = document.getElementById('pumsok-silence-btn');
        if(btn) btn.textContent = '▶ 1분 타이머 시작';
        return;
    }
    _pumsokSilenceRunning = true;
    _pumsokSilenceSec = 60;
    var btn = document.getElementById('pumsok-silence-btn');

    _pumsokSilenceTimer = setInterval(function() {
        _pumsokSilenceSec--;
        var b = document.getElementById('pumsok-silence-btn');
        if(b) b.textContent = '⏹ ' + _pumsokSilenceSec + '초... (탭하면 중지)';
        if(_pumsokSilenceSec <= 0) {
            clearInterval(_pumsokSilenceTimer);
            _pumsokSilenceRunning = false;
            _pumsokSilenceSec = 60;
            markPumsokStep('silence');
            showToast && showToast('숨 고르기 완료! 🧘 마음이 차분해졌나요?');
        }
    }, 1000);
};

// ── 수면 호흡 타이머 (4-7-8) ──
var _pumsokBreathTimer = null;
var _pumsokBreathRunning = false;

window.startPumsokBreath = function() {
    var td = getTodayStr();
    var rec = getPumsokRecord();
    if(rec[td] && rec[td].evening && rec[td].evening.breath) {
        showToast && showToast('오늘 이미 완료했어요 ✅'); return;
    }
    if(_pumsokBreathRunning) {
        clearInterval(_pumsokBreathTimer);
        _pumsokBreathRunning = false;
        var btn = document.getElementById('pumsok-breath-btn');
        if(btn) btn.textContent = '😴 호흡 시작';
        return;
    }
    _pumsokBreathRunning = true;
    var phases = [
        {text:'🌬 들이쉬기... 1 2 3 4', dur:4},
        {text:'😶 멈추기... 1 2 3 4 5 6 7', dur:7},
        {text:'💨 내쉬기... 1 2 3 4 5 6 7 8', dur:8},
    ];
    var round = 0, phaseIdx = 0, phaseSec = 0;
    var btn = document.getElementById('pumsok-breath-btn');

    _pumsokBreathTimer = setInterval(function() {
        var ph = phases[phaseIdx];
        var remaining = ph.dur - phaseSec;
        var b = document.getElementById('pumsok-breath-btn');
        if(b) b.textContent = ph.text + ' (' + remaining + ')';
        phaseSec++;
        if(phaseSec >= ph.dur) {
            phaseSec = 0; phaseIdx++;
            if(phaseIdx >= phases.length) {
                phaseIdx = 0; round++;
                if(round >= 3) {
                    clearInterval(_pumsokBreathTimer);
                    _pumsokBreathRunning = false;
                    markPumsokEveStep('breath');
                    showToast && showToast('수면 호흡 완료! 🌙 편안한 밤 되세요');
                }
            }
        }
    }, 1000);
};

// ── 루틴 메인 뷰 (아침/저녁 자동 전환) ──
window.renderPumsokRoutine = function() {
    var container = document.getElementById('pumsok-routine-container');
    if(!container) {
        // view-home 안에 삽입
        var viewHome = document.getElementById('view-home');
        if(!viewHome) return;
        var div = document.createElement('div');
        div.id = 'pumsok-routine-container';
        viewHome.insertBefore(div, viewHome.firstChild);
        container = div;
    }
    var h = new Date().getHours();
    var isMorning = (h >= 5 && h < 16);

    container.innerHTML =
        '<div style="display:flex;border-bottom:1px solid #E8E5E0;margin-bottom:0;">' +
        '<button onclick="showMorningTab()" id="pumsok-tab-morning" style="flex:1;padding:12px;border:none;background:transparent;font-size:0.9em;font-weight:'+(isMorning?'900':'600')+';color:'+(isMorning?'#1B4332':'#999')+';border-bottom:'+(isMorning?'2px solid #1B4332':'none')+';cursor:pointer;">🌅 아침 루틴</button>' +
        '<button onclick="showEveningTab()" id="pumsok-tab-evening" style="flex:1;padding:12px;border:none;background:transparent;font-size:0.9em;font-weight:'+(!isMorning?'900':'600')+';color:'+(!isMorning?'#1B4332':'#999')+';border-bottom:'+(!isMorning?'2px solid #1B4332':'none')+';cursor:pointer;">🌙 저녁 루틴</button>' +
        '</div>' +
        '<div id="pumsok-morning" style="display:'+(isMorning?'block':'none')+'"></div>' +
        '<div id="pumsok-evening" style="display:'+(!isMorning?'block':'none')+'"></div>';

    if(isMorning) window.renderMorningRoutine(document.getElementById('pumsok-morning'));
    else window.renderEveningRoutine(document.getElementById('pumsok-evening'));
};

window.showPumsokTab = function(tab) {
    var m = document.getElementById('pumsok-morning');
    var e = document.getElementById('pumsok-evening');
    var tm = document.getElementById('pumsok-tab-morning');
    var te = document.getElementById('pumsok-tab-evening');
    if(tab === 'morning') {
        if(m) { m.style.display='block'; window.renderMorningRoutine(m); }
        if(e) e.style.display='none';
        if(tm) { tm.style.color='#1B4332'; tm.style.fontWeight='900'; tm.style.borderBottom='2px solid #1B4332'; }
        if(te) { te.style.color='#999'; te.style.fontWeight='600'; te.style.borderBottom='none'; }
    } else {
        if(e) { e.style.display='block'; window.renderEveningRoutine(e); }
        if(m) m.style.display='none';
        if(te) { te.style.color='#1B4332'; te.style.fontWeight='900'; te.style.borderBottom='2px solid #1B4332'; }
        if(tm) { tm.style.color='#999'; tm.style.fontWeight='600'; tm.style.borderBottom='none'; }
    }
};

window.goVowRoutine = function() {
    if(window.initVowNavAndView) initVowNavAndView();
    if(window.renderVowView) renderVowView();
    if(window.switchView) switchView('story');
};
window.goAffirmationRoutine = function() {
    if(window.switchView) switchView('home');
    markPumsokStep('affirmation');
};
window.goMemoRoutine = function() {
    if(window.switchView) switchView('memo');
    markPumsokStep('memo');
};
window.goMemoryNote = function() {
    if(window.switchView) switchView('memo');
    markPumsokEveStep('memory');
};
window.goGratitude = function() {
    if(window.switchView) switchView('memo');
    markPumsokEveStep('gratitude');
};
window.goVowCheck = function() {
    if(window.initVowNavAndView) initVowNavAndView();
    if(window.renderVowView) renderVowView();
    if(window.switchView) switchView('story');
    markPumsokEveStep('vow_check');
};
window.openStretchVideo=function(){window.open('https://www.youtube.com/@SecondActRadio','_blank');};
window.markStretch=function(){markPumsokStep('stretch');};
window.showMorningTab=function(){showPumsokTab('morning');};
window.showEveningTab=function(){showPumsokTab('evening');};
