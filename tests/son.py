"""Le son de la maison, dans le navigateur, sans réseau : python tests/son.py [<dossier_de_sortie>]

Julien (2026-11-23) : un jeu ne démarre jamais muet ; le son (musique, bruitages, voix, séparés) se règle pour la maison,
côté parent et par le haut-parleur de l'enfant ; le bouton du son d'un jeu change le réglage de toute la maison.
Reprend le faux réseau et le faux jeu de tests/captures.py.
"""
import json
import pathlib
import sys

sortie = sys.argv[1] if len(sys.argv) > 1 else str(pathlib.Path(__file__).resolve().parent / "captures-son")
sys.argv = [sys.argv[0], sortie]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import captures as C  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

# Le faux jeu montre le son reçu et a son propre bouton « Couper la musique ».
C.FAKE_GAME = """<!doctype html><meta charset=utf-8><title>Jeu kit</title>
<body style="background:#334;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh;margin:0">
<div><p id=son></p><button id=coupe style="font-size:24px;padding:12px 24px">Couper la musique</button></div>
<script src="/ludiworld/kit/ludi.js"></script>
<script>Ludi.init({game:'jeu-kit'});
Ludi.onSon(function(s){document.getElementById('son').textContent=JSON.stringify(s)});
document.getElementById('coupe').onclick=function(){Ludi.reglerSon({musique:false})};</script>"""

echecs = []


def verifier(cond, message):
    print(("  ok  " if cond else "  ÉCHEC  ") + message)
    if not cond:
        echecs.append(message)


def son_jeu(game):
    return json.loads(game.locator("#son").inner_text())


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    for nom, opts in (("tablette", dict(viewport={"width": 1180, "height": 820})),
                      ("telephone", dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True))):
        print(nom)
        ctx = C.contexte(browser, C.famille(), **opts)
        page = ctx.new_page()
        erreurs = []
        page.on("pageerror", lambda e: erreurs.append(str(e)))
        page.goto(C.APP)
        page.wait_for_selector("#e-son")

        # 1. Au départ : tout allumé, et le jeu le reçoit.
        page.locator(".tuile", has_text="Jeu kit").click()
        game = page.frame_locator("#player iframe")
        game.locator("#son").wait_for()
        page.wait_for_function("() => document.querySelector('#player iframe').contentDocument.getElementById('son').textContent.length > 2")
        verifier(son_jeu(game) == {"musique": True, "bruitages": True, "voix": True}, "au départ, le jeu reçoit le son tout allumé")

        # 2. Le bouton du jeu change le réglage de la maison.
        game.locator("#coupe").click()
        page.wait_for_timeout(300)
        verifier(C.stocke(page).get("son") == {"musique": False, "bruitages": True, "voix": True}, "le bouton du jeu change le son de la maison")
        page.screenshot(path=str(C.OUT / f"{nom}-son-jeu.png"))
        page.go_back()
        page.wait_for_selector("#e-son")

        # 3. Le haut-parleur de l'enfant : trois boutons, la musique éteinte (barrée), on la rallume, on coupe la voix.
        page.click("#e-son")
        page.wait_for_selector("#e-son-panneau:not([hidden])")
        etats = page.evaluate("[...document.querySelectorAll('.e-son-choix')].map(b => [b.dataset.son, b.getAttribute('aria-pressed'), getComputedStyle(b.querySelector('.barre')).display !== 'none'])")
        verifier(etats == [["musique", "false", True], ["bruitages", "true", False], ["voix", "true", False]], f"le haut-parleur montre la musique éteinte et barrée ({etats})")
        page.screenshot(path=str(C.OUT / f"{nom}-son-enfant.png"))
        page.click(".e-son-choix[data-son=musique]")
        page.click(".e-son-choix[data-son=voix]")
        verifier(C.stocke(page).get("son") == {"musique": True, "bruitages": True, "voix": False}, "l'enfant rallume la musique et coupe la voix")
        page.mouse.click(600 if nom == "tablette" else 200, 200)
        verifier(page.locator("#e-son-panneau").is_hidden(), "toucher ailleurs ferme le panneau")

        # 4. Le jeu rouvert reçoit le nouveau réglage.
        page.locator(".tuile", has_text="Jeu kit").click()
        game = page.frame_locator("#player iframe")
        page.wait_for_function("() => { const d = document.querySelector('#player iframe').contentDocument; return d && d.getElementById('son') && d.getElementById('son').textContent.includes('\"voix\":false'); }", timeout=8000)
        verifier(son_jeu(game) == {"musique": True, "bruitages": True, "voix": False}, "le jeu rouvert reçoit le réglage de la maison")
        page.go_back()
        page.wait_for_selector("#e-son")

        # 5. Côté parent, Réglages : les trois cases, avec « Changé : le son ».
        page.locator("#e-parents").dispatch_event("pointerdown")
        page.wait_for_timeout(1400)
        page.locator("#e-parents").dispatch_event("pointerup")
        if page.locator("#gate").is_visible():
            C.code(page, C.PIN)
        C.parent(page)
        C.onglet(page, "reglages")
        cases = page.evaluate("[...document.querySelectorAll('input[data-son]')].map(i => [i.dataset.son, i.checked, i.parentElement.textContent])")
        verifier(cases == [["musique", True, "Musique"], ["bruitages", True, "Bruitages"], ["voix", False, "Voix qui lit les textes"]], f"côté parent, les trois cases ({cases})")
        page.click("input[data-son=bruitages]")
        verifier(C.stocke(page).get("son") == {"musique": True, "bruitages": False, "voix": False}, "le parent coupe les bruitages pour la maison")
        verifier("le son" in page.inner_text("#pa-journal"), "« Changé : le son » avec Annuler")
        page.locator("input[data-son=bruitages]").scroll_into_view_if_needed()
        page.screenshot(path=str(C.OUT / f"{nom}-son-parent.png"))
        verifier(not erreurs, f"aucune erreur ({erreurs[:3]})")
        ctx.close()
    browser.close()

print("\nTOUT EST BON" if not echecs else f"\n{len(echecs)} ÉCHEC(S)")
sys.exit(1 if echecs else 0)
