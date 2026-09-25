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

## Passo 0 — Grafici visibili senza login ✅ FATTO

Verificato il 25/09/2026: il link a `storage.ghost.io` si apre in incognito. Le pagine
possono quindi mostrare i grafici direttamente dai server di Yardeni.

## Passo 1 — Crea il token GitHub (sostituisce quello vecchio)

1. Vai su <https://github.com/settings/personal-access-tokens/new>
2. **Token name**: `yardeni-apps-script`
3. **Expiration**: **No expiration**. Verificato con Perplexity a settembre 2026: per gli
   account personali è consentito. GitHub revoca da solo i token inutilizzati per 1 anno,
   ma questo lo usa ogni ora. Se l'opzione non compare, scegli 366 giorni e **segnati in
   calendario la scadenza**: quel giorno il sito smette di aggiornarsi.
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

## Integrazione in rid.siegelbot.uk

Vedi `docs/HANDOFF_v3_setup_e_RID.md`, sezione 4: nuova scheda "Fonti" in RID (`mire299.py`).

## Se qualcosa non va

| Messaggio nel log | Causa | Soluzione |
|---|---|---|
| `Manca il token` | Passo 3 non fatto | Ripeti il Passo 3 |
| `HTTP 401` | Token scaduto o copiato male | Rigenera il token (Passo 1) e aggiorna la proprietà |
| `HTTP 403` / `404` | Token senza permesso sul repo | Passo 1, punti 4-5 |
| `Grafici trovati: 0` | Yardeni ha cambiato il formato delle email | Lo script salva comunque il testo; mandami un `.eml` nuovo |
| Superato il tempo massimo | Troppe email in una volta | Nello script abbassa `MAX_PER_ESECUZIONE` a 25 |
