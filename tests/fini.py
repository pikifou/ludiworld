"""Un jeu dit « fini » et « complet à x % » par le kit : Ludiworld le garde, le range dans la rangée Finis et l'affiche.

Usage : python tests/fini.py [<sortie>]
"""
import sys
import tempfile

sortie = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
sys.argv = [sys.argv[0], sortie]
import captures as C  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

C.FAKE_GAME = C.FAKE_GAME.replace(
    "Ludi.init({game:'jeu-kit'});",
    "Ludi.init({game:'jeu-kit'});"
    "document.getElementById('b').addEventListener('click',function(){Ludi.complet(0.5);Ludi.fini();Ludi.complet(0.4)});")
STORE = "JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['jeu-kit']"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = C.contexte(browser, C.famille())
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(C.BASE + "/ludiworld/")
    assert page.locator(".e-rangee").count() == 0, "une seule rangée : pas de titre"
    page.locator(".tuile", has_text="Jeu kit").click()
    page.frame_locator("#player iframe").locator("#b").click()
    page.wait_for_timeout(400)
    assert page.evaluate(STORE + ".etat") == {"fini": True, "complet": 0.5}, page.evaluate(STORE)
    page.goto(C.BASE + "/ludiworld/")
    page.wait_for_selector(".tuile .marque-fini")
    assert "50" in page.locator(".marque-complet").inner_text()
    page.wait_for_timeout(2500)
    page.screenshot(path=sortie + "/fini-enfant.png")
    ctx.close()
    browser.close()
    assert not errs, errs
print("OK : fini et complet")
