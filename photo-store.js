/* Local-only memory photo storage and browser-side image preparation. */
(function (root) {
  'use strict';
  const DB_NAME='unicorn-rescue-memory-photos';
  const STORE_NAME='photos';
  const MAX_EDGE=1400;
  const JPEG_QUALITY=.84;
  const LARGE_FILE_BYTES=1_500_000;
  const allowedTypes=new Set(['image/jpeg','image/png','image/webp']);
  let databasePromise=null;

  function supported() { return !!root.indexedDB; }
  function openDatabase() {
    if(!supported()) return Promise.reject(new Error('indexeddb-unavailable'));
    if(databasePromise) return databasePromise;
    databasePromise=new Promise((resolve,reject)=>{
      const request=root.indexedDB.open(DB_NAME,1);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME,{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('indexeddb-open-failed'));
      request.onblocked=()=>reject(new Error('indexeddb-blocked'));
    });
    return databasePromise;
  }
  async function list() {
    if(!supported()) return [];
    const db=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readonly');
      const request=tx.objectStore(STORE_NAME).getAll();
      request.onsuccess=()=>resolve(request.result.sort((a,b)=>a.createdAt-b.createdAt));
      request.onerror=()=>reject(request.error||new Error('photo-list-failed'));
    });
  }
  async function save(blob,existing={}) {
    const db=await openDatabase();
    const record={
      id:existing.id||('photo-'+Date.now()+'-'+Math.random().toString(36).slice(2)),
      createdAt:existing.createdAt||Date.now(),
      type:blob.type||'image/jpeg',
      blob
    };
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete=()=>resolve(record);
      tx.onerror=()=>reject(tx.error||new Error('photo-save-failed'));
      tx.onabort=()=>reject(tx.error||new Error('photo-save-aborted'));
    });
  }
  async function remove(id) {
    if(!supported()) return;
    const db=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('photo-remove-failed'));
    });
  }
  async function clear() {
    if(!supported()) return;
    const db=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('photo-clear-failed'));
    });
  }
  async function decode(file) {
    if(typeof root.createImageBitmap==='function') {
      const image=await root.createImageBitmap(file);
      return {image,width:image.width,height:image.height,close:()=>image.close?.()};
    }
    if(!root.document||!root.URL?.createObjectURL) throw new Error('image-decoder-unavailable');
    const url=root.URL.createObjectURL(file);
    const image=new root.Image();
    try {
      await new Promise((resolve,reject)=>{
        image.onload=resolve;
        image.onerror=()=>reject(new Error('image-decode-failed'));
        image.src=url;
      });
      return {image,width:image.naturalWidth,height:image.naturalHeight,close:()=>root.URL.revokeObjectURL(url)};
    } catch(error) {
      root.URL.revokeObjectURL(url);
      throw error;
    }
  }
  async function prepare(file) {
    if(!file||!allowedTypes.has(file.type)) throw new Error('unsupported-photo-type');
    const decoded=await decode(file);
    try {
      const needsResize=Math.max(decoded.width,decoded.height)>MAX_EDGE;
      const needsCompression=file.size>LARGE_FILE_BYTES;
      if(!needsResize&&!needsCompression) return file;
      const scale=Math.min(1,MAX_EDGE/Math.max(decoded.width,decoded.height));
      const width=Math.max(1,Math.round(decoded.width*scale));
      const height=Math.max(1,Math.round(decoded.height*scale));
      const canvas=root.document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d',{alpha:false});
      if(!context) throw new Error('canvas-unavailable');
      context.fillStyle='#fff';context.fillRect(0,0,width,height);
      context.drawImage(decoded.image,0,0,width,height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',JPEG_QUALITY));
      if(!blob) throw new Error('photo-compression-failed');
      return blob;
    } finally {
      decoded.close();
    }
  }
  root.PhotoStore={supported,list,save,remove,clear,prepare,allowedTypes,MAX_EDGE,JPEG_QUALITY};
})(globalThis);
