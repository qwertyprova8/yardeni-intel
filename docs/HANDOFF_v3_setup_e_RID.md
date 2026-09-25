# HANDOFF — Yardeni v3: setup + integrazione in RID

> Da allegare alla chat dedicata al setup. È autosufficiente: contiene contesto, stato,
> passi da fare, trappole note e verifiche.
> Data: 25 settembre 2026.

---

## 0. Ruolo per la nuova chat (copia-incolla come primo messaggio)

> Sei un senior infrastructure architect. Devo installare lo script Google Apps Script
> "Yardeni v3", già scritto e testato, che pubblica le email Yardeni **con i grafici** su
> `yardeni-intel.pages.dev`, e poi aggiungere una scheda "Fonti" al mio sito RID
> (`rid.siegelbot.uk`, repo `qwertyprova8/MIRE_Account_Principale`). Non sono uno
> sviluppatore: guidami un passo alla volta e dimmi sempre DOVE cliccare o eseguire.
> Allego: questo handoff, `GUIDA_SETUP_v3.md`, `yardeni_v3.gs`, `lessons_tool.md`.
> I file stanno nel repo `qwertyprova8/yardeni-intel`, **branch
> `claude/confident-mendel-5nfe0u`** (non ancora su `main`).

---

## 1. Perché serviva la v3 (diagnosi fatta il 25/09)

| Sintomo | Causa reale |
|---|---|
| Il sito `yardeni-intel.pages.dev` è fermo al 24 giugno | Lo script `pubblicaYardeni` (publisher) non pubblica più: il token GitHub è scaduto o il trigger non è mai partito. Lo script v2.5 (Gmail → TXT su Drive) invece **funziona ancora**: su Drive ci sono file fino al 25/09. |
| Sembrava che il sito mostrasse solo materiale pubblico | Le email a pagamento c'erano, ma ferme a giugno. L'unica cosa pubblica è il box verde che rimanda al Morning Briefing. |
| I grafici andavano persi | Lo script v2.5 legge `getPlainBody()`, cioè solo il testo. Nel testo resta la parola "(chart)" e i grafici spariscono. |

**Scoperta chiave:** le email Yardeni arrivano da Ghost (`yardeni-research@ghost.io`).
L'HTML di ogni email ha l'articolo racchiuso tra due segnaposto fissi:
`<!-- POST CONTENT START -->` e `<!-- POST CONTENT END -->`. I grafici sono immagini su
`storage.ghost.io`, **apribili senza login** (verificato in incognito). Basta ritagliare
quell'HTML: non serve scaricare nessuna immagine.

---

## 2. Cosa fa la v3 (`apps-script/yardeni_v3.gs`)

Uno script unico che **sostituisce sia la v2.5 sia il publisher**. Gira ogni ora:

1. Cerca in Gmail le email di `yardeni-research@ghost.io` senza l'etichetta `YARDENI_WEB`.
2. Ritaglia l'articolo dall'HTML: testo e grafici al loro posto, senza stili dell'email,
   pixel di tracciamento e box "Join the discussion".
3. Salva su Drive, nella cartella `YARDENI_EMAIL_ESTRATTE`:
   - il TXT come prima (solo se l'email non ha già `SALVATO_SU_DRIVE`, così non crea doppioni);
   - l'HTML nella sottocartella `HTML`, più un indice `articoli.json`.
4. Pubblica su GitHub in **un solo commit** per esecuzione: il limite gratuito di Cloudflare
   è di 500 aggiornamenti del sito al mese.
   - `articoli/<data>-<titolo>.html`: una pagina per articolo
   - `index.html`: dashboard per categoria con gli ultimi 14 giorni per intero, più l'archivio completo per mese
   - `articoli.json`: elenco di tutti gli articoli (serve a RID o ad altri siti)
5. Solo **dopo** che il commit è andato a buon fine mette le etichette `YARDENI_WEB` e
   `SALVATO_SU_DRIVE`. Se GitHub fallisce, all'ora successiva riprova da capo.

Altre caratteristiche:
- **Arretrato:** recupera le email dal 1/1/2026 (`DATA_INIZIO`), 50 per esecuzione.
- **Promozioni scartate dal sito** (Sale, % Off, Last Chance…), ma il TXT resta su Drive.
- **Categorie:** US Market Call, Global Markets Call, Settoriale (US SECTORS CALL e titoli
  che iniziano col nome di un settore seguito da ":"), QuickTakes, Week Ahead, Weekly Roundup, Webcast.
- **Il token GitHub non sta nel codice** ma in *Proprietà script* (`GITHUB_TOKEN`).
  Motivo: il repo è pubblico e i file `.gs` finiscono lì dentro.
- **Funzioni:**
  - `aggiornaYardeni`: quella del trigger
  - `testAnteprima`: prova senza pubblicare
  - `rigeneraIndex`: rifà solo la dashboard

**Test già fatto** (in locale, sull'email reale "Baby Boom Briefing" del 25/09): 17 grafici
su 17 mantenuti, nessuno stile residuo, box promozionale rimosso. Classificazione corretta
su 9 titoli reali.

---

## 3. Setup (dettaglio passo passo in `GUIDA_SETUP_v3.md`)

| # | Cosa | Dove | Note |
|---|---|---|---|
| 0 | Grafici visibili senza login | browser | ✅ fatto |
| 1 | Nuovo token GitHub *fine-grained*, solo repo `yardeni-intel`, **Contents: Read and write**, scadenza **No expiration** | github.com → Settings → Developer settings | Non incollarlo mai in chat |
| 2 | Nuovo progetto Apps Script "Yardeni v3" e incolla del codice | script.google.com, **con l'account che riceve le email** | |
| 3 | Fuso orario Roma + Proprietà script `GITHUB_TOKEN` | ⚙️ Impostazioni progetto | |
| 4 | Esegui `testAnteprima` e controlla il log | editor Apps Script | Deve dire `Grafici trovati: >0` e `Token: SI` |
| 5 | Esegui `aggiornaYardeni` finché il log non dice "Nessuna nuova email" | editor Apps Script | ~50 email per esecuzione |
| 6 | Trigger orario su `aggiornaYardeni` | ⏰ Trigger | |
| 7 | **Elimina i vecchi trigger** (vedi sotto) | progetti vecchi su script.google.com | **Critico** |
| 8 | Controlla Cloudflare | dash.cloudflare.com → Workers & Pages → `yardeni-intel` → Deployments | Dopo il passo 5 deve comparire un deploy nuovo (l'ultimo era del 24/06). Se non compare, il progetto Pages si è scollegato da GitHub: va ricollegato a `main`, con build command vuoto e output directory `/`. |

### ⚠️ Passo 7 spiegato: perché spegnere il vecchio `pubblicaYardeni`

Il vecchio publisher e la v3 scrivono **lo stesso file** (`index.html`) nello stesso repo.
Se il vecchio trigger torna a funzionare (per esempio perché qualcuno gli rimette un token
valido) o è ancora programmato, alla sua esecuzione successiva **sovrascrive la dashboard
con la versione vecchia**: solo testo, senza grafici, senza archivio e senza link agli articoli.
Le pagine dei singoli articoli resterebbero, ma la home tornerebbe quella di giugno.

Come fare: script.google.com → apri il progetto del publisher → icona ⏰ **Trigger** a
sinistra → riga `pubblicaYardeni` → ⋮ → **Elimina trigger**. Poi fai lo stesso nel progetto
della v2.5 per `salvaMailYardeniSuDrive`. Qui è consigliato ma non obbligatorio: la v3
riconosce l'etichetta `SALVATO_SU_DRIVE` e non duplica i TXT. **Non cancellare i progetti:**
tienili come copia di riserva.

---

## 4. Integrazione in RID (`rid.siegelbot.uk`)

### Com'è fatto RID (analizzato il 25/09 sul repo `MIRE_Account_Principale`)
- Il sito è **una sola pagina** generata da `mireNN.py` (oggi `mire298.py`), servita da
  **Caddy** sul server Hetzner da `/srv/rid/sito`, con password (basic_auth), attraverso
  Cloudflare Tunnel.
- Le "sezioni" (`#rotazione`, `#portafoglio`…) sono **schede** della stessa pagina:
  - `<section class="tab-panel" id="tab-XXX">`
  - un pulsante `<button class="tab-btn" data-tab="XXX" onclick="switchTab('XXX')">`
  - il nome aggiunto all'elenco `var TABS=[...]`
- **Regola del progetto (dal suo CLAUDE.md):** non si modifica mai un `mireNN.py` già
  pubblicato. Si copia in `mire299.py`, si modifica quello e si aggiunge in cima il
  commento `# v299: ...`. Poi l'utente pubblica con `rid-aggiorna` sul server.

### Soluzione consigliata: scheda "Fonti" con la dashboard Yardeni incorporata

È la strada più semplice: nessun lavoro sul server e nessun dato duplicato. RID mostra la
pagina di `yardeni-intel.pages.dev` dentro una cornice (iframe). Il nome "Fonti" lascia
spazio alle prossime fonti (JC Parets, Ciovacco…) come sotto-link nella stessa scheda.

Tre modifiche in `mire299.py` (numeri di riga riferiti a `mire298.py`):

**a) Pulsante**, subito dopo quello di Portafoglio (~riga 22066):
```html
    <button class="tab-btn" data-tab="fonti" onclick="switchTab('fonti')" title="Articoli delle fonti a pagamento ricevuti via email, con i grafici (per ora: Yardeni)">Fonti</button>
```

**b) Sezione**, subito dopo `</section>` di `tab-portafoglio` (~riga 23264):
```html
<section class="tab-panel" id="tab-fonti">
<div class="section-sep"><span>Fonti &mdash; Yardeni Research (email, con grafici)</span></div>
<div class="card" style="font-size:12px;color:var(--text2)">
  Si aggiorna da sola ogni ora. <a href="https://yardeni-intel.pages.dev/" target="_blank" rel="noopener">Apri a tutta pagina &#8599;</a>
</div>
<iframe src="https://yardeni-intel.pages.dev/" loading="lazy" title="Yardeni Intelligence Hub"
        style="width:100%;height:calc(100vh - 180px);min-height:500px;border:0;border-radius:6px;background:#f9f7f2"></iframe>
</section>
```

**c) Elenco schede** (~riga 51253): aggiungi `'fonti'` dopo `'portafoglio'`:
```js
var TABS=['panoramica','tracking','rotazione','europa','notizie','portafoglio','fonti','crypto','scanner','ai'];
```

Facoltativo: una riga per `fonti` in `var SEZIONI_SOTTO = {...}` (~riga 52400), cioè il
sottotitolo mostrato sotto il nome della sezione.

**Verifiche prima di consegnare** (la regola MIRE chiede di validare con un'esecuzione reale):
- La pagina generata contiene `id="tab-fonti"` e la scheda si apre con `#fonti`.
- `loading="lazy"`: la cornice si carica solo quando apri la scheda. Nella vista
  "tutto" (pagina unica) si carica solo quando arrivi a quella sezione scorrendo.
- Nella pagina Yardeni i link agli articoli si aprono **dentro la cornice**. Il link
  "Apri a tutta pagina" li apre in una scheda nuova del browser.

### Alternativa (solo se un giorno serve): copia sul server
Un piccolo script cron sul server Hetzner scarica il repo `yardeni-intel` in
`/srv/rid/sito/yardeni/` ogni 30 minuti (`git pull`). Così la dashboard sta su
`rid.siegelbot.uk/yardeni/`, protetta dalla stessa password di RID. Oggi **non serve**: la
pagina pubblica `noindex` va comunque tenuta perché le AI in chat la leggono via
`web_fetch`, e con basic_auth non potrebbero. Non introdurre questa complessità senza
un motivo concreto.

---

## 5. Verifica finale (checklist)

- [ ] Log di `testAnteprima`: grafici > 0, token SI
- [ ] `yardeni-intel.pages.dev` mostra la data di oggi in alto e i grafici negli articoli
- [ ] Archivio in fondo alla pagina con i mesi da gennaio 2026
- [ ] Cloudflare → Deployments: un deploy per ogni esecuzione con email nuove, non uno per file
- [ ] Vecchi trigger `pubblicaYardeni` e `salvaMailYardeniSuDrive` eliminati
- [ ] RID: scheda "Fonti" visibile, cornice caricata, "Apri a tutta pagina" funzionante
- [ ] Il giorno dopo: il trigger orario ha pubblicato da solo la nuova email del mattino

## 6. Rischi residui

| Rischio | Probabilità | Cosa succede | Rimedio |
|---|---|---|---|
| Yardeni/Ghost cambia il formato dell'email | bassa | Niente grafici: lo script salva comunque il testo (ripiego automatico) | Mandare un `.eml` nuovo e aggiornare `estraiContenuto_` |
| Yardeni cancella vecchie immagini da `storage.ghost.io` | bassa | Grafici vecchi mancanti nell'archivio | Evoluzione futura: copiare le immagini nel repo |
| Token GitHub revocato o scaduto | media nel lungo periodo | Il sito si ferma, come a giugno | Log con `HTTP 401`: rigenerare il token (Passo 1) |
| Il vecchio publisher riattivato | bassa se si fa il Passo 7 | Dashboard sovrascritta con la versione solo testo | Passo 7 |
