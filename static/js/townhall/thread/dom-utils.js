// static/js/townhall/thread/dom-utils.js

// Shorthand for querySelector
export const qs = (sel, par = document) => par.querySelector(sel);

// Create an element with optional class
export const $$ = (tag, cls = "") => {
  const el = document.createElement(tag);
  el.className = cls;
  return el;
};

// Nicely formatted date string
export const niceDate = ts =>
  ts?.toDate ? ts.toDate().toLocaleString() : "—";
