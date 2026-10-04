export const store = { user: null, config: { flags: {}, banner: '', maintenance: false }, unread: 0, invites: 0 };
const subs = new Set();
export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const emit = () => subs.forEach((f) => f(store));
