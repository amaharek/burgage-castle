/* Anonymous tally shared by every page.
   Counts only on the live github.io site, so local test copies don't inflate it. */
window.Tally = (function () {
  "use strict";
  var BASE = "https://abacus.jasoncameron.dev";
  var NS = "burgage-castle-amaharek";
  var LIVE = /\.github\.io$/.test(location.hostname);

  // Writes the number into #id and reveals the box it sits in, if that box
  // starts hidden. Pages hide the box so a dead counter shows nothing at all
  // rather than a misleading zero.
  function show(id, value) {
    if (typeof value !== "number") return;
    var el = id && document.getElementById(id);
    if (!el) return;
    el.textContent = value.toLocaleString("en-IE");
    var box = el.closest ? el.closest("[data-tally-box]") : null;
    if (box) box.hidden = false;
  }

  function run(path, id, cb, opts) {
    return fetch(BASE + path, opts)
      .then(function (r) { return r.status === 404 ? { value: 0 } : (r.ok ? r.json() : Promise.reject()); })
      .then(function (d) {
        show(id, d.value);
        if (cb) cb(d.value);
      })
      .catch(function () { /* counter unavailable: the box stays hidden */ });
  }

  return {
    // Read a count without changing it. cb(value) runs on success.
    get: function (key, id, cb) {
      return run("/get/" + NS + "/" + key, id, cb);
    },
    // Add one, then show the new total. keepalive so the count still lands if
    // the browser backgrounds the page to open a mail app.
    hit: function (key, id, cb) {
      if (!LIVE) return Promise.resolve();
      return run("/hit/" + NS + "/" + key, id, cb, { keepalive: true });
    }
  };
})();
