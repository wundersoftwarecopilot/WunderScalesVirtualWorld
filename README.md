# Wunder Virtual World

Showroom 3D delle bilance Wunder Sa.Bi., interamente in WebGL (three.js): si cammina con le
frecce della tastiera o WASD (o le frecce touch su telefono) tra ingresso, ambulatorio,
supermercato / magazzino e galleria design. Ogni logo è cliccabile e porta al sito Wunder.

Comandi: un clic sul mondo aggancia il mouse e la visuale lo segue come in un gioco in prima
persona (destra, sinistra, su, giù; Esc lo rilascia, un clic con il mirino su un logo lo apre).
La rotella (o il pizzico sul trackpad) fa zoom, il tasto centrale torna alla visuale normale;
le frecce servono solo a camminare (← / → di lato). Sul telefono si guarda trascinando un dito
e si fa zoom con due dita.

```bash
npm install
npx vite            # sviluppo: http://127.0.0.1:5173/ (mondo) e /lab.html?scale=r2020 (singola bilancia)
npm run build       # → artifact/wunder-world.html (pagina unica per claude.ai Artifacts)
npm test && npm run e2e
```

Il logo è un segnaposto (monogramma W su disco rosso) finché non arriva l'SVG ufficiale:
si sostituisce in un solo file, `src/brand/logo.ts`.
