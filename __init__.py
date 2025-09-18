from aqt import mw, gui_hooks
import os

addon_id = mw.addonManager.addonFromModule(__name__)
mw.addonManager.setWebExports(__name__, r"(web|card)/(.*\.(css|js|html))")

def inject_assets(web_content, context):
    web_content.css.append(f"/_addons/{addon_id}/web/ordering.css")
    web_content.js.append(f"/_addons/{addon_id}/web/ordering.js")

gui_hooks.webview_will_set_content.append(inject_assets)

def _read_file(rel_path: str) -> str:
    return open(os.path.join(os.path.dirname(__file__), rel_path), "r", encoding="utf-8").read()

def _build_front_template(max_items: int) -> str:
    front = _read_file("card/front.html")
    front = front.replace("%%ADDON_ID%%", addon_id)
    front = front.replace("%%MAX_ITEMS%%", str(max_items))
    return front.strip()

def _build_back_template() -> str:
    back = _read_file("card/back.html")
    back = back.replace("%%ADDON_ID%%", addon_id)
    return back.strip()

def ensure_model(col):
    mm = col.models
    name = "Sortieren (DnD)"
    model = mm.by_name(name)

    cfg = mw.addonManager.getConfig(__name__) or {}
    max_items = int(cfg.get("maxItems", 10))
    if max_items < 1: max_items = 1
    if max_items > 20: max_items = 20

    if not model:
        model = mm.new(name)
        for fname in ["Question"] + [f"Item{i}" for i in range(1, 21)] + ["AnswerKey", "Info"]:
            f = mm.new_field(fname)
            mm.add_field(model, f)

        t = mm.new_template("Card 1")
        t["qfmt"] = _build_front_template(max_items)
        t["afmt"] = _build_back_template()
        mm.add_template(model, t)
        mm.add(model)
    else:
        have = {fld["name"] for fld in model["flds"]}
        changed = False

        def add_field(name):
            nonlocal changed
            if name not in have:
                mm.add_field(model, mm.new_field(name))
                have.add(name)
                changed = True

        add_field("Question")
        for i in range(1, 21):
            add_field(f"Item{i}")
        add_field("AnswerKey")
        add_field("Info")

        if model["tmpls"]:
            model["tmpls"][0]["qfmt"] = _build_front_template(max_items)
            model["tmpls"][0]["afmt"] = _build_back_template()
            changed = True

        if changed:
            mm.save(model)

def on_collection_did_load(col):
    try:
        ensure_model(col)
    except Exception:
        import traceback
        traceback.print_exc()

gui_hooks.collection_did_load.append(on_collection_did_load)
