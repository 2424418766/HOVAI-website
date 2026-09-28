// In-memory stand-in for @netlify/blobs, used by the offline worker tests.
const saved=new Map();
let seq=0;
const store={
  async getWithMetadata(key,options={}){
    const entry=saved.get(key);
    if(!entry)return null;
    const data=options.type==='arrayBuffer'?entry.body.toArrayBuffer():Buffer.from(entry.body).toString('utf8');
    return {data,etag:entry.etag,metadata:entry.metadata||{}};
  },
  async getMetadata(key){
    const entry=saved.get(key);
    return entry?{etag:entry.etag,metadata:entry.metadata||{}}:null;
  },
  async set(key,body,options={}){
    seq+=1;
    saved.set(key,{body:normalize(body),etag:'rev'+seq,metadata:options.metadata||{}});
  },
};
function normalize(body){
  if(body instanceof Uint8Array)return withToArrayBuffer(body);
  if(body instanceof ArrayBuffer)return withToArrayBuffer(new Uint8Array(body));
  if(typeof body==='string')return body;
  return withToArrayBuffer(new Uint8Array(body));
}
function withToArrayBuffer(bytes){
  return Object.assign(bytes,{toArrayBuffer:()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
}
export const getStore=()=>store;
export const getDeployStore=()=>store;
export const connectLambda=()=>{};
export const listStores=async()=>({stores:[],next_cursor:undefined});
export const setEnvironmentContext=()=>{};
export const reset=()=>{saved.clear();seq=0;storageSaved=saved};
export const storageSaved=saved;
