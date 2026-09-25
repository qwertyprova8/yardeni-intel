# lessons_tool.md — scoperte operative sui tool esterni

## Gmail + Apps Script — `getPlainBody()` perde i grafici
- **Tool:** Google Apps Script (GmailApp)
- **Scoperta:** `getPlainBody()` restituisce solo il testo. Le immagini diventano "(chart)" o `[image: ...]`. `getBody()` restituisce l'HTML completo con i link alle immagini.
- **Impatto:** archivi di newsletter senza grafici, cioè senza metà dell'informazione.
- **Quando serve saperlo:** qualsiasi automazione che salva email con contenuto visivo (newsletter finanziarie, report).
- **Alternativa o workaround:** usare `getBody()` e ritagliare solo la parte utile dell'HTML.

## Ghost (newsletter) — l'articolo è tra due segnaposto fissi
- **Tool:** Ghost (usato da Yardeni QuickTakes, mittente `@ghost.io`)
- **Scoperta:** l'HTML delle email Ghost contiene `<!-- POST CONTENT START -->` e `<!-- POST CONTENT END -->` attorno all'articolo. Le immagini stanno su `storage.ghost.io` e si aprono senza login anche per i post a pagamento (verificato in incognito il 25/09/2026; confermato da TryGhost/Ghost issue #11627).
- **Impatto:** senza saperlo si scrivono filtri fragili riga per riga (come nella v2.5).
- **Quando serve saperlo:** ogni fonte che usa Ghost. Si riconosce dal mittente `@ghost.io` o dal footer "Powered by Ghost". Lo stesso script si riusa cambiando solo il mittente.
- **Alternativa o workaround:** se un giorno le immagini richiedessero il login, scaricarle con `UrlFetchApp` e salvarle nel repo.

## GitHub API + Cloudflare Pages — un commit per file = un deploy per file
- **Tool:** GitHub REST API (endpoint *contents*) + Cloudflare Pages collegato a Git
- **Scoperta:** l'endpoint `PUT /contents/<file>` crea **un commit per ogni file**. Cloudflare Pages rifà il sito a ogni commit. Il piano gratuito ha 500 build al mese, una alla volta (verificato con Perplexity, settembre 2026).
- **Impatto:** pubblicare 300 articoli arretrati uno alla volta vuol dire 300 build: limite mensile a rischio e coda di build.
- **Quando serve saperlo:** ogni script che pubblica più file sullo stesso repo collegato a Pages.
- **Alternativa o workaround:** Git Data API (`ref` → `trees` con `base_tree` → `commits` → `PATCH ref`): tutti i file in un solo commit, 5 chiamate in tutto. Implementato in `yardeni_v3.gs` → `commitGitHub_`.

## GitHub — scadenza dei token fine-grained
- **Tool:** GitHub Personal Access Token (fine-grained)
- **Scoperta:** per gli account personali è consentito "No expiration", oppure una durata da 1 a 366 giorni (se non si sceglie nulla, 30 giorni). I token non usati per 1 anno vengono revocati in automatico (verificato con Perplexity, settembre 2026).
- **Impatto:** con la scadenza di default il sito si ferma senza avvisi. Probabile causa dello stop del 24/06.
- **Quando serve saperlo:** ogni automazione che scrive su GitHub.
- **Alternativa o workaround:** "No expiration" con permessi minimi (un solo repo, solo Contents). In alternativa, promemoria in calendario alla scadenza.

## Apps Script — i segreti vanno in Proprietà script, non nel codice
- **Tool:** Google Apps Script
- **Scoperta:** Impostazioni progetto → Proprietà script tiene il token fuori dal codice. Si legge con `PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN")`.
- **Impatto:** i file `.gs` finiscono nei repo, a volte pubblici. Con il token nel codice basta un upload per esporlo.
- **Quando serve saperlo:** qualsiasi script con API key o token.
- **Alternativa o workaround:** nessuna necessaria. È il metodo standard.

## Claude Code (web) — i file caricati dopo l'avvio non si vedono
- **Tool:** Claude Code su claude.ai/code
- **Scoperta:** il repo viene copiato quando parte la sessione. I file caricati su GitHub dopo non compaiono finché Claude non esegue `git pull`.
- **Impatto:** Claude risponde "non vedo quei file" anche se su GitHub ci sono.
- **Quando serve saperlo:** quando si caricano file nel repo a sessione già aperta.
- **Alternativa o workaround:** dire a Claude "fai git pull", oppure allegare i file direttamente in chat.
