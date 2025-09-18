from aqt import mw, gui_hooks
from aqt.qt import QObject
from aqt.reviewer import Reviewer

# Web-Assets ausliefern
addon_id = mw.addonManager.addonFromModule(__name__)
mw.addonManager.setWebExports(__name__, r"web/(.*\.(css|js))")

def inject_assets(web_content, context):
    # immer injizieren (Reviewer, Vorschau, Browser)
    web_content.css.append(f"/_addons/{addon_id}/web/ordering.css")
    web_content.js.append(f"/_addons/{addon_id}/web/ordering.js")

gui_hooks.webview_will_set_content.append(inject_assets)

# ------- Notiztyp „Sortieren (DnD)“ anlegen/aktualisieren -------

def ensure_model(col):
    mm = col.models
    name = "Sortieren (DnD)"
    m = mm.by_name(name)
    if not m:
        m = mm.new(name)
        # Felder
        for fname in ["Question"] + [f"Item{i}" for i in range(1, 21)] + ["AnswerKey", "Info"]:
            f = mm.new_field(fname)
            mm.add_field(m, f)

        # Kartenvorlage
        t = mm.new_template("Card 1")

        # Konfiguration lesen, um sie ins Template zu schreiben
        cfg = mw.addonManager.getConfig(__name__) or {}
        max_items = int(cfg.get("maxItems", 10))
        if max_items < 1: max_items = 1
        if max_items > 20: max_items = 20

        # FRONT
        # Wir geben die Items als data-Attribute aus; keine Absatz-Logik nötig.
        items_attrs = "\n".join(
            [f'  data-item{i}="{{{{text:Item{i}}}}}}"'
             for i in range(1, 21)]
        )
        t["qfmt"] = rf"""
<div class="odnd-card">
  <div class="odnd-question">{{{{Question}}}}</div>

  <!-- Daten-Container: JS liest hieraus Items/Key/Konfig -->
  <div id="odnd-data"
       data-max="{max_items}"
       data-key="{{{{text:AnswerKey}}}}"
{items_attrs}>
  </div>

  <div class="odnd-root"></div>

  <div class="odnd-controls">
    <button class="odnd-btn odnd-check">Prüfen</button>
    <button class="odnd-btn odnd-show">Lösung zeigen</button>
    <button class="odnd-btn odnd-reset">Neu mischen</button>
  </div>

  <div class="odnd-feedback" role="status" aria-live="polite"></div>
</div>
""".strip()

        # BACK: nur Zusatzinfos anzeigen
        t["afmt"] = """
{{FrontSide}}
<hr id="answer">
<div class="odnd-info-wrap">
  {{#Info}}
  <div class="odnd-info-title">Zusatzinformationen:</div>
  <div class="odnd-info">{{Info}}</div>
  {{/Info}}
  {{^Info}}
  <div class="odnd-info-muted">Keine Zusatzinformationen.</div>
  {{/Info}}
</div>
""".strip()

        mm.add_template(m, t)
        mm.add(m)
    else:
        # Modell existiert – sicherstellen, dass alle Felder vorhanden sind
        fields = [fld["name"] for fld in m["flds"]]
        changed = False
        def add_field(name):
            nonlocal changed
            if name not in fields:
                f = mm.new_field(name)
                mm.add_field(m, f)
                changed = True

        add_field("Question")
        for i in range(1, 21):
            add_field(f"Item{i}")
        add_field("AnswerKey")
        add_field("Info")

        # Template falls älter – neu setzen (überschreibt nicht die Notizen)
        if m["tmpls"]:
            cfg = mw.addonManager.getConfig(__name__) or {}
            max_items = int(cfg.get("maxItems", 10))
            if max_items < 1: max_items = 1
            if max_items > 20: max_items = 20

            items_attrs = "\n".join(
                [f'  data-item{i}="{{{{text:Item{i}}}}}}"'
                 for i in range(1, 21)]
            )
            m["tmpls"][0]["qfmt"] = rf"""
<div class="odnd-card">
  <div class="odnd-question">{{{{Question}}}}</div>

  <div id="odnd-data"
       data-max="{max_items}"
       data-key="{{{{text:AnswerKey}}}}"
{items_attrs}>
  </div>

  <div class="odnd-root"></div>

  <div class="odnd-controls">
    <button class="odnd-btn odnd-check">Prüfen</button>
    <button class="odnd-btn odnd-show">Lösung zeigen</button>
    <button class="odnd-btn odnd-reset">Neu mischen</button>
  </div>
  <div class="odnd-feedback" role="status" aria-live="polite"></div>
</div>
""".strip()

            m["tmpls"][0]["afmt"] = """
{{FrontSide}}
<hr id="answer">
<div class="odnd-info-wrap">
  {{#Info}}
  <div class="odnd-info-title">Zusatzinformationen:</div>
  <div class="odnd-info">{{Info}}</div>
  {{/Info}}
  {{^Info}}
  <div class="odnd-info-muted">Keine Zusatzinformationen.</div>
  {{/Info}}
</div>
""".strip()

            changed = True

        if changed:
            mm.save(m)

def on_collection_did_load(col):
    try:
        ensure_model(col)
    except Exception:
        import traceback
        traceback.print_exc()

gui_hooks.collection_did_load.append(on_collection_did_load)
