"""Captures et test de bout en bout de l'appli, sans réseau.

Usage : python3 tests/captures.py <dossier_de_sortie> [<dossier_des_jeux>]

Toutes les requêtes vers https://pikifou.github.io/ sont servies depuis le disque :
  /ludiworld/...  -> docs/ de ce dépôt
  /<jeu>/...      -> <dossier_des_jeux>/<jeu>/docs/ (clones des dépôts des jeux), sinon une page vide
  /<depot>/<jeu>/ -> <dossier_des_jeux>/<depot>/<jeu>/ (dépôt qui regroupe plusieurs jeux, comme ludigames)
Un faux jeu /jeu-kit/ utilise ludi.js pour vérifier le dialogue appli <-> kit (scores, fin douce).
"""
import base64
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
    "url": BASE + "/jeu-kit/", "icon": BASE + "/ludiworld/icons/marmotte-512.png", "color": "#334455",
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


class FauxSupabase:
    """Un faux Supabase pour les parcours dans le navigateur : l'authentification et les fonctions de la base, en mémoire.
    Les vraies règles d'accès sont vérifiées à part, sur un vrai Postgres : supabase/verifier.mjs."""
    URL = "https://faux.supabase.test"

    def __init__(self):
        self.comptes = {}    # email -> {id, mdp, confirme, synchro, nouvelles, data}
        self.envies = {}
        self.foyer = None
        self.version = 0
        self.appels = []

    def jeton(self, email):
        charge = base64.urlsafe_b64encode(json.dumps({"sub": self.comptes[email]["id"], "email": email}).encode()).decode().rstrip("=")
        return "x." + charge + ".y"

    def session(self, email):
        return {"access_token": self.jeton(email), "refresh_token": "r", "expires_in": 3600, "user": {"id": self.comptes[email]["id"], "email": email}}

    def qui(self, route):
        auth = route.request.headers.get("authorization", "")
        if not auth.startswith("Bearer x."):
            return None
        charge = auth.split(".")[1]
        return json.loads(base64.urlsafe_b64decode(charge + "=" * (-len(charge) % 4)))["email"]

    def repond(self, route, corps=None, status=200):
        route.fulfill(status=status, body="" if corps is None else json.dumps(corps), content_type="application/json",
                      headers={"access-control-allow-origin": "*"})

    def route(self, route):
        req = route.request
        if req.method == "OPTIONS":
            return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        chemin = req.url[len(self.URL):]
        corps = json.loads(req.post_data) if req.post_data else {}
        self.appels.append(chemin)
        email = self.qui(route)
        if chemin.startswith("/auth/v1/signup"):
            self.comptes[corps["email"]] = {"id": "u-" + str(len(self.comptes)), "mdp": corps["password"], "confirme": False, "synchro": False,
                                            "nouvelles": corps["data"].get("nouvelles") == "true", "data": corps["data"]}
            ei = corps["data"].get("envie_id")
            if ei in self.envies:
                self.envies[ei]["compte"] = corps["email"]
            return self.repond(route, {"id": "u", "email": corps["email"]})
        if chemin.startswith("/auth/v1/token?grant_type=password"):
            c = self.comptes.get(corps["email"])
            if not c or c["mdp"] != corps["password"]:
                return self.repond(route, {"error_code": "invalid_credentials", "msg": "x"}, 400)
            if not c["confirme"]:
                return self.repond(route, {"error_code": "email_not_confirmed", "msg": "x"}, 400)
            return self.repond(route, self.session(corps["email"]))
        if chemin.startswith("/auth/v1/logout"):
            return self.repond(route, None, 204)
        if chemin.startswith("/auth/v1/"):
            return self.repond(route, {})
        if chemin.startswith("/rest/v1/comptes"):
            c = self.comptes[email]
            if req.method == "PATCH":
                c.update(corps)
                return self.repond(route, None, 204)
            return self.repond(route, [{"id": c["id"], "synchro": c["synchro"], "nouvelles": c["nouvelles"], "langue": "fr"}])
        if chemin.startswith("/rest/v1/foyers"):
            return self.repond(route, [{"etat": self.foyer, "version": self.version}] if self.foyer else [])
        if chemin.startswith("/rest/v1/envies"):
            return self.repond(route, [])
        fn = chemin.replace("/rest/v1/rpc/", "")
        if fn == "enregistrer_envie":
            self.envies[corps["p_id"]] = dict(corps, compte=None)
            return self.repond(route, None, 204)
        if fn == "rattacher_envie":
            return self.repond(route, None, 204)
        if not email:
            return self.repond(route, {"message": "jwt"}, 401)
        if fn == "mes_droits":
            return self.repond(route, {"formule": "gratuit", "nom": {"fr": "Gratuit", "en": "Free"}, "droits": {"synchro": True}})
        if fn == "est_admin":
            return self.repond(route, email == "patron@exemple.test")
        if fn == "poser_synchro":
            self.comptes[email]["synchro"] = corps["p_active"]
            if not corps["p_active"]:
                self.foyer, self.version = None, 0
            return self.repond(route, None, 204)
        if fn == "pousser_foyer":
            if corps["p_version"] != self.version:
                return self.repond(route, None)
            self.foyer, self.version = corps["p_etat"], self.version + 1
            return self.repond(route, self.version)
        if fn == "effacer_mon_compte":
            del self.comptes[email]
            self.foyer, self.version = None, 0
            return self.repond(route, None, 204)
        if fn.startswith("bureau_"):
            if email != "patron@exemple.test":
                return self.repond(route, {"message": "reserve au bureau"}, 403)
            if fn == "bureau_apercu":
                return self.repond(route, {
                    "parcours": {"commences": 48, "termines": 31, "rattaches": 19, "comptes": 22, "confirmes": 18, "actifs_7j": 9, "synchro": 6, "nouvelles": 11},
                    "reponses": {"envie": {"jouer": 34, "aider": 12, "creer": 7, "curieux": 5}, "profils": {"parent": 37, "enseignant": 6, "createur": 3},
                                 "ages": {"6-8": 21, "9-10": 15, "moins6": 8, "11plus": 4}, "priorites": {"sain": 25, "apprendre": 22, "temps": 19, "plaisir": 8, "ensemble": 6},
                                 "experience": {"jamais": 9, "un-peu": 7, "souvent": 3}},
                    "semaines": [{"semaine": "2026-%02d-%02d" % (8 + i // 4, 3 + (i % 4) * 7), "envies": max(0, i * 2 - 3), "comptes": max(0, i - 3)} for i in range(12)],
                    "formules": [{"id": "gratuit", "nom": {"fr": "Gratuit", "en": "Free"}, "droits": {"synchro": True}, "ouverte": True, "comptes": 22}]})
            if fn == "bureau_envies":
                return self.repond(route, [
                    {"id": "1", "cree_le": "2026-11-03T10:00:00Z", "langue": "fr", "envie": ["aider", "jouer"], "profils": ["parent", "enseignant"], "ages": ["6-8"], "priorites": ["sain"], "experience": "un-peu",
                     "message": "<img src=x onerror=\"window.XSS=1\">Un jeu sur les volcans", "termine": True, "email": "a@exemple.test", "nouvelles": True},
                    {"id": "2", "cree_le": "2026-11-02T10:00:00Z", "langue": "en", "envie": ["creer"], "profils": ["createur"], "ages": [], "priorites": [], "experience": "souvent",
                     "message": None, "termine": False, "email": None, "nouvelles": None}])
            if fn == "bureau_comptes":
                return self.repond(route, [
                    {"id": "1", "email": "a@exemple.test", "cree_le": "2026-11-03T10:00:00Z", "confirme_le": "2026-11-03T10:05:00Z", "derniere_connexion": "2026-11-04T08:00:00Z",
                     "formule": "gratuit", "statut": "actif", "synchro": True, "nouvelles": True, "envie": ["aider", "jouer"], "profils": ["parent", "enseignant"]},
                    {"id": "2", "email": "b@exemple.test", "cree_le": "2026-11-01T10:00:00Z", "confirme_le": None, "derniere_connexion": None,
                     "formule": "gratuit", "statut": "actif", "synchro": False, "nouvelles": False, "envie": None, "profils": None}])
        return self.repond(route, {"message": "inconnu : " + chemin}, 404)


def contexte(browser, store=None, nuage=None, **opts):
    ctx = browser.new_context(service_workers="block", locale="fr-FR", **opts)
    ctx.route(BASE + "/**", serve)
    # Sans faux Supabase, pas de compte : ce sont les parcours de toujours, quelle que soit la configuration du site.
    ctx.add_init_script("window.LUDI_NUAGE = %s;" % json.dumps({"url": nuage.URL, "cle": "cle-publique"} if nuage else {"url": "", "cle": ""}))
    if nuage:
        ctx.route(nuage.URL + "/**", nuage.route)
    ctx.route("https://api.github.com/**", lambda r: r.fulfill(body=json.dumps([{"title": "[Jeu] Le Pont des Maths", "html_url": "https://github.com/x/1", "created_at": "2026-11-02T10:00:00Z", "labels": [{"name": "jeu"}]}]), content_type="application/json", headers={"access-control-allow-origin": "*"}))
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
                page.mouse.click(boite["x"] + x, boite["y"] + y)   # une note « Le savais-tu ? » ouverte se passe au toucher suivant
                page.wait_for_timeout(60)
            page.wait_for_timeout(900)   # la note du dernier pays
            if cadre.locator(".savoir:not([hidden])").count():
                cadre.click(".savoir")
            cadre.wait_for_selector(".fin", timeout=3000)
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / "tablette-17-monde-a-la-craie-fin.png"))
            st = page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['monde-a-la-craie']")
            notions = [k for k in st["skills"] if k.startswith("geographie.pays/")]
            assert st["kit"] is True and len(notions) == 12, st
            ctx.close()

        # 11. Sans projet Supabase configuré : aucune trace de compte, la page du compte l'explique
        ctx = contexte(browser, **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/decouvrir/")
        page.wait_for_selector(".lw-action")
        assert page.locator(".lw-compte").count() == 0, "pas de lien de compte sans projet"
        assert page.get_attribute(".lw-action", "href").endswith("#demarrer")
        page.goto(BASE + "/ludiworld/compte/")
        page.wait_for_selector("[data-vue=ferme]:not([hidden])")
        page.goto(BASE + "/ludiworld/bureau/")
        page.wait_for_function("document.getElementById('b-garde-p').textContent.includes('attend')")
        ctx.close()

        # 12. Comme Calm : « Essayer » pose quelques questions, puis on crée son compte ; « Se connecter » à côté
        nuage = FauxSupabase()
        for name, opts in formats.items():
            ctx = contexte(browser, nuage=nuage, **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + "/ludiworld/decouvrir/")
            page.wait_for_selector(".lw-compte")
            assert page.inner_text(".lw-compte") == "Se connecter"
            assert page.inner_text(".lw-action").strip() == "Essayer", "pas de « gratuitement » : ça laisserait croire que c'est payant ensuite"
            assert page.get_attribute(".hero-copy .btn-sun", "href").endswith("compte/#essayer")
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / f"{name}-20-barre-comme-calm.png"))
            boite = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            assert boite[0] <= boite[1], ("la barre déborde", name, boite)
            page.locator(".lw-action").click()
            page.wait_for_selector("#q-go")
            page.wait_for_timeout(1300)
            page.screenshot(path=str(OUT / f"{name}-21-essayer.png"))
            assert not nuage.envies or name == "tablette", "rien n'est envoyé avant la première réponse"
            page.click("#q-go")
            page.wait_for_selector(".q[data-q=envie]:not([hidden])")
            assert page.inner_text("#q-suite") == "Passer", "toujours possible de passer"
            assert page.inner_text("#q-rang").endswith("sur 5"), "sans envie d'aider, pas de question sur l'IA"
            page.click(".q[data-q=envie] .opt[data-val=aider]")
            page.click(".q[data-q=envie] .opt[data-val=jouer]")
            assert page.inner_text("#q-suite") == "Suivant"
            page.wait_for_timeout(200)
            page.screenshot(path=str(OUT / f"{name}-22-question.png"))
            page.click("#q-suite")
            for v in ["parent", "enseignant", "createur"]:
                page.click(f".q[data-q=profils] .opt[data-val={v}]")
            page.click(".q[data-q=profils] .opt[data-val=createur]")
            assert page.locator(".q[data-q=profils] .opt[aria-pressed=true]").count() == 2, "on coche plusieurs profils, et on peut décocher"
            page.click("#q-suite")
            page.click(".q[data-q=ages] .opt[data-val='6-8']")
            page.click("#q-suite")
            for v in ["sain", "temps", "apprendre", "plaisir", "ensemble"]:
                page.click(f".q[data-q=priorites] .opt[data-val={v}]")
            assert page.locator(".q[data-q=priorites] .opt[aria-pressed=true]").count() == 5, "pas de limite"
            page.wait_for_timeout(1200)
            page.screenshot(path=str(OUT / f"{name}-23-le-jour-se-leve.png"))
            page.click("#q-suite")
            assert page.locator(".q[data-q=experience]:not([hidden])").count() == 1, "qui veut aider voit la question sur l'IA"
            page.click(".q[data-q=experience] .opt[data-val=jamais]")
            page.click("#q-suite")
            page.fill("#q-message", "Un jeu sur les volcans")
            assert page.inner_text("#q-suite") == "Créer mon compte"
            page.click("#q-suite")
            page.wait_for_selector("#f-creer")
            page.wait_for_timeout(100)
            rep = [r for r in nuage.envies.values() if r["p_termine"]][-1]
            assert rep["p_envie"] == ["aider", "jouer"] and rep["p_profils"] == ["parent", "enseignant"] and rep["p_message"] == "Un jeu sur les volcans" and len(rep["p_priorites"]) == 5, rep
            page.screenshot(path=str(OUT / f"{name}-24-creer.png"))

            # Le formulaire refuse ce qui ne va pas, et ne coche rien à la place du parent
            page.fill("#c-email", "pas-une-adresse")
            page.click("#f-creer button[type=submit]")
            assert "valide" in page.inner_text("#f-creer .alerte")
            page.fill("#c-email", f"parent-{name}@exemple.test")
            page.fill("#c-mdp", "court")
            page.click("#f-creer button[type=submit]")
            assert "8 caractères" in page.inner_text("#f-creer .alerte")
            page.fill("#c-mdp", "un-bon-mot-de-passe")
            page.click("#f-creer button[type=submit]")
            assert "adulte" in page.inner_text("#f-creer .alerte")
            assert not page.is_checked("#c-nouvelles"), "les messages ne sont pas cochés d'avance"
            page.check("#c-adulte")
            page.click("#f-creer button[type=submit]")
            page.wait_for_selector("[data-vue=verifier]:not([hidden])")
            assert page.inner_text("#v-email") == f"parent-{name}@exemple.test"
            assert page.get_attribute("[data-vue=verifier] .btn-sun", "href") == "../#demarrer", "on peut préparer la tablette sans attendre"
            page.screenshot(path=str(OUT / f"{name}-25-verifier.png"))
            compte = nuage.comptes[f"parent-{name}@exemple.test"]
            assert compte["data"]["envie_id"] == rep["p_id"], "les réponses suivent le compte"
            assert compte["nouvelles"] is False

            # Se connecter avant d'avoir confirmé : on le dit, et on propose de renvoyer le message
            page.goto(BASE + "/ludiworld/compte/#connexion")
            page.wait_for_selector("#f-connexion")
            page.wait_for_timeout(1300)
            page.screenshot(path=str(OUT / f"{name}-26-connexion.png"))
            page.fill("#s-email", f"parent-{name}@exemple.test")
            page.fill("#s-mdp", "mauvais")
            page.click("#f-connexion button[type=submit]")
            page.wait_for_function("document.querySelector('#f-connexion .alerte').textContent.includes('incorrect')")
            page.fill("#s-mdp", "un-bon-mot-de-passe")
            page.click("#f-connexion button[type=submit]")
            page.wait_for_function("document.querySelector('#f-connexion .alerte').textContent.includes('confirmée')")
            assert page.is_visible("#s-renvoyer")

            # Le lien de l'e-mail : la session arrive, le jeton quitte l'adresse aussitôt
            compte["confirme"] = True
            page.goto(BASE + "/ludiworld/compte/#access_token=" + nuage.jeton(f"parent-{name}@exemple.test") + "&refresh_token=r&expires_in=3600&type=signup")
            page.wait_for_selector("#e-corps:not([hidden])")
            assert "access_token" not in page.url, page.url
            page.wait_for_selector("#e-bienvenue:not([hidden])")
            assert page.inner_text(".lw-compte") == "Mon compte"
            page.wait_for_function("document.getElementById('e-formule').textContent.includes('Gratuit')")
            assert page.is_hidden("#e-bureau-p"), "un parent ne voit pas le lien du bureau"
            assert not page.is_checked("#e-synchro"), "la copie en ligne est coupée par défaut"
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"{name}-27-espace.png"), full_page=True)
            page.locator(".lw-langs button", has_text="EN").click()
            assert page.inner_text("#e-corps h1") == "My account"
            assert "free" in page.inner_text("#e-formule").lower()
            page.locator(".lw-langs button", has_text="FR").click()
            ctx.close()

        # Un lien périmé le dit
        ctx = contexte(browser, nuage=nuage, **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/compte/#error=access_denied&error_code=otp_expired&error_description=x")
        page.wait_for_function("document.querySelector('#f-connexion .alerte').textContent.includes('expiré')")
        ctx.close()

        # Réseau lent : un envoi à la fois, sinon un envoi en retard écrase les réponses suivantes (vu sur le vrai serveur)
        nuage = FauxSupabase()
        ctx = contexte(browser, nuage=nuage)
        retenus = []
        ctx.route(nuage.URL + "/rest/v1/rpc/enregistrer_envie", lambda r: retenus.append(r))
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/compte/#essayer")
        page.click("#q-go")
        page.click(".q[data-q=envie] .opt[data-val=curieux]")
        page.click("#q-suite")
        page.click(".q[data-q=profils] .opt[data-val=autre]")
        page.click("#q-suite")
        page.wait_for_timeout(300)
        assert len(retenus) == 1, ("un seul envoi à la fois", len(retenus))
        nuage.route(retenus[0])
        page.wait_for_timeout(300)
        assert len(retenus) == 2 and retenus[1].request.post_data_json["p_profils"] == ["autre"], "l'envoi suivant part avec les réponses récentes"
        nuage.route(retenus[1])
        page.wait_for_timeout(100)
        assert list(nuage.envies.values())[0]["p_profils"] == ["autre"]
        ctx.close()

        # 13. Deux appareils : la tablette de l'enfant et le téléphone du parent
        nuage = FauxSupabase()
        nuage.comptes["parent@exemple.test"] = {"id": "u-1", "mdp": "un-bon-mot-de-passe", "confirme": True, "synchro": False, "nouvelles": False, "data": {}}
        # La tablette, déjà préparée : son compte ne s'ouvre pas sans le code parent
        tablette = contexte(browser, store=famille(), nuage=nuage, **formats["tablette"])
        page = tablette.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/compte/#connexion")
        page.wait_for_selector("#f-connexion")
        page.fill("#s-email", "parent@exemple.test")
        page.fill("#s-mdp", "un-bon-mot-de-passe")
        page.click("#f-connexion button[type=submit]")
        page.wait_for_selector("#e-code:not([hidden])")
        assert page.is_hidden("#e-corps"), "un enfant sur la tablette ne voit pas le compte"
        assert nuage.foyer is None, "rien ne part sans geste du parent"
        page.click("#e-code .btn-sun")
        page.wait_for_selector("#gate[open]")
        code(page, PIN)
        page.wait_for_selector("#v-parent:not([hidden])")
        page.goto(BASE + "/ludiworld/compte/#espace")
        page.wait_for_selector("#e-corps:not([hidden])")
        page.wait_for_function("document.getElementById('e-formule').textContent.includes('Gratuit')")
        page.check("#e-synchro")
        page.wait_for_function("!document.getElementById('e-synchro-etat').hidden")
        assert nuage.foyer["enfants"][0]["enfant"]["nom"] == "Petit Loup", nuage.foyer

        # Un lien piégé (le compte de quelqu'un d'autre, copie en ligne activée) : il ouvre ce compte, et ne fait rien partir
        nuage.comptes["pirate@exemple.test"] = {"id": "u-p", "mdp": "x", "confirme": True, "synchro": True, "nouvelles": False, "data": {}}
        version = nuage.version
        piege = contexte(browser, store=famille(), nuage=nuage, **formats["tablette"])
        pg = piege.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(BASE + "/ludiworld/#enfant")
        pg.wait_for_selector(".tuile")
        pg.goto(BASE + "/ludiworld/compte/#access_token=" + nuage.jeton("pirate@exemple.test") + "&refresh_token=r&expires_in=3600&type=signup")
        pg.wait_for_selector("#e-code:not([hidden])")
        assert pg.evaluate("localStorage.getItem('ludiworld.synchro')") is None, "un lien ne relie pas l'appareil"
        pg.goto(BASE + "/ludiworld/#enfant")
        pg.wait_for_selector(".tuile")
        pg.wait_for_timeout(1800)
        assert nuage.version == version, "rien ne part vers le compte du lien"
        # Sur cette tablette, un enfant ne change pas le mot de passe, même compte ouvert
        pg.goto(BASE + "/ludiworld/compte/#nouveau")
        pg.wait_for_selector("#e-code:not([hidden])")
        assert pg.is_hidden("#f-nouveau")
        piege.close()

        # Une autre famille sur sa propre tablette, avec ce compte : son foyer ne part pas sans qu'on coche
        autre = contexte(browser, store=famille(), nuage=nuage, **formats["tablette"])
        pg = autre.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(BASE + "/ludiworld/#enfant")
        pg.wait_for_selector(".tuile")
        pg.goto(BASE + "/ludiworld/compte/#connexion")
        pg.wait_for_selector("#f-connexion")
        pg.fill("#s-email", "parent@exemple.test")
        pg.fill("#s-mdp", "un-bon-mot-de-passe")
        pg.click("#f-connexion button[type=submit]")
        pg.wait_for_selector("#e-code:not([hidden])")
        assert nuage.version == version and pg.evaluate("localStorage.getItem('ludiworld.synchro')") is None
        autre.close()

        # Le téléphone, vide : se connecter suffit à tout retrouver, sans repasser par la préparation ni redonner le code au réseau
        telephone = contexte(browser, nuage=nuage, **formats["telephone"])
        tel = telephone.new_page()
        tel.on("pageerror", lambda e: errors.append(str(e)))
        tel.goto(BASE + "/ludiworld/compte/#connexion")
        tel.wait_for_selector("#f-connexion")
        tel.fill("#s-email", "parent@exemple.test")
        tel.fill("#s-mdp", "un-bon-mot-de-passe")
        tel.click("#f-connexion button[type=submit]")
        tel.wait_for_selector("#e-code:not([hidden])")
        fam = tel.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille")
        assert fam["enfants"][0]["enfant"]["nom"] == "Petit Loup", fam
        # Le parent règle depuis son téléphone
        tel.click("#e-code .btn-sun")
        tel.wait_for_selector("#gate[open]")
        code(tel, PIN)
        tel.wait_for_selector("#v-parent:not([hidden])")
        tel.locator("#c-nav button", has_text="Réglages").click()
        tel.fill("#s-nom", "Grand Loup")
        tel.locator("#s-nom").blur()
        tel.wait_for_function("document.querySelector('#toast') !== null")
        for _ in range(40):
            if nuage.foyer["enfants"][0]["enfant"]["nom"] == "Grand Loup":
                break
            tel.wait_for_timeout(100)
        assert nuage.foyer["enfants"][0]["enfant"]["nom"] == "Grand Loup", "le réglage part en ligne"
        # La tablette le voit en revenant sur l'appli
        page.goto(BASE + "/ludiworld/#enfant")
        page.wait_for_selector(".tuile")
        page.wait_for_function("document.getElementById('e-salut').textContent.includes('Grand Loup')")
        # Pendant une partie, rien ne part : on attend la fin
        avant = len(nuage.appels)
        page.evaluate("ludiDemo.ajouter('pluie-de-cochons', 2)")
        page.wait_for_timeout(200)
        assert len(nuage.appels) == avant, "le temps de jeu ne déclenche pas d'appel réseau à chaque seconde"

        # 14. Le bureau : fermé à un parent, ouvert à son adresse
        tel.goto(BASE + "/ludiworld/bureau/")
        tel.wait_for_function("document.getElementById('b-garde-p').textContent.includes('réservée')")
        assert tel.is_hidden("#bureau")
        assert not any(c.endswith("bureau_apercu") for c in nuage.appels), "aucune donnée demandée pour un parent"

        nuage.comptes["patron@exemple.test"] = {"id": "u-9", "mdp": "x", "confirme": True, "synchro": False, "nouvelles": False, "data": {}}
        for name, opts in formats.items():
            ctx = contexte(browser, nuage=nuage, **opts)
            b = ctx.new_page()
            b.on("pageerror", lambda e: errors.append(str(e)))
            b.goto(BASE + "/ludiworld/compte/#access_token=" + nuage.jeton("patron@exemple.test") + "&refresh_token=r&expires_in=3600&type=signup")
            b.wait_for_selector("#e-bureau-p:not([hidden])")
            b.click("#e-bureau-p a")
            b.wait_for_selector("#ap-parcours .b-barre")
            b.wait_for_selector("#ap-attente a")
            assert "Sont allés au bout" in b.inner_text("#ap-parcours")
            assert "Aider" in b.inner_text("#ap-envie")
            b.wait_for_timeout(300)
            b.screenshot(path=str(OUT / f"{name}-30-bureau-apercu.png"), full_page=True)
            b.locator("#b-nav a", has_text="Les envies").click()
            b.wait_for_selector("#en-table tbody tr")
            assert b.evaluate("window.XSS") is None and "<img" in b.inner_text("#en-table"), "le message d'un visiteur reste du texte"
            b.select_option("#en-filtre", "creer")
            assert b.locator("#en-table tbody tr").count() == 1
            b.select_option("#en-filtre", "")
            b.screenshot(path=str(OUT / f"{name}-31-bureau-envies.png"), full_page=True)
            with b.expect_download() as dl:
                b.click("#en-csv")
            assert dl.value.suggested_filename == "ludiworld-envies.csv"
            b.locator("#b-nav a", has_text="Les comptes").click()
            b.wait_for_selector("#co-table tbody tr")
            assert "a@exemple.test" in b.inner_text("#co-table")
            b.screenshot(path=str(OUT / f"{name}-32-bureau-comptes.png"), full_page=True)
            b.locator("#b-nav a", has_text="Le catalogue").click()
            b.wait_for_selector("#ca-jeux tbody tr")
            b.wait_for_selector("#ca-github li")
            assert "à relire" in b.inner_text("#ca-jeux")
            b.screenshot(path=str(OUT / f"{name}-33-bureau-catalogue.png"), full_page=True)
            b.locator("#b-nav a", has_text="Les formules").click()
            b.wait_for_selector("#fo-table tbody tr")
            assert "synchro" in b.inner_text("#fo-table")
            ctx.close()

        # 15. Tout effacer d'un geste : couper la copie, puis le compte
        tel.goto(BASE + "/ludiworld/compte/#espace")
        tel.wait_for_selector("#e-corps:not([hidden])")
        tel.wait_for_function("document.getElementById('e-formule').textContent.includes('Gratuit')")
        tel.locator(".e-effacer summary").click()
        tel.fill("#e-mot", "non")
        tel.click("#f-effacer button[type=submit]")
        tel.wait_for_function("document.getElementById('e-alerte').textContent.includes('EFFACER')")
        assert "parent@exemple.test" in nuage.comptes
        tel.fill("#e-mot", "EFFACER")
        tel.click("#f-effacer button[type=submit]")
        tel.wait_for_url("**/decouvrir/")
        assert "parent@exemple.test" not in nuage.comptes and nuage.foyer is None
        assert tel.evaluate("localStorage.getItem('ludiworld.session')") is None
        assert tel.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].enfant.nom") == "Grand Loup", "l'appareil garde ce qui est à lui"

        # « Tout effacer » sur une tablette : elle ne reste liée à personne
        page.goto(BASE + "/ludiworld/#carnet")
        page.wait_for_selector("#gate[open]")
        code(page, PIN)
        page.wait_for_selector("#v-parent:not([hidden])")
        page.locator("#c-nav button", has_text="Réglages").click()
        page.on("dialog", lambda d: d.accept())
        page.click(".btn-danger")
        page.wait_for_selector("#v-accueil:not([hidden])")
        assert page.evaluate("localStorage.getItem('ludiworld.session')") is None and page.evaluate("localStorage.getItem('ludiworld.synchro')") is None
        telephone.close()
        tablette.close()
        browser.close()
    if errors:
        raise SystemExit("Erreurs JS : " + " | ".join(errors))
    print("OK : captures dans", OUT)


if __name__ == "__main__":
    run()
