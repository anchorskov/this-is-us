// static/js/townhall/thread/firestore-helpers.js
let _db = null;

export function initFirestore(dbInstance) {
  _db = dbInstance;
}

const get = () => {
  if (!_db) throw new Error("Firestore not initialized.");
  return _db;
};

export const THREADS  = () => get().collection("townhall_threads");
export const REPLIES  = id => THREADS().doc(id).collection("replies");
