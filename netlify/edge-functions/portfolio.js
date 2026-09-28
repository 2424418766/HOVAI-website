import worker from '../../dist/server/index.js';

// Netlify exposes environment variables through the `Netlify.env` global, not
// `context.env`, so adapt it to the plain object shape the Worker expects.
const readEnv=context=>{
  const netlifyEnv=globalThis.Netlify?.env;
  const source=netlifyEnv??context?.env;
  if(!source)return {};
  if(typeof source.toObject==='function')return source.toObject();
  return new Proxy({}, {get:(_,key)=>typeof source.get==='function'?source.get(key):source[key]});
};

// Netlify expects the default export to be the handler function itself.
export default (request,context)=>worker.fetch(request,readEnv(context));
