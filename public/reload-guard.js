// Recovers from a stale cached index.html that references assets which no
// longer exist (e.g. after a new deploy). If the entry script fails to load
// (blocked MIME type, 404, etc.), force a single cache-busted reload instead
// of leaving the user on a permanently blank page.
(function () {
  var STORAGE_KEY = "gb-reload-guard";
  var COOLDOWN_MS = 15000;

  function alreadyRetriedRecently() {
    try {
      var last = Number(sessionStorage.getItem(STORAGE_KEY) || 0);
      return Date.now() - last < COOLDOWN_MS;
    } catch {
      return false;
    }
  }

  function markRetried() {
    try {
      sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore (e.g. storage disabled)
    }
  }

  function forceFreshReload() {
    if (alreadyRetriedRecently()) return;
    markRetried();
    var url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString());
    window.location.replace(url.toString());
  }

  window.addEventListener(
    "error",
    function (event) {
      var target = event.target;
      if (target && target.tagName === "SCRIPT") {
        forceFreshReload();
      }
    },
    true,
  );

  // Vite's own signal when a dynamically imported chunk fails after a deploy.
  window.addEventListener("vite:preloadError", function () {
    forceFreshReload();
  });
})();
