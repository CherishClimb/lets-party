/* Shared scene playback lifecycle; narration and background music keep independent controls. */
(function (root) {
  'use strict';

  class SceneAudioController {
    constructor() {
      this.audio=typeof root.Audio==='function'?new root.Audio():null;
      this.current={id:'',src:''};
      this.status='idle';
      this.listener=()=>{};
      this.generation=0;
      this.playRequest=0;
      this.handlers=[];
      this.wantsPlay=false;
      this.playPending=false;
      this.needsReset=true;
    }
    subscribe(listener) {
      this.listener=typeof listener==='function'?listener:()=>{};
      this.emit();
    }
    snapshot() { return {...this.current,status:this.status,supported:!!this.audio}; }
    emit() { this.listener(this.snapshot()); }
    canPlay() { return true; }
    configure(audio) { audio.volume=1; }
    open(id,src,options={}) {
      if(!this.audio||!id||!src) {this.stop();return;}
      const loop=options.loop===true;
      // UI rerenders do not restart playback; a new visit (even to the same URL) does.
      if(options.sceneKey!==undefined && this.current.sceneKey===options.sceneKey && this.current.id===id && this.current.src===src && this.current.loop===loop) return;
      this.stop(false);
      // Retire the previous element before creating its replacement. Events from an old
      // resource cannot be mistaken for events from a later visit to that same resource.
      const audio=this.audio=new root.Audio(),generation=this.generation;
      const active=()=>this.audio===audio && this.generation===generation && !!this.current.id;
      this.current={id,src,loop,sceneKey:options.sceneKey};
      this.status='loading';this.needsReset=true;this.wantsPlay=this.canPlay();
      const listen=(type,handler)=>{
        const guarded=()=>{if(active()) handler();};
        audio.addEventListener(type,guarded);this.handlers.push([type,guarded]);
      };
      const ready=()=>{
        if(!active() || audio.readyState<2 || this.status!=='loading') return;
        this.status='paused';this.emit();
        if(active()&&this.wantsPlay) void this.play();
      };
      listen('loadeddata',ready);
      listen('canplay',ready);
      listen('playing',()=>{
        if(!this.wantsPlay||audio.paused) return;
        this.status='playing';this.emit();
      });
      listen('pause',()=>{
        if(!audio.paused||this.status!=='playing') return;
        this.status='paused';this.emit();
      });
      listen('ended',()=>{
        if(!audio.ended) return;
        this.wantsPlay=false;this.playPending=false;this.playRequest++;
        this.status='ended';this.emit();
      });
      listen('error',()=>{
        this.wantsPlay=false;this.playPending=false;this.playRequest++;
        audio.pause();this.status='missing';this.emit();
      });
      audio.preload='auto';audio.loop=loop;this.configure(audio);
      audio.src=src;
      this.emit();
      audio.load();
      ready();
    }
    async play(restart=false) {
      const audio=this.audio;
      if(!audio||!this.current.id||!this.canPlay()||this.status==='missing') return false;
      if(restart||this.status==='ended') {
        this.playRequest++;this.playPending=false;audio.pause();this.status='paused';this.needsReset=true;
      }
      this.wantsPlay=true;
      if(audio.readyState<2) {this.status='loading';this.emit();return false;}
      if(this.playPending||this.status==='playing') return true;
      const generation=this.generation,request=++this.playRequest,reset=this.needsReset;
      const active=()=>this.audio===audio && this.generation===generation && this.playRequest===request && this.wantsPlay;
      this.playPending=true;
      try {
        // Reset after readiness, immediately before play, including cached/same-source visits.
        if(reset) audio.currentTime=0;
        this.needsReset=false;
        await audio.play();
        if(!active()) {
          if(this.audio!==audio||!this.wantsPlay) audio.pause();
          return false;
        }
        this.playPending=false;
        if(!audio.paused) {this.status='playing';this.emit();}
        return !audio.paused;
      } catch(error) {
        if(!active()) return false;
        this.playPending=false;this.wantsPlay=false;this.needsReset=reset;
        this.status=error?.name==='NotAllowedError'?'blocked':error?.name==='AbortError'?'paused':'missing';
        this.emit();return false;
      }
    }
    pause() {
      this.wantsPlay=false;this.playPending=false;this.playRequest++;
      this.audio?.pause();
      this.status=this.current.id?'paused':'idle';this.emit();
    }
    toggle() {
      if(this.wantsPlay) this.pause();
      else void this.play();
    }
    replay() { void this.play(true); }
    stop(notify=true) {
      // Invalidate handlers and promises before pause/load can dispatch events.
      this.generation++;this.playRequest++;this.wantsPlay=false;this.playPending=false;
      if(this.audio) {
        for(const [type,handler] of this.handlers) this.audio.removeEventListener(type,handler);
        this.audio.pause();
        try {this.audio.currentTime=0;} catch {}
        this.audio.removeAttribute('src');
        this.audio.load();
      }
      this.handlers=[];this.current={id:'',src:''};this.status='idle';this.needsReset=true;
      if(notify) this.emit();
    }
  }

  class MusicController extends SceneAudioController {
    constructor() {
      super();
      this.enabled=true;this.ducked=false;this.normalVolume=.10;this.duckRatio=.6;this.fadeToken=0;
      if(this.audio) this.configure(this.audio);
    }
    snapshot() { return {...super.snapshot(),volume:this.audio?.volume??0,normalVolume:this.normalVolume,ducked:this.ducked,enabled:this.enabled}; }
    canPlay() { return this.enabled; }
    targetVolume() { return this.ducked?this.normalVolume*this.duckRatio:this.normalVolume; }
    configure(audio) { audio.volume=this.targetVolume(); }
    open(id,src,options={}) { super.open(id,src,{...options,loop:options.loop!==false}); }
    stop(notify=true) { this.fadeToken++;super.stop(notify); }
    setVolume(volume) {
      const next=Math.max(0,Math.min(1,Number(volume)));
      if(!Number.isFinite(next)) return;
      this.normalVolume=next;this.fadeToken++;
      if(this.audio) this.audio.volume=this.targetVolume();
      this.emit();
    }
    fadeTo(target,duration) {
      const audio=this.audio;
      if(!audio) return;
      const token=++this.fadeToken,start=audio.volume,raf=root.requestAnimationFrame?.bind(root);
      if(!raf||duration<=0) {audio.volume=target;return;}
      let started=null;
      const frame=time=>{
        if(token!==this.fadeToken||audio!==this.audio) return;
        if(started===null) started=time;
        const progress=Math.min(1,(time-started)/duration);
        audio.volume=start+(target-start)*progress;
        if(progress<1) raf(frame);
      };
      raf(frame);
    }
    setEnabled(enabled) {
      this.enabled=!!enabled;
      if(!this.enabled) {this.fadeToken++;this.pause();}
      else void this.play();
      if(this.audio) this.audio.volume=this.targetVolume();
      this.emit();
    }
    toggle() { this.setEnabled(!(this.enabled&&(this.wantsPlay||this.status==='playing'))); }
    setDucked(ducked) {
      if(this.ducked===!!ducked) return;
      this.ducked=!!ducked;
      if(this.status==='playing') this.fadeTo(this.targetVolume(),250);
      else if(this.audio) this.audio.volume=this.targetVolume();
    }
  }

  root.StoryNarration=new SceneAudioController();
  root.BackgroundMusic=new MusicController();
})(globalThis);
