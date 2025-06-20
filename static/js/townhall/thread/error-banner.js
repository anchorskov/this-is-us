// static/js/townhall/thread/error-banner.js

export function showError(el, msg) {
  let banner = el.querySelector(".error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.className = "error-banner bg-red-100 text-red-700 p-2 rounded mb-2";
    el.insertBefore(banner, el.firstChild);
  }
  banner.textContent = msg;

  setTimeout(() => {
    if (banner.parentNode) {
      banner.remove();
    }
  }, 5000);
}
