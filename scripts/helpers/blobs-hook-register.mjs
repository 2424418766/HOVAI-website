// Registers the @netlify/blobs test double before the worker is imported.
import { register } from 'node:module';
register('./blobs-hook.mjs', import.meta.url);
