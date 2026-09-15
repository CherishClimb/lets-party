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
function complete(h,n) { for(const id of G.teamIds) h.click('mark',{team:id,level:String(n)}); }
function finishState() {const s=G.fresh();s.children[0].name='Emma';for(let i=0;i<3;i++) for(const id of G.teamIds) G.mark(s,id,i,true);return s;}

test('12 slots, four default places per team, empty places allowed',()=>{
  const s=G.fresh();assert.equal(s.children.length,12);
  for(const id of G.teamIds) assert.equal(s.children.filter(c=>c.teamId===id).length,4);
  assert.ok(s.children.every(c=>!c.name));
});
test('finale eligibility is exactly all nine completions across 512 combinations',()=>{
  for(let mask=0;mask<512;mask++) {
    const s=G.fresh();G.teamIds.forEach((id,t)=>[0,1,2].forEach(i=>s.teams[id].completedLevels[i]=Boolean(mask&(1<<(t*3+i)))));
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
test('full party: setup, story, gestures, levels, clue, home finale, physical rescue, rewards',()=>{
  const h=harness();fill(h);h.click('go',{screen:'reveal'});
  assert.match(h.html(),/Emma/);assert.match(h.html(),/Noah/);assert.match(h.html(),/Mia/);
  h.click('go',{screen:'intro'});h.tick();h.tick();h.tick();
  assert.match(h.html(),/Seid ihr bereit/);
  h.click('sceneNext');
  for(const id of G.teamIds) h.click('gesture',{team:id,index:'1'});
  assert.match(h.html(),/capture="environment"/);
  h.click('go',{screen:'level1'});complete(h,0);
  assert.equal(h.state().currentScreen,'level1','completing teams never auto-advances');
  h.click('go',{screen:'level2'});assert.match(h.html(),/5 → 4 Matten/);complete(h,1);
  h.click('go',{screen:'level3'});
  assert.doesNotMatch(h.html(),/BREIT|WIESEN|SCHULE/,'answers stay off the child display before completion');
  complete(h,2);h.click('go',{screen:'destination'});
  assert.match(h.html(),/BREIT/);h.tick();assert.match(h.html(),/BREITWIESENSCHULE/);
  h.tick();assert.match(h.html(),/HOF/);h.click('sceneNext');
  assert.equal(h.state().currentScreen,'waiting');
  assert.equal(h.timerCount(),0,'waiting never starts the finale itself');
  assert.doesNotMatch(h.html(),/Zaubertrank|Zauberschokolade|Marshmallow/);
  h.click('go',{screen:'finale'});
  for(let i=0;i<6;i++) h.tick();
  assert.equal(h.state().currentScreen,'found');assert.match(h.html(),/FINDET DAS EINHORN!/);
  assert.doesNotMatch(h.html(),/Zaubertrank|Zauberschokolade|Marshmallow/);
  h.click('found');assert.match(h.html(),/Besonderer Zaubertrank/);h.tick();
  h.click('rewardNext');assert.match(h.html(),/Zauberschokolade/);h.tick();
  h.click('rewardNext');assert.match(h.html(),/Grill-Marshmallow/);h.tick();
  h.click('rewardNext');assert.equal(h.state().currentScreen,'done');
  assert.equal(h.state().rescued,true);
});
test('refresh restores names, gesture, team assignments, completion and current screen',()=>{
  const h=harness();fill(h);h.click('gesture',{team:'monster',index:'2'});
  h.click('go',{screen:'level1'});h.click('mark',{team:'monster',level:'0'});
  const loaded=harness(h.serialized());assert.match(loaded.html(),/Mut zurückgebracht/);
  assert.equal(loaded.state().children[0].name,'Emma');
  assert.equal(loaded.state().teams.monster.gesture,2);
  assert.equal(loaded.state().currentScreen,'level1');
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
