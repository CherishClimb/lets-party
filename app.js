/* DOM rendering and interaction. All user-facing copy comes from CONTENT. */
(function () {
'use strict';
const C = window.CONTENT, G = window.Game, U = C.ui;
const app = document.querySelector('#app'), dialog = document.querySelector('#organizer');
const STORAGE_KEY = 'unicorn-rescue-v1';
let state = G.fresh(), storageError = '', presentation = false, scene = 0, timer = null, returnScreen = 'home', rewardShown = false, lastAward = null;
const sequence = ['home','setup','reveal','intro','warmup','level1','level2','level3','destination','waiting','finale','found','rewards','done'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = (text, args) => text.replace(/\{(\w+)\}/g, (_,key) => args[key] ?? '');
const icon = id => C.icons.find(x=>x[0]===id)?.[1] || C.icons[0][1];
const team = id => C.teams.find(t=>t.id===id);
const children = id => state.children.filter(c=>c.teamId===id && c.name.trim());
const count = id => state.teams[id].completedLevels.filter(Boolean).length;
function button(label, action, attrs='', kind='primary') { return '<button class="'+kind+'" data-action="'+action+'" '+attrs+'>'+esc(label)+'</button>'; }
function nav(label, screen, kind='primary', disabled=false) { return button(label,'go','data-screen="'+screen+'"'+(disabled?' disabled':''),kind); }
function mascot(id, extra='') {
  return '<div class="mascot '+id+' '+extra+'" aria-hidden="true"><span class="tail"></span><span class="limb l1"></span><span class="limb l2"></span><span class="limb l3"></span><span class="limb l4"></span><span class="body"><i class="ear e1"></i><i class="ear e2"></i><i class="horn"></i><i class="mane"></i><i class="eye eye1"></i><i class="eye eye2"></i><i class="cheek cheek1"></i><i class="cheek cheek2"></i><i class="mouth"></i><i class="snout"></i></span><span class="spark s1">✦</span><span class="spark s2">✧</span></div>';
}
function powers(id, labels=false) {
  return '<div class="powers">'+C.powers.map((p,i)=>{
    const earned = id ? state.teams[id].completedLevels[i] : true;
    return '<span class="power '+(earned?'earned':'missing')+(lastAward?.id===id && lastAward?.level===i?' awarding':'')+'" aria-label="'+esc(p.name+(id?' · '+(earned?U.completed:U.pending):''))+'"><span aria-hidden="true">'+p.icon+'</span>'+(labels?'<small>'+esc(p.name)+'</small>':'')+'</span>';
  }).join('')+'</div>';
}
function heading(title, text='', eyebrow='') { return '<div class="page-heading">'+(eyebrow?'<p class="eyebrow">'+esc(eyebrow)+'</p>':'')+'<h1>'+esc(title)+'</h1>'+(text?'<p class="lead">'+esc(text)+'</p>':'')+'</div>'; }
function note(text) { document.querySelector('#notice').textContent = text; }
function save() { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); storageError=''; } catch { storageError=U.saveFailed; note(storageError); } }
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) state=G.normalize(JSON.parse(saved)); } catch { storageError=U.corruptSave; }
document.title = C.app.title;
function cancelTimer() { clearTimeout(timer); timer=null; }
function go(screen) {
  if (!G.canVisit(state,screen)) { note(U.locked); return; }
  if (['reveal','intro','warmup','level1'].includes(screen) && !state.children.some(c=>c.name.trim())) { note(U.childRequired); screen='setup'; }
  if (screen==='progress' && state.currentScreen!=='progress') returnScreen=state.currentScreen;
  cancelTimer(); scene=0; rewardShown=false; state.currentScreen=screen; save();
  if (dialog.open) dialog.close();
  render(); app.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
}
function chrome() {
  document.body.classList.toggle('presentation',presentation);
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
  return '<section class="home-hero"><div class="hero-copy"><p class="eyebrow">'+esc(h.tag)+'</p><h1>'+esc(h.title).replace('\n','<br>')+'</h1><p class="lead">'+esc(h.text)+'</p><div class="actions">'+nav(U.setup,'setup')+(state.children.some(c=>c.name.trim())?button(U.resume,'resume','','secondary'):'')+'</div><div class="stats">'+h.stats.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div></div><div class="hero-art"><div class="rainbow"></div><div class="cloud c1"></div><div class="cloud c2"></div>'+mascot('unicorn','hero-unicorn')+'<span class="floating-star">✦</span><div class="mission"><p class="eyebrow">'+esc(h.mission)+'</p>'+powers(null,true)+'</div></div></section><section class="team-grid home-teams">'+C.teams.map(t=>teamCard(t,'<p>'+esc(fmt(U.childrenCount,{n:children(t.id).length}))+'</p>')).join('')+'</section>';
}
function setup() {
  return heading(C.setup.title,C.setup.text)+ '<p class="helper">'+esc(C.setup.help)+'</p><div class="setup-grid">'+state.children.map((c,i)=>'<article class="child-slot '+c.teamId+'"><div class="slot-heading"><span>'+esc(fmt(U.slot,{n:i+1}))+'</span><span aria-hidden="true">'+icon(c.icon)+'</span></div><label>'+esc(U.name)+'<input data-child="'+i+'" data-field="name" value="'+esc(c.name)+'" placeholder="'+esc(U.empty)+'" maxlength="40" autocomplete="off"></label><div class="field-pair"><label>'+esc(U.icon)+'<select data-child="'+i+'" data-field="icon">'+C.icons.map(x=>'<option value="'+x[0]+'"'+(x[0]===c.icon?' selected':'')+'>'+x[1]+' '+esc(x[2])+'</option>').join('')+'</select></label><label>'+esc(U.team)+'<select data-child="'+i+'" data-field="teamId">'+C.teams.map(t=>'<option value="'+t.id+'"'+(t.id===c.teamId?' selected':'')+'>'+esc(t.short)+'</option>').join('')+'</select></label></div></article>').join('')+'</div><div class="actions">'+nav(U.begin,'reveal')+'</div>';
}
function reveal() {
  return heading(C.reveal.title,C.reveal.text)+'<div class="team-grid reveal">'+C.teams.map(t=>teamCard(t,roster(t))).join('')+'</div><div class="actions">'+nav(U.next,'intro')+'</div>';
}
function warmup() {
  return heading(C.warmup.title,C.warmup.text)+'<div class="team-grid">'+C.teams.map(t=>{
    const chosen=state.teams[t.id].gesture;
    return teamCard(t,'<div class="gesture-list">'+t.gestures.map((g,i)=>button(g,'gesture','data-team="'+t.id+'" data-index="'+i+'" aria-pressed="'+(chosen===i)+'"',chosen===i?'gesture chosen':'gesture')).join('')+'</div>'+(chosen!==null?'<div class="photo-cue"><strong>'+esc(U.countdown)+'</strong><label class="secondary photo-button">'+esc(U.photo)+'<input type="file" accept="image/*" capture="environment" data-photo="'+t.id+'"></label></div>':'<p class="muted">'+esc(U.selectGesture)+'</p>'));
  }).join('')+'</div><p class="helper">'+esc(U.photoHint)+'</p><div class="actions">'+nav(U.next,'level1','primary',!C.teams.every(t=>state.teams[t.id].gesture!==null))+'</div>';
}
function level(index) {
  const l=C.levels[index];
  return heading(l.title,l.story,fmt(U.levelLabel,{n:index+1}))+'<section class="rule-card"><div><h2>'+esc(l.subtitle)+'</h2><ul class="rules">'+l.rules.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul></div>'+(l.mats?'<div class="mat-illustration" aria-hidden="true">'+Array.from({length:5},(_,i)=>'<span class="mat '+(i>=l.mats?'blown':'')+'">'+(i+1)+'</span>').join('')+'</div>':'<div class="search-symbol" aria-hidden="true">✧ ? ✧</div>')+'</section><p class="helper organizer-only">'+esc(l.organizer)+'</p><div class="team-grid compact">'+C.teams.map(t=>{
    const done=state.teams[t.id].completedLevels[index];
    return teamCard(t,(index===2?'<p>'+esc(U.missingPart)+'</p><div class="word-slots" aria-label="'+esc(done?t.word:fmt(U.wordSlots,{n:t.word.length}))+'">'+(done?esc(t.word):Array.from(t.word,()=>'<span aria-hidden="true"></span>').join(''))+'</div>':'')+powers(t.id)+'<p class="team-status">'+esc(done?fmt(U.powerRestored,{power:C.powers[index].name}):U.pending)+'</p><div class="organizer-only">'+button(done?U.undo:index===2?U.wordFound:U.complete,'mark','data-team="'+t.id+'" data-level="'+index+'"',done?'quiet':'primary')+'</div>',done?'complete':'');
  }).join('')+'</div><div class="actions">'+nav(index===2?U.revealDestination:U.next,index===2?'destination':'level'+(index+2),'primary',!G.allComplete(state,index))+'</div>'+(!G.allComplete(state,index)?'<p class="helper">'+esc(U.waitTeams)+'</p>':'');
}
function progress() {
  return heading(U.progress,U.progressHint)+'<div class="team-grid">'+C.teams.map(t=>teamCard(t,powers(t.id,true)+'<strong class="big-count">'+esc(fmt(U.progressCount,{n:count(t.id)}))+'</strong><p>'+esc(count(t.id)===3?U.ready:U.pending)+'</p>')).join('')+'</div><div class="actions">'+nav(U.returnGame,G.canVisit(state,returnScreen)?returnScreen:'home','secondary')+(G.eligible(state)?nav(U.unlock,'waiting'):'')+'</div>';
}
function visual(type) {
  if (type==='words') return '<div class="destination-parts">'+C.destinationWords.parts.map(w=>'<span>'+esc(w)+'</span>').join('<b>+</b>')+'</div>';
  if (type==='joined' || type==='courtyard') return '<div class="destination-joined">'+esc(C.destinationWords.joined)+(type==='courtyard'?'<strong>'+esc(C.destinationWords.final)+'</strong>':'')+'</div>';
  if (type==='teams' || type==='thanks') return '<div class="scene-teams">'+C.teams.map(t=>mascot(t.id)).join('')+'</div>';
  if (type==='pause') return '<div class="pause-spark" aria-hidden="true">✧</div>';
  return '<div class="story-art '+type+'"><div class="cloud c1"></div><div class="cloud c2"></div>'+mascot('unicorn')+(type==='lost'||type==='restore'?'<div class="flying-powers">'+powers(null,true)+'</div>':'')+'</div>';
}
function scheduleScene() {
  cancelTimer();
  const screen=state.currentScreen;
  if (screen==='rewards' && !rewardShown && !dialog.open) { timer=setTimeout(()=>{rewardShown=true;document.querySelector('.reward')?.classList.add('revealed');},900); return; }
  const scenes=C[screen];
  if (!Array.isArray(scenes) || dialog.open) return;
  if (scene<scenes.length-1 || screen==='finale') timer=setTimeout(()=>advanceScene(),scenes[scene].duration);
}
function advanceScene() {
  const screen=state.currentScreen, scenes=C[screen];
  if (!Array.isArray(scenes)) return;
  if (scene<scenes.length-1) {scene++; render();}
  else if(screen==='intro') {state.introCompleted=true; go('warmup');}
  else if(screen==='destination') go('waiting');
  else if(screen==='finale') go('found');
}
function story(screen) {
  const scenes=C[screen], item=scenes[scene], last=scene===scenes.length-1;
  const nextLabel=screen==='intro' && last?U.startAdventure:screen==='destination' && last?U.toWaiting:U.next;
  return '<section class="story '+item.visual+'">'+heading(C.screens[screen],'',fmt(U.stepCounter,{n:scene+1,total:scenes.length}))+'<div class="scene-visual">'+visual(item.visual)+'</div><p class="story-text">'+esc(item.text).replaceAll('\n','<br>')+'</p><div class="scene-dots" aria-hidden="true">'+scenes.map((_,i)=>'<i class="'+(i===scene?'active':'')+'"></i>').join('')+'</div><div class="actions">'+(scene?button(U.back,'sceneBack','','secondary'):'')+button(nextLabel,'sceneNext')+(screen==='intro'?button(U.skip,'skip','','quiet'):'')+'</div></section>';
}
function waiting() {
  return heading(C.waiting.title,C.waiting.text)+'<section class="waiting-card">'+powers(null,true)+'<h2>'+esc(C.waiting.readyTitle)+'</h2><p class="lead">'+esc(C.waiting.readyText)+'</p><p>'+esc(C.waiting.hint)+'</p><div class="actions organizer-only">'+nav(U.startFinale,'finale')+'</div></section><div class="actions">'+nav(U.replayDestination,'destination','quiet')+'</div>';
}
function found() {
  return '<section class="celebration">'+heading(C.found.title,C.found.text)+mascot('unicorn')+'<div class="actions organizer-only">'+button(U.confirmFound,'found')+'</div><p class="helper organizer-only">'+esc(C.found.hint)+'</p></section>';
}
function rewards() {
  const t=C.teams[state.rewardIndex];
  return '<section class="reward-screen '+t.id+'">'+heading(fmt(U.rewardUnlocked,{team:t.name}),'',fmt(U.rewardCounter,{n:state.rewardIndex+1}))+mascot(t.id)+'<div class="reward '+(rewardShown?'revealed':'')+'"><div class="reward-icon" aria-hidden="true">'+t.reward.icon+'</div><h2>'+esc(t.reward.name)+'</h2><p class="lead">'+esc(t.reward.text)+'</p></div><div class="actions">'+button(state.rewardIndex<2?U.nextReward:U.finish,'rewardNext')+'</div></section>';
}
function done() {
  return '<section class="celebration">'+heading(C.done.title,C.done.text)+mascot('unicorn')+'<div class="reward-summary">'+C.teams.map(t=>'<article class="'+t.id+'"><h2>'+esc(t.name)+'</h2><span aria-hidden="true">'+t.reward.icon+'</span><p>'+esc(t.reward.name)+'</p></article>').join('')+'</div><div class="actions">'+nav(U.progress,'progress','secondary')+'</div></section>';
}
function render() {
  cancelTimer(); chrome();
  const screen=state.currentScreen;
  const views={home,setup,reveal,warmup,progress,waiting,found,rewards,done};
  app.innerHTML=views[screen]?views[screen]():/^level/.test(screen)?level(Number(screen.slice(-1))-1):story(screen);
  note(storageError);
  scheduleScene();

}
function openOrganizer(reset=false) {
  cancelTimer();
  if(reset) {
    dialog.innerHTML='<h2>'+esc(U.resetQuestion)+'</h2><p>'+esc(U.resetDetail)+'</p><div class="actions">'+button(U.cancel,'organizer','','secondary')+button(U.confirmReset,'resetConfirm','','danger')+'</div>';
  } else {
    const idx=sequence.indexOf(state.currentScreen), prev=sequence[Math.max(0,idx-1)], next=sequence[idx+1];
    dialog.innerHTML='<div class="dialog-heading"><h2>'+esc(U.organizer)+'</h2>'+button(U.close,'close','','secondary')+'</div><div class="actions">'+nav(U.back,prev,'secondary')+(next?nav(U.next,next,'secondary',!G.canVisit(state,next)):'')+'</div><h3>'+esc(U.jump)+'</h3><div class="jump-grid">'+['home','reveal','level1','level2','level3','waiting','finale','progress'].map(s=>nav(C.screens[s],s,'secondary',!G.canVisit(state,s))).join('')+'</div><div class="actions">'+nav(U.edit,'setup','quiet')+nav(U.replayIntro,'intro','quiet')+nav(U.replayFinale,'finale','quiet',!G.eligible(state))+'</div><h3>'+esc(U.completions)+'</h3><div class="completion-editor">'+C.teams.map(t=>'<fieldset><legend>'+esc(t.name)+'</legend>'+C.powers.map((p,i)=>'<label><input type="checkbox" data-mark-team="'+t.id+'" data-mark-level="'+i+'"'+(state.teams[t.id].completedLevels[i]?' checked':'')+(!G.levelOpen(state,i)&&!state.teams[t.id].completedLevels[i]?' disabled':'')+'>'+p.icon+' '+esc(p.name)+'</label>').join('')+'</fieldset>').join('')+'</div><details><summary>'+esc(U.answers)+'</summary>'+C.teams.map(t=>'<p>'+esc(t.name)+' → <strong>'+esc(t.word)+'</strong></p>').join('')+'</details><hr>'+button(U.reset,'reset','','danger');
  }
  if(!dialog.open) dialog.showModal();
}
function resume() {
  if(state.rescued) go('done');
  else if(G.eligible(state)) go('waiting');
  else if(!state.introCompleted) go('reveal');
  else if(!C.teams.every(t=>state.teams[t.id].gesture!==null)) go('warmup');
  else go('level'+([0,1,2].find(i=>!G.allComplete(state,i))+1));
}
document.addEventListener('click', event=>{
  const el=event.target.closest('[data-action]');
  if(!el || el.disabled) return;
  switch(el.dataset.action) {
    case 'go': go(el.dataset.screen); break;
    case 'resume': resume(); break;
    case 'presentation': presentation=!presentation; chrome(); break;
    case 'organizer': openOrganizer(); break;
    case 'close': dialog.close(); break;
    case 'reset': openOrganizer(true); break;
    case 'resetConfirm': state=G.fresh(); returnScreen='home'; presentation=false; go('home'); note(U.resetDone); break;
    case 'gesture': state.teams[el.dataset.team].gesture=Number(el.dataset.index); save(); render(); break;
    case 'mark': {
      const id=el.dataset.team, n=Number(el.dataset.level), was=state.teams[id].completedLevels[n];
      G.mark(state,id,n,!was); lastAward=was?null:{id,level:n}; save(); render(); lastAward=null; note(was?U.undo:fmt(U.powerRestored,{power:C.powers[n].name})); break;
    }
    case 'sceneNext': advanceScene(); break;
    case 'sceneBack': scene=Math.max(0,scene-1); render(); break;
    case 'skip': state.introCompleted=true; go('warmup'); break;
    case 'found': if(G.eligible(state)) {state.rescued=true;state.rewardIndex=0;go('rewards');} break;
    case 'rewardNext': if(state.rewardIndex<2) {state.rewardIndex++;rewardShown=false;save();render();} else go('done'); break;
  }
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.field==='name') {state.children[Number(el.dataset.child)].name=el.value; save();}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.child!==undefined) {
    const c=state.children[Number(el.dataset.child)]; c[el.dataset.field]=el.value; save();
    if(el.dataset.field!=='name') {
      const card=el.closest('.child-slot'); card.className='child-slot '+c.teamId;
      card.querySelector('.slot-heading span:last-child').textContent=icon(c.icon);
    }
  }
  if(el.dataset.markTeam) {
    G.mark(state,el.dataset.markTeam,Number(el.dataset.markLevel),el.checked); save(); render(); openOrganizer();
  }
  if(el.dataset.photo) { if(el.files?.length) note(U.photoSelected); el.value=''; }
});
dialog.addEventListener('close',()=>scheduleScene());
render();
})();
