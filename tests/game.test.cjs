/* Run with: node --test tests/game.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const G = require('../game.js');
const root = path.resolve(__dirname,'..');

function harness(saved, storageThrows=false, photoRecords=null, audioMode='ok') {
  const listeners = {}, timers = new Map(); let tid=0, stored=saved;
  const audioInstances=[];
  class FakeAudio {
    constructor(){this.src='';this.preload='';this.currentTime=0;this.paused=true;this.mode=audioMode;this.playCalls=0;this.pauseCalls=0;this.handlers={};audioInstances.push(this);}
    addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
    emit(type){for(const fn of this.handlers[type]||[]) fn();}
    load(){if(!this.src)return;if(this.mode==='missing')this.emit('error');else this.emit('canplay');}
    play(){this.playCalls++;if(this.mode==='blocked'){const error=Error('blocked');error.name='NotAllowedError';return Promise.reject(error);}if(this.mode==='missing'){const error=Error('missing');error.name='NotSupportedError';return Promise.reject(error);}this.paused=false;this.emit('playing');return Promise.resolve();}
    pause(){this.pauseCalls++;if(!this.paused){this.paused=true;this.emit('pause');}}
    removeAttribute(name){if(name==='src')this.src='';}
  }
  const element = () => ({innerHTML:'',textContent:'',open:false,hidden:false,focus(){},querySelector(){return null;},setAttribute(){},classList:{toggle(){},add(){}},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});
  const elements = Object.fromEntries(['#app','#header','#footer','#notice','#organizer','.reward'].map(k=>[k,element()]));
  const dialog=elements['#organizer'];
  dialog.showModal=()=>{dialog.open=true;};
  dialog.close=()=>{dialog.open=false;dialog.handlers['close']?.();};
  const context = {
    console, window:null, document:{title:'',body:element(),querySelector:s=>elements[s],addEventListener:(type,fn)=>listeners[type]=fn},
    localStorage:{getItem:()=>stored,setItem:(key,value)=>{if(storageThrows) throw Error('blocked');stored=value;}},
    setTimeout:fn=>{timers.set(++tid,fn);return tid;},clearTimeout:id=>timers.delete(id),scrollTo(){},
    URL:{createObjectURL:blob=>'blob:'+blob.id,revokeObjectURL(){}},Audio:FakeAudio
  };
  context.window=context;
  vm.createContext(context);
  for(const name of ['content.js','game.js','photo-store.js','narration.js']) vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
  if(photoRecords) context.PhotoStore.list=()=>Promise.resolve(photoRecords);
  vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context,{filename:'app.js'});
  return {
    context,elements,
    click(action,data={}) {listeners.click({target:{closest:()=>({dataset:{action,...data},disabled:false})}});},
    input(index,name) {listeners.input({target:{dataset:{child:String(index),field:'name'},value:name}});},
    change(data) {listeners.change({target:data});},
    tick() { const entry=timers.entries().next().value; assert.ok(entry,'expected active animation timer'); timers.delete(entry[0]);entry[1](); },
    timerCount:()=>timers.size,
    state:()=>JSON.parse(stored),
    html:()=>elements['#app'].innerHTML,
    serialized:()=>stored,
    audio:()=>audioInstances[0],
    audioCount:()=>audioInstances.length
  };
}
function fill(h) { h.click('go',{screen:'setup'}); h.input(0,'Emma');h.input(4,'Noah');h.input(8,'Mia'); }
function complete(h,n) { for(const id of G.teamIds) { h.click('mark',{team:id,level:String(n)}); if(n<2) { assert.match(h.html(),/gefunden!/); h.click('go',{screen:'level'+(n+1)}); } } }
function finishState() {const s=G.fresh();s.children[0].name='Emma';for(let i=0;i<3;i++) for(const id of G.teamIds) G.mark(s,id,i,true);G.revealClue(s);s.treasureFound=true;s.returnInvited=true;return s;}

test('12 slots, four default places per team, empty places allowed',()=>{
  const s=G.fresh();assert.equal(s.children.length,12);
  for(const id of G.teamIds) assert.equal(s.children.filter(c=>c.teamId===id).length,4);
  assert.ok(s.children.every(c=>!c.name));
});
test('finale eligibility is exactly all nine completions across 512 combinations',()=>{
  for(let mask=0;mask<512;mask++) {
    const s=G.fresh();s.clueRevealed=true;s.treasureFound=true;s.returnInvited=true;G.teamIds.forEach((id,t)=>[0,1,2].forEach(i=>s.teams[id].completedLevels[i]=Boolean(mask&(1<<(t*3+i)))));
    assert.equal(G.eligible(s),mask===511);
    assert.equal(G.canVisit(s,'finale'),mask===511);
  }
});
test('progression blocks premature marking, supports idempotence and undo',()=>{
  const s=G.fresh();
  assert.equal(G.mark(s,'monster',1,true),false);
  for(const id of G.teamIds) G.mark(s,id,0,true);
  G.mark(s,'monster',0,true);
  assert.equal(s.teams.monster.completedLevels.filter(Boolean).length,1);
  assert.equal(G.canVisit(s,'level2'),true);
  G.mark(s,'monster',0,false);
  assert.equal(G.canVisit(s,'level2'),false);
  assert.equal(G.mark(s,'unknown',0,true),false);
});
test('undo relocks finale and rewards while preserving unrelated work',()=>{
  const s=finishState();s.currentScreen='rewards';s.rescued=true;
  G.mark(s,'monster',0,false);
  assert.equal(s.currentScreen,'progress');assert.equal(s.rescued,false);
  assert.equal(G.canVisit(s,'finale'),false);assert.equal(G.canVisit(s,'done'),false);
  assert.equal(s.teams.monster.completedLevels[2],true);
});
test('stored data is normalized and invalid screens cannot bypass gates',()=>{
  const input=G.fresh();input.currentScreen='finale';input.rescued=true;
  input.children[0]={name:'A'.repeat(80),icon:'invalid',teamId:'invalid'};
  input.teams.monster={gesture:77,completedLevels:['true',true,0]};
  const s=G.normalize(input);
  assert.equal(s.currentScreen,'home');assert.equal(s.rescued,false);
  assert.equal(s.children[0].name.length,40);assert.equal(s.children[0].teamId,'monster');
  assert.equal(s.teams.monster.gesture,null);assert.deepEqual(s.teams.monster.completedLevels,[false,true,false]);
  assert.throws(()=>G.normalize({}));
});
test('home and setup follow the storybook team layout without changing the 12 slots',()=>{
  const h=harness();
  assert.match(h.html(),/LUCYS 6\. GEBURTSTAG/);
  assert.match(h.html(),/Ein magisches Abenteuer beginnt/);
  assert.doesNotMatch(h.html(),/3 Rettungsteams|3 Abenteuer|1 Einhorn/);
  h.click('go',{screen:'setup'});
  assert.equal((h.html().match(/class="setup-team /g)||[]).length,3);
  assert.equal((h.html().match(/data-field="name"/g)||[]).length,12);
  assert.match(h.html(),/Die kleinen Monster/);assert.match(h.html(),/Die kleinen Oktopusse/);assert.match(h.html(),/Die kleinen Krokodile/);
});
test('full birthday adventure: powers, schoolyard treasure, return, balloon, snacks and birthday image',()=>{
  const h=harness();fill(h);h.click('go',{screen:'reveal'});
  assert.match(h.html(),/Emma/);assert.match(h.html(),/Noah/);assert.match(h.html(),/Mia/);
  h.click('go',{screen:'intro'});
  assert.match(h.html(),/6 Jahre alt – genau wie Lucy/);
  assert.equal((h.html().match(/class="candle"/g)||[]).length,6);
  for(let i=0;i<5;i++) h.click('sceneNext');
  assert.match(h.html(),/RETTEN WIR DAS EINHORN!/);assert.match(h.html(),/Emma/);
  h.click('sceneNext');
  G.teamIds.forEach((id,teamIndex)=>{
    for(let pose=0;pose<3;pose++) h.click('poseDone',{team:id,pose:String(pose)});
    if(teamIndex<2) h.click('warmupTeam',{index:String(teamIndex+1)});
  });
  assert.doesNotMatch(h.html(),/type="file"|capture=/);
  h.click('go',{screen:'level1'});complete(h,0);
  assert.equal(h.state().currentScreen,'level1');
  h.click('go',{screen:'transition2'});h.tick();assert.match(h.html(),/NUR NOCH 4 MATTEN/);
  h.click('sceneNext');assert.equal(h.state().currentScreen,'level2');complete(h,1);
  h.click('go',{screen:'transition3'});assert.match(h.html(),/geheime Spur/);h.click('sceneNext');
  assert.equal(h.state().currentScreen,'level3');
  assert.doesNotMatch(h.html(),/BREIT|WIESEN|SCHULE/);
  complete(h,2);
  assert.equal(h.state().clueRevealed,false);
  assert.doesNotMatch(h.html(),/BREIT|WIESEN|SCHULE/,'parent task screen does not leak words even after marking');
  h.click('go',{screen:'destination'});
  assert.match(h.html(),/Was könnte das bedeuten/);assert.match(h.html(),/ZAUBERWÖRTER VERBINDEN/);
  assert.equal(h.timerCount(),0,'word reveal waits for the organizer to combine them');
  h.click('sceneNext');assert.match(h.html(),/BREITWIESENSCHULE/);
  h.tick();assert.match(h.html(),/HOF/);assert.equal(h.state().clueRevealed,true);
  h.tick();assert.match(h.html(),/KLUGHEIT IST ZURÜCK/);
  h.tick();assert.match(h.html(),/DIE SPUR FÜHRT ZUM SCHULHOF/);
  h.click('sceneNext');assert.equal(h.state().currentScreen,'pinata');
  assert.match(h.html(),/SUCHT DEN EINHORN-SCHATZ/);assert.equal(h.timerCount(),0);
  h.click('treasureFound');assert.equal(h.state().currentScreen,'treasure');
  assert.match(h.html(),/kleine Geburtstagsüberraschung/);assert.equal(h.timerCount(),0);
  h.click('prizesOpened');h.tick();h.tick();assert.match(h.html(),/KEHRT ZURÜCK/);
  h.click('sceneNext');assert.equal(h.state().currentScreen,'waiting');
  assert.match(h.html(),/Alle drei Zauberkräfte sind sicher/);assert.equal(h.timerCount(),0);
  assert.doesNotMatch(h.html(),/mascot unicorn|Zaubertrank|Zauberschokolade|Marshmallow/);
  h.click('go',{screen:'finale'});
  for(let i=0;i<h.context.CONTENT.finale.length;i++) h.tick();
  assert.equal(h.state().currentScreen,'found');assert.match(h.html(),/FINDET MICH!/);
  assert.doesNotMatch(h.html(),/Zaubertrank|Zauberschokolade|Marshmallow/);
  h.click('found');assert.equal(h.state().currentScreen,'rescued');
  assert.match(h.html(),/DAS GEBURTSTAGS-EINHORN IST GERETTET/);
  h.click('go',{screen:'rewards'});assert.match(h.html(),/Zaubertrank gefunden!/);h.tick();
  h.click('rewardNext');assert.match(h.html(),/Schoko-Schatz gefunden!/);h.tick();
  h.click('rewardNext');assert.match(h.html(),/Wolkenkuss gefunden!/);assert.match(h.html(),/Alle drei Geburtstagsschätze sind zurück!/);assert.match(h.html(),/Jetzt wird gefeiert! 🎉/);h.tick();
  h.click('rewardNext');assert.equal(h.state().currentScreen,'done');
  assert.match(h.html(),/Alles Gute zum 6. Geburtstag, Lucy!/);
  assert.match(h.html(),/Assets\/lucy-unicorn-cutout.png/);
  assert.doesNotMatch(h.html(),/Emma|Noah|Mia|Unsere Helden:/);
  assert.match(h.html(),/final-cake/);
  assert.doesNotMatch(h.html(),/Gemeinsam seid ihr magisch/);
});
test('refresh restores names, gesture, team assignments, completion and current screen',()=>{
  const h=harness();fill(h);h.click('gesture',{team:'monster',index:'2'});
  h.click('go',{screen:'level1'});h.click('mark',{team:'monster',level:'0'});
  const loaded=harness(h.serialized());assert.match(loaded.html(),/MUT gefunden/);
  assert.equal(loaded.state().children[0].name,'Emma');
  assert.equal(loaded.state().teams.monster.gesture,2);
  assert.equal(loaded.state().currentScreen,'award');
});
test('escaping child names prevents injected markup in reveal',()=>{
  const h=harness();fill(h);h.input(0,'<img src=x onerror=alert(1)>');h.click('go',{screen:'reveal'});
  assert.doesNotMatch(h.html(),/<img src=x/);assert.match(h.html(),/&lt;img/);
});
test('narrated intro scenes wait for the parent while organizer controls are open',()=>{
  const h=harness();fill(h);h.click('go',{screen:'intro'});assert.equal(h.timerCount(),0);
  h.click('organizer');assert.equal(h.timerCount(),0);
  h.click('close');assert.equal(h.timerCount(),0);
  h.click('go',{screen:'setup'});assert.equal(h.timerCount(),0);
});
test('organizer shortcuts cannot bypass finale and rescue requirements',()=>{
  const h=harness();fill(h);h.click('go',{screen:'finale'});
  assert.equal(h.state().currentScreen,'setup');
  const full=harness(JSON.stringify(finishState()));full.click('go',{screen:'rewards'});
  assert.equal(full.state().currentScreen,'home');
});
test('reset is confirmed and clears the entire setup and progress',()=>{
  const h=harness();let photosCleared=false;h.context.PhotoStore.clear=()=>{photosCleared=true;return Promise.resolve();};
  fill(h);h.click('reset');assert.equal(h.state().children[0].name,'Emma');
  h.click('resetConfirm');assert.ok(h.state().children.every(c=>!c.name));
  assert.equal(h.state().currentScreen,'home');assert.equal(photosCleared,true);
});
test('organizer opens memory photos without changing story progress',()=>{
  const h=harness(JSON.stringify(G.fresh()));const before=h.serialized();
  h.click('organizer');assert.match(h.elements['#organizer'].innerHTML,/📷 Erinnerungsfotos/);assert.match(h.elements['#organizer'].innerHTML,/0\/3/);
  h.click('photos');
  assert.match(h.elements['#organizer'].innerHTML,/Bis zu 3 Fotos für die Geburtstagsseite auswählen/);
  assert.match(h.elements['#organizer'].innerHTML,/accept="image\/jpeg,image\/png,image\/webp/);
  assert.match(h.elements['#organizer'].innerHTML,/multiple data-photo-input/);
  assert.equal(h.serialized(),before);assert.equal(h.state().currentScreen,'home');
  assert.equal(h.context.PhotoStore.MAX_EDGE,1400);
});
test('invalid saves and unavailable storage show useful messages without stopping gameplay',()=>{
  const corrupt=harness('{bad');assert.match(corrupt.elements['#notice'].textContent,/nicht gelesen/);
  const blocked=harness(undefined,true);fill(blocked);blocked.click('go',{screen:'reveal'});
  assert.match(blocked.html(),/Emma/);assert.match(blocked.elements['#notice'].textContent,/Speichern/);
});


test('reward reveal resumes after opening the organizer',()=>{
  const s=finishState();s.rescued=true;s.currentScreen='rewards';
  const h=harness(JSON.stringify(s));assert.equal(h.timerCount(),1);
  h.click('organizer');assert.equal(h.timerCount(),0);
  h.click('close');assert.equal(h.timerCount(),1);h.tick();
});
test('moving a child and choosing an icon persist independently of team completion',()=>{
  const h=harness();fill(h);
  const card={className:'',querySelector:()=>({textContent:''})};
  h.change({dataset:{child:'0',field:'teamId'},value:'octopus',closest:()=>card});
  h.change({dataset:{child:'0',field:'icon'},value:'moon',closest:()=>card});
  const loaded=harness(h.serialized());
  assert.equal(loaded.state().children[0].teamId,'octopus');
  assert.equal(loaded.state().children[0].icon,'moon');
  assert.equal(loaded.state().children.length,12);
});
test('warm-up shows one team with three fixed pose cards and keeps the saved-state shape',()=>{
  const h=harness();fill(h);h.click('go',{screen:'warmup'});
  assert.match(h.html(),/Monster-Krallen/);assert.match(h.html(),/Monster-Turm/);assert.match(h.html(),/Monster-Brüllen/);
  assert.doesNotMatch(h.html(),/8 Tentakel|Schnapp-Krokodil/);
  assert.doesNotMatch(h.html(),/type="file"|capture=/);
  assert.match(h.html(),/0 \/ 3 Posen/);
  for(let pose=0;pose<3;pose++) {
    h.click('poseDone',{team:'monster',pose:String(pose)});
    assert.equal((h.html().match(/class="pose-check"/g)||[]).length,pose+1);
    assert.match(h.html(),new RegExp((pose+1)+' \\/ 3 Posen'));
  }
  assert.match(h.html(),/Team-Zauber geschafft!/);
  const saved=h.state();assert.equal(saved.teams.monster.gesture,0);
  assert.deepEqual(Object.keys(saved.teams.monster).sort(),['completedLevels','gesture']);
  h.click('warmupTeam',{index:'1'});assert.match(h.html(),/8 Tentakel/);assert.doesNotMatch(h.html(),/Monster-Turm|Schnapp-Krokodil/);
});

test('Klugheit is awarded at the combined clue reveal, not when individual words are marked',()=>{
  const s=G.fresh();
  for(let i=0;i<3;i++) for(const id of G.teamIds) G.mark(s,id,i,true);
  assert.equal(G.allTasksComplete(s),true);
  for(const id of G.teamIds) assert.equal(G.earned(s,id,2),false);
  assert.equal(G.canVisit(s,'destination'),true);
  assert.equal(G.canVisit(s,'pinata'),false);
  G.revealClue(s);
  for(const id of G.teamIds) assert.equal(G.earned(s,id,2),true);
  assert.equal(G.canVisit(s,'pinata'),true);
  assert.equal(G.canVisit(s,'finale'),false,'schoolyard return message is still pending');
});
test('piñata prizes and return invitation persist, and undo relocks later story stages',()=>{
  const s=finishState();s.currentScreen='waiting';
  const restored=G.normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.currentScreen,'waiting');
  assert.equal(restored.treasureFound,true);assert.equal(restored.returnInvited,true);
  G.mark(restored,'monster',2,false);
  assert.equal(restored.clueRevealed,false);assert.equal(restored.treasureFound,false);
  assert.equal(restored.returnInvited,false);assert.equal(G.canVisit(restored,'waiting'),false);
});
test('version 1 saves migrate without losing children, teams or already earned progress',()=>{
  const old=finishState();old.version=1;old.currentScreen='waiting';
  delete old.clueRevealed;delete old.treasureFound;delete old.returnInvited;
  const migrated=G.normalize(old);
  assert.equal(migrated.version,2);assert.equal(migrated.children[0].name,'Emma');
  assert.equal(migrated.currentScreen,'waiting');assert.equal(G.canVisit(migrated,'finale'),true);
  const partial=G.fresh();partial.version=1;partial.children[2].name='Lucy';
  G.mark(partial,'octopus',0,true);
  const loaded=G.normalize(partial);
  assert.equal(loaded.children[2].name,'Lucy');assert.equal(G.earned(loaded,'octopus',0),true);
  assert.equal(loaded.clueRevealed,false);
});
test('six intro scenes have central audio mappings and valid story transitions',()=>{
  const h=harness(),c=h.context.CONTENT;
  assert.equal(c.intro.length,6);assert.equal(c.storyAudio.intro.length,6);
  c.storyAudio.intro.forEach((src,i)=>assert.equal(src,'Assets/Audio/story/scene-'+String(i+1).padStart(2,'0')+'.mp3'));
  for(const [from,to] of Object.entries(c.storyNext)) {
    assert.ok(Array.isArray(c[from]),from);assert.ok(c.screens[to],to);
  }
});
test('one narration player follows intro scenes and supports pause, resume and replay',()=>{
  const h=harness();fill(h);h.click('go',{screen:'intro'});
  assert.equal(h.context.StoryNarration.snapshot().id,'intro:1');
  assert.equal(h.context.StoryNarration.snapshot().status,'playing');
  assert.match(h.audio().src,/scene-01\.mp3$/);assert.equal(h.timerCount(),0);assert.equal(h.audioCount(),1);
  assert.match(h.html(),/Geschichte starten/);assert.match(h.html(),/Nochmal h/);
  h.audio().currentTime=4;h.click('narrationToggle');assert.equal(h.context.StoryNarration.snapshot().status,'paused');assert.equal(h.audio().currentTime,4);
  h.click('narrationToggle');assert.equal(h.context.StoryNarration.snapshot().status,'playing');
  h.audio().currentTime=5;h.click('narrationReplay');assert.equal(h.audio().currentTime,0);
  const pauses=h.audio().pauseCalls;h.click('sceneNext');
  assert.equal(h.context.StoryNarration.snapshot().id,'intro:2');assert.match(h.audio().src,/scene-02\.mp3$/);assert.ok(h.audio().pauseCalls>pauses);
  h.audio().emit('ended');assert.equal(h.context.StoryNarration.snapshot().status,'ended');assert.equal(h.timerCount(),0);
  assert.equal(h.context.StoryNarration.snapshot().id,'intro:2');
  h.click('skip');assert.equal(h.context.StoryNarration.snapshot().status,'idle');assert.equal(h.audio().src,'');
});
test('blocked autoplay can be unlocked without changing the scene',async()=>{
  const h=harness(undefined,false,null,'blocked');fill(h);h.click('go',{screen:'intro'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.context.StoryNarration.snapshot().status,'blocked');assert.equal(h.context.StoryNarration.snapshot().id,'intro:1');
  h.audio().mode='ok';h.click('narrationStart');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.context.StoryNarration.snapshot().status,'playing');assert.equal(h.context.StoryNarration.snapshot().id,'intro:1');
});
test('missing narration stays hidden and never blocks story navigation',async()=>{
  const h=harness(undefined,false,null,'missing');fill(h);h.click('go',{screen:'intro'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.context.StoryNarration.snapshot().status,'missing');assert.match(h.html(),/narration-controls" hidden/);
  h.click('sceneNext');assert.equal(h.context.StoryNarration.snapshot().id,'intro:2');assert.equal(h.state().currentScreen,'intro');
});
test('atmosphere follows storm and restored-magic story state',()=>{
  const intro=harness();fill(intro);intro.click('go',{screen:'reveal'});intro.click('go',{screen:'intro'});
  assert.match(intro.html(),/day-decor/);
  intro.click('sceneNext');intro.click('sceneNext');intro.click('sceneNext');
  assert.match(intro.html(),/storm-decor/);
  intro.click('skip');
  assert.match(intro.html(),/storm-decor/);

  const mission=G.fresh();mission.introCompleted=true;mission.currentScreen='progress';
  assert.match(harness(JSON.stringify(mission)).html(),/storm-decor/);

  const collected=finishState();collected.returnInvited=false;collected.treasureFound=false;collected.currentScreen='pinata';
  assert.match(harness(JSON.stringify(collected)).html(),/storm-decor/);

  const restored=finishState();restored.currentScreen='waiting';
  assert.match(harness(JSON.stringify(restored)).html(),/day-decor/);
});
test('final birthday image uses the transparent cutout and omits participant names',()=>{
  const s=finishState();s.rescued=true;s.currentScreen='done';
  s.children[1].name='<script>alert(1)</script>';s.children[2].name='   ';
  const h=harness(JSON.stringify(s));
  assert.doesNotMatch(h.html(),/Emma|&lt;script&gt;|<script>|Unsere Helden/);
  const imagePath=h.context.CONTENT.done.image;
  assert.ok(fs.existsSync(path.join(root,imagePath)));
  const png=fs.readFileSync(path.join(root,imagePath));
  assert.equal(png.toString('ascii',1,4),'PNG');
  assert.equal(png[25],6,'cutout must be an RGBA PNG');
  assert.equal((h.html().match(/<img /g)||[]).length,1);
});
test('finishing team rewards resumes at the final birthday image',()=>{
  const s=finishState();s.rescued=true;s.currentScreen='rewards';s.rewardIndex=2;
  const h=harness(JSON.stringify(s));h.click('rewardNext');
  assert.equal(h.state().birthdayComplete,true);
  h.click('go',{screen:'home'});h.click('resume');
  assert.equal(h.state().currentScreen,'done');
});

test('birthday screen without photos contains the greeting, illustration and cake only',()=>{
  const s=finishState();s.rescued=true;s.currentScreen='done';
  s.children[1].name='Lucy';s.children[2].name='   ';
  const h=harness(JSON.stringify(s));
  const visible=h.html().replace(/<[^>]*>/g,'');
  assert.equal(visible,'Alles Gute zum 6. Geburtstag, Lucy!Feiern! 🎉');
  assert.match(h.html(),/birthday-layout no-photos/);assert.match(h.html(),/final-cake/);
  assert.equal(h.elements['#footer'].innerHTML,'');
  assert.doesNotMatch(h.elements['#header'].innerHTML,/class="brand"|Automatisch gespeichert/);
});

test('final celebration can be replayed while its button remains visible',()=>{
  const s=finishState();s.rescued=true;s.birthdayComplete=true;s.currentScreen='done';
  const h=harness(JSON.stringify(s));
  assert.match(h.html(),/data-action="celebrate"/);assert.doesNotMatch(h.html(),/final-celebration-overlay/);
  h.click('celebrate');
  assert.match(h.html(),/final-celebration-overlay/);assert.match(h.html(),/data-action="celebrate"/);assert.equal(h.timerCount(),1);
  h.click('celebrate');
  assert.match(h.html(),/final-celebration-overlay/);assert.match(h.html(),/data-action="celebrate"/);assert.equal(h.timerCount(),1);
  h.tick();
  assert.doesNotMatch(h.html(),/final-celebration-overlay/);assert.match(h.html(),/data-action="celebrate"/);
});

test('one, two and three stored photos use their intended final-page collage layouts',async()=>{
  const s=finishState();s.rescued=true;s.birthdayComplete=true;s.currentScreen='done';
  for(let count=1;count<=3;count++) {
    const records=Array.from({length:count},(_,i)=>({id:'photo-'+i,createdAt:i,blob:{id:i}}));
    const h=harness(JSON.stringify(s),false,records);
    await new Promise(resolve=>setImmediate(resolve));
    assert.match(h.html(),new RegExp('photo-count-'+count));
    assert.equal((h.html().match(/class="memory-photo"/g)||[]).length,count);
    assert.doesNotMatch(h.html(),/Unsere Helden|data-photo-input/);
  }
});
