(() => {
'use strict';
const $ = id => document.getElementById(id);
const cards = [];
let socket = null, mode = 'bot', onlineRoom = '', isHost = false, onlineState = null;
let localGame = null, toastTimer = null, lastRevealToken = '', currentPlayerName = 'นักสำรวจ';
let localDrawTimer = null, localDrawTimerKey = '', countdownInterval = null;
const byId = id => cards.find(c => c.id === id) || {id, name:id, type:'การ์ด', desc:'', effect:'', image:''};
const playerKeyCount = p => p?.keyCountTotal ? (Number(p.keys)||0) : (Number(p?.storedKeys ?? p?.keys)||0) + (p?.hand||[]).filter(c=>c.id==='key').length;
let audioCtx=null, ambientNodes=[], musicEnabled=false, audioReady=false, musicTimer=null, localEndTimer=null, localEndTimerKey='';
 let targetSelectionOpen=false, lastOmenRound=-1;
function ensureAudio(){
 if(audioCtx)return audioCtx;
 const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return null;
 audioCtx=new Ctx();return audioCtx;
}
function playPluck(freq, when, duration=1.15, volume=.045){
 const ctx=ensureAudio();if(!ctx)return;
 const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
 osc.type='triangle';osc.frequency.setValueAtTime(freq,when);osc.frequency.exponentialRampToValueAtTime(Math.max(60,freq*.995),when+duration);
 filter.type='lowpass';filter.frequency.value=1800;gain.gain.setValueAtTime(.0001,when);gain.gain.exponentialRampToValueAtTime(volume,when+.035);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
 osc.connect(filter);filter.connect(gain);gain.connect(ctx.destination);osc.start(when);osc.stop(when+duration+.03);
}
function startAmbient(){
 const ctx=ensureAudio();if(!ctx)return;if(ctx.state==='suspended')ctx.resume();if(musicEnabled)return;
 musicEnabled=true;audioReady=true;
 const master=ctx.createGain();master.gain.value=.48;master.connect(ctx.destination);ambientNodes.push(master);
 // Gentle Thai-inspired pentatonic music, played as soft plucked notes and warm sustained tones.
 const progression=[[220,261.63,329.63],[196,246.94,293.66],[174.61,220,261.63],[196,246.94,329.63]];
 let step=0;
 const playBar=()=>{
  if(!musicEnabled||!audioCtx)return;
  const now=ctx.currentTime, chord=progression[Math.floor(step/4)%progression.length];
  const melody=[chord[2]*2,chord[1]*2,chord[0]*2,chord[1]*2][step%4];
  playPluck(melody,now,.9,.018);
  if(step%4===0){
   chord.forEach((hz,i)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();osc.type='sine';osc.frequency.value=hz;filter.type='lowpass';filter.frequency.value=700;gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(i===0?.012:.008,now+.25);gain.gain.exponentialRampToValueAtTime(.0001,now+2.7);osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start(now);osc.stop(now+2.8);});
  }
  step++;
 };
 playBar();musicTimer=setInterval(playBar,720);
 const btn=$('soundToggle');if(btn){btn.textContent='♫ เสียง: เปิด';btn.setAttribute('aria-pressed','true');}const gameBtn=$('gameSoundToggle');if(gameBtn){gameBtn.textContent='♫ เสียง: เปิด';gameBtn.setAttribute('aria-pressed','true');}
}
function stopAmbient(){
 if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
 ambientNodes.forEach(n=>{try{if(n.disconnect)n.disconnect();}catch(_){}});ambientNodes=[];musicEnabled=false;
 const btn=$('soundToggle');if(btn){btn.textContent='♫ เสียง: ปิด';btn.setAttribute('aria-pressed','false');}const gameBtn=$('gameSoundToggle');if(gameBtn){gameBtn.textContent='♫ เสียง: ปิด';gameBtn.setAttribute('aria-pressed','false');}
}
function playDrawSound(){
 const ctx=ensureAudio();if(!ctx)return;if(ctx.state==='suspended')ctx.resume();
 // Paper-card swish: short filtered noise sweep plus a soft card-on-table tap.
 const now=ctx.currentTime,buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*.24),ctx.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
 const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();noise.buffer=buffer;filter.type='bandpass';filter.frequency.setValueAtTime(1700,now);filter.frequency.exponentialRampToValueAtTime(520,now+.19);filter.Q.value=.7;
 gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.16,now+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+.23);noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);noise.start(now);noise.stop(now+.24);
 const tap=ctx.createOscillator(),tg=ctx.createGain();tap.type='sine';tap.frequency.setValueAtTime(190,now+.13);tap.frequency.exponentialRampToValueAtTime(90,now+.21);tg.gain.setValueAtTime(.0001,now+.13);tg.gain.exponentialRampToValueAtTime(.055,now+.145);tg.gain.exponentialRampToValueAtTime(.0001,now+.24);tap.connect(tg);tg.connect(ctx.destination);tap.start(now+.13);tap.stop(now+.25);
}

function updateSoundForScreen(){
 // Keep the same gentle background music running in both lobby and gameplay.
 if(musicEnabled && audioCtx?.state==='suspended')audioCtx.resume();
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(msg){ const el=$('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),3200); }
 const nightOmens=[
  '🌫️ หมอกหนาทึบปกคลุมเรือนไทย… อย่าไว้ใจไพ่ที่เห็น',
  '🕯️ เปลวเทียนไหวเอง เหมือนมีใครกำลังเดินผ่าน',
  '🐈 แมวดำร้องจากใต้ถุนบ้าน คืนนี้อาจมีคนเสียกุญแจ',
  '🔔 ระฆังดังสามครั้ง วิญญาณกำลังตื่น',
  '🌸 กลีบดอกบัวปลิวผ่านโต๊ะ ขอให้หัวใจยังอบอุ่น',
  '👣 มีรอยเท้าเปียกบนพื้นไม้ ทั้งที่ฝนไม่ได้ตก'
 ];
 function updateNightOmen(round){
  const el=$('nightOmen');if(!el)return;
  const n=Math.max(1,Number(round)||1);
  el.textContent=`คำทำนายประจำคืน • ${nightOmens[(n-1)%nightOmens.length]}`;
  el.dataset.round=String(n);
  if(lastOmenRound!==n){lastOmenRound=n;el.classList.remove('omen-pulse');void el.offsetWidth;el.classList.add('omen-pulse');}
 }

function show(id){$(id)?.classList.remove('hidden');}
function hide(id){$(id)?.classList.add('hidden');}
function imgUrl(c){return c?.image || '/assets/cards/card-01.jpg';}
function renderCardTile(c){
 return `<article class="card card-parchment"><div class="card-art" style="background-image:url('${esc(imgUrl(c))}')"><span class="card-type">${esc(c.type||'การ์ด')}</span></div><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><div class="effect"><b>ความสามารถ</b><span>${esc(c.effect)}</span></div></article>`;
}
function renderCatalog(){
 const grid=$('cardGrid'); if(!grid)return;
 const q=($('cardSearch')?.value||'').trim().toLowerCase(), f=$('cardFilter')?.value||'all';
 const shown=cards.filter(c=>(f==='all'||c.type===f)&&`${c.name} ${c.type} ${c.desc} ${c.effect}`.toLowerCase().includes(q));
 grid.innerHTML=shown.map(c=>renderCardTile(c)).join('') || '<p class="muted">ไม่พบการ์ดที่ค้นหา</p>';
}
function openSetup(){show('setupModal');$('playerName').value=currentPlayerName;$('profileName').textContent=currentPlayerName;}
function closeSetup(){hide('setupModal');}
function setMode(){
 mode=$('mode').value;
 if(mode==='online'){show('onlineOptions');hide('botOptions');hide('startGame');}
 else {hide('onlineOptions');show('botOptions');show('startGame');}
}
function getName(){return ($('playerName').value||'นักสำรวจ').trim().slice(0,18)||'นักสำรวจ';}
function connectSocket(){
 if(socket?.connected)return Promise.resolve(socket);
 if(!window.io){toast('โหลดระบบออนไลน์ไม่สำเร็จ กรุณารีเฟรชหน้า');return Promise.reject(new Error('socket.io missing'));}
 // Mobile-friendly Socket.IO connection: polling first, then automatic WebSocket upgrade.
 // A transient connect_error must not abort the join while automatic reconnection is running.
 if(!socket){socket=io({reconnection:true,reconnectionAttempts:8,reconnectionDelay:500,timeout:20000});bindSocket();}
 return new Promise((resolve,reject)=>{
  if(socket.connected)return resolve(socket);
  let settled=false;
  const cleanup=()=>{clearTimeout(timer);socket.off('connect',onConnect);};
  const onConnect=()=>{if(settled)return;settled=true;cleanup();resolve(socket);};
  const timer=setTimeout(()=>{if(settled)return;settled=true;cleanup();reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'));},20000);
  socket.on('connect',onConnect);
 });
}
function onlineError(msg){toast(msg||'ทำรายการไม่สำเร็จ');}
async function createRoom(){
 currentPlayerName=getName();$('profileName').textContent=currentPlayerName;
 try{await connectSocket();socket.emit('create-room',{name:currentPlayerName},res=>{
  if(!res?.ok)return onlineError(res?.error);
  onlineRoom=res.room;isHost=true;show('roomLobby');$('createdRoomCode').textContent=onlineRoom;
  $('roomTag').textContent=`ห้อง ${onlineRoom}`;$('lobbyPlayers').textContent='สร้างห้องแล้ว กำลังรอเพื่อนเข้าร่วม…';
  $('startOnlineGame').disabled=false;toast(`สร้างห้อง ${onlineRoom} แล้ว ส่งรหัสให้เพื่อนได้เลย`);
 });}catch(e){onlineError('เชื่อมต่อไม่ได้ กรุณาลองใหม่อีกครั้ง');}
}
async function joinRoom(){
 currentPlayerName=getName();const code=($('joinRoomCode').value||'').replace(/\\s+/g,'').toUpperCase();
 if(code.length<4)return toast('กรอกรหัสห้องที่เพื่อนส่งมา');
 const btn=$('joinRoomBtn');if(btn){btn.disabled=true;btn.textContent='กำลังเชื่อมต่อ…';}
 try{
  await connectSocket();
  socket.emit('join-room',{room:code,name:currentPlayerName},res=>{
   if(btn){btn.disabled=false;btn.textContent='เข้าร่วมห้อง';}
   if(!res?.ok)return onlineError(res?.error||'เข้าห้องไม่สำเร็จ');
   onlineRoom=res.room;isHost=false;show('roomLobby');$('createdRoomCode').textContent=onlineRoom;
   $('lobbyPlayers').textContent='เข้าห้องสำเร็จ กำลังรอเจ้าของห้องเริ่มเกม';$('startOnlineGame').disabled=true;
   $('roomTag').textContent=`ห้อง ${onlineRoom}`;toast('เข้าห้องแล้ว รอเจ้าของห้องเริ่มเกม');
  });
 }catch(e){
  if(btn){btn.disabled=false;btn.textContent='เข้าร่วมห้อง';}
  onlineError('เชื่อมต่อไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง');
 }
}
function startOnline(){
 if(!socket?.connected||!onlineRoom)return toast('สร้างห้องหรือเข้าห้องก่อน');
 if(!isHost)return toast('รอเจ้าของห้องเริ่มเกม');
 socket.emit('start-room',{room:onlineRoom},res=>{
  if(!res?.ok)return onlineError(res?.error);
  enterOnlineGame(onlineRoom);
  requestOnlineState();
 });
}
function startBotGame(){
 currentPlayerName=getName();$('profileName').textContent=currentPlayerName;if($('gamePlayerName'))$('gamePlayerName').textContent=currentPlayerName;
 const count=Number($('playerCount').value||3);
 const bots=Array.from({length:count-1},(_,i)=>({id:`bot-${i+1}`,name:['น้องบัว','คุณข้าวปั้น','แม่มะลิ','เจ้าตูบ'][i%4],hearts:3,keys:0,alive:true,hand:[],bot:true,skip:false}));
 const heart=()=>({...byId('heart'),uid:`heart-${Math.random()}`});
 const deck=[];cards.forEach(c=>{for(let i=0;i<(Number(c.copies)||0);i++){if(c.id!=='heart')deck.push({...c,uid:`${c.id}-${Math.random().toString(36).slice(2,9)}`});}});
 for(let i=deck.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 localGame={players:[{id:'human',name:currentPlayerName,hearts:3,keys:0,alive:true,hand:[heart(),heart(),heart()],bot:false,skip:false},...bots],deck,discard:[],turn:0,round:1,logs:['ทุกคนเริ่มด้วยหัวใจ 3 ดวง','ถึงตาคุณแล้ว ต้องจั่วการ์ด 1 ใบ'],over:false,winner:null,pending:null,phase:'draw',direction:1,lastDraw:null,turnStartedAt:Date.now()};
 mode='bot';onlineRoom='';onlineState=null;closeSetup();show('gameScreen');hide('gameOver');$('roomTag').textContent='โหมดบอท';renderLocal();toast('เกมเริ่มแล้ว! คุณมีหัวใจ 3 ใบ');
}
let tableAnnouncementTimer=null;
function announceTable(message,title='เหตุการณ์ในบ้านผีไทย',kind='ward'){
 const box=$('tableAnnouncement');if(!box)return;
 $('tableAnnouncementTitle').textContent=title;
 $('tableAnnouncementText').textContent=message;
 box.classList.remove('hidden','announcement-ward','announcement-danger');
 box.classList.add(kind==='danger'?'announcement-danger':'announcement-ward','announcement-show');
 if(tableAnnouncementTimer)clearTimeout(tableAnnouncementTimer);
 tableAnnouncementTimer=setTimeout(()=>{box.classList.remove('announcement-show');setTimeout(()=>box.classList.add('hidden'),250);},3200);
}
function currentState(){return mode==='online'?onlineState:localGame;}
function logLocal(s){localGame.logs.unshift(s);localGame.logs=localGame.logs.slice(0,20);}
function localAlive(){return localGame.players.filter(p=>p.alive);}
function localFinish(p,msg){localGame.over=true;localGame.winner=p?.id||null;logLocal(msg);renderLocal();}
function localHurt(p,reason){let i=p.hand.findIndex(c=>c.id==='heart');if(i>=0)p.hand.splice(i,1);p.hearts=Math.max(0,p.hearts-1);logLocal(`${p.name} ${reason||'ถูกผีหลอก'} เสียหัวใจ 1 ดวง (เหลือ ${p.hearts})`);if(!p.hearts){p.alive=false;logLocal(`${p.name} หัวใจหมดแล้ว แพ้ออกจากเกม`);if(localAlive().length<=1)localFinish(localAlive()[0],localAlive().length?`${localAlive()[0].name} เป็นผู้รอดชีวิตคนสุดท้าย!`:'ทุกคนแพ้แล้ว');}}
function localNext(){
 if(localGame.over)return;
 const n=localGame.players.length;let found=false;
 for(let i=0;i<n;i++){const dir=localGame.direction||1;localGame.turn=(localGame.turn+dir+n)%n;const p=localGame.players[localGame.turn];if(!p.alive)continue;if(p.skip){p.skip=false;logLocal(`${p.name} ถูกข้ามเทิร์น`);continue;}found=true;break;}
 if(!found){localFinish(null,'ไม่มีผู้เล่นเหลือรอด');return;}
 if((localGame.direction||1)===1?localGame.turn===0:localGame.turn===n-1)localGame.round++;
 localGame.phase='draw';localGame.turnStartedAt=Date.now();localDrawTimerKey='';renderLocal();
 if(localGame.players[localGame.turn].bot)setTimeout(botTurn,1000);
}
function localAutoEndAfterUse(g,p){
 if(!g||g.over||g.pending)return;
 if(playerKeyCount(p)>=3){localFinish(p,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);return;}
 setTimeout(()=>{
  if(localGame!==g||g.over||g.pending||g.players[g.turn]?.id!==p.id)return;
  if(playerKeyCount(p)>=3){localFinish(p,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);return;}
  logLocal(`${p.name} ใช้การ์ดแล้ว จบเทิร์นอัตโนมัติ`);localNext();
 },650);
}
function localDraw(p){
 if(localGame.over||localGame.pending||localGame.phase!=='draw'||localGame.players[localGame.turn].id!==p.id||!p.alive)return;
 if(localDrawTimer){clearTimeout(localDrawTimer);localDrawTimer=null;} localDrawTimerKey='';
 if(!localGame.deck.length){toast('กองจั่วหมดแล้ว');localNext();return;}
 const c=localGame.deck.pop();localGame.lastDraw={token:`${Date.now()}-${Math.random()}`,playerId:p.id,playerName:p.name,card:c,ghost:c.kind==='ghost'||c.type==='ผีอันตราย'};
 logLocal(`${p.name} จั่วได้ “${c.name}”`);
 if(c.id==='lucky-flower' && c.kind!=='ghost' && c.type!=='ผีอันตราย'){
  if((p.hearts||0)<3){p.hearts=Math.min(3,(p.hearts||0)+1);p.hand.push({...byId('heart'),uid:`heart-human-lotus-${Date.now()}`});localGame.discard.push(c);logLocal(`${p.name} จั่วได้ดอกบัวนำโชค ฟื้นหัวใจ 1 ดวงและรับหัวใจเข้ามือทันที`);}
  else{p.hand.push(c);logLocal(`${p.name} หัวใจเต็ม จึงเก็บดอกบัวนำโชคไว้ป้องกันผี`);}
  showReveal(localGame.lastDraw,false);localGame.phase='afterdraw';localGame.afterDrawStartedAt=Date.now();localDrawTimerKey='';renderLocal();return;
 }
 if(c.kind==='ghost'||c.type==='ผีอันตราย'){localGame.pending={playerId:p.id,card:c};localGame.phase='resolve';renderLocal();showReveal(localGame.lastDraw,true);return;}
 p.hand.push(c);localGame.discard.push(c);
 if(playerKeyCount(p)>=3){showReveal(localGame.lastDraw,false);localFinish(p,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);return;}
 showReveal(localGame.lastDraw,false);localGame.phase='afterdraw';localGame.afterDrawStartedAt=Date.now();localDrawTimerKey='';renderLocal();
}
function resolveLocalGhost(useProtection){
 const g=localGame,p=g?.players.find(p=>p.id===g.pending?.playerId);if(!g||!p)return;
 const c=g.pending.card;g.discard.push(c);
 if(useProtection){if((p.shields||0)>0){p.shields--;logLocal(`${p.name} ใช้เครื่องรางที่เตรียมไว้ป้องกันผี`);announceTable(`${p.name} ใช้เครื่องรางป้องกัน ${c.name} ได้สำเร็จ`,'ป้องกันผีสำเร็จ');}else{const i=p.hand.findIndex(x=>['protection','guardian','blessed-rice','ghost-puppy','ban','lucky-flower'].includes(x.id));if(i>=0){const prot=p.hand.splice(i,1)[0];g.discard.push(prot);logLocal(`${p.name} ใช้ ${prot.name} ป้องกันผี`);announceTable(`${p.name} ใช้การ์ด “${prot.name}” ป้องกัน ${c.name} ได้สำเร็จ`,'ใช้การ์ดป้องกัน');}else localHurt(p,`ถูก ${c.name} หลอก`);}}
 else localHurt(p,`ถูก ${c.name} หลอก`);
 g.pending=null;hide('drawReveal');if(!g.over)localNext();else renderLocal();
}
function botTurn(){
 const g=localGame;if(!g||g.over||g.pending)return;const p=g.players[g.turn];if(!p?.bot||!p.alive)return;
 // A bot wins immediately once its collected key cards reach three.
 if(playerKeyCount(p)>=3){localFinish(p,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);return;}
 if(p.skip){p.skip=false;logLocal(`${p.name} ถูกข้ามเทิร์น`);localNext();return;}
 if(!g.deck.length){localNext();return;}
 const c=g.deck.pop();g.lastDraw={token:`${Date.now()}-${Math.random()}`,playerId:p.id,playerName:p.name,card:c,ghost:c.kind==='ghost'||c.type==='ผีอันตราย'};
 logLocal(`${p.name} จั่วได้ “${c.name}”`);
 if(g.lastDraw.ghost){
  const i=p.hand.findIndex(x=>['protection','guardian','blessed-rice','ghost-puppy','lucky-flower'].includes(x.id));
  if(i>=0){g.discard.push(p.hand.splice(i,1)[0]);g.discard.push(c);logLocal(`${p.name} ใช้เครื่องรางป้องกันตัวเอง`);}
  else {g.discard.push(c);localHurt(p,`ถูก ${c.name} หลอก`);}
 }else if(c.id==='lucky-flower'){
  if((p.hearts||0)<3){p.hearts=Math.min(3,(p.hearts||0)+1);p.hand.push({...byId('heart'),uid:`heart-${p.id}-lotus-${Date.now()}`});g.discard.push(c);logLocal(`${p.name} จั่วได้ดอกบัวนำโชค ฟื้นหัวใจ 1 ดวง`);}
  else{p.hand.push(c);logLocal(`${p.name} หัวใจเต็ม เก็บดอกบัวนำโชคไว้ป้องกันผี`);}
 }else{p.hand.push(c);g.discard.push(c);}
 // Check key victory after every draw, including the third key entering a bot's hand.
 if(p.alive && playerKeyCount(p)>=3){
  localFinish(p,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);
  renderLocal();
  showReveal(g.lastDraw,false);
  return;
 }
 renderLocal();
 showReveal(g.lastDraw,false);
 const token=g.lastDraw.token;
 setTimeout(()=>{if(localGame===g&&g.lastDraw?.token===token){hide('drawReveal');if(!g.over&&!g.pending)localNext();}},3000);
}
function renderPlayers(state, local=false){
 const list=$('playersList');if(!list)return;
 const players=state?.players||[];
 list.innerHTML=players.map((p,index)=>{
  const isTurn=players[state.turn]?.id===p.id;
  const hearts=Math.max(0,Number(p.hearts)||0);
  const keys=playerKeyCount(p);
  return `<div class="player-row seat-${index+1} ${isTurn?'active-player':''} ${p.alive===false?'dead-player':''}" style="--seat-index:${index}"><div class="player-avatar">${p.id==='human'?'🧑':p.bot?'👻':'🧑‍🚀'}</div><div class="player-meta"><b>${esc(p.name)} ${p.id==='human'?'(คุณ)':''}</b><small>🗝️ ${keys}/3 กุญแจ ${p.alive===false?'• ออกจากเกม':''}</small><span class="hearts">${'❤️'.repeat(hearts)}${'🖤'.repeat(3-hearts)}</span></div>${isTurn?'<span class="seat-turn">◀ ถึงตา</span>':''}</div>`;
 }).join('');
}
function renderHand(hand,canPlay){
 const el=$('hand');if(!el)return;
 const phase=mode==='online'?(onlineState?.phase||'draw'):(localGame?.phase||'draw');
 const canPlayCard=c=>(canPlay&&c.id!=='skip-next') || (phase==='draw'&&['skip-next','gecko','owl'].includes(c.id));
 const count=hand.length;
 $('handCount').textContent=`${count} ใบ`;
 const available=Math.max(1,el.clientWidth||el.parentElement?.clientWidth||960);
 const gap=count>1?Math.max(3,Math.min(7,available*.004)):0;
 const cardWidth=count?Math.max(42,Math.min(170,Math.floor((available-gap*Math.max(0,count-1))/count))):170;
 const sideCount=$('sideHandCount');if(sideCount)sideCount.textContent=`${count} ใบ`;
 el.style.setProperty('--hand-count',String(count));
 el.style.setProperty('--hand-card-width',`${cardWidth}px`);
 el.style.setProperty('--hand-gap',`${gap}px`);
 el.innerHTML=hand.map((c,i)=>`<button class="hand-card ${c.id==='heart'?'heart-card':''}" data-hand-index="${i}" style="--hand-index:${i};flex:0 1 ${cardWidth}px;width:${cardWidth}px;max-width:${cardWidth}px" ${!canPlayCard(c)?'disabled':''} title="${esc(c.desc||c.name)}" aria-label="${esc(c.name)}: ${esc(c.effect||c.desc||'')}">
   <span class="hand-art" style="background-image:url('${esc(imgUrl(c))}')"></span>
   <span class="hand-card-title">${esc(c.name||'การ์ด')}</span>
   <span class="hand-card-type">${esc(c.type||'การ์ด')}</span>
   <span class="hand-card-desc">${esc(c.desc||'การ์ดลึกลับจากบ้านผีไทย')}</span>
   <span class="hand-card-effect"><b>ความสามารถ</b><span>${esc(c.effect||'ไม่มีความสามารถพิเศษ')}</span></span>
  </button>`).join('')||'<p class="muted">ยังไม่มีการ์ดในมือ</p>';
 el.querySelectorAll('[data-hand-index]').forEach(btn=>btn.addEventListener('click',()=>previewHandCard(Number(btn.dataset.handIndex))));
}
function renderLogs(logs){$('gameLog').innerHTML=(logs||[]).slice(0,24).map(s=>`<p>✦ ${esc(s)}</p>`).join('');}
function syncLocalDrawTimer(g,myTurn){
 if(!myTurn){if(localDrawTimer){clearTimeout(localDrawTimer);localDrawTimer=null;}localDrawTimerKey='';return;}
 const key=`${g.round}-${g.turn}-${g.turnStartedAt||0}`;
 if(localDrawTimerKey===key)return;
 if(localDrawTimer)clearTimeout(localDrawTimer);
 localDrawTimerKey=key;
 const started=g.turnStartedAt||Date.now();
 localDrawTimer=setTimeout(()=>{
  localDrawTimer=null;
  if(localGame===g&&!g.over&&!g.pending&&g.phase==='draw'&&g.turn===0){
   toast('หมดเวลา 10 วินาที ระบบจั่วการ์ดให้อัตโนมัติ');
   localDraw(g.players[0]);
  }
 },Math.max(0,10000-(Date.now()-started)));
}
function syncLocalEndTimer(g,active){
 if(!active){if(localEndTimer){clearTimeout(localEndTimer);localEndTimer=null;}localEndTimerKey='';return;}
 const key=`end-${g.round}-${g.turn}-${g.turnStartedAt||0}`;if(localEndTimerKey===key)return;
 if(localEndTimer)clearTimeout(localEndTimer);localEndTimerKey=key;
 const started=g.afterDrawStartedAt||Date.now();
 localEndTimer=setTimeout(()=>{
  localEndTimer=null;
  if(localGame===g&&!g.over&&!g.pending&&g.phase==='afterdraw'&&g.turn===0){toast('หมดเวลา 10 วินาที ระบบจบเทิร์นให้อัตโนมัติ');localNext();}
 },Math.max(0,10000-(Date.now()-started)));
}
function updateDrawCountdown(){
 const banner=$('turnBanner');if(!banner)return;
 let started=0, active=false;
 let phase='draw';
 if(mode==='bot'&&localGame&&!localGame.over&&!localGame.pending&&localGame.turn===0&&['draw','afterdraw'].includes(localGame.phase)){
  phase=localGame.phase;started=phase==='afterdraw'?(localGame.afterDrawStartedAt||Date.now()):(localGame.turnStartedAt||Date.now());active=true;
 }else if(mode==='online'&&onlineState&&!onlineState.over&&!onlineState.pending&&onlineState.players?.[onlineState.turn]){
  phase=onlineState.phase||'draw';started=phase==='afterdraw'?(onlineState.afterDrawStartedAt||Date.now()):(onlineState.turnStartedAt||Date.now());active=true;
 }
 if(active){
  const secs=Math.max(0,Math.ceil((10000-(Date.now()-started))/1000));
  const current=mode==='online'?onlineState.players[onlineState.turn]:localGame?.players?.[localGame.turn];
  const mine=mode==='bot'?current?.id==='human':current?.id===socket?.id;
  const action=phase==='afterdraw'?'จบเทิร์น':'จั่วการ์ด';
  banner.textContent=mine?`ถึงตาคุณแล้ว — ${action}ใน ${secs} วินาที`:`ถึงตา ${current?.name||'ผู้เล่น'} — ${action}ใน ${secs} วินาที`;
  banner.classList.add('turn-countdown');
 }else{
  banner?.classList.remove('turn-countdown');
 }
}
if(!countdownInterval)countdownInterval=setInterval(updateDrawCountdown,1000);
function renderLastDrawPreview(lastDraw,fallback){
 const target=$('discardTop');if(!target)return;
 const card=lastDraw?.card||fallback||null;
 if(!card){target.innerHTML='<span class="discard-empty">—</span><small>ไพ่ล่าสุด</small>';return;}
 const who=lastDraw?.playerName?`${lastDraw.playerName} • `:'';
 target.innerHTML=`<img class="discard-preview" src="${esc(imgUrl(card))}" alt="${esc(who+card.name||'ไพ่ล่าสุดที่จั่ว')}" draggable="false"><small>ไพ่ล่าสุดที่จั่ว</small>`;
}
function renderLocal(){
 const g=localGame;if(!g)return;const p=g.players.find(x=>x.id==='human');if(!p)return;
 renderPlayers(g,true);renderHand(p.hand,g.turn===0&&!g.over&&!g.pending&&g.phase==='afterdraw');
 $('deckCount').textContent=`เหลือ ${g.deck.length} ใบ`;$('tableDeckCount').textContent=`${g.deck.length} ใบ`;if($('sideDeckCount'))$('sideDeckCount').textContent=`${g.deck.length} ใบ`;$('roundCount').textContent=g.round;updateNightOmen(g.round);
 $('turnBanner').textContent=g.over?'เกมจบแล้ว':g.pending?(g.pending.playerId==='human'?'ผีปรากฏตัว! เลือกว่าจะป้องกันหรือไม่':`${g.players.find(x=>x.id===g.pending.playerId)?.name||'ผู้เล่น'} กำลังเจอผี`):g.turn===0?'ถึงตาคุณแล้ว — จั่วการ์ด 1 ใบ':`ถึงตา ${g.players[g.turn].name}`;
 $('tableMessage').textContent=g.over?'การผจญภัยสิ้นสุดลง':g.pending?'มีวิญญาณปรากฏตัว!':g.turn===0?'จั่วการ์ดเพื่อสำรวจบ้าน':'กำลังรอผู้เล่น...';
 renderLastDrawPreview(g.lastDraw,g.discard[g.discard.length-1]);
 renderLogs(g.logs);
 if($('sidePlayersCount'))$('sidePlayersCount').textContent=`${g.players.filter(x=>x.alive!==false).length}/${g.players.length}`;if($('sideRoundCount'))$('sideRoundCount').textContent=String(g.round);if($('sideCurrentTurn'))$('sideCurrentTurn').textContent=g.over?'เกมจบ':(g.players[g.turn]?.name||'—');
 const myTurn=g.turn===0&&!g.over&&!g.pending&&g.phase==='draw';
 const ownTurn=g.turn===0&&!g.over&&!g.pending;
 syncLocalDrawTimer(g,myTurn);syncLocalEndTimer(g,ownTurn&&g.phase==='afterdraw');
 $('drawCard').disabled=!myTurn;$('tableDeck').disabled=!myTurn;$('endTurn').disabled=!(ownTurn&&g.phase==='afterdraw');$('escapeBtn').disabled=!(g.turn===0&&!g.over&&!g.pending);
 if(g.over){show('gameOver');$('resultTitle').textContent=g.winner==='human'?'คุณหนีออกมาได้!':g.winner?`${g.players.find(x=>x.id===g.winner)?.name||'ผู้เล่น'} ชนะ!`:'เกมจบแล้ว';$('resultText').textContent=g.logs[0]||'การผจญภัยสิ้นสุดลง';}
 else hide('gameOver');
}
function renderOnline(){
 const s=onlineState;if(!s)return;
 renderPlayers(s,false);const me=s.players.find(p=>p.id===socket?.id);renderHand(me?.hand||[],s.players[s.turn]?.id===socket?.id&&s.phase==='afterdraw'&&!s.over&&!s.pending);
 const surrenderBtn=$('leaveGame');if(surrenderBtn){const living=(s.players||[]).filter(p=>p.alive!==false).length;surrenderBtn.disabled=!!(mode==='online'&&living<=2);surrenderBtn.title=living<=2?'ออนไลน์ต้องมีผู้เล่นที่ยังอยู่มากกว่า 2 คนจึงยอมแพ้ได้':'ยอมแพ้และออกจากเกม';}
 $('deckCount').textContent=`เหลือ ${s.deckCount} ใบ`;$('tableDeckCount').textContent=`${s.deckCount} ใบ`;if($('sideDeckCount'))$('sideDeckCount').textContent=`${s.deckCount} ใบ`;$('roundCount').textContent=s.round||1;updateNightOmen(s.round||1);
 const myTurn=s.players[s.turn]?.id===socket?.id;
 $('turnBanner').textContent=s.over?'เกมจบแล้ว':s.pending?(s.pending.playerId===socket?.id?'ผีปรากฏตัว! เลือกว่าจะป้องกันหรือไม่':'มีผู้เล่นเจอผี!'):myTurn?'ถึงตาคุณแล้ว — จั่วการ์ด 1 ใบ':`ถึงตา ${s.players[s.turn]?.name||'ผู้เล่น'}`;
 $('tableMessage').textContent=s.over?'การผจญภัยสิ้นสุดลง':s.pending?'มีวิญญาณปรากฏตัว!':myTurn?'จั่วการ์ดเพื่อสำรวจบ้าน':'กำลังรอผู้เล่น...';
 renderLastDrawPreview(s.lastDraw,s.discard);
 renderLogs(s.logs);
 if($('sidePlayersCount'))$('sidePlayersCount').textContent=`${(s.players||[]).filter(x=>x.alive!==false).length}/${(s.players||[]).length}`;if($('sideRoundCount'))$('sideRoundCount').textContent=String(s.round||1);if($('sideCurrentTurn'))$('sideCurrentTurn').textContent=s.over?'เกมจบ':(s.players[s.turn]?.name||'—');
 const canDraw=myTurn&&s.phase!=='afterdraw'&&!s.pending&&!s.over;
 $('drawCard').disabled=!canDraw;$('tableDeck').disabled=!canDraw;$('endTurn').disabled=!(myTurn&&s.phase==='afterdraw'&&!s.pending&&!s.over);$('escapeBtn').disabled=!(myTurn&&!s.pending&&!s.over);
 if(s.lastDraw&&s.lastDraw.token!==lastRevealToken){lastRevealToken=s.lastDraw.token;showReveal(s.lastDraw,!!s.lastDraw.ghost);}
 if(s.pending&&s.pending.playerId===socket?.id){showGhostChoicesOnline(s.pending.card);}
 if(s.over){show('gameOver');$('resultTitle').textContent=s.winner===socket?.id?'คุณหนีออกมาได้!':s.winner?`${s.players.find(p=>p.id===s.winner)?.name||'ผู้เล่น'} ชนะ!`:'เกมจบแล้ว';$('resultText').textContent=s.logs?.[0]||'การผจญภัยสิ้นสุดลง';}
 else hide('gameOver');
}
let revealTimer=null;
function showReveal(draw,isGhost){
 playDrawSound();
 const c=draw.card||byId('heart');clearTimeout(revealTimer);show('drawReveal');
 const ownDraw=mode==='bot'?draw.playerId==='human':draw.playerId===socket?.id;
 $('revealTitle').textContent=ownDraw?'คุณจั่วได้':`${draw.playerName||'ผู้เล่น'} จั่วได้`;
 $('revealArt').style.backgroundImage=`url('${imgUrl(c)}')`;$('revealType').textContent=c.type||'การ์ด';$('revealName').textContent=c.name||'การ์ดปริศนา';$('revealDesc').textContent=c.desc||'';$('revealEffect').textContent=c.effect||'';
 const actions=$('revealActions');actions.innerHTML='';
 if(isGhost && ownDraw){
  if(mode==='bot'){
   const can=localGame.players[0].hand.some(x=>['protection','guardian','blessed-rice','ghost-puppy','lucky-flower'].includes(x.id));
   actions.innerHTML=`<p class="reveal-warning">👻 ผีหลอก! คุณจะเสียหัวใจ 1 ดวง หรือใช้เครื่องรางป้องกันแทนได้</p><button class="primary" id="useProtectionLocal" ${can?'':'disabled'}>🧿 ใช้การ์ดป้องกัน</button><button class="secondary" id="takeHitLocal">💔 ยอมเสียหัวใจ</button>`;
   $('useProtectionLocal')?.addEventListener('click',()=>resolveLocalGhost(true));$('takeHitLocal')?.addEventListener('click',()=>resolveLocalGhost(false));
  }else showGhostChoicesOnline(c);
 }else if(isGhost && mode==='online' && onlineState?.pending){
  actions.innerHTML='<p class="reveal-warning">👻 ผู้เล่นกำลังเลือกว่าจะใช้เครื่องรางหรือไม่</p><span class="reveal-countdown">การ์ดจะแสดง 3 วินาที</span>';
  revealTimer=setTimeout(()=>hide('drawReveal'),3000);
 }else if(mode==='bot'&&!ownDraw){
  actions.innerHTML='<p class="reveal-countdown">การ์ดที่ผู้เล่นได้รับ • เล่นต่อในอีก 3 วินาที</p>';
  revealTimer=setTimeout(()=>hide('drawReveal'),3000);
 }else if(mode==='online'){
  actions.innerHTML='<p class="reveal-countdown">การ์ดที่จั่วได้ • เล่นต่อในอีก 3 วินาที</p>';
  revealTimer=setTimeout(()=>hide('drawReveal'),3000);
 }else{
  actions.innerHTML=`<button class="primary" id="confirmReveal">กลับสู่โต๊ะ</button>`;
  $('confirmReveal').addEventListener('click',()=>hide('drawReveal'));
 }
}
function showGhostChoicesOnline(card){
 const actions=$('revealActions');if(!actions)return;
 const me=onlineState?.players.find(p=>p.id===socket?.id),can=(me?.hand||[]).some(x=>['protection','guardian','blessed-rice','ghost-puppy','lucky-flower'].includes(x.id));
 actions.innerHTML=`<p class="reveal-warning">👻 ผีหลอก! เลือกใช้เครื่องรางหรือยอมเสียหัวใจ</p><button class="primary" id="useProtectionOnline" ${can?'':'disabled'}>🧿 ใช้การ์ดป้องกัน</button><button class="secondary" id="takeHitOnline">💔 ยอมเสียหัวใจ</button>`;
 $('useProtectionOnline')?.addEventListener('click',()=>{socket.emit('resolve-ghost',{room:onlineRoom,useProtection:true});hide('drawReveal')});
 $('takeHitOnline')?.addEventListener('click',()=>{socket.emit('resolve-ghost',{room:onlineRoom,useProtection:false});hide('drawReveal')});
}
function chooseTarget(players,filter=()=>true){
 const list=players.filter(filter);if(!list.length)return Promise.resolve(null);
 if(list.length===1)return Promise.resolve(list[0]);
 const modal=$('targetModal'),listEl=$('targetOptions'),title=$('targetTitle'),sub=$('targetSubtitle');
 if(!modal||!listEl)return Promise.resolve(null);
 if(targetSelectionOpen)return Promise.resolve(null);
 targetSelectionOpen=true;title.textContent='เลือกผู้เล่น';sub.textContent='เลือกคนที่ต้องการให้การ์ดส่งผลด้วย';
 listEl.innerHTML=list.map((p,i)=>{
  const keys=playerKeyCount(p),hearts=Number(p.hearts)||0,handCount=Number(p.handCount??p.hand?.length)||0;
  const avatar=p.avatar||'👻';
  return `<button type="button" class="target-option" data-target-index="${i}"><span class="target-avatar">${esc(avatar)}</span><span class="target-info"><b>${esc(p.name||'ผู้เล่น')}</b><small>❤️ ${hearts}/3 หัวใจ · 🗝️ ${keys}/3 กุญแจ · 🃏 ${handCount} ใบ</small></span><span class="target-arrow">เลือก ↗</span></button>`;
 }).join('');
 modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');
 return new Promise(resolve=>{
  let settled=false;
  const finish=value=>{
   if(settled)return;settled=true;targetSelectionOpen=false;modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');
   listEl.removeEventListener('click',onPick);$('targetCancel')?.removeEventListener('click',onCancel);modal.removeEventListener('click',onBackdrop);document.removeEventListener('keydown',onKey);resolve(value);
  };
  const onPick=e=>{const b=e.target.closest('[data-target-index]');if(!b)return;const idx=Number(b.dataset.targetIndex);finish(Number.isInteger(idx)?list[idx]||null:null);};
  const onCancel=()=>finish(null),onBackdrop=e=>{if(e.target===modal)finish(null);},onKey=e=>{if(e.key==='Escape')finish(null);};
  listEl.addEventListener('click',onPick);$('targetCancel')?.addEventListener('click',onCancel);modal.addEventListener('click',onBackdrop);document.addEventListener('keydown',onKey);
 });
}
function previewHandCard(index){
 const hand=mode==='online'?(onlineState?.players||[]).find(p=>p.id===socket?.id)?.hand:(localGame?.players||[])[0]?.hand;
 const c=hand?.[index];if(!c)return;
 const phase=mode==='online'?(onlineState?.phase||'draw'):(localGame?.phase||'draw');
 const canPlay=(phase==='draw'?['skip-next','gecko','owl'].includes(c.id):phase==='afterdraw'&&!['heart','protection','lucky-flower','key'].includes(c.id));
 const old=document.getElementById('cardPreviewModal');if(old)old.remove();
 const modal=document.createElement('div');modal.id='cardPreviewModal';modal.className='card-preview-backdrop';
 modal.innerHTML=`<section class="card-preview-dialog" role="dialog" aria-modal="true" aria-label="ตรวจสอบการ์ด">
  <button class="card-preview-close" type="button" aria-label="ปิด">×</button>
  <div class="card-preview-kicker">ตรวจสอบการ์ดก่อนใช้</div>
  <div class="card-preview-card">
   <div class="card-preview-art" style="background-image:url('${esc(imgUrl(c))}')"></div>
   <h2>${esc(c.name||'การ์ด')}</h2><div class="card-preview-type">${esc(c.type||'การ์ด')}</div>
   <p>${esc(c.desc||'การ์ดลึกลับจากบ้านผีไทย')}</p>
   <div class="card-preview-effect"><b>ความสามารถ</b><span>${esc(c.effect||'ไม่มีความสามารถพิเศษ')}</span></div>
  </div>
  <div class="card-preview-actions">
   <button type="button" class="card-preview-cancel">ยกเลิก</button>
   <button type="button" class="card-preview-confirm" ${canPlay?'':'disabled'}>${canPlay?'ใช้การ์ดใบนี้':'ยังใช้ไม่ได้ในจังหวะนี้'}</button>
  </div>
  ${canPlay?'':'<p class="card-preview-note">การ์ดใบนี้ยังใช้ไม่ได้ในช่วงปัจจุบัน หรือเป็นการ์ดที่ทำงานอัตโนมัติ</p>'}
 </section>`;
 document.body.appendChild(modal);
 const close=()=>modal.remove();
 modal.querySelector('.card-preview-close').addEventListener('click',close);
 modal.querySelector('.card-preview-cancel').addEventListener('click',close);
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 const keyHandler=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',keyHandler);}};
 document.addEventListener('keydown',keyHandler);
 modal.querySelector('.card-preview-confirm').addEventListener('click',()=>{
  if(!canPlay)return;
  close();document.removeEventListener('keydown',keyHandler);playHandCard(index);
 });
}
async function playHandCard(index){
 if(mode==='online'){
  if(!onlineRoom||!socket?.connected)return;
  const me=onlineState?.players.find(p=>p.id===socket.id);const c=me?.hand?.[index];if(!c)return;
  if(onlineState?.phase==='draw'&&c.id==='skip-next'){socket.emit('skip-draw',{room:onlineRoom});return;}
  if(onlineState?.phase==='draw'&&!['gecko','owl'].includes(c.id))return toast('ก่อนจั่วใช้ได้เฉพาะจิ้งจกทักหรือเสียงนก');
  if(onlineState?.phase!=='afterdraw'&&onlineState?.phase!=='draw')return toast('ยังใช้การ์ดไม่ได้ในจังหวะนี้');
  if(['heart','protection','lucky-flower','key'].includes(c.id))return toast(c.id==='heart'?'หัวใจคือพลังชีวิต':c.id==='lucky-flower'?'ดอกบัวนำโชคทำงานอัตโนมัติเมื่อจั่ว หรือเก็บไว้ป้องกันผีเมื่อหัวใจเต็ม':c.id==='key'?'กุญแจนับจากการ์ดในมืออัตโนมัติ ไม่ต้องกดใช้ — เมื่อครบ 3 ดอกให้กดหนีออกจากบ้าน':'เก็บเครื่องรางไว้ใช้ตอนเจอผี');
  const others=(onlineState?.players||[]).filter(p=>p.id!==socket.id&&p.alive);
  let targetId;
  if(['skip','vase','ghost-visit'].includes(c.id)){const t=await chooseTarget(others);if(!t)return toast('ยกเลิกการใช้การ์ด');targetId=t.id;}
  if(c.id==='friend-holy-water'){const t=await chooseTarget(others,p=>(Number(p.hearts)||0)<3);if(!t)return toast('ไม่มีเพื่อนที่หัวใจยังไม่เต็มให้ฟื้นฟู');targetId=t.id;}
  if(c.id==='cat'){const t=await chooseTarget(others,p=>playerKeyCount(p)>0);if(!t)return toast('ไม่มีผู้เล่นอื่นที่มีกุญแจให้ขโมย');targetId=t.id;}
  if(c.id==='eye'){const t=await chooseTarget(others,p=>(p.handCount||0)>0);if(!t)return toast('ไม่มีผู้เล่นอื่นที่มีไพ่ในมือ');targetId=t.id;}
  socket.emit('play-card',{room:onlineRoom,index,targetId});return;
 }
 const g=localGame,p=g?.players[0];if(!g||g.over||g.turn!==0||g.pending)return;const c=p.hand[index];if(!c)return;
 if(g.phase==='draw'&&c.id==='skip-next'){p.hand.splice(index,1);g.discard.push(c);logLocal(`${p.name} ใช้การ์ดข้ามการจั่ว`);localNext();return;}
 if(g.phase==='draw'&&!['gecko','owl'].includes(c.id))return toast('ก่อนจั่วใช้ได้เฉพาะจิ้งจกทักหรือเสียงนก');
 if(g.phase!=='afterdraw'&&g.phase!=='draw')return toast('ยังใช้การ์ดไม่ได้ในจังหวะนี้');
 if(['heart','protection','lucky-flower','key'].includes(c.id))return toast(c.id==='heart'?'หัวใจคือพลังชีวิต':c.id==='lucky-flower'?'ดอกบัวนำโชคทำงานอัตโนมัติเมื่อจั่ว หรือเก็บไว้ป้องกันผีเมื่อหัวใจเต็ม':c.id==='key'?'กุญแจนับจากการ์ดในมืออัตโนมัติ ไม่ต้องกดใช้ — เมื่อครบ 3 ดอกให้กดหนีออกจากบ้าน':'เก็บเครื่องรางไว้ใช้เมื่อเจอผี');
 const others=g.players.filter(x=>x.alive&&x.id!==p.id);let t=null;
 if(['skip','vase','ghost-visit'].includes(c.id))t=await chooseTarget(others);
 if(c.id==='friend-holy-water')t=await chooseTarget(others,x=>(Number(x.hearts)||0)<3);
 if(c.id==='cat')t=await chooseTarget(others,x=>playerKeyCount(x)>0);
 if(c.id==='eye')t=await chooseTarget(others,x=>x.hand?.length>0);
 if(['skip','vase','cat','eye','ghost-visit','friend-holy-water'].includes(c.id)&&!t)return toast('ยกเลิกการใช้การ์ด');
 p.hand.splice(index,1);g.discard.push(c);
 if(c.id==='key'){p.keys=(p.keys||0)+1;logLocal(`${p.name} ใช้กุญแจ ได้ ${playerKeyCount(p)}/3`);}
 else if(c.id==='holy-water'){if(p.hearts<3){p.hearts=Math.min(3,p.hearts+1);p.hand.push({...byId('heart'),uid:`heart-${p.id}-water-${Date.now()}`});logLocal(`${p.name} ใช้น้ำมนต์ ฟื้นหัวใจเป็น ${p.hearts}/3 และเพิ่มการ์ดหัวใจเข้ามือ`);}else{p.shields=(p.shields||0)+1;logLocal(`${p.name} หัวใจเต็ม น้ำมนต์กลายเป็นเครื่องรางป้องกัน 1 ครั้ง`);}}
 else if(c.id==='friend-holy-water'){if(t&&t.hearts<3){t.hearts=Math.min(3,t.hearts+1);t.hand.push({...byId('heart'),uid:`heart-${t.id}-friend-water-${Date.now()}`});logLocal(`${p.name} พรมน้ำมนต์ให้ ${t.name} ฟื้นหัวใจเป็น ${t.hearts}/3 และเพิ่มการ์ดหัวใจเข้ามือ`);}else logLocal(`${t?.name||'เพื่อน'} มีหัวใจเต็มแล้ว น้ำมนต์จึงไม่เพิ่มหัวใจ`);}
 else if(['guardian','blessed-rice','ghost-puppy','ban'].includes(c.id)){p.shields=(p.shields||0)+1;logLocal(`${p.name} เตรียม ${c.name} เป็นเครื่องรางป้องกันผี 1 ครั้ง`);}
 else if(c.id==='reverse'){g.direction*=-1;logLocal(`${p.name} ใช้ ${c.name} กลับทิศทางการเล่น`);}
 else if(['skip','vase'].includes(c.id)){t.skip=true;logLocal(`${p.name} ใช้ ${c.name} ข้ามเทิร์น ${t.name}`);}
 else if(c.id==='cat'){
  let stolen=null;const hi=(t.hand||[]).findIndex(x=>x.id==='key');if(hi>=0){stolen=t.hand.splice(hi,1)[0];p.hand.push(stolen);}else if((t.keys||0)>0){t.keys--;p.keys=(p.keys||0)+1;stolen={id:'key',name:'กุญแจเรือนไทย'};}
  if(stolen){logLocal(`${p.name} ขโมยกุญแจจาก ${t.name} สำเร็จ! คุณมีกุญแจ ${playerKeyCount(p)}/3 และ ${t.name} เหลือ ${playerKeyCount(t)}/3`);if(playerKeyCount(p)>=3)localFinish(p,`${p.name} มีกุญแจครบ 3 ดอกจากการขโมยและหนีออกจากบ้านได้สำเร็จ!`);}else logLocal(`${t.name} ไม่มีกุญแจให้ขโมย`);
 }else if(c.id==='gecko'){
  if(g.deck.length<2&&g.discard.length)g.deck=g.deck.concat(g.discard.splice(0));
  if(g.deck.length){const a=g.deck.pop(),b=g.deck.length?g.deck.pop():null;showOmenChoice('gecko',[a,b].filter(Boolean),(chosenIndex)=>{if(chosenIndex<0){if(a)g.deck.push(a);if(b)g.deck.push(b);renderLocal();localAutoEndAfterUse(g,p);return;}const chosen=chosenIndex===0?a:b,other=chosen===a?b:a;if(other)g.deck.push(other);if(!chosen)return;if(chosen.kind==='ghost'||chosen.type==='ผีอันตราย'){g.pending={playerId:p.id,card:chosen};g.phase='resolve';logLocal(`จิ้งจกทักเลือกได้ “${chosen.name}” — ผีปรากฏตัว!`);showReveal({token:`gecko-${Date.now()}`,playerId:'human',playerName:p.name,card:chosen},true);}else{p.hand.push(chosen);logLocal(`จิ้งจกทัก: เลือกเก็บ “${chosen.name}” เข้ามือ`);showEffectCard(`จิ้งจกทัก: เก็บ “${chosen.name}” เข้ามือ`,chosen);}renderLocal();if(!g.pending&&!g.over)localAutoEndAfterUse(g,p);});renderLocal();return;}else logLocal('กองจั่วว่าง ไม่มีไพ่ให้ตรวจดู');
 }else if(c.id==='owl'){
  if(!g.deck.length&&g.discard.length)g.deck=g.discard.splice(0);
  const top=g.deck[g.deck.length-1];if(top){showOmenChoice('owl',[top],(keep)=>{if(keep){const got=g.deck.pop();if(got){p.hand.push(got);logLocal(`เสียงนก: เลือกเก็บ “${got.name}” เข้ามือ`);showEffectCard(`เสียงนก: เก็บ “${got.name}” เข้ามือ`,got);}}else logLocal(`เสียงนก: เห็น “${top.name}” แล้วเลือกไม่เก็บ`);renderLocal();if(!g.pending&&!g.over)localAutoEndAfterUse(g,p);});renderLocal();return;}else logLocal('กองจั่วว่าง ไม่มีไพ่ให้ตรวจดู');
 }else if(c.id==='ghost-visit'){
  if((t.shields||0)>0){t.shields--;logLocal(`${p.name} พาผีไปเยี่ยม ${t.name} แต่เครื่องรางป้องกันไว้ได้`);announceTable(`${t.name} ใช้เครื่องรางที่เตรียมไว้ ป้องกันผีที่ ${p.name} ส่งมาได้สำเร็จ`,'เพื่อนใช้การ์ดป้องกัน');}
  else {const prot=(t.hand||[]).findIndex(x=>['protection','guardian','blessed-rice','ghost-puppy','ban','lucky-flower'].includes(x.id));if(prot>=0){const used=t.hand.splice(prot,1)[0];g.discard.push(used);logLocal(`${t.name} ใช้ ${used.name} ป้องกันผีที่ ${p.name} ส่งไป`);announceTable(`${t.name} ใช้การ์ด “${used.name}” ป้องกันผีที่ ${p.name} ส่งมาได้สำเร็จ`,'เพื่อนใช้การ์ดป้องกัน');}else{localHurt(t,`${p.name} พาผีไปเยี่ยม`);logLocal(`${p.name} พาผีไปเยี่ยม ${t.name} ทำให้เสียหัวใจ 1 ดวง`);announceTable(`${t.name} ไม่มีการ์ดป้องกัน เสียหัวใจ 1 ดวง`,'ผีหลอกสำเร็จ','danger');}}
 }else if(c.id==='eye'){
  const hidden=t.hand[Math.floor(Math.random()*t.hand.length)];if(hidden){logLocal(`${p.name} ใช้ตาวาวกระจกส่องไพ่ของ ${t.name}`);showEffectCard(`ไพ่ที่สุ่มเห็นจากมือ ${t.name}`,hidden);}else logLocal(`${t.name} ไม่มีไพ่ในมือให้ส่อง`);
 }else if(c.id==='lantern'){
  const extra=g.deck.pop();if(extra){const ghost=extra.kind==='ghost'||extra.type==='ผีอันตราย';if(ghost){g.pending={playerId:p.id,card:extra};g.phase='resolve';showReveal({token:`lantern-${Date.now()}`,playerId:'human',playerName:p.name,card:extra},true);renderLocal();return;}p.hand.push(extra);g.discard.push(extra);logLocal(`${p.name} ใช้โคมลอยนำทาง จั่วเพิ่มและเก็บ “${extra.name}” เข้ามือ`);showEffectCard(`โคมลอยนำทาง: จั่วเพิ่มได้ “${extra.name}”`,extra);}else logLocal('กองจั่วว่าง');
 }else logLocal(`${p.name} ใช้ ${c.name}`);
 if(!g.over&&playerKeyCount(p)>=3){localFinish(p,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);return;}
 renderLocal();localAutoEndAfterUse(g,p);
}

function showOmenChoice(kind, omenCards, onChoose){
 const old=document.getElementById('omenChoiceModal');if(old)old.remove();
 const overlay=document.createElement('div');overlay.id='omenChoiceModal';overlay.className='omen-choice-backdrop';
 const cardHtml=(c,i)=>`<button class="omen-choice-card" data-choice="${i}"><span class="omen-choice-art" style="background-image:url('${esc(imgUrl(c))}')"></span><b>${esc(c.name||'การ์ด')}</b><small>${esc(c.type||'การ์ด')}</small><p>${esc(c.desc||'')}</p><em>${esc(c.effect||'')}</em><strong>เลือกใบนี้</strong></button>`;
 overlay.innerHTML=`<div class="omen-choice-dialog" role="dialog" aria-modal="true"><button class="omen-close" aria-label="ปิด">×</button><span class="eyebrow">✦ ลางบอกเหตุ ✦</span><h2>${kind==='gecko'?'🦎 จิ้งจกทัก — เลือกไพ่ 1 ใบ':'🦉 เสียงนกที่เท้าถนน'}</h2><p>${kind==='gecko'?'เปิดไพ่ 2 ใบ แล้วเลือกเก็บ 1 ใบ อีกใบจะกลับไปบนกองจั่ว':'ไพ่ใบบนสุดของกองจั่วปรากฏขึ้น คุณจะเก็บเข้ามือหรือปล่อยไว้?'}</p><div class="omen-choice-cards">${kind==='gecko'?omenCards.map(cardHtml).join(''):omenCards.map((c,i)=>cardHtml(c,i)).join('')}</div>${kind==='owl'?'<div class="omen-choice-buttons"><button class="primary" data-keep="yes">เก็บเข้ามือ</button><button class="secondary" data-keep="no">ไม่เก็บ</button></div>':''}</div>`;
 document.body.appendChild(overlay);
 const close=()=>overlay.remove();
 overlay.querySelector('.omen-close').addEventListener('click',()=>{if(kind==='gecko')onChoose(-1);else onChoose(false);close();});
 if(kind==='gecko')overlay.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.choice);close();onChoose(i);}));
 else overlay.querySelectorAll('[data-keep]').forEach(btn=>btn.addEventListener('click',()=>{const keep=btn.dataset.keep==='yes';close();onChoose(keep);}));
 overlay.addEventListener('click',e=>{if(e.target===overlay){close();if(kind==='gecko')onChoose(-1);else onChoose(false);}});
}
function showEffectCard(message,card){
 const draw={token:`effect-${Date.now()}-${Math.random()}`,playerId:mode==='online'?socket?.id:'human',playerName:currentPlayerName,card};
 showReveal(draw,false);$('revealTitle').textContent=message;$('revealActions').innerHTML='<p class="reveal-countdown">ผลของการ์ดทำงานแล้ว</p>';clearTimeout(revealTimer);revealTimer=setTimeout(()=>hide('drawReveal'),3500);
}

function draw(){
 if(mode==='online'){if(!onlineRoom||!socket?.connected)return toast('ยังไม่ได้เชื่อมต่อห้อง');socket.emit('draw-card',{room:onlineRoom});return;}
 if(!localGame)return toast('เริ่มเกมก่อน');localDraw(localGame.players[0]);
}
function escape(){
 if(mode==='online'){const me=onlineState?.players?.find(x=>x.id===socket?.id);if(!me||!onlineState||onlineState.over||onlineState.players[onlineState.turn]?.id!==socket?.id||onlineState.pending)return toast('ยังไม่ใช่เทิร์นของคุณ');if(playerKeyCount(me)<3)return toast(`กุญแจยังไม่ครบ (${playerKeyCount(me)}/3) ต้องสะสมให้ครบ 3 ดอกก่อนจึงจะออกได้`);socket?.emit('escape-room',{room:onlineRoom});return;}
 const g=localGame,p=g?.players[0];if(!p||!g||g.over||g.turn!==0||g.pending)return;if(playerKeyCount(p)<3)return toast(`กุญแจยังไม่ครบ (${playerKeyCount(p)}/3) ต้องสะสมให้ครบ 3 ดอกก่อนจึงจะออกได้`);localFinish(p,`${p.name} หนีออกจากบ้านผีไทยได้สำเร็จ!`);
}
function leaveGame(){
 if(!confirm('ยืนยันยอมแพ้และออกจากเกมหรือไม่?'))return;
 if(mode==='online'&&onlineRoom){
  const aliveCount=(onlineState?.players||[]).filter(p=>p.alive!==false).length;
  const leavingRoom=onlineRoom;
  // Leaving the room must always be possible. Only emit surrender when the game rules allow it.
  if(aliveCount>2) socket?.emit('surrender-game',{room:leavingRoom});
  hide('drawReveal');
  toast('กำลังออกจากห้อง…');
  setTimeout(()=>{
   socket?.emit('leave-room',{room:leavingRoom});
   hide('gameScreen');hide('gameOver');show('setupModal');
   localGame=null;onlineState=null;onlineRoom='';isHost=false;
   startAmbient();
  },250);
  return;
 }
 if(localGame&&!localGame.over){
  const p=localGame.players.find(x=>x.id==='human');
  if(p){p.alive=false;localFinish(null,`${p.name} ยอมแพ้และออกจากเกม`);}
 }
 hide('gameScreen');hide('drawReveal');hide('gameOver');show('setupModal');localGame=null;onlineState=null;onlineRoom='';isHost=false;startAmbient();
}
function enterOnlineGame(room){
 if($('gamePlayerName'))$('gamePlayerName').textContent=currentPlayerName;
 if(room)onlineRoom=room;
 mode='online';
 // Important: the lobby is a separate overlay. If it stays visible, the game
 // renders behind it (cards update, but guests appear stuck in the lobby).
 hide('roomLobby');
 closeSetup();
 hide('drawReveal');
 show('gameScreen');
 hide('gameOver');
 if($('roomTag'))$('roomTag').textContent=`ออนไลน์ • ${onlineRoom}`;
}
function requestOnlineState(){
 if(socket?.connected&&onlineRoom)socket.emit('request-online-state',{room:onlineRoom});
}
function bindSocket(){
 if(!socket||socket.__banpeeBound)return;socket.__banpeeBound=true;
 socket.on('game-started',data=>{
  if(!data?.room||data.room!==onlineRoom)return;
  enterOnlineGame(data.room);requestOnlineState();
 });
 socket.on('room-update',r=>{
  if(!onlineRoom||r.room!==onlineRoom)return;
  $('createdRoomCode').textContent=r.room;$('lobbyPlayers').innerHTML=(r.players||[]).map(p=>`${esc(p.name)} ${p.id===r.host?'👑':''}`).join('　•　')+`<br>${r.players.length}/5 คน`;
  $('startOnlineGame').disabled=!isHost||r.players.length<2;
  // The room update is also a fallback start signal in case a client misses game-started.
  if(r.started){enterOnlineGame(r.room);requestOnlineState();}
 });
 socket.on('online-state',s=>{
  onlineState=s;enterOnlineGame(s.room||onlineRoom);renderOnline();
 });
 socket.on('game-error',onlineError);
 socket.on('table-announcement',e=>{if(e?.message)announceTable(e.message,e.title||'เหตุการณ์ในบ้านผีไทย',e.kind||'ward');});
 socket.on('card-effect',e=>{if(!e)return;if(e.kind==='omen-choice'){showOmenChoice(e.choiceType,e.cards||[],choice=>{if(!onlineRoom||!socket?.connected)return;socket.emit('omen-choice',{room:onlineRoom,index:typeof choice==='number'?choice:0,keep:typeof choice==='boolean'?choice:false});});return;}if(e.kind==='reveal'&&e.card){showReveal({token:e.token||`effect-${Date.now()}`,playerId:socket?.id,playerName:currentPlayerName,card:e.card,ghost:true},true);return;}if(e.card)showEffectCard(e.message||'ผลการ์ด',e.card);else toast(e.message||'การ์ดทำงานแล้ว');});
 socket.on('connect',()=>{if(onlineRoom)requestOnlineState();});
 socket.on('disconnect',()=>toast('การเชื่อมต่อหลุด กำลังพยายามเชื่อมต่อใหม่…'));
}
async function loadCards(){
 try{const res=await fetch('/cards.json');if(!res.ok)throw new Error('failed');const data=await res.json();cards.push(...data);}
 catch(e){try{const data=await fetch('/cards.json').then(r=>r.json());cards.push(...data);}catch(_){toast('โหลดรายการการ์ดไม่ได้');}}
 renderCatalog();
}
function init(){
 loadCards();
 $('openSetup')?.addEventListener('click',openSetup);
 $('soundToggle')?.addEventListener('click',()=>{if(musicEnabled)stopAmbient();else startAmbient();});$('gameSoundToggle')?.addEventListener('click',()=>{if(musicEnabled)stopAmbient();else startAmbient();});
 document.addEventListener('pointerdown',e=>{if(e.target.closest('#soundToggle'))return;if($('gameScreen')?.classList.contains('hidden')&&!musicEnabled)startAmbient();});
 document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>hide(b.dataset.close)));
 document.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>document.getElementById(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
 $('nameBtn')?.addEventListener('click',()=>{const n=prompt('ชื่อผู้เล่น',currentPlayerName);if(n?.trim()){currentPlayerName=n.trim().slice(0,18);$('profileName').textContent=currentPlayerName;if($('gamePlayerName'))$('gamePlayerName').textContent=currentPlayerName;}});
 $('gameMenuHotspot')?.addEventListener('click',()=>{openSetup();});
 $('gameSettingsHotspot')?.addEventListener('click',()=>{const n=prompt('ชื่อผู้เล่น',currentPlayerName);if(n?.trim()){currentPlayerName=n.trim().slice(0,18);$('profileName').textContent=currentPlayerName;if($('gamePlayerName'))$('gamePlayerName').textContent=currentPlayerName;}});
 $('mode')?.addEventListener('change',setMode);
 $('startGame')?.addEventListener('click',()=>{if($('mode').value==='online'){toast('เลือกสร้างห้องหรือเข้าร่วมห้องด้านบนก่อน');return;}startBotGame();});
 $('createRoomBtn')?.addEventListener('click',createRoom);$('joinRoomBtn')?.addEventListener('click',joinRoom);$('startOnlineGame')?.addEventListener('click',startOnline);
 $('copyRoomCode')?.addEventListener('click',()=>{const code=$('createdRoomCode').textContent;navigator.clipboard?.writeText(code).then(()=>toast('คัดลอกรหัสห้องแล้ว')).catch(()=>toast(`รหัสห้อง: ${code}`));});
 $('drawCard')?.addEventListener('click',draw);$('tableDeck')?.addEventListener('click',draw);$('escapeBtn')?.addEventListener('click',escape);
 $('endTurn')?.addEventListener('click',()=>{if(mode==='bot'&&localGame&&localGame.turn===0&&localGame.phase==='afterdraw'&&!localGame.pending){if(localEndTimer)clearTimeout(localEndTimer);localEndTimer=null;localEndTimerKey='';localNext();}else if(mode==='online'&&onlineRoom&&onlineState?.players?.[onlineState.turn]?.id===socket?.id&&onlineState.phase==='afterdraw'){socket.emit('end-turn',{room:onlineRoom});}else toast('จบเทิร์นได้หลังจั่วการ์ดแล้ว');});
 $('leaveGame')?.addEventListener('click',leaveGame);$('playAgain')?.addEventListener('click',()=>{hide('gameOver');hide('gameScreen');openSetup();});
 $('cardSearch')?.addEventListener('input',renderCatalog);$('cardFilter')?.addEventListener('change',renderCatalog);
 $('setupModal')?.addEventListener('click',e=>{if(e.target.id==='setupModal')closeSetup();});
 $('drawReveal')?.addEventListener('click',e=>{if(e.target.classList.contains('reveal-backdrop')){if(!localGame?.pending&&!onlineState?.pending)hide('drawReveal');}});
 if(window.io){socket=io({reconnection:true,reconnectionAttempts:8,reconnectionDelay:500,timeout:20000});bindSocket();}
 setMode();
}
document.addEventListener('DOMContentLoaded',init);
})();