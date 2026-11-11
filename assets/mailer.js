/* Shared engine for the email pages.
   Each page sets window.CAMPAIGN before loading this file. See late-works.html
   or roads.html for the shape of that object. Nothing is ever sent from here:
   every button just opens the visitor's own email app or webmail with the
   message pre-filled, so they read it and press Send themselves. */
(function () {
  "use strict";

  var C = window.CAMPAIGN;
  if (!C) return;

  /* Name, address and phone are shared between the pages so nobody has to type
     them twice. Everything else is kept per page. */
  var IDENTITY = "burgage-identity-v1";
  var ID_FIELDS = ["name", "address", "phone"];
  var STORE = C.store;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function enc(s) { return encodeURIComponent(s); }
  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; }
  }
  function writeStore(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* storage off: page still works */ }
  }

  /* ---- helpers handed to each email's body() ---- */
  var H = {
    join: function (items) {
      if (items.length <= 1) return items.join("");
      return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
    },
    bullets: function (items) {
      return items.map(function (i) { return "- " + i; }).join("\n");
    },
    addr: function (d) { return d.address || "[your address]"; },
    sig: function (d) {
      return "Kind regards,\n" + (d.name || "[Your name]") + "\n" +
        (d.address || "[Your address]") + (d.phone ? "\n" + d.phone : "");
    },
    personal: function (d) { return C.personal ? C.personal(d, H) : []; }
  };

  /* ---- build the cards ---- */
  var mails = $("#mails");
  C.order.forEach(function (key, i) {
    var m = C.emails[key];
    var card = document.createElement("article");
    card.className = "mail";
    card.setAttribute("data-key", key);
    card.innerHTML =
      '<div class="mail-top"><h3></h3><span class="count">' + (i + 1) + ' of ' + C.order.length + '</span></div>' +
      '<p class="small muted" data-blurb></p>' +
      '<dl class="meta">' +
        '<div class="meta-row"><dt>To</dt><dd class="addr" data-to></dd><button type="button" class="linkish" data-copy="to">Copy</button></div>' +
        '<div class="meta-row" data-cc-row><dt>Cc</dt><dd class="addr" data-cc></dd><button type="button" class="linkish" data-copy="cc">Copy</button></div>' +
        '<div class="meta-row"><dt>Subject</dt><dd data-subject></dd><button type="button" class="linkish" data-copy="subject">Copy</button></div>' +
      '</dl>' +
      '<div class="actions">' +
        '<a class="btn-primary" data-mailto href="#">Open in my email app</a>' +
        '<p class="hint">If nothing opens, choose an app below.</p>' +
        '<div class="secondary three">' +
          '<a class="btn-secondary" data-gmail href="#" target="_blank" rel="noopener">Gmail</a>' +
          '<a class="btn-secondary" data-outlook href="#" target="_blank" rel="noopener">Outlook</a>' +
          '<a class="btn-secondary" data-apple href="#">Apple&nbsp;Mail</a>' +
        '</div>' +
        '<button type="button" class="btn-secondary" data-copy="body">Copy message</button>' +
        '<p class="status" role="status">Review the draft in your email app, then press Send.</p>' +
      '</div>' +
      '<details><summary>Read the email</summary><pre class="preview" data-preview></pre></details>';
    $("h3", card).textContent = m.title;
    $("[data-blurb]", card).textContent = m.blurb;
    $("[data-to]", card).textContent = m.to.join("\n");
    $("[data-subject]", card).textContent = m.subject;
    if (m.cc && m.cc.length) {
      $("[data-cc]", card).textContent = m.cc.map(function (e) {
        return C.ccRoles && C.ccRoles[e] ? e + " (" + C.ccRoles[e] + ")" : e;
      }).join("\n");
    } else {
      $("[data-cc-row]", card).hidden = true;
    }
    mails.appendChild(card);
  });

  /* ---- reading the form ---- */
  function readData() {
    var d = {};
    C.fields.forEach(function (f) {
      var el = $("#" + f);
      d[f] = el ? el.value.trim() : "";
    });
    d.impactKeys = $all('input[name="impact"]:checked').map(function (i) { return i.value; });
    d.impacts = d.impactKeys.map(function (k) { return C.impacts[k]; });
    return d;
  }

  /* ---- the four ways out ---- */
  function cc(m) { return m.cc || []; }

  function mailtoHref(m, body) {
    // Apple Mail, Outlook desktop, the Gmail app: whatever handles mailto: here
    var q = [];
    if (cc(m).length) q.push("cc=" + cc(m).join(","));
    q.push("subject=" + enc(m.subject));
    q.push("body=" + enc(body.replace(/\n/g, "\r\n")));
    return "mailto:" + m.to.join(",") + "?" + q.join("&");
  }
  function gmailHref(m, body) {
    var url = "https://mail.google.com/mail/?view=cm&fs=1&to=" + enc(m.to.join(","));
    if (cc(m).length) url += "&cc=" + enc(cc(m).join(","));
    return url + "&su=" + enc(m.subject) + "&body=" + enc(body);
  }
  function outlookHref(m, body) {
    // Outlook's web compose link has no dependable cc parameter, so everyone
    // goes in To instead. Use "Copy addresses" if you'd rather split them.
    var all = m.to.concat(cc(m));
    return "https://outlook.live.com/mail/0/deeplink/compose?popoutv2=1" +
      "&to=" + enc(all.join(",")) +
      "&subject=" + enc(m.subject) +
      "&body=" + enc(body);
  }

  function render() {
    var d = readData();
    $all(".mail").forEach(function (card) {
      var m = C.emails[card.getAttribute("data-key")];
      var body = m.body(d, H);
      $("[data-preview]", card).textContent = body;
      var href = mailtoHref(m, body);
      $("[data-mailto]", card).href = href;
      $("[data-apple]", card).href = href;
      $("[data-gmail]", card).href = gmailHref(m, body);
      $("[data-outlook]", card).href = outlookHref(m, body);
    });
    save(d);
  }

  function save(d) {
    var id = readStore(IDENTITY);
    ID_FIELDS.forEach(function (f) { if (C.fields.indexOf(f) !== -1) id[f] = d[f]; });
    writeStore(IDENTITY, id);

    var prev = readStore(STORE);
    var out = { opened: prev.opened || [] };
    C.fields.forEach(function (f) { if (ID_FIELDS.indexOf(f) === -1) out[f] = d[f]; });
    out.impacts = d.impactKeys;
    writeStore(STORE, out);
  }

  /* Add any known entry that isn't already there, keeping the person's own lines */
  function withKnownLines(text, known) {
    var lines = (text || "").split("\n").filter(function (l) { return l.trim(); });
    var missing = known.filter(function (entry) {
      return !lines.some(function (l) { return l.indexOf(entry) !== -1; });
    }).map(function (entry) { return "- " + entry; });
    return missing.concat(lines).join("\n");
  }

  function load() {
    var pre = C.prefill;
    if (pre && $("#" + pre.field)) $("#" + pre.field).value = withKnownLines("", pre.lines);

    // Older versions of the late-works page kept name/address/phone in its own
    // store. Lift them into the shared one the first time.
    var id = readStore(IDENTITY);
    var page = readStore(STORE);
    ID_FIELDS.forEach(function (f) {
      var v = id[f] || page[f];
      if (v && $("#" + f)) $("#" + f).value = v;
    });

    C.fields.forEach(function (f) {
      if (ID_FIELDS.indexOf(f) !== -1) return;
      if (pre && f === pre.field) return;
      if (page[f] && $("#" + f)) $("#" + f).value = page[f];
    });
    if (pre && page[pre.field] && $("#" + pre.field)) {
      $("#" + pre.field).value = withKnownLines(page[pre.field], pre.lines);
    }
    if (Array.isArray(page.impacts)) {
      $all('input[name="impact"]').forEach(function (i) {
        i.checked = page.impacts.indexOf(i.value) !== -1;
      });
    }
    (page.opened || []).forEach(function (k) {
      var c = $('.mail[data-key="' + k + '"]');
      if (c) c.classList.add("opened");
    });
  }

  function updateShare() {
    var sent = $all(".mail.opened").length > 0;
    var msg = sent ? C.share.sent : C.share.neutral;
    var wa = $("#wa");
    if (wa) wa.href = "https://wa.me/?text=" + enc(msg + location.href.split("#")[0]);
  }

  function markOpened(key) {
    var c = $('.mail[data-key="' + key + '"]');
    if (c) c.classList.add("opened");
    updateShare();
    var s = readStore(STORE);
    s.opened = s.opened || [];
    if (s.opened.indexOf(key) === -1) s.opened.push(key);
    writeStore(STORE, s);
  }

  function validate() {
    var ok = true, first = null;
    C.required.forEach(function (f) {
      var wrap = $("#f-" + f);
      var input = $("#" + f);
      if (!wrap || !input) return;
      var empty = !input.value.trim();
      wrap.classList.toggle("invalid", empty);
      if (empty) { ok = false; if (!first) first = input; }
    });
    if (first) {
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(function () { first.focus({ preventScroll: true }); }, 300);
    }
    return ok;
  }

  function flash(btn, text) {
    var old = btn.getAttribute("data-label") || btn.textContent;
    btn.setAttribute("data-label", old);
    btn.textContent = text;
    clearTimeout(btn._t);
    btn._t = setTimeout(function () { btn.textContent = old; }, 1600);
  }

  function copyText(text, btn) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var done = false;
      try { done = document.execCommand("copy"); } catch (e) { done = false; }
      document.body.removeChild(ta);
      flash(btn, done ? "Copied" : "Couldn't copy");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flash(btn, "Copied"); }, fallback);
    } else {
      fallback();
    }
  }

  /* ---- wire up ---- */
  load();
  render();

  $("#details").addEventListener("input", function (e) {
    if (C.required.indexOf(e.target.id) !== -1 && e.target.value.trim()) {
      var wrap = $("#f-" + e.target.id);
      if (wrap) wrap.classList.remove("invalid");
    }
    render();
  });
  $("#details").addEventListener("submit", function (e) { e.preventDefault(); });

  $all(".mail").forEach(function (card) {
    var key = card.getAttribute("data-key");
    var m = C.emails[key];

    ["[data-mailto]", "[data-apple]", "[data-gmail]", "[data-outlook]"].forEach(function (sel) {
      $(sel, card).addEventListener("click", function (e) {
        if (!validate()) { e.preventDefault(); return; }
        render();
        var firstForThisEmail = !card.classList.contains("opened");
        markOpened(key);
        if (firstForThisEmail) Tally.hit(C.counterKey, "t-emails");
      });
    });

    $all("[data-copy]", card).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var what = btn.getAttribute("data-copy");
        if (what === "body" && !validate()) return;
        var text = what === "to" ? m.to.join(", ")
          : what === "cc" ? cc(m).join(", ")
          : what === "subject" ? m.subject
          : m.body(readData(), H);
        copyText(text, btn);
      });
    });
  });

  updateShare();
  Tally.get(C.counterKey, "t-emails");
  var copyLink = $("#copy-link");
  if (copyLink) {
    copyLink.addEventListener("click", function () { copyText(location.href.split("#")[0], this); });
  }
})();
