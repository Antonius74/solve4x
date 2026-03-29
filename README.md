# MathPlot Studio

Tool web responsive (mobile + desktop) per plottare funzioni matematiche 2D e 3D con UI moderna in stile Material.

## Avvio rapido

1. Apri `index.html` in browser.
2. Oppure avvia un server statico dalla cartella progetto, ad esempio:

```bash
python3 -m http.server 8080
```

Poi visita `http://localhost:8080`.

## Cosa puoi fare

- Rilevamento automatico 2D/3D in base alle variabili presenti.
- Plot multiplo: puoi disegnare piu funzioni nello stesso grafico.
- Input dinamico dei parametri extra (es. `a`, `b`, `k`) come costanti modificabili.
- Plot 2D: `f(x)` con zoom/pan e scala lineare/logaritmica.
- Plot 3D: `z = f(x,y)` come superficie interattiva ruotabile con mouse/touch.
- Controllo intervalli, risoluzione, color map.
- Preset rapidi per testare funzioni semplici e complesse.

## Sintassi funzioni

Le espressioni sono valutate con `math.js`.

Esempi validi:

- `sin(x)`
- `y = x^3 - 4*x`
- `z = x^2 + y^2`
- `a*sin(b*x) + c`
- `sin(sqrt(x^2 + y^2)) / (sqrt(x^2 + y^2) + k)`
- `sin(x); cos(x)/2; x^2/15` (multi-funzione 2D)

Funzioni utili: `sin`, `cos`, `tan`, `log`, `sqrt`, `exp`, `abs`, `pow` e molte altre supportate da math.js.

## Note pratiche

- Scala logaritmica: i limiti devono essere maggiori di zero.
- In 3D evita risoluzioni troppo alte su mobile (consigliato <= 180).
- Multi-funzione: separa con `;` o nuova riga. Non mischiare 2D e 3D nello stesso plot.
