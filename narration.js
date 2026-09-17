/* One reusable narration player for all story scenes. */
(function (root) {
  'use strict';

  class NarrationController {
    constructor() {
      this.audio=typeof root.Audio==='function'?new root.Audio():null;
      this.current={id:'',src:''};
      this.status='idle';
      this.listener=()=>{};
      this.changing=false;
      if(!this.audio) return;
      this.audio.preload='auto';
      this.audio.addEventListener('playing',()=>{
        if(!this.current.id) return;
        this.status='playing';this.emit();
      });
      this.audio.addEventListener('pause',()=>{
        if(this.changing||!this.current.id||this.status==='ended') return;
        this.status='paused';this.emit();
      });
      this.audio.addEventListener('ended',()=>{
        if(!this.current.id) return;
        this.status='ended';this.emit();
      });
      this.audio.addEventListener('canplay',()=>{
        if(!this.current.id||this.status!=='loading') return;
        this.status='paused';this.emit();
      });
      this.audio.addEventListener('error',()=>{
        if(!this.current.id) return;
        this.status='missing';this.emit();
      });
    }
    subscribe(listener) {
      this.listener=typeof listener==='function'?listener:()=>{};
      this.emit();
    }
    snapshot() { return {...this.current,status:this.status,supported:!!this.audio}; }
    emit() { this.listener(this.snapshot()); }
    open(id,src) {
      if(!this.audio||!id||!src) {this.stop();return;}
      if(this.current.id===id&&this.current.src===src) {this.emit();return;}
      this.stop(false);
      this.current={id,src};
      this.status='loading';
      this.audio.src=src;
      this.audio.preload='auto';
      this.audio.load();
      this.emit();
      void this.play();
    }
    async play(restart=false) {
      if(!this.audio||!this.current.id) return false;
      const requestId=this.current.id;
      if(restart||this.status==='ended') this.audio.currentTime=0;
      try {
        const result=this.audio.play();
        if(result&&typeof result.then==='function') await result;
        if(this.current.id!==requestId) return false;
        if(this.current.id&&this.status!=='playing') {this.status='playing';this.emit();}
        return true;
      } catch(error) {
        if(!this.current.id||this.current.id!==requestId) return false;
        this.status=error?.name==='NotAllowedError'?'blocked':'missing';
        this.emit();
        return false;
      }
    }
    pause() {
      if(!this.audio||this.status!=='playing') return;
      this.audio.pause();
      if(this.status==='playing') {this.status='paused';this.emit();}
    }
    toggle() {
      if(this.status==='playing') this.pause();
      else void this.play();
    }
    replay() { void this.play(true); }
    stop(notify=true) {
      if(this.audio) {
        this.changing=true;
        this.audio.pause();
        try {this.audio.currentTime=0;} catch {}
        this.audio.removeAttribute?.('src');
        this.audio.load();
        this.changing=false;
      }
      this.current={id:'',src:''};
      this.status='idle';
      if(notify) this.emit();
    }
  }

  class MusicController {
    constructor() {
      this.audio=typeof root.Audio==='function'?new root.Audio():null;
      this.current={id:'',src:''};
      this.pending=null;
      this.status='idle';
      this.enabled=true;
      this.ducked=false;
      this.normalVolume=.10;
      this.duckRatio=.6;
      this.fadeToken=0;
      this.changing=false;
      this.listener=()=>{};
      if(!this.audio) return;
      this.audio.preload='auto';
      this.audio.loop=true;
      this.audio.volume=this.normalVolume;
      this.audio.addEventListener('playing',()=>{
        if(!this.current.id) return;
        this.status='playing';
        this.emit();
      });
      this.audio.addEventListener('pause',()=>{
        if(this.changing||!this.current.id) return;
        this.status='paused';
        this.emit();
      });
      this.audio.addEventListener('canplay',()=>{
        if(!this.current.id||this.status!=='loading') return;
        this.status='paused';
        this.emit();
      });
      this.audio.addEventListener('error',()=>{
        if(!this.current.id) return;
        this.status='missing';
        this.emit();
      });
    }
    subscribe(listener) {
      this.listener=typeof listener==='function'?listener:()=>{};
      this.emit();
    }
    snapshot() { return {...this.current,status:this.status,supported:!!this.audio,volume:this.audio?.volume??0,normalVolume:this.normalVolume,ducked:this.ducked,enabled:this.enabled}; }
    emit() { this.listener(this.snapshot()); }
    targetVolume() { return this.ducked?this.normalVolume*this.duckRatio:this.normalVolume; }
    setVolume(volume) {
      const next=Math.max(0,Math.min(.3,Number(volume)));
      if(!Number.isFinite(next)) return;
      this.normalVolume=next;
      this.fadeToken++;
      if(this.audio) this.audio.volume=this.targetVolume();
      this.emit();
    }
    fadeTo(target,duration,onDone=()=>{}) {
      if(!this.audio) return;
      const token=++this.fadeToken,start=this.audio.volume,raf=root.requestAnimationFrame?.bind(root);
      if(!raf||duration<=0) {this.audio.volume=target;onDone();return;}
      let started=null;
      const frame=time=>{
        if(token!==this.fadeToken) return;
        if(started===null) started=time;
        const progress=Math.min(1,(time-started)/duration);
        this.audio.volume=start+(target-start)*progress;
        if(progress<1) raf(frame); else onDone();
      };
      raf(frame);
    }
    open(id,src) {
      if(!this.audio||!id||!src) return;
      if((this.current.id===id&&this.current.src===src)||(this.pending?.id===id&&this.pending?.src===src)) {
        if(this.enabled&&this.status==='blocked') void this.play();
        return;
      }
      this.pending={id,src};
      if(this.current.id&&this.status==='playing') this.fadeTo(0,350,()=>this.activatePending(true));
      else {this.fadeToken++;this.activatePending(false);}
    }
    activatePending(fadeIn) {
      const target=this.pending;
      if(!this.audio||!target) return;
      this.pending=null;
      this.changing=true;
      this.audio.pause();
      try {this.audio.currentTime=0;} catch {}
      this.current=target;
      this.status='loading';
      this.audio.src=target.src;
      this.audio.preload='auto';
      this.audio.loop=true;
      this.audio.volume=fadeIn?0:this.targetVolume();
      this.audio.load();
      this.changing=false;
      this.emit();
      if(this.enabled) void this.play(fadeIn);
    }
    async play(fadeIn=false) {
      if(!this.enabled||!this.audio||!this.current.id||this.status==='missing') return false;
      const requestId=this.current.id;
      try {
        const result=this.audio.play();
        if(result&&typeof result.then==='function') await result;
        if(this.current.id!==requestId) return false;
        this.status='playing';
        if(fadeIn) this.fadeTo(this.targetVolume(),350);
        else this.audio.volume=this.targetVolume();
        this.emit();
        return true;
      } catch(error) {
        if(this.current.id!==requestId) return false;
        this.status=error?.name==='NotAllowedError'?'blocked':'missing';
        this.emit();
        return false;
      }
    }
    setEnabled(enabled) {
      this.enabled=!!enabled;
      if(!this.audio) {this.emit();return;}
      if(!this.enabled) {
        this.fadeToken++;
        this.changing=true;
        this.audio.pause();
        this.changing=false;
        this.status=this.current.id?'paused':'idle';
        this.audio.volume=this.targetVolume();
        if(this.pending) this.activatePending(false);
        this.emit();
        return;
      }
      if(this.pending) this.activatePending(false);
      else void this.play();
      this.emit();
    }
    toggle() {
      this.setEnabled(!(this.enabled&&this.status==='playing'));
    }
    setDucked(ducked) {
      this.ducked=!!ducked;
      if(!this.audio) return;
      if(this.pending) return;
      if(this.status==='playing') this.fadeTo(this.targetVolume(),250);
      else this.audio.volume=this.targetVolume();
    }
  }

  root.StoryNarration=new NarrationController();
  root.BackgroundMusic=new MusicController();
})(globalThis);
