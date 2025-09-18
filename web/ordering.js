// ordering.js — rendert normal; zeigt Warnhinweis, wenn Items Absatzumbrüche enthalten

(function () {
  // ===== Helpers =====
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function normalizeText(s) {
    // nur Normalisierung – KEIN Splitten
    return (s || "")
      .replace(/\r\n?/g, "\n")        // CRLF/CR -> LF
      .replace(/[\u2028\u2029]/g, "\n")
      .replace(/\u00A0/g, " ")
      .trim();
  }

  function readTextareaValue(id) {
    var el = document.getElementById(id);
    if (!el) return "";
    var val = (typeof el.value === "string" ? el.value : (el.textContent || ""));
    return normalizeText(val);
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ===== Daten lesen (Items einzeln aus <textarea>) =====
  function readData() {
    var data = document.getElementById("odnd-data");
    if (!data) return { items: [], key: [], max: 10, offenders: [] };

    var max = parseInt(data.getAttribute("data-max") || "10", 10);
    if (!Number.isFinite(max) || max < 1) max = 1;
    if (max > 20) max = 20;

    var items = [];
    var offenders = [];
    for (var i = 1; i <= 20; i++) {
      var txt = readTextareaValue("odnd-item" + i);
      if (txt) {
        items.push({ t: txt, idx: i - 1, num: i }); // num = 1-basiert fürs UI
        if (/\n/.test(txt)) offenders.push(i);      // enthält Absatz/Zeilenumbruch?
      }
      if (items.length >= max) break;
    }

    var keyRaw = readTextareaValue("odnd-key");
    var key = (keyRaw || "")
      .split(/[,;\s]+/)
      .map(function (s) { return parseInt(s, 10); })
      .filter(function (n) { return !isNaN(n) && n >= 1 && n <= items.length; })
      .map(function (n) { return n - 1 }); // 0-basiert

    return { items: items, key: key, max: max, offenders: offenders };
  }

  // ===== UI: sortierbare Liste =====
  function buildItem(text, index) {
    var li = document.createElement("li");
    li.className = "odnd-item";
    li.draggable = true;
    li.dataset.index = String(index);

    // Sicher & robust: als reinen Text darstellen (Zeilenumbrüche werden nicht als Absätze gezeigt)
    // Falls du Absätze optisch sehen willst, kann man text->HTML mit <br>/<p> wandeln.
    li.textContent = text;

    li.addEventListener("dragstart", function (e) {
      try { e.dataTransfer.setData("text/plain", li.dataset.index); } catch (_) {}
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", function () { li.classList.remove("dragging"); });
    li.addEventListener("dragover", function (e) {
      e.preventDefault();
      var dragging = document.querySelector(".odnd-item.dragging");
      if (!dragging || dragging === li) return;
      var list = li.parentElement;
      var rect = li.getBoundingClientRect();
      var before = (e.clientY - rect.top) < rect.height / 2;
      list.insertBefore(dragging, before ? li : li.nextSibling);
    });

    return li;
  }

  function renderInteractive(root, baseItems, key) {
    root.innerHTML = "";
    var list = document.createElement("ul");
    list.className = "odnd-list";

    var shuffled = shuffle(baseItems.slice());
    shuffled.forEach(function (o) { list.appendChild(buildItem(o.t, o.idx)); });
    root.appendChild(list);

    var host = root.parentElement || document;
    var feedback = host.querySelector(".odnd-feedback");
    var checkBtn = host.querySelector(".odnd-check");
    var showBtn  = host.querySelector(".odnd-show");
    var resetBtn = host.querySelector(".odnd-reset");

    function currentOrder() {
      return $all(".odnd-item", list).map(function (li) { return parseInt(li.dataset.index, 10); });
    }

    function setFeedback(msg, good) {
      if (!feedback) return;
      feedback.textContent = msg || "";
      feedback.classList.remove("good", "bad");
      if (msg) feedback.classList.add(good ? "good" : "bad");
    }

    var hasValidKey = (key && key.length === baseItems.length &&
      key.every(function (k) { return Number.isInteger(k) && k >= 0 && k < baseItems.length; }));

    if (checkBtn) {
      if (!hasValidKey) checkBtn.disabled = true;
      checkBtn.addEventListener("click", function () {
        if (!hasValidKey) return;
        var cur = currentOrder();
        var ok = cur.length === key.length && cur.every(function (v, i) { return v === key[i]; });
        setFeedback(ok ? "✅ Richtig!" : "❌ Nicht ganz. ‚Lösung zeigen‘ hilft.", ok);
      });
    }

    if (showBtn) {
      if (!hasValidKey) showBtn.disabled = true;
      showBtn.addEventListener("click", function () {
        if (!hasValidKey) return;
        var itemsByIndex = new Map();
        $all(".odnd-item", list).forEach(function (li) { itemsByIndex.set(parseInt(li.dataset.index, 10), li); });
        list.innerHTML = "";
        key.forEach(function (idx) { list.appendChild(itemsByIndex.get(idx)); });
        setFeedback("👀 Lösung eingeblendet.", true);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        var nodes = $all(".odnd-item", list).map(function (li) {
          return { t: li.textContent, i: parseInt(li.dataset.index, 10) };
        });
        list.innerHTML = "";
        shuffle(nodes).forEach(function (o) { list.appendChild(buildItem(o.t, o.i)); });
        setFeedback("", true);
      });
    }

    if (!hasValidKey) {
      setFeedback("ℹ️ Kein (gültiger) AnswerKey – Sortieren nicht möglich.", true);
    }
  }

  // ===== UI: Warnhinweis (nicht-blockierend) =====
  function showParagraphNotice(offenders) {
    var card = document.querySelector(".odnd-card");
    if (!card) return;

    // bereits vorhanden?
    var existing = card.querySelector(".odnd-notice");
    if (existing) existing.remove();

    var notice = document.createElement("div");
    notice.className = "odnd-notice";
    // dezente, aber auffällige Gestaltung; dark/light freundlich
    notice.style.margin = "0 0 8px";
    notice.style.padding = "8px 10px";
    notice.style.borderRadius = "8px";
    notice.style.border = "1px solid rgba(217,119,6,0.35)"; // amber-ish
    notice.style.background = "rgba(251,191,36,0.15)";      // amber-300 @ 15%
    notice.style.color = "inherit";
    notice.style.fontSize = "0.95em";

    var txt = "Hinweis: Einige Antwort-Elemente enthalten Absatzumbrüche. "
            + "Bitte vermeide Absätze innerhalb eines Elements, damit die Darstellung konsistent bleibt.";
    if (offenders && offenders.length) {
      txt += " Betroffen: " + offenders.map(function(n){return "Item" + n;}).join(", ") + ".";
    }

    notice.textContent = "⚠️ " + txt;

    // oberhalb der Liste einfügen (vor .odnd-root)
    var root = card.querySelector(".odnd-root");
    if (root && root.parentNode) {
      root.parentNode.insertBefore(notice, root);
    } else {
      card.insertBefore(notice, card.firstChild);
    }
  }

  // ===== Bootstrapping =====
  function init() {
    var dataEl = document.getElementById("odnd-data");
    if (!dataEl) return false;

    var parsed = readData();
    var items = parsed.items;
    var key   = parsed.key;
    var offenders = parsed.offenders || [];

    // Hinweis anzeigen (aber NICHT blockieren)
    if (offenders.length) {
      showParagraphNotice(offenders);
    }

    if (!items.length) return false;

    var root = document.querySelector(".odnd-root");
    if (root) renderInteractive(root, items, key);

    // Lösung rendern, falls Key vorhanden
    var sol = document.querySelector(".odnd-solution-list");
    if (sol && key && key.length === items.length) {
      sol.innerHTML = "";
      key.forEach(function (idx) {
        var item = items.find(function (o) { return o.idx === idx; });
        var li = document.createElement("li");
        li.textContent = item ? item.t : "";
        sol.appendChild(li);
      });
    }

    return true;
  }

  function boot() {
    if (init()) return;
    var tries = 0;
    (function retry() {
      if (init()) return;
      if (tries++ < 30) setTimeout(retry, 100);
    })();
  }

  document.addEventListener("DOMContentLoaded", boot);
  if (document.readyState === "interactive" || document.readyState === "complete") {
    boot();
  }
})();
