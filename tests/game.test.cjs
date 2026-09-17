/* Run with: node --test tests/game.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const G = require('../game.js');
const root = path.resolve(__dirname,'..');

function harness(saved, storageThrows=false, photoRecords=null, audioMode='ok', musicSetting=null) {
  const listeners = {}, timers = new Map(), storage = new Map(); let tid=0;
  if(saved!==undefined) storage.set('unicorn-rescue-v1',saved);
  if(musicSetting!==null) storage.set('unicorn-rescue-music-volume-v1',String(musicSetting));
  const audioInstances=[];
  class FakeAudio {
    constructor(){this.src='';this.preload='';this.currentTime=0;this.volume=1;this.paused=true;this.mode=audioMode;this.playCalls=0;this.pauseCalls=0;this.handlers={};audioInstances.push(this);}
    addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
    emit(type){for(const fn of this.handlers[type]||[]) fn();}
    load(){if(!this.src)return;if(this.mode==='missing')this.emit('error');else this.emit('canplay');}
    play(){this.playCalls++;if(this.mode==='blocked'){const error=Error('blocked');error.name='NotAllowedError';return Promise.reject(error);}if(this.mode==='missing'){const error=Error('missing');error.name='NotSupportedError';return Promise.reject(error);}this.paused=false;this.emit('playing');return Promise.resolve();}
    pause(){this.pauseCalls++;if(!this.paused){this.paused=true;this.emit('pause');}}
    removeAttribute(name){if(name==='src')this.src='';}
  }
  const element = () => ({innerHTML:'',textContent:'',open:false,hidden:false,focus(){},querySelector(){return null;},setAttribute(){},classList:{toggle(){},add(){}},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});
  const elements = Object.fromEntries(['#app','#header','#footer','#notice','#organizer','.reward'].map(k=>[k,element()]));
  const narrationButton=element(),narrationControls=element();
  narrationControls.querySelector=selector=>selector==='.narration-toggle'?narrationButton:null;
  elements['#app'].querySelector=selector=>selector==='.narration-controls'?narrationControls:null;
  const dialog=elements['#organizer'];
  dialog.showModal=()=>{dialog.open=true;};
  dialog.close=()=>{dialog.open=false;dialog.handlers['close']?.();};
  const context = {
    console, window:null, document:{title:'',body:element(),querySelector:s=>elements[s],addEventListener:(type,fn)=>listeners[type]=fn},
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{if(storageThrows) throw Error('blocked');storage.set(key,value);}},
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
    inputVolume(value) {listeners.input({target:{dataset:{musicVolume:''},value:String(value)}});},
    change(data) {listeners.change({target:data});},
    tick() { const entry=timers.entries().next().value; assert.ok(entry,'expected active animation timer'); timers.delete(entry[0]);entry[1](); },
    timerCount:()=>timers.size,
    state:()=>JSON.parse(storage.get('unicorn-rescue-v1')),
    html:()=>elements['#app'].innerHTML,
    serialized:()=>storage.get('unicorn-rescue-v1'),
    musicSetting:()=>storage.get('unicorn-rescue-music-volume-v1'),
    audio:()=>audioInstances[0],
    music:()=>audioInstances[1],
    audioCount:()=>audioInstances.length,
    narrationButton:()=>narrationButton,
    narrationControls:()=>narrationControls
  };
}
function fill(h) { h.click('go',{screen:'setup'}); h.input(0,'Emma');h.input(4,'Noah');h.input(8,'Mia'); }
function complete(h,n) { for(const id of G.teamIds) { h.click('mark',{team:id,level:String(n)}); if(n<2) { assert.match(h.html(),/gefunden!/); h.click('go',{screen:'level'+(n+1)}); } } }
function finishState() {const s=G.fresh();s.children[0].name='Emma';for(let i=0;i<3;i++) for(const id of G.teamIds) G.mark(s,id,i,true);G.revealClue(s);s.treasureFound=true;s.returnInvited=true;return s;}

test('15 preparation slots provide five empty places per team',()=>{
  const s=G.fresh();assert.equal(s.children.length,15);
  for(const id of G.teamIds) assert.equal(s.children.filter(c=>c.teamId===id).length,5);
  assert.ok(s.children.every(c=>!c.name));
});
test('6 to 15 children distribute evenly and calculate team mats for both rounds',()=>{
  const expected={12:[4,4,4],13:[5,4,4],14:[5,5,4],15:[5,5,5]};
  for(let total=6;total<=15;total++) {
    const s=G.fresh();
    s.children.slice(0,total).forEach((child,i)=>child.name='Kind '+(i+1));
    const sizes=G.teamIds.map(id=>G.teamSize(s,id));
    assert.equal(sizes.reduce((sum,n)=>sum+n,0),total);
    assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1,'uneven teams for '+total);
    assert.equal(new Set(s.children.slice(0,total).map(child=>child.id)).size,total);
    assert.deepEqual(G.teamIds.map(id=>G.matsFor(s,id,0)),sizes.map(n=>n+1));
    assert.deepEqual(G.teamIds.map(id=>G.matsFor(s,id,1)),sizes);
    if(expected[total]) assert.deepEqual(sizes,expected[total]);
  }
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
test('existing 12-child saves gain the extra slots without losing setup data',()=>{
  const previous=G.fresh();previous.children=previous.children.slice(0,12);
  previous.children[0].name='Emma';previous.children[0].icon='moon';previous.children[0].teamId='crocodile';
  const migrated=G.normalize(previous);
  assert.equal(migrated.children.length,15);
  assert.deepEqual(migrated.children[0],{id:'child-1',name:'Emma',icon:'moon',teamId:'crocodile'});
  assert.deepEqual(migrated.children.slice(12).map(child=>child.teamId),['monster','octopus','crocodile']);
});
test('home and setup keep the storybook team layout with all 15 slots visible',()=>{
  const h=harness();
  assert.match(h.html(),/LUCYS 6\. GEBURTSTAG/);
  assert.match(h.html(),/Ein magisches Abenteuer beginnt/);
  assert.doesNotMatch(h.html(),/3 Rettungsteams|3 Abenteuer|1 Einhorn/);
  h.click('go',{screen:'setup'});
  assert.equal((h.html().match(/class="setup-team /g)||[]).length,3);
  assert.equal((h.html().match(/data-field="name"/g)||[]).length,15);
  assert.match(h.html(),/Die kleinen Monster/);assert.match(h.html(),/Die kleinen Oktopusse/);assert.match(h.html(),/Die kleinen Krokodile/);
});
test('13 children work from team preparation through both dynamic mat rounds',()=>{
  const h=harness();h.click('go',{screen:'setup'});
  assert.equal((h.html().match(/data-field="name"/g)||[]).length,15);
  for(let i=0;i<13;i++) h.input(i,'Kind '+(i+1));
  const prepared=h.state(),active=prepared.children.filter(child=>child.name);
  assert.equal(active.length,13);assert.equal(new Set(active.map(child=>child.id)).size,13);
  assert.deepEqual(G.teamIds.map(id=>G.teamSize(prepared,id)),[5,4,4]);
  h.click('go',{screen:'reveal'});assert.match(h.html(),/Kind 13/);
  h.click('go',{screen:'level1'});
  assert.doesNotMatch(h.html(),/Für euer Team:|\d+ Matten/);
  assert.equal((h.html().match(/data-mat-count="6"/g)||[]).length,1);
  assert.equal((h.html().match(/data-mat-count="5"/g)||[]).length,2);
  complete(h,0);h.click('go',{screen:'level2'});
  assert.doesNotMatch(h.html(),/Für euer Team:|\d+ Matten/);
  assert.equal((h.html().match(/data-mat-count="5"/g)||[]).length,1);
  assert.equal((h.html().match(/data-mat-count="4"/g)||[]).length,2);
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
  assert.match(h.html(),/data-screen="outside"/);h.click('go',{screen:'outside'});
  assert.match(h.html(),/Ab nach draußen!/);assert.match(h.html(),/Euer Abenteuer wartet!/);assert.match(h.html(),/Wir sind draußen!/);
  assert.equal(h.timerCount(),0);h.click('sceneNext');assert.equal(h.state().outsideReady,true);assert.equal(h.state().currentScreen,'level1');
  complete(h,0);
  assert.equal(h.state().currentScreen,'level1');
  h.click('go',{screen:'transition2'});assert.equal(h.timerCount(),0);h.click('sceneNext');assert.match(h.html(),/EINE MATTE WENIGER/);
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
  h.click('sceneNext');assert.match(h.html(),/HOF/);assert.equal(h.state().clueRevealed,true);
  assert.match(h.html(),/Zum Schulhof-Schatzsuche starten/);assert.match(h.html(),/SZENE 3 \/ 3/);
  assert.doesNotMatch(h.html(),/Einhorn fehlt immer noch|Einhorn ist noch nicht gefunden|DIE SPUR FÜHRT ZUM SCHULHOF|KLUGHEIT IST ZURÜCK/);
  h.click('sceneNext');assert.equal(h.state().currentScreen,'pinata');
  assert.match(h.html(),/SUCHT DEN EINHORN-SCHATZ/);assert.equal(h.timerCount(),0);
  h.click('treasureFound');assert.equal(h.state().currentScreen,'returnMessage');
  assert.match(h.html(),/Zurück zum Zauberwald! ✨/);assert.match(h.html(),/Bringt die gesammelten Zauberkräfte mit/);assert.match(h.html(),/Wir sind zurück!/);
  assert.doesNotMatch(h.html(),/kleine Geburtstagsüberraschung|Überraschungen geöffnet|Nachricht zeigen|KEHRT ZURÜCK/);
  assert.match(h.html(),/storm-decor/);assert.equal(h.context.BackgroundMusic.snapshot().id,'storm');assert.equal(h.timerCount(),0);
  h.click('sceneNext');assert.equal(h.state().currentScreen,'finale');assert.equal(h.state().returnInvited,true);
  assert.match(h.html(),/Die Zauberkräfte sind zurück!/);assert.match(h.html(),/final-power-return/);assert.match(h.html(),/storm-decor/);
  h.click('sceneNext');assert.match(h.html(),/Die Magie kehrt zurück … ✨/);assert.match(h.html(),/forest-transformation-visual/);assert.match(h.html(),/forest-transform-decor/);assert.equal(h.timerCount(),0);
  h.click('sceneNext');assert.match(h.html(),/Meine Magie ist wieder da!/);assert.match(h.html(),/final-magic-visual/);assert.match(h.html(),/day-decor/);
  h.click('sceneNext');
  assert.equal(h.state().currentScreen,'found');assert.match(h.html(),/Pssst … ich bin ganz in eurer Nähe/);assert.match(h.html(),/Ihr habt mich gefunden!/);
  assert.doesNotMatch(h.html(),/magic-unicorn|mascot unicorn/);
  assert.doesNotMatch(h.html(),/Zaubertrank|Zauberschokolade|Marshmallow/);
  h.click('found');assert.equal(h.state().currentScreen,'rescued');
  assert.match(h.html(),/Ihr habt mich gefunden!/);assert.match(h.html(),/Jetzt wird gefeiert!/);assert.match(h.html(),/Geheime Team-Belohnungen zeigen/);
  assert.match(h.html(),/final-found-visual/);
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
  assert.equal(loaded.state().children.length,15);
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
test('treasure confirmation and return invitation persist, and undo relocks later story stages',()=>{
  const s=finishState();s.currentScreen='finale';
  const restored=G.normalize(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.currentScreen,'finale');
  assert.equal(restored.treasureFound,true);assert.equal(restored.returnInvited,true);
  G.mark(restored,'monster',2,false);
  assert.equal(restored.clueRevealed,false);assert.equal(restored.treasureFound,false);
  assert.equal(restored.returnInvited,false);assert.equal(G.canVisit(restored,'finale'),false);
});
test('version 1 saves migrate without losing children, teams or already earned progress',()=>{
  const old=finishState();old.version=1;old.currentScreen='waiting';
  delete old.clueRevealed;delete old.treasureFound;delete old.returnInvited;
  const migrated=G.normalize(old);
  assert.equal(migrated.version,2);assert.equal(migrated.children[0].name,'Emma');
  assert.equal(migrated.currentScreen,'finale');assert.equal(G.canVisit(migrated,'finale'),true);
  const partial=G.fresh();partial.version=1;partial.children[2].name='Lucy';
  G.mark(partial,'octopus',0,true);
  const loaded=G.normalize(partial);
  assert.equal(loaded.children[2].name,'Lucy');assert.equal(G.earned(loaded,'octopus',0),true);
  assert.equal(loaded.clueRevealed,false);
});
test('obsolete Schatz screens migrate to the simplified return flow',()=>{
  const found=finishState();found.returnInvited=false;found.currentScreen='treasure';
  assert.equal(G.normalize(found).currentScreen,'returnMessage');
  const returned=finishState();returned.currentScreen='waiting';
  assert.equal(G.normalize(returned).currentScreen,'finale');
});
test('story narration and background music have central mappings',()=>{
  const h=harness(),c=h.context.CONTENT;
  assert.equal(c.intro.length,6);assert.equal(c.storyAudio.intro.length,6);
  c.storyAudio.intro.forEach((src,i)=>assert.equal(src,'Assets/Audio/story/scene-'+String(i+1).padStart(2,'0')+'.mp3'));
  assert.deepEqual(Array.from(c.storyAudio.finale),['Assets/Audio/story/final-01.mp3','Assets/Audio/story/final-02.mp3']);
  assert.equal(c.storyAudio.found,'Assets/Audio/story/final-03.mp3');assert.equal(c.storyAudio.rescued,'Assets/Audio/story/final-04.mp3');
  assert.deepEqual(Array.from(c.storyAudio.rewards),['Assets/Audio/story/treasure-01.mp3','Assets/Audio/story/treasure-02.mp3','Assets/Audio/story/treasure-03.mp3']);
  assert.deepEqual({...c.backgroundMusic},{ambient:'Assets/Audio/story/ambient.mp3',storm:'Assets/Audio/story/storm.mp3',final:'Assets/Audio/story/final.mp3'});
  assert.equal(c.finale.length,3);assert.equal(c.finale[0].text,'Die Zauberkräfte sind zurück! ✨');assert.equal(c.finale[0].visual,'finalPowers');
  assert.equal(c.finale[1].text,'Die Magie kehrt zurück … ✨');assert.equal(c.finale[1].visual,'forestTransform');assert.equal(c.finale[1].manual,true);assert.equal(c.finale[1].narration,false);
  assert.equal(c.finale[2].text,'Meine Magie ist wieder da! ✨');assert.equal(c.finale[2].visual,'finalMagic');assert.equal(c.finale[2].audioIndex,1);
  assert.equal(c.destination.length,3);assert.equal(c.destination[2].visual,'courtyard');assert.equal(c.destination[2].button,'Zum Schulhof-Schatzsuche starten');assert.equal(c.destination[2].manual,true);assert.equal(c.destination[2].awardClue,true);
  assert.equal(c.found.title,'Pssst … ich bin ganz in eurer Nähe. 👀');assert.equal(c.rescued.title,'Ihr habt mich gefunden! 🦄✨');assert.equal(c.rescued.text,'Jetzt wird gefeiert!');
  for(const [from,to] of Object.entries(c.storyNext)) {
    assert.ok(Array.isArray(c[from]),from);assert.ok(c.screens[to],to);
  }
});
test('story navigation defaults to manual and never advances from audio or animation timers',()=>{
  const h=harness();fill(h);h.click('go',{screen:'intro'});
  const before=h.serialized();
  h.click('organizer');
  assert.match(h.elements['#organizer'].innerHTML,/Story-Steuerung/);
  assert.match(h.elements['#organizer'].innerHTML,/data-story-mode="manual" checked/);
  assert.match(h.elements['#organizer'].innerHTML,/data-story-mode="automatic"/);
  h.click('close');
  h.audio().emit('ended');
  assert.equal(h.timerCount(),0);
  assert.equal(h.state().currentScreen,'intro');
  assert.match(h.html(),/6 Jahre alt – genau wie Lucy/);
  assert.equal(h.serialized(),before);

  const transitionState=G.fresh();transitionState.children[0].name='Emma';transitionState.introCompleted=true;
  G.teamIds.forEach(id=>G.mark(transitionState,id,0,true));transitionState.currentScreen='transition2';
  const transition=harness(JSON.stringify(transitionState));
  assert.equal(transition.timerCount(),0);
  assert.match(transition.html(),/Zaubersturm ist noch nicht vorbei/);
});
test('outside transition remains manual and opens the existing first mission',()=>{
  const s=G.fresh();s.children[0].name='Emma';s.introCompleted=true;s.currentScreen='outside';
  G.teamIds.forEach(id=>s.teams[id].gesture=0);
  const h=harness(JSON.stringify(s));h.click('organizer');h.change({dataset:{storyMode:'automatic'},checked:true});h.click('close');
  assert.match(h.html(),/outside-adventure/);assert.match(h.html(),/Wir sind draußen!/);assert.equal(h.timerCount(),0);
  h.click('sceneNext');assert.equal(h.state().outsideReady,true);assert.equal(h.state().currentScreen,'level1');
  h.click('go',{screen:'home'});h.click('resume');assert.equal(h.state().currentScreen,'level1','resume does not repeat the confirmed transition');
});
test('automatic story navigation follows safe story scenes and stops at confirmations',()=>{
  const h=harness();fill(h);h.click('go',{screen:'intro'});
  const progress=h.serialized();
  h.click('organizer');
  h.change({dataset:{storyMode:'automatic'},checked:true});
  assert.equal(h.serialized(),progress,'changing navigation mode does not touch saved progress');
  h.click('close');
  h.audio().emit('ended');assert.equal(h.timerCount(),1);h.tick();
  for(let i=1;i<5;i++) {
    h.audio().emit('ended');
    assert.equal(h.timerCount(),1,'narrated story scene waits briefly before advancing');
    h.tick();
  }
  assert.match(h.html(),/RETTEN WIR DAS EINHORN!/);
  h.audio().emit('ended');
  assert.equal(h.timerCount(),0,'the start-adventure confirmation remains manual');
  assert.equal(h.state().currentScreen,'intro');
  h.click('organizer');
  assert.match(h.elements['#organizer'].innerHTML,/data-story-mode="automatic" checked/);
  h.click('close');

  const transitionState=G.fresh();transitionState.children[0].name='Emma';transitionState.introCompleted=true;
  G.teamIds.forEach(id=>G.mark(transitionState,id,0,true));transitionState.currentScreen='transition2';
  const transition=harness(JSON.stringify(transitionState));
  transition.click('organizer');transition.change({dataset:{storyMode:'automatic'},checked:true});transition.click('close');
  assert.equal(transition.timerCount(),1);
  transition.tick();assert.match(transition.html(),/EINE MATTE WENIGER/);
  assert.equal(transition.timerCount(),1);
  transition.tick();assert.equal(transition.state().currentScreen,'level2');
  assert.equal(transition.timerCount(),0,'mission pages never schedule automatic navigation');

  const foundState=finishState();foundState.currentScreen='found';
  const found=harness(JSON.stringify(foundState));
  found.click('organizer');found.change({dataset:{storyMode:'automatic'},checked:true});found.click('close');
  found.audio().emit('ended');
  assert.equal(found.state().currentScreen,'found');assert.equal(found.timerCount(),0);

  const rewardState=finishState();rewardState.rescued=true;rewardState.currentScreen='rewards';
  const reward=harness(JSON.stringify(rewardState));
  reward.click('organizer');reward.change({dataset:{storyMode:'automatic'},checked:true});reward.click('close');
  reward.tick();reward.audio().emit('ended');
  assert.equal(reward.state().rewardIndex,0);assert.equal(reward.timerCount(),0);

  const finaleState=finishState();finaleState.currentScreen='finale';
  const finale=harness(JSON.stringify(finaleState));
  finale.click('organizer');finale.change({dataset:{storyMode:'automatic'},checked:true});finale.click('close');
  finale.audio().emit('ended');assert.equal(finale.timerCount(),1);finale.tick();
  assert.match(finale.html(),/Die Magie kehrt zurück/);assert.equal(finale.context.StoryNarration.snapshot().status,'idle');assert.equal(finale.timerCount(),0,'forest transformation waits for its button');
});
test('one small narration button pauses and resumes the reusable narration player',()=>{
  const h=harness();fill(h);h.click('go',{screen:'intro'});
  assert.equal(h.context.StoryNarration.snapshot().id,'intro:1');
  assert.equal(h.context.StoryNarration.snapshot().status,'playing');
  assert.match(h.audio().src,/scene-01\.mp3$/);assert.equal(h.timerCount(),0);assert.equal(h.audioCount(),2);
  assert.equal((h.html().match(/data-action="narrationToggle"/g)||[]).length,1);
  assert.doesNotMatch(h.html(),/Nochmal h|Geschichte starten|narration-replay|narration-start/);
  assert.equal(h.narrationButton().textContent,'⏸');assert.equal(h.narrationControls().hidden,false);
  h.audio().currentTime=4;h.click('narrationToggle');assert.equal(h.context.StoryNarration.snapshot().status,'paused');assert.equal(h.audio().currentTime,4);
  assert.equal(h.narrationButton().textContent,'▶');
  h.click('narrationToggle');assert.equal(h.context.StoryNarration.snapshot().status,'playing');assert.equal(h.narrationButton().textContent,'⏸');
  const pauses=h.audio().pauseCalls;h.click('sceneNext');
  assert.equal(h.context.StoryNarration.snapshot().id,'intro:2');assert.match(h.audio().src,/scene-02\.mp3$/);assert.ok(h.audio().pauseCalls>pauses);
  h.audio().emit('ended');assert.equal(h.context.StoryNarration.snapshot().status,'ended');assert.equal(h.timerCount(),0);assert.equal(h.narrationControls().hidden,true);
  assert.equal(h.context.StoryNarration.snapshot().id,'intro:2');
  h.click('skip');assert.equal(h.context.StoryNarration.snapshot().status,'idle');assert.equal(h.audio().src,'');
});
test('blocked autoplay can be unlocked without changing the scene',async()=>{
  const h=harness(undefined,false,null,'blocked');fill(h);h.click('go',{screen:'intro'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.context.StoryNarration.snapshot().status,'blocked');assert.equal(h.context.StoryNarration.snapshot().id,'intro:1');
  h.audio().mode='ok';h.music().mode='ok';h.click('narrationToggle');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.context.StoryNarration.snapshot().status,'playing');assert.equal(h.context.StoryNarration.snapshot().id,'intro:1');assert.equal(h.context.BackgroundMusic.snapshot().status,'playing');
});
test('missing narration stays hidden and never blocks story navigation',async()=>{
  const h=harness(undefined,false,null,'missing');fill(h);h.click('go',{screen:'intro'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.context.StoryNarration.snapshot().status,'missing');assert.match(h.html(),/narration-controls" hidden/);
  h.click('sceneNext');assert.equal(h.context.StoryNarration.snapshot().id,'intro:2');assert.equal(h.state().currentScreen,'intro');
});
test('four final narration clips use finale, found and rescued states without changing buttons',()=>{
  const s=finishState();s.currentScreen='finale';const h=harness(JSON.stringify(s));
  h.click('go',{screen:'finale'});
  assert.equal(h.context.StoryNarration.snapshot().id,'finale:1');assert.match(h.audio().src,/final-01\.mp3$/);assert.equal(h.timerCount(),0);
  h.audio().emit('ended');assert.equal(h.context.StoryNarration.snapshot().id,'finale:1');assert.equal(h.timerCount(),0);
  h.click('sceneNext');assert.equal(h.context.StoryNarration.snapshot().status,'idle');assert.match(h.html(),/Die Magie kehrt zurück/);assert.equal(h.timerCount(),0);
  h.click('sceneNext');assert.equal(h.context.StoryNarration.snapshot().id,'finale:2');assert.match(h.audio().src,/final-02\.mp3$/);assert.equal(h.timerCount(),0);
  h.click('sceneNext');assert.equal(h.state().currentScreen,'found');assert.equal(h.context.StoryNarration.snapshot().id,'found');assert.match(h.audio().src,/final-03\.mp3$/);assert.equal(h.timerCount(),0);
  h.audio().emit('ended');assert.equal(h.state().currentScreen,'found');assert.match(h.html(),/Ihr habt mich gefunden!/);
  h.click('found');assert.equal(h.state().currentScreen,'rescued');assert.equal(h.context.StoryNarration.snapshot().id,'rescued');assert.match(h.audio().src,/final-04\.mp3$/);assert.equal(h.timerCount(),0);
  h.audio().emit('ended');assert.equal(h.state().currentScreen,'rescued');assert.match(h.html(),/Geheime Team-Belohnungen zeigen/);
});
test('three birthday treasure clips follow rewardIndex without changing reward logic',()=>{
  const s=finishState();s.rescued=true;s.currentScreen='rewards';const h=harness(JSON.stringify(s));
  assert.equal(h.context.StoryNarration.snapshot().id,'rewards:1');assert.match(h.audio().src,/treasure-01\.mp3$/);assert.match(h.html(),/Zaubertrank gefunden!/);
  h.tick();h.audio().emit('ended');assert.equal(h.state().rewardIndex,0);
  h.click('rewardNext');assert.equal(h.state().rewardIndex,1);assert.equal(h.context.StoryNarration.snapshot().id,'rewards:2');assert.match(h.audio().src,/treasure-02\.mp3$/);assert.match(h.html(),/Schoko-Schatz gefunden!/);
  h.tick();h.click('rewardNext');assert.equal(h.state().rewardIndex,2);assert.equal(h.context.StoryNarration.snapshot().id,'rewards:3');assert.match(h.audio().src,/treasure-03\.mp3$/);assert.match(h.html(),/Wolkenkuss gefunden!/);
  h.tick();h.audio().emit('ended');assert.equal(h.state().currentScreen,'rewards');
  h.click('rewardNext');assert.equal(h.state().currentScreen,'done');
});
test('one looping music player follows restored story state and ducks under narration',async()=>{
  const h=harness();assert.equal(h.context.BackgroundMusic.snapshot().id,'ambient');assert.equal(h.context.BackgroundMusic.snapshot().volume,.10);assert.equal(h.music().loop,true);
  fill(h);h.click('go',{screen:'intro'});assert.equal(h.context.BackgroundMusic.snapshot().id,'ambient');assert.equal(h.context.BackgroundMusic.snapshot().volume,.06);
  h.click('narrationToggle');assert.equal(h.context.BackgroundMusic.snapshot().volume,.10);
  h.click('narrationToggle');h.click('sceneNext');h.click('sceneNext');h.click('sceneNext');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.context.BackgroundMusic.snapshot().id,'storm');assert.equal(h.context.BackgroundMusic.snapshot().volume,.06);
  h.click('skip');assert.equal(h.context.BackgroundMusic.snapshot().id,'storm');assert.equal(h.context.BackgroundMusic.snapshot().volume,.10);

  const away=finishState();away.returnInvited=false;away.treasureFound=false;away.currentScreen='pinata';
  assert.equal(harness(JSON.stringify(away)).context.BackgroundMusic.snapshot().id,'storm');
  const returned=finishState();returned.currentScreen='finale';
  assert.equal(harness(JSON.stringify(returned)).context.BackgroundMusic.snapshot().id,'final');
});
test('organizer music slider persists 0 to 30 percent without affecting narration or enabling music',()=>{
  const h=harness();fill(h);h.click('go',{screen:'intro'});h.click('organizer');
  assert.match(h.elements['#organizer'].innerHTML,/Musiklautstärke/);assert.match(h.elements['#organizer'].innerHTML,/min="0" max="30"/);assert.match(h.elements['#organizer'].innerHTML,/value="10"/);
  assert.equal(h.audio().volume,1);h.inputVolume(20);
  assert.equal(h.context.BackgroundMusic.snapshot().normalVolume,.2);assert.equal(h.context.BackgroundMusic.snapshot().volume,.12);assert.equal(h.audio().volume,1);assert.equal(h.musicSetting(),'0.2');
  h.click('close');h.click('narrationToggle');h.click('musicToggle');assert.equal(h.context.BackgroundMusic.snapshot().enabled,false);
  h.inputVolume(30);assert.equal(h.context.BackgroundMusic.snapshot().normalVolume,.3);assert.equal(h.context.BackgroundMusic.snapshot().enabled,false);
  h.click('sceneNext');h.click('sceneNext');h.click('sceneNext');assert.equal(h.context.BackgroundMusic.snapshot().id,'storm');assert.equal(h.context.BackgroundMusic.snapshot().enabled,false);
  h.click('musicToggle');assert.equal(h.context.BackgroundMusic.snapshot().volume,.18);
  h.click('narrationToggle');assert.equal(h.context.BackgroundMusic.snapshot().volume,.3);
  const reloaded=harness(h.serialized(),false,null,'ok',h.musicSetting());
  assert.equal(reloaded.context.BackgroundMusic.snapshot().normalVolume,.3);assert.equal(reloaded.audio().volume,1);
});
test('music toggle stays off across story phases and remains independent from narration',()=>{
  const h=harness();fill(h);h.click('go',{screen:'intro'});
  assert.match(h.elements['#header'].innerHTML,/data-action="musicToggle"/);
  assert.match(h.elements['#header'].innerHTML,/Musik aus/);
  assert.equal(h.context.BackgroundMusic.snapshot().id,'ambient');
  assert.equal(h.context.BackgroundMusic.snapshot().enabled,true);
  assert.equal(h.context.StoryNarration.snapshot().status,'playing');

  h.click('musicToggle');
  assert.equal(h.context.BackgroundMusic.snapshot().enabled,false);
  assert.equal(h.context.BackgroundMusic.snapshot().status,'paused');
  assert.equal(h.context.StoryNarration.snapshot().status,'playing');
  h.click('narrationToggle');
  assert.equal(h.context.StoryNarration.snapshot().status,'paused');
  assert.equal(h.context.BackgroundMusic.snapshot().status,'paused');
  h.click('narrationToggle');
  assert.equal(h.context.StoryNarration.snapshot().status,'playing');
  assert.equal(h.context.BackgroundMusic.snapshot().enabled,false);

  h.click('sceneNext');h.click('sceneNext');h.click('sceneNext');
  assert.equal(h.context.BackgroundMusic.snapshot().id,'storm');
  assert.equal(h.context.BackgroundMusic.snapshot().enabled,false);
  assert.equal(h.context.BackgroundMusic.snapshot().status,'paused');
  assert.match(h.elements['#header'].innerHTML,/Musik an/);
  h.click('musicToggle');
  assert.equal(h.context.BackgroundMusic.snapshot().id,'storm');
  assert.equal(h.context.BackgroundMusic.snapshot().enabled,true);
  assert.equal(h.context.BackgroundMusic.snapshot().status,'playing');
  assert.equal(h.context.StoryNarration.snapshot().status,'playing');

  const returned=finishState();returned.currentScreen='finale';
  const finale=harness(JSON.stringify(returned));
  assert.equal(finale.context.BackgroundMusic.snapshot().id,'final');
  finale.click('musicToggle');finale.click('go',{screen:'finale'});
  assert.equal(finale.context.BackgroundMusic.snapshot().id,'final');
  assert.equal(finale.context.BackgroundMusic.snapshot().enabled,false);
  assert.equal(finale.context.BackgroundMusic.snapshot().status,'paused');
  finale.click('musicToggle');
  assert.equal(finale.context.BackgroundMusic.snapshot().status,'playing');
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

  const returning=finishState();returning.returnInvited=false;returning.currentScreen='returnMessage';
  const returnPage=harness(JSON.stringify(returning));
  assert.match(returnPage.html(),/storm-decor/);assert.equal(returnPage.context.BackgroundMusic.snapshot().id,'storm');

  const finaleState=finishState();finaleState.currentScreen='finale';
  const restored=harness(JSON.stringify(finaleState));
  assert.match(restored.html(),/storm-decor/);assert.equal(restored.context.BackgroundMusic.snapshot().id,'final');
  restored.click('sceneNext');assert.match(restored.html(),/forest-transform-decor/);assert.doesNotMatch(restored.html(),/storm-decor/);
  restored.click('sceneNext');assert.match(restored.html(),/day-decor/);assert.doesNotMatch(restored.html(),/forest-transform-decor|storm-decor/);
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

test('wide landscape story layout keeps visuals and actions in a two-column viewport composition',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/@media\(min-width:900px\) and \(orientation:landscape\) and \(max-height:1200px\)/);
  assert.match(css,/body\.cinematic-mode \.story>[.]scene-visual \{ grid-column:1; grid-row:1\/6/);
  assert.match(css,/body\.cinematic-mode \.story>[.]actions \{ grid-column:2; grid-row:5/);
  assert.match(css,/@media\(max-width:700px\)/,'phone layout remains separately responsive');
});

test('forest restoration is a soft timed transition with a delayed manual button',()=>{
  const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
  assert.match(css,/\.forest-transform-decor::before[^}]+animation:transform-storm-clears 3\.4s/s);
  assert.match(css,/\.story\.forestTransform \.actions[^}]+visibility:hidden[^}]+3\.25s/s);
  assert.match(css,/@keyframes transform-storm-clears \{[\s\S]*?opacity:1;[\s\S]*?opacity:0;[\s\S]*?\}/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]+\.story\.forestTransform \.actions \{ opacity:1; visibility:visible; pointer-events:auto; \}/);
});
