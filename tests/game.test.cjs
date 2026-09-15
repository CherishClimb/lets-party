/* Run with: node --test tests/game.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const G = require('../game.js');
const root = path.resolve(__dirname,'..');

function harness(saved, storageThrows=false) {
  const listeners = {}, timers = new Map(); let tid=0, stored=saved;
  const element = () => ({innerHTML:'',textContent:'',open:false,focus(){},classList:{toggle(){},add(){}},handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}});
  const elements = Object.fromEntries(['#app','#header','#footer','#notice','#organizer','.reward'].map(k=>[k,element()]));
  const dialog=elements['#organizer'];
  dialog.showModal=()=>{dialog.open=true;};
  dialog.close=()=>{dialog.open=false;dialog.handlers['close']?.();};
  const context = {
    console, window:null, document:{title:'',body:element(),querySelector:s=>elements[s],addEventListener:(type,fn)=>listeners[type]=fn},
    localStorage:{getItem:()=>stored,setItem:(key,value)=>{if(storageThrows) throw Error('blocked');stored=value;}},
    setTimeout:fn=>{timers.set(++tid,fn);return tid;},clearTimeout:id=>timers.delete(id),scrollTo(){}
  };
  context.window=context;
  vm.createContext(context);
  for(const name of ['content.js','game.js','app.js']) vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
  return {
    context,elements,
    click(action,data={}) {listeners.click({target:{closest:()=>({dataset:{action,...data},disabled:false})}});},
    input(index,name) {listeners.input({target:{dataset:{child:String(index),field:'name'},value:name}});},
    change(data) {listeners.change({target:data});},
    tick() { const entry=timers.entries().next().value; assert.ok(entry,'expected active animation timer'); timers.delete(entry[0]);entry[1](); },
    timerCount:()=>timers.size,
    state:()=>JSON.parse(stored),
    html:()=>elements['#app'].innerHTML,
    serialized:()=>stored
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
test('full birthday adventure: powers, schoolyard treasure, return, balloon, snacks and birthday image',()=>{
  const h=harness();fill(h);h.click('go',{screen:'reveal'});
  assert.match(h.html(),/Emma/);assert.match(h.html(),/Noah/);assert.match(h.html(),/Mia/);
  h.click('go',{screen:'intro'});
  assert.match(h.html(),/6 Jahre alt – genau wie Lucy/);
  assert.equal((h.html().match(/class="candle"/g)||[]).length,6);
  for(let i=0;i<5;i++) h.tick();
  assert.match(h.html(),/RETTEN WIR DAS EINHORN!/);assert.match(h.html(),/Emma/);
  h.click('sceneNext');
  for(const id of G.teamIds) h.click('gesture',{team:id,index:'1'});
  assert.match(h.html(),/capture="environment"/);
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
  h.click('go',{screen:'rewards'});assert.match(h.html(),/ZAUBERTRANK freigeschaltet/);h.tick();
  h.click('rewardNext');assert.match(h.html(),/ZAUBERSCHOKOLADE freigeschaltet/);h.tick();
  h.click('rewardNext');assert.match(h.html(),/FEUER-MARSHMALLOWS freigeschaltet/);h.tick();
  h.click('rewardNext');assert.equal(h.state().currentScreen,'done');
  assert.match(h.html(),/Alles Gute zum 6. Geburtstag, Lucy!/);
  assert.match(h.html(),/Assets\/lucy-unicorn-cutout.png/);
  assert.match(h.html(),/Emma/);assert.match(h.html(),/Noah/);assert.match(h.html(),/Mia/);
  assert.match(h.html(),/Unsere Helden:/);
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
test('leaving an animated screen cancels timers; organizer pauses it',()=>{
  const h=harness();fill(h);h.click('go',{screen:'intro'});assert.equal(h.timerCount(),1);
  h.click('organizer');assert.equal(h.timerCount(),0);
  h.click('close');assert.equal(h.timerCount(),1);
  h.click('go',{screen:'setup'});assert.equal(h.timerCount(),0);
});
test('organizer shortcuts cannot bypass finale and rescue requirements',()=>{
  const h=harness();fill(h);h.click('go',{screen:'finale'});
  assert.equal(h.state().currentScreen,'setup');
  const full=harness(JSON.stringify(finishState()));full.click('go',{screen:'rewards'});
  assert.equal(full.state().currentScreen,'home');
});
test('reset is confirmed and clears the entire setup and progress',()=>{
  const h=harness();fill(h);h.click('reset');assert.equal(h.state().children[0].name,'Emma');
  h.click('resetConfirm');assert.ok(h.state().children.every(c=>!c.name));
  assert.equal(h.state().currentScreen,'home');
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
test('optional camera selection does not add photo data or change game progress',()=>{
  const h=harness();fill(h);const before=h.serialized();
  const input={dataset:{photo:'monster'},files:[{name:'team.jpg'}],value:'team.jpg'};
  h.change(input);assert.equal(input.value,'');assert.equal(h.serialized(),before);
});
test('warm-up shows one team with three fixed pose photos and keeps the saved-state shape',()=>{
  const h=harness();fill(h);h.click('go',{screen:'warmup'});
  assert.match(h.html(),/Monster-Krallen/);assert.match(h.html(),/Monster-Turm/);assert.match(h.html(),/Monster-Brüllen/);
  assert.doesNotMatch(h.html(),/8 Tentakel|Schnapp-Krokodil/);
  assert.equal((h.html().match(/data-pose=/g)||[]).length,3);
  for(let pose=0;pose<3;pose++) {
    h.change({dataset:{photo:'monster',pose:String(pose)},files:[{name:'team.jpg'}],value:'team.jpg'});
    assert.equal((h.html().match(/class="pose-check"/g)||[]).length,pose+1);
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
test('intro timing stays within 60–90 seconds and all story transitions target valid screens',()=>{
  const h=harness(),c=h.context.CONTENT;
  const duration=c.intro.reduce((sum,scene)=>sum+scene.duration,0);
  assert.ok(duration>=60000 && duration<=90000);
  for(const [from,to] of Object.entries(c.storyNext)) {
    assert.ok(Array.isArray(c[from]),from);assert.ok(c.screens[to],to);
  }
});
test('final birthday image uses the transparent cutout and participant names are safely rendered',()=>{
  const s=finishState();s.rescued=true;s.currentScreen='done';
  s.children[1].name='<script>alert(1)</script>';s.children[2].name='   ';
  const h=harness(JSON.stringify(s));
  assert.match(h.html(),/Emma/);assert.match(h.html(),/&lt;script&gt;/);
  assert.doesNotMatch(h.html(),/<script>/);
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

test('birthday screen contains only the requested greeting, heroes heading and participating names',()=>{
  const s=finishState();s.rescued=true;s.currentScreen='done';
  s.children[1].name='Lucy';s.children[2].name='   ';
  const h=harness(JSON.stringify(s));
  const visible=h.html().replace(/<[^>]*>/g,'');
  assert.equal(visible,'Alles Gute zum 6. Geburtstag, Lucy!Unsere Helden:EmmaLucy');
  assert.equal(h.elements['#footer'].innerHTML,'');
  assert.doesNotMatch(h.elements['#header'].innerHTML,/class="brand"|Automatisch gespeichert/);
});
