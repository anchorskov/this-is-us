// static/js/utils/disable-logs.js
// Silences console logs in production except for error and warning

(function disableLogsInProd() {
  const isProd = location.hostname !== "localhost" && !location.hostname.includes("127.0.0.1");

  if (isProd) {
    console.log   = () => {};
    console.debug = () => {};
    console.info  = () => {};
    // Allow .warn and .error
  }
})();
