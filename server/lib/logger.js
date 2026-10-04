import { config } from '../config/env.js';
const stamp = () => new Date().toISOString();
const line = (lvl, msg, meta) => {
  if (config.isProd) return console.log(JSON.stringify({ t: stamp(), lvl, msg, ...meta }));
  return console.log(`${stamp()} ${lvl.toUpperCase().padEnd(5)} ${msg}`, meta && Object.keys(meta).length ? meta : '');
};
export const log = {
  info: (m, x) => line('info', m, x), warn: (m, x) => line('warn', m, x),
  error: (m, x) => line('error', m, x), debug: (m, x) => !config.isProd && line('debug', m, x),
};
