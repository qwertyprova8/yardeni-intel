# Guida setup — Yardeni Intel v3 (articoli con grafici)

Tutto si fa **dal browser**, niente terminale. Tempo stimato: 20 minuti.

## Perché il sito era fermo al 24 giugno

Lo script che salva le email su Drive (v2.5) funziona ancora. Si è invece fermato lo
script che pubblica su GitHub: probabilmente il trigger non è mai partito oppure il
token GitHub è scaduto. La v3 fa tutto con **un solo script**:

```
Email Yardeni → (ogni ora) script v3 → Drive (TXT + HTML) → GitHub (1 commit) → Cloudflare Pages
```

I grafici non vengono scaricati: la pagina li mostra direttamente dai server di Yardeni
(`storage.ghost.io`), esattamente come fa Gmail.

---

## Passo 0 — Verifica che i grafici siano visibili senza login (30 secondi)

Apri una **finestra in incognito** (Chrome: Ctrl+Maiusc+N) e incolla:

```
https://storage.ghost.io/c/16/ef/16efc0dd-240f-4f5e-9e01-d619d6fd4fd1/content/images/2026/09/gateway-240.png
```

- Vedi un grafico → procedi.
- Vedi un errore → fermati e dimmelo (in quel caso bisogna copiare le immagini nel repo).

## Passo 1 — Crea il token GitHub (sostituisce quello vecchio)

1. Vai su <https://github.com/settings/personal-access-tokens/new>
2. **Token name**: `yardeni-apps-script`
3. **Expiration**: scegli la durata più lunga disponibile e **segnati in calendario la
   scadenza**: quel giorno il sito smette di aggiornarsi.
4. **Repository access** → *Only select repositories* → scegli `yardeni-intel`
5. **Permissions** → *Repository permissions* → **Contents** → *Read and write*
6. In fondo clicca **Generate token** e copia il valore (inizia con `github_pat_`).
   ⚠️ Non incollarlo in nessuna chat.

## Passo 2 — Crea il nuovo progetto Apps Script

Accedi con **lo stesso account Google** che riceve le email Yardeni e possiede la
cartella Drive `YARDENI_EMAIL_ESTRATTE`.

1. Vai su <https://script.google.com> → **Nuovo progetto**
2. In alto a sinistra rinominalo `Yardeni v3`
3. Cancella tutto il contenuto di `Codice.gs` e incolla l'intero file
   `apps-script/yardeni_v3.gs`
4. Clicca l'icona 💾 **Salva**

## Passo 3 — Inserisci il token e il fuso orario

1. Nel menu a sinistra clicca ⚙️ **Impostazioni progetto**
2. **Fuso orario**: `(GMT+01:00) Roma`
3. Scorri fino a **Proprietà script** → **Aggiungi proprietà script**
   - Proprietà: `GITHUB_TOKEN`
   - Valore: il token del Passo 1
4. **Salva proprietà script**

## Passo 4 — Test senza pubblicare

1. Torna all'editor (icona `< >` a sinistra)
2. Nel menu a tendina in alto scegli **testAnteprima** → **Esegui**
3. La prima volta Google chiede l'autorizzazione: **Rivedi autorizzazioni** → scegli
   l'account → *Avanzate* → *Vai a Yardeni v3 (non sicuro)* → **Consenti**.
   È normale: lo script è tuo e non è verificato da Google.
4. Nel **Log di esecuzione** devi vedere:
   - `Grafici trovati:` seguito da un numero maggiore di 0
   - `Token GitHub presente: SI`
   - un link a `ANTEPRIMA_v3.html` su Drive: scaricalo e aprilo per vedere l'articolo con i grafici

## Passo 5 — Prima pubblicazione e recupero dell'arretrato

1. Menu a tendina → **aggiornaYardeni** → **Esegui**
2. Ogni esecuzione elabora fino a 50 email, a partire dal 1° gennaio 2026
   (`DATA_INIZIO` nello script). Rilancia finché il log dice `Nessuna nuova email Yardeni.`
   In alternativa lascia fare al trigger del Passo 6: finisce da solo in qualche ora.
3. Dopo circa 1 minuto apri <https://yardeni-intel.pages.dev>

## Passo 6 — Trigger automatico

1. A sinistra clicca ⏰ **Trigger** → **+ Aggiungi trigger** (in basso a destra)
2. Funzione: `aggiornaYardeni` · Origine evento: **Basato sul tempo** ·
   Tipo: **Timer orario** · Intervallo: **Ogni ora** → **Salva**

## Passo 7 — ⚠️ Spegni i vecchi trigger (IMPORTANTE)

Apri su <https://script.google.com> i progetti vecchi → ⏰ **Trigger** → icona ⋮ → **Elimina trigger**:

- **`pubblicaYardeni`** (YARDENI WEEKLY PUBLISHER): **obbligatorio**. Altrimenti sovrascrive
  `index.html` con la vecchia versione solo testo.
- `salvaMailYardeniSuDrive` (v2.5): consigliato. Se lo lasci attivo non fa danni, perché
  la v3 riconosce l'etichetta `SALVATO_SU_DRIVE` e non crea TXT doppi.

---

## Integrazione in rid.siegelbot.uk (sezione #rotazione)

Metodo più semplice: incolla dentro la sezione `#rotazione` del tuo sito

```html
<iframe src="https://yardeni-intel.pages.dev/" loading="lazy"
        style="width:100%;height:85vh;border:0;border-radius:6px;"></iframe>
```

Metodo alternativo (elenco degli ultimi 10 articoli con link, integrato nella grafica del sito):

```html
<ul id="yardeni-lista"></ul>
<script>
fetch("https://yardeni-intel.pages.dev/articoli.json").then(r => r.json()).then(lista => {
  document.getElementById("yardeni-lista").innerHTML = lista.slice(0, 10).map(a =>
    `<li>${a.data} — <a href="https://yardeni-intel.pages.dev/articoli/${a.slug}.html" target="_blank">${a.titolo}</a></li>`
  ).join("");
});
</script>
```

Il file `_headers` nel repo autorizza `rid.siegelbot.uk` a leggere `articoli.json`.

## Se qualcosa non va

| Messaggio nel log | Causa | Soluzione |
|---|---|---|
| `Manca il token` | Passo 3 non fatto | Ripeti il Passo 3 |
| `HTTP 401` | Token scaduto o copiato male | Rigenera il token (Passo 1) e aggiorna la proprietà |
| `HTTP 403` / `404` | Token senza permesso sul repo | Passo 1, punti 4-5 |
| `Grafici trovati: 0` | Yardeni ha cambiato il formato delle email | Lo script salva comunque il testo; mandami un `.eml` nuovo |
| Superato il tempo massimo | Troppe email in una volta | Nello script abbassa `MAX_PER_ESECUZIONE` a 25 |
