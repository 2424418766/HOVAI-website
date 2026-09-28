import worker from '../../dist/server/index.js';

// Netlify expects the default export to be the handler function itself.
export default (request, context) => worker.fetch(request, context.env);
