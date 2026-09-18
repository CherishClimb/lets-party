const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

// Deliberately leave old events/promises queued when load() aborts a resource.
// This exercises cancellation independently of the browser's own cleanup.
function harness() {
  const elements=[],log=[],frames=[];
  class Audio {
    constructor() {
      this.id=elements.length;elements.push(this);this.handlers={};this.requests=[];
      this._src='';this._time=0;this.volume=1;this.paused=true;this.readyState=0;this.ended=false;
    }
    get src() {return this._src;}
    set src(value) {this._src=value;log.push([this.id,'src',value]);}
    get currentTime() {return this._time;}
    set currentTime(value) {this._time=value;log.push([this.id,'time',value]);}
    addEventListener(type,fn) {(this.handlers[type]??=[]).push(fn);}
    removeEventListener(type,fn) {this.handlers[type]=(this.handlers[type]||[]).filter(item=>item!==fn);}
    queued(type) {const callbacks=[...(this.handlers[type]||[])];return ()=>callbacks.forEach(fn=>fn());}
    emit(type) {this.queued(type)();}
    load() {log.push([this.id,'load']);this.readyState=0;this.paused=true;this.ended=false;}
    pause() {log.push([this.id,'pause']);this.paused=true;/* pause is asynchronous in browsers */}
    removeAttribute(name) {if(name==='src')this.src='';}
    ready() {this.currentTime=37;this.readyState=3;this.emit('loadeddata');this.emit('canplay');}
    play() {
      log.push([this.id,'play',this.currentTime]);this.paused=false;this.ended=false;
      this.emit('playing');
      return new Promise((resolve,reject)=>this.requests.push({resolve,reject}));
    }
  }
  const context={Audio,requestAnimationFrame:fn=>frames.push(fn)};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../narration.js'),'utf8'),context);
  return {context,elements,log,frames};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const error=name=>Object.assign(new Error(name),{name});

for(const channel of ['StoryNarration','BackgroundMusic']) {
  test(channel+': waits for data, resets after readiness and retires the previous scene before playing',async()=>{
    const h=harness(),player=h.context[channel];
    player.open('a','a.mp3',{sceneKey:1});const first=player.audio;
    assert.equal(player.snapshot().status,'loading');assert.equal(first.requests.length,0);
    first.readyState=1;first.emit('loadeddata');first.emit('canplay');assert.equal(first.requests.length,0);
    first.ready();assert.equal(first.requests.length,1);assert.equal(first.currentTime,0);
    first.requests[0].resolve();await flush();first.currentTime=19;
    player.open('b','b.mp3',{sceneKey:2});const second=player.audio;
    assert.equal(first.paused,true);assert.equal(first.currentTime,0);assert.equal(first.src,'');
    assert.equal(second.requests.length,0);second.ready();
    assert.equal(second.currentTime,0);assert.deepEqual(h.elements.filter(audio=>!audio.paused),[second]);
    const retire=h.log.findIndex((entry,i)=>i>h.log.findIndex(e=>e[0]===first.id&&e[1]==='play')&&entry[0]===first.id&&entry[1]==='pause');
    const assigned=h.log.findIndex(entry=>entry[0]===second.id&&entry[1]==='src'&&entry[2]==='b.mp3');
    assert.ok(retire<assigned,'stop old playback before assigning the next resource');
    assert.deepEqual(h.log.slice(retire,retire+4).map(entry=>entry.slice(1)),[['pause'],['time',0],['src',''],['load']]);
    const played=h.log.findIndex(entry=>entry[0]===second.id&&entry[1]==='play');
    assert.ok(h.log.findIndex(entry=>entry[0]===second.id&&entry[1]==='load')<played);
    assert.deepEqual(h.log[played-1],[second.id,'time',0]);assert.deepEqual(h.log[played],[second.id,'play',0]);
    second.requests[0].resolve();await flush();
  });

  test(channel+': same scene rerenders preserve position; new visits, replay and silent scenes restart cleanly',async()=>{
    const h=harness(),player=h.context[channel];
    player.open('a','a.mp3',{sceneKey:1});const first=player.audio;first.ready();first.requests[0].resolve();await flush();
    first.currentTime=12;player.open('a','a.mp3',{sceneKey:1});assert.equal(player.audio,first);assert.equal(first.currentTime,12);
    player.pause();assert.equal(first.currentTime,12);void player.play();assert.equal(first.currentTime,12);
    first.requests[1].resolve();await flush();
    player.replay();assert.equal(first.currentTime,0);assert.equal(first.requests.length,3,'replay works with asynchronous pause events');first.requests[2].resolve();await flush();
    player.open('a','a.mp3',{sceneKey:2});const revisit=player.audio;revisit.ready();assert.equal(revisit.currentTime,0);assert.equal(first.paused,true);
    player.open('','');assert.equal(player.snapshot().status,'idle');assert.equal(revisit.paused,true);assert.equal(revisit.src,'');
    player.open('a','a.mp3',{sceneKey:3});player.audio.ready();assert.equal(player.audio.currentTime,0);
    assert.deepEqual(h.elements.filter(audio=>!audio.paused),[player.audio]);
  });

  test(channel+': A → B → A ignores obsolete readiness events and both rejected and fulfilled play promises',async()=>{
    const h=harness(),player=h.context[channel];
    player.open('a','same.mp3',{sceneKey:1});const first=player.audio;
    const oldEvents=['loadeddata','canplay','playing','pause','ended','error'].map(type=>first.queued(type));
    first.ready();
    player.open('b','other.mp3',{sceneKey:2});const middle=player.audio;middle.ready();
    player.open('a','same.mp3',{sceneKey:3});const last=player.audio;
    oldEvents.forEach(deliver=>deliver());assert.equal(player.snapshot().status,'loading');assert.equal(last.requests.length,0);
    first.requests[0].reject(error('NotAllowedError'));middle.requests[0].resolve();await flush();
    assert.equal(player.snapshot().status,'loading');assert.equal(last.requests.length,0);
    last.ready();last.requests[0].resolve();await flush();
    first.ended=true;oldEvents.forEach(deliver=>deliver());
    assert.equal(player.snapshot().status,'playing');assert.equal(last.currentTime,0);assert.equal(last.requests.length,1);
    assert.deepEqual(h.elements.filter(audio=>!audio.paused),[last]);
  });

  test(channel+': stopping during loading or a pending play cancels later activity',async()=>{
    const h=harness(),player=h.context[channel];
    player.open('a','a.mp3');const loading=player.audio,ready=loading.queued('canplay');
    player.stop();loading.readyState=3;ready();assert.equal(loading.requests.length,0);assert.equal(player.snapshot().status,'idle');
    player.open('b','b.mp3');const playing=player.audio;playing.ready();player.pause();
    playing.requests[0].resolve();await flush();assert.equal(playing.paused,true);assert.equal(player.snapshot().status,'paused');
    void player.play();player.stop();playing.requests[1].reject(error('AbortError'));await flush();
    assert.equal(player.snapshot().status,'idle');assert.equal(h.elements.filter(audio=>!audio.paused).length,0);
  });

  test(channel+': blocked autoplay retries from zero and missing audio does not start',async()=>{
    const h=harness(),player=h.context[channel];player.open('a','a.mp3');player.audio.ready();
    player.audio.requests[0].reject(error('NotAllowedError'));await flush();assert.equal(player.snapshot().status,'blocked');
    player.audio.currentTime=9;void player.play();assert.equal(player.audio.currentTime,0);player.audio.requests[1].resolve();await flush();
    player.open('missing','missing.mp3');player.audio.emit('error');player.audio.ready();
    assert.equal(player.snapshot().status,'missing');assert.equal(player.audio.requests.length,0);
  });
}

test('music mute and volume survive scene changes; obsolete ducking frames cannot affect the new track',async()=>{
  const h=harness(),music=h.context.BackgroundMusic;
  music.setVolume(.5);music.open('a','a.mp3');const first=music.audio;first.ready();first.requests[0].resolve();await flush();
  first.currentTime=11;music.setVolume(.4);assert.equal(first.currentTime,11);
  music.setDucked(true);const oldFrames=h.frames.splice(0);
  music.open('b','b.mp3');const second=music.audio;assert.equal(first.paused,true);assert.equal(second.volume,.24);
  music.setDucked(false);oldFrames.forEach(frame=>frame(1000));assert.equal(second.volume,.4);
  music.setEnabled(false);second.ready();assert.equal(second.requests.length,0);
  music.open('a','a.mp3');music.audio.ready();assert.equal(music.audio.requests.length,0);assert.equal(music.snapshot().enabled,false);
  music.setEnabled(true);assert.equal(music.audio.currentTime,0);assert.equal(music.audio.volume,.4);assert.equal(music.audio.requests.length,1);
});
