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
import decimal
import json
import mimetypes
import pathlib
import sys
import urllib.parse

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "captures")
GAMES = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
OUT.mkdir(parents=True, exist_ok=True)
BASE = "https://pikifou.github.io"
APP = BASE + "/ludiworld/app/"   # l'appli ; le site est à la racine (Julien, 2026-11-18)
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
    "after": {"fr": "Et si tu dessinais un cochon dans une grange ?", "en": "How about drawing a pig in a barn?"},
    # l'activité pas à pas (décision du 23 novembre) : deux étapes, avec les vrais schémas du catalogue
    "activity": {"title": {"fr": "Le chapeau", "en": "The hat"}, "need": {"fr": "Une grande feuille.", "en": "A big sheet."},
                 "steps": [{"img": "img/activites/chapeau-chevalier-1.svg", "text": {"fr": "Plie la feuille en deux.", "en": "Fold the sheet in half."}},
                           {"img": "img/activites/chapeau-chevalier-6.svg", "text": {"fr": "Mets-le sur ta tête.", "en": "Put it on your head."}}]},
}
APRES_FR = "Et si tu dessinais un cochon dans une grange\u00a0?"


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
    elif GAMES and (GAMES / parts[0]).is_dir():   # ludigames (plusieurs jeux) ou un jeu publié depuis la racine (Simon)
        base = GAMES / parts[0]
    else:
        return route.fulfill(body=f"<h1 style='font:40px sans-serif'>{parts[0]}</h1>", content_type="text/html")
    f = base / (rest or "index.html")
    if f.is_dir():
        f = f / "index.html"
    if not f.exists():
        return route.fulfill(status=404, body="")
    return route.fulfill(body=f.read_bytes(), content_type=mimetypes.guess_type(str(f))[0] or "application/octet-stream")


def famille(fin="douce", max_kit=None, fini_pluie=False):
    """Une famille déjà préparée (code 2580), pour aller droit au but."""
    h = 2166136261
    for c in "ludiworld:" + PIN:
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    games = {"pluie-de-cochons": {"ms": 0, "sessions": 3, "days": {}, "scores": {}, "progress": {}, "etat": {"fini": True}}} if fini_pluie else {}
    return {"games": games, "famille": {
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
        self.avis = {}       # (email, jeu) -> l'avis, comme la table avis (plan 5)
        self.otp = {}        # email -> le dernier code à 6 chiffres envoyé
        self.otp_demandes = []
        self.otp_limite = False
        self.usage = []          # les statistiques d'usage reçues (noter_usage)
        self.usage_avec_compte = 0  # envois qui portaient le jeton d'un compte : il n'y en a jamais

    def semer_avis(self):
        """D'autres parents ont déjà donné leur avis : 11 sur Jeu kit (un mot accepté, un à relire ; un parent chez qui le jeu
        ne marche pas, 1 étoile), 3 sur Pluie de Cochons (sous le seuil)."""
        for i in range(11):
            self.avis[(f"autre-{i}@exemple.test", "jeu-kit")] = {
                "compte_id": f"u-autre-{i}", "jeu": "jeu-kit", "etoiles": 1 if i == 3 else (4 if i % 3 == 0 else 5), "marche": "non" if i == 3 else "oui",
                "langue": "fr", "cree_le": "2026-11-10T10:00:00Z", "maj_le": "2026-11-1%dT10:00:00Z" % (i % 8),
                "mot": "Mes deux filles y jouent ensemble, sans se disputer." if i == 0 else ("<img src=x onerror=\"window.XSS=1\">Un mot à relire" if i == 1 else None),
                "mot_etat": "accepte" if i == 0 else ("a-relire" if i == 1 else None)}
        for i in range(3):
            self.avis[(f"autre-{i}@exemple.test", "pluie-de-cochons")] = {
                "compte_id": f"u-autre-{i}", "jeu": "pluie-de-cochons", "etoiles": 5, "marche": "oui",
                "langue": "fr", "cree_le": "2026-11-10T10:00:00Z", "maj_le": "2026-11-10T10:00:00Z", "mot": "Un mot accepté, mais sous le seuil", "mot_etat": "accepte"}

    def avis_publics(self, jeu, langue):
        """Comme public.avis_publics : null sous 5 avis ; le total, les étoiles (répartition, moyenne arrondie comme Postgres),
        « marche », la moyenne chez ceux pour qui le jeu marche bien ; les mots acceptés dans la langue, trois au plus."""
        l = [a for (e, j), a in self.avis.items() if j == jeu]
        if len(l) < 5:
            return None
        def totaux(q):
            d = {}
            for a in l:
                d[str(a[q])] = d.get(str(a[q]), 0) + 1
            return d
        def moyenne(x):
            if not x:
                return None
            return float((decimal.Decimal(sum(a["etoiles"] for a in x)) / len(x)).quantize(decimal.Decimal("0.1"), rounding=decimal.ROUND_HALF_UP))
        return {"total": len(l), "etoiles": totaux("etoiles"), "moyenne": moyenne(l), "marche": totaux("marche"),
                "moyenne_marche_bien": moyenne([a for a in l if a["marche"] == "oui"]),
                "mots": [a["mot"] for a in l if a["mot_etat"] == "accepte" and a["langue"] == langue][:3]}

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
            self.comptes[corps["email"]] = {"id": "u-" + str(len(self.comptes)), "mdp": corps["password"], "confirme": False, "synchro": corps["data"].get("synchro") is True,
                                            "nouvelles": corps["data"].get("nouvelles") == "true", "data": corps["data"]}
            ei = corps["data"].get("envie_id")
            if ei in self.envies:
                self.envies[ei]["compte"] = corps["email"]
            return self.repond(route, {"id": self.comptes[corps["email"]]["id"], "email": corps["email"]})
        if chemin.startswith("/auth/v1/token?grant_type=password"):
            c = self.comptes.get(corps["email"])
            if not c or c["mdp"] != corps["password"]:
                return self.repond(route, {"error_code": "invalid_credentials", "msg": "x"}, 400)
            if not c["confirme"]:
                return self.repond(route, {"error_code": "email_not_confirmed", "msg": "x"}, 400)
            return self.repond(route, self.session(corps["email"]))
        if chemin.startswith("/auth/v1/otp"):
            # Le code à 6 chiffres par e-mail (« Code oublié ? » sans le mot de passe) : un nouveau code remplace l'ancien.
            self.otp_demandes.append(corps)
            if self.otp_limite:
                return self.repond(route, {"error_code": "over_email_send_rate_limit", "msg": "x"}, 429)
            c = self.comptes.get(corps.get("email"))
            if not c and corps.get("create_user") is False:
                return self.repond(route, {"error_code": "otp_disabled", "msg": "Signups not allowed for otp"}, 422)
            self.otp[corps["email"]] = "%06d" % (135790 + 111111 * len(self.otp_demandes) % 1000000)
            return self.repond(route, {})
        if chemin.startswith("/auth/v1/verify"):
            e = corps.get("email")
            if corps.get("type") != "email" or not e or self.otp.get(e) != corps.get("token"):
                return self.repond(route, {"error_code": "otp_expired", "msg": "Token has expired or is invalid"}, 403)
            del self.otp[e]
            return self.repond(route, self.session(e))
        if chemin.startswith("/auth/v1/logout"):
            return self.repond(route, None, 204)
        if chemin.startswith("/auth/v1/"):
            return self.repond(route, {})
        if chemin.startswith("/rest/v1/comptes"):
            c = self.comptes.get(email)
            if not c:
                return self.repond(route, [])
            if req.method == "PATCH":
                c.update(corps)
                return self.repond(route, None, 204)
            return self.repond(route, [{"id": c["id"], "synchro": c["synchro"], "nouvelles": c["nouvelles"], "langue": "fr"}])
        if chemin.startswith("/rest/v1/foyers"):
            return self.repond(route, [{"etat": self.foyer, "version": self.version}] if self.foyer else [])
        if chemin.startswith("/rest/v1/envies"):
            return self.repond(route, [])
        if chemin.startswith("/rest/v1/avis"):
            if not email:
                return self.repond(route, {"message": "jwt"}, 401)
            q = urllib.parse.parse_qs(urllib.parse.urlsplit(chemin).query)
            jeu = q.get("jeu", ["eq."])[0][3:]
            if req.method == "DELETE":
                self.avis.pop((email, jeu), None)
                return self.repond(route, None, 204)
            if not jeu:  # « Télécharger mes données » : tous mes avis
                return self.repond(route, [a for (e, j), a in self.avis.items() if e == email])
            return self.repond(route, [self.avis[(email, jeu)]] if (email, jeu) in self.avis else [])
        fn = chemin.replace("/rest/v1/rpc/", "")
        if fn == "noter_usage":
            if req.headers.get("authorization"):
                self.usage_avec_compte += 1
            self.usage.extend(corps["p_evts"])
            return self.repond(route, len(corps["p_evts"]))
        if fn == "avis_publics":
            return self.repond(route, self.avis_publics(corps["p_jeu"], corps.get("p_langue", "fr")))
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
        if fn == "donner_avis":
            k = (email, corps["p_jeu"])
            avant = self.avis.get(k, {})
            mot = (corps.get("p_mot") or "").strip() or None
            # Comme la base : la nouvelle signature seulement (jeu, étoiles, marche, mot, langue), étoiles de 1 à 5.
            if set(corps) - {"p_jeu", "p_etoiles", "p_marche", "p_mot", "p_langue"} or corps.get("p_etoiles") not in (1, 2, 3, 4, 5) \
                    or corps.get("p_marche") not in ("oui", "pas-toujours", "non"):
                return self.repond(route, {"message": "donner_avis : appel refusé"}, 400)
            self.avis[k] = {"compte_id": self.comptes[email]["id"], "jeu": corps["p_jeu"], "etoiles": corps["p_etoiles"], "marche": corps["p_marche"], "mot": mot,
                            "mot_etat": None if not mot else (avant.get("mot_etat") if avant.get("mot") == mot else "a-relire"),
                            "langue": corps.get("p_langue", "fr"), "cree_le": avant.get("cree_le", "2026-11-18T10:00:00Z"), "maj_le": "2026-11-18T10:00:00Z"}
            return self.repond(route, None, 204)
        if fn == "effacer_mon_compte":
            for k in [k for k in self.avis if k[0] == email]:
                del self.avis[k]
            del self.comptes[email]
            self.foyer, self.version = None, 0
            return self.repond(route, None, 204)
        if fn.startswith("bureau_"):
            if email != "patron@exemple.test":
                return self.repond(route, {"message": "reserve au bureau"}, 403)
            if fn == "bureau_usage":
                return self.repond(route, {
                    "depuis": "2026-08-25", "evenements": 420, "appareils": 37, "revenus": 21,
                    "semaines": [{"semaine": "2026-11-02", "appareils": 20, "lancements": 64, "minutes": 510.5},
                                 {"semaine": "2026-11-09", "appareils": 28, "lancements": 90, "minutes": 720},
                                 {"semaine": "2026-11-16", "appareils": 33, "lancements": 101, "minutes": 815.2}],
                    "jeux": [{"jeu": "jeu-kit", "lancements": 120, "appareils": 30, "minutes": 900, "parties": 110, "installes": 25, "retires": 2, "ranges": 1,
                              "demandes": 6, "fiches": 40, "idees": 24, "activites": 12, "activites_appareils": 10, "activites_finies": 5, "etapes": {"0": 2, "1": 3, "2": 7}},
                             {"jeu": "pluie-de-cochons", "lancements": 80, "appareils": 22, "minutes": 640, "parties": 75, "installes": 18, "retires": 1, "ranges": 0,
                              "demandes": 3, "fiches": 21, "idees": 0, "activites": 0, "activites_appareils": 0, "activites_finies": 0, "etapes": {}}],
                    "fins": {"sortie": 60, "total": 40, "heure": 8, "jeu": 2},
                    "repartition": {"age": {"6-7": 15, "8-10": 19, "?": 3}, "format": {"tablette": 25, "telephone": 9, "ordi": 3}, "langue": {"fr": 33, "en": 4}},
                    "vues": {"enfant": 300, "parent": 80, "accueil": 12},
                    "choix": {"refus": 3, "reprises": 1, "age": {"8-10": 2, "6-7": 1}, "format": {"telephone": 2, "tablette": 1}}})
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
            if fn == "bureau_avis":
                return self.repond(route, sorted(self.avis.values(), key=lambda a: (a["mot_etat"] != "a-relire", a["maj_le"]), reverse=False))
            if fn == "bureau_relire_mot":
                for a in self.avis.values():
                    if a["compte_id"] == corps["p_compte"] and a["jeu"] == corps["p_jeu"] and a["mot"] is not None and a["mot"] == corps["p_mot"]:
                        a["mot_etat"] = "accepte" if corps["p_accepte"] else "refuse"
                        return self.repond(route, True)
                return self.repond(route, False)
            if fn == "bureau_comptes":
                return self.repond(route, [
                    {"id": "1", "email": "a@exemple.test", "cree_le": "2026-11-03T10:00:00Z", "confirme_le": "2026-11-03T10:05:00Z", "derniere_connexion": "2026-11-04T08:00:00Z",
                     "formule": "gratuit", "statut": "actif", "synchro": True, "nouvelles": True, "envie": ["aider", "jouer"], "profils": ["parent", "enseignant"]},
                    {"id": "2", "email": "b@exemple.test", "cree_le": "2026-11-01T10:00:00Z", "confirme_le": None, "derniere_connexion": None,
                     "formule": "gratuit", "statut": "actif", "synchro": False, "nouvelles": False, "envie": None, "profils": None}])
        return self.repond(route, {"message": "inconnu : " + chemin}, 404)


# Les parcours sont muets : la voix du navigateur (synthèse vocale) ne dit rien, dans l'appli comme dans les jeux (cadres compris).
MUET = """(function () { try { var s = window.speechSynthesis; if (!s) return;
  ['speak', 'cancel', 'pause', 'resume'].forEach(function (k) { try { s[k] = function () {}; } catch (e) {} });
} catch (e) {} })();"""


def contexte(browser, store=None, nuage=None, sw="block", **opts):
    ctx = browser.new_context(service_workers=sw, locale="fr-FR", **opts)
    ctx.route(BASE + "/**", serve)
    ctx.add_init_script(MUET)
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


def parent(page):
    """Le côté parent est ouvert (après le code)."""
    page.wait_for_selector("#v-parent:not([hidden])")


def onglet(page, nom):
    page.locator(f"#pa-onglets [data-onglet={nom}]").click()
    page.wait_for_timeout(150)


def stocke(page):
    return page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille")


def a(heures, minutes, jours=0):
    """Aujourd'hui (plus quelques jours) à heures:minutes, pour poser l'horloge du navigateur."""
    return datetime.datetime.combine(datetime.date.today() + datetime.timedelta(days=jours), datetime.time(heures, minutes))


def croise(b1, b2):
    """Deux boîtes à l'écran se recouvrent-elles ?"""
    return not (b1["x"] + b1["width"] <= b2["x"] or b2["x"] + b2["width"] <= b1["x"] or b1["y"] + b1["height"] <= b2["y"] or b2["y"] + b2["height"] <= b1["y"])


def regler(page, jeu):
    """Déplie les réglages d'un jeu sur sa ligne (« Régler »)."""
    if page.get_attribute(f".pa-ligne[data-jeu={jeu}] .pa-regler", "aria-expanded") != "true":
        page.click(f".pa-ligne[data-jeu={jeu}] .pa-regler")
    page.wait_for_selector(f".pa-ligne[data-jeu={jeu}] .pa-ligne-regl select")


def run():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--mute-audio"])   # muet : aucun son ni voix pendant les parcours
        formats = {
            "telephone": dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True),
            "tablette": dict(viewport={"width": 1180, "height": 820}),
        }

        # 0. Le site : rien de préparé, l'adresse de Ludiworld mène à l'accueil ; chaque page s'affiche
        for name, opts in formats.items():
            ctx = contexte(browser, **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE + "/ludiworld/")   # la racine : le site, sans détour
            page.wait_for_selector("#jeux-list .cat-mini")
            page.wait_for_selector("#aime-apercu dt")
            assert page.get_attribute(".lw-onglet[aria-current=page]", "class").endswith("lw-accueil"), "pas encore préparé : premier onglet « Accueil »"
            assert page.get_attribute(".lw-action", "href").endswith("app/#demarrer")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / f"{name}-0-site-accueil.png"))
            for nom_onglet, cle, attendu in [("Les jeux", "jeux", ".cat-mini"), ("Ludiworld aime bien", "aime", "#ab-valides .reco")]:
                page.locator(".lw-onglet", has_text=nom_onglet).click()
                page.wait_for_selector(attendu)
                assert page.get_attribute(".lw-onglet[aria-current=page]", "class").endswith("lw-" + cle)
                page.wait_for_timeout(1200)
                page.screenshot(path=str(OUT / f"{name}-0-site-{cle}.png"), full_page=True)
            page.goto(BASE + "/ludiworld/")
            page.wait_for_selector("#jeux-list .cat-mini")
            charte = page.inner_text("#charte")
            assert "Des jeux pensés pour faire du bien aux enfants" in charte and "jamais vendues" in charte, charte
            assert "abonnement" not in charte and "Chaque jeu le déclare" not in charte and "ne pas faire" not in charte, charte
            assert page.locator("#createurs").count() == 0 and page.locator("a[href*='creer/']").count() == 0, "l'accueil n'invite plus à créer un jeu"
            assert page.locator("body").inner_text().count("vendues") == 1, "une seule mention des données"
            if name == "telephone":
                page.locator("#charte").scroll_into_view_if_needed()
                page.wait_for_timeout(800)
                page.locator("#charte").screenshot(path=str(OUT / "telephone-0-charte-positive.png"))
            page.goto(BASE + "/ludiworld/creer/")
            page.wait_for_selector(".etape")   # la page reste à son adresse
            page.goto(BASE + "/ludiworld/aime-bien/")
            page.wait_for_selector("#ab-valides .reco")
            page.locator("[data-filtre=appli]").click()
            assert page.locator("#ab-valides .reco").count() == page.locator("#ab-valides .reco-appli").count() >= 1, "le filtre ne garde que les applis"
            page.locator(".lw-langs button", has_text="EN").click()
            assert page.inner_text("h1").startswith("Learning can be fun"), page.inner_text("h1")
            page.locator(".lw-langs button", has_text="FR").click()
            page.locator(".lw-action").click()
            page.wait_for_selector(".a-bienvenue")
            assert page.url.startswith(APP), "« Essayer » mène à la préparation, dans l'appli : " + page.url
            ctx.close()

        # 0 bis. Le site et l'appli séparés (Julien, 2026-11-18) : la racine montre le site, même sur un appareil préparé ;
        #        une ancienne adresse (/#carnet) arrive dans l'appli ; le logo du côté parent ramène au site ;
        #        une appli installée avant (départ à la racine) retombe dans l'appli ; l'appli marche hors ligne après une visite
        ctx = contexte(browser, famille(), **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector("#jeux-list .cat-mini")
        assert page.url == BASE + "/ludiworld/", "la racine reste le site sur un appareil préparé : " + page.url
        assert page.inner_text(".lw-action").strip() == "Ouvrir l’appli" and page.get_attribute(".lw-action", "href") == "app/#carnet"
        assert page.get_attribute(".hero-copy .btn-sun", "href") == "app/", "appareil préparé : « Ouvrir Ludiworld » mène à l'appli"
        page.wait_for_timeout(2500)
        page.screenshot(path=str(OUT / "telephone-0-racine-appareil-prepare.png"))
        page.goto(BASE + "/ludiworld/#carnet")
        page.wait_for_selector("#gate[open]")
        assert page.url.startswith(APP), "l'ancienne adresse /#carnet arrive dans l'appli : " + page.url
        code(page, PIN)
        parent(page)
        page.click("#v-parent .lw-marque")
        page.wait_for_selector("#jeux-list .cat-mini")
        assert page.url == BASE + "/ludiworld/", "le logo du côté parent ramène au site : " + page.url
        page.goto(BASE + "/ludiworld/decouvrir/#charte")
        page.wait_for_url(BASE + "/ludiworld/#charte")
        ctx.close()
        ctx = contexte(browser, famille(), **formats["tablette"])
        ctx.add_init_script("""(function () { var m = window.matchMedia.bind(window);
  window.matchMedia = function (q) { if (q.indexOf('standalone') !== -1) return { matches: true, media: q, addListener: function () {}, removeListener: function () {}, addEventListener: function () {}, removeEventListener: function () {} }; return m(q); }; })();""")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector(".tuile")
        assert page.url.startswith(APP), "une appli installée avant app/ retombe dans l'appli : " + page.url
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        code(page, PIN)
        parent(page)
        page.click("#v-parent .lw-marque")
        page.wait_for_selector("#jeux-list .cat-mini")
        assert page.url == BASE + "/ludiworld/", "depuis l'appli installée, le logo montre le site : " + page.url
        ctx.close()
        ctx = contexte(browser, famille(), sw="allow", **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
        page.reload()
        page.wait_for_selector(".tuile")
        page.wait_for_timeout(500)
        ctx.set_offline(True)
        page.reload()
        page.wait_for_selector(".tuile")
        assert page.locator(".tuile").count() == 2, "hors ligne, l'appli s'ouvre avec les jeux de l'enfant"
        page.screenshot(path=str(OUT / "tablette-0-appli-hors-ligne.png"))
        ctx.set_offline(False)
        ctx.close()

        # 1. Première ouverture : le parent prépare Ludiworld. Aucun jeu coché d'office ; les jours choisis sont montrés.
        for name, opts in formats.items():
            ctx = contexte(browser, **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP + "#demarrer")
            page.wait_for_selector(".a-bienvenue")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / f"{name}-1-bienvenue.png"))
            page.click(".a-texte .btn-sun")
            page.fill("#a-nom", "Petit Loup")
            page.get_by_role("radio", name="8").click()
            page.click(".a-nav .btn-sun")
            page.wait_for_selector(".a-catalogue .cat-mini")
            assert page.locator(".a-choisir[aria-pressed=true]").count() == 0, "aucun jeu coché d'office"
            assert page.is_disabled(".a-pied .a-nav .btn-sun"), "il faut choisir au moins un jeu"
            page.locator(".a-choisir").nth(0).click()
            premier = page.locator(".a-catalogue .cat-mini").nth(1)
            premier.locator(".cat-mini-ouvrir").click()   # toucher la mini-fiche (son nom) la choisit, sans ouvrir la fiche
            assert page.locator("dialog.cat-fiche[open]").count() == 0, "toucher la mini-fiche choisit le jeu"
            assert page.locator(".a-choisir[aria-pressed=true]").count() == 2
            premier.locator(".cat-mini-ouvrir").click()   # et le retoucher l'enlève
            assert page.locator(".a-choisir[aria-pressed=true]").count() == 1
            premier.locator(".a-voir").click()            # « Voir la fiche » l'ouvre
            page.wait_for_selector("dialog.cat-fiche[open] .a-choisir")
            page.click("dialog.cat-fiche .a-choisir")       # « Choisir » dans la fiche : choisi, et la fiche se referme
            page.wait_for_function("!document.querySelector('dialog.cat-fiche').open")
            assert page.locator(".a-choisir[aria-pressed=true]").count() == 2
            page.wait_for_timeout(600)
            page.screenshot(path=str(OUT / f"{name}-2-jeux.png"))
            page.click(".a-pied .a-nav .btn-sun")
            page.wait_for_selector(".jours")
            assert page.evaluate("scrollY") == 0, "chaque étape commence en haut"
            assert page.locator(".jours button[aria-pressed=true]").count() == 3 and "mercredi" in page.inner_text(".a-jours-mots"), "les jours choisis sont montrés"
            page.screenshot(path=str(OUT / f"{name}-3-temps.png"))
            page.click(".a-nav .btn-sun")
            for _ in range(2):
                for k in PIN:
                    page.locator(".pin-keys button", has_text=k).first.click()
                page.wait_for_timeout(250)
            page.wait_for_selector(".a-fin .a-stats-ligne")
            assert "sans nom" in page.inner_text(".a-fin .a-stats-ligne") and page.locator(".a-fin [data-action=stats-reglages]").count() == 1, "la préparation dit les statistiques, avec un lien vers Réglages"
            evts = [e["evt"] for e in page.evaluate("JSON.parse(localStorage.getItem('ludiworld.usage') || '[]')")]
            assert "preparation_finie" in evts, evts
            page.click(".a-fin .btn-sun")
            page.wait_for_selector(".tuile")
            page.wait_for_timeout(2500)
            page.screenshot(path=str(OUT / f"{name}-4-enfant.png"))
            fam = stocke(page)
            enfant = fam["enfants"][0]
            assert enfant["enfant"] == {"nom": "Petit Loup", "age": 8}, fam
            assert len(enfant["jeux"]) == 2 and enfant["regles"]["joursLibres"] == [0, 3, 6], enfant
            assert PIN not in json.dumps(fam), "le code ne doit pas être gardé en clair"
            assert page.locator(".tuile").count() == 2, "l'enfant ne voit que les jeux choisis"
            ctx.close()

        # 2. Côté parent : mauvais code refusé, bon code accepté ; une seule barre ; ses jeux, réglables sur la ligne ;
        #    « Fini » visible ; installer depuis « À découvrir » ; « Annuler » après un changement ; fiche d'un jeu et retour Android
        ctx = contexte(browser, famille(fini_pluie=True), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        page.wait_for_selector("#gate[open]")
        code(page, "1111")
        assert page.locator("#gate[open]").count() == 1, "un mauvais code ne doit pas ouvrir le côté parent"
        code(page, PIN)
        parent(page)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "tablette-5-parent-jeux.png"))
        # Un seul bandeau (Julien, 2026-11-18) : le logo (vers le site), « Parents » sans compte, FR / EN, « Rendre » ; les onglets dedans.
        # Ni la barre du site ni la ligne des promesses côté parent.
        assert page.locator("#v-parent .lw-barre").count() == 0 and page.locator("#v-parent .lw-promesses").count() == 0, "un seul bandeau"
        assert page.locator("#v-parent .pa-barre .lw-marque").is_visible(), "le logo Ludiworld dans le bandeau"
        if page.locator("#pa-qui .lw-compte").count():  # sans compte (et un nuage) : « Se connecter », comme sur le site, à droite
            assert page.inner_text("#pa-qui .lw-compte") == "Se connecter"
            assert page.locator("#pa-qui").bounding_box()["x"] > page.locator("[data-onglet=reglages]").bounding_box()["x"], "le compte à droite, à côté de « Rendre »"
        assert page.locator("#v-parent .pa-barre .lw-langs").count() == 0, "pas de FR / EN dans le bandeau : la langue est dans Réglages"
        assert page.locator("#v-parent .pa-barre #pa-rendre").count() == 1, "« Rendre » dans le bandeau"
        assert page.locator("#v-parent .lw-vers-parent").count() == 0, "pas de « Ouvrir l'appli » quand on y est"
        assert page.locator("[data-onglet=jeux]").bounding_box()["y"] < page.locator(".pa-barre").bounding_box()["y"] + page.locator(".pa-barre").bounding_box()["height"], "les onglets dans le bandeau"
        texte = page.inner_text("#v-parent")
        assert "carnet" not in texte.lower() and "Expériences" not in texte, "ni « carnet » ni « Expériences installées »"
        assert page.get_attribute("[data-onglet=jeux]", "aria-selected") == "true", "on arrive sur l'onglet Jeux"
        assert "Petit Loup a joué" in texte or "pas encore joué" in texte, texte[:200]
        assert page.locator(".pa-ligne").count() == 2, "une ligne par jeu installé"
        assert page.locator(".pa-ligne[data-jeu=pluie-de-cochons] .pa-fini").is_visible(), "« Fini » se voit sur la ligne du jeu"
        # Les lignes sont repliées : pas de liste ni de case, pas de « Sans limite » ; ce qu'on y apprend est écrit
        assert page.locator(".pa-lignes select, .pa-lignes input").count() == 0, "réglages repliés derrière « Régler »"
        assert "Sans limite" not in page.inner_text(".pa-lignes"), "jamais « Sans limite » seul sur une ligne"
        assert "multiplication" in page.inner_text(".pa-ligne[data-jeu=pluie-de-cochons]").lower(), "ce qu'on y apprend, sur la ligne"
        assert all(page.locator(".pa-ligne").nth(i).bounding_box()["height"] <= 90 for i in range(2)), "des lignes serrées"
        # « Régler » déplie la limite et la case sur place ; un seul jeu à la fois
        regler(page, "pluie-de-cochons")
        assert page.get_attribute(".pa-ligne[data-jeu=pluie-de-cochons] .pa-regler", "aria-expanded") == "true"
        assert "il compte dans le temps du jour" in page.inner_text(".pa-ligne[data-jeu=pluie-de-cochons] select option >> nth=0")
        # « Annuler » rétablit, et la ligne vit dans la barre, sous les onglets : elle ne couvre ni les onglets ni « Rendre »
        page.locator(".pa-ligne[data-jeu=pluie-de-cochons] select").select_option("10")
        page.wait_for_selector("#pa-journal .pa-journal-annuler")
        assert stocke(page)["enfants"][0]["jeux"]["pluie-de-cochons"]["max"] == 10
        ligne = page.locator("#pa-journal .pa-journal-ligne").bounding_box()
        for autre in ["#pa-rendre", "[data-onglet=jeux]", "[data-onglet=catalogue]", "[data-onglet=temps]", "[data-onglet=reglages]"]:
            assert not croise(ligne, page.locator(autre).bounding_box()), ("« Annuler » ne couvre pas", autre)
        page.click("#pa-journal .pa-journal-annuler")
        page.wait_for_timeout(200)
        assert stocke(page)["enfants"][0]["jeux"]["pluie-de-cochons"]["max"] is None, "Annuler remet la limite d'avant"
        page.locator(".pa-ligne[data-jeu=pluie-de-cochons] select").select_option("10")
        regler(page, "jeu-kit")
        assert page.locator(".pa-ligne-regl").count() == 1, "un seul jeu déplié à la fois"
        page.locator(".pa-ligne[data-jeu=jeu-kit] input[type=checkbox]").check()
        page.wait_for_timeout(200)
        j = stocke(page)["enfants"][0]["jeux"]
        assert j["pluie-de-cochons"]["max"] == 10 and j["jeu-kit"]["libres"] is True, j
        assert "10 min par jour" in page.inner_text(".pa-ligne[data-jeu=pluie-de-cochons]"), "un réglage qui sort de l'ordinaire s'écrit sur la ligne"
        # Les trois derniers changements, chacun avec son « Annuler »
        assert page.locator("#pa-journal .pa-journal-annuler").count() == 2, page.inner_text("#pa-journal")
        page.locator("#pa-journal .pa-journal-ligne").nth(1).locator("button").click()   # le plus ancien : la limite de Pluie de Cochons
        page.wait_for_timeout(200)
        j = stocke(page)["enfants"][0]["jeux"]
        assert j["pluie-de-cochons"]["max"] is None and j["jeu-kit"]["libres"] is True, ("chaque ligne ne défait que son changement", j)
        regler(page, "pluie-de-cochons")
        page.locator(".pa-ligne[data-jeu=pluie-de-cochons] select").select_option("10")
        page.wait_for_timeout(200)
        # Installer depuis « Tous les jeux » : la mini-fiche reste, avec « Installé pour Petit Loup »
        onglet(page, "catalogue")
        n = page.locator(".pa-tous-grille .cat-mini").count()
        page.locator("[data-installer=tour-aimants]").click()
        page.wait_for_timeout(200)
        assert "tour-aimants" in stocke(page)["enfants"][0]["jeux"], "installé depuis Tous les jeux"
        assert page.locator(".pa-tous-grille .cat-mini").count() == n, "tous les jeux restent affichés"
        assert "Installé pour Petit Loup" in page.inner_text(".cat-mini[data-jeu=tour-aimants] .cat-mini-actions")
        onglet(page, "jeux")
        assert page.locator(".pa-ligne[data-jeu=tour-aimants]").count() == 1
        assert page.locator(".pa-decouvrir, .pa-a-decouvrir").count() == 0, "plus de bloc « À découvrir » dans Mes jeux"
        page.screenshot(path=str(OUT / "tablette-6-parent-jeux-regles.png"), full_page=True)
        # La fiche d'un jeu : l'état en mots juste après les boutons, les réglages, ce que le jeu a enregistré
        page.locator(".pa-ligne[data-jeu=pluie-de-cochons] .pa-ligne-jeu").click()
        page.wait_for_selector("dialog.cat-fiche[open] .pa-pour")
        assert "%" not in page.inner_text("dialog.cat-fiche .pa-pour"), "pas de pourcentage"
        assert "Installé pour Petit Loup" in page.inner_text("dialog.cat-fiche .pa-pour-enfants")
        assert page.locator("dialog.cat-fiche details.pa-enregistre:not([open])").count() == 1, "ce que le jeu a enregistré est replié"
        assert page.locator("dialog.cat-fiche .cat-promesses").count() == 0 and "Aucun inconnu · " not in page.inner_text("dialog.cat-fiche"), "les promesses ne sont plus dans la fiche"
        fiche_txt = page.text_content("dialog.cat-fiche")
        assert "Aucun inconnu" not in fiche_txt and "abonnement" not in fiche_txt and "envoie rien" not in fiche_txt, "plus de liste d'engagements dans la fiche : la charte la dit une fois"
        assert "Ne contacte aucun autre site." in fiche_txt or "Contacte aussi" in fiche_txt, "« Toute la fiche » garde les sites contactés"
        assert "Fini" in page.inner_text("dialog.cat-fiche .pa-enregistre summary"), "son résumé dit « Fini »"
        assert page.evaluate("""() => { const f = document.querySelector('dialog.cat-fiche'), p = f.querySelector('.pa-pour'), g = f.querySelector('.cat-galerie, .cat-bande');
            return !!p.closest('.cat-avant') && (!g || (p.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING) > 0); }"""), "ce qui concerne l'enfant vient avant les images"
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "tablette-7-fiche.png"))
        # Retirer depuis la fiche : « Annuler » se voit et se touche dans la fiche ; réinstaller retrouve la limite et la case
        page.click("dialog.cat-fiche .pa-retirer")
        page.wait_for_selector("dialog.cat-fiche .pa-journal-ligne >> nth=0 >> button")
        assert page.locator("dialog.cat-fiche .pa-journal-annuler").first.is_visible(), "« Annuler » visible dans la fiche ouverte"
        e = stocke(page)["enfants"][0]
        assert "pluie-de-cochons" not in e["jeux"] and e["jeuxRetires"]["pluie-de-cochons"]["max"] == 10, e
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "tablette-7b-fiche-retire.png"))
        page.click("dialog.cat-fiche [data-installer=pluie-de-cochons]")
        page.wait_for_timeout(200)
        assert stocke(page)["enfants"][0]["jeux"]["pluie-de-cochons"]["max"] == 10, "réinstaller retrouve la limite d'avant"
        assert "Installé pour Petit Loup" in page.inner_text("dialog.cat-fiche .pa-pour-enfants")
        page.click("dialog.cat-fiche .pa-retirer")
        page.wait_for_timeout(200)
        page.click("dialog.cat-fiche .pa-journal-ligne >> nth=0 >> button")   # « Annuler » touché dans la fiche
        page.wait_for_timeout(200)
        assert stocke(page)["enfants"][0]["jeux"]["pluie-de-cochons"]["max"] == 10, "« Annuler » dans la fiche remet le jeu et ses réglages"
        page.locator("dialog.cat-fiche .cat-f-actions button", has_text="Essayer").click()
        page.wait_for_selector("#player:not([hidden])")
        page.wait_for_timeout(1500)
        page.evaluate("history.back()")  # bouton retour : ferme le jeu, rouvre la fiche
        page.wait_for_timeout(500)
        assert page.locator("#player").is_hidden(), "le retour doit fermer le jeu"
        assert page.locator("dialog.cat-fiche[open]").count() == 1, "la fiche revient"
        page.evaluate("history.back()")
        page.wait_for_timeout(500)
        assert page.locator("dialog.cat-fiche[open]").count() == 0, "le 2e retour ferme la fiche"
        assert stocke(page)["enfants"][0]["games"].get("pluie-de-cochons", {}).get("ms", 0) == 0, "l'essai du parent ne compte pas"
        onglet(page, "temps")
        assert page.inner_text(".pa-titre") == "Le temps de jeu de Petit Loup"
        page.screenshot(path=str(OUT / "tablette-8-parent-temps.png"))
        # Le retour du navigateur (geste retour du téléphone) revient à l'onglet d'avant, sans quitter Ludiworld
        page.evaluate("history.back()")
        page.wait_for_function("document.querySelector('[data-onglet=jeux]').getAttribute('aria-selected') === 'true'")
        assert "/ludiworld/app/" in page.url
        page.evaluate("history.forward()")
        page.wait_for_function("document.querySelector('[data-onglet=temps]').getAttribute('aria-selected') === 'true'")
        # Deux changements de suite : deux lignes ; annuler la première ne touche pas à la seconde
        avant = stocke(page)["enfants"][0]["regles"]
        page.locator(".jours button[aria-label=lundi]").click()
        page.locator(".pa-carte-temps:not(.libre)").locator(".stepper > button").first.click()
        page.wait_for_timeout(200)
        assert "Lundi devient un jour choisi" in page.inner_text("#pa-journal"), page.inner_text("#pa-journal")
        page.locator("#pa-journal .pa-journal-ligne").nth(1).locator("button").click()
        page.wait_for_timeout(200)
        r = stocke(page)["enfants"][0]["regles"]
        assert r["joursLibres"] == avant["joursLibres"] and r["ecole"] == avant["ecole"] - 5, r
        page.locator("#pa-journal .pa-journal-ligne button").first.click()
        page.wait_for_timeout(200)
        assert stocke(page)["enfants"][0]["regles"]["ecole"] == avant["ecole"], "tout revient comme en arrivant"
        # « À toute heure » coché puis décoché : les heures d'avant reviennent (rien ne se perd en silence)
        toute = lambda: page.locator(".pa-case", has_text="À toute heure").locator("input")
        toute().uncheck()
        page.wait_for_timeout(200)
        page.fill(".plage input[type=time] >> nth=1", "18:30")
        page.wait_for_timeout(200)
        toute().check()
        page.wait_for_timeout(200)
        assert stocke(page)["enfants"][0]["regles"]["heures"] is None
        toute().uncheck()
        page.wait_for_timeout(200)
        assert stocke(page)["enfants"][0]["regles"]["heures"] == {"debut": "17:00", "fin": "18:30"}, "les heures d'avant reviennent"
        toute().check()  # à toute heure pour la suite du parcours
        page.wait_for_timeout(200)
        onglet(page, "reglages")
        page.screenshot(path=str(OUT / "tablette-8b-parent-reglages.png"), full_page=True)
        # Depuis le côté parent, le logo mène au site, puis le retour du navigateur : Réglages, sans redonner le code
        page.click("#v-parent .lw-marque")
        page.wait_for_selector("#jeux-list .cat-mini")
        assert page.locator(".lw-promesses").is_visible() and page.locator(".lw-promesses").get_attribute("href") == "./#charte", "la ligne des promesses sur le site"
        page.go_back()
        parent(page)
        assert page.locator("#gate[open]").count() == 0, "le retour ne redemande pas le code"
        assert page.get_attribute("[data-onglet=reglages]", "aria-selected") == "true", "le retour revient sur l'onglet quitté"
        page.go_back()   # puis le pas d'avant : l'onglet Temps
        page.wait_for_function("document.querySelector('[data-onglet=temps]').getAttribute('aria-selected') === 'true'")
        onglet(page, "reglages")
        # Les pages du site gardent leur barre, avec « Ouvrir l'appli » pour revenir sans redonner le code
        page.goto(BASE + "/ludiworld/aime-bien/")
        page.wait_for_selector("#ab-valides .reco")
        assert page.locator(".lw-barre a[href$='#carnet']").count() == 1, "un seul retour vers le côté parent"
        assert page.inner_text(".lw-action").strip() == "Ouvrir l’appli" and page.locator(".lw-action .lw-ico").count() == 1, "côté parent encore ouvert : la flèche, pas de cadenas"
        assert page.locator(".lw-barre", has_text="Côté enfant").count() == 0
        page.locator(".lw-action").click()
        parent(page)
        assert page.locator("#gate[open]").count() == 0, "le code n'est pas redemandé tout de suite"
        # La page « Les jeux » d'un appareil préparé : la barre normale du site, « Mon Ludiworld » pour revenir
        page.goto(BASE + "/ludiworld/les-jeux/")
        page.wait_for_selector(".cat-mini")
        assert page.get_attribute(".lw-onglet[aria-current=page]", "class").endswith("lw-jeux")
        assert [t.strip() for t in page.locator(".lw-onglets > .lw-onglet").all_inner_texts()] == ["Accueil", "Les jeux", "Ludiworld aime bien"], "la barre normale du site"
        assert page.locator("#jx-retour:visible").count() == 0, "pas de second retour vers le côté parent"
        page.locator(".cat-mini[data-jeu=tour-aimants] .cat-mini-ouvrir").click()
        page.wait_for_selector("dialog.cat-fiche[open]")
        page.screenshot(path=str(OUT / "tablette-9-jeux.png"))
        page.keyboard.press("Escape")
        page.wait_for_function("!document.querySelector('dialog.cat-fiche').open")
        page.locator(".lw-action").click()
        parent(page)
        page.click("#pa-rendre")
        page.wait_for_selector(".tuile")
        page.goto(APP + "#carnet")
        page.wait_for_selector("#gate[open]")
        assert page.locator(".tuile", has_text="Tour").count() == 1, "le jeu installé est côté enfant"
        ctx.close()

        # 2 bis. Sur un téléphone préparé : la barre ne déborde pas ; onglets et « Rendre le téléphone » en bas, sous le pouce
        ctx = contexte(browser, famille(), **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        code(page, PIN)
        parent(page)
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "telephone-7-parent.png"))
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "rien ne dépasse en largeur"
        assert page.inner_text("#pa-rendre").strip() == "Rendre le téléphone", page.inner_text("#pa-rendre")
        # Un seul bandeau en haut : le logo et « Se connecter », sur une ligne
        barre = page.locator("#v-parent .pa-barre").bounding_box()
        assert barre["y"] < 10 and page.locator("#v-parent .lw-barre").count() == 0, ("un seul bandeau en haut", barre)
        logo, qui = page.locator("#v-parent .lw-marque").bounding_box(), page.locator("#pa-qui").bounding_box()
        assert page.locator("#pa-qui > *").count() == 0 or abs(logo["y"] + logo["height"] / 2 - qui["y"] - qui["height"] / 2) < 12 and qui["x"] + qui["width"] <= 390, ("logo et « Se connecter » sur la même ligne", logo, qui)
        boite = page.locator("#pa-rendre").bounding_box()
        assert boite["y"] > 844 - 120 and boite["height"] >= 44, ("le retour est en bas, assez grand", boite)
        assert page.locator("[data-onglet=temps]").bounding_box()["y"] > 844 - 120, "les onglets sont en bas"
        # Les trois jeux tiennent sous la carte du jour, sans faire défiler
        bas = page.locator(".pa-bas").bounding_box()["y"]
        assert all(page.locator(".pa-ligne").nth(i).bounding_box()["y"] + page.locator(".pa-ligne").nth(i).bounding_box()["height"] <= bas for i in range(page.locator(".pa-ligne").count())), "ses jeux tiennent à l'écran"
        # SL-19 : un réglage, puis « Rendre le téléphone » touché aussitôt, à l'endroit habituel : le réglage tient
        rendre_avant = page.locator("#pa-rendre").bounding_box()
        regler(page, "pluie-de-cochons")
        page.locator(".pa-ligne[data-jeu=pluie-de-cochons] select").select_option("10")
        page.wait_for_selector("#pa-journal .pa-journal-annuler")
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "telephone-7b-annuler.png"))
        ligne = page.locator("#pa-journal .pa-journal-ligne").bounding_box()
        rendre = page.locator("#pa-rendre").bounding_box()
        assert ligne["y"] + ligne["height"] <= rendre["y"] and not croise(ligne, page.locator("[data-onglet=temps]").bounding_box()), ("la ligne est au-dessus de la barre du bas", ligne, rendre)
        assert ligne["y"] >= page.locator(".pa-ligne[data-jeu=pluie-de-cochons] select").bounding_box()["y"] + 40, "la ligne ne cache pas le réglage qu'on vient de toucher"
        assert rendre == rendre_avant, "« Rendre le téléphone » n'a pas bougé"
        page.mouse.click(rendre["x"] + rendre["width"] / 2, rendre["y"] + rendre["height"] / 2)
        page.wait_for_selector(".tuile")
        assert stocke(page)["enfants"][0]["jeux"]["pluie-de-cochons"]["max"] == 10, "rendre le téléphone ne défait pas le réglage"
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        page.wait_for_selector("#gate[open]")
        code(page, PIN)
        parent(page)
        assert page.locator("#pa-journal").is_hidden(), "plus rien à annuler une fois l'appareil rendu"
        ctx.close()

        # 2 bis b. Sur ordinateur : la barre du site et « Côté enfant » à droite ; une page du site avec sa ligne des promesses
        ctx = contexte(browser, famille(), viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        code(page, PIN)
        parent(page)
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "ordinateur-parent.png"))
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "rien ne dépasse en largeur"
        assert page.inner_text("#v-parent .pa-barre #pa-rendre").strip() == "Côté enfant"
        assert page.locator("#v-parent .pa-barre").bounding_box()["height"] <= 70 and "pa-deux-lignes" not in page.get_attribute(".pa-barre", "class"), "le bandeau tient sur une ligne"
        page.goto(BASE + "/ludiworld/les-jeux/")
        page.wait_for_selector(".cat-mini")
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "ordinateur-site-jeux.png"))
        assert page.locator(".lw-promesses").is_visible() and page.locator(".lw-vers-parent").count() == 1
        ctx.close()

        # 2 ter. La carte du jour dit l'état vrai hors des heures de jeu (horloge posée : jeux de 17 h à 19 h).
        #   À 19 h 05, « +10 min » rouvre vraiment 10 minutes, ce soir seulement, sans changer les heures réglées ;
        #   la fin nette s'applique à la rallonge ; le lendemain, il n'en reste rien.
        store = famille("nette")
        store["famille"]["regles"]["heures"] = {"debut": "17:00", "fin": "19:00"}
        ctx = contexte(browser, store, **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.clock.install(time=a(19, 5))
        page.goto(APP + "#carnet")
        code(page, PIN)
        parent(page)
        carte = page.inner_text(".pa-jour").replace(" ", " ")
        assert "Fermé depuis 19 h" in carte and "Il reste" not in carte, carte
        page.click(".pa-jour .pa-vers-heures")   # le lien amène sur les heures, pas en haut de l'onglet
        page.wait_for_timeout(300)
        assert page.get_attribute("[data-onglet=temps]", "aria-selected") == "true"
        h = page.locator("#pa-heures").bounding_box()
        assert 0 <= h["y"] and h["y"] + h["height"] <= 820, ("les heures sont à l'écran", h)
        onglet(page, "jeux")
        page.screenshot(path=str(OUT / "tablette-9b-hors-heures.png"))
        page.click(".pa-jour [data-action=plus10]")
        page.wait_for_timeout(200)
        r = stocke(page)["enfants"][0]["regles"]
        assert r["heures"] == {"debut": "17:00", "fin": "19:00"} and r["bonus"]["fin"] in ("19:15", "19:16"), ("les heures réglées ne changent pas ; 10 minutes, arrondies à la minute au-dessus", r)
        carte = page.inner_text(".pa-jour").replace(" ", " ")
        assert ("Il reste 10 min" in carte or "Il reste 11 min" in carte) and "ce soir jusqu’à 19 h 1" in carte, carte
        page.screenshot(path=str(OUT / "tablette-9c-plus10-apres-19h.png"))
        page.click("#pa-rendre")
        page.wait_for_selector(".tuile")   # le côté enfant rouvre
        page.locator(".tuile", has_text="Jeu kit").click()
        page.wait_for_selector("#player:not([hidden])")
        page.clock.run_for(12 * 60 * 1000)
        page.wait_for_selector("#p-rideau:not([hidden])")   # fin nette : à 19 h 15, on s'arrête
        page.click("#p-rideau .btn-sun")
        page.wait_for_selector("#e-dodo:not([hidden])")
        ctx.close()
        # Le lendemain à 19 h 05 : fermé depuis 19 h, comme d'habitude
        store["famille"]["regles"]["bonus"] = {"jour": "%d-%d-%d" % (a(0, 0).year, a(0, 0).month, a(0, 0).day), "min": 10, "fin": "19:15"}
        ctx = contexte(browser, store, **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.clock.install(time=a(19, 5, jours=1))
        page.goto(APP + "#carnet")
        code(page, PIN)
        parent(page)
        assert "Fermé depuis 19 h." in page.inner_text(".pa-jour").replace(" ", " "), page.inner_text(".pa-jour")
        ctx.close()
        # À 15 h : « Ouvre à 17 h. Il restera 30 min. » ; « Arrêter » avant l'ouverture : fini côté enfant
        store = famille()
        store["famille"]["regles"]["heures"] = {"debut": "17:00", "fin": "19:00"}
        ctx = contexte(browser, store, **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.clock.install(time=a(15, 0))
        page.goto(APP + "#carnet")
        code(page, PIN)
        parent(page)
        assert "Ouvre à 17 h. Il restera 30 min." in page.inner_text(".pa-jour").replace(" ", " "), page.inner_text(".pa-jour")
        page.click(".pa-jour [data-action=stop]")
        assert "Arrêté pour aujourd’hui" in page.inner_text(".pa-jour")
        page.click("#pa-rendre")
        page.wait_for_selector("#e-dodo:not([hidden])")
        assert "Fini pour aujourd’hui" in page.inner_text("#e-temps") and "réveillent" not in page.inner_text("#e-dodo"), "arrêté avant l'ouverture : c'est fini pour aujourd'hui"
        ctx.close()

        # 2 quater. Plan 1 : Mes jeux, Tous les jeux, ranger, demander.
        #   Quatre onglets à plat ; l'enfant regarde tous les jeux (temps non compté) et en demande un ; la demande arrive côté parent,
        #   « Installer » ou « Pas maintenant » ; ranger / ressortir / annuler ; un jeu rangé va dans « Finis » côté enfant ;
        #   la case de Réglages coupe le bouton de l'enfant ; « Nouveau » pendant 30 jours.
        for name, opts in dict(formats, ordinateur=dict(viewport={"width": 1440, "height": 900})).items():
            ctx = contexte(browser, famille(), **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP)
            page.wait_for_selector(".tuile")
            page.wait_for_selector("#e-vitrine:not([hidden])")
            assert page.get_attribute("#e-vitrine", "aria-label") == "Regarder tous les jeux"
            assert page.inner_text("#e-vitrine").strip() == "", "une image, pas de mot à lire"
            page.wait_for_timeout(2300)
            page.screenshot(path=str(OUT / f"{name}-p1-enfant-bouton.png"))
            avant_ms = page.evaluate("JSON.stringify(ludiDemo.etat().famille.enfants[0].games)")
            page.click("#e-vitrine")
            page.wait_for_selector(".v-tuile")
            assert page.locator(".v-tuile").count() == 8, "les jeux qu'il n'a pas (10 au catalogue d'essai, 2 installés)"
            assert page.locator(".v-tuile[data-jeu=pluie-de-cochons]").count() == 0
            page.wait_for_timeout(1500)
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), ("rien ne dépasse", name)
            page.screenshot(path=str(OUT / f"{name}-p1-vitrine.png"))
            page.click(".v-tuile[data-jeu=tour-aimants]")
            page.wait_for_selector(".v-vouloir")
            assert page.locator(".v-images img").count() == 3, "les trois images en grand"
            assert page.inner_text(".v-vouloir").strip() == "Je voudrais ce jeu" and page.locator(".v-vouloir svg").count() == 1, "avec une main levée"
            page.wait_for_timeout(600)
            page.screenshot(path=str(OUT / f"{name}-p1-vitrine-jeu.png"))
            page.click(".v-vouloir")
            page.wait_for_selector(".v-demande")
            assert page.inner_text(".v-demande").strip() == "Demandé ! Un parent va regarder.", page.inner_text(".v-demande")
            e = stocke(page)["enfants"][0]
            assert list(e.get("demandes", {})) == ["tour-aimants"] and "tour-aimants" not in e["jeux"], ("rien ne s'installe", e)
            page.wait_for_timeout(700)
            page.screenshot(path=str(OUT / f"{name}-p1-vitrine-demande.png"))
            page.evaluate("history.back()")   # le retour du téléphone : la liste
            page.wait_for_selector(".v-grille")
            assert "Demandé" in page.inner_text(".v-tuile[data-jeu=tour-aimants] .v-marque")
            page.click(".v-tuile[data-jeu=simon-des-monstres]")
            page.click(".v-vouloir")
            page.wait_for_selector(".v-demande")
            page.click(".v-retour")
            page.wait_for_selector(".v-grille")
            page.wait_for_timeout(1800)
            page.click(".v-retour")
            page.wait_for_selector("#vitrine", state="hidden")
            apres_ms = page.evaluate("JSON.stringify(ludiDemo.etat().famille.enfants[0].games)")
            assert avant_ms == apres_ms, "regarder les jeux ne compte pas dans le temps de jeu"
            # Côté parent : quatre onglets à plat ; la demande en haut de « Mes jeux »
            page.focus("#e-parents")
            page.keyboard.press("Enter")
            code(page, PIN)
            parent(page)
            onglets = page.locator("#pa-onglets [data-onglet]")
            assert [onglets.nth(i).get_attribute("data-onglet") for i in range(onglets.count())] == ["jeux", "catalogue", "temps", "reglages"]
            assert [t.strip().replace("\n", " ") for t in onglets.all_inner_texts()] == ["Mes jeux", "Tous les jeux", "Temps", "Réglages"], onglets.all_inner_texts()
            if name == "telephone":
                for i in range(4):
                    assert onglets.nth(i).bounding_box()["y"] > 844 - 120, "les quatre onglets en bas"
                r = page.locator("#pa-rendre")
                assert r.evaluate("b => b.scrollWidth <= b.clientWidth + 1"), "« Rendre le téléphone » tient dans son bouton"
            dem = page.locator(".pa-demande")
            assert dem.count() == 2 and dem.nth(0).get_attribute("data-demande") == "tour-aimants", "une ligne par demande, la plus ancienne d'abord"
            assert "Petit Loup voudrait : La Tour aux Aimants" in page.inner_text(".pa-demande[data-demande=tour-aimants]").replace("\u00a0", " ")
            assert page.evaluate("document.querySelector('.pa-demandes').compareDocumentPosition(document.querySelector('.pa-jour')) & Node.DOCUMENT_POSITION_FOLLOWING"), "en haut"
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), ("rien ne dépasse", name)
            page.wait_for_timeout(400)
            page.screenshot(path=str(OUT / f"{name}-p1-mes-jeux-demandes.png"))
            # Tous les jeux : l'état pour l'enfant regardé
            onglet(page, "catalogue")
            assert page.locator(".pa-tous-grille .cat-mini").count() == 10
            assert "Petit Loup le voudrait" in page.inner_text(".cat-mini[data-jeu=tour-aimants] .cat-mini-actions")
            assert "Installé pour Petit Loup" in page.inner_text(".cat-mini[data-jeu=pluie-de-cochons] .cat-mini-actions")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), ("rien ne dépasse", name)
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / f"{name}-p1-tous-les-jeux.png"))
            onglet(page, "jeux")
            if name != "tablette":
                ctx.close()
                continue
            # Installer depuis la demande ; « Annuler » ramène la demande ; puis « Pas maintenant » pour Simon
            page.click(".pa-demande[data-demande=tour-aimants] [data-installer]")
            page.wait_for_timeout(200)
            e = stocke(page)["enfants"][0]
            assert "tour-aimants" in e["jeux"] and "tour-aimants" not in e.get("demandes", {}) and "tour-aimants" in e["demandesVues"], e
            assert "Changé : La Tour aux Aimants installé pour Petit Loup" in page.inner_text("#pa-journal").replace("\u00a0", " "), page.inner_text("#pa-journal")
            assert page.locator(".pa-ligne[data-jeu=tour-aimants]").count() == 1 and page.locator(".pa-demande").count() == 1
            page.click("#pa-journal .pa-journal-annuler")
            page.wait_for_timeout(200)
            e = stocke(page)["enfants"][0]
            assert "tour-aimants" not in e["jeux"] and "tour-aimants" in e["demandes"], ("Annuler : la demande revient", e)
            page.click(".pa-demande[data-demande=tour-aimants] [data-installer]")
            page.click("[data-pas-maintenant=simon-des-monstres]")
            page.wait_for_timeout(200)
            e = stocke(page)["enfants"][0]
            assert "demandes" not in e and "simon-des-monstres" not in e["jeux"] and "simon-des-monstres" in e["demandesVues"], e
            assert page.locator(".pa-demandes").count() == 0
            # Ranger dans « Régler » : le jeu passe dans « Rangés (1) », rien n'est effacé ; Annuler ; Ressortir
            regler(page, "pluie-de-cochons")
            page.locator(".pa-ligne[data-jeu=pluie-de-cochons] select").select_option("15")
            page.click(".pa-ligne[data-jeu=pluie-de-cochons] [data-ranger]")
            page.wait_for_timeout(200)
            c = stocke(page)["enfants"][0]["jeux"]["pluie-de-cochons"]
            assert c["range"] > 0 and c["max"] == 15, ("rangé, réglages gardés", c)
            assert page.locator(".pa-lignes > .pa-ligne[data-jeu=pluie-de-cochons]:not(.pa-ligne-rangee)").count() == 0
            assert page.inner_text(".pa-ranges summary").strip() == "Rangés (1)"
            assert page.locator(".pa-ranges[open]").count() == 0, "replié"
            page.click("#pa-journal .pa-journal-ligne >> nth=0 >> button")
            page.wait_for_timeout(200)
            assert "range" not in stocke(page)["enfants"][0]["jeux"]["pluie-de-cochons"], "Annuler ressort le jeu"
            regler(page, "pluie-de-cochons")
            page.click(".pa-ligne[data-jeu=pluie-de-cochons] [data-ranger]")
            page.wait_for_timeout(200)
            page.click(".pa-ranges summary")
            page.wait_for_timeout(200)
            page.screenshot(path=str(OUT / "tablette-p1-ranges.png"), full_page=True)
            page.click(".pa-ranges [data-ressortir=pluie-de-cochons]")
            page.wait_for_timeout(200)
            assert "range" not in stocke(page)["enfants"][0]["jeux"]["pluie-de-cochons"] and page.locator(".pa-ranges").count() == 0
            # Ranger depuis la fiche, puis « Rangé pour Petit Loup » ; « Retirer » reste dans la fiche
            page.locator(".pa-ligne[data-jeu=pluie-de-cochons] .pa-ligne-jeu").click()
            page.wait_for_selector("dialog.cat-fiche[open] [data-ranger]")
            assert page.locator("dialog.cat-fiche .pa-retirer").count() == 1
            page.click("dialog.cat-fiche [data-ranger]")
            page.wait_for_timeout(200)
            assert "Rangé pour Petit Loup" in page.inner_text("dialog.cat-fiche .pa-pour-enfants")
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / "tablette-p1-fiche-range.png"))
            page.keyboard.press("Escape")
            page.wait_for_function("!document.querySelector('dialog.cat-fiche').open")
            assert page.locator("#pa-page .pa-retirer").count() == 0, "« Retirer » seulement dans la fiche"
            # Côté enfant : le jeu rangé (pas fini) est dans « Finis », jouable ; Simon (pas maintenant) peut se redemander
            page.click("#pa-rendre")
            page.wait_for_selector(".tuile")
            groupe = page.locator(".e-rangee-groupe", has=page.locator(".e-rangee-finis"))
            assert groupe.locator(".tuile", has_text="Pluie de Cochons").count() == 1, "rangé : dans « Finis »"
            page.wait_for_timeout(2300)
            page.screenshot(path=str(OUT / "tablette-p1-enfant-range-finis.png"))
            page.click("#e-vitrine")
            page.wait_for_selector(".v-tuile")
            assert page.locator(".v-tuile[data-jeu=simon-des-monstres] .v-marque").count() == 0, "après « Pas maintenant », plus de marque"
            assert page.locator(".v-tuile[data-jeu=tour-aimants]").count() == 0, "installé : plus dans la vitrine"
            page.click(".v-retour")
            page.wait_for_selector("#vitrine", state="hidden")
            page.locator(".tuile", has_text="Pluie de Cochons").click()
            page.wait_for_selector("#player:not([hidden])")
            page.click("#player-back")
            page.wait_for_selector("#player", state="hidden")
            # La case de Réglages coupe le bouton de l'enfant
            page.focus("#e-parents")
            page.keyboard.press("Enter")
            code(page, PIN)
            parent(page)
            onglet(page, "reglages")
            case = page.locator("[data-reglage=regarder]")
            assert case.is_checked() and "Petit Loup peut regarder tous les jeux et en demander un" in page.inner_text(".pa-bloc-enfant")
            case.uncheck()
            page.wait_for_timeout(200)
            assert stocke(page)["enfants"][0]["regarderTout"] is False
            assert "Petit Loup ne peut plus regarder tous les jeux" in page.inner_text("#pa-journal")
            page.screenshot(path=str(OUT / "tablette-p1-reglages-case.png"), full_page=True)
            page.click("#pa-rendre")
            page.wait_for_selector(".tuile")
            assert page.locator("#e-vitrine").is_hidden(), "bouton coupé"
            # Tout installé : « Tous les jeux » montre encore tout ; la vitrine de l'enfant n'a plus rien à montrer
            page.goto(BASE + "/ludiworld/jeux/index.json")   # l'appli fermée (elle réécrit ses données en partant), même origine
            page.evaluate("""() => { var s = JSON.parse(localStorage.getItem('ludiworld.v1')); var e = s.famille.enfants[0]; delete e.regarderTout;
              ['tour-aimants','du-feu-a-la-fusee','chasseur-dragons','simon-des-monstres','monde-a-la-craie','les-petits-enclos','chemin-du-roi','defis-de-barnabe'].forEach(function (id) { e.jeux[id] = e.jeux[id] || { max: null }; });
              localStorage.setItem('ludiworld.v1', JSON.stringify(s)); }""")
            page.goto(APP)
            page.wait_for_selector(".tuile")
            assert page.locator("#e-vitrine").is_hidden(), "tout installé : rien à regarder"
            page.focus("#e-parents")
            page.keyboard.press("Enter")
            code(page, PIN)
            parent(page)
            onglet(page, "catalogue")
            assert page.locator(".pa-tous-grille .cat-mini").count() == 10 and page.locator(".pa-tous-grille .pa-installer").count() == 0, "tout installé : tous les jeux restent là"
            ctx.close()

        # « Nouveau » : une petite marque écrite, 30 jours après l'entrée du jeu au catalogue ; les nouveaux d'abord. Horloge au 5 décembre 2026 :
        # Les Défis de Barnabé (23 novembre), Le Chemin du Roi (15 novembre) puis Les Petits Enclos (11 novembre) ; les autres, entrés avant le 6 novembre, ne le sont plus.
        ctx = contexte(browser, famille(), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.clock.install(time=datetime.datetime(2026, 12, 5, 16, 0))
        page.goto(APP + "#carnet")
        code(page, PIN)
        parent(page)
        onglet(page, "catalogue")
        assert page.locator(".cat-nouveau").count() == 3, page.locator(".cat-nouveau").count()
        ordre = [page.locator(".pa-tous-grille .cat-mini").nth(i).get_attribute("data-jeu") for i in range(4)]
        assert ordre[:3] == ["defis-de-barnabe", "chemin-du-roi", "les-petits-enclos"], ordre
        assert page.inner_text(".cat-mini[data-jeu=chemin-du-roi] .cat-nouveau") == "Nouveau"
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "tablette-p1-nouveau.png"))
        onglet(page, "reglages")
        page.locator(".pa-maison .langs button", has_text="EN").click()
        onglet(page, "catalogue")
        assert page.inner_text(".cat-mini[data-jeu=chemin-du-roi] .cat-nouveau") == "New"
        assert page.inner_text("[data-onglet=catalogue]").strip() == "All games" and page.inner_text("[data-onglet=jeux]").strip() == "My games"
        page.goto(BASE + "/ludiworld/les-jeux/")
        page.wait_for_selector(".cat-mini")
        assert page.locator(".cat-nouveau").count() == 3 and page.locator(".jx-grille .cat-mini").first.get_attribute("data-jeu") == "defis-de-barnabe", "la vitrine du site aussi"
        ctx.close()
        # Le 1er février 2027 : plus rien de nouveau, pas de marque
        ctx = contexte(browser, famille(), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.clock.install(time=datetime.datetime(2027, 2, 1, 16, 0))
        page.goto(BASE + "/ludiworld/les-jeux/")
        page.wait_for_selector(".cat-mini")
        assert page.locator(".cat-nouveau").count() == 0
        ctx.close()

        # Deux enfants : la demande de l'un ne s'affiche que quand on le regarde
        ctx = contexte(browser, famille(), **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.goto(BASE + "/ludiworld/jeux/index.json")
        page.evaluate("""() => { var s = JSON.parse(localStorage.getItem('ludiworld.v1')); var f = s.famille, e = f.enfants[0];
          f.enfants.push({ id: 'e2', enfant: { nom: 'Inès', age: 7 }, jeux: {}, regles: JSON.parse(JSON.stringify(e.regles)), games: {}, demandes: { 'simon-des-monstres': Date.now() } });
          localStorage.setItem('ludiworld.v1', JSON.stringify(s)); }""")
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        code(page, PIN)
        parent(page)
        assert page.locator(".pa-demande").count() == 0, "Petit Loup n'a rien demandé"
        page.locator("#pa-enfants button", has_text="Inès").click()
        page.wait_for_selector(".pa-demande")
        assert "Inès voudrait : Simon des Monstres" in page.inner_text(".pa-demande").replace("\u00a0", " ")
        assert "Aucun jeu installé pour l’instant." in page.inner_text(".pa-ses-jeux") and page.locator(".pa-voir-tout").count() == 1
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / "telephone-p1-deux-enfants-sans-jeu.png"), full_page=True)
        page.click(".pa-voir-tout")
        page.wait_for_selector(".pa-tous-grille")
        assert "Inès le voudrait" in page.inner_text(".cat-mini[data-jeu=simon-des-monstres] .cat-mini-actions")
        ctx.close()

        # 3. Fin douce : on prévient, on attend la fin de manche, puis la nuit tombe
        ctx = contexte(browser, famille("douce"), **formats["tablette"])
        page = ctx.new_page()
        demandes = []
        page.on("request", lambda r: demandes.append(r.url))
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.locator(".tuile", has_text="Jeu kit").click()
        game = page.frame_locator("#player iframe")
        assert "fullscreen" not in (page.get_attribute("#player iframe", "allow") or ""), "le plein écran se décide dans Ludiworld, pas dans le jeu"
        game.locator("#b").click()
        page.wait_for_timeout(300)
        assert any(u.endswith("/jeux/img/activites/chapeau-chevalier-6.svg") for u in demandes), "les schémas de l'activité se chargent dès le lancement du jeu (pour la fin hors ligne)"
        st = page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['jeu-kit']")
        assert st["kit"] is True and st["scores"]["points"]["value"] == 42 and st["progress"]["niveau"] == 3, st
        assert st["skills"]["maths.multiplication/7x8"]["ok"] == 1, st
        page.evaluate("ludiDemo.ajouter('jeu-kit', 26)")
        page.wait_for_timeout(1500)
        assert page.locator("#p-bandeau").is_visible(), "5 min avant : la marmotte prévient"
        assert page.inner_text("#p-bandeau b") == "Le soleil se couche", page.inner_text("#p-bandeau")
        assert page.inner_text("#p-bandeau span") == "Ça s’arrête à la fin de ta partie.", page.inner_text("#p-bandeau")
        assert page.inner_text("#p-bandeau small") == "encore 4\u00a0min", "les minutes en petit, le vrai nombre"
        assert "wrapup" in game.locator("#msg").inner_text(), "le jeu est prévenu (ludi:wrapup)"
        page.screenshot(path=str(OUT / "tablette-9-bientot.png"))
        page.evaluate("ludiDemo.ajouter('jeu-kit', 5)")
        page.wait_for_timeout(1500)
        assert page.inner_text("#p-bandeau span") == "C’est ta dernière partie.", page.inner_text("#p-bandeau")
        assert page.locator("#p-bandeau small").count() == 0
        assert page.locator("#p-rideau").is_hidden(), "fin douce : on n'interrompt pas la manche"
        assert "derniere" in page.get_attribute("#p-reste", "class"), "pastille « dernière partie »"
        game.locator("#fin").click()
        page.wait_for_timeout(1500)
        assert page.locator("#p-rideau").is_visible(), "fin de manche : on s'arrête"
        assert "pause" in game.locator("#msg").inner_text(), "le jeu reçoit ludi:pause"
        assert page.inner_text("#p-rideau .rideau-apres p") == APRES_FR, "sous « Bravo », l'idée hors écran du dernier jeu"
        assert page.inner_text("#p-rideau .rideau-apres .btn-activite") == "Comment faire\u00a0?", "l'idée porte son activité pas à pas"
        page.wait_for_timeout(2200)
        page.screenshot(path=str(OUT / "tablette-10-rideau.png"))
        # L'activité : ce qu'il faut, puis une étape à la fois ; la voix au toucher ; le temps ne compte pas
        page.evaluate("""() => { window.__dit = []; var s = window.speechSynthesis;
          s.getVoices = function () { return [{ lang: 'fr-FR', localService: true }]; };
          s.speak = function (u) { window.__dit.push(u.text); };
          window.SpeechSynthesisUtterance = function (t) { this.text = t; }; }""")
        temps = lambda: page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['jeu-kit'].ms")
        avant = temps()
        page.click("#p-rideau .btn-activite")
        page.wait_for_selector(".p-activite")
        assert page.inner_text(".p-activite h2") == "Le chapeau"
        assert page.inner_text(".p-activite .act-phrase") == "Une grande feuille.", "d'abord ce qu'il faut"
        page.click(".p-activite .act-phrase")
        assert page.evaluate("window.__dit") == ["Une grande feuille."], "appuyer sur le texte le fait lire"
        page.click(".p-activite .act-suivant")
        assert page.inner_text(".p-activite .act-compte") == "Étape 1 sur 2"
        page.wait_for_function("document.querySelector('.act-schema').naturalWidth > 0")
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUT / "tablette-10a-activite.png"))
        page.keyboard.press("ArrowRight")
        assert page.inner_text(".p-activite .act-phrase") == "Mets-le sur ta tête."
        assert page.inner_text(".p-activite .act-suivant") == "J’ai fini\u00a0!", page.inner_text(".p-activite .act-suivant")
        page.wait_for_timeout(2500)
        page.click(".p-activite .act-suivant")
        assert page.locator(".p-activite").count() == 0, "« J'ai fini » ferme l'activité"
        assert page.locator("#p-rideau").is_visible(), "on revient à l'écran de fin"
        assert temps() == avant, "le temps passé sur l'activité ne compte pas"
        # Le retour du téléphone ferme seulement l'activité, pas l'écran de fin
        page.click("#p-rideau .btn-activite")
        page.wait_for_selector(".p-activite")
        page.go_back()
        page.wait_for_timeout(400)
        assert page.locator(".p-activite").count() == 0, "le retour ferme l'activité"
        assert page.locator("#p-rideau").is_visible() and page.locator("#p-rideau .btn-activite").count() == 1, "l'écran de fin reste, l'activité se rouvre"
        page.click("#p-rideau .btn-sun")
        page.wait_for_timeout(2500)
        assert page.get_attribute("#v-enfant", "data-moment") == "nuit", "la nuit est tombée"
        assert page.locator(".tuile").count() == 0
        page.screenshot(path=str(OUT / "tablette-11-nuit.png"))
        # Les statistiques d'usage : notées sur l'appareil, sans nom (sans compte ni Supabase ici, elles attendent)
        file = page.evaluate("JSON.parse(localStorage.getItem('ludiworld.usage'))")
        evts = [e["evt"] for e in file]
        for attendu in ["vue", "jeu_lance", "jeu_fini", "idee_montree", "activite_ouverte", "activite_fermee"]:
            assert attendu in evts, (attendu, evts)
        fin = [e for e in file if e["evt"] == "jeu_fini"][0]
        assert fin["jeu"] == "jeu-kit" and fin["details"]["raison"] == "total" and fin["details"]["minutes"] >= 0, fin
        fermees = [e["details"] for e in file if e["evt"] == "activite_fermee"]
        assert fermees[0] == {"etape": 2, "etapes": 2, "finie": True}, fermees
        assert fermees[1]["finie"] is False, ("le retour du téléphone n'est pas « J'ai fini »", fermees)
        assert all(e["age"] == "8-10" and e["format"] in ("telephone", "tablette", "ordi") and e["langue"] == "fr" for e in file), file[0]
        assert "Petit Loup" not in json.dumps(file) and len({e["appareil"] for e in file}) == 1, "jamais le prénom ; un seul numéro d'appareil"
        # Une fois par jour : rouvert le même jour (ici, plus de temps donné), l'écran de fin ne la redit pas
        page.goto(BASE + "/ludiworld/jeux/index.json")   # l'appli fermée (elle réécrit ses données en partant), même origine
        page.evaluate("""() => { var s = JSON.parse(localStorage.getItem('ludiworld.v1')); var e = s.famille.enfants[0];
          e.regles.ecole = e.regles.libre = 60; e.regles.fini = null; localStorage.setItem('ludiworld.v1', JSON.stringify(s)); }""")
        page.goto(APP)
        page.locator(".tuile", has_text="Jeu kit").click()
        page.frame_locator("#player iframe").locator("#fin").wait_for()
        page.evaluate("ludiDemo.ajouter('jeu-kit', 30)")
        page.wait_for_timeout(1500)
        page.frame_locator("#player iframe").locator("#fin").click()
        page.wait_for_selector("#p-rideau:not([hidden])")
        assert "Bravo" in page.inner_text("#p-rideau"), page.inner_text("#p-rideau")
        assert page.locator("#p-rideau .rideau-apres").count() == 0, "l'idée ne revient pas une deuxième fois le même jour"
        ctx.close()

        # 3 bis. Les mots de la marmotte et l'écran de fin sur les trois formats (captures à regarder) ;
        #        l'idée n'apparaît pas quand seul ce jeu s'arrête (l'enfant peut en choisir un autre)
        trois = dict(formats, ordinateur=dict(viewport={"width": 1440, "height": 900}))
        for name, opts in trois.items():
            ctx = contexte(browser, famille("douce"), **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP)
            page.locator(".tuile", has_text="Jeu kit").click()
            page.frame_locator("#player iframe").locator("#fin").wait_for()
            page.evaluate("ludiDemo.ajouter('jeu-kit', 26)")
            page.wait_for_timeout(1500)
            vw, vh = opts["viewport"]["width"], opts["viewport"]["height"]
            b = page.locator("#p-bandeau").bounding_box()
            assert b["x"] >= 0 and b["x"] + b["width"] <= vw, ("la marmotte tient dans l'écran", name, b)
            assert page.inner_text("#p-bandeau small") == "encore 4\u00a0min", name
            page.screenshot(path=str(OUT / f"{name}-10a-marmotte-bientot.png"))
            page.evaluate("ludiDemo.ajouter('jeu-kit', 5)")
            page.wait_for_timeout(1500)
            assert page.inner_text("#p-bandeau span") == "C’est ta dernière partie.", name
            page.screenshot(path=str(OUT / f"{name}-10b-marmotte-derniere.png"))
            page.frame_locator("#player iframe").locator("#fin").click()
            page.wait_for_selector("#p-rideau .rideau-apres")
            page.wait_for_timeout(2400)
            carte = page.locator("#p-rideau .rideau-carte").bounding_box()
            assert carte["x"] >= 0 and carte["x"] + carte["width"] <= vw and carte["y"] >= 0 and carte["y"] + carte["height"] <= vh, ("l'écran de fin tient", name, carte)
            assert page.evaluate("(() => { var p = document.querySelector('.rideau-apres p'); return p.scrollWidth <= p.clientWidth; })()"), ("la phrase ne déborde pas", name)
            page.screenshot(path=str(OUT / f"{name}-10c-fin-idee.png"))
            page.evaluate("() => { window.speechSynthesis.getVoices = function () { return []; }; }")
            page.click("#p-rideau .btn-activite")
            page.click(".p-activite .act-suivant")
            page.wait_for_function("document.querySelector('.act-schema').naturalWidth > 0")
            assert page.locator(".act-phrase.sans-voix").count() == 1 and page.locator(".act-phrase .ico").count() == 0, ("sans voix sur l'appareil, pas de haut-parleur", name)
            nav = page.locator(".p-activite .act-suivant").bounding_box()
            assert nav["y"] + nav["height"] <= vh, ("le bouton « Suivant » se voit sans défiler", name, nav)
            page.screenshot(path=str(OUT / f"{name}-10f-activite.png"))
            ctx.close()
        ctx = contexte(browser, famille("nette", max_kit=10), **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.locator(".tuile", has_text="Jeu kit").click()
        page.frame_locator("#player iframe").locator("#fin").wait_for()
        page.evaluate("ludiDemo.ajouter('jeu-kit', 10)")
        page.wait_for_selector("#p-rideau:not([hidden])")
        assert page.inner_text("#p-rideau h2") == "Fini pour ce jeu aujourd’hui", page.inner_text("#p-rideau h2")
        assert page.locator("#p-rideau .rideau-apres").count() == 0, "changer de jeu en cours de journée : pas d'idée"
        assert not page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).apresVu"), "rien n'est noté"
        ctx.close()
        # En anglais, sur téléphone
        ctx = contexte(browser, famille("douce"), **formats["telephone"])
        ctx.add_init_script("localStorage.setItem('ludiworld.lang', 'en');")
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.locator(".tuile", has_text="Kit game").click()
        page.frame_locator("#player iframe").locator("#fin").wait_for()
        page.evaluate("ludiDemo.ajouter('jeu-kit', 26)")
        page.wait_for_timeout(1500)
        assert page.inner_text("#p-bandeau b") == "The sun is setting", page.inner_text("#p-bandeau")
        assert page.inner_text("#p-bandeau span") == "It stops at the end of your game." and page.inner_text("#p-bandeau small") == "4\u00a0min left", page.inner_text("#p-bandeau")
        page.screenshot(path=str(OUT / "telephone-10d-marmotte-en.png"))
        page.evaluate("ludiDemo.ajouter('jeu-kit', 5)")
        page.wait_for_timeout(1500)
        assert page.inner_text("#p-bandeau span") == "This is your last game.", page.inner_text("#p-bandeau")
        page.frame_locator("#player iframe").locator("#fin").click()
        page.wait_for_selector("#p-rideau .rideau-apres")
        assert page.inner_text("#p-rideau .rideau-apres p") == "How about drawing a pig in a barn?"
        page.wait_for_timeout(2400)
        page.screenshot(path=str(OUT / "telephone-10e-fin-idee-en.png"))
        ctx.close()

        # Les statistiques d'usage partent sans le compte, jamais pendant une partie ; le parent peut refuser (Réglages)
        nuage = FauxSupabase()
        ctx = contexte(browser, famille("douce"), nuage=nuage, **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.locator(".tuile", has_text="Jeu kit").click()
        page.frame_locator("#player iframe").locator("#b").click()
        page.wait_for_timeout(4500)
        assert not nuage.usage, ("rien ne part pendant une partie", nuage.usage)
        page.click("#player-back")
        page.wait_for_function("JSON.parse(localStorage.getItem('ludiworld.usage') || '[]').length === 0")
        evts = [e["evt"] for e in nuage.usage]
        assert "jeu_lance" in evts and "jeu_fini" in evts, evts
        assert [e for e in nuage.usage if e["evt"] == "jeu_fini"][0]["details"]["raison"] == "sortie", nuage.usage
        assert nuage.usage_avec_compte == 0, "jamais avec le jeton d'un compte"
        page.goto(APP + "#carnet")
        code(page, PIN)
        parent(page)
        onglet(page, "reglages")
        case = page.locator("[data-reglage=statistiques]")
        assert case.is_checked(), "cochées par défaut"
        case.scroll_into_view_if_needed()
        page.screenshot(path=str(OUT / "tablette-reglages-statistiques.png"))
        case.uncheck()
        page.wait_for_timeout(300)
        assert stocke(page)["mesures"] is False, "le refus vaut pour la maison (il suit la copie en ligne)"
        assert page.evaluate("localStorage.getItem('ludiworld.usage') === null && localStorage.getItem('ludiworld.appareil') === null"), "ce qui attendait et le numéro s'effacent"
        page.wait_for_timeout(500)
        refus = [e for e in nuage.usage if e["evt"] == "statistiques_refusees"]
        avant_refus = {e["appareil"] for e in nuage.usage if e["evt"] != "statistiques_refusees"}
        assert len(refus) == 1 and refus[0]["appareil"] not in avant_refus and refus[0]["age"] == "8-10", ("« refusé » part une fois, avec un numéro neuf", refus)
        n = len(nuage.usage)
        page.click("#pa-rendre")
        page.wait_for_selector("#v-enfant:not([hidden])")
        page.locator(".tuile", has_text="Jeu kit").click()
        page.frame_locator("#player iframe").locator("#b").click()
        page.click("#player-back")
        page.wait_for_timeout(600)
        assert page.evaluate("localStorage.getItem('ludiworld.usage')") is None and len(nuage.usage) == n, "refusé : plus rien n'est noté ni envoyé"
        ctx.close()

        # 4. Fin nette : on s'arrête à la minute, sans attendre la manche
        ctx = contexte(browser, famille("nette"), **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
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
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.evaluate("ludiDemo.ajouter('jeu-kit', 10)")
        page.wait_for_timeout(500)
        assert page.locator(".tuile", has_text="Jeu kit").count() == 0, "limite du jeu atteinte : plus une tuile à toucher"
        assert page.locator(".e-repos .e-repos-jeu", has_text="Jeu kit").count() == 1, "il reste visible, petit, après les autres"
        assert page.evaluate("[...document.querySelectorAll('#e-jeux > *')].pop().classList.contains('e-repos')"), "les jeux fermés viennent en dernier"
        assert page.locator(".tuile", has_text="Pluie de Cochons").is_enabled(), "les autres jeux restent ouverts"
        page.wait_for_timeout(2000)
        page.screenshot(path=str(OUT / "telephone-6-limite-jeu.png"))
        ctx.close()

        # 5 bis. Côté enfant, un lundi : sous « Pas aujourd'hui », pourquoi (les jours réglés, « Encore demain ») ; ces jeux ne se touchent pas ;
        #        « Fini » sans pourcentage ; « Parents » ne couvre aucune tuile, en haut comme en bas de la page
        lundi = (7 - datetime.date.today().weekday()) % 7
        for name, opts in formats.items():
            store = famille("nette", max_kit=10, fini_pluie=True)
            store["games"]["pluie-de-cochons"]["etat"]["complet"] = 0.67
            store["famille"]["jeux"]["simon-des-monstres"] = {"max": None, "libres": True}
            store["famille"]["jeux"]["tour-aimants"] = {"max": None}
            ctx = contexte(browser, store, **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.clock.install(time=a(15, 0, jours=lundi))
            page.goto(APP)
            page.wait_for_selector(".tuile")
            page.evaluate("ludiDemo.ajouter('jeu-kit', 10)")
            page.wait_for_selector(".e-repos-fini")
            page.wait_for_timeout(2500)
            assert page.inner_text(".e-repos-titre").strip() == "Pas aujourd’hui"
            assert page.inner_text(".e-repos-libres .e-repos-pourquoi").strip() == "Le mercredi, le samedi et le dimanche", page.inner_text(".e-repos-libres")
            assert page.locator(".e-repos-libres .e-repos-pourquoi svg").count() == 1, "une petite icône"
            assert page.inner_text(".e-repos-fini .e-repos-pourquoi").strip() == "Encore demain", page.inner_text(".e-repos-fini")
            assert page.locator(".e-repos-libres .e-repos-jeu", has_text="Simon").count() == 1 and page.locator(".e-repos-fini .e-repos-jeu", has_text="Jeu kit").count() == 1
            assert page.locator(".tuile", has_text="Simon").count() == 0, "un jeu fermé n'est pas une tuile"
            assert page.evaluate("getComputedStyle(document.querySelector('.e-repos')).pointerEvents") == "none", "rien ne se passe au toucher"
            tuile_pluie = page.locator(".tuile", has_text="Pluie de Cochons")
            assert "Fini" in tuile_pluie.inner_text() and "%" not in tuile_pluie.inner_text(), tuile_pluie.inner_text()
            page.screenshot(path=str(OUT / f"{name}-6b-pas-aujourdhui.png"))
            for haut in [0, 100000]:
                page.evaluate(f"scrollTo(0, {haut})")
                page.wait_for_timeout(200)
                parents_b = page.locator("#e-parents").bounding_box()
                vitrine_b = page.locator("#e-vitrine").bounding_box()
                assert vitrine_b and not croise(parents_b, vitrine_b), ("le bouton de la vitrine, à côté de « Parents »", name)
                for i in range(page.locator(".tuile, .e-repos-jeu, .e-repos-pourquoi").count()):
                    b = page.locator(".tuile, .e-repos-jeu, .e-repos-pourquoi").nth(i).bounding_box()
                    assert not croise(parents_b, b), ("« Parents » couvre une tuile", name, haut, parents_b, b)
                    assert not croise(vitrine_b, b), ("la vitrine couvre une tuile", name, haut, vitrine_b, b)
            page.screenshot(path=str(OUT / f"{name}-6c-bas-de-liste.png"))
            ctx.close()

        # 5 ter. Plus de quatre tuiles sur une tablette en largeur : elles prennent toute la largeur et tout tient sans défiler
        store = famille(fini_pluie=True)
        store["games"]["chasseur-dragons"] = {"ms": 60000, "sessions": 1, "days": {}, "scores": {}, "progress": {}, "etat": {"fini": True}}
        store["games"]["tour-aimants"] = {"ms": 60000, "sessions": 1, "days": {}, "scores": {}, "progress": {}}
        for g in ["chasseur-dragons", "tour-aimants", "du-feu-a-la-fusee", "simon-des-monstres"]:
            store["famille"]["jeux"][g] = {"max": None}
        for name, opts in formats.items():
            ctx = contexte(browser, store, **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP)
            page.wait_for_selector(".tuile")
            page.wait_for_timeout(2500)
            assert page.locator(".tuile").count() == 6
            page.screenshot(path=str(OUT / f"{name}-6d-six-jeux.png"), full_page=True)
            if name == "tablette":
                assert "beaucoup" in page.get_attribute("#v-enfant", "class")
                bas = max(page.locator(".tuile").nth(i).bounding_box()["y"] + page.locator(".tuile").nth(i).bounding_box()["height"] for i in range(6))
                assert bas <= 820, ("tout tient sans défiler", bas)
                assert min(page.locator(".tuile").nth(i).bounding_box()["x"] for i in range(6)) < 300, "les tuiles prennent aussi la moitié gauche"
            ctx.close()

        # 5 quater. Dans un jeu : une maison pour revenir (au moins 44 px, dans le coin) ; la pastille du temps repliée en petit soleil,
        #           dépliée 5 min avant la fin, puis de nouveau repliée
        for name, opts in formats.items():
            ctx = contexte(browser, famille("douce"), **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP)
            page.locator(".tuile", has_text="Jeu kit").click()
            page.wait_for_selector("#p-reste:not([hidden])")
            retour = page.locator("#player-back").bounding_box()
            assert retour["width"] >= 44 and retour["height"] >= 44 and retour["x"] < 30 and retour["y"] < 30, retour
            assert page.get_attribute("#player-back", "aria-label") == "Revenir à Ludiworld"
            pastille = page.locator("#p-reste").bounding_box()
            assert pastille["width"] <= 50 and "ouverte" not in page.get_attribute("#p-reste", "class"), ("repliée", pastille)
            assert not croise(retour, pastille), "la pastille ne couvre pas la maison"
            page.screenshot(path=str(OUT / f"{name}-9d-jeu-pastille-repliee.png"))
            page.evaluate("ludiDemo.ajouter('jeu-kit', 26)")
            page.wait_for_timeout(1500)
            assert "ouverte" in page.get_attribute("#p-reste", "class") and "Encore" in page.inner_text("#p-reste"), "5 min avant : elle se déplie"
            page.screenshot(path=str(OUT / f"{name}-9e-jeu-pastille-depliee.png"))
            b = page.locator("#p-bandeau").bounding_box()
            assert not croise(b, page.locator("#player-back").bounding_box()), "la marmotte ne se pose pas sur la maison"
            page.wait_for_timeout(8500)
            assert "ouverte" not in page.get_attribute("#p-reste", "class"), "puis elle se replie"
            page.click("#p-reste")
            page.wait_for_timeout(600)
            assert "ouverte" in page.get_attribute("#p-reste", "class"), "un toucher la déplie"
            page.click("#player-back")
            page.wait_for_selector("#player", state="hidden")
            ctx.close()
        # Le vrai Simon sur téléphone : la maison ne couvre pas son titre (capture à regarder)
        if GAMES and (GAMES / "simon-des-monstres/index.html").is_file():
            store = famille()
            store["famille"]["jeux"]["simon-des-monstres"] = {"max": None}
            ctx = contexte(browser, store, **formats["telephone"])
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP)
            page.locator(".tuile", has_text="Simon").click()
            page.wait_for_timeout(3500)
            page.screenshot(path=str(OUT / "telephone-9f-simon.png"))
            ctx.close()

        # 5 quinquies. « À deux possible » : sur la mini-fiche et dans la fiche de Simon seulement ; « gratuit pour l'instant » à l'accueil
        ctx = contexte(browser, **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/les-jeux/")
        page.wait_for_selector(".cat-mini[data-jeu=simon-des-monstres]")
        assert "À deux possible" in page.inner_text(".cat-mini[data-jeu=simon-des-monstres] .cat-mini-faits")
        assert page.locator(".cat-mini-faits", has_text="À deux possible").count() == 1, "seulement Simon"
        page.locator(".cat-mini[data-jeu=simon-des-monstres] .cat-mini-ouvrir").click()
        page.wait_for_selector("dialog.cat-fiche[open] .cat-faits")
        assert "À deux possible" in page.inner_text("dialog.cat-fiche .cat-faits")
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "telephone-9g-fiche-a-deux.png"))
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector("#charte")
        assert "Ludiworld est gratuit pour l’instant." in page.inner_text("#charte").replace("'", "’"), "gratuit pour l'instant, près de la charte"
        page.locator("#charte").scroll_into_view_if_needed()
        page.wait_for_timeout(800)
        page.locator("#charte").screenshot(path=str(OUT / "telephone-0-site-charte.png"))
        ctx.close()

        # 6. Heures de jeu : avant l'heure l'île dort ; 3 min avant la fin de la plage, la marmotte prévient
        maintenant = datetime.datetime.now()
        if maintenant.hour < 22:
            store = famille()
            store["famille"]["regles"]["heures"] = {"debut": (maintenant + datetime.timedelta(hours=1)).strftime("%H:%M"), "fin": "23:59"}
            ctx = contexte(browser, store, **formats["tablette"])
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP)
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
            page.goto(APP)
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
        page.goto(APP)
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
        page.goto(APP)
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
        parent(page)
        assert page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.reset") is None
        ctx.close()

        # 8 bis. « Code oublié ? » sur un appareil relié à un compte (plan 3) : le mot de passe du compte, vérifié comme à la connexion.
        #        Faux : un message, rien d'autre ne change. Juste : un nouveau code tout de suite. Hors ligne : l'attente habituelle.
        #        Sans compte (même avec un projet configuré) : comme avant, l'attente de 30 minutes.
        MDP = "un-bon-mot-de-passe"
        for name, opts in formats.items():
            nuage = FauxSupabase()
            nuage.comptes["parent@exemple.test"] = {"id": "u-1", "mdp": MDP, "confirme": True, "synchro": False, "nouvelles": False, "data": {}}
            ctx = contexte(browser, famille(), nuage=nuage, **opts)
            sess = {"jeton": nuage.jeton("parent@exemple.test"), "renouveau": "r", "expire": 4102444800000, "id": "u-1", "email": "parent@exemple.test"}
            ctx.add_init_script("if (!sessionStorage.getItem('seedSession')) { localStorage.setItem('ludiworld.session', %s); sessionStorage.setItem('seedSession', '1'); }" % json.dumps(json.dumps(sess)))
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP)
            page.wait_for_selector(".tuile")
            pin_avant = stocke(page)["pin"]
            page.focus("#e-parents")
            page.keyboard.press("Enter")
            page.wait_for_selector("#gate[open] .pin")
            page.click("#gate .lien")  # Code oublié ?
            page.wait_for_selector("#gate-mdp")
            texte = page.inner_text("#gate")
            assert "Tapez le mot de passe du compte Ludiworld (parent@exemple.test). Vous choisirez ensuite un nouveau code." in texte, texte
            assert "30 minutes" not in texte, "connecté et en ligne : pas d'attente proposée d'office"
            assert page.is_visible("#gate .gate-email") and page.inner_text("#gate .gate-email") == "Je ne connais pas le mot de passe"
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"{name}-13b-code-oublie-mot-de-passe.png"))
            # Mauvais mot de passe
            page.fill("#gate-mdp", "pas-le-bon")
            page.click("#gate .gate-mdp button[type=submit]")
            page.wait_for_function("document.getElementById('gate-mdp-msg').textContent.includes('pas le bon mot de passe')")
            assert page.inner_text("#gate-mdp-msg") == "Ce n’est pas le bon mot de passe.", page.inner_text("#gate-mdp-msg")
            assert page.input_value("#gate-mdp") == "", "le champ est vidé"
            f = stocke(page)
            assert f.get("reset") is None and f["pin"] == pin_avant and not f.get("codeChange"), "un mauvais mot de passe ne change rien"
            assert page.locator(".tuile").count() > 0, "l'enfant joue toujours"
            assert page.is_hidden("#gate .gate-attendre")
            page.screenshot(path=str(OUT / f"{name}-13c-code-oublie-mauvais.png"))
            # Hors ligne : on le dit, et on propose l'attente habituelle (les routes du faux réseau répondent même hors ligne : on les coupe)
            hors_ligne = lambda r: r.abort("internetdisconnected")
            ctx.set_offline(True)
            page.route(nuage.URL + "/**", hors_ligne)
            page.fill("#gate-mdp", MDP)
            page.click("#gate .gate-mdp button[type=submit]")
            page.wait_for_function("document.getElementById('gate-mdp-msg').textContent.includes('Pas de réseau')")
            assert page.inner_text("#gate-mdp-msg") == "Pas de réseau : le mot de passe ne peut pas être vérifié. Réessayez avec le réseau, ou attendez 30 minutes.", page.inner_text("#gate-mdp-msg")
            assert page.is_visible("#gate .gate-attendre") and page.inner_text("#gate .gate-attendre") == "Attendre 30 minutes à la place"
            assert stocke(page).get("reset") is None and stocke(page)["pin"] == pin_avant
            page.screenshot(path=str(OUT / f"{name}-13d-code-oublie-hors-ligne.png"))
            ctx.set_offline(False)
            page.unroute(nuage.URL + "/**", hors_ligne)
            # Bon mot de passe : un nouveau code tout de suite
            page.fill("#gate-mdp", MDP)
            page.click("#gate .gate-mdp button[type=submit]")
            page.wait_for_selector("#gate[open] .pin")
            assert "Nouveau code" in page.inner_text("#gate") and page.locator("#gate-mdp").count() == 0
            code(page, "1357")
            code(page, "1357")
            parent(page)
            f = stocke(page)
            assert f["pin"] != pin_avant and f.get("reset") is None and f.get("codeChange"), "nouveau code posé, noté pour l'autre parent"
            garde = page.evaluate("JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage))")
            assert MDP not in garde and "pas-le-bon" not in garde, "le mot de passe n'est gardé nulle part"
            assert page.evaluate("JSON.parse(localStorage.getItem('ludiworld.session')).id") == "u-1", "la session de l'appareil reste"
            essais = [c for c in nuage.appels if c.startswith("/auth/v1/token?grant_type=password")]
            assert len(essais) == 2, nuage.appels   # le mauvais et le bon (hors ligne, rien n'est parti)
            assert any(c.startswith("/auth/v1/logout") for c in nuage.appels), "la session de la vérification est refermée"
            # Hors ligne dès l'ouverture : on le dit tout de suite, l'attente reste possible ; pendant l'attente, le mot de passe aussi
            page.evaluate("LudiBarre.fermerParent()")
            page.goto(APP + "?a=1#carnet")
            page.wait_for_selector("#gate[open] .pin")
            ctx.set_offline(True)
            page.route(nuage.URL + "/**", hors_ligne)
            page.click("#gate .lien")
            page.wait_for_selector("#gate-mdp")
            assert "Pas de réseau" in page.inner_text("#gate-mdp-msg")
            page.click("#gate .gate-attendre")
            page.wait_for_selector("#gate .btn-sun")
            assert "il faut attendre 30 minutes" in page.inner_text("#gate")
            page.click("#gate .btn-sun")
            page.wait_for_timeout(400)
            assert stocke(page).get("reset"), "l'attente habituelle est lancée"
            assert page.locator(".tuile").count() == 0, "pendant l'attente, on ne joue pas"
            ctx.set_offline(False)
            page.unroute(nuage.URL + "/**", hors_ligne)
            page.evaluate("LudiBarre.fermerParent()")
            page.goto(APP + "?a=2#carnet")
            page.wait_for_selector("#gate[open]")
            assert "Taper plutôt le mot de passe du compte" in page.inner_text("#gate")
            page.locator("#gate .lien", has_text="Taper plutôt").click()
            page.fill("#gate-mdp", MDP)
            page.click("#gate .gate-mdp button[type=submit]")
            page.wait_for_selector("#gate[open] .pin")
            code(page, "2468")
            code(page, "2468")
            parent(page)
            assert stocke(page).get("reset") is None, "le mot de passe met fin à l'attente"
            ctx.close()

        # 8 ter. « Je ne connais pas le mot de passe » : un code à 6 chiffres par e-mail à l'adresse du compte, montrée masquée.
        #        Mauvais code : un message, on retape. « Renvoyer » attend 60 s. Trop d'envois : un message. Bon code : un nouveau code parent.
        #        Rien n'est gardé sur l'appareil.
        for name, opts in formats.items():
            nuage = FauxSupabase()
            nuage.comptes["parent@exemple.test"] = {"id": "u-1", "mdp": MDP, "confirme": True, "synchro": False, "nouvelles": False, "data": {}}
            ctx = contexte(browser, famille(), nuage=nuage, **opts)
            ctx.clock.install()
            sess = {"jeton": nuage.jeton("parent@exemple.test"), "renouveau": "r", "expire": 4102444800000, "id": "u-1", "email": "parent@exemple.test"}
            ctx.add_init_script("if (!sessionStorage.getItem('seedSession')) { localStorage.setItem('ludiworld.session', %s); sessionStorage.setItem('seedSession', '1'); }" % json.dumps(json.dumps(sess)))
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(APP)
            page.wait_for_selector(".tuile")
            pin_avant = stocke(page)["pin"]
            session_avant = page.evaluate("localStorage.getItem('ludiworld.session')")
            page.focus("#e-parents")
            page.keyboard.press("Enter")
            page.wait_for_selector("#gate[open] .pin")
            page.click("#gate .lien")  # Code oublié ?
            page.wait_for_selector("#gate-mdp")
            page.click("#gate .gate-email")
            page.wait_for_function("document.querySelector('#gate .gate-envoi') && document.querySelector('#gate .gate-envoi').textContent.includes('Code envoyé')")
            assert page.inner_text("#gate .gate-envoi") == "Code envoyé à p•••@exemple.test.", page.inner_text("#gate .gate-envoi")
            assert "parent@exemple.test" not in page.inner_text("#gate"), "l'adresse est masquée"
            assert nuage.otp_demandes == [{"email": "parent@exemple.test", "create_user": False}], nuage.otp_demandes
            assert page.get_attribute("#gate-otp", "inputmode") == "numeric" and page.get_attribute("#gate-otp", "autocomplete") == "one-time-code"
            assert "Code à 6 chiffres" in page.inner_text("#gate")
            assert page.is_disabled("#gate .gate-renvoyer") and page.inner_text("#gate .gate-renvoyer").startswith("Renvoyer (")
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"{name}-13f-code-email.png"))
            # Mauvais code : un message court, on retape ; rien ne change
            page.fill("#gate-otp", "000000")
            page.click("#gate .gate-mdp button[type=submit]")
            page.wait_for_function("document.getElementById('gate-otp-msg').textContent.includes('ne marche pas')")
            assert page.inner_text("#gate-otp-msg") == "Ce code ne marche pas.", page.inner_text("#gate-otp-msg")
            assert page.input_value("#gate-otp") == "", "le champ est vidé"
            f = stocke(page)
            assert f.get("reset") is None and f["pin"] == pin_avant and not f.get("codeChange"), "un mauvais code ne change rien"
            assert page.is_hidden("#gate .gate-attendre")
            page.screenshot(path=str(OUT / f"{name}-13g-code-email-mauvais.png"))
            # Renvoyer, après 60 s : un nouveau code remplace l'ancien
            premier = nuage.otp["parent@exemple.test"]
            page.clock.fast_forward(61000)
            page.wait_for_function("!document.querySelector('#gate .gate-renvoyer').disabled")
            assert page.inner_text("#gate .gate-renvoyer") == "Renvoyer"
            page.click("#gate .gate-renvoyer")
            page.wait_for_function("document.querySelector('#gate .gate-renvoyer').disabled")
            assert len(nuage.otp_demandes) == 2 and nuage.otp["parent@exemple.test"] != premier
            page.fill("#gate-otp", premier)
            page.click("#gate .gate-mdp button[type=submit]")
            page.wait_for_function("document.getElementById('gate-otp-msg').textContent.includes('ne marche pas')")
            # Trop d'envois : un message court, l'attente de 30 minutes proposée
            nuage.otp_limite = True
            page.clock.fast_forward(61000)
            page.wait_for_function("!document.querySelector('#gate .gate-renvoyer').disabled")
            page.click("#gate .gate-renvoyer")
            page.wait_for_function("document.getElementById('gate-otp-msg').textContent.includes('Trop de demandes')")
            assert page.inner_text("#gate-otp-msg") == "Trop de demandes. Réessayez dans un moment.", page.inner_text("#gate-otp-msg")
            assert page.is_visible("#gate .gate-attendre")
            page.screenshot(path=str(OUT / f"{name}-13h-code-email-trop.png"))
            nuage.otp_limite = False
            # Bon code (le dernier envoyé) : un nouveau code parent tout de suite
            bon = nuage.otp["parent@exemple.test"]
            page.fill("#gate-otp", bon)
            page.click("#gate .gate-mdp button[type=submit]")
            page.wait_for_selector("#gate[open] .pin")
            assert "Nouveau code" in page.inner_text("#gate") and page.locator("#gate-otp").count() == 0
            code(page, "1357")
            code(page, "1357")
            parent(page)
            f = stocke(page)
            assert f["pin"] != pin_avant and f.get("reset") is None and f.get("codeChange"), "nouveau code posé, noté pour l'autre parent"
            garde = page.evaluate("JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage))")
            for c in (premier, bon, "000000"):
                assert c not in garde, "aucun code reçu n'est gardé : " + c
            assert page.evaluate("localStorage.getItem('ludiworld.session')") == session_avant, "la session de l'appareil ne change pas"
            verifs = [i for i, c in enumerate(nuage.appels) if c.startswith("/auth/v1/verify")]
            assert len(verifs) == 3, nuage.appels  # 000000, l'ancien code, le bon
            assert nuage.appels[verifs[-1] + 1].startswith("/auth/v1/logout"), "la session de la vérification est refermée tout de suite"
            assert not any(c.startswith("/auth/v1/token") for c in nuage.appels), "aucun mot de passe demandé"
            ctx.close()

        # Un projet configuré mais pas de compte sur cet appareil : comme avant
        nuage = FauxSupabase()
        ctx = contexte(browser, famille(), nuage=nuage, **formats["telephone"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        page.wait_for_selector("#gate[open] .pin")
        page.click("#gate .lien")
        page.wait_for_selector("#gate .btn-sun")
        assert page.locator("#gate-mdp").count() == 0 and "il faut attendre 30 minutes" in page.inner_text("#gate")
        page.screenshot(path=str(OUT / "telephone-13e-code-oublie-sans-compte.png"))
        page.locator("#gate .lien", has_text="Annuler").click()
        page.goto(APP + "#reglages")
        page.wait_for_selector("#gate[open]")
        code(page, PIN)
        parent(page)
        onglet(page, "reglages")
        assert not any(c.startswith("/auth/") for c in nuage.appels), "sans compte, aucun appel"
        ctx.close()

        # 9. Deux enfants : chacun son temps ; regarder un enfant ne lui donne pas l'appareil ; on choisit à qui le rendre ;
        #    « Pas toi ? » montre les prénoms, puis le code
        ctx = contexte(browser, famille(), **formats["tablette"])
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(APP)
        page.wait_for_selector(".tuile")
        page.evaluate("ludiDemo.ajouter('jeu-kit', 20)")  # Petit Loup a déjà joué 20 min
        page.focus("#e-parents")
        page.keyboard.press("Enter")
        code(page, PIN)
        parent(page)
        onglet(page, "reglages")
        page.click("text=Ajouter un enfant")
        page.fill("#s-nouveau", "Inès")
        page.locator(".pa-ajout").get_by_role("radio", name="7").click()
        page.locator(".pa-ajout button", has_text="Ajouter").click()
        page.wait_for_selector(".pa-tous-grille")
        assert page.get_attribute("[data-onglet=catalogue]", "aria-selected") == "true", "on arrive sur « Tous les jeux », pour le nouvel enfant"
        assert "Pour Inès" in page.inner_text("#pa-page") and page.locator(".pa-etat-installe").count() == 0, "aucun jeu d'office"
        page.locator("[data-installer=jeu-kit]").click()
        page.wait_for_timeout(200)
        assert "Changé pour Inès" in page.inner_text("#pa-journal"), "avec plusieurs enfants, la ligne nomme l'enfant"
        onglet(page, "jeux")
        assert "Les jeux d’Inès (1)" in page.inner_text("#pa-page"), "« d’Inès »"
        page.screenshot(path=str(OUT / "tablette-14-deux-enfants.png"))
        fam = stocke(page)
        assert len(fam["enfants"]) == 2 and fam["actif"] == fam["enfants"][0]["id"], "regarder Inès ne lui donne pas l'appareil"
        assert page.locator("#pa-enfants button").count() == 2
        page.click("#pa-rendre")
        page.wait_for_selector("#qui[open]")
        page.screenshot(path=str(OUT / "tablette-15-rendre-a-qui.png"))
        page.locator(".qui-enfant", has_text="Inès").click()
        page.wait_for_selector(".tuile")
        assert page.inner_text("#e-salut").startswith("Salut Inès"), page.inner_text("#e-salut")
        assert "30" in page.inner_text("#e-temps"), "Inès a tout son temps : " + page.inner_text("#e-temps")
        page.click("#e-qui")
        page.wait_for_selector("#qui[open]")
        assert "code" in page.inner_text("#qui .qui-note"), "on dit qu'un parent doit taper le code"
        page.screenshot(path=str(OUT / "tablette-15b-pas-toi.png"))
        page.locator(".qui-enfant", has_text="Petit Loup").click()
        page.wait_for_selector("#gate[open]")
        assert "Petit Loup" in page.inner_text("#gate")
        code(page, PIN)
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
            page.goto(APP)
            page.locator(".tuile", has_text="Le Monde à la craie").click()
            page.wait_for_function("document.querySelector('#player iframe')?.contentWindow?.jeu?.pret", timeout=15000)
            cadre = next(fr for fr in page.frames if "/ludigames/monde-a-la-craie/" in fr.url)
            assert cadre.evaluate("Ludi.inLauncher()"), "le kit sait qu'il est dans Ludiworld"
            cadre.wait_for_function("jeu.app.joueur === 'Petit Loup'", timeout=3000)
            page.screenshot(path=str(OUT / "tablette-16-monde-a-la-craie.png"))
            page.wait_for_timeout(600)
            if cadre.locator(".cine [data-action=passer]").count():   # l'introduction du jeu (une histoire) : on la passe
                cadre.click(".cine [data-action=passer]")
                cadre.click(".cine [data-action=go]")
                cadre.wait_for_selector(".cine", state="detached")
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
        page.goto(BASE + "/ludiworld/")
        page.wait_for_selector(".lw-action")
        assert page.locator(".lw-compte").count() == 0, "pas de lien de compte sans projet"
        assert page.get_attribute(".lw-action", "href").endswith("app/#demarrer")
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
            page.goto(BASE + "/ludiworld/")
            page.wait_for_selector(".lw-compte")
            assert page.inner_text(".lw-compte") == "Se connecter"
            assert page.inner_text(".lw-action").strip() == "Essayer", "pas de « gratuitement » : ça laisserait croire que c'est payant ensuite"
            assert page.get_attribute(".hero-copy .btn-sun", "href").endswith("app/#demarrer"), "« Essayer » mène droit à la préparation"
            assert page.get_attribute(".lw-action", "href").endswith("app/#demarrer")
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT / f"{name}-20-barre-comme-calm.png"))
            boite = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            assert boite[0] <= boite[1], ("la barre déborde", name, boite)
            page.goto(BASE + "/ludiworld/compte/#essayer")
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
            assert page.get_attribute("[data-vue=verifier] .btn-sun", "href") == "../app/#demarrer", "on peut préparer la tablette sans attendre"
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
            assert page.locator(".lw-compte").count() == 0 and page.locator(".lw-qui .lw-pastille").get_attribute("aria-label") == f"Connecté : parent-{name}"
            page.wait_for_function("document.getElementById('e-formule').textContent.includes('Gratuit')")
            assert page.is_hidden("#e-bureau-p"), "un parent ne voit pas le lien du bureau"
            page.wait_for_function("document.getElementById('e-synchro').checked")
            assert page.is_checked("#e-synchro"), "la création du compte annonce et active la synchronisation"
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"{name}-27-espace.png"), full_page=True)
            page.locator(".lw-langs button", has_text="EN").click()
            assert page.inner_text("#e-corps h1") == "My account"
            assert "free" in page.inner_text("#e-formule").lower()
            page.locator(".lw-langs button", has_text="FR").click()
            ctx.close()

        # 12 bis. Connecté, ça se voit (Julien, 2026-11-18) : une pastille (initiale, « Connecté », le début de l'adresse) à la place
        #         de « Mon compte », la même sur le site et côté parent ; son menu : Ouvrir l'appli (sur le site) ou Le site Ludiworld
        #         (dans l'appli), Mon compte, Se déconnecter. Pas connecté : « Se connecter ». Sur le site, le bouton de droite : « Ouvrir l'appli ».
        for name, opts in formats.items():
            nuage = FauxSupabase()
            nuage.comptes["camille.dupont@exemple.test"] = {"id": "u-7", "mdp": "un-bon-mot-de-passe", "confirme": True, "synchro": False, "nouvelles": False, "data": {}}
            sess = {"jeton": nuage.jeton("camille.dupont@exemple.test"), "renouveau": "r", "expire": 4102444800000, "id": "u-7", "email": "camille.dupont@exemple.test"}
            ctx = contexte(browser, famille(), nuage=nuage, **opts)
            page = ctx.new_page()
            page.on("pageerror", lambda e: errors.append(str(e)))
            # Pas connecté, appareil préparé
            page.goto(BASE + "/ludiworld/")
            page.wait_for_selector(".lw-compte")
            assert page.locator(".lw-qui").count() == 0, "pas de pastille sans compte ouvert"
            assert page.inner_text(".lw-compte") == "Se connecter"
            assert page.inner_text(".lw-action").strip() == "Ouvrir l’appli" and page.get_attribute(".lw-action", "href") == "app/#carnet"
            page.wait_for_timeout(1500)
            page.screenshot(path=str(OUT / f"{name}-20b-barre-pas-connecte.png"))
            # Connecté
            page.evaluate("localStorage.setItem('ludiworld.session', %s)" % json.dumps(json.dumps(sess)))
            page.reload()
            page.wait_for_selector(".lw-qui .lw-pastille")
            assert page.locator(".lw-compte").count() == 0, "plus de « Mon compte » ni de « Se connecter »"
            pas = page.locator(".lw-pastille")
            assert pas.get_attribute("aria-label") == "Connecté : camille.dupont" and pas.get_attribute("aria-expanded") == "false"
            assert page.inner_text(".lw-rond").strip() == "C"
            assert page.locator(".lw-rond .lw-coche").count() == 1, "une coche, pas seulement une couleur"
            if name == "tablette":
                assert page.locator(".lw-qui-txt").is_visible() and page.inner_text(".lw-qui-txt").split() == ["Connecté", "camille.dupont"]
            else:
                assert not page.locator(".lw-qui-txt").is_visible(), "sur téléphone, l'initiale seule"
            assert page.inner_text(".lw-action").strip() == "Ouvrir l’appli"
            boite = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            assert boite[0] <= boite[1], ("la barre déborde", name, boite)
            assert page.locator(".lw-barre .lw-cote").bounding_box()["y"] < 40, "la pastille tient dans la ligne du haut"
            page.wait_for_timeout(1000)
            page.screenshot(path=str(OUT / f"{name}-20c-barre-connecte.png"))
            # Le menu : au toucher, trois choix ; il ne déborde pas ; Échap le ferme et rend le focus ; un toucher ailleurs aussi
            pas.click()
            page.wait_for_selector(".lw-qui-menu:not([hidden])")
            assert pas.get_attribute("aria-expanded") == "true"
            assert "camille.dupont@exemple.test" in page.inner_text(".lw-qui-tete")
            items = page.locator(".lw-qui-menu .lw-qui-item")
            assert [t.strip() for t in items.all_inner_texts()] == ["Ouvrir l’appli", "Mon compte", "Se déconnecter"], items.all_inner_texts()
            assert items.nth(0).get_attribute("href") == "app/#carnet" and items.nth(1).get_attribute("href") == "compte/#espace"
            m = page.locator(".lw-qui-menu").bounding_box()
            largeur = page.evaluate("innerWidth")
            assert m["x"] >= 0 and m["x"] + m["width"] <= largeur, ("le menu déborde", name, m, largeur)
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"{name}-20d-menu-du-compte.png"))
            page.keyboard.press("Escape")
            assert page.locator(".lw-qui-menu[hidden]").count() == 1
            assert page.evaluate("document.activeElement.classList.contains('lw-pastille')"), "le focus revient à la pastille"
            page.keyboard.press("Enter")
            page.wait_for_selector(".lw-qui-menu:not([hidden])")
            page.keyboard.press("Tab")
            assert page.evaluate("document.activeElement.textContent") == "Ouvrir l’appli", "au clavier, on entre dans le menu"
            page.evaluate("document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))")
            assert page.locator(".lw-qui-menu[hidden]").count() == 1, "un toucher ailleurs le ferme"
            # « Mon compte » mène à l'espace du compte
            pas.click()
            page.locator(".lw-qui-menu .lw-qui-item", has_text="Mon compte").click()
            page.wait_for_selector("#e-corps:not([hidden]), #e-code:not([hidden])")
            assert page.url.endswith("/compte/#espace"), page.url
            # Côté parent : la même pastille, au même endroit ; « Mon Ludiworld » y est la page en cours
            page.goto(APP + "#carnet")
            page.wait_for_selector("#gate[open], #v-parent:not([hidden])")
            if page.locator("#gate[open]").count():
                code(page, PIN)
            parent(page)
            page.wait_for_selector("#v-parent .lw-qui .lw-pastille")
            assert page.locator("#v-parent .pa-barre .lw-compte").count() == 0 and page.locator("#pa-qui .lw-qui-txt").is_visible(), "connecté : la pastille entière, « Connecté » et le nom"
            boite = page.evaluate("[document.documentElement.scrollWidth, innerWidth]")
            assert boite[0] <= boite[1], ("la barre déborde côté parent", name, boite)
            page.wait_for_timeout(600)
            page.screenshot(path=str(OUT / f"{name}-20e-parent-connecte.png"))
            page.click("#v-parent .lw-pastille")
            page.wait_for_selector("#v-parent .lw-qui-menu:not([hidden])")
            assert page.inner_text("#v-parent .lw-qui-item >> nth=0").strip() == "Le site Ludiworld" and page.get_attribute("#v-parent .lw-qui-item >> nth=0", "href") == "./"
            m = page.locator("#v-parent .lw-qui-menu").bounding_box()
            assert m["x"] >= 0 and m["x"] + m["width"] <= page.evaluate("innerWidth"), ("le menu déborde côté parent", name, m)
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"{name}-20f-parent-menu-du-compte.png"))
            # « Se déconnecter » : la session est fermée chez Supabase et oubliée ici ; retour à l'accueil du site.
            # Tablette : depuis le côté parent (client du compte chargé) ; téléphone : depuis une page qui ne le charge pas.
            if name == "telephone":
                page.keyboard.press("Escape")
                page.goto(BASE + "/ludiworld/aime-bien/")
                page.wait_for_selector(".lw-qui .lw-pastille")
                page.click(".lw-pastille")
            page.locator(".lw-qui-menu:visible .lw-sortir").click()
            page.wait_for_url(BASE + "/ludiworld/")
            page.wait_for_selector(".lw-compte")
            assert page.evaluate("localStorage.getItem('ludiworld.session')") is None
            assert any(c.startswith("/auth/v1/logout") for c in nuage.appels), "la session est fermée chez Supabase"
            assert page.locator(".lw-qui").count() == 0 and page.inner_text(".lw-compte") == "Se connecter"
            assert page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.pin") is not None, "l'appareil garde ce qui est à lui"
            page.screenshot(path=str(OUT / f"{name}-20g-deconnecte.png"))
            ctx.close()
        # Connecté sur un appareil pas encore préparé : « Mon Ludiworld » ouvre l'appli (la préparation)
        nuage = FauxSupabase()
        nuage.comptes["camille.dupont@exemple.test"] = {"id": "u-7", "mdp": "x", "confirme": True, "synchro": False, "nouvelles": False, "data": {}}
        sess = {"jeton": nuage.jeton("camille.dupont@exemple.test"), "renouveau": "r", "expire": 4102444800000, "id": "u-7", "email": "camille.dupont@exemple.test"}
        ctx = contexte(browser, nuage=nuage, **formats["tablette"])
        ctx.add_init_script("localStorage.setItem('ludiworld.session', %s);" % json.dumps(json.dumps(sess)))
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(BASE + "/ludiworld/les-jeux/")
        page.wait_for_selector(".lw-qui .lw-pastille")
        assert page.inner_text(".lw-action").strip() == "Ouvrir l’appli" and page.get_attribute(".lw-action", "href") == "../app/"
        page.click(".lw-pastille")
        assert page.get_attribute(".lw-qui-item >> nth=0", "href") == "../app/"
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
        # « Se connecter » mène dans l'appli : sur un appareil préparé, le côté parent, derrière le code
        page.wait_for_selector("#gate[open]")
        assert "/ludiworld/app/" in page.url, page.url
        assert nuage.foyer is None, "rien ne part sans geste du parent"
        code(page, PIN)
        parent(page)
        onglet(page, "reglages")
        assert "copie en ligne désactivée" in page.inner_text(".pa-etat-compte"), "connecté sans copie : l'état est vrai (" + page.inner_text(".pa-etat-compte") + ")"
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
        pg.goto(APP + "#enfant")
        pg.wait_for_selector(".tuile")
        pg.goto(BASE + "/ludiworld/compte/#access_token=" + nuage.jeton("pirate@exemple.test") + "&refresh_token=r&expires_in=3600&type=signup")
        pg.wait_for_selector("#e-code:not([hidden])")
        assert pg.evaluate("localStorage.getItem('ludiworld.synchro')") is None, "un lien ne relie pas l'appareil"
        pg.goto(APP + "#enfant")
        pg.wait_for_selector(".tuile")
        pg.wait_for_timeout(1800)
        assert nuage.version == version, "rien ne part vers le compte du lien"
        # Sur cette tablette, un enfant ne change pas le mot de passe, même compte ouvert
        pg.goto(BASE + "/ludiworld/compte/#nouveau")
        pg.wait_for_selector("#e-code:not([hidden])")
        assert pg.is_hidden("#f-nouveau")
        piege.close()

        # Une tablette préparée : le mot de passe autorise la liaison, mais il faut encore le code parent
        autre = contexte(browser, store=famille(), nuage=nuage, **formats["tablette"])
        pg = autre.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(APP + "#enfant")
        pg.wait_for_selector(".tuile")
        pg.goto(BASE + "/ludiworld/compte/#connexion")
        pg.wait_for_selector("#f-connexion")
        pg.fill("#s-email", "parent@exemple.test")
        pg.fill("#s-mdp", "un-bon-mot-de-passe")
        pg.click("#f-connexion button[type=submit]")
        pg.wait_for_selector("#gate[open]")
        assert nuage.version == version and pg.evaluate("localStorage.getItem('ludiworld.synchro')") is None
        code(pg, PIN)
        pg.wait_for_function("localStorage.getItem('ludiworld.synchro') !== null")
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
        tel.wait_for_selector("#gate[open]")   # dans l'appli, côté parent, derrière le code de la famille
        assert "/ludiworld/app/" in tel.url, tel.url
        fam = tel.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille")
        assert fam["enfants"][0]["enfant"]["nom"] == "Petit Loup", fam
        # Le parent règle depuis son téléphone
        code(tel, PIN)
        parent(tel)
        onglet(tel, "reglages")
        assert "copie en ligne active" in tel.inner_text(".pa-etat-compte"), tel.inner_text(".pa-etat-compte")
        tel.fill("#s-nom", "Grand Loup")
        tel.locator("#s-nom").blur()
        tel.wait_for_selector("#pa-journal .pa-journal-annuler")
        for _ in range(40):
            if nuage.foyer["enfants"][0]["enfant"]["nom"] == "Grand Loup":
                break
            tel.wait_for_timeout(100)
        assert nuage.foyer["enfants"][0]["enfant"]["nom"] == "Grand Loup", "le réglage part en ligne"
        # La tablette le voit en revenant sur l'appli
        page.goto(APP + "#enfant")
        page.wait_for_selector(".tuile")
        page.wait_for_function("document.getElementById('e-salut').textContent.includes('Grand Loup')")
        # Pendant une partie, rien ne part : on attend la fin
        avant = len(nuage.appels)
        page.evaluate("ludiDemo.ajouter('pluie-de-cochons', 2)")
        page.wait_for_timeout(200)
        assert len(nuage.appels) == avant, "le temps de jeu ne déclenche pas d'appel réseau à chaque seconde"

        # Limite atteinte : la tablette envoie sans cliquer sur le bouton de l'écran d'arrêt.
        onglet(tel, "temps")
        page.locator(".tuile", has_text="Jeu kit").click()
        page.frame_locator("#player iframe").locator("#b").click()
        page.evaluate("ludiDemo.ajouter('jeu-kit', 31)")
        page.frame_locator("#player iframe").locator("#fin").click()
        page.wait_for_selector("#p-rideau:not([hidden])")
        for _ in range(50):
            jeu = nuage.foyer["enfants"][0].get("games", {}).get("jeu-kit", {})
            if jeu.get("ms", 0) >= 31 * 60000:
                break
            page.wait_for_timeout(100)
        assert jeu.get("ms", 0) >= 31 * 60000, "l'écran d'arrêt synchronise sans geste supplémentaire"

        # Le carnet du téléphone est déjà ouvert : une réception met à jour le graphique.
        tel.evaluate("window.dispatchEvent(new Event('online'))")
        tel.wait_for_function("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['jeu-kit']?.ms >= 31 * 60000")
        tel.wait_for_function("parseInt(document.querySelector('.semaine .jour.auj .jour-val').textContent) >= 31")
        tel.screenshot(path=str(OUT / "telephone-synchro-resultats.png"), full_page=True)

        # Désactiver sur le téléphone : la tablette conserve ses données sans recréer la copie en ligne.
        tel.goto(BASE + "/ludiworld/compte/#espace")
        tel.wait_for_selector("#e-corps:not([hidden])")
        tel.wait_for_function("!document.getElementById('e-synchro').disabled")
        assert tel.is_visible("#e-synchro-aide") and "téléphone" in tel.inner_text("#e-synchro-aide") and "ordinateur" in tel.inner_text("#e-synchro-aide")
        tel.locator(".lw-langs button", has_text="EN").click()
        assert "phone" in tel.inner_text("#e-synchro-aide") and "computer" in tel.inner_text("#e-synchro-aide")
        tel.locator(".lw-langs button", has_text="FR").click()
        tel.wait_for_function("!document.getElementById('e-synchro').disabled")
        tel.uncheck("#e-synchro")
        tel.wait_for_function("document.getElementById('e-synchro-etat').textContent.includes('désactivée')")
        assert tel.is_hidden("#e-synchro-aide"), "« Si vous la désactivez… » ne se dit pas quand elle l'est déjà"
        texte_compte = tel.inner_text("#espace")
        assert "ynchronis" not in texte_compte and "Explorer" not in texte_compte, "un seul mot : copie en ligne"
        tel.screenshot(path=str(OUT / "telephone-synchro-desactivee-fr.png"), full_page=True)
        tel.locator(".lw-langs button", has_text="EN").click()
        tel.screenshot(path=str(OUT / "telephone-synchro-desactivee-en.png"), full_page=True)
        tel.locator(".lw-langs button", has_text="FR").click()
        page.evaluate("window.dispatchEvent(new Event('online'))")
        page.wait_for_function("JSON.parse(localStorage.getItem('ludiworld.synchro')).active === false")
        assert nuage.foyer is None, "la tablette ne recrée pas une copie désactivée depuis le téléphone"
        assert page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['jeu-kit'].ms") >= 31 * 60000
        tel.wait_for_function("!document.getElementById('e-synchro').disabled")
        tel.check("#e-synchro")
        tel.wait_for_function("document.getElementById('e-synchro-etat').textContent.includes('Copie en ligne active')")
        page.evaluate("window.dispatchEvent(new Event('online'))")
        page.wait_for_function("JSON.parse(localStorage.getItem('ludiworld.synchro')).active === true")
        assert nuage.foyer["enfants"][0]["games"]["jeu-kit"]["ms"] >= 31 * 60000, "réactiver reprend la synchro sans reperdre les résultats"

        # 13 bis. Plan 5, les avis de parents (refaits le 2026-11-18 : étoiles et « Le jeu marche bien chez vous ? »).
        # Le téléphone est connecté. Plus de temps de jeu minimum : Pluie de Cochons, 2 min de jeu, a aussi le bloc.
        nuage.semer_avis()
        tel.goto(APP + "#carnet")
        tel.wait_for_selector("#gate[open], #v-parent:not([hidden])")
        if tel.locator("#gate[open]").count():
            code(tel, PIN)
        parent(tel)
        onglet(tel, "jeux")
        # Connecté : le bloc est là, même après 2 minutes de jeu ; moins de 5 avis : rien de l'avis des parents (pas même le nombre)
        tel.click(".pa-ligne[data-jeu=pluie-de-cochons] .pa-ligne-jeu")
        tel.wait_for_selector(".cat-fiche[open] .pa-pour")
        tel.wait_for_timeout(400)
        tel.wait_for_selector(".cat-fiche .pa-avis")
        assert tel.locator(".cat-fiche .pa-avis").count() == 1, "connecté : « Votre avis », quel que soit le temps de jeu"
        assert tel.locator(".cat-fiche .cat-avis:not([hidden])").count() == 0, "moins de 5 avis : rien n'est montré"
        assert "sous le seuil" not in tel.inner_text(".cat-fiche"), "un mot accepté ne se montre pas sous 5 avis"
        tel.click(".cat-fermer")
        # Jeu kit : l'avis des parents : 11 avis, 48 étoiles (4,4), un parent chez qui le jeu ne marche pas,
        # sans lui 47 étoiles sur 10 (4,7)
        tel.click(".pa-ligne[data-jeu=jeu-kit] .pa-ligne-jeu")
        tel.wait_for_selector(".cat-fiche[open] .pa-avis")
        tel.wait_for_selector(".cat-fiche .cat-avis:not([hidden])")
        pub = tel.inner_text(".cat-fiche .cat-avis").replace(" ", " ")
        assert "4,4" in pub and "11 avis" in pub, pub
        assert "1 parent dit que le jeu ne marche pas bien chez lui. Sans lui : 4,7." in pub, pub
        assert tel.get_attribute(".cat-fiche .cat-etoiles", "aria-label") == "4,4 sur 5"
        assert tel.locator(".cat-fiche .cat-etoiles-vides .cat-svg").count() == 5 and tel.locator(".cat-fiche .cat-etoiles-pleines .cat-svg").count() == 5
        assert tel.evaluate("document.querySelector('.cat-fiche .cat-etoiles-pleines').style.width") == "88%", "les étoiles remplies jusqu'à 4,4"
        assert "Mes deux filles y jouent ensemble" in pub and "Un mot à relire" not in pub, "seuls les mots acceptés se lisent"
        for vieux in ["fiche dit vrai", "retourne", "disent que le jeu marche bien"]:
            assert vieux not in pub, (vieux, pub)
        av = tel.inner_text(".cat-fiche .pa-avis").replace(" ", " ")
        for q in ["Votre avis", "Le jeu marche bien chez vous ?", "Oui", "Pas toujours", "Non", "Lu par Julien avant d’être montré"]:
            assert q in av, (q, av)
        for vieux in ["La fiche dit vrai", "y retourne", "Dites quoi", "appris"]:
            assert vieux not in av, (vieux, av)
        assert tel.locator(".pa-avis button[type=submit]").count() == 1, "un seul bouton d'envoi"
        assert tel.locator(".pa-avis .pa-etoile").count() == 5 and tel.locator(".pa-avis .pa-etoile.plein").count() == 0
        assert [tel.get_attribute(f".pa-etoile:nth-child({n}) input", "aria-label") for n in (1, 3)] == ["1 étoile", "3 étoiles"]
        assert tel.get_attribute(".pa-avis-q[data-q=etoiles] input", "type") == "radio", "des boutons radio : le clavier et les lecteurs d'écran les connaissent"
        bo = tel.locator(".pa-avis .pa-etoile").first.bounding_box()
        assert bo["width"] >= 44 and bo["height"] >= 44, ("étoiles assez grandes pour un doigt", bo)
        tel.locator(".pa-avis").scroll_into_view_if_needed()
        tel.wait_for_timeout(300)
        tel.screenshot(path=str(OUT / "telephone-40-votre-avis.png"))
        # Rien ne part sans les étoiles et la réponse
        tel.click(".pa-avis-envoyer")
        tel.wait_for_function("document.querySelector('.pa-avis-statut').textContent === 'Choisissez les étoiles et une réponse.'")
        tel.click(".pa-etoile:nth-child(2)")
        assert tel.locator(".pa-avis .pa-etoile.plein").count() == 2
        tel.click(".pa-avis-envoyer")
        tel.wait_for_function("document.querySelector('.pa-avis-statut').textContent.includes('Choisissez')")
        assert ("parent@exemple.test", "jeu-kit") not in nuage.avis, "rien ne part sans les étoiles et la réponse"
        # Au clavier : les flèches changent la note
        tel.focus(".pa-etoile:nth-child(2) input")
        tel.keyboard.press("ArrowRight")
        tel.keyboard.press("ArrowRight")
        assert tel.locator(".pa-avis .pa-etoile.plein").count() == 4, "au clavier, 4 étoiles"
        assert tel.is_checked(".pa-etoile:nth-child(4) input")
        tel.click(".pa-avis-q[data-q=marche] .pa-avis-pastille:has(input[value=pas-toujours])")
        tel.fill(".pa-avis-champ textarea[id$=-mot]", "On y joue le soir, à deux.")
        tel.locator(".pa-avis").scroll_into_view_if_needed()
        tel.screenshot(path=str(OUT / "telephone-40b-votre-avis-rempli.png"))
        tel.click(".pa-avis-envoyer")
        tel.wait_for_function("document.querySelector('.pa-avis-statut').textContent.includes('Merci')")
        mien = nuage.avis[("parent@exemple.test", "jeu-kit")]
        assert (mien["etoiles"], mien["marche"], mien["mot"], mien["mot_etat"]) == (4, "pas-toujours", "On y joue le soir, à deux.", "a-relire"), mien
        assert not any(k in mien for k in ("fiche", "fiche_quoi", "retourne")), mien
        # 12 avis, 52 étoiles (4,3) ; 2 parents chez qui le jeu ne marche pas bien ; sans eux, toujours 4,7
        tel.wait_for_function("document.querySelector('.cat-fiche .cat-avis').textContent.includes('12 avis')")
        pub = tel.inner_text(".cat-fiche .cat-avis").replace(" ", " ")
        assert "4,3" in pub and "2 parents disent que le jeu ne marche pas bien chez eux. Sans eux : 4,7." in pub, pub
        assert "On y joue le soir" not in pub, "le mot attend la relecture"
        assert "attend d’être lu par Julien" in tel.inner_text(".pa-avis-etat-mot")
        assert tel.inner_text(".pa-avis-envoyer") == "Enregistrer mon avis" and tel.is_visible(".pa-avis-retirer")
        assert tel.locator(".pa-avis .pa-etoile.plein").count() == 4 and tel.is_checked(".pa-avis-pastille input[value=pas-toujours]"), "l'avis relu garde ses réponses"
        tel.locator(".cat-fiche .cat-avis").scroll_into_view_if_needed()
        tel.wait_for_timeout(300)
        tel.screenshot(path=str(OUT / "telephone-41-avis-des-parents.png"))
        tel.locator(".pa-avis").scroll_into_view_if_needed()
        tel.screenshot(path=str(OUT / "telephone-42-avis-envoye.png"))
        # La synchro redessine la fiche : ce qu'on écrit reste
        tel.fill(".pa-avis-champ textarea[id$=-mot]", "Brouillon en cours")
        tel.evaluate("window.dispatchEvent(new Event('online'))")
        tel.wait_for_timeout(800)
        assert tel.input_value(".pa-avis-champ textarea[id$=-mot]") == "Brouillon en cours", "une synchro ne vide pas ce qu'on écrit"
        tel.fill(".pa-avis-champ textarea[id$=-mot]", "On y joue le soir, à deux.")
        # En anglais
        tel.click(".cat-fermer")
        onglet(tel, "reglages")
        tel.click("#pa-page .langs button[lang=en]")
        onglet(tel, "jeux")
        tel.click(".pa-ligne[data-jeu=jeu-kit] .pa-ligne-jeu")
        tel.wait_for_selector(".cat-fiche[open] .pa-avis")
        tel.wait_for_function("document.querySelector('.cat-fiche .cat-avis') && document.querySelector('.cat-fiche .cat-avis').textContent.includes('12 reviews')")
        pub = tel.inner_text(".cat-fiche .cat-avis")
        assert "4.3" in pub and "2 parents say the game does not work well at their home. Without them: 4.7." in pub, pub
        assert tel.get_attribute(".cat-fiche .cat-etoiles", "aria-label") == "4.3 out of 5"
        av = tel.inner_text(".cat-fiche .pa-avis")
        assert "Does the game work well at your home?" in av and "Not always" in av, av
        assert tel.get_attribute(".pa-etoile:nth-child(1) input", "aria-label") == "1 star"
        tel.locator(".pa-avis").scroll_into_view_if_needed()
        tel.screenshot(path=str(OUT / "telephone-43-your-view-en.png"))
        tel.click(".cat-fermer")
        onglet(tel, "reglages")
        tel.click("#pa-page .langs button[lang=fr]")

        # Sans compte : pas de « Votre avis », même après 31 minutes de jeu ; l'avis des parents se lit quand même
        seul = famille()
        seul["games"]["jeu-kit"] = {"ms": 31 * 60000, "sessions": 2, "days": {}, "scores": {}, "progress": {}}
        sc = contexte(browser, store=seul, nuage=nuage, **formats["tablette"])
        pg = sc.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        avant = len([c for c in nuage.appels if c.startswith("/rest/v1/avis")])
        pg.goto(APP + "#carnet")
        pg.wait_for_selector("#gate[open]")
        code(pg, PIN)
        parent(pg)
        pg.click(".pa-ligne[data-jeu=jeu-kit] .pa-ligne-jeu")
        pg.wait_for_selector(".cat-fiche .cat-avis:not([hidden])")
        assert pg.locator(".cat-fiche .pa-avis").count() == 0, "sans compte : pas de « Votre avis »"
        assert "12 avis" in pg.inner_text(".cat-fiche .cat-avis")
        assert len([c for c in nuage.appels if c.startswith("/rest/v1/avis")]) == avant, "sans compte, on ne lit aucun avis personnel"
        sc.close()

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
            # L'usage de l'appli : des totaux, et l'activité de fin du montré au « J'ai fini »
            b.locator("#b-nav a", has_text="L'usage").click()
            b.wait_for_selector("#us-jeux tbody tr")
            assert b.locator("#us-jeux tbody tr").count() == 2 and "Jeu kit" in b.inner_text("#us-jeux"), b.inner_text("#us-jeux")
            act = b.inner_text("#us-activites")
            assert b.locator("#us-activites tbody tr").count() == 1 and "50 %" in act and "42 %" in act and "étape 2 : 7" in act, act
            assert "L'enfant est sorti du jeu" in b.inner_text("#us-fins") and "Tablette" in b.inner_text("#us-format")
            refus = b.inner_text("#us-refus")
            assert "Ont refusé" in refus and "5 %" in refus and "8 à 10 ans" in b.inner_text("#us-refus-age"), refus
            assert any(c.endswith("bureau_usage") for c in nuage.appels)
            b.wait_for_timeout(300)
            b.screenshot(path=str(OUT / f"{name}-30b-bureau-usage.png"), full_page=True)
            b.locator("#b-nav a", has_text="Aperçu").click()
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
            # Plan 5 : relire les mots libres des avis, accepter ou refuser
            b.locator("#b-nav a", has_text="Les avis").click()
            b.wait_for_selector("#av-jeux tbody tr")
            jeux_txt = b.inner_text("#av-jeux")
            assert "✓ montré" in jeux_txt and "pas encore (3 sur 5)" in jeux_txt, jeux_txt
            assert "4,3" in jeux_txt and "4,7" in jeux_txt and "1 marche pas toujours" in jeux_txt and "1 ne marche pas" in jeux_txt, jeux_txt
            assert b.locator("#av-fiche").count() == 0 and "Dites quoi" not in b.inner_text("[data-rub=avis]"), "plus de « Dites quoi »"
            tous_txt = b.inner_text("#av-table")
            assert "★☆☆☆☆ 1" in tous_txt and "ne marche pas" in tous_txt and "★★★★☆ 4" in tous_txt, "les étoiles et « marche » de chaque avis"
            assert "@exemple.test" not in b.inner_text("[data-rub=avis]"), "pas d'adresse e-mail dans les avis"
            if name == "telephone":
                assert b.locator("#av-relire .b-avis").count() == 2 and "Mots à relire (2)" in b.inner_text("#av-relire-t")
                note = b.locator("#av-relire .b-avis", has_text="On y joue le soir").locator(".b-avis-note").inner_text()
                assert note == "★★★★☆ 4 · marche pas toujours", note
                assert b.evaluate("window.XSS") is None and "<img" in b.inner_text("#av-relire"), "le mot d'un parent reste du texte"
                b.screenshot(path=str(OUT / f"{name}-34-bureau-avis-a-relire.png"), full_page=True)
                b.locator("#av-relire .b-avis", has_text="On y joue le soir").locator(".b-accepter").click()
                b.wait_for_function("document.querySelectorAll('#av-relire .b-avis').length === 1")
                assert nuage.avis[("parent@exemple.test", "jeu-kit")]["mot_etat"] == "accepte"
                b.locator("#av-relire .b-avis .b-refuser").click()
                b.wait_for_function("document.getElementById('av-relire').textContent.includes('Aucun mot à relire')")
                assert nuage.avis[("autre-1@exemple.test", "jeu-kit")]["mot_etat"] == "refuse"
                assert "✓ montré" in b.inner_text("#av-table") and "✗ pas montré" in b.inner_text("#av-table")
            else:
                b.wait_for_function("document.getElementById('av-relire').textContent.includes('Aucun mot à relire')")
            b.wait_for_timeout(200)
            b.screenshot(path=str(OUT / f"{name}-35-bureau-avis.png"), full_page=True)
            b.locator("#b-nav a", has_text="Le catalogue").click()
            b.wait_for_selector("#ca-jeux tbody tr")
            b.wait_for_selector("#ca-github li")
            assert "à relire" in b.inner_text("#ca-jeux")
            b.screenshot(path=str(OUT / f"{name}-33-bureau-catalogue.png"), full_page=True)
            b.locator("#b-nav a", has_text="Les formules").click()
            b.wait_for_selector("#fo-table tbody tr")
            assert "synchro" in b.inner_text("#fo-table")
            b.locator("#b-nav a", has_text="Aperçu").click()
            b.wait_for_selector("#ap-attente a[href='#avis']")
            assert "mots de parents à relire" in b.inner_text("#ap-attente")
            ctx.close()

        # Le mot accepté se lit sur la fiche, sur le site comme dans l'appli ; sous 5 avis, toujours rien
        for name, opts in formats.items():
            ctx = contexte(browser, nuage=nuage, **opts)
            s = ctx.new_page()
            s.on("pageerror", lambda e: errors.append(str(e)))
            s.goto(BASE + "/ludiworld/les-jeux/#jeu-kit")
            s.wait_for_selector(".cat-fiche[open] .cat-avis:not([hidden])")
            pub = s.inner_text(".cat-fiche .cat-avis")
            assert "12 avis" in pub and "4,3" in pub and "Sans eux : 4,7." in pub.replace(" ", " ") and "On y joue le soir, à deux." in pub and "Mes deux filles" in pub, pub
            assert "Un mot à relire" not in pub
            assert s.locator(".cat-fiche .pa-avis").count() == 0, "le site ne propose pas de donner son avis"
            s.locator(".cat-fiche .cat-avis").scroll_into_view_if_needed()
            s.wait_for_timeout(400)
            s.screenshot(path=str(OUT / f"{name}-44-site-avis-des-parents.png"))
            s.goto(BASE + "/ludiworld/les-jeux/#pluie-de-cochons")
            s.wait_for_function("(document.getElementById('cat-fiche-titre') || {}).textContent === 'Pluie de Cochons'")
            s.wait_for_timeout(500)
            assert s.locator(".cat-fiche .cat-avis:not([hidden])").count() == 0, "sous 5 avis, rien sur le site"
            ctx.close()
        tel.goto(APP + "#carnet")
        tel.wait_for_selector("#gate[open], #v-parent:not([hidden])")
        if tel.locator("#gate[open]").count():
            code(tel, PIN)
        parent(tel)
        onglet(tel, "jeux")
        tel.click(".pa-ligne[data-jeu=jeu-kit] .pa-ligne-jeu")
        tel.wait_for_function("(document.querySelector('.pa-avis-etat-mot') || {}).textContent === 'Votre mot est montré sur la fiche.'")
        assert "On y joue le soir, à deux." in tel.inner_text(".cat-fiche .cat-avis")
        # Le même écran à la largeur d'un ordinateur : l'avis des parents, puis « Votre avis »
        tel.set_viewport_size({"width": 1180, "height": 820})
        tel.wait_for_timeout(300)
        tel.locator(".cat-fiche .cat-avis").scroll_into_view_if_needed()
        tel.wait_for_timeout(300)
        tel.screenshot(path=str(OUT / "large-45-avis-des-parents.png"))
        tel.locator(".pa-avis").scroll_into_view_if_needed()
        tel.wait_for_timeout(300)
        tel.screenshot(path=str(OUT / "large-46-votre-avis.png"))
        tel.set_viewport_size({"width": 390, "height": 844})
        tel.click(".cat-fermer")
        # la fiche se ferme par un retour d'historique : il doit être fini avant d'aller ailleurs, sinon il annule la page suivante
        tel.wait_for_function("!(history.state && history.state.lwCat)")
        tel.wait_for_timeout(300)

        # 15. Tout effacer d'un geste : couper la copie, puis le compte
        tel.goto(BASE + "/ludiworld/compte/#espace")
        tel.wait_for_selector("#e-corps:not([hidden])")
        tel.wait_for_function("document.getElementById('e-formule').textContent.includes('Gratuit')")
        # « Télécharger mes données » : mes avis, avec les étoiles, sans les anciennes questions
        with tel.expect_download() as dl:
            tel.click("#e-exporter")
        donnees = json.loads(pathlib.Path(dl.value.path()).read_text(encoding="utf-8"))
        mes_avis = donnees["avis"]
        assert len(mes_avis) == 1 and mes_avis[0]["jeu"] == "jeu-kit" and mes_avis[0]["etoiles"] == 4 and mes_avis[0]["marche"] == "pas-toujours", mes_avis
        assert any("avis?select=jeu,etoiles,marche,mot,mot_etat,langue,cree_le,maj_le" in c for c in nuage.appels), "l'export demande les étoiles"
        tel.locator(".e-effacer summary").click()
        tel.fill("#e-mot", "non")
        tel.click("#f-effacer button[type=submit]")
        tel.wait_for_function("document.getElementById('e-alerte').textContent.includes('EFFACER')")
        assert "parent@exemple.test" in nuage.comptes
        tel.fill("#e-mot", "EFFACER")
        tel.click("#f-effacer button[type=submit]")
        tel.wait_for_url(BASE + "/ludiworld/")
        assert "parent@exemple.test" not in nuage.comptes and nuage.foyer is None
        assert tel.evaluate("localStorage.getItem('ludiworld.session')") is None
        assert tel.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].enfant.nom") == "Grand Loup", "l'appareil garde ce qui est à lui"

        # « Tout effacer » sur une tablette : elle ne reste liée à personne
        page.goto(APP + "#carnet")
        page.wait_for_selector("#gate[open]")
        code(page, PIN)
        parent(page)
        onglet(page, "reglages")
        page.on("dialog", lambda d: d.accept())
        page.click("[data-action=effacer]")
        page.wait_for_selector("#v-accueil:not([hidden])")
        assert page.evaluate("localStorage.getItem('ludiworld.session')") is None and page.evaluate("localStorage.getItem('ludiworld.synchro')") is None
        assert page.get_attribute(".a-deja a", "href") == "compte/#connexion", "après « Vider », on peut se reconnecter d'ici"
        telephone.close()
        tablette.close()
        browser.close()
    if errors:
        raise SystemExit("Erreurs JS : " + " | ".join(errors))
    print("OK : captures dans", OUT)


if __name__ == "__main__":
    run()
