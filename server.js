const express=require('express');
const http=require('http');
const path=require('path');
const {Server}=require('socket.io');
const fs=require('fs');
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:false}});
const PORT=process.env.PORT||3000;
const cards=require('./public/cards.json');
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(req,res)=>res.json({ok:true,game:'บ้านผีไทย'}));
const rooms=new Map();
const cardById=id=>cards.find(c=>c.id===id);
const clone=x=>JSON.parse(JSON.stringify(x));
function roomCode(){let c;do{c=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(c));return c}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function log(g,s){g.logs.unshift(s);g.logs=g.logs.slice(0,24)}
function alive(g){return g.players.filter(p=>p.alive)}
function keyCount(p){return (p.keys||0)+(p.hand||[]).filter(c=>c.id==='key').length}
function uniquePlayerName(proposed,players,excludeId=null){
 const base=String(proposed||'นักสำรวจ').trim().slice(0,18)||'นักสำรวจ';
 const used=new Set((players||[]).filter(p=>p.id!==excludeId).map(p=>String(p.name||'').trim().toLocaleLowerCase('th-TH')));
 if(!used.has(base.toLocaleLowerCase('th-TH')))return base;
 for(let n=2;n<100;n++){const suffix=` ${n}`,candidate=base.slice(0,Math.max(1,18-suffix.length))+suffix;if(!used.has(candidate.toLocaleLowerCase('th-TH')))return candidate;}
 return `ผู้เล่น-${Math.random().toString(36).slice(2,6)}`;
}

function publicRoom(r){return {room:r.code,host:r.host,started:r.started,players:r.players.map(p=>({id:p.id,name:p.name,hearts:p.hearts||3,keys:keyCount(p),alive:p.alive!==false,connected:true}))}}
function emitRoom(r){io.to(r.code).emit('room-update',publicRoom(r))}
function requestPlayerState(r,socket){
 if(!r||!r.started||!r.game)return false;
 const player=r.players.find(p=>p.id===socket.id);
 if(!player)return false;
 socket.join(r.code);
 socket.emit('online-state',privateState(r,player));
 return true;
}
function privateState(r,p){
 const g=r.game;if(!g)return null;
 return {room:r.code,host:r.host,players:g.players.map(x=>({id:x.id,name:x.name,hearts:x.hearts,keys:keyCount(x),keyCountTotal:true,storedKeys:x.keys||0,alive:x.alive,handCount:x.hand.length,hand:x.id===p.id?x.hand:undefined})),turn:g.turn,round:g.round,deckCount:g.deck.length,discard:g.discard.slice(-1)[0]||null,logs:g.logs,over:g.over,winner:g.winner,pending:g.pending?{playerId:g.pending.playerId,card:g.pending.card}:null,pendingChoice:g.pendingChoice?.playerId===p.id?{type:g.pendingChoice.type}:null,lastDraw:g.lastDraw,phase:g.phase||'draw',turnStartedAt:g.turnStartedAt||Date.now(),afterDrawStartedAt:g.afterDrawStartedAt||null};
}
function emitStates(r){for(const p of r.players){const s=io.sockets.sockets.get(p.id);if(s)s.emit('online-state',privateState(r,p))}}
function nextTurn(r){
 const g=r.game;if(!g||g.over)return;
 let found=false;
 for(let n=0;n<g.players.length;n++){
  const direction=g.direction||1;
  g.turn=(g.turn+direction+g.players.length)%g.players.length;
  const p=g.players[g.turn];
  if(!p.alive)continue;
  if(p.skip){p.skip=false;log(g,`${p.name} ถูกข้ามเทิร์น`);continue}
  found=true;break;
 }
 if(!found){finish(r,null,'ไม่มีผู้เล่นเหลือรอด');return}
 if((g.direction||1)===1?g.turn===0:g.turn===g.players.length-1)g.round++;
 g.phase='transition';g.afterDrawStartedAt=null;g.turnStartedAt=Date.now();g.turnToken=(g.turnToken||0)+1;
 const transitionToken=g.turnToken;
 emitStates(r);
 setTimeout(()=>{const current=r.game;if(!current||current!==g||g.over||g.turnToken!==transitionToken||g.phase!=='transition')return;g.phase='draw';g.turnStartedAt=Date.now();emitStates(r);scheduleTurnAutoDraw(r);},500);
}
function scheduleTurnAutoDraw(r){
 const g=r?.game;if(!g||g.over||g.pending)return;
 if(r.turnTimer){clearTimeout(r.turnTimer);r.turnTimer=null;}
 // Only drawing has a timeout. After drawing, the active player must press End Round.
 const phase=g.phase||'draw';
 if(phase!=='draw')return;
 const token=g.turnToken||0;
 r.turnTimer=setTimeout(()=>{
  const current=r.game;
  if(!current||current.over||current.pending||(current.turnToken||0)!==token||current.phase!=='draw')return;
  const p=current.players[current.turn];if(!p||!p.alive){nextTurn(r);return;}
  log(current,`${p.name} ไม่จั่วภายใน 10 วินาที ระบบจั่วให้อัตโนมัติ`);
  drawCard(r,p);
 },10000);
}

function finish(r,winnerId,message){
 const g=r.game;if(!g)return;if(r.turnTimer)clearTimeout(r.turnTimer);g.over=true;g.winner=winnerId;g.pending=null;log(g,message||'จบเกมแล้ว');emitStates(r);
}
function eliminate(r,p){
 const g=r.game;p.alive=false;
 log(g,`${p.name} หัวใจหมดแล้ว แพ้ออกจากเกม`);
 const living=alive(g);
 if(living.length<=1){finish(r,living[0]?.id||null,living.length?`${living[0].name} เป็นผู้รอดชีวิตคนสุดท้าย!`:'ผู้เล่นทุกคนแพ้');return;}
 if(g.players[g.turn]?.id===p.id){
  if(r.turnTimer){clearTimeout(r.turnTimer);r.turnTimer=null;}
  // Defer until the current card-resolution handler finishes updating state.
  setTimeout(()=>{if(r.game===g&&!g.over&&g.players[g.turn]?.id===p.id&&!p.alive)nextTurn(r);},0);
 }
}
function hurt(r,p,reason){
 p.hearts=Math.max(0,p.hearts-1);log(r.game,`${p.name} ${reason||'ถูกผีหลอก'} เสียหัวใจ 1 ดวง (เหลือ ${p.hearts})`);
 if(p.hearts===0)eliminate(r,p);
}
function makeDeck(){
 const d=[];for(const c of cards){if(c.copies>0){for(let i=0;i<c.copies;i++)d.push({...clone(c),uid:`${c.id}-${Math.random().toString(36).slice(2,9)}`})}}
 return shuffle(d);
}
function startGame(r){
 const g={players:r.players.map(p=>({id:p.id,name:p.name,hearts:3,keys:0,shields:0,hand:[],alive:true,skip:false})),deck:makeDeck(),discard:[],turn:0,round:1,logs:['ทุกคนเริ่มด้วยหัวใจ 3 ใบเท่านั้น','ถึงตาคุณแล้วต้องจั่ว 1 ใบ เว้นแต่ใช้การ์ดข้ามการจั่ว'],over:false,winner:null,pending:null,lastDraw:null,phase:'draw',turnStartedAt:Date.now(),afterDrawStartedAt:null,turnToken:1};
 r.game=g;r.started=true;log(g,'เจ้าของห้องเริ่มการผจญภัยแล้ว');
 // Tell every connected client in the Socket.IO room to leave the lobby, then send each player their private state.
 emitRoom(r);io.to(r.code).emit('game-started',{room:r.code});emitStates(r);scheduleTurnAutoDraw(r);
}
function findPlayer(r,id){return r?.game?.players.find(p=>p.id===id)}
function isTurn(r,p){return r?.game&&!r.game.over&&!r.game.pending&&r.game.players[r.game.turn]?.id===p?.id&&p?.alive}

function drawRespectingCatLimit(g,p){
 if(!g?.deck?.length)return null;
 if((p.hand||[]).some(c=>c?.id==='cat')){
  for(let i=g.deck.length-1;i>=0;i--){
   if(g.deck[i]?.id!=='cat')return g.deck.splice(i,1)[0];
  }
  if(g.discard?.some(c=>c?.id!=='cat')){
   const eligible=g.discard.filter(c=>c?.id!=='cat');
   g.discard=g.discard.filter(c=>c?.id==='cat');
   g.deck.push(...shuffle(eligible));
   for(let i=g.deck.length-1;i>=0;i--)if(g.deck[i]?.id!=='cat')return g.deck.splice(i,1)[0];
  }
  return null;
 }
 return g.deck.pop();
}

function drawCard(r,p){
 const g=r.game;if(!isTurn(r,p)||(g.phase||'draw')!=='draw')return;
 if(r.turnTimer)clearTimeout(r.turnTimer);
 if(!g.deck.length&&g.discard.length){g.deck=shuffle(g.discard.splice(0));log(g,'สับกองทิ้งกลับมาเป็นกองจั่วใหม่')}
 if(!g.deck.length){log(g,'กองการ์ดหมดแล้ว');nextTurn(r);return}
 const c=drawRespectingCatLimit(g,p);if(!c){log(g,`${p.name} มีการ์ดแมวอยู่แล้ว จึงยังจั่วแมวเพิ่มไม่ได้`);emitStates(r);scheduleTurnAutoDraw(r);return;}const ghost=c.kind==='ghost'||c.type==='ผีอันตราย';
 g.lastDraw={token:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,playerId:p.id,playerName:p.name,card:{id:c.id,name:c.name,type:c.type,desc:c.desc,effect:c.effect,image:c.image,fullArt:!!c.fullArt,instantDanger:!!c.instantDanger},ghost};
 log(g,`${p.name} จั่วได้ “${c.name}”`);
 if(c.instantDanger){
  g.discard.push(c);hurt(r,p,`จั่วได้ ${c.name} ซึ่งเป็นผีอันตราย ป้องกันไม่ได้`);
  if(!g.over){g.phase='afterdraw';g.afterDrawStartedAt=Date.now();g.turnToken=(g.turnToken||0)+1;emitStates(r);scheduleTurnAutoDraw(r);}else emitStates(r);return;
 }
 // น้ำมนต์ทำงานทันทีเมื่อจั่วได้และหัวใจยังไม่เต็ม: ใช้การ์ด ฟื้น 1 หัวใจ 
 if(c.id==='holy-water' && !ghost && (p.hearts||0)<3){
  p.hearts=Math.min(3,(p.hearts||0)+1);
  
  g.discard.push(c);
  log(g,`${p.name} จั่วได้น้ำมนต์ ใช้อัตโนมัติ ฟื้นหัวใจเป็น ${p.hearts}/3 และ`);
  g.phase='afterdraw';g.afterDrawStartedAt=Date.now();g.turnToken=(g.turnToken||0)+1;emitStates(r);scheduleTurnAutoDraw(r);return;
 }
 // ดอกบัวนำโชคทำงานทันทีเมื่อจั่ว: ฟื้นหัวใจหากยังไม่เต็ม หรือเก็บไว้ป้องกันผีเมื่อหัวใจเต็ม
 if(c.id==='lucky-flower' && !ghost){
  if((p.hearts||0)<3){
   p.hearts=Math.min(3,(p.hearts||0)+1);
   
   g.discard.push(c);
   log(g,`${p.name} จั่วได้ดอกบัวนำโชค ฟื้นหัวใจ 1 ดวง`);
  }else{
   p.hand.push(c);
   log(g,`${p.name} หัวใจเต็ม จึงเก็บดอกบัวนำโชคไว้ป้องกันผี`);
  }
  g.phase='afterdraw';g.afterDrawStartedAt=Date.now();g.turnToken=(g.turnToken||0)+1;emitStates(r);scheduleTurnAutoDraw(r);return;
 }
 if(c.id==='kumarn'){p.skip=true;g.discard.push(c);log(g,`${p.name} จั่วได้กุมารชวนไปเล่น จึงอดเล่นรอบถัดไปทันที`);g.phase='afterdraw';g.afterDrawStartedAt=Date.now();g.turnToken=(g.turnToken||0)+1;emitStates(r);scheduleTurnAutoDraw(r);return;}
 if(ghost){g.pending={playerId:p.id,card:c};g.phase='resolve';g.turnToken=(g.turnToken||0)+1;}
 else {
  p.hand.push(c);
  if(keyCount(p)>=3){finish(r,p.id,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);return}
  g.phase='afterdraw';g.afterDrawStartedAt=Date.now();g.turnToken=(g.turnToken||0)+1;emitStates(r);scheduleTurnAutoDraw(r);return
 }
 emitStates(r);
}
io.on('connection',socket=>{
 socket.on('create-room',({name}={},cb=()=>{})=>{
  const code=roomCode(),player={id:socket.id,name:uniquePlayerName(name,[]),hearts:3,keys:0,alive:true};
  const r={code,host:socket.id,players:[player],started:false,game:null,turnTimer:null};rooms.set(code,r);socket.join(code);cb({ok:true,room:code,players:publicRoom(r).players});emitRoom(r);
 });
 socket.on('join-room',({room,name}={},cb=()=>{})=>{
  const code=String(room||'').toUpperCase().trim(),r=rooms.get(code);
  if(!r)return cb({ok:false,error:'ไม่พบห้องนี้ ตรวจสอบรหัสอีกครั้ง'});
  if(r.started)return cb({ok:false,error:'เกมเริ่มแล้ว ไม่สามารถเข้าร่วมกลางเกมได้'});
  if(r.players.length>=5)return cb({ok:false,error:'ห้องเต็มแล้ว (สูงสุด 5 คน)'});
  if(r.players.some(p=>p.id===socket.id))return cb({ok:true,room:code});
  r.players.push({id:socket.id,name:uniquePlayerName(name,r.players),hearts:3,keys:0,alive:true});socket.join(code);cb({ok:true,room:code});emitRoom(r);
 });
 socket.on('request-online-state',({room}={},cb=()=>{})=>{
  const r=rooms.get(String(room||'').toUpperCase());
  const ok=requestPlayerState(r,socket);
  if(typeof cb==='function')cb({ok,error:ok?undefined:'ยังไม่พบสถานะเกมของห้องนี้'});
 });
 socket.on('start-room',({room}={},cb=()=>{})=>{
  const r=rooms.get(String(room||'').toUpperCase());if(!r||r.host!==socket.id)return cb({ok:false,error:'เฉพาะเจ้าของห้องเริ่มเกมได้'});
  if(r.players.length<2)return cb({ok:false,error:'ต้องมีผู้เล่นอย่างน้อย 2 คน'});
  if(r.started)return cb({ok:false,error:'เกมเริ่มไปแล้ว'});
  startGame(r);cb({ok:true});
 });
 socket.on('draw-card',({room}={})=>{const r=rooms.get(String(room||'').toUpperCase()),p=findPlayer(r,socket.id);if(r&&p)drawCard(r,p)});
 socket.on('resolve-ghost',({room,useProtection}={})=>{
  const r=rooms.get(String(room||'').toUpperCase()),g=r?.game,p=findPlayer(r,socket.id);
  if(!g||!p||!g.pending||g.pending.playerId!==p.id||g.over)return;
  const c=g.pending.card;g.discard.push(c);
  if(useProtection){
   if((p.shields||0)>0){p.shields--;const msg=`${p.name} ใช้เครื่องรางที่เตรียมไว้ ป้องกัน ${c.name} ได้สำเร็จ`;log(g,msg);io.to(r.code).emit('table-announcement',{title:'ใช้การ์ดป้องกัน',message:msg,kind:'ward'});}
   else {const i=p.hand.findIndex(x=>['protection','blessed-rice','lucky-flower','holy-water'].includes(x.id));if(i>=0){const ward=p.hand.splice(i,1)[0];g.discard.push(ward);const msg=`${p.name} ใช้การ์ด “${ward.name}” ป้องกัน ${c.name} ได้สำเร็จ`;log(g,msg);io.to(r.code).emit('table-announcement',{title:'ใช้การ์ดป้องกัน',message:msg,kind:'ward'});}else{hurt(r,p,`ถูก ${c.name} หลอก`);const msg=`${p.name} ไม่มีการ์ดป้องกัน เสียหัวใจ 1 ดวง`;log(g,msg);io.to(r.code).emit('table-announcement',{title:'ผีหลอกสำเร็จ',message:msg,kind:'danger'});}}
  } else {hurt(r,p,`ถูก ${c.name} หลอก`);const msg=`${p.name} ยอมรับผีหลอก เสียหัวใจ 1 ดวง`;log(g,msg);io.to(r.code).emit('table-announcement',{title:'ผีหลอกสำเร็จ',message:msg,kind:'danger'});}
  g.pending=null;
  if(!g.over){
   g.phase='afterdraw';g.afterDrawStartedAt=Date.now();g.turnToken=(g.turnToken||0)+1;
   emitStates(r);scheduleTurnAutoDraw(r);
  }else emitStates(r);
 });
 socket.on('skip-draw',({room}={})=>{
  const r=rooms.get(String(room||'').toUpperCase()),p=findPlayer(r,socket.id);if(!r||!p||!isTurn(r,p)||(r.game.phase||'draw')!=='draw')return;
  const i=p.hand.findIndex(c=>c.id==='skip-next');if(i<0){socket.emit('game-error','คุณไม่มีการ์ดข้ามการจั่ว');return}
  r.game.discard.push(p.hand.splice(i,1)[0]);log(r.game,`${p.name} ใช้การ์ดข้ามการจั่ว`);nextTurn(r);
 });
 socket.on('play-card',({room,index,targetId}={})=>{
  const r=rooms.get(String(room||'').toUpperCase()),g=r?.game,p=findPlayer(r,socket.id);
  if(!r||!p||!isTurn(r,p))return;
  const phase=g.phase||'draw';if(phase!=='afterdraw'&&!(phase==='draw'&&['gecko','owl','skip-next'].includes(p.hand[index]?.id)))return;
  const c=p.hand[index];if(!c)return;
  if(phase==='afterdraw'&&c.id==='skip-next'){socket.emit('game-error','การ์ดข้ามการจั่วใช้ได้ก่อนจั่วเท่านั้น');return;}
  if(['protection','lucky-flower'].includes(c.id)){socket.emit('game-error',c.id==='lucky-flower'?'ดอกบัวนำโชคทำงานอัตโนมัติเมื่อจั่ว หรือเก็บไว้ป้องกันผีเมื่อหัวใจเต็ม':'เก็บเครื่องรางไว้ใช้ตอนเจอผี');return}
  const otherPlayers=()=>g.players.filter(x=>x.alive&&x.id!==p.id);
  const target=()=>g.players.find(x=>x.id===targetId&&x.alive&&x.id!==p.id);
  if(['skip','ban','cat','eye','ghost-visit','ghost-disguise','friend-holy-water'].includes(c.id)&&!targetId){socket.emit('game-error','เลือกผู้เล่นเป้าหมายก่อนใช้การ์ด');return}
  if(c.id==='friend-holy-water'&&!(target()?.hearts<3)){socket.emit('game-error','เลือกเพื่อนที่หัวใจยังไม่เต็ม');return}
  if(c.id==='cat'&&!(target()?.keys>0||(target()?.hand||[]).some(x=>x.id==='key'))){socket.emit('game-error','ผู้เล่นที่เลือกไม่มีกุญแจให้ขโมย');return}
  p.hand.splice(index,1);g.discard.push(c);
  const effect=(message,card=null)=>socket.emit('card-effect',{kind:card?'show-card':'message',message,card,token:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`});
  if(phase==='draw'&&['gecko','owl'].includes(c.id)){
   if(!g.deck.length&&g.discard.length)g.deck=shuffle(g.discard.splice(0));
   if(c.id==='gecko'){
    if(g.deck.length<2&&g.discard.length)g.deck=shuffle(g.deck.concat(g.discard.splice(0)));
    if(g.deck.length){const a=g.deck.pop(),b=g.deck.length?g.deck.pop():null;g.pendingChoice={playerId:p.id,type:'gecko',cards:[a,b].filter(Boolean)};g.turnToken=(g.turnToken||0)+1;if(r.turnTimer)clearTimeout(r.turnTimer);emitStates(r);socket.emit('card-effect',{kind:'omen-choice',choiceType:'gecko',message:'เลือกไพ่ 1 ใบจาก 2 ใบ',cards:g.pendingChoice.cards});return;}
    effect('กองจั่วว่าง ไม่มีไพ่ให้ตรวจดู');
   }else{
    const top=g.deck[g.deck.length-1];if(top){g.pendingChoice={playerId:p.id,type:'owl',cards:[top]};g.turnToken=(g.turnToken||0)+1;if(r.turnTimer)clearTimeout(r.turnTimer);emitStates(r);socket.emit('card-effect',{kind:'omen-choice',choiceType:'owl',message:'จะเก็บไพ่ใบบนสุดเข้ามือหรือไม่',cards:[top]});return;}
    effect('กองจั่วว่าง ไม่มีไพ่ให้ตรวจดู');
   }
   log(g,`${p.name} ใช้การ์ดลางบอกเหตุแล้ว จบเทิร์นอัตโนมัติ`);nextTurn(r);return;
  }
  if(c.id==='skip-next'){
   const t=otherPlayers()[0];if(t){t.skip=true;log(g,`${p.name} ใช้ ${c.name} ทำให้ ${t.name} ถูกข้ามเทิร์น`)}else log(g,`${p.name} ใช้ ${c.name}`);
  }else if(c.id==='key'){
   p.keys=(p.keys||0)+1;log(g,`${p.name} ใช้กุญแจ ได้กุญแจสะสม ${keyCount(p)}/3`);
  }else if(c.id==='holy-water'){
   if((p.hearts||0)<3){p.hearts=Math.min(3,p.hearts+1);log(g,`${p.name} ใช้ ${c.name} ฟื้นหัวใจเป็น ${p.hearts}/3 `)}else{p.shields=(p.shields||0)+1;log(g,`${p.name} หัวใจเต็ม จึงเปลี่ยนน้ำมนต์เป็นเครื่องรางป้องกัน 1 ครั้ง`)}
  }else if(c.id==='friend-holy-water'){
   const t=target();if(t&&(t.hearts||0)<3){t.hearts=Math.min(3,(t.hearts||0)+1);log(g,`${p.name} พรมน้ำมนต์ให้ ${t.name} ฟื้นหัวใจเป็น ${t.hearts}/3 `);effect(`${t.name} ได้รับหัวใจเพิ่ม 1 ดวง (${t.hearts}/3)`);}else{log(g,`${t?.name||'เพื่อน'} มีหัวใจเต็มแล้ว น้ำมนต์จึงไม่เพิ่มหัวใจ`);effect('ผู้เล่นเป้าหมายมีหัวใจเต็มแล้ว');}
  }else if(['blessed-rice'].includes(c.id)){
   p.shields=(p.shields||0)+1;log(g,`${p.name} เตรียม ${c.name} เป็นเครื่องรางป้องกันผี 1 ครั้ง (มี ${p.shields} ชั้น)`);
  }else if(c.id==='reverse'){
   g.direction=(g.direction||1)*-1;log(g,`${p.name} ใช้ ${c.name} กลับทิศทางการเล่น`);
  }else if(['skip','ban'].includes(c.id)){
   const t=target();if(t){t.skip=true;log(g,`${p.name} ใช้ ${c.name} ทำให้ ${t.name} อดเล่นรอบถัดไป`)}
  }else if(c.id==='vase'){
   const n=g.players.length;let t=null;for(let step=1;step<n;step++){const q=g.players[(g.turn+step)%n];if(q.alive){t=q;break;}}if(t){t.skip=true;log(g,`${p.name} ใช้ ${c.name} ทำให้ผู้เล่นคนถัดไป ${t.name} อดเล่น`)}
  }else if(c.id==='ghost-disguise'){
   const t=target();if(t){hurt(r,t,`ถูก ${p.name} ปลอมเป็นผีแกล้ง`);const msg=`${p.name} ใช้ปลอมเป็นผีใส่ ${t.name} ทำให้เสียหัวใจ 1 ดวงทันที ป้องกันไม่ได้`;log(g,msg);effect(msg);io.to(r.code).emit('table-announcement',{title:'ปลอมเป็นผี',message:msg,kind:'danger'});}
  }else if(c.id==='cat'){
   const t=target();let stolen=null;
   const hi=(t.hand||[]).findIndex(x=>x.id==='key');
   if(hi>=0){stolen=t.hand.splice(hi,1)[0];p.hand.push(stolen)}else if((t.keys||0)>0){t.keys--;p.keys=(p.keys||0)+1;stolen={name:'กุญแจเรือนไทย',id:'key'}}
   if(stolen){if(keyCount(p)>=3){log(g,`${p.name} ขโมยกุญแจจาก ${t.name} จนครบ 3 ดอก และชนะทันที!`);finish(r,p.id,`${p.name} ขโมยกุญแจครบ 3 ดอก หนีออกจากบ้านผีไทยได้สำเร็จ!`);effect(`ขโมยกุญแจจาก ${t.name} สำเร็จ! คุณมีกุญแจครบ ${keyCount(p)}/3 และชนะแล้ว!`,stolen);return;}log(g,`${p.name} ขโมยกุญแจจาก ${t.name} สำเร็จ! ตอนนี้คุณมีกุญแจ ${keyCount(p)}/3 และ ${t.name} เหลือ ${keyCount(t)}/3`);effect(`ขโมยกุญแจจาก ${t.name} สำเร็จ! คุณมีกุญแจ ${keyCount(p)}/3 • ${t.name} เหลือ ${keyCount(t)}/3`,stolen)}
   else {log(g,`${t.name} ไม่มีกุญแจให้ขโมย`);effect(`${t.name} ไม่มีกุญแจให้ขโมย`)}
  }else if(c.id==='gecko'){
   if(g.deck.length<2&&g.discard.length)g.deck=shuffle(g.deck.concat(g.discard.splice(0)));
   if(g.deck.length){const a=g.deck.pop(),b=g.deck.length?g.deck.pop():null;g.pendingChoice={playerId:p.id,type:'gecko',cards:[a,b].filter(Boolean)};g.turnToken=(g.turnToken||0)+1;if(r.turnTimer)clearTimeout(r.turnTimer);emitStates(r);socket.emit('card-effect',{kind:'omen-choice',choiceType:'gecko',message:'เลือกไพ่ 1 ใบจาก 2 ใบ',cards:g.pendingChoice.cards});return;}else log(g,`${p.name} ใช้ ${c.name} แต่กองจั่วว่าง`);
  }else if(c.id==='owl'){
   if(!g.deck.length&&g.discard.length)g.deck=shuffle(g.discard.splice(0));
   const top=g.deck[g.deck.length-1];if(top){g.pendingChoice={playerId:p.id,type:'owl',cards:[top]};g.turnToken=(g.turnToken||0)+1;if(r.turnTimer)clearTimeout(r.turnTimer);emitStates(r);socket.emit('card-effect',{kind:'omen-choice',choiceType:'owl',message:'จะเก็บไพ่ใบบนสุดเข้ามือหรือไม่',cards:[top]});return;}else log(g,`${p.name} ใช้ ${c.name} แต่กองจั่วว่าง`);
  }else if(c.id==='ghost-visit'){
   const t=target();if(t){
    if((t.shields||0)>0){t.shields--;const msg=`${t.name} ใช้เครื่องรางที่เตรียมไว้ ป้องกันผีที่ ${p.name} ส่งมาได้สำเร็จ`;log(g,msg);effect(msg);io.to(r.code).emit('table-announcement',{title:'เพื่อนใช้การ์ดป้องกัน',message:msg,kind:'ward'});}
    else {const pi=(t.hand||[]).findIndex(x=>['protection','blessed-rice','lucky-flower','holy-water'].includes(x.id));if(pi>=0){const prot=t.hand.splice(pi,1)[0];g.discard.push(prot);const msg=`${t.name} ใช้การ์ด “${prot.name}” ป้องกันผีที่ ${p.name} ส่งมาได้สำเร็จ`;log(g,msg);effect(msg,prot);io.to(r.code).emit('table-announcement',{title:'เพื่อนใช้การ์ดป้องกัน',message:msg,kind:'ward'});}else{hurt(r,t,`ถูกผีที่ ${p.name} ส่งมาเยี่ยม`);const msg=`${t.name} ไม่มีการ์ดป้องกัน ถูกผีที่ ${p.name} ส่งมาเยี่ยม เสียหัวใจ 1 ดวง`;log(g,msg);effect(msg);io.to(r.code).emit('table-announcement',{title:'ผีหลอกเพื่อนสำเร็จ',message:msg,kind:'danger'});}}
   }
  }else if(c.id==='eye'){
   const t=target();
   if(t?.hand?.length){g.pendingChoice={playerId:p.id,type:'eye',targetPlayerId:t.id,targetName:t.name,cards:t.hand.map(x=>({...x}))};g.turnToken=(g.turnToken||0)+1;if(r.turnTimer)clearTimeout(r.turnTimer);emitStates(r);socket.emit('card-effect',{kind:'omen-choice',choiceType:'eye',message:`เลือกการ์ด 1 ใบจากมือ ${t.name} เพื่อขโมย`,cards:g.pendingChoice.cards});return;}
   else {log(g,`${t?.name||'ผู้เล่น'} ไม่มีไพ่ในมือให้เลือก`);effect(`${t?.name||'ผู้เล่น'} ไม่มีไพ่ในมือให้เลือก`)}
  }else if(c.id==='lantern'){
   if(!g.deck.length&&g.discard.length)g.deck=shuffle(g.discard.splice(0));const extra=g.deck.pop();if(extra){const ghost=extra.kind==='ghost'||extra.type==='ผีอันตราย';g.lastDraw={token:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,playerId:p.id,playerName:p.name,card:extra,ghost};log(g,`${p.name} ใช้ ${c.name} จั่วเพิ่มได้ “${extra.name}”`);if(extra.instantDanger){g.discard.push(extra);hurt(r,p,`จั่วเพิ่มได้ ${extra.name} ซึ่งเป็นผีอันตราย ป้องกันไม่ได้`);if(!g.over){g.phase='afterdraw';g.turnToken=(g.turnToken||0)+1;emitStates(r);scheduleTurnAutoDraw(r);}else emitStates(r);socket.emit('card-effect',{kind:'reveal',message:'โคมลอยนำทางเปิดเจอผีอันตราย!',card:extra,token:g.lastDraw.token});return;}if(ghost){g.pending={playerId:p.id,card:extra};g.phase='resolve';g.turnToken=(g.turnToken||0)+1;emitStates(r);socket.emit('card-effect',{kind:'reveal',message:'โคมลอยนำทางทำให้จั่วเพิ่ม แต่พบผี!',card:extra,token:g.lastDraw.token});return;}if(extra.id==='holy-water'&&(p.hearts||0)<3){p.hearts=Math.min(3,(p.hearts||0)+1);g.discard.push(extra);log(g,`${p.name} ใช้โคมลอยจั่วได้น้ำมนต์ ใช้อัตโนมัติ ฟื้นหัวใจเป็น ${p.hearts}/3`);effect(`น้ำมนต์ทำงานอัตโนมัติ ฟื้นหัวใจเป็น ${p.hearts}/3`,cardById('heart'));}else if(extra.id==='lucky-flower'&&(p.hearts||0)<3){p.hearts=Math.min(3,(p.hearts||0)+1);g.discard.push(extra);log(g,`${p.name} ใช้โคมลอยจั่วได้ดอกบัว ฟื้นหัวใจเป็น ${p.hearts}/3`);effect(`ดอกบัวทำงานอัตโนมัติ ฟื้นหัวใจเป็น ${p.hearts}/3`,cardById('heart'));}else{p.hand.push(extra);effect(`โคมลอยนำทาง: จั่วเพิ่มและเก็บ “${extra.name}” เข้ามือ`,extra)}}else{log(g,`${p.name} ใช้ ${c.name} แต่กองจั่วว่าง`)}
  }else{
   log(g,`${p.name} ใช้ ${c.name}`);effect(`ใช้ ${c.name} แล้ว`)
  }
  if(p.hearts<=0)eliminate(r,p);
  if(!g.over&&keyCount(p)>=3){finish(r,p.id,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);return;}
  if(!g.over){log(g,`${p.name} ใช้การ์ดแล้ว จบเทิร์นอัตโนมัติ`);g.phase='resolving';g.turnToken=(g.turnToken||0)+1;if(r.turnTimer)clearTimeout(r.turnTimer);emitStates(r);const resolvingToken=g.turnToken;setTimeout(()=>{const current=r.game;if(current===g&&!g.over&&current.phase==='resolving'&&current.turnToken===resolvingToken&&current.players[current.turn]?.id===p.id)nextTurn(r)},1800);}else emitStates(r);
 });

 socket.on('omen-choice',({room,index,keep}={})=>{
  const r=rooms.get(String(room||'').toUpperCase()),g=r?.game,p=findPlayer(r,socket.id),choice=g?.pendingChoice;
  if(!r||!g||!p||!choice||choice.playerId!==p.id||!isTurn(r,p))return;
  g.pendingChoice=null;
  if(choice.type==='gecko'){
   const chosen=choice.cards[Number(index)],other=choice.cards.filter((_,i)=>i!==Number(index));
   if(other.length)g.deck.push(...other);
   if(!chosen){log(g,`${p.name} ยกเลิกการเลือกไพ่จิ้งจกทัก`);}
   else if(chosen.instantDanger){
    g.discard.push(chosen);hurt(r,p,`จิ้งจกทักเปิดเจอ ${chosen.name} ซึ่งป้องกันไม่ได้`);log(g,`${p.name} เปิดเจอผีอันตราย ${chosen.name} จากจิ้งจกทัก`);
    socket.emit('card-effect',{kind:'reveal',message:'จิ้งจกทักเปิดเจอผีอันตราย!',card:chosen,token:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`});
   }else if(chosen.kind==='ghost'||chosen.type==='ผีอันตราย'){
    g.pending={playerId:p.id,card:chosen};g.phase='resolve';g.turnToken=(g.turnToken||0)+1;
    log(g,`${p.name} เลือก “${chosen.name}” จากจิ้งจกทัก แต่พบผี!`);
    emitStates(r);socket.emit('card-effect',{kind:'reveal',message:'จิ้งจกทักเลือกได้ไพ่ผี!',card:chosen,token:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`});return;
   }else if(['holy-water','lucky-flower'].includes(chosen.id)&&(p.hearts||0)<3){p.hearts=Math.min(3,(p.hearts||0)+1);g.discard.push(chosen);log(g,`${p.name} เลือกได้ ${chosen.name} จากจิ้งจกทัก ใช้อัตโนมัติ ฟื้นหัวใจเป็น ${p.hearts}/3`);socket.emit('card-effect',{kind:'show-card',message:`${chosen.name} ทำงานอัตโนมัติ ฟื้นหัวใจเป็น ${p.hearts}/3`,card:chosen});}else{p.hand.push(chosen);log(g,`${p.name} ใช้จิ้งจกทักและเก็บ “${chosen.name}” เข้ามือ`);socket.emit('card-effect',{kind:'show-card',message:`จิ้งจกทัก: เก็บ “${chosen.name}” เข้ามือ`,card:chosen});}
  }else if(choice.type==='eye'){
   const chosen=choice.cards[Number(index)],targetPlayer=g.players.find(x=>x.id===choice.targetPlayerId);
   const at=targetPlayer?.hand?.findIndex(x=>x.uid&&x.uid===chosen?.uid) ?? -1;
   if(targetPlayer&&chosen&&at>=0){const [stolen]=targetPlayer.hand.splice(at,1);p.hand.push(stolen);log(g,`${p.name} ใช้มองผ่านกระจกและขโมย ${stolen.name} จาก ${targetPlayer.name}`);effect(`ขโมย ${stolen.name} จาก ${targetPlayer.name} สำเร็จ`,stolen);}
   else log(g,'การ์ดที่เลือกไม่อยู่ในมือผู้เล่นแล้ว');
  }else if(choice.type==='owl'){
   const top=choice.cards[0];
   if(keep&&top&&g.deck.length&&g.deck[g.deck.length-1].uid===top.uid){const got=g.deck.pop();if(['holy-water','lucky-flower'].includes(got.id)&&(p.hearts||0)<3){p.hearts=Math.min(3,(p.hearts||0)+1);g.discard.push(got);log(g,`${p.name} ใช้เสียงนกเลือกได้ ${got.name} ใช้อัตโนมัติ ฟื้นหัวใจเป็น ${p.hearts}/3`);socket.emit('card-effect',{kind:'show-card',message:`${got.name} ทำงานอัตโนมัติ ฟื้นหัวใจเป็น ${p.hearts}/3`,card:got});}else{p.hand.push(got);log(g,`${p.name} ใช้เสียงนกและเก็บ “${got.name}” เข้ามือ`);socket.emit('card-effect',{kind:'show-card',message:`เสียงนก: เก็บ “${got.name}” เข้ามือ`,card:got});}}
   else log(g,`${p.name} ใช้เสียงนกแล้วเลือกไม่เก็บไพ่บนสุด`);
  }
  if(keyCount(p)>=3){finish(r,p.id,`${p.name} มีกุญแจครบ 3 ดอกแล้ว หนีออกจากบ้านผีไทยได้สำเร็จ!`);return;}
  log(g,`${p.name} ใช้การ์ดลางบอกเหตุแล้ว จบเทิร์นอัตโนมัติ`);nextTurn(r);
 });
 socket.on('end-turn',({room}={})=>{
  const r=rooms.get(String(room||'').toUpperCase()),p=findPlayer(r,socket.id);
  if(!r||!p||!isTurn(r,p)||(r.game.phase||'draw')!=='afterdraw')return;
  if(r.turnTimer)clearTimeout(r.turnTimer);log(r.game,`${p.name} จบเทิร์น`);nextTurn(r);
 });
 socket.on('escape-room',({room}={})=>{const r=rooms.get(String(room||'').toUpperCase()),p=findPlayer(r,socket.id);if(!r||!p||!isTurn(r,p))return;if(keyCount(p)<3)return socket.emit('game-error',`กุญแจยังไม่ครบ (${keyCount(p)}/3) ต้องสะสมให้ครบ 3 ดอกก่อนจึงจะออกได้`);if(r.game.pending)return socket.emit('game-error','จัดการเหตุการณ์ผีให้เสร็จก่อน');if(r.turnTimer)clearTimeout(r.turnTimer);finish(r,p.id,`${p.name} หนีออกจากบ้านผีไทยได้สำเร็จ!`)});
 socket.on('surrender-game',({room}={})=>{
  const code=String(room||'').toUpperCase(),r=rooms.get(code),g=r?.game,p=findPlayer(r,socket.id);
  if(!r||!g||g.over||!p||!p.alive)return;
  const active=alive(g).length;
  if(active<=2){socket.emit('game-error','โหมดออนไลน์ต้องมีผู้เล่นที่ยังอยู่มากกว่า 2 คน จึงจะยอมแพ้ได้');return;}
  if(g.pending?.playerId===p.id){g.discard.push(g.pending.card);g.pending=null;}
  p.alive=false;
  
  log(g,`${p.name} ยอมแพ้และออกจากเกม`);
  if(g.players[g.turn]?.id===p.id&&!g.over)nextTurn(r);
  else if(alive(g).length<=1)finish(r,alive(g)[0]?.id||null,alive(g).length?`${alive(g)[0].name} เป็นผู้รอดชีวิตคนสุดท้าย!`:'ทุกคนยอมแพ้หรือแพ้หมดแล้ว');
  else emitStates(r);
 });
 socket.on('leave-room',({room}={})=>{const code=String(room||'').toUpperCase(),r=rooms.get(code);if(!r)return;socket.leave(code);if(r.started&&r.game){const p=findPlayer(r,socket.id);if(p&&p.alive){p.alive=false;log(r.game,`${p.name} ออกจากห้อง`);if(r.game.players[r.game.turn]?.id===p.id&&!r.game.over)nextTurn(r);else emitStates(r)}}else{r.players=r.players.filter(p=>p.id!==socket.id);if(r.host===socket.id)r.host=r.players[0]?.id;if(!r.players.length)rooms.delete(code);else emitRoom(r)}});
 socket.on('disconnect',()=>{for(const [code,r] of rooms){if(!r.players.some(p=>p.id===socket.id))continue;if(!r.started){r.players=r.players.filter(p=>p.id!==socket.id);if(r.host===socket.id)r.host=r.players[0]?.id;if(!r.players.length)rooms.delete(code);else emitRoom(r)}else{const p=findPlayer(r,socket.id);if(p){p.connected=false;log(r.game,`${p.name} หลุดจากห้อง`);emitStates(r)}}}});
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Baan Pee Thai running on ${PORT}`));
