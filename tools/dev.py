#!/usr/bin/env python3
"""Ludiworld en local : le launcher et les jeux clonés à côté, servis depuis le disque.

  python3 tools/dev.py [<dossier_des_jeux>] [--port 7357]

Par défaut, le dossier des jeux est le parent de ce dépôt (les clones sont à côté de ludiworld/).
  http://localhost:7357/ludiworld/   le launcher (docs/ de ce dépôt)
  http://localhost:7357/<jeu>/       un jeu ouvert seul (docs/ de son clone, ou la racine du clone s'il est publié tel quel)
  http://localhost:7357/<depot>/<jeu>/   un jeu d'un dépôt qui en regroupe plusieurs (ludigames : un dossier par jeu)

Dans le launcher, un jeu de https://pikifou.github.io/<jeu>/ qui a un clone local s'ouvre depuis le disque :
la fiche servie est le ludi.json du clone (sinon la copie du catalogue), avec ses adresses réécrites vers ce
serveur. Les autres jeux restent en ligne. Rien n'est écrit dans le catalogue.

Pour aller vite :
- un jeu dont les sources (src/, assets/, ludi.json, build.py) sont plus récentes que docs/index.html est
  reconstruit (build.py --pwa docs) avant d'être servi : on modifie, on recharge ;
- tout service worker est remplacé par un service worker vide qui vide les caches : rien de périmé.
"""
import argparse
import json
import pathlib
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROD = 'https://pikifou.github.io'
SW_VIDE = b"""// Service worker de dev (tools/dev.py) : pas de cache.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.map(x => caches.delete(x)))).then(() => self.clients.claim())));
"""
TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}
verrou = threading.Lock()


def publie(d):
    """Le dossier publié d'un clone : docs/ (jeu construit par build.py), sinon la racine (jeu publié tel quel)."""
    return d / 'docs' if (d / 'docs/index.html').is_file() else d


def jeux_du_depot(d):
    """Les jeux d'un dépôt qui en regroupe plusieurs : chaque sous-dossier avec index.html et ludi.json."""
    if (publie(d) / 'index.html').is_file(): return []
    return sorted(j.name for j in d.iterdir() if j.is_dir() and (j / 'index.html').is_file() and (j / 'ludi.json').is_file())


def clones(games):
    """Les jeux clonés à côté : un dossier avec docs/index.html, index.html à la racine, ou un dossier par jeu."""
    return {d.name: d for d in games.iterdir()
            if d.is_dir() and d.name != 'ludiworld' and ((publie(d) / 'index.html').is_file() or jeux_du_depot(d))}


def dernier_changement(d):
    t = 0
    for p in [d / 'ludi.json', d / 'build.py']:
        if p.is_file(): t = max(t, p.stat().st_mtime)
    for sous in ['src', 'assets']:
        if (d / sous).is_dir():
            for f in (d / sous).rglob('*'):
                if f.is_file(): t = max(t, f.stat().st_mtime)
    # Jeux dont les sources sont à la racine du dépôt (la Tour aux Aimants), sans les pages générées.
    for f in d.glob('*'):
        if f.suffix in ('.js', '.css', '.html') and f.name not in ('index.html', 'preview.html'):
            t = max(t, f.stat().st_mtime)
    return t


def reconstruire_si_besoin(nom, d):
    """None si tout va bien, sinon le message d'erreur du build."""
    if not (d / 'build.py').is_file() or not (d / 'docs/index.html').is_file(): return None
    with verrou:
        if dernier_changement(d) <= (d / 'docs/index.html').stat().st_mtime: return None
        print(f'[dev] {nom} : sources modifiées, build.py --pwa docs', flush=True)
        r = subprocess.run([sys.executable, 'build.py', '--pwa', 'docs'], cwd=d, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if r.returncode:
            print(r.stdout + r.stderr, flush=True)
            return r.stdout + r.stderr
        print('[dev] ' + r.stdout.strip(), flush=True)
        return None


class Dev(BaseHTTPRequestHandler):
    games = None

    def envoyer(self, code, corps, type_='text/plain; charset=utf-8', **entetes):
        self.send_response(code)
        self.send_header('Content-Type', type_)
        self.send_header('Content-Length', str(len(corps)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in entetes.items(): self.send_header(k.replace('_', '-'), v)
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(corps)

    def fiche(self, jeu, locaux):
        """Fiche du catalogue vue par le launcher : celle du clone si elle existe, adresses vers ce serveur."""
        f = ROOT / 'docs/jeux' / (jeu + '.json')
        if jeu in locaux and (publie(locaux[jeu]) / 'ludi.json').is_file():
            f = publie(locaux[jeu]) / 'ludi.json'
        else:
            for d in locaux.values():
                if jeu in jeux_du_depot(d): f = d / jeu / 'ludi.json'
        if not f.is_file(): return None
        texte = f.read_text(encoding='utf-8')
        ici = 'http://' + (self.headers.get('Host') or 'localhost')
        for nom in list(locaux) + ['ludiworld']:
            texte = texte.replace(f'{PROD}/{nom}/', f'{ici}/{nom}/')
        return texte.encode('utf-8')

    def do_GET(self):
        chemin = unquote(urlsplit(self.path).path)
        parts = chemin.strip('/').split('/', 1)
        site, reste = parts[0], parts[1] if len(parts) > 1 else ''
        locaux = clones(self.games)
        if not site: return self.envoyer(302, b'', Location='/ludiworld/')
        if any(x.startswith('.') for x in chemin.split('/')): return self.envoyer(404, b'')  # .git et compagnie
        if site != 'ludiworld' and site not in locaux: return self.envoyer(404, f'Pas de clone « {site} » dans {self.games}'.encode())
        if not reste and not chemin.endswith('/'): return self.envoyer(302, b'', Location=f'/{site}/')
        if reste.endswith('sw.js'): return self.envoyer(200, SW_VIDE, TYPES['.js'])
        if site == 'ludiworld' and reste.startswith('jeux/') and reste != 'jeux/index.json' and reste.endswith('.json'):
            corps = self.fiche(reste[5:-5], locaux)
            return self.envoyer(200, corps, TYPES['.json']) if corps else self.envoyer(404, b'')
        if site == 'ludiworld':
            base = ROOT / 'docs'
        else:
            base = publie(locaux[site])
            if reste in ('', 'index.html'):
                err = reconstruire_si_besoin(site, locaux[site])
                if err: return self.envoyer(500, ('Le build a échoué :\n\n' + err).encode('utf-8'))
        f = (base / (reste or 'index.html')).resolve()
        if f.is_dir(): f = f / 'index.html'
        if base.resolve() not in f.parents or not f.is_file(): return self.envoyer(404, b'')
        self.envoyer(200, f.read_bytes(), TYPES.get(f.suffix.lower(), 'application/octet-stream'))

    do_HEAD = do_GET

    def log_message(self, fmt, *args):
        if len(args) > 1 and str(args[1])[0] in '45': sys.stderr.write('[dev] ' + (fmt % args) + '\n')


def main():
    a = argparse.ArgumentParser(description='Ludiworld en local')
    a.add_argument('games', nargs='?', default=str(ROOT.parent), help='dossier qui contient les clones des jeux')
    a.add_argument('--port', type=int, default=7357)
    o = a.parse_args()
    Dev.games = pathlib.Path(o.games).resolve()
    locaux = clones(Dev.games)
    jeux = sorted([f'{d}/{j}' for d in locaux for j in jeux_du_depot(locaux[d])] + [d for d in locaux if not jeux_du_depot(locaux[d])])
    print(f'Launcher : http://localhost:{o.port}/ludiworld/')
    for j in jeux: print(f'  {j} seul : http://localhost:{o.port}/{j}/')
    if not jeux: print(f'  (aucun clone de jeu trouvé dans {Dev.games})')
    try:
        ThreadingHTTPServer(('127.0.0.1', o.port), Dev).serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
