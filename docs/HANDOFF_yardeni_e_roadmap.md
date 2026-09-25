# HANDOFF — Intelligence Hub TIA: Yardeni MVP + Roadmap Fonti

> Documento da allegare in chat dedicata. Contiene: scopo generale, cosa stiamo
> facendo per Yardeni (azione immediata), e la roadmap ragionata per le altre 7 fonti.

---

## 0. CHE COS'È IL PROGETTO (TIA — Trading Intelligence Automation)

**Il problema che risolve:** ogni giorno devo leggere grandi quantità di analisi
finanziaria da molti commentatori a pagamento. È lavoro manuale enorme.

**L'obiettivo:** un sistema automatico che aggrega le analisi di tutte le mie fonti,
le processa con AI, e mi consegna ogni mattina **un recap Telegram da 2-3 minuti** di
cosa hanno detto i guru quel giorno — con link alla versione estesa e possibilità di
interrogare il sistema su singoli ticker/argomenti citando le fonti.

**Il sistema deve ragionare come uno stratega di un hedge fund macro** — identificare
le asimmetrie che il mercato non ha ancora prezzato — NON come un giornalista che
riporta notizie.

**Vincoli non negoziabili:**
- Costo fisso ~€10/mese (server Hetzner) — tutto il resto a costo ZERO o pochi centesimi.
- Semplicità prima di tutto: meno codice = meno manutenzione.
- Validare prima di costruire: nessuna infrastruttura finché il prompt AI non produce
  output azionabile su dati reali. (✅ Test del prompt già superato a marzo 2026.)

**Stack tecnico:** Hetzner ARM + Docker + n8n + SQLite + Cloudflare Tunnel +
Gemini Flash/Pro + Telegram Bot. Cascata modelli a costo zero (free OpenRouter →
Gemini Flash → Qwen guardrail).

**Dove si inserisce questa chat:** stiamo costruendo il pezzo "sito intelligence hub"
— una pagina web dove confluiscono le fonti, che funge sia da mia dashboard sia da
pagina leggibile dalle AI in chat (via web_fetch) per generare report SENZA consumare
API. Iniziamo da **Yardeni** come primo caso pilota.

---

## 1. SCOPO GENERALE (la visione del sito)

Costruire **un unico sito** (`yardeni-intel.pages.dev` su Cloudflare Pages, poi
estendibile) che funzioni da **intelligence hub**:

- **Per me (Andrea):** dashboard di consultazione di tutte le mie fonti a pagamento.
- **Per le AI in chat:** pagina pubblica ma non rintracciabile (`noindex`), che incollo
  in chat e l'AI legge via `web_fetch` → produce report **senza consumare API**.
- **Logica di risparmio:** prima i "bottoni" generano prompt da incollare manualmente
  in chat (costo ZERO). Solo dopo, dove serve davvero, monto un'AI via API sul sito
  con la cascata a costo quasi-zero (modelli free OpenRouter → Gemini Flash → Qwen guardrail).

**Principio guida:** una fonte alla volta, ognuna in chat dedicata. Pareto + pragmatismo.
NON progettare tutte le 8 fonti insieme.

---

## 2. COSA STIAMO FACENDO PER YARDENI (azione immediata — già pronta)

**Stato:** script GAS già scritto e consegnato (`yardeni_publisher.gs`), in attesa di deploy.

**Architettura Yardeni (definitiva):**

| Layer | Fonte | Come arriva | Accesso |
|---|---|---|---|
| Macro (cornice) | `archive.yardeni.com/morning-briefing-2026/` | già pubblico, NON serve copiarlo | l'AI lo legge diretto |
| Tattico (trigger) | email a pagamento (QuickTakes, Market Calls) | script Google v2.5 → TXT su Drive | sito Cloudflare Pages |

**Flusso operativo:**
```
Durante la settimana: script v2.5 salva email Yardeni come TXT su Drive (già attivo)
Domenica 23:00: yardeni_publisher.gs legge i TXT della settimana →
                classifica per tipo → genera HTML → pubblica su Cloudflare Pages
Quando voglio analisi: incollo in chat i 2 URL (archivio + sito) →
                       l'AI legge entrambi → report combinato macro+tattico
```

**Classificazione automatica TXT (dal nome file):**
US MARKET CALL · GLOBAL MARKETS CALL · ECONOMIC WEEK AHEAD · WEEKLY WEBCAST ·
WEEKLY ROUNDUP · FOCUS SETTORIALE · QUICKTAKES (tutto il resto)

**Setup da completare (4 passi, solo browser, già documentati nello script):**
1. Crea progetto Cloudflare Pages "yardeni-intel" (Direct Upload)
2. Crea API Token Cloudflare (permesso Pages:Edit)
3. Incolla script su script.google.com + 3 costanti (Account ID, Token, Project name)
4. Test `testLocale` → poi `pubblicaYardeni` → trigger settimanale domenica

**Costo Yardeni:** ZERO (Cloudflare Pages free + Google Apps Script free).

---

## 3. ROADMAP ALTRE 7 FONTI (ragionata, da affrontare 1 alla volta)

Ordinate per **facilità di automazione** (Pareto: prima le facili).

### Gruppo A — già risolte o facilissime
| # | Fonte | Tipo | Strategia | Difficoltà |
|---|---|---|---|---|
| 1 | **Larry Williams** | cicli annuali statici | già fatto: PDF → contesto_mercati.md, memoria permanente | ✅ FATTO |
| 2 | **Seth Golden Telegram** | dinamico giornaliero | già fatto: Telethon → SQLite → Streamlit → prompt | ✅ FATTO |
| 3 | **Yardeni** | email + web | in corso: questo MVP | 🔧 IN CORSO |

### Gruppo B — automazione media (stesso pattern email di Yardeni)
| # | Fonte | Tipo | Strategia proposta | Difficoltà |
|---|---|---|---|---|
| 4 | **JC Parets** | email free daily | Stesso script GAS di Yardeni, MA serve **filtro anti-commerciale**: separare la parte operativa dalla parte promozionale/marketing dell'email. Criterio da definire empiricamente sui pattern reali. | 🟡 MEDIA |

### Gruppo C — richiedono login portale (automazione complessa)
| # | Fonte | Tipo | Problema | Strategia candidata |
|---|---|---|---|---|
| 5 | **Mark Newton (FSI)** | report PDF + video, login | login portale + report in PDF scaricabile + video Tom Lee solo video | Bookmarklet 1-click su pagina autenticata, OPPURE Playwright headless con sessione salvata (vedi file Playwright). Il PDF si estrae; il video Tom Lee resta nodo aperto. |
| 6 | **Seth Golden Finom report** | PDF 50pag, testo+grafici, login | report densi di grafici, solo Gemini Pro li legge bene, 5 alla volta | Bookmarklet cattura HTML autenticato → backend chunking testo+immagini → Gemini Flash vision. Valutare se ne vale la pena vs effort. |

### Gruppo D — video (trascrizione)
| # | Fonte | Tipo | Problema | Strategia candidata |
|---|---|---|---|---|
| 7 | **Ciovacco** | video YouTube settimanale | testo azionabile "tra le righe" + tanti grafici | yt-dlp → trascrizione audio → testo sul sito. Aperto: serve contesto grafici o basta testo? Test empirico. |
| 8 | **Sam Ro (TKer)** | articoli, login amico | bassa priorità, cadenza incerta | Fase 2. Bookmarklet quando serve. |

---

## 4. RICERCHE DA FARE (NON ora — quando si affronta ogni fonte)

Da NON fare adesso. Da lanciare in chat dedicata per ciascuna fonte:

- **JC Parets:** nessuna ricerca esterna — serve solo analizzare 5-6 email reali per
  trovare il pattern che separa contenuto operativo da marketing. Lavoro su dati, non ricerca web.
- **Mark Newton / Seth Finom (login):** ricerca su fattibilità Playwright headless con
  sessione persistente + se i portali FSI/Finom hanno protezioni anti-bot. (file Playwright già in progetto.)
- **Ciovacco:** ricerca/test se trascrizione audio-only basta o serve analisi video con grafici
  (test empirico su AI Studio con link video, prompt da validare).

**Verifica costi/tool (regola permanente):** ogni tool proposto va verificato con Perplexity
su limiti e disponibilità attuali PRIMA di procedere (i dati AI sono spesso obsoleti).

---

## 5. PRINCIPI OPERATIVI ATTIVI (da rispettare in ogni chat)

- Sito = pubblico ma `noindex, nofollow` (non Basic Auth: bloccherebbe le AI in chat).
- Costo target: ZERO o pochi centesimi/mese.
- Bottoni che generano prompt da incollare in chat PRIMA di montare API sul sito.
- Cascata modelli a costo zero: free OpenRouter → Gemini 2.5 Flash → Qwen guardrail.
- Una fonte alla volta. Semplicità vince. Niente over-engineering.
- Andrea NON è sviluppatore: ogni comando spiegato, sempre indicato DOVE eseguirlo.

---

## 6. PRIMO MESSAGGIO PER CHAT DEDICATA YARDENI (copia-incolla)

> Ruolo: sei un senior infrastructure architect + ex-trader. Stiamo completando il
> deploy del flusso Yardeni del mio sistema TIA (Trading Intelligence Automation).
> Ho già lo script GAS `yardeni_publisher.gs` (te lo allego) che legge i TXT delle email
> Yardeni da Google Drive, li classifica per tipo e li pubblica su Cloudflare Pages come
> dashboard `noindex`. Il Morning Briefing macro lo leggo separatamente da
> archive.yardeni.com. Devo: completare il setup Cloudflare (ho già l'account), testare
> il deploy, verificare che tu legga la pagina via web_fetch. Procediamo passo passo,
> io non sono sviluppatore. File da allegare: yardeni_publisher.gs, GURU.docx,
> questo handoff.
