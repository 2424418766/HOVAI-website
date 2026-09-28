import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
import { storageSaved, getStore } from './helpers/blobs-stub.mjs';
const saved=storageSaved;
const store=getStore();
const origin='https://portfolio.test',ADMIN_PASSWORD='test-password';
const env={ADMIN_PASSWORD};
const call=(path,options={})=>worker.fetch(new Request(origin+path,options),env);

// Log in through the real endpoint and reuse the signed token for write requests.
const login=await call('/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:ADMIN_PASSWORD})});
assert.equal(login.status,200);const token=(await login.json()).token;
const auth={Origin:origin,Authorization:'Bearer '+token};

assert.equal((await call('/api/login',{method:'POST',headers:{Origin:origin},body:JSON.stringify({password:'wrong'})})).status,401);
assert.equal((await call('/api/login',{method:'POST',headers:{Origin:'https://evil.test'},body:JSON.stringify({password:ADMIN_PASSWORD})})).status,403);
assert.equal((await call('/api/login',{method:'POST',headers:{Origin:origin},body:'not json'})).status,400);
assert.equal((await call('/api/portfolio',{headers:{Origin:origin,Authorization:'Bearer 12345.forged'}})).status===200,true);

let r=await call('/api/portfolio');let initial=await r.json();assert.equal(initial.canEdit,false);assert.equal(initial.data.projects.length,15);
assert.equal((await call('/api/portfolio',{method:'PUT',body:'{}'})).status,403);
assert.equal((await call('/api/portfolio',{method:'PUT',headers:{...auth,Origin:'https://evil.test'},body:'{}'})).status,403);
assert.equal((await call('/api/portfolio',{method:'PUT',headers:{Origin:origin},body:'{}'})).status,403);
r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':'seed'},body:JSON.stringify(initial.data)});assert.equal(r.status,200);let rev=(await r.json()).etag;
assert.equal((await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':'seed'},body:JSON.stringify(initial.data)})).status,409);
initial.data.name='张活海';r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':rev},body:JSON.stringify(initial.data)});assert.equal(r.status,200);
r=await call('/api/portfolio',{headers:auth});assert.equal((await r.json()).canEdit,true);
assert.equal((await call('/api/upload',{method:'POST',headers:auth,body:'invalid'})).status,400);
r=await call('/api/upload',{method:'POST',headers:auth,body:new Uint8Array([255,216,255,217])});assert.equal(r.status,200);const uploaded=await r.json();r=await call(uploaded.src);assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),new Uint8Array([255,216,255,217]));
assert.equal((await call('/')).status,200);assert.equal((await call('/seed/0353.jpg')).headers.get('Content-Type'),'image/jpeg');
console.log('Passed: persistence, upload, authorization, origin checks, concurrent-save conflict, assets');

// Category metadata and motion files survive the same durable save/upload flow.
r=await call('/api/portfolio',{headers:auth});let current=await r.json();current.data.projects[0].category='fashion';current.data.projects[0].titleEn='New editorial';
r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':current.etag},body:JSON.stringify(current.data)});assert.equal(r.status,200);
r=await call('/api/portfolio');assert.equal((await r.json()).data.projects[0].category,'fashion');
const mp4=new Uint8Array([0,0,0,16,102,116,121,112,109,112,52,50,0,0,0,0]);r=await call('/api/upload',{method:'POST',headers:{...auth,'Content-Type':'video/mp4'},body:mp4});assert.equal(r.status,200);const movie=await r.json();assert.ok(movie.src.endsWith('.mp4'));r=await call(movie.src);assert.equal(r.headers.get('Content-Type'),'video/mp4');
assert.equal((await call('/api/upload',{method:'POST',headers:{...auth,'Content-Type':'video/mp4'},body:'not a video'})).status,400);
console.log('Passed: category persistence and validated video upload/playback response');

r=await call('/api/portfolio',{headers:auth});current=await r.json();current.data.projects[0].layout='sequence';current.data.categoryCovers={still:current.data.projects[0].images[1].id,about:current.data.projects[0].images[0].id};current.data.categoryMobileCovers={still:current.data.projects[0].images[0].id};current.data.categoryThumbFocus={still:{desktop:{x:62,y:37,zoom:165},mobile:{x:40,y:65,zoom:120}}};current.data.categoryCoverAssets={still:'/media/00000000-0000-0000-0000-000000000001.jpg'};current.data.categoryCoverMobileAssets={still:'/media/00000000-0000-0000-0000-000000000002.jpg'};current.data.categoryCoverCropRects={still:{desktop:{x:0,y:10,w:100,h:80},mobile:{x:30,y:0,w:40,h:100}}};current.data.categoryThumbCropRects={still:{desktop:{x:12,y:8,w:74,h:55,ratio:1.5},mobile:{x:20,y:10,w:58,h:62,ratio:.72}}};
r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':current.etag},body:JSON.stringify(current.data)});assert.equal(r.status,200);
r=await call('/api/portfolio');const reread=await r.json();assert.equal(reread.data.projects[0].layout,'sequence');assert.equal(reread.data.categoryCovers.still,current.data.categoryCovers.still);assert.equal(reread.data.categoryMobileCovers.still,current.data.categoryMobileCovers.still);assert.equal(reread.data.categoryThumbFocus.still.desktop.x,62);assert.equal(reread.data.categoryThumbFocus.still.desktop.zoom,165);assert.equal(reread.data.categoryThumbFocus.still.mobile.y,65);assert.equal(reread.data.categoryCovers.about,current.data.categoryCovers.about);assert.equal(reread.data.categoryCoverAssets.still,current.data.categoryCoverAssets.still);assert.equal(reread.data.categoryCoverMobileAssets.still,current.data.categoryCoverMobileAssets.still);assert.equal(reread.data.categoryCoverCropRects.still.mobile.w,40);assert.equal(reread.data.categoryThumbCropRects.still.desktop.x,12);assert.equal(reread.data.categoryThumbCropRects.still.mobile.h,62);assert.equal(reread.data.categoryThumbCropRects.still.desktop.ratio,1.5);
current.data.projects[0].layout='invalid';r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':reread.etag},body:JSON.stringify(current.data)});assert.equal(r.status,400);current=structuredClone(reread);current.data.categoryThumbCropRects.still.desktop.x=90;r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':reread.etag},body:JSON.stringify(current.data)});assert.equal(r.status,400);current=structuredClone(reread);current.data.categoryThumbFocus.still.desktop.zoom=251;r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':reread.etag},body:JSON.stringify(current.data)});assert.equal(r.status,400);
console.log('Passed: persistent layout/independent covers and invalid-layout rejection');

// Existing live portfolios are augmented, never replaced; saved removals stay removed.
const catalog=JSON.parse((await import('node:fs')).readFileSync('src/video-defaults.json','utf8'));
const originals=Object.keys(catalog).map((id,n)=>({id,src:`/media/${id}.mp4`,type:'video',name:`clip${n}.mp4`,alt:'',wide:true}));
const base=JSON.parse((await import('node:fs')).readFileSync('src/seed.json','utf8'));base.projects.unshift({id:'live-films',title:'新项目',titleEn:'',year:'',section:'work',category:'motion',featured:false,cover:originals[0].id,images:originals});await store.set('portfolio.json',JSON.stringify(base));
r=await call('/api/portfolio');const merged=await r.json();assert.equal(merged.data.projects.filter(p=>p.category==='fashion').length,7);assert.equal(merged.data.projects.filter(p=>p.category==='fashion').flatMap(p=>p.images).length,43);const films=merged.data.projects[0].images;assert.deepEqual(films.map(i=>i.src),originals.map(i=>i.src));assert.ok(films.every(i=>i.poster&&i.title));
merged.data.projects=merged.data.projects.filter(p=>p.id!=='fashion-look-1');r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':merged.etag},body:JSON.stringify(merged.data)});assert.equal(r.status,200);r=await call('/api/portfolio');assert.equal((await r.json()).data.projects.filter(p=>p.category==='fashion').length,6);
console.log('Passed: 7-project / 43-photo import, all 11 video sources preserved, cover enrichment, edits/removals retained');

// Crop and editorial settings round-trip through the existing conflict-safe save.
r=await call('/api/portfolio',{headers:auth});current=await r.json();const edited=current.data.projects[0];edited.composition='spread';edited.homeFit='contain';edited.emphasis=true;Object.assign(edited.images[0],{frame:'custom',fit:'cover',focusX:23,focusY:71,crop:{x:10,y:15,w:65,h:75}});const originalSrc=edited.images[0].src;
r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':current.etag},body:JSON.stringify(current.data)});assert.equal(r.status,200);r=await call('/api/portfolio');current=await r.json();assert.equal(current.data.projects[0].images[0].focusY,71);assert.equal(current.data.projects[0].images[0].src,originalSrc);assert.equal(current.data.projects[0].composition,'spread');assert.equal(current.data.projects[0].images[0].crop.w,65);
current.data.projects[0].images[0].focusX=101;assert.equal((await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':current.etag},body:JSON.stringify(current.data)})).status,400);
console.log('Passed: editable crop/layout persistence, original source retention, invalid focal position rejection');


// New projects use a hidden internal title and should save without a title field in the editor.
r=await call('/api/portfolio',{headers:auth});current=await r.json();const fresh={id:'new-project-test',title:'',titleEn:'',category:'still',layout:'lead',composition:'auto',year:'',section:'work',featured:false,cover:'new-project-image-1',images:Array.from({length:3},(_,n)=>({id:`new-project-image-${n+1}`,src:`/seed/${String(n+1).padStart(4,'0')}.jpg`,name:`photo-${n+1}.jpg`,alt:'',wide:false}))};
current.data.projects.unshift(fresh);r=await call('/api/portfolio',{method:'PUT',headers:{...auth,'If-Match':current.etag},body:JSON.stringify(current.data)});assert.equal(r.status,200);r=await call('/api/portfolio');const created=await r.json();assert.equal(created.data.projects[0].title,'新项目');assert.equal(created.data.projects[0].images.length,3);
console.log('Passed: a project with a blank hidden title saves, retains its images, and receives an internal default title');
