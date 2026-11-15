"""Sauvegarde des jeux (Ludi.save / Ludi.onRestore) de bout en bout, sans réseau.

Usage : python tests/sauvegarde.py [<sortie>]

Un faux jeu garde une sauvegarde par le kit. On vérifie qu'Ludiworld la garde avec l'enfant, qu'un autre appareil
(autre navigateur, mémoire du jeu vide) la reçoit, et qu'une sauvegarde plus récente de l'appareil n'est pas écrasée.
"""
import json
import sys
import tempfile

sys.argv = [sys.argv[0], sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()]
import captures as C  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

C.FAKE_GAME = C.FAKE_GAME.replace(
    "Ludi.init({game:'jeu-kit'});",
    "Ludi.init({game:'jeu-kit'});"
    "Ludi.onRestore(function(d){document.getElementById('msg').textContent='restaure '+d.niveau;});"
    "document.getElementById('b').addEventListener('click',function(){Ludi.save({niveau:7,trophees:['a','b']})});"
    "window.sauver=function(n){Ludi.save({niveau:n})};")
STORE = "JSON.parse(localStorage.getItem('ludiworld.v1')).famille.enfants[0].games['jeu-kit']"


def jouer(browser, store):
    ctx = C.contexte(browser, store)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.goto(C.BASE + "/ludiworld/")
    page.locator(".tuile", has_text="Jeu kit").click()
    return ctx, page, page.frame_locator("#player iframe"), errs


with sync_playwright() as p:
    browser = p.chromium.launch()

    # Appareil 1 : l'enfant joue, le jeu garde sa sauvegarde par le kit.
    ctx, page, game, errs = jouer(browser, C.famille())
    game.locator("#b").click()
    page.wait_for_timeout(400)
    st = page.evaluate(STORE)
    assert st["save"]["data"] == {"niveau": 7, "trophees": ["a", "b"]}, st
    foyer = page.evaluate("JSON.parse(localStorage.getItem('ludiworld.v1'))")  # ce que la copie en ligne emporterait
    ctx.close()
    assert not errs, errs

    # Appareil 2 : mémoire du jeu vide (autre tablette), Ludiworld reçoit le foyer. Le jeu reprend là où il en était.
    ctx, page, game, errs = jouer(browser, foyer)
    game.locator("#msg").wait_for(state="attached")
    page.wait_for_function("document.querySelector('#player iframe').contentDocument.getElementById('msg').textContent === 'restaure 7'", timeout=5000)
    ctx.close()
    assert not errs, errs

    # Appareil 3 : il a joué plus récemment (niveau 12) que la copie en ligne : on ne l'écrase pas, on la lui rend.
    ctx = C.contexte(browser, foyer)
    page = ctx.new_page()
    page.goto(C.BASE + "/ludiworld/")
    page.evaluate("localStorage.setItem('ludi.v1.jeu-kit', JSON.stringify({playMs:0,sessions:1,firstAt:1,lastAt:1,scores:{},progress:{},skills:{},events:[],save:{data:{niveau:12},at:%d}}))" % (4102444800000))
    page.locator(".tuile", has_text="Jeu kit").click()
    page.wait_for_timeout(800)
    st = page.evaluate(STORE)
    assert st["save"]["data"] == {"niveau": 12} and st["save"]["at"] == 4102444800000, st
    assert "restaure" not in page.frame_locator("#player iframe").locator("#msg").inner_text()
    ctx.close()

    print("ok : sauvegarde des jeux")
    browser.close()
