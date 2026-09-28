import fs from 'node:fs';
const staticFiles={'/':['index.html','text/html; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8']};
const staticData=Object.fromEntries(Object.entries(staticFiles).map(([key,[file,type]])=>[key,{body:fs.readFileSync('src/'+file,'utf8'),type}]));
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist/server',{recursive:true});
fs.writeFileSync('dist/server/index.js',`const STATIC=${JSON.stringify(staticData)};\nconst SEED_DATA=${fs.readFileSync('src/seed.json','utf8')};\nconst SEED_ASSETS=${JSON.stringify({...JSON.parse(fs.readFileSync('src/seed-assets.json','utf8')),...JSON.parse(fs.readFileSync('src/fashion-assets.json','utf8'))})};\n`+`const FASHION_IMPORT=${fs.readFileSync('src/fashion-import.json','utf8')};\nconst VIDEO_DEFAULTS=${fs.readFileSync('src/video-defaults.json','utf8')};\n`+fs.readFileSync('src/worker.js','utf8'));
console.log('Built editable portfolio Worker');
