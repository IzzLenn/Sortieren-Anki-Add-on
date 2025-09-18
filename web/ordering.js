// ordering.js — Sortieren: einzelne Item-Felder (Item1..Item20), kein Absatz-Splitting

(function () {
  // Helpers
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function normalizeText(s) {
    return (s || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u2028\u2029]/g, "\n")
      .replace(/\u00A0/g, " ")
      .trim();
  }

  // Daten aus #odnd-data lesen
  function readData() {
    var data = document.getElementById("odnd-data");
    if (!data) return { items: [], key: [], max: 10 };

    var max = parseInt(data.getAttribute("data-max") || "10", 10);
    if (isNaN(max) || max < 1) max = 1;
    if (max > 20) max = 20;

    var items = [];
    for (var i = 1; i <= 20; i++) {
      var raw = data.getAttribute("data-item" + i);
      if (typeof raw === "string") {
        var txt = normalizeText(raw);
        if (txt) items.push({ t: txt, idx: i - 1 }); // idx = 0-basiert
      }
      if (items.length >= max) break;
    }

    var keyRaw = data.getAttribute("data-key") || "";
    var key = keyRaw.split(/[,;\s]+/)
      .map(function (s) { return parseInt(s, 10); })
      .filter(function (n) { return !isNaN(n) && n >= 1 && n <= items.length; })
      .map(function (n) { return n - 1; }); // 0-basiert gegen Items-Liste

    return { items: items, key: key, max: max };
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // UI
  function buildItem(text, index) {
    var li = document.createElement("li");
    li.className = "odnd-item";
    li.draggable = true;
    li.dataset.index = String(index);
    li.textContent = text;

    li.addEventListener("dragstart", function (e) {
      try { e.dataTransfer.setData("text/plain", li.dataset.index); } catch (_) {}
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", function () { li.classList.remove("dragging"); });
    li.addEventListener("dragover", function (e) {
      e.preventDefault();
      var dragging = $(".odnd-item.dragging");
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

    // baseItems: [{t, idx}] ; idx = 0..max-1 entsprechend Item1..ItemN
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
      setFeedback("ℹ️ Kein (gültiger) AnswerKey – Sortieren ohne Prüfung möglich.", true);
    }
  }

  function renderSolution(listEl, baseItems, key) {
    if (!listEl || !key || !key.length) return;
    listEl.innerHTML = "";
    key.forEach(function (idx) {
      // idx bezieht sich auf Position in baseItems (0..len-1)
      var item = baseItems.find(function (o) { return o.idx === idx; });
      var text = item ? item.t : "";
      var li = document.createElement("li");
      li.textContent = text;
      listEl.appendChild(li);
    });
  }

  // Bootstrapping
  function init() {
    var dataEl = document.getElementById("odnd-data");
    if (!dataEl) return false;

    var parsed = readData();
    var items = parsed.items;   // [{t, idx}]
    var key   = parsed.key;     // [idx...]
    if (!items.length) return false;

    var root = document.querySelector(".odnd-root");
    if (root) renderInteractive(root, items, key);

    var sol = document.querySelector(".odnd-solution-list");
    if (sol && key && key.length) renderSolution(sol, items, key);

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
