/* DOM rendering and interaction. All user-facing copy comes from CONTENT. */
(function () {
'use strict';
const C = window.CONTENT, G = window.Game, P = window.PhotoStore, N = window.StoryNarration, M = window.BackgroundMusic, U = C.ui;
const app = document.querySelector('#app'), dialog = document.querySelector('#organizer');
const STORAGE_KEY = 'unicorn-rescue-v1';
let state = G.fresh(), storageError = '', presentation = false, scene = 0, timer = null, celebrationTimer = null, finalCelebrating = false, returnScreen = 'home', rewardShown = false, lastAward = null, warmupTeam = 0, lastStorm = null, memoryPhotos = [], photosReady = false;
const warmupPoses = Object.fromEntries(C.teams.map(t=>[t.id,[false,false,false]]));
const sequence = ['home','setup','reveal','intro','warmup','level1','transition2','level2','transition3','level3','destination','pinata','treasure','returnMessage','waiting','finale','found','rescued','rewards','done'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = (text, args) => text.replace(/\{(\w+)\}/g, (_,key) => args[key] ?? '');
const icon = id => C.icons.find(x=>x[0]===id)?.[1] || C.icons[0][1];
const team = id => C.teams.find(t=>t.id===id);
const children = id => state.children.filter(c=>c.teamId===id && c.name.trim());
const count = id => C.powers.filter((_,i)=>G.earned(state,id,i)).length;
const introStormVisuals = new Set(['storm','lost','rescueTeams']);
const birthdayScreens = new Set(['home','reveal','warmup','award','rescued','rewards','done']);
const sparkleScreens = new Set(['award','treasure','waiting','found','rescued','rewards','done']);
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
function heading(title, text='', eyebrow='') { return '<div class="page-heading">'+(eyebrow?'<p class="eyebrow">'+esc(eyebrow)+'</p>':'')+'<h1>'+esc(title)+'</h1>'+(text?'<p class="lead">'+esc(text)+'</p>':'')+'</div>'; }
function note(text) { document.querySelector('#notice').textContent = text; }
function save() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); storageError=''; } catch { storageError=U.saveFailed; note(storageError); } }
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
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) state=G.normalize(JSON.parse(saved)); } catch { storageError=U.corruptSave; }
C.teams.forEach(t=>{ if(state.teams[t.id].gesture!==null) warmupPoses[t.id].fill(true); });
document.title = C.app.title;
function cancelTimer() { clearTimeout(timer); timer=null; }
function currentNarration() {
  const screen=state.currentScreen,src=C.storyAudio?.[screen]?.[scene];
  return src?{id:screen+':'+(scene+1),src}:null;
}
function narrationControls() {
  const n=C.narration;
  return '<div class="narration-controls" hidden><span class="narration-label"><i aria-hidden="true">♪</i>'+esc(n.label)+'</span><div class="narration-actions">'+button(n.start,'narrationStart','','secondary narration-start')+button(n.pause,'narrationToggle','','secondary narration-toggle')+button(n.replay,'narrationReplay','','quiet narration-replay')+'</div></div>';
}
function updateNarrationUi(snapshot=N?.snapshot?.()) {
  M?.setDucked?.(snapshot?.status==='playing');
  const controls=app.querySelector?.('.narration-controls'),target=currentNarration();
  if(!controls||!target||!snapshot||snapshot.id!==target.id) return;
  const unavailable=!snapshot.supported||['idle','loading','missing'].includes(snapshot.status);
  controls.hidden=unavailable;
  if(unavailable) return;
  const blocked=snapshot.status==='blocked',playing=snapshot.status==='playing';
  controls.classList.toggle('is-playing',playing);
  const start=controls.querySelector('.narration-start'),toggle=controls.querySelector('.narration-toggle'),replay=controls.querySelector('.narration-replay');
  start.hidden=!blocked;toggle.hidden=blocked;replay.hidden=blocked;
  toggle.textContent=playing?C.narration.pause:C.narration.resume;
}
function syncNarration() {
  const target=currentNarration();
  if(!target) {N?.stop?.();return;}
  N?.open?.(target.id,target.src);
  updateNarrationUi();
}
function syncBackgroundMusic(flags=sceneFlags()) {
  const id=flags.restored?'final':flags.storm?'storm':'ambient',src=C.backgroundMusic?.[id];
  if(src) M?.open?.(id,src);
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
  const storm=stormStarted&&!restored;
  const birthday=!storm&&(restored||birthdayScreens.has(screen)||['birthday','forestParty'].includes(visual));
  const butterflies=!storm&&(restored||screen==='home'||screen==='found'||screen==='rescued'||screen==='done'||['birthday','forestParty','happy'].includes(visual));
  const sparkles=!storm&&(restored||sparkleScreens.has(screen)||['magicPowers','magicTogether','restoredPowers','happy'].includes(visual));
  return {storm,restored,birthday,butterflies,sparkles};
}
function sceneDecor(flags=sceneFlags(),sunnyReturn=false) {
  const a=C.assets.magic;
  if(state.currentScreen==='done') return '';
  return '<div class="ambient-decor '+(flags.storm?'storm-decor':'day-decor')+(sunnyReturn?' sunny-return-decor':'')+'" aria-hidden="true">'
    +'<img class="decor-leaves" src="'+esc(a.leaves)+'" alt="">'
    +(flags.storm?'':'<img class="decor-flowers" src="'+esc(a.flowers)+'" alt="">')
    +(flags.butterflies?'<img class="decor-butterflies" src="'+esc(a.butterflies)+'" alt="">':'')
    +(flags.sparkles?'<img class="decor-sparkles" src="'+esc(a.sparkles)+'" alt="">':'')
    +(flags.birthday?'<span class="birthday-sprite birthday-bunting"></span>':'')
    +'</div>';
}
function go(screen) {
  if (!G.canVisit(state,screen)) { note(U.locked); return; }
  if (['reveal','intro','warmup','level1'].includes(screen) && !state.children.some(c=>c.name.trim())) { note(U.childRequired); screen='setup'; }
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
  document.body.classList.toggle('presentation',presentation);
  document.body.classList.toggle('birthday-mode',state.currentScreen==='done');
  document.body.classList.toggle('scene-day',!flags.storm);
  document.body.classList.toggle('scene-storm',flags.storm);
  if(state.currentScreen==='done') {
    document.querySelector('#header').innerHTML='<div class="final-controls">'+button('⚙','organizer','aria-label="'+esc(U.organizer)+'" title="'+esc(U.organizer)+'"','quiet')+button('⤢','presentation','aria-label="'+esc(presentation?U.exitPresentation:U.presentation)+'" title="'+esc(presentation?U.exitPresentation:U.presentation)+'"','quiet')+'</div>';
    document.querySelector('#footer').innerHTML='';
    return;
  }
  document.querySelector('#header').innerHTML='<button class="brand" data-action="go" data-screen="home"><span aria-hidden="true">✦</span>'+esc(C.app.title)+'</button><div class="header-actions">'+(presentation?button(U.exitPresentation,'presentation','','secondary'):button(U.progress,'go','data-screen="progress"','quiet')+button(U.presentation,'presentation','','quiet')+button('⚙ '+U.organizer,'organizer','','secondary'))+'</div>';
  document.querySelector('#footer').innerHTML='<span>✧ '+esc(C.app.footer)+'</span><span class="organizer-only">'+esc(storageError || U.saved)+'</span>';
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
  const hasChildren=state.children.some(c=>c.name.trim());
  return '<section class="home-hero"><div class="hero-copy"><p class="eyebrow">'+esc(h.tag)+'</p><h1>'+esc(h.title).replace('\n','<br>')+'</h1><p class="lead">'+esc(h.text)+'</p><div class="actions">'+(hasChildren?button(U.resume,'resume')+nav(U.preparation,'setup','quiet'):nav(U.startSetup,'setup'))+'</div></div><div class="hero-art"><div class="rainbow"></div><div class="cloud c1"></div><div class="cloud c2"></div><span class="birthday-sprite birthday-balloons-asset" aria-hidden="true"></span>'+mascot('unicorn','hero-unicorn')+'<span class="floating-star">✦</span><div class="mission"><p class="eyebrow">'+esc(h.mission)+'</p>'+powers(null,true)+'</div></div></section><section class="team-preview"><p class="eyebrow">'+esc(U.rescueTeams)+'</p><div class="team-grid home-teams">'+C.teams.map(t=>teamCard(t,'<p>'+esc(fmt(U.childrenCount,{n:children(t.id).length}))+'</p>')).join('')+'</div></section>';
}
function setup() {
  const childSlot=(c,i)=>'<article class="child-slot '+c.teamId+'"><div class="slot-heading"><span>'+esc(fmt(U.slot,{n:i+1}))+'</span><span aria-hidden="true">'+icon(c.icon)+'</span></div><label>'+esc(U.name)+'<input data-child="'+i+'" data-field="name" value="'+esc(c.name)+'" placeholder="'+esc(U.empty)+'" maxlength="40" autocomplete="off"></label><div class="field-pair"><label>'+esc(U.icon)+'<select data-child="'+i+'" data-field="icon">'+C.icons.map(x=>'<option value="'+x[0]+'"'+(x[0]===c.icon?' selected':'')+'>'+x[1]+' '+esc(x[2])+'</option>').join('')+'</select></label><label>'+esc(U.team)+'<select data-child="'+i+'" data-field="teamId">'+C.teams.map(t=>'<option value="'+t.id+'"'+(t.id===c.teamId?' selected':'')+'>'+esc(t.short)+'</option>').join('')+'</select></label></div></article>';
  const groups=C.teams.map(t=>'<section class="setup-team '+t.id+'"><div class="setup-team-heading">'+mascot(t.id)+'<div><p class="eyebrow">'+esc(U.rescueTeam)+'</p><h2>'+esc(t.name)+'</h2></div></div><div class="setup-team-slots">'+state.children.map((c,i)=>c.teamId===t.id?childSlot(c,i):'').join('')+'</div></section>').join('');
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
  return '<section class="warmup-session '+t.id+'">'+heading(C.warmup.title,C.warmup.text)+'<div class="warmup-progress" aria-label="'+esc(U.warmupProgress)+'">'+C.teams.map((team,i)=>'<span class="'+(state.teams[team.id].gesture!==null?'done':'')+(i===warmupTeam?' active':'')+'" aria-hidden="true"></span>').join('')+'</div>'+teamHeader+'<div class="pose-grid">'+poses+'</div>'+(teamDone?'<p class="team-spell-done">✓ '+esc(U.teamSpellDone)+'</p>':'')+'<p class="helper">'+esc(U.poseHint)+'</p><div class="actions">'+(warmupTeam>0?button(U.previousTeam,'warmupTeam','data-index="'+(warmupTeam-1)+'"','secondary'):'')+(teamDone&&warmupTeam<2?button(U.nextTeam,'warmupTeam','data-index="'+(warmupTeam+1)+'"'):'')+(allDone?nav(U.next,'level1'):'')+'</div></section>';
}
function level(index) {
  const l=C.levels[index];
  return '<section class="outdoor-level">'+heading(l.title,'',fmt(U.levelLabel,{n:index+1})+' · '+U.outdoor)+journeyPowers()+'<section class="rule-card"><div><h2>'+esc(l.subtitle)+'</h2><ul class="rules">'+l.rules.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul></div>'+(l.mats?'<div class="mat-illustration" aria-hidden="true">'+Array.from({length:5},(_,i)=>'<span class="mat '+(i>=l.mats?'blown':'')+'">'+(i+1)+'</span>').join('')+'</div>':'<div class="search-symbol" aria-hidden="true">✧ ? ✧</div>')+'</section><p class="helper organizer-only">'+esc(l.organizer)+'</p><div class="team-grid compact">'+C.teams.map(t=>{
    const done=state.teams[t.id].completedLevels[index];
    return teamCard(t,(index===2?'<p>'+esc(U.missingPart)+'</p><div class="word-slots" aria-label="'+esc(fmt(U.wordSlots,{n:t.word.length}))+'">'+Array.from(t.word,()=>'<span aria-hidden="true"></span>').join('')+'</div>':'')+powers(t.id)+'<p class="team-status">'+esc(done?(index===2?U.wordsReturned:fmt(U.powerRestored,{power:C.powers[index].name})):U.pending)+'</p><div class="organizer-only">'+button(done?U.undo:index===2?U.wordFound:U.complete,'mark','data-team="'+t.id+'" data-level="'+index+'"',done?'quiet':'primary')+'</div>',done?'complete':'');
  }).join('')+'</div><div class="actions">'+nav(index===2?U.revealDestination:U.next,index===2?'destination':'transition'+(index+2),'primary',!G.allComplete(state,index))+'</div>'+(!G.allComplete(state,index)?'<p class="helper">'+esc(U.waitTeams)+'</p>':'')+'</section>';
}
function progress() {
  const next = !state.clueRevealed?'destination':state.returnInvited?'waiting':'pinata';
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
  if(type==='words') return '<div class="destination-parts">'+C.destinationWords.parts.map(w=>'<span>'+esc(w)+'</span>').join('<b>+</b>')+'</div>';
  if(type==='joined'||type==='courtyard') return '<div class="destination-joined">'+esc(C.destinationWords.joined)+(type==='courtyard'?'<strong>'+esc(C.destinationWords.final)+'</strong>':'')+'</div>';
  if(type==='rescueTeams') return '<div class="team-grid intro-teams">'+C.teams.map(t=>teamCard(t,roster(t))).join('')+'</div>';
  if(type==='teams'||type==='thanks') return '<div class="scene-teams">'+C.teams.map(t=>mascot(t.id)).join('')+'</div>';
  if(type==='pause') return '<div class="pause-spark" aria-hidden="true">✧</div>';
  if(type==='magicPowers'||type==='magicTogether') return '<div class="scene-powers '+type+'">'+powers(null,true)+'</div>';
  if(type==='restoredPowers') return '<div class="restored-lines">'+C.powers.map((p,i)=>'<p><span aria-hidden="true">'+p.icon+'</span>'+esc(C.restoredPowers[i])+'</p>').join('')+'</div>';
  if(type==='fourMats') return '<div class="wind-mats" aria-hidden="true"><div class="cloud"></div>'+Array.from({length:5},(_,i)=>'<span class="mat '+(i===4?'flies-away':'')+'">'+(i+1)+'</span>').join('')+'</div>';
  if(type==='clue') return '<div class="clue-art" aria-hidden="true">✧ <span>?</span> ✧</div>';
  if(type==='treasure') return '<div class="treasure-art" aria-hidden="true"><span>✦</span><img class="treasure-image" src="'+esc(C.assets.magic.treasure)+'" alt=""><span>✧</span></div>';
  if(type==='message') return '<div class="message-art" aria-hidden="true">✉<span>✦</span></div>';
  const forestScene=['birthday','forestParty','storm'].includes(type);
  const birthday=['birthday','forestParty'].includes(type);
  return '<div class="story-art '+type+'">'+(forestScene||type==='forestEmpty'?'<div class="forest-trees" aria-hidden="true"><i></i><i></i><i></i></div>':'')+'<div class="cloud c1"></div><div class="cloud c2"></div>'+(type==='forestEmpty'?'':mascot('unicorn'))+(birthday?'<span class="birthday-sprite birthday-balloons-asset" aria-hidden="true"></span><span class="birthday-sprite birthday-cake-asset" aria-hidden="true">'+Array.from({length:6},()=>'<i class="candle"></i>').join('')+'</span>':'')+(type==='lost'||type==='restore'?'<div class="flying-powers">'+powers(null,true)+'</div>':'')+'</div>';
}
function scheduleScene() {
  cancelTimer();
  const screen=state.currentScreen;
  if (screen==='rewards' && !rewardShown && !dialog.open) { timer=setTimeout(()=>{rewardShown=true;document.querySelector('.reward')?.classList.add('revealed');},900); return; }
  const scenes=C[screen];
  if (!Array.isArray(scenes) || dialog.open) return;
  if(C.storyAudio?.[screen]?.[scene]) return;
  if (!scenes[scene].manual && (scene<scenes.length-1 || screen==='finale')) timer=setTimeout(()=>advanceScene(),scenes[scene].duration);
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
    if(C.storyNext[screen]) go(C.storyNext[screen]);
  }
}
function story(screen) {
  const scenes=C[screen],item=scenes[scene],last=scene===scenes.length-1;
  const nextLabel=item.button||(screen==='intro'&&last?U.startAdventure:screen==='destination'&&last?U.toCourtyard:screen==='returnMessage'&&last?U.returnHome:U.next);
  return '<section class="story '+item.visual+'">'+heading(C.screens[screen],'',fmt(U.stepCounter,{n:scene+1,total:scenes.length}))+'<div class="scene-visual">'+visual(item.visual)+'</div>'+(item.title?'<h2 class="scene-title">'+esc(item.title)+'</h2>':'')+(item.text?'<p class="story-text">'+esc(item.text).replaceAll('\n','<br>')+'</p>':'')+(C.storyAudio?.[screen]?.[scene]?narrationControls():'')+'<div class="scene-dots" aria-hidden="true">'+scenes.map((_,i)=>'<i class="'+(i===scene?'active':'')+'"></i>').join('')+'</div><div class="actions">'+(scene?button(U.back,'sceneBack','','secondary'):'')+button(nextLabel,'sceneNext')+(screen==='intro'?button(U.skip,'skip','','quiet'):'')+'</div></section>';
}
function pinata() {
  return '<section class="story">'+heading(C.pinata.title,C.pinata.text)+'<div class="scene-visual">'+visual('treasure')+'</div><div class="actions organizer-only">'+button(U.treasureFound,'treasureFound')+'</div></section>';
}
function treasure() {
  return '<section class="celebration">'+heading(C.treasure.title,C.treasure.text)+'<div class="scene-visual">'+visual('treasure')+'</div><div class="actions organizer-only">'+button(U.prizesOpened,'prizesOpened')+'</div><p class="helper organizer-only">'+esc(C.treasure.hint)+'</p></section>';
}
function waiting() {
  return heading(C.waiting.title,C.waiting.text)+'<section class="waiting-card">'+powers(null,true)+'<h2>'+esc(C.waiting.readyTitle)+'</h2><p class="lead">'+esc(C.waiting.readyText)+'</p><p>'+esc(C.waiting.hint)+'</p><div class="actions organizer-only">'+nav(U.startFinale,'finale')+'</div></section><div class="actions">'+nav(U.replayDestination,'destination','quiet')+'</div>';
}
function found() {
  return '<section class="celebration">'+heading(C.found.title,C.found.text)+mascot('unicorn')+'<div class="actions organizer-only">'+button(U.confirmFound,'found')+'</div><p class="helper organizer-only">'+esc(C.found.hint)+'</p></section>';
}
function rewards() {
  const t=C.teams[state.rewardIndex];
  return '<section class="reward-screen '+t.id+'">'+heading(t.reward.unlock,'',fmt(U.rewardCounter,{n:state.rewardIndex+1}))+mascot(t.id)+'<div class="reward '+(rewardShown?'revealed':'')+'"><div class="reward-icon" aria-hidden="true">'+t.reward.icon+'</div><h2>'+esc(t.reward.name)+'</h2><p class="lead">'+esc(t.reward.text)+'</p></div><div class="actions">'+button(state.rewardIndex<2?U.nextReward:U.finish,'rewardNext')+'</div></section>';
}
function rescued() {
  return '<section class="celebration">'+heading(C.rescued.title,C.rescued.text)+mascot('unicorn')+'<div class="actions">'+nav(U.revealRewards,'rewards')+'</div></section>';
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
  if(state.currentScreen!=='done') {clearTimeout(celebrationTimer);celebrationTimer=null;finalCelebrating=false;}
  const flags=sceneFlags(), sunnyReturn=lastStorm===true&&!flags.storm;
  lastStorm=flags.storm;
  chrome(flags);
  const screen=state.currentScreen;
  const views={home,setup,reveal,warmup,progress,award,pinata,treasure,waiting,found,rescued,rewards,done};
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
    dialog.innerHTML='<div class="dialog-heading"><h2>'+esc(U.organizer)+'</h2>'+button(U.close,'close','','secondary')+'</div><button class="organizer-photo-button" data-action="photos"><span>'+esc(C.memoryPhotos.menu)+'</span><strong>'+esc(photoStatus())+'</strong></button><div class="actions">'+nav(U.back,prev,'secondary')+(next?nav(U.next,next,'secondary',!G.canVisit(state,next)):'')+'</div><h3>'+esc(U.jump)+'</h3><div class="jump-grid">'+['home','reveal','level1','level2','level3','destination','pinata','treasure','returnMessage','waiting','finale','progress'].map(s=>nav(C.screens[s],s,'secondary',!G.canVisit(state,s))).join('')+'</div><div class="actions">'+nav(U.edit,'setup','quiet')+nav(U.replayIntro,'intro','quiet')+nav(U.replayFinale,'finale','quiet',!G.canVisit(state,'finale'))+'</div><h3>'+esc(U.completions)+'</h3><div class="completion-editor">'+C.teams.map(t=>'<fieldset><legend>'+esc(t.name)+'</legend>'+C.powers.map((p,i)=>'<label><input type="checkbox" data-mark-team="'+t.id+'" data-mark-level="'+i+'"'+(state.teams[t.id].completedLevels[i]?' checked':'')+(!G.levelOpen(state,i)&&!state.teams[t.id].completedLevels[i]?' disabled':'')+'>'+p.icon+' '+esc(p.name)+'</label>').join('')+'</fieldset>').join('')+'</div><details><summary>'+esc(U.answers)+'</summary>'+C.teams.map(t=>'<p>'+esc(t.name)+' → <strong>'+esc(t.word)+'</strong></p>').join('')+'</details><hr>'+button(U.reset,'reset','','danger');
  }
  if(!dialog.open) dialog.showModal();
}
function resume() {
  if(state.rescued) go(state.birthdayComplete?'done':'rewards');
  else if(state.returnInvited) go('waiting');
  else if(state.treasureFound) go('treasure');
  else if(G.eligible(state)) go('pinata');
  else if(G.allTasksComplete(state)) go('destination');
  else if(!state.introCompleted) go('reveal');
  else if(!C.teams.every(t=>state.teams[t.id].gesture!==null)) go('warmup');
  else {
    const next=[0,1,2].find(i=>!G.allComplete(state,i));
    go(next===0?'level1':'transition'+(next+1));
  }
}
document.addEventListener('click', event=>{
  const el=event.target.closest('[data-action]');
  if(!el || el.disabled) return;
  if(M?.snapshot?.().status==='blocked') void M.play();
  switch(el.dataset.action) {
    case 'go': go(el.dataset.screen); break;
    case 'resume': resume(); break;
    case 'presentation': presentation=!presentation; chrome(); break;
    case 'organizer': openOrganizer(); break;
    case 'photos': openPhotoManager(); if(!photosReady) void refreshMemoryPhotos(); break;
    case 'photoRemove': void removeMemoryPhoto(el.dataset.photoId); break;
    case 'photoRemoveAll': void clearMemoryPhotos(true); break;
    case 'celebrate': replayFinalCelebration(); break;
    case 'narrationStart': void N?.play?.(); void M?.play?.(); break;
    case 'narrationToggle': N?.toggle?.(); break;
    case 'narrationReplay': N?.replay?.(); break;
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
    case 'treasureFound': if(G.canVisit(state,'pinata')) {state.treasureFound=true;go('treasure');} break;
    case 'prizesOpened': if(state.treasureFound) {state.returnInvited=true;go('returnMessage');} break;
    case 'found': if(G.canVisit(state,'found')) {state.rescued=true;state.rewardIndex=0;state.birthdayComplete=false;go('rescued');} break;
    case 'rewardNext': if(state.rewardIndex<2) {state.rewardIndex++;rewardShown=false;save();render();} else {state.birthdayComplete=true;go('done');} break;
  }
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.field==='name') {state.children[Number(el.dataset.child)].name=el.value; save();}
});
document.addEventListener('change',event=>{
  const el=event.target;
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
render();
void refreshMemoryPhotos();
})();
