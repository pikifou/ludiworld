"""Captures et test de bout en bout de l'appli, sans réseau.

Usage : python3 tests/captures.py <dossier_de_sortie> [<dossier_des_jeux>]

Toutes les requêtes vers https://pikifou.github.io/ sont servies depuis le disque :
  /ludiworld/...  -> docs/ de ce dépôt
  /<jeu>/...      -> <dossier_des_jeux>/<jeu>/docs/ (clones des dépôts des jeux), sinon une page vide
  /<depot>/<jeu>/ -> <dossier_des_jeux>/<depot>/<jeu>/ (dépôt qui regroupe plusieurs jeux, comme ludigames)
Un faux jeu /jeu-kit/ utilise ludi.js pour vérifier le dialogue appli <-> kit (scores, fin douce).
"""
import datetime
import json
import mimetypes
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "captures")
GAMES = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://pikifou.github.io"
PIN = "2580"

FAKE_GAME = """<!doctype html><meta charset=utf-8><title>Jeu kit</title>
<body style="background:#334;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh;margin:0">
<div><button id=b style="font-size:24px;padding:12px 24px">Marquer 42</button>
<button id=fin style="font-size:24px;padding:12px 24px">Fin de manche</button><p id=msg></p></div>
<script src="/ludiworld/kit/ludi.js"></script>
<script>Ludi.init({game:'jeu-kit'});
document.getElementById('b').onclick=function(){Ludi.score('points',42);Ludi.progress('niveau',3);Ludi.skill('maths.multiplication','7x8',true);this.textContent='OK'};
document.getElementById('fin').onclick=function(){Ludi.checkpoint('manche')};
Ludi.onWrapUp(function(m){document.getElementById('msg').textContent='wrapup '+m});
Ludi.onPause(function(r){document.getElementById('msg').textContent='pause '+r});</script>"""

FAKE_CARD = {
    "ludi": 1, "id": "jeu-kit", "status": "draft",
    "title": {"fr": "Jeu kit", "en": "Kit game"}, "pitch": {"fr": "Test.", "en": "Test."},
    "url": BASE + "/jeu-kit/", "icon": BASE + "/ludiworld/icons/icon-512.png", "color": "#334455",
    "author": {"name": "Test"}, "languages": ["fr"], "age": {"min": 6, "max": 9}, "reading": "none",
    "learning": {"level": "core", "domains": ["maths.multiplication"]},
    "session": {"minutes": [1, 2], "natural_end": True},
    "content": {"fr": "Test.", "en": "Test."}, "devices": ["phone"], "offline": True,
    "healthy": {k: True for k in ["no_ads", "no_purchases", "no_subscription", "no_loot_boxes", "no_daily_pressure",
                                  "no_notifications", "no_strangers", "no_tracking", "natural_stops"]},
    "third_parties": [], "kit": True,
}


def serve(route):
    url = route.request.url
    path = url[len(BASE):].split("?")[0]
    if path.startswith("/jeu-kit/"):
        return route.fulfill(body=FAKE_GAME, content_type="text/html")
    if path == "/ludiworld/jeux/index.json":
        idx = json.loads((ROOT / "docs/jeux/index.json").read_text(encoding="utf-8"))
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
    elif GAMES and (GAMES / parts[0]).is_dir() and not (GAMES / parts[0] / "index.html").is_file():
        base = GAMES / parts[0]
    else:
        return route.fulfill(body=f"<h1 style='font:40px sans-serif'>{parts[0]}</h1>", content_type="text/html")
    f = base / (rest or "index.html")
    if f.is_dir():
        f = f / "index.html"
    if not f.exists():
        return route.fulfill(status=404, body="")
    return route.fulfill(body=f.read_bytes(), content_type=mimetypes.guess_type(str(f))[0] or "application/octet-stream")


def famille(fin="douce", max_kit=None):
    """Une famille déjà préparée (code 2580), pour aller droit au but."""
    h = 2166136261
    for c in "ludiworld:" + PIN:
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    return {"games": {}, "famille": {
        "v": 1, "cree": 0, "pin": format(h, "x"), "enfant": {"nom": "Petit Loup", "age": 8},
        "jeux": {"pluie-de-cochons": {"max": None}, "jeu-kit": {"max": max_kit}},
        "regles": {"ecole": 30, "libre": 30, "joursLibres": [0, 3, 6], "fin": fin, "grace": 10, "bonus": None, "fini": None}}}


def contexte(browser, store=None, **opts):
    ctx = browser.new_context(service_workers="block", locale="fr-FR", **opts)
    ctx.route(BASE + "/**", serve)
    if store is not None:
        ctx.add_init_script("if (!sessionStorage.getItem('seed')) { localStorage.setItem('ludiworld.v1', %s); sessionStorage.setItem('seed', '1'); }" % json.dumps(json.dumps(store)))
    return ctx


def code(page, pin):
    for k in pin:
        page.locator("#gate .pin-keys button", has_text=k).first.click()
    page.wait_for_timeout(250)


def run():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        formats = {
            "telephone": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
            "tablette": dict(viewport={"width": 1180, "height": 820}),
        }

        # 0. Le site : rien de préparé, l'adresse de Ludiworld mène à l'accueil ; chaque page s'affiche
        for name, opts in formats.items():
            ctx = contexte(browser, **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + "/ludiworld/")
            page.wait_for_url("**/decouvrir/")
            page.wait_for_selector("#jeux-list .jeu")
            page.wait_for_selector("#aime-apercu dt")
            assert page.get_attribute(".lw-onglet[aria-current=page]", "class").endswith("lw-accueil"), "pas encore préparé : premier onglet « Accueil »"
            assert page.get_attribute(".lw-action", "href").endswith("#demarrer")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / f"{name}-0-site-accueil.png"))
            for onglet, cle, attendu in [("Les jeux", "jeux", "#fiches-jeux .fiche"), ("Créer un jeu", "creer", ".etape"), ("Ludiworld aime bien", "aime", "#ab-valides .reco")]:
                page.locator(".lw-onglet", has_text=onglet).click()
                page.wait_for_selector(attendu)
                assert page.get_attribute(".lw-onglet[aria-current=page]", "class").endswith("lw-" + cle)
                page.wait_for_timeout(1200)
                page.screenshot(path=str(OUT / f"{name}-0-site-{cle}.png"), full_page=True)
            page.locator("[data-filtre=appli]").click()
            assert page.locator("#ab-valides .reco").count() == page.locator("#ab-valides .reco-appli").count() >= 1, "le filtre ne garde que les applis"
            page.locator(".lw-langs button", has_text="EN").click()
            assert page.inner_text("h1").startswith("Learning can be fun"), page.inner_text("h1")
            page.locator(".lw-langs button", has_text="FR").click()
            page.locator(".lw-action").click()
            page.wait_for_selector(".a-bienvenue")
            ctx.close()

        # 1. Première ouverture : le parent prépare Ludiworld
        for name, opts in formats.items():
            ctx = contexte(browser, **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + "/ludiworld/#demarrer")
            page.wait_for_selector(".a-bienvenue")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / f"{name}-1-bienvenue.png"))
            page.click(".a-texte .btn-sun")
            page.fill("#a-nom", "Petit Loup")
            page.get_by_role("radio", name="8").click()
            page.click(".a-nav .btn-sun")
            page.wait_for_selector(".a-jeu")
            page.screenshot(path=str(OUT / f"{name}-2-jeux.png"))
            page.click(".a-nav .btn-sun")
            page.screenshot(path=str(OUT / f"{name}-3-temps.png"))
            page.click(".a-nav .btn-sun")
            for _ in range(2):
                for k in PIN:
                    page.locator(".pin-keys button", has_text=k).first.click()
                page.wait_for_timeout(250)
            page.click(".a-fin .btn-sun")
            page.wait_for_selector(".tuile")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / f"{name}-4-enfant.png"))
            fam = page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille")
            enfant = fam["enfants"][0]
            assert enfant["enfant"] == {"nom": "Petit Loup", "age": 8}, fam
            assert PIN not in json.dumps(fam), "le code ne doit pas être gardé en clair"
            assert page.locator(".tuile").count() == len(enfant["jeux"]), "l'enfant ne voit que les jeux choisis"
            ctx.close()

        # 2. Carnet parent : mauvais code refusé, bon code accepté ; fiche d'un jeu ; retour Android
        ctx = contexte(browser, famille(), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector(".tuile")
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        page.wait_for_selector("#gate[open]")
        code(page, "1111")
        assert page.locator("#gate[open]").count() == 1, "un mauvais code ne doit pas ouvrir le carnet"
        code(page, PIN)
        page.wait_for_selector(".carnet:not([hidden])")
        page.screenshot(path=str(OUT / "tablette-5-carnet.png"))
        page.get_by_role("tab", name="Jeux").click()
        page.screenshot(path=str(OUT / "tablette-6-carnet-jeux.png"))
        page.fill(".recherche", "aimant")
        assert page.locator(".fiche-jeu").count() == 1, "la recherche filtre les jeux"
        page.fill(".recherche", "")
        page.locator(".fiche-jeu", has_text="Pluie de Cochons").locator(".lien").click()
        page.wait_for_selector("#sheet[open]")
        page.screenshot(path=str(OUT / "tablette-7-fiche.png"))
        page.click("#sheet .play")
        page.wait_for_timeout(2000)
        page.evaluate("history.back()")  # bouton retour : ferme le jeu, rouvre la fiche
        page.wait_for_timeout(300)
        assert page.locator("#player").is_hidden(), "le retour doit fermer le jeu"
        assert page.locator("#sheet[open]").count() == 1, "la fiche reste ouverte"
        page.evaluate("history.back()")
        page.wait_for_timeout(300)
        assert page.locator("#sheet[open]").count() == 0, "le 2e retour ferme la fiche"
        page.get_by_role("tab", name="Temps").click()
        page.screenshot(path=str(OUT / "tablette-8-carnet-temps.png"))
        # Le carnet est un onglet du site : on va lire une autre page et on revient sans redonner le code
        assert page.get_attribute(".lw-onglet[aria-current=page]", "class").endswith("lw-moi")
        page.locator(".lw-onglet", has_text="Ludiworld aime bien").click()
        page.wait_for_selector("#ab-valides .reco")
        assert page.locator(".lw-action", has_text="Côté enfant").count() == 1
        page.locator(".lw-onglet", has_text="Mon Ludiworld").click()
        page.wait_for_selector(".carnet:not([hidden])")
        assert page.locator("#gate[open]").count() == 0, "le code n'est pas redemandé tout de suite"
        # « Côté enfant » depuis le site : retour aux jeux, et le carnet redemande le code
        page.locator(".lw-onglet", has_text="Les jeux").click()
        page.wait_for_selector("#fiches-jeux .fiche")
        page.locator(".lw-action").click()
        page.wait_for_selector(".tuile")
        page.goto(BASE + "/ludiworld/#carnet")
        page.wait_for_selector("#gate[open]")
        ctx.close()

        # 2 bis. Sur un téléphone préparé : le carnet et la barre du site tiennent dans l'écran
        ctx = contexte(browser, famille(), **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector(".tuile")
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        code(page, PIN)
        page.wait_for_selector(".carnet:not([hidden])")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "telephone-7-carnet.png"))
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "rien ne dépasse en largeur"
        assert page.evaluate("document.getElementById('c-page').getBoundingClientRect().right <= window.innerWidth + 1"), "la page du carnet tient dans l'écran"
        assert page.locator(".lw-langs").is_visible() and page.locator(".c-exit").is_visible(), "langue et retour côté enfant visibles"
        ctx.close()

        # 3. Fin douce : on prévient, on attend la fin de manche, puis la nuit tombe
        ctx = contexte(browser, famille("douce"), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.locator(".tuile", has_text="Jeu kit").click()
        game = page.frame_locator("#player iframe")
        assert "fullscreen" not in (page.get_attribute("#player iframe", "allow") or ""), "le plein écran se décide dans Ludiworld, pas dans le jeu"
        game.locator("#b").click()
        page.wait_for_timeout(300)
        st = page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['jeu-kit']")
        assert st["kit"] is True and st["scores"]["points"]["value"] == 42 and st["progress"]["niveau"] == 3, st
        assert st["skills"]["maths.multiplication/7x8"]["ok"] == 1, st
        page.evaluate("ludiDemo.ajouter('jeu-kit', 26)")
        page.wait_for_timeout(1500)
        assert page.locator("#p-bandeau").is_visible(), "5 min avant : la marmotte prévient"
        assert "wrapup" in game.locator("#msg").inner_text(), "le jeu est prévenu (ludi:wrapup)"
        page.screenshot(path=str(OUT / "tablette-9-bientot.png"))
        page.evaluate("ludiDemo.ajouter('jeu-kit', 5)")
        page.wait_for_timeout(1500)
        assert page.locator("#p-rideau").is_hidden(), "fin douce : on n'interrompt pas la manche"
        assert "derniere" in page.get_attribute("#p-reste", "class"), "pastille « dernière partie »"
        game.locator("#fin").click()
        page.wait_for_timeout(1500)
        assert page.locator("#p-rideau").is_visible(), "fin de manche : on s'arrête"
        assert "pause" in game.locator("#msg").inner_text(), "le jeu reçoit ludi:pause"
        page.screenshot(path=str(OUT / "tablette-10-rideau.png"))
        page.click("#p-rideau .btn-sun")
        page.wait_for_timeout(2500)
        assert page.get_attribute("#v-enfant", "data-moment") == "nuit", "la nuit est tombée"
        assert page.locator(".tuile").count() == 0
        page.screenshot(path=str(OUT / "tablette-11-nuit.png"))
        ctx.close()

        # 4. Fin nette : on s'arrête à la minute, sans attendre la manche
        ctx = contexte(browser, famille("nette"), **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.locator(".tuile", has_text="Jeu kit").click()
        page.wait_for_timeout(800)
        page.evaluate("ludiDemo.ajouter('jeu-kit', 31)")
        page.wait_for_timeout(1500)
        assert page.locator("#p-rideau").is_visible(), "fin nette : arrêt immédiat"
        page.screenshot(path=str(OUT / "telephone-5-fin-nette.png"))
        ctx.close()

        # 5. Limite par jeu : ce jeu-là s'endort, les autres restent ouverts
        ctx = contexte(browser, famille("nette", max_kit=10), **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector(".tuile")
        page.evaluate("ludiDemo.ajouter('jeu-kit', 10)")
        page.wait_for_timeout(500)
        assert page.locator(".tuile", has_text="Jeu kit").is_disabled(), "limite du jeu atteinte"
        assert page.locator(".tuile", has_text="Pluie de Cochons").is_enabled(), "les autres jeux restent ouverts"
        page.wait_for_timeout(2000)
        page.screenshot(path=str(OUT / "telephone-6-limite-jeu.png"))
        ctx.close()

        # 6. Heures de jeu : avant l'heure l'île dort ; 3 min avant la fin de la plage, la marmotte prévient
        maintenant = datetime.datetime.now()
        if maintenant.hour < 22:
            store = famille()
            store["famille"]["regles"]["heures"] = {"debut": (maintenant + datetime.timedelta(hours=1)).strftime("%H:%M"), "fin": "23:59"}
            ctx = contexte(browser, store, **formats["tablette"])
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + "/ludiworld/")
            page.wait_for_selector("#e-dodo:not([hidden])")
            assert page.get_attribute("#v-enfant", "data-moment") == "nuit", "avant l'heure, l'île dort"
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / "tablette-12-avant-l-heure.png"))
            ctx.close()
            store = famille()
            store["famille"]["regles"]["heures"] = {"debut": "00:00", "fin": (maintenant + datetime.timedelta(minutes=3)).strftime("%H:%M")}
            ctx = contexte(browser, store, **formats["tablette"])
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + "/ludiworld/")
            page.locator(".tuile", has_text="Jeu kit").click()
            page.wait_for_timeout(1500)
            assert page.locator("#p-bandeau").is_visible(), "bientôt l'heure : la marmotte prévient"
            ctx.close()
        else:
            print("heures de jeu : test sauté après 22 h")

        # 7. Fin douce juste avant la fin : la journée est finie pour de bon (pas de « fini » puis une nouvelle partie)
        ctx = contexte(browser, famille("douce"), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.locator(".tuile", has_text="Jeu kit").click()
        page.frame_locator("#player iframe").locator("#fin").wait_for()
        page.evaluate("ludiDemo.ajouter('jeu-kit', 28)")
        page.wait_for_timeout(1200)
        page.frame_locator("#player iframe").locator("#fin").click()
        page.wait_for_timeout(1200)
        assert page.locator("#p-rideau").is_visible(), "fin de manche à 2 min de la fin : on s'arrête"
        page.click("#p-rideau .btn-sun")
        page.wait_for_timeout(800)
        assert page.get_attribute("#v-enfant", "data-moment") == "nuit", "les 2 minutes restantes ne servent plus"
        ctx.close()

        # 8. Code parent : 3 erreurs, pause ; « code oublié » : attente et jeux fermés (un enfant n'y gagne rien)
        ctx = contexte(browser, famille(), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector(".tuile")
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        for _ in range(3):
            code(page, "1111")
        assert "bloque" in page.get_attribute("#gate .pin", "class"), "3 erreurs : le pavé se bloque"
        page.click("#gate .lien")  # Code oublié ?
        page.click("#gate .btn-sun")
        page.wait_for_timeout(500)
        assert page.locator(".tuile").count() == 0, "pendant l'attente du nouveau code, on ne joue pas"
        page.screenshot(path=str(OUT / "tablette-13-attente-code.png"))
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        code(page, PIN)  # l'ancien code retrouvé annule la demande
        page.wait_for_selector(".carnet:not([hidden])")
        assert page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.reset") is None
        ctx.close()

        # 9. Deux enfants : chacun son temps ; changer d'enfant demande le code
        ctx = contexte(browser, famille(), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector(".tuile")
        page.evaluate("ludiDemo.ajouter('jeu-kit', 20)")  # Petit Loup a déjà joué 20 min
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        code(page, PIN)
        page.get_by_role("tab", name="Réglages").click()
        page.click("text=Ajouter un enfant")
        page.fill("#s-nom", "Lou")
        page.keyboard.press("Tab")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "tablette-14-deux-enfants.png"))
        page.get_by_role("button", name="Côté enfant").click()
        assert page.inner_text("#e-salut").startswith("Salut Lou"), page.inner_text("#e-salut")
        assert "30" in page.inner_text("#e-temps"), "Lou a tout son temps : " + page.inner_text("#e-temps")
        page.click("#e-qui")
        page.wait_for_selector("#gate[open]")
        code(page, PIN)
        page.wait_for_selector("#qui[open]")
        page.screenshot(path=str(OUT / "tablette-15-qui-joue.png"))
        page.locator(".qui-enfant", has_text="Petit Loup").click()
        page.wait_for_timeout(300)
        assert page.inner_text("#e-salut").startswith("Salut Petit Loup")
        assert "10" in page.inner_text("#e-temps"), "Petit Loup garde son propre temps : " + page.inner_text("#e-temps")
        ctx.close()

        # 10. Un jeu d'un dépôt qui en regroupe plusieurs (ludigames) : le Monde à la craie, une manche jusqu'au bout
        if GAMES and (GAMES / "ludigames/monde-a-la-craie/index.html").is_file():
            store = famille()
            store["famille"]["jeux"]["monde-a-la-craie"] = {"max": None}
            ctx = contexte(browser, store, **formats["tablette"])
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + "/ludiworld/")
            page.locator(".tuile", has_text="Le Monde à la craie").click()
            page.wait_for_function("document.querySelector('#player iframe')?.contentWindow?.jeu?.pret", timeout=15000)
            cadre = next(fr for fr in page.frames if "/ludigames/monde-a-la-craie/" in fr.url)
            assert cadre.evaluate("Ludi.inLauncher()"), "le kit sait qu'il est dans Ludiworld"
            cadre.wait_for_function("jeu.app.joueur === 'Petit Loup'", timeout=3000)
            page.screenshot(path=str(OUT / "tablette-16-monde-a-la-craie.png"))
            cadre.click('[data-zone="europe"]')
            cadre.click('[data-action="jouer"]')
            cadre.wait_for_function("jeu.carte && jeu.carte.zone.id === 'europe'")
            boite = page.locator("#player iframe").bounding_box()
            derniere = None
            while not cadre.evaluate("jeu.manche.finie"):
                q = cadre.evaluate("jeu.manche.question")
                if q != derniere:
                    cadre.evaluate("jeu.carte.vueEntiere()")
                    derniere = q
                x, y = cadre.evaluate("c => jeu.carte.ancreEcran(c)", q)
                page.mouse.click(boite["x"] + x, boite["y"] + y)
                page.wait_for_timeout(60)
            cadre.wait_for_selector(".fin", timeout=3000)
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / "tablette-17-monde-a-la-craie-fin.png"))
            st = page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['monde-a-la-craie']")
            notions = [k for k in st["skills"] if k.startswith("geographie.pays/")]
            assert st["kit"] is True and len(notions) == 12, st
            ctx.close()
        browser.close()
    if errors:
        raise SystemExit("Erreurs JS : " + " | ".join(errors))
    print("OK : captures dans", OUT)


if __name__ == "__main__":
    run()
