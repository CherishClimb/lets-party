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

  root.StoryNarration=new NarrationController();
})(globalThis);
