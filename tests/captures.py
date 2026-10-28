"""Captures et test de bout en bout du launcher, sans réseau.

Usage : python3 tests/captures.py <dossier_de_sortie> [<dossier_des_jeux>]

Toutes les requêtes vers https://pikifou.github.io/ sont servies depuis le disque :
  /ludiworld/...  -> docs/ de ce dépôt
  /<jeu>/...      -> <dossier_des_jeux>/<jeu>/docs/ (clones des dépôts des jeux), sinon une page vide
Un faux jeu /jeu-kit/ utilise ludi.js pour vérifier le dialogue launcher <-> kit.
"""
import mimetypes
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "captures")
GAMES = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://pikifou.github.io"

FAKE_GAME = """<!doctype html><meta charset=utf-8><title>Jeu kit</title>
<body style="background:#334;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh;margin:0">
<button id=b style="font-size:24px;padding:12px 24px">Marquer 42</button>
<script src="/ludiworld/kit/ludi.js"></script>
<script>Ludi.init({game:'jeu-kit'});document.getElementById('b').onclick=function(){Ludi.score('points',42);Ludi.progress('niveau',3);this.textContent='OK'};</script>"""

FAKE_CARD = {
    "ludi": 1, "id": "jeu-kit", "status": "draft",
    "title": {"fr": "Jeu kit", "en": "Kit game"}, "pitch": {"fr": "Test.", "en": "Test."},
    "url": BASE + "/jeu-kit/", "icon": BASE + "/ludiworld/icons/icon-512.png", "color": "#334455",
    "author": {"name": "Test"}, "languages": ["fr"], "age": {"min": 6, "max": 9}, "reading": "none",
    "learning": {"level": "none", "domains": []},
    "session": {"minutes": [1, 2], "natural_end": True},
    "content": {"fr": "Test.", "en": "Test."}, "devices": ["phone"], "offline": True,
    "healthy": {k: True for k in ["no_ads", "no_purchases", "no_subscription", "no_loot_boxes", "no_daily_pressure",
                                  "no_notifications", "no_strangers", "no_tracking", "natural_stops"]},
    "third_parties": [], "kit": True,
}


def serve(route):
    import json
    url = route.request.url
    path = url[len(BASE):].split("?")[0]
    if path.startswith("/jeu-kit/"):
        return route.fulfill(body=FAKE_GAME, content_type="text/html")
    if path == "/ludiworld/jeux/index.json" and getattr(serve, "with_kit", False):
        idx = json.loads((ROOT / "docs/jeux/index.json").read_text())
        idx["games"].append("jeu-kit.json")
        return route.fulfill(body=json.dumps(idx), content_type="application/json")
    if path == "/ludiworld/jeux/jeu-kit.json":
        return route.fulfill(body=json.dumps(FAKE_CARD), content_type="application/json")
    parts = path.strip("/").split("/", 1)
    rest = parts[1] if len(parts) > 1 else ""
    if parts[0] == "ludiworld":
        base = ROOT / "docs"
    elif GAMES and (GAMES / parts[0] / "docs").is_dir():
        base = GAMES / parts[0] / "docs"
    else:
        return route.fulfill(body=f"<h1 style='font:40px sans-serif'>{parts[0]}</h1>", content_type="text/html")
    f = base / (rest or "index.html")
    if f.is_dir():
        f = f / "index.html"
    if not f.exists():
        return route.fulfill(status=404, body="")
    return route.fulfill(body=f.read_bytes(), content_type=mimetypes.guess_type(str(f))[0] or "application/octet-stream")


def run():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, opts in {
            "telephone": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
            "ordinateur": dict(viewport={"width": 1280, "height": 860}),
        }.items():
            for scheme in ["light", "dark"]:
                ctx = browser.new_context(service_workers="block", locale="fr-FR", color_scheme=scheme, **opts)
                ctx.route(BASE + "/**", serve)
                page = ctx.new_page()
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.goto(BASE + "/ludiworld/")
                page.wait_for_selector(".game img")
                page.wait_for_timeout(600)
                page.screenshot(path=str(OUT / f"{name}-{scheme}-accueil.png"), full_page=True)
                if scheme == "dark":
                    ctx.close()
                    continue
                page.click(".game >> nth=0")
                page.wait_for_selector("#sheet[open]")
                page.wait_for_timeout(400)
                page.screenshot(path=str(OUT / f"{name}-fiche.png"))
                page.locator("#sheet").evaluate("e => e.scrollTop = 10000")
                page.wait_for_timeout(200)
                page.screenshot(path=str(OUT / f"{name}-fiche-bas.png"))
                page.click(".play")
                page.wait_for_timeout(2500)
                page.screenshot(path=str(OUT / f"{name}-jeu.png"))
                page.evaluate("history.back()")  # bouton retour : ferme le jeu
                page.wait_for_timeout(300)
                assert page.locator("#player").is_hidden(), "le retour doit fermer le jeu"
                assert page.locator("#sheet[open]").count() == 1, "la fiche reste ouverte"
                page.evaluate("history.back()")
                page.wait_for_timeout(300)
                assert page.locator("#sheet[open]").count() == 0, "le 2e retour ferme la fiche"
                ctx.close()

        # Dialogue launcher <-> kit avec un faux jeu
        serve.with_kit = True
        ctx = browser.new_context(service_workers="block", locale="en-US", viewport={"width": 390, "height": 844})
        ctx.route(BASE + "/**", serve)
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector(".game img")
        page.click(".game >> nth=4")
        page.click(".play")
        game = page.frame_locator("#player iframe")
        game.locator("#b").click()
        page.wait_for_timeout(300)
        store = page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).games['jeu-kit']")
        assert store["kit"] is True, store
        assert store["scores"]["points"]["value"] == 42, store
        assert store["progress"]["niveau"] == 3, store
        page.click("#player-back")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "kit-fiche-en.png"))
        ctx.close()
        browser.close()
    if errors:
        raise SystemExit("Erreurs JS : " + " | ".join(errors))
    print("OK : captures dans", OUT)


if __name__ == "__main__":
    run()
