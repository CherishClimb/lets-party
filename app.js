/* DOM rendering and interaction. All user-facing copy comes from CONTENT. */
(function () {
'use strict';
const C = window.CONTENT, G = window.Game, P = window.PhotoStore, N = window.StoryNarration, M = window.BackgroundMusic, U = C.ui;
const app = document.querySelector('#app'), dialog = document.querySelector('#organizer');
const STORAGE_KEY = 'unicorn-rescue-v1';
const MUSIC_VOLUME_KEY = 'unicorn-rescue-music-volume-v1';
const MAGIC_CODE_KEY = 'unicorn-rescue-magic-code-v1';
const MAGIC_UNLOCK_KEY = 'unicorn-rescue-magic-unlocked-v1';
let state = G.fresh(), storageError = '', presentation = false, storyNavigation = 'manual', scene = 0, timer = null, celebrationTimer = null, finalCelebrating = false, returnScreen = 'home', rewardShown = false, lastAward = null, warmupTeam = 0, lastStorm = null, memoryPhotos = [], photosReady = false, magicCode = C.access.defaultCode, magicCodeDraft = '', accessUnlocked = false;
const warmupPoses = Object.fromEntries(C.teams.map(t=>[t.id,[false,false,false]]));
const sequence = ['home','setup','reveal','intro','warmup','outside','level1','transition2','level2','transition3','level3','destination','pinata','returnMessage','finale','found','rescued','rewards','done'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = (text, args) => text.replace(/\{(\w+)\}/g, (_,key) => args[key] ?? '');
const icon = id => C.icons.find(x=>x[0]===id)?.[1] || C.icons[0][1];
const team = id => C.teams.find(t=>t.id===id);
const activeChildren = () => state.children;
const children = id => activeChildren().filter(c=>c.teamId===id && c.name.trim());
const count = id => C.powers.filter((_,i)=>G.earned(state,id,i)).length;
const introStormVisuals = new Set(['storm','lost','rescueTeams']);
const birthdayScreens = new Set(['home','reveal','warmup','award','rescued','rewards','done']);
const sparkleScreens = new Set(['award','returnMessage','found','rescued','rewards','done']);
const cinematicScreens = new Set(['intro','outside','transition2','transition3','destination','pinata','returnMessage','finale','found','rescued','rewards','award']);
function button(label, action, attrs='', kind='primary') { return '<button class="'+kind+'" data-action="'+action+'" '+attrs+'>'+esc(label)+'</button>'; }
function nav(label, screen, kind='primary', disabled=false) { return button(label,'go','data-screen="'+screen+'"'+(disabled?' disabled':''),kind); }
function mascot(id, extra='') {
  const picturedTeam=team(id);
  if (picturedTeam?.art) {
    const [x,y,w,h]=picturedTeam.art.crop;
    const frameStyle='--crop-ratio:'+w+'/'+h+';--sprite-width:'+(1536/w*100)+'%;--sprite-x:'+(-x/1536*100)+'%;--sprite-y:'+(-y/1024*100)+'%';
    return '<div class="team-art '+id+' '+extra+'" aria-hidden="true"><div class="team-art-frame" style="'+frameStyle+'"><img src="'+esc(picturedTeam.art.src)+'" alt="" width="1536" height="1024" draggable="false"></div><span class="team-spark sp1">✦</span><span class="team-spark sp2">✧</span></div>';
  }
  if(id==='unicorn') return '<div class="magic-unicorn '+extra+'" aria-hidden="true"><img src="'+esc(C.assets.magic.unicorn)+'" alt="" draggable="false"></div>';
  return '<div class="mascot '+id+' '+extra+'" aria-hidden="true"><span class="tail"></span><span class="limb l1"></span><span class="limb l2"></span><span class="limb l3"></span><span class="limb l4"></span><span class="body"><i class="ear e1"></i><i class="ear e2"></i><i class="horn"></i><i class="mane"></i><i class="eye eye1"></i><i class="eye eye2"></i><i class="cheek cheek1"></i><i class="cheek cheek2"></i><i class="mouth"></i><i class="snout"></i></span><span class="spark s1">✦</span><span class="spark s2">✧</span></div>';
}
function powers(id, labels=false) {
  return '<div class="powers">'+C.powers.map((p,i)=>{
    const earned = id ? G.earned(state,id,i) : true;
    return '<span class="power '+(earned?'earned':'missing')+(lastAward?.id===id && lastAward?.level===i?' awarding':'')+'" aria-label="'+esc(p.name+(id?' · '+(earned?U.completed:U.pending):''))+'"><span aria-hidden="true">'+p.icon+'</span>'+(labels?'<small>'+esc(p.name)+'</small>':'')+'</span>';
  }).join('')+'</div>';
}
function journeyPowers() {
  return '<div class="journey-powers" aria-label="'+esc(U.magicProgress)+'">'+C.powers.map((p,i)=>{
    const restored=G.allComplete(state,i)&&(i!==2||state.clueRevealed);
    return '<span class="'+(restored?'restored':'waiting')+'"><b aria-hidden="true">'+p.icon+'</b>'+esc(p.name)+'</span>';
  }).join('')+'</div>';
}
function heading(title, text='', eyebrow='') { return '<div class="page-heading">'+(eyebrow?'<p class="eyebrow">'+esc(eyebrow)+'</p>':'')+'<h1>'+esc(title)+'</h1>'+(text?'<p class="lead">'+esc(text).replaceAll('\n','<br>')+'</p>':'')+'</div>'; }
function note(text) { document.querySelector('#notice').textContent = text; }
function save() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); storageError=''; } catch { storageError=U.saveFailed; note(storageError); } }
function saveMusicVolume(value) { try { localStorage.setItem(MUSIC_VOLUME_KEY,String(value)); } catch {} }
function saveMagicCode(value) {
  try { localStorage.setItem(MAGIC_CODE_KEY,value);magicCode=value;return true; }
  catch { note(U.saveFailed);return false; }
}
function photoStatus() {
  const copy=C.memoryPhotos, count=memoryPhotos.length;
  return fmt(count===3?copy.complete:copy.status,{n:count});
}
function releasePhotoUrls() {
  if(typeof URL==='undefined'||typeof URL.revokeObjectURL!=='function') return;
  memoryPhotos.forEach(photo=>{if(photo.url) URL.revokeObjectURL(photo.url);});
}
function setMemoryPhotos(records) {
  const changed=records.length!==memoryPhotos.length||records.some((record,i)=>record.id!==memoryPhotos[i]?.id||record.blob!==memoryPhotos[i]?.blob);
  releasePhotoUrls();
  memoryPhotos=records.map(record=>({
    ...record,
    url:typeof URL!=='undefined'&&typeof URL.createObjectURL==='function'?URL.createObjectURL(record.blob):''
  }));
  return changed;
}
async function refreshMemoryPhotos(updateView=true) {
  try {
    const changed=setMemoryPhotos(P?await P.list():[]);
    photosReady=true;
    if(updateView&&changed&&state.currentScreen==='done') render();
    if(updateView&&dialog.open&&dialog.innerHTML.includes('photo-manager')) openPhotoManager();
  } catch {
    photosReady=true;
    if(dialog.open&&dialog.innerHTML.includes('photo-manager')) openPhotoManager(C.memoryPhotos.saveFailed);
  }
}
async function processPhotoFiles(fileList,replaceId='') {
  const copy=C.memoryPhotos, files=Array.from(fileList||[]);
  let truncated=false;
  if(!files.length) return;
  if(!P||!P.supported()) {note(copy.saveFailed);return;}
  const valid=files.filter(file=>P.allowedTypes.has(file.type));
  if(!valid.length) {note(copy.unsupported);return;}
  note(copy.processing);
  try {
    if(replaceId) {
      const existing=memoryPhotos.find(photo=>photo.id===replaceId);
      if(!existing) return;
      const blob=await P.prepare(valid[0]);
      await P.save(blob,{id:existing.id,createdAt:existing.createdAt});
    } else {
      const remaining=Math.max(0,3-memoryPhotos.length);
      if(!remaining) {note(copy.maxReached);return;}
      truncated=valid.length>remaining;
      for(const file of valid.slice(0,remaining)) await P.save(await P.prepare(file));
    }
    await refreshMemoryPhotos(false);
    if(dialog.open) openPhotoManager();
    if(state.currentScreen==='done') render();
    note(truncated?copy.maxReached:copy.ready);
  } catch(error) {
    note(error?.message==='unsupported-photo-type'?copy.unsupported:copy.saveFailed);
  }
}
async function removeMemoryPhoto(id) {
  try {
    await P?.remove(id);
    await refreshMemoryPhotos(false);
    if(dialog.open) openPhotoManager();
    if(state.currentScreen==='done') render();
  } catch { note(C.memoryPhotos.saveFailed); }
}
function clearMemoryPhotos(updateView=true) {
  releasePhotoUrls();memoryPhotos=[];photosReady=true;
  const clearing=P?.clear?.().catch(()=>note(C.memoryPhotos.saveFailed));
  if(updateView&&dialog.open) openPhotoManager();
  if(updateView&&state.currentScreen==='done') render();
  return clearing;
}
function setupOfflineSupport() {
  if(typeof navigator==='undefined') return;
  const indicator=document.querySelector('#offline-status');
  let ready=false;
  const showStatus=()=>{
    if(!indicator) return;
    if(navigator.onLine===false) {
      indicator.textContent=U.offline;
      indicator.className='is-offline';
      indicator.hidden=false;
      return;
    }
    if(!ready) {indicator.hidden=true;return;}
    indicator.textContent=U.offlineReady;
    indicator.className='is-ready';
    indicator.hidden=false;
  };
  window.addEventListener?.('online',showStatus);
  window.addEventListener?.('offline',showStatus);
  showStatus();
  if(!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener?.('controllerchange',()=>{ready=true;showStatus();});
  window.addEventListener?.('load',()=>{
    navigator.serviceWorker.register('./service-worker.js',{scope:'./'})
      .then(registration=>navigator.serviceWorker.ready.then(()=>registration))
      .then(registration=>{
        ready=true;showStatus();
        const worker=navigator.serviceWorker.controller||registration.active||registration.waiting;
        worker?.postMessage?.({type:'REFRESH_AUDIO_CACHE'});
      })
      .catch(()=>{});
  });
}
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) state=G.normalize(JSON.parse(saved)); } catch { storageError=U.corruptSave; }
try {
  const rawVolume=localStorage.getItem(MUSIC_VOLUME_KEY),savedVolume=Number(rawVolume);
  if(rawVolume!==null&&Number.isFinite(savedVolume)) M?.setVolume?.(savedVolume);
} catch {}
try {
  const savedCode=localStorage.getItem(MAGIC_CODE_KEY);
  if(/^\d{4}$/.test(savedCode||'')) magicCode=savedCode;
  accessUnlocked=sessionStorage.getItem(MAGIC_UNLOCK_KEY)==='yes';
} catch {}
C.teams.forEach(t=>{ if(state.teams[t.id].gesture!==null) warmupPoses[t.id].fill(true); });
document.title = C.app.title;
function cancelTimer() { clearTimeout(timer); timer=null; }
function currentNarration() {
  const screen=state.currentScreen,mapping=C.storyAudio?.[screen];
  if(!mapping) return null;
  const sceneItem=Array.isArray(C[screen])?C[screen][scene]:null;
  if(sceneItem?.narration===false) return null;
  const index=screen==='rewards'?state.rewardIndex:scene;
  const audioIndex=Number.isInteger(sceneItem?.audioIndex)?sceneItem.audioIndex:index;
  const src=Array.isArray(mapping)?mapping[audioIndex]:mapping;
  if(!src) return null;
  return {id:Array.isArray(mapping)?screen+':'+(audioIndex+1):screen,src};
}
function narrationControls() {
  const n=C.narration;
  return '<div class="narration-controls" hidden>'+button('▶','narrationToggle','aria-label="'+esc(n.resume)+'" title="'+esc(n.resume)+'"','narration-toggle')+'</div>';
}
function musicButton(kind='quiet') {
  const playing=M?.snapshot?.().status==='playing';
  return button(playing?U.musicOff:U.musicOn,'musicToggle','aria-pressed="'+playing+'" title="'+esc(playing?U.musicOff:U.musicOn)+'"',kind+' music-toggle');
}
function updateMusicUi(snapshot=M?.snapshot?.()) {
  const control=document.querySelector('#header')?.querySelector?.('[data-action="musicToggle"]');
  if(!control||!snapshot) return;
  const playing=snapshot.status==='playing',label=playing?U.musicOff:U.musicOn;
  control.textContent=label;
  control.setAttribute('aria-pressed',String(playing));
  control.setAttribute('title',label);
  control.classList.toggle('is-playing',playing);
}
function updateNarrationUi(snapshot=N?.snapshot?.()) {
  M?.setDucked?.(snapshot?.status==='playing');
  if(snapshot?.status==='ended') scheduleScene();
  else if(snapshot?.status==='playing'&&storyNavigation==='automatic'&&currentNarration()?.id===snapshot.id) cancelTimer();
  const controls=app.querySelector?.('.narration-controls'),target=currentNarration();
  if(!controls||!target||!snapshot||snapshot.id!==target.id) return;
  const unavailable=!snapshot.supported||['idle','loading','missing','ended'].includes(snapshot.status);
  controls.hidden=unavailable;
  if(unavailable) return;
  const blocked=snapshot.status==='blocked',playing=snapshot.status==='playing';
  controls.classList.toggle('is-playing',playing);
  const toggle=controls.querySelector('.narration-toggle'),label=playing?C.narration.pause:blocked?C.narration.start:C.narration.resume;
  toggle.textContent=playing?'⏸':'▶';
  toggle.setAttribute('aria-label',label);
  toggle.setAttribute('title',label);
}
function syncNarration() {
  const target=currentNarration();
  if(!target) {N?.stop?.();return;}
  N?.open?.(target.id,target.src);
  updateNarrationUi();
}
function syncBackgroundMusic(flags=sceneFlags()) {
  if(state.currentScreen==='done'&&C.celebrationMusic) {
    M?.open?.('celebration',C.celebrationMusic,{loop:false});
    return;
  }
  const id=flags.restored?'final':flags.musicStorm?'storm':'ambient',src=C.backgroundMusic?.[id];
  if(src) M?.open?.(id,src,{loop:true});
}
function activeVisual() {
  const scenes=C[state.currentScreen];
  return Array.isArray(scenes)?scenes[scene]?.visual||'':'';
}
function sceneFlags() {
  const screen=state.currentScreen, visual=activeVisual();
  const restored=G.eligible(state)&&state.returnInvited;
  const missionStarted=state.introCompleted||C.teams.some(t=>state.teams[t.id].gesture!==null||state.teams[t.id].completedLevels.some(Boolean));
  const stormStarted=screen==='intro'?introStormVisuals.has(visual):missionStarted;
  const musicStorm=stormStarted&&!restored;
  const transforming=screen==='finale'&&visual==='forestTransform';
  const awaitingTransformation=screen==='returnMessage'||(screen==='finale'&&visual==='finalPowers');
  const storm=stormStarted&&(!restored||awaitingTransformation)&&!transforming;
  const birthday=!storm&&!transforming&&(restored||birthdayScreens.has(screen)||['birthday','forestParty'].includes(visual));
  const butterflies=!storm&&(restored||screen==='home'||screen==='found'||screen==='rescued'||screen==='done'||['birthday','forestParty','happy'].includes(visual));
  const sparkles=!storm&&(restored||sparkleScreens.has(screen)||['magicPowers','magicTogether','restoredPowers','happy'].includes(visual));
  return {storm,restored,musicStorm,transforming,birthday,butterflies,sparkles};
}
function sceneDecor(flags=sceneFlags(),sunnyReturn=false) {
  const a=C.assets.magic;
  if(state.currentScreen==='done') return '';
  return '<div class="ambient-decor '+(flags.storm?'storm-decor':'day-decor')+(flags.transforming?' forest-transform-decor':'')+(sunnyReturn?' sunny-return-decor':'')+'" aria-hidden="true">'
    +'<img class="decor-leaves" src="'+esc(a.leaves)+'" alt="">'
    +(flags.storm?'':'<img class="decor-flowers" src="'+esc(a.flowers)+'" alt="">')
    +(flags.butterflies?'<img class="decor-butterflies" src="'+esc(a.butterflies)+'" alt="">':'')
    +(flags.sparkles?'<img class="decor-sparkles" src="'+esc(a.sparkles)+'" alt="">':'')
    +(flags.birthday?'<span class="birthday-sprite birthday-bunting"></span>':'')
    +'</div>';
}
function go(screen) {
  if (!G.canVisit(state,screen)) { note(U.locked); return; }
  if (['reveal','intro','warmup','outside','level1'].includes(screen) && !activeChildren().some(c=>c.name.trim())) { note(U.childRequired); screen='setup'; }
  if (screen==='progress' && state.currentScreen!=='progress') returnScreen=state.currentScreen;
  cancelTimer(); scene=0; rewardShown=false;
  if(screen==='warmup') {
    const firstOpen=C.teams.findIndex(t=>state.teams[t.id].gesture===null);
    warmupTeam=firstOpen<0?C.teams.length-1:firstOpen;
  }
  state.currentScreen=screen; save();
  if (dialog.open) dialog.close();
  render(); app.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
}
function chrome(flags=sceneFlags()) {
  document.body.classList.remove('access-mode');
  document.body.classList.toggle('presentation',presentation);
  document.body.classList.toggle('birthday-mode',state.currentScreen==='done');
  document.body.classList.toggle('cinematic-mode',cinematicScreens.has(state.currentScreen));
  document.body.classList.toggle('scene-day',!flags.storm);
  document.body.classList.toggle('scene-storm',flags.storm);
  document.body.classList.toggle('scene-transform',flags.transforming);
  if(state.currentScreen==='done') {
    document.querySelector('#header').innerHTML='<div class="final-controls">'+button('⚙','organizer','aria-label="'+esc(U.organizer)+'" title="'+esc(U.organizer)+'"','quiet')+musicButton()+button('⤢','presentation','aria-label="'+esc(presentation?U.exitPresentation:U.presentation)+'" title="'+esc(presentation?U.exitPresentation:U.presentation)+'"','quiet')+'</div>';
    document.querySelector('#footer').innerHTML='';
    return;
  }
  document.querySelector('#header').innerHTML='<button class="brand" data-action="go" data-screen="home"><span aria-hidden="true">✦</span>'+esc(C.app.title)+'</button><div class="header-actions">'+musicButton()+(presentation?button(U.exitPresentation,'presentation','','secondary'):button(U.progress,'go','data-screen="progress"','quiet')+button(U.presentation,'presentation','','quiet')+button('⚙ '+U.organizer,'organizer','','secondary'))+'</div>';
  document.querySelector('#footer').innerHTML='<span>✧ '+esc(C.app.footer)+'</span><span class="organizer-only">'+esc(storageError || U.saved)+'</span>';
}
function accessGate() {
  const copy=C.access;
  document.body.classList.add('access-mode','scene-day');
  document.body.classList.remove('birthday-mode','cinematic-mode','scene-storm','scene-transform');
  document.querySelector('#header').innerHTML='';
  document.querySelector('#footer').innerHTML='';
  app.innerHTML='<section class="magic-code-gate"><div class="magic-code-card"><div class="magic-code-unicorn" aria-hidden="true"><img src="'+esc(C.assets.magic.unicorn)+'" alt="" draggable="false"><span>✦</span><span>✧</span></div><div class="magic-code-copy"><h1>'+esc(copy.title)+'</h1><p class="lead">'+esc(copy.subtitle)+'</p><form class="magic-code-form" data-magic-code-form novalidate><label for="magic-code-input">'+esc(copy.inputLabel)+'</label><input id="magic-code-input" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="one-time-code" enterkeyhint="go" data-magic-code-entry aria-describedby="magic-code-error"><p id="magic-code-error" class="magic-code-error" role="alert" aria-live="polite"></p><button class="primary" type="submit">'+esc(copy.open)+'</button></form></div></div></section>';
  N?.stop?.();M?.pause?.();
  app.querySelector?.('[data-magic-code-entry]')?.focus?.({preventScroll:true});
}
function unlockWithCode(value,form) {
  const input=form?.querySelector?.('[data-magic-code-entry]'),error=form?.querySelector?.('#magic-code-error');
  if(value===magicCode) {
    accessUnlocked=true;
    try {sessionStorage.setItem(MAGIC_UNLOCK_KEY,'yes');} catch {}
    render();app.focus({preventScroll:true});return;
  }
  if(error) error.textContent=C.access.wrong;
  input?.setAttribute?.('aria-invalid','true');
  input?.focus?.({preventScroll:true});input?.select?.();
}
function roster(t) {
  const list=children(t.id);
  return list.length?'<ul class="roster">'+list.map(c=>'<li><span aria-hidden="true">'+icon(c.icon)+'</span><strong>'+esc(c.name)+'</strong></li>').join('')+'</ul>':'<p class="muted">'+esc(U.noChildren)+'</p>';
}
function teamCard(t, body, cls='') {
  return '<article class="team-card '+t.id+' '+cls+'">'+mascot(t.id)+'<h2>'+esc(t.name)+'</h2>'+body+'</article>';
}
function home() {
  const h=C.home;
  const hasChildren=activeChildren().some(c=>c.name.trim());
  return '<section class="home-hero"><div class="hero-copy"><p class="eyebrow">'+esc(h.tag)+'</p><h1>'+esc(h.title).replace('\n','<br>')+'</h1><p class="lead">'+esc(h.text)+'</p><div class="actions">'+(hasChildren?button(U.resume,'resume')+nav(U.preparation,'setup','quiet'):nav(U.startSetup,'setup'))+'</div></div><div class="hero-art"><div class="rainbow"></div><div class="cloud c1"></div><div class="cloud c2"></div><span class="birthday-sprite birthday-balloons-asset" aria-hidden="true"></span>'+mascot('unicorn','hero-unicorn')+'<span class="floating-star">✦</span><div class="mission"><p class="eyebrow">'+esc(h.mission)+'</p>'+powers(null,true)+'</div></div></section><section class="team-preview"><p class="eyebrow">'+esc(U.rescueTeams)+'</p><div class="team-grid home-teams">'+C.teams.map(t=>teamCard(t,'<p>'+esc(fmt(U.childrenCount,{n:children(t.id).length}))+'</p>')).join('')+'</div></section>';
}
function setup() {
  const childSlot=(c,i)=>'<article class="child-slot '+c.teamId+'"><div class="slot-heading"><span>'+esc(fmt(U.slot,{n:i+1}))+'</span><span aria-hidden="true">'+icon(c.icon)+'</span></div><label>'+esc(U.name)+'<input data-child="'+i+'" data-field="name" value="'+esc(c.name)+'" placeholder="'+esc(U.empty)+'" maxlength="40" autocomplete="off"></label><div class="field-pair"><label>'+esc(U.icon)+'<select data-child="'+i+'" data-field="icon">'+C.icons.map(x=>'<option value="'+x[0]+'"'+(x[0]===c.icon?' selected':'')+'>'+x[1]+' '+esc(x[2])+'</option>').join('')+'</select></label><label>'+esc(U.team)+'<select data-child="'+i+'" data-field="teamId">'+C.teams.map(t=>'<option value="'+t.id+'"'+(t.id===c.teamId?' selected':'')+'>'+esc(t.short)+'</option>').join('')+'</select></label></div></article>';
  const groups=C.teams.map(t=>'<section class="setup-team '+t.id+'"><div class="setup-team-heading">'+mascot(t.id)+'<div><p class="eyebrow">'+esc(U.rescueTeam)+'</p><h2>'+esc(t.name)+'</h2></div></div><div class="setup-team-slots">'+activeChildren().map((c,i)=>c.teamId===t.id?childSlot(c,i):'').join('')+'</div></section>').join('');
  return '<section class="setup-page">'+heading(C.setup.title,C.setup.text)+'<p class="helper">'+esc(C.setup.help)+'</p><div class="setup-teams">'+groups+'</div><div class="actions">'+nav(U.begin,'reveal')+'</div></section>';
}
function reveal() {
  return heading(C.reveal.title,C.reveal.text)+'<div class="team-grid reveal">'+C.teams.map(t=>teamCard(t,roster(t))).join('')+'</div><div class="actions">'+nav(U.next,'intro')+'</div>';
}
function warmup() {
  const t=C.teams[warmupTeam]||C.teams[0], checks=warmupPoses[t.id], teamDone=checks.every(Boolean), doneCount=checks.filter(Boolean).length;
  const teamHeader=teamCard(t,'<p class="warmup-counter">'+esc(fmt(U.teamOf,{n:warmupTeam+1}))+' · '+esc(fmt(U.poseProgress,{n:doneCount}))+'</p>','warmup-team-card');
  const poses=t.gestures.map((label,i)=>'<article class="pose-card '+(checks[i]?'pose-complete':'')+'"><div class="pose-image-wrap"><img src="'+esc(t.poseImages[i])+'" alt="'+esc(label)+'" loading="eager">'+(checks[i]?'<span class="pose-check" aria-label="'+esc(U.completed)+'">✓</span>':'')+'</div><h3>'+esc(label)+'</h3>'+button(checks[i]?U.finished:U.finishPose,'poseDone','data-team="'+t.id+'" data-pose="'+i+'" aria-pressed="'+checks[i]+'"'+(checks[i]?' disabled':''),checks[i]?'pose-finish completed':'pose-finish')+'</article>').join('');
  const allDone=C.teams.every(team=>state.teams[team.id].gesture!==null);
  return '<section class="warmup-session '+t.id+'">'+heading(C.warmup.title,C.warmup.text)+'<div class="warmup-progress" aria-label="'+esc(U.warmupProgress)+'">'+C.teams.map((team,i)=>'<span class="'+(state.teams[team.id].gesture!==null?'done':'')+(i===warmupTeam?' active':'')+'" aria-hidden="true"></span>').join('')+'</div>'+teamHeader+'<div class="pose-grid">'+poses+'</div>'+(teamDone?'<p class="team-spell-done">✓ '+esc(U.teamSpellDone)+'</p>':'')+'<p class="helper">'+esc(U.poseHint)+'</p><div class="actions">'+(warmupTeam>0?button(U.previousTeam,'warmupTeam','data-index="'+(warmupTeam-1)+'"','secondary'):'')+(teamDone&&warmupTeam<2?button(U.nextTeam,'warmupTeam','data-index="'+(warmupTeam+1)+'"'):'')+(allDone?nav(U.next,'outside'):'')+'</div></section>';
}
function level(index) {
  const l=C.levels[index];
  return '<section class="outdoor-level">'+heading(l.title,'',fmt(U.levelLabel,{n:index+1})+' · '+U.outdoor)+journeyPowers()+'<section class="rule-card"><div><h2>'+esc(l.subtitle)+'</h2><ul class="rules">'+l.rules.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul></div>'+(index===2?'<div class="search-symbol" aria-hidden="true">✧ ? ✧</div>':'')+'</section><p class="helper organizer-only">'+esc(l.organizer)+'</p><div class="team-grid compact">'+C.teams.map(t=>{
    const done=state.teams[t.id].completedLevels[index];
    const matCount=index<2?G.matsFor(state,t.id,index):null;
    const matInfo=index<2?'<div class="team-mat-count"><div class="team-mats" data-mat-count="'+matCount+'" aria-hidden="true">'+Array.from({length:matCount},()=>'<span></span>').join('')+'</div></div>':'';
    return teamCard(t,matInfo+(index===2?'<p>'+esc(U.missingPart)+'</p><div class="word-slots" aria-label="'+esc(fmt(U.wordSlots,{n:t.word.length}))+'">'+Array.from(t.word,()=>'<span aria-hidden="true"></span>').join('')+'</div>':'')+powers(t.id)+'<p class="team-status">'+esc(done?(index===2?U.wordsReturned:fmt(U.powerRestored,{power:C.powers[index].name})):U.pending)+'</p><div class="organizer-only">'+button(done?U.undo:index===2?U.wordFound:U.complete,'mark','data-team="'+t.id+'" data-level="'+index+'"',done?'quiet':'primary')+'</div>',done?'complete':'');
  }).join('')+'</div><div class="actions">'+nav(index===2?U.revealDestination:U.next,index===2?'destination':'transition'+(index+2),'primary',!G.allComplete(state,index))+'</div>'+(!G.allComplete(state,index)?'<p class="helper">'+esc(U.waitTeams)+'</p>':'')+'</section>';
}
function progress() {
  const next = !state.clueRevealed?'destination':state.returnInvited?'finale':state.treasureFound?'returnMessage':'pinata';
  return heading(U.progress,U.progressHint)+'<div class="team-grid">'+C.teams.map(t=>teamCard(t,powers(t.id,true)+'<strong class="big-count">'+esc(fmt(U.progressCount,{n:count(t.id)}))+'</strong><p>'+esc(count(t.id)===3?U.ready:U.pending)+'</p>')).join('')+'</div><div class="actions">'+nav(U.returnGame,G.canVisit(state,returnScreen)?returnScreen:'home','secondary')+(G.allTasksComplete(state)?nav(C.screens[next],next):'')+'</div>'+(!state.clueRevealed&&G.allTasksComplete(state)?'<p class="helper">'+esc(U.cluePending)+'</p>':'');
}
function award() {
  const a=state.award, t=team(a.id), power=C.powers[a.level];
  lastAward=a;
  const collection=powers(t.id,true);
  lastAward=null;
  return '<section class="award-screen '+t.id+'">'+heading(fmt(U.awardTeam,{team:t.name,power:power.name.toUpperCase()}))+mascot(t.id)+'<div class="award-symbol" aria-hidden="true">'+power.icon+'</div>'+collection+(G.allComplete(state,a.level)?'<div class="all-restored"><h2>'+esc(fmt(U.awardAll,{power:power.name.toUpperCase()}))+'</h2><p>'+esc(C.award.support[a.level])+'</p></div>':'')+'<div class="actions">'+nav(U.backToLevel,'level'+(a.level+1))+'</div></section>';
}

function visual(type) {
  if(type==='outsideTeams') return '<div class="outside-adventure" aria-hidden="true"><span class="outside-sun"></span><span class="outside-rainbow">⌒</span><span class="outside-path"></span>'+C.teams.map((t,i)=>mascot(t.id,'outside-team outside-team-'+(i+1))).join('')+'<span class="outside-spark outside-spark-one">✦</span><span class="outside-spark outside-spark-two">✧</span></div>';
  if(type==='finalPowers') return '<div class="final-power-return" aria-hidden="true">'+mascot('unicorn','final-power-unicorn')+'<div class="powers final-return-powers">'+powers(null,true)+'</div><span class="final-return-glow"></span></div>';
  if(type==='forestTransform') return '<div class="forest-transformation-visual" aria-hidden="true"><span class="transform-day-forest"></span><span class="transform-storm-forest"></span><span class="transform-warmth"></span><img src="'+esc(C.assets.magic.flowers)+'" alt=""><span class="transform-spark transform-spark-one">✦</span><span class="transform-spark transform-spark-two">✧</span><span class="transform-spark transform-spark-three">✦</span></div>';
  if(type==='finalMagic') return '<div class="final-magic-visual" aria-hidden="true"><span class="final-magic-sparkle sparkle-one">✦</span><span class="final-magic-sparkle sparkle-two">✧</span><span class="final-magic-sparkle sparkle-three">✦</span><span class="final-magic-sparkle sparkle-four">✧</span>'+mascot('unicorn','final-magic-unicorn')+'</div>';
  if(type==='words') return '<div class="destination-parts">'+C.destinationWords.parts.map(w=>'<span>'+esc(w)+'</span>').join('<b>+</b>')+'</div>';
  if(type==='joined'||type==='courtyard') return '<div class="destination-joined">'+esc(C.destinationWords.joined)+(type==='courtyard'?'<strong>'+esc(C.destinationWords.final)+'</strong>':'')+'</div>';
  if(type==='rescueTeams') return '<div class="team-grid intro-teams">'+C.teams.map(t=>teamCard(t,roster(t))).join('')+'</div>';
  if(type==='teams'||type==='thanks') return '<div class="scene-teams">'+C.teams.map(t=>mascot(t.id)).join('')+'</div>';
  if(type==='pause') return '<div class="pause-spark" aria-hidden="true">✧</div>';
  if(type==='magicPowers'||type==='magicTogether') return '<div class="scene-powers '+type+'">'+powers(null,true)+'</div>';
  if(type==='restoredPowers') return '<div class="restored-lines">'+C.powers.map((p,i)=>'<p><span aria-hidden="true">'+p.icon+'</span>'+esc(C.restoredPowers[i])+'</p>').join('')+'</div>';
  if(type==='fourMats') return '<div class="wind-mats" aria-hidden="true"><div class="cloud"></div><span class="mat">✦</span><span class="mat">✦</span><span class="mat flies-away">−1</span></div>';
  if(type==='clue') return '<div class="clue-art" aria-hidden="true">✧ <span>?</span> ✧</div>';
  if(type==='treasure') return '<div class="treasure-art" aria-hidden="true"><span>✦</span><img class="treasure-image" src="'+esc(C.assets.magic.treasure)+'" alt=""><span>✧</span></div>';
  const forestScene=['birthday','forestParty','storm'].includes(type);
  const birthday=['birthday','forestParty'].includes(type);
  return '<div class="story-art '+type+'">'+(forestScene||type==='forestEmpty'?'<div class="forest-trees" aria-hidden="true"><i></i><i></i><i></i></div>':'')+'<div class="cloud c1"></div><div class="cloud c2"></div>'+(type==='forestEmpty'?'':mascot('unicorn'))+(birthday?'<span class="birthday-sprite birthday-balloons-asset" aria-hidden="true"></span><span class="birthday-sprite birthday-cake-asset" aria-hidden="true">'+Array.from({length:6},()=>'<i class="candle"></i>').join('')+'</span>':'')+(type==='lost'||type==='restore'?'<div class="flying-powers">'+powers(null,true)+'</div>':'')+'</div>';
}
function scheduleScene() {
  cancelTimer();
  const screen=state.currentScreen;
  if (screen==='rewards' && !rewardShown && !dialog.open) { timer=setTimeout(()=>{rewardShown=true;document.querySelector('.reward')?.classList.add('revealed');},900); return; }
  const scenes=C[screen];
  if (storyNavigation!=='automatic'||!Array.isArray(scenes)||dialog.open) return;
  const item=scenes[scene],last=scene===scenes.length-1;
  if(item.manual||(screen==='intro'&&last)) return;
  const target=currentNarration(),snapshot=N?.snapshot?.();
  if(target) {
    if(snapshot?.id!==target.id||snapshot.status!=='ended') return;
    scheduleAutomaticAdvance(screen,scene,1400);
    return;
  }
  if(item.duration) scheduleAutomaticAdvance(screen,scene,item.duration);
}
function scheduleAutomaticAdvance(screen,index,delay) {
  timer=setTimeout(()=>{
    timer=null;
    const scenes=C[screen],item=Array.isArray(scenes)?scenes[index]:null;
    if(storyNavigation==='automatic'&&state.currentScreen===screen&&scene===index&&!dialog.open&&item&&!item.manual) advanceScene();
  },delay);
}
function advanceScene() {
  const screen=state.currentScreen, scenes=C[screen];
  if(!Array.isArray(scenes)) return;
  if(scene<scenes.length-1) {
    scene++;
    if(scenes[scene].awardClue) {G.revealClue(state);save();}
    render();
  } else {
    if(screen==='intro') state.introCompleted=true;
    if(screen==='outside') {state.outsideReady=true;save();}
    if(screen==='returnMessage') {state.returnInvited=true;save();}
    if(C.storyNext[screen]) go(C.storyNext[screen]);
  }
}
function story(screen) {
  const scenes=C[screen],item=scenes[scene],last=scene===scenes.length-1;
  const nextLabel=item.button||(screen==='intro'&&last?U.startAdventure:U.next);
  return '<section class="story '+item.visual+'">'+heading(C.screens[screen],'',fmt(U.stepCounter,{n:scene+1,total:scenes.length}))+'<div class="scene-visual">'+visual(item.visual)+'</div>'+(item.title?'<h2 class="scene-title">'+esc(item.title)+'</h2>':'')+(item.text?'<p class="story-text">'+esc(item.text).replaceAll('\n','<br>')+'</p>':'')+(currentNarration()?narrationControls():'')+'<div class="scene-dots" aria-hidden="true">'+scenes.map((_,i)=>'<i class="'+(i===scene?'active':'')+'"></i>').join('')+'</div><div class="actions">'+(scene?button(U.back,'sceneBack','','secondary'):'')+button(nextLabel,'sceneNext')+(screen==='intro'?button(U.skip,'skip','','quiet'):'')+'</div></section>';
}
function pinata() {
  return '<section class="story">'+heading(C.pinata.title,C.pinata.text)+'<div class="scene-visual">'+visual('treasure')+'</div><div class="actions organizer-only">'+button(U.treasureFound,'treasureFound')+'</div></section>';
}
function found() {
  return '<section class="celebration final-search">'+heading(C.found.title)+'<div class="final-search-trail" aria-hidden="true"><span>✦</span><span>·</span><span>✧</span><span>·</span><span>✦</span></div>'+narrationControls()+'<div class="actions organizer-only">'+button(U.confirmFound,'found')+'</div></section>';
}
function rewards() {
  const t=C.teams[state.rewardIndex];
  return '<section class="reward-screen '+t.id+'">'+heading(t.reward.unlock,'',fmt(U.rewardCounter,{n:state.rewardIndex+1}))+mascot(t.id)+'<div class="reward '+(rewardShown?'revealed':'')+'"><div class="reward-icon" aria-hidden="true">'+t.reward.icon+'</div><h2>'+esc(t.reward.name)+'</h2><p class="lead">'+esc(t.reward.text)+'</p></div>'+narrationControls()+'<div class="actions">'+button(state.rewardIndex<2?U.nextReward:U.finish,'rewardNext')+'</div></section>';
}
function rescued() {
  return '<section class="celebration final-found">'+heading(C.rescued.title,C.rescued.text)+'<div class="final-found-visual" aria-hidden="true">'+mascot('unicorn')+'<span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span></div>'+narrationControls()+'<div class="actions">'+nav(U.revealRewards,'rewards')+'</div></section>';
}
function done() {
  const photoCount=memoryPhotos.length;
  const collage=photoCount?'<section class="memory-collage photo-count-'+photoCount+'" aria-label="'+esc(C.memoryPhotos.title)+'">'+memoryPhotos.map((photo,i)=>'<figure class="memory-photo"><img src="'+esc(photo.url)+'" alt="'+esc(fmt(C.memoryPhotos.alt,{n:i+1}))+'"></figure>').join('')+'</section>':'';
  const celebration=finalCelebrating?'<div class="final-celebration-overlay" aria-hidden="true"><span class="celebration-firework fw-one"></span><span class="celebration-firework fw-two"></span><span class="celebration-firework fw-three"></span><span class="celebration-sparkle sp-one">✦</span><span class="celebration-sparkle sp-two">✧</span><span class="celebration-sparkle sp-three">✦</span><span class="celebration-sparkle sp-four">✧</span><span class="celebration-sparkle sp-five">✦</span><span class="celebration-balloon balloon-one"></span><span class="celebration-balloon balloon-two"></span><span class="celebration-balloon balloon-three"></span></div>':'';
  return '<section class="birthday-finale">'+celebration+heading(C.done.title)+'<div class="final-celebrate-actions">'+button(C.done.celebrate,'celebrate','','primary celebrate-button')+'</div><div class="birthday-layout '+(photoCount?'has-photos':'no-photos')+'"><div class="birthday-portrait"><img class="birthday-image" src="'+esc(C.done.image)+'" alt="'+esc(C.done.imageAlt)+'"><span class="birthday-sprite final-cake" aria-hidden="true"></span></div>'+collage+'</div></section>';
}
function replayFinalCelebration() {
  clearTimeout(celebrationTimer);
  finalCelebrating=true;
  render();
  celebrationTimer=setTimeout(()=>{
    celebrationTimer=null;
    finalCelebrating=false;
    if(state.currentScreen==='done') render();
  },3700);
}
function render() {
  cancelTimer();
  if(!accessUnlocked) {accessGate();return;}
  if(state.currentScreen!=='done') {clearTimeout(celebrationTimer);celebrationTimer=null;finalCelebrating=false;}
  const flags=sceneFlags(), sunnyReturn=lastStorm===true&&!flags.storm&&!flags.transforming;
  lastStorm=flags.storm;
  chrome(flags);
  const screen=state.currentScreen;
  const views={home,setup,reveal,warmup,progress,award,pinata,found,rescued,rewards,done};
  const view=views[screen]?views[screen]():/^level/.test(screen)?level(Number(screen.slice(-1))-1):story(screen);
  app.innerHTML=sceneDecor(flags,sunnyReturn)+view;
  syncNarration();
  syncBackgroundMusic(flags);
  note(storageError);
  scheduleScene();

}
function openPhotoManager(error='') {
  cancelTimer();
  const copy=C.memoryPhotos, status=photoStatus();
  const thumbnails=memoryPhotos.map((photo,i)=>'<article class="photo-thumb"><img src="'+esc(photo.url)+'" alt="'+esc(fmt(copy.alt,{n:i+1}))+'"><div class="photo-thumb-actions"><label class="secondary photo-file-button">'+esc(copy.replace)+'<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" data-photo-replace="'+esc(photo.id)+'"></label>'+button(copy.remove,'photoRemove','data-photo-id="'+esc(photo.id)+'"','quiet')+'</div></article>').join('');
  const picker=memoryPhotos.length<3?'<label class="primary photo-file-button">'+esc(memoryPhotos.length?copy.add:copy.choose)+'<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" multiple data-photo-input></label>':'';
  dialog.innerHTML='<section class="photo-manager"><div class="dialog-heading"><div><p class="eyebrow">'+esc(status)+'</p><h2>'+esc(copy.title)+'</h2></div>'+button(U.close,'close','','secondary')+'</div><p>'+esc(copy.intro)+'</p>'+(error?'<p class="photo-error">'+esc(error)+'</p>':'')+(photosReady?(thumbnails?'<div class="photo-thumbnails">'+thumbnails+'</div>':'<p class="muted">'+esc(copy.empty)+'</p>'):'<p class="muted">'+esc(copy.processing)+'</p>')+'<div class="actions">'+picker+(memoryPhotos.length?button(copy.removeAll,'photoRemoveAll','','danger'):'')+button(U.back,'organizer','','secondary')+'</div></section>';
  if(!dialog.open) dialog.showModal();
}
function openOrganizer(reset=false) {
  cancelTimer();
  if(reset) {
    dialog.innerHTML='<h2>'+esc(U.resetQuestion)+'</h2><p>'+esc(U.resetDetail)+'</p><div class="actions">'+button(U.cancel,'organizer','','secondary')+button(U.confirmReset,'resetConfirm','','danger')+'</div>';
  } else {
    const idx=sequence.indexOf(state.currentScreen==='award'?'level'+(state.award.level+1):state.currentScreen), prev=sequence[Math.max(0,idx-1)], next=sequence[idx+1];
    const volumePercent=Math.round((M?.snapshot?.().normalVolume??.1)*100);
    const musicVolume='<fieldset class="music-volume-setting"><legend>'+esc(U.musicVolume)+'</legend><label><input type="range" min="0" max="30" step="1" value="'+volumePercent+'" data-music-volume aria-label="'+esc(U.musicVolume)+'"><output data-music-volume-output>'+volumePercent+'%</output></label></fieldset>';
    const codeSetting='<fieldset class="magic-code-setting"><legend>'+esc(C.access.setting)+'</legend><label><span>'+esc(C.access.settingHint)+'</span><input type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" value="'+esc(magicCodeDraft)+'" data-magic-code-setting></label>'+button(C.access.save,'saveMagicCode','','secondary')+'</fieldset>';
    dialog.innerHTML='<div class="dialog-heading"><h2>'+esc(U.organizer)+'</h2>'+button(U.close,'close','','secondary')+'</div><fieldset class="story-control"><legend>'+esc(U.storyControl)+'</legend><label><input type="radio" name="story-navigation" value="manual" data-story-mode="manual"'+(storyNavigation==='manual'?' checked':'')+'> '+esc(U.storyManual)+'</label><label><input type="radio" name="story-navigation" value="automatic" data-story-mode="automatic"'+(storyNavigation==='automatic'?' checked':'')+'> '+esc(U.storyAutomatic)+'</label></fieldset>'+musicVolume+codeSetting+'<button class="organizer-photo-button" data-action="photos"><span>'+esc(C.memoryPhotos.menu)+'</span><strong>'+esc(photoStatus())+'</strong></button><div class="actions">'+nav(U.back,prev,'secondary')+(next?nav(U.next,next,'secondary',!G.canVisit(state,next)):'')+'</div><h3>'+esc(U.jump)+'</h3><div class="jump-grid">'+['home','reveal','outside','level1','level2','level3','destination','pinata','returnMessage','finale','progress'].map(s=>nav(C.screens[s],s,'secondary',!G.canVisit(state,s))).join('')+'</div><div class="actions">'+nav(U.edit,'setup','quiet')+nav(U.replayIntro,'intro','quiet')+nav(U.replayFinale,'finale','quiet',!G.canVisit(state,'finale'))+'</div><h3>'+esc(U.completions)+'</h3><div class="completion-editor">'+C.teams.map(t=>'<fieldset><legend>'+esc(t.name)+'</legend>'+C.powers.map((p,i)=>'<label><input type="checkbox" data-mark-team="'+t.id+'" data-mark-level="'+i+'"'+(state.teams[t.id].completedLevels[i]?' checked':'')+(!G.levelOpen(state,i)&&!state.teams[t.id].completedLevels[i]?' disabled':'')+'>'+p.icon+' '+esc(p.name)+'</label>').join('')+'</fieldset>').join('')+'</div><details><summary>'+esc(U.answers)+'</summary>'+C.teams.map(t=>'<p>'+esc(t.name)+' → <strong>'+esc(t.word)+'</strong></p>').join('')+'</details><hr>'+button(U.reset,'reset','','danger');
  }
  if(!dialog.open) dialog.showModal();
}
function resume() {
  if(state.rescued) go(state.birthdayComplete?'done':'rewards');
  else if(state.returnInvited) go('finale');
  else if(state.treasureFound) go('returnMessage');
  else if(G.eligible(state)) go('pinata');
  else if(G.allTasksComplete(state)) go('destination');
  else if(!state.introCompleted) go('reveal');
  else if(!C.teams.every(t=>state.teams[t.id].gesture!==null)) go('warmup');
  else if(!state.outsideReady) go('outside');
  else {
    const next=[0,1,2].find(i=>!G.allComplete(state,i));
    go(next===0?'level1':'transition'+(next+1));
  }
}
document.addEventListener('click', event=>{
  const el=event.target.closest('[data-action]');
  if(!el || el.disabled) return;
  if(el.dataset.action!=='musicToggle'&&M?.snapshot?.().status==='blocked') void M.play();
  switch(el.dataset.action) {
    case 'go': go(el.dataset.screen); break;
    case 'resume': resume(); break;
    case 'presentation': presentation=!presentation; chrome(); break;
    case 'organizer': openOrganizer(); break;
    case 'photos': openPhotoManager(); if(!photosReady) void refreshMemoryPhotos(); break;
    case 'photoRemove': void removeMemoryPhoto(el.dataset.photoId); break;
    case 'photoRemoveAll': void clearMemoryPhotos(true); break;
    case 'celebrate': replayFinalCelebration(); break;
    case 'musicToggle': M?.toggle?.(); break;
    case 'narrationToggle': N?.toggle?.(); break;
    case 'saveMagicCode':
      if(!/^\d{4}$/.test(magicCodeDraft)) {note(C.access.fourDigits);break;}
      if(saveMagicCode(magicCodeDraft)) {magicCodeDraft='';openOrganizer();note(C.access.saved);}
      break;
    case 'close': dialog.close(); break;
    case 'reset': openOrganizer(true); break;
    case 'resetConfirm': clearMemoryPhotos(false); state=G.fresh(); C.teams.forEach(t=>warmupPoses[t.id].fill(false)); warmupTeam=0; returnScreen='home'; presentation=false; go('home'); note(U.resetDone); break;
    case 'gesture': state.teams[el.dataset.team].gesture=Number(el.dataset.index); save(); render(); break;
    case 'warmupTeam': warmupTeam=Math.max(0,Math.min(2,Number(el.dataset.index))); render(); break;
    case 'poseDone': {
      const id=el.dataset.team, pose=Number(el.dataset.pose);
      if(!warmupPoses[id] || !Number.isInteger(pose) || pose<0 || pose>2 || warmupPoses[id][pose]) break;
      warmupPoses[id][pose]=true;
      if(warmupPoses[id].every(Boolean)) {state.teams[id].gesture=0;save();}
      render();
      break;
    }
    case 'mark': {
      const id=el.dataset.team, n=Number(el.dataset.level), was=state.teams[id].completedLevels[n];
      if(!G.mark(state,id,n,!was)) {note(U.locked);break;}
      if(!was && n<2) {state.award={id,level:n};go('award');}
      else {save();render();note(was?U.undo:U.wordsReturned);}
      break;
    }
    case 'sceneNext': advanceScene(); break;
    case 'sceneBack': scene=Math.max(0,scene-1); render(); break;
    case 'skip': state.introCompleted=true; go('warmup'); break;
    case 'treasureFound': if(G.canVisit(state,'pinata')) {state.treasureFound=true;go('returnMessage');} break;
    case 'found': if(G.canVisit(state,'found')) {state.rescued=true;state.rewardIndex=0;state.birthdayComplete=false;go('rescued');} break;
    case 'rewardNext': if(state.rewardIndex<2) {state.rewardIndex++;rewardShown=false;save();render();} else {state.birthdayComplete=true;go('done');} break;
  }
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.magicCodeEntry!==undefined) {
    el.value=String(el.value||'').replace(/\D/g,'').slice(0,4);
    el.removeAttribute?.('aria-invalid');
    const error=el.form?.querySelector?.('#magic-code-error');if(error) error.textContent='';
    return;
  }
  if(el.dataset.magicCodeSetting!==undefined) {
    magicCodeDraft=String(el.value||'').replace(/\D/g,'').slice(0,4);el.value=magicCodeDraft;return;
  }
  if(el.dataset.musicVolume!==undefined) {
    const volume=Math.max(0,Math.min(30,Number(el.value)))/100;
    M?.setVolume?.(volume);saveMusicVolume(volume);
    const output=dialog.querySelector?.('[data-music-volume-output]');if(output) output.textContent=Math.round(volume*100)+'%';
    return;
  }
  if(el.dataset.field==='name') {state.children[Number(el.dataset.child)].name=el.value; save();}
});
document.addEventListener('submit',event=>{
  const form=event.target.closest?.('[data-magic-code-form]');
  if(!form) return;
  event.preventDefault();
  const input=form.querySelector?.('[data-magic-code-entry]');
  unlockWithCode(String(input?.value||''),form);
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.storyMode&&el.checked) {storyNavigation=el.dataset.storyMode==='automatic'?'automatic':'manual';cancelTimer();return;}
  if(el.dataset.photoInput!==undefined) {void processPhotoFiles(el.files);el.value='';return;}
  if(el.dataset.photoReplace!==undefined) {void processPhotoFiles(el.files,el.dataset.photoReplace);el.value='';return;}
  if(el.dataset.child!==undefined) {
    const c=state.children[Number(el.dataset.child)]; c[el.dataset.field]=el.value; save();
    if(el.dataset.field==='teamId') { render(); }
    else if(el.dataset.field!=='name') {
      const card=el.closest('.child-slot'); card.className='child-slot '+c.teamId;
      card.querySelector('.slot-heading span:last-child').textContent=icon(c.icon);
    }
  }
  if(el.dataset.markTeam) {
    G.mark(state,el.dataset.markTeam,Number(el.dataset.markLevel),el.checked); save(); render(); openOrganizer();
  }
});
dialog.addEventListener('close',()=>scheduleScene());
N?.subscribe?.(updateNarrationUi);
M?.subscribe?.(updateMusicUi);
setupOfflineSupport();
render();
void refreshMemoryPhotos();
})();
