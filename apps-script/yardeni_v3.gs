// ============================================================
// YARDENI INTEL v3 — Gmail → sito con GRAFICI
//
// Sostituisce DUE script vecchi:
//   - "salvaMailYardeniSuDrive" v2.5 (Gmail → TXT su Drive)
//   - "YARDENI WEEKLY PUBLISHER" (TXT → index.html solo testo)
//
// Cosa fa, ad ogni esecuzione (trigger ogni ora):
//   1. Cerca le email Yardeni non ancora pubblicate (etichetta YARDENI_WEB)
//   2. Dall'HTML dell'email ritaglia SOLO l'articolo (testo + grafici)
//   3. Salva su Drive: TXT (come prima) + HTML (sottocartella "HTML")
//   4. Pubblica su GitHub in UN SOLO commit:
//        articoli/<data>-<titolo>.html   → pagina del singolo articolo
//        index.html                      → dashboard ultimi N giorni + archivio
//        articoli.json                   → elenco di tutti gli articoli
//      Cloudflare Pages vede il commit e aggiorna il sito da solo.
//
// I grafici NON vengono copiati: restano sui server di Yardeni (storage.ghost.io)
// e la pagina li mostra direttamente, come fa Gmail.
//
// SETUP: vedi docs/GUIDA_SETUP_v3.md
// ============================================================

// ── CONFIGURAZIONE ──────────────────────────────────────────
var MITTENTE           = "yardeni-research@ghost.io";
var DRIVE_FOLDER_ID    = "1rN2KOpXmJWLwP2s-P6EZYgzJRUYg1tSF";   // cartella YARDENI_EMAIL_ESTRATTE
var GITHUB_USER        = "qwertyprova8";
var GITHUB_REPO        = "yardeni-intel";
var GITHUB_BRANCH      = "main";
var LABEL_WEB          = "YARDENI_WEB";         // email già pubblicate sul sito
var LABEL_TXT          = "SALVATO_SU_DRIVE";    // stessa etichetta dello script v2.5
var DATA_INIZIO        = "2026/01/01";          // recupero arretrato: email da questa data in poi
var GIORNI_FINESTRA    = 14;                    // giorni mostrati per intero in index.html
var MAX_PER_ESECUZIONE = 50;                    // email per esecuzione (limite 6 minuti di Google)
// Il token GitHub NON va scritto qui: va in Impostazioni progetto → Proprietà script
// con nome GITHUB_TOKEN (così il codice si può caricare su GitHub senza rischi).
// ────────────────────────────────────────────────────────────

var CATEGORIE = [
  { id: "US_MARKET_CALL", titolo: "🇺🇸 US MARKET CALL",      desc: "Posizionamento tattico mercato US — settori, livelli S&P, raccomandazioni peso" },
  { id: "GLOBAL_CALL",    titolo: "🌍 GLOBAL MARKETS CALL",  desc: "Tattico internazionale — Go Global vs Stay Home, EM, Europa, Giappone" },
  { id: "SETTORIALE",     titolo: "🏭 FOCUS SETTORIALE",     desc: "US Sectors Call e analisi per settore" },
  { id: "QUICKTAKE",      titolo: "📋 QUICKTAKES",           desc: "Analisi macro discorsiva — view strutturale, temi di fondo" },
  { id: "WEEK_AHEAD",     titolo: "📅 ECONOMIC WEEK AHEAD",  desc: "Preview settimana — dati macro attesi, eventi Fed, earnings" },
  { id: "WEEKLY_ROUNDUP", titolo: "📊 WEEKLY ROUNDUP",       desc: "Recap settimanale — summary performance e temi" },
  { id: "WEBCAST",        titolo: "🎙️ WEBCAST",              desc: "Link e note webcast settimanale" }
];

// ============================================================
// FUNZIONE PRINCIPALE — collegala al trigger orario
// ============================================================
function aggiornaYardeni() {
  var token = leggiToken_();
  var label = etichetta_(LABEL_WEB);
  var labelTxt = etichetta_(LABEL_TXT);

  var threads = GmailApp.search(
    "from:" + MITTENTE + " -label:" + LABEL_WEB + " after:" + DATA_INIZIO, 0, MAX_PER_ESECUZIONE);
  if (threads.length === 0) {
    Logger.log("Nessuna nuova email Yardeni.");
    return;
  }

  var cartella     = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var cartellaHtml = sottocartella_(cartella, "HTML");
  var manifest     = leggiManifest_(cartellaHtml);
  var fileGitHub   = {};

  threads.forEach(function(thread) {
    var giaTxt = thread.getLabels().some(function(l) { return l.getName() === LABEL_TXT; });
    thread.getMessages().forEach(function(msg) {
      if (msg.getFrom().indexOf(MITTENTE) === -1) return;
      var art = elaboraMessaggio_(msg);
      if (!giaTxt) salvaTxt_(cartella, art, msg);
      if (art.categoria === "SKIP") { Logger.log("Saltata (promo): " + art.titolo); return; }
      salvaFile_(cartellaHtml, art.slug + ".html", art.html, MimeType.HTML);
      manifest[art.slug] = { slug: art.slug, data: art.data, titolo: art.titolo, categoria: art.categoria };
      fileGitHub["articoli/" + art.slug + ".html"] = paginaArticolo_(art);
      Logger.log("Elaborata: " + art.slug);
    });
  });

  var elenco = elencoOrdinato_(manifest);
  salvaFile_(cartellaHtml, "articoli.json", JSON.stringify(elenco, null, 1), MimeType.PLAIN_TEXT);
  fileGitHub["index.html"]    = generaIndex_(elenco, leggiFinestra_(cartellaHtml, elenco), oraLocale_());
  fileGitHub["articoli.json"] = JSON.stringify(elenco, null, 1);

  commitGitHub_(token, fileGitHub, "Yardeni: " + Object.keys(fileGitHub).length + " file — " + oraLocale_());

  // Le etichette si mettono SOLO dopo il commit riuscito:
  // se GitHub fallisce, alla prossima ora si riprova da capo.
  threads.forEach(function(t) { t.addLabel(label); t.addLabel(labelTxt); });
  Logger.log("OK — " + threads.length + " email pubblicate. Sito aggiornato tra ~1 minuto.");
}

// Rigenera solo index.html da Drive (es. dopo aver cambiato GIORNI_FINESTRA)
function rigeneraIndex() {
  var cartellaHtml = sottocartella_(DriveApp.getFolderById(DRIVE_FOLDER_ID), "HTML");
  var elenco = elencoOrdinato_(leggiManifest_(cartellaHtml));
  commitGitHub_(leggiToken_(), {
    "index.html": generaIndex_(elenco, leggiFinestra_(cartellaHtml, elenco), oraLocale_()),
    "articoli.json": JSON.stringify(elenco, null, 1)
  }, "Yardeni: rigenera index — " + oraLocale_());
}

// Prova SENZA pubblicare: elabora l'ultima email e salva l'anteprima su Drive
function testAnteprima() {
  var threads = GmailApp.search("from:" + MITTENTE, 0, 1);
  if (!threads.length) { Logger.log("Nessuna email trovata da " + MITTENTE); return; }
  var msgs = threads[0].getMessages();
  var art  = elaboraMessaggio_(msgs[msgs.length - 1]);
  var f = salvaFile_(DriveApp.getFolderById(DRIVE_FOLDER_ID), "ANTEPRIMA_v3.html",
                     paginaArticolo_(art), MimeType.HTML);
  Logger.log("Titolo: " + art.titolo + " | Categoria: " + art.categoria + " | Slug: " + art.slug);
  Logger.log("Grafici trovati: " + (art.html.match(/<img /g) || []).length);
  Logger.log("Anteprima salvata su Drive: " + f.getUrl());
  Logger.log("Token GitHub presente: " + (PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN") ? "SI" : "NO"));
}

// ============================================================
// ELABORAZIONE EMAIL
// ============================================================
function elaboraMessaggio_(msg) {
  var data   = Utilities.formatDate(msg.getDate(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var titolo = msg.getSubject();
  var html   = estraiContenuto_(msg.getBody());
  if (!html) html = "<pre>" + escape_(testoPulito_(msg.getPlainBody())) + "</pre>";
  return { data: data, titolo: titolo, categoria: classifica_(titolo),
           slug: data + "-" + slugify_(titolo), html: html };
}

// Ghost (la piattaforma di Yardeni) racchiude l'articolo tra due commenti fissi.
function estraiContenuto_(htmlEmail) {
  var inizio = htmlEmail.indexOf("<!-- POST CONTENT START -->");
  var fine   = htmlEmail.indexOf("<!-- POST CONTENT END -->");
  if (inizio === -1 || fine === -1 || fine < inizio) return null;
  return pulisciHtml_(htmlEmail.substring(inizio + 27, fine));
}

function pulisciHtml_(s) {
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|iframe|form)\b[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "");
  // box "Join the discussion..." in fondo a ogni articolo
  s = s.replace(/<div class="kg-card kg-callout-card[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g, function(box) {
    return /Join the discussion|log in to the Yardeni/i.test(box) ? "" : box;
  });
  s = s.replace(/<img[^>]*\bwidth="1"[^>]*\bheight="1"[^>]*>/gi, "");   // pixel di tracciamento
  s = s.replace(/\sstyle="[^"]*"/gi, "");
  s = s.replace(/\s(bgcolor|valign|align|border)="[^"]*"/gi, "");
  s = s.replace(/<img /gi, '<img referrerpolicy="no-referrer" ');
  s = s.replace(/<a (?![^>]*target=)/gi, '<a target="_blank" rel="noopener" ');
  return s.trim();
}

function classifica_(titolo) {
  var n = titolo.toUpperCase();
  if (/\bSALE\b|% OFF|\d+ ?OFF\b|DISCOUNT|UPGRADE NOW|LAST ?CHANCE/.test(n)) return "SKIP";
  if (n.indexOf("US MARKET CALL") !== -1)      return "US_MARKET_CALL";
  if (n.indexOf("GLOBAL MARKET") !== -1)       return "GLOBAL_CALL";
  if (n.indexOf("SECTORS CALL") !== -1 || n.indexOf("SECTOR CALL") !== -1) return "SETTORIALE";
  if (n.indexOf("ECONOMIC WEEK AHEAD") !== -1) return "WEEK_AHEAD";
  if (n.indexOf("WEBCAST") !== -1)             return "WEBCAST";
  if (n.indexOf("WEEKLY ROUNDUP") !== -1)      return "WEEKLY_ROUNDUP";
  var SETTORI = ["MATERIALS", "CONSUMER STAPLES", "CONSUMER DISCRETIONARY", "ENERGY", "HEALTH CARE",
                 "HEALTHCARE", "FINANCIALS", "INDUSTRIALS", "INFORMATION TECHNOLOGY",
                 "COMMUNICATION SERVICES", "UTILITIES", "REAL ESTATE"];
  if (SETTORI.some(function(x) { return n.indexOf(x + ":") === 0; })) return "SETTORIALE";
  return "QUICKTAKE";
}

// Stessa pulizia dello script v2.5, usata per il TXT e come ripiego
function testoPulito_(corpo) {
  corpo = corpo.replace(/<[^>]+>/g, "").replace(/\[image:[^\]]+\]/g, "").replace(/\[https?:\/\/[^\]\s]+\]/g, "");
  var righe = corpo.split("\n"), out = [];
  for (var j = 0; j < righe.length; j++) {
    var r = righe[j].trim();
    if (r.length === 0 || /^[\W_]+$/.test(r)) continue;
    if (/View in browser|Unsubscribe|Manage preferences|Copyright|All rights reserved|View All QuickTakes|More like this|Less like this|View Our Live Charts|Comment|Join the discussion/i.test(r)) continue;
    if (/^Photo by|^Exclusive Early Access|^By Ed Yardeni|^https?:\/\//i.test(r)) continue;
    out.push(r);
  }
  return out.join("\n\n");
}

function salvaTxt_(cartella, art, msg) {
  var oggettoSafe = art.titolo.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim().substring(0, 50);
  salvaFile_(cartella, art.data + " - " + oggettoSafe + ".txt", testoPulito_(msg.getPlainBody()), MimeType.PLAIN_TEXT);
}

function slugify_(t) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 70)
          .replace(/-+$/, "");
}

function escape_(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ============================================================
// GENERAZIONE PAGINE
// ============================================================
var CSS_ =
  "body{font-family:Georgia,serif;max-width:900px;margin:40px auto;padding:0 16px;background:#f9f7f2;color:#1a1a1a;line-height:1.7;}" +
  "h1{font-size:1.6em;border-bottom:3px solid #8b1a1a;padding-bottom:10px;color:#8b1a1a;}" +
  "h2{font-size:1.15em;background:#8b1a1a;color:#fff;padding:8px 14px;margin-top:40px;border-radius:3px;}" +
  "h3{font-size:1.05em;color:#8b1a1a;margin:6px 0 12px;}h3 a{color:inherit;text-decoration:none;}h3 a:hover{text-decoration:underline;}" +
  ".meta{font-size:0.8em;color:#888;margin-bottom:30px;}" +
  ".desc{font-size:0.85em;color:#666;margin:-8px 0 16px;}" +
  ".card{background:#fff;border:1px solid #e0dcd5;border-radius:4px;padding:18px 22px;margin-bottom:18px;}" +
  ".tag{display:inline-block;font-size:0.7em;font-family:monospace;background:#f0ece4;border:1px solid #ccc;padding:2px 7px;border-radius:2px;color:#555;}" +
  ".empty{color:#aaa;font-style:italic;font-size:0.9em;}" +
  ".articolo p{margin:0 0 1.2em;}.articolo img{display:block;max-width:100%;height:auto;margin:14px auto;border:1px solid #eee;}" +
  ".articolo pre{white-space:pre-wrap;word-wrap:break-word;font-family:Georgia,serif;margin:0;}" +
  "details>summary{cursor:pointer;color:#8b1a1a;font-size:0.9em;margin-top:6px;}" +
  ".morning-link{background:#e8f4e8;border:1px solid #aed4ae;border-radius:4px;padding:12px 16px;margin-bottom:20px;font-size:0.9em;}" +
  ".morning-link a{color:#2d6a2d;font-weight:bold;}" +
  ".archivio li{margin:2px 0;font-size:0.92em;}.archivio a{color:#1a1a1a;}";

function testaPagina_(titolo) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<meta name="robots" content="noindex, nofollow">\n<meta name="referrer" content="no-referrer">\n' +
    "<title>" + escape_(titolo) + "</title>\n<style>" + CSS_ + "</style>\n</head>\n<body>\n";
}

function nomeCategoria_(id) {
  for (var i = 0; i < CATEGORIE.length; i++) if (CATEGORIE[i].id === id) return CATEGORIE[i].titolo;
  return id;
}

function paginaArticolo_(art) {
  return testaPagina_(art.titolo + " — Yardeni") +
    '<p class="meta"><a href="../index.html">← Yardeni Intelligence Hub</a></p>\n' +
    '<span class="tag">' + art.data + "</span> <span class=\"tag\">" + nomeCategoria_(art.categoria) + "</span>\n" +
    "<h1>" + escape_(art.titolo) + "</h1>\n" +
    '<div class="articolo">\n' + art.html + "\n</div>\n</body>\n</html>";
}

// elenco: tutti gli articoli (più recenti prima); contenuti: {slug: html} per quelli nella finestra
function generaIndex_(elenco, contenuti, aggiornato) {
  var h = testaPagina_("Yardeni Intel — " + aggiornato);
  h += "<h1>📊 Yardeni Research — Intelligence Hub</h1>\n";
  h += '<div class="meta">Aggiornato: ' + aggiornato + " &nbsp;|&nbsp; Ultimi " + GIORNI_FINESTRA +
       " giorni per intero &nbsp;|&nbsp; Articoli in archivio: " + elenco.length + "</div>\n";
  var anno = aggiornato.substring(6, 10);
  h += '<div class="morning-link">📰 <strong>Morning Briefing (archivio pubblico):</strong> ' +
       '<a href="https://archive.yardeni.com/morning-briefing-' + anno + '/" target="_blank">archive.yardeni.com/morning-briefing-' +
       anno + "/</a></div>\n";

  var recenti = elenco.filter(function(a) { return contenuti.hasOwnProperty(a.slug); });
  CATEGORIE.forEach(function(cat) {
    var arts = recenti.filter(function(a) { return a.categoria === cat.id; });
    h += "<h2>" + cat.titolo + "</h2>\n<p class=\"desc\">" + escape_(cat.desc) + "</p>\n";
    if (!arts.length) { h += '<p class="empty">Nessun articolo di questo tipo negli ultimi ' + GIORNI_FINESTRA + " giorni.</p>\n"; return; }
    arts.forEach(function(a, i) {
      h += '<div class="card">\n<span class="tag">' + a.data + "</span>\n" +
           '<h3><a href="articoli/' + a.slug + '.html">' + escape_(a.titolo) + "</a></h3>\n";
      // il più recente di ogni sezione è aperto, gli altri si espandono con un clic
      h += (i === 0 ? '<div class="articolo">' : '<details><summary>Leggi articolo</summary><div class="articolo">') +
           contenuti[a.slug] + (i === 0 ? "</div>" : "</div></details>") + "\n</div>\n";
    });
  });

  h += "<h2>🗂️ ARCHIVIO COMPLETO</h2>\n";
  var mese = "";
  elenco.forEach(function(a) {
    var m = a.data.substring(0, 7);
    if (m !== mese) { h += (mese ? "</ul>\n" : "") + "<h3>" + m + '</h3>\n<ul class="archivio">\n'; mese = m; }
    h += '<li><span class="tag">' + a.data + '</span> <a href="articoli/' + a.slug + '.html">' + escape_(a.titolo) + "</a></li>\n";
  });
  if (mese) h += "</ul>\n";
  h += '<div class="meta" style="margin-top:40px;border-top:1px solid #ddd;padding-top:12px;">' +
       "Generato automaticamente da Google Apps Script (v3) &nbsp;|&nbsp; Solo uso interno &nbsp;|&nbsp; noindex</div>\n</body>\n</html>";
  return h;
}

function elencoOrdinato_(manifest) {
  return Object.keys(manifest).map(function(k) { return manifest[k]; })
    .sort(function(a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : (a.slug < b.slug ? 1 : -1); });
}

// ============================================================
// DRIVE
// ============================================================
function sottocartella_(padre, nome) {
  var it = padre.getFoldersByName(nome);
  return it.hasNext() ? it.next() : padre.createFolder(nome);
}

function salvaFile_(cartella, nome, contenuto, mime) {
  var esistenti = cartella.getFilesByName(nome);
  while (esistenti.hasNext()) esistenti.next().setTrashed(true);
  return cartella.createFile(nome, contenuto, mime);
}

function leggiManifest_(cartellaHtml) {
  var it = cartellaHtml.getFilesByName("articoli.json");
  if (!it.hasNext()) return {};
  var m = {};
  JSON.parse(it.next().getBlob().getDataAsString()).forEach(function(a) { m[a.slug] = a; });
  return m;
}

function leggiFinestra_(cartellaHtml, elenco) {
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - GIORNI_FINESTRA);
  var limite = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var contenuti = {};
  elenco.forEach(function(a) {
    if (a.data < limite) return;
    var it = cartellaHtml.getFilesByName(a.slug + ".html");
    if (it.hasNext()) contenuti[a.slug] = it.next().getBlob().getDataAsString();
  });
  return contenuti;
}

// ============================================================
// GITHUB — più file in UN SOLO commit (= un solo deploy Cloudflare)
// ============================================================
function commitGitHub_(token, files, messaggio) {
  var base = "https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/git/";
  var ref    = gh_(token, "GET",  base + "ref/heads/" + GITHUB_BRANCH);
  var parent = ref.object.sha;
  var commit = gh_(token, "GET",  base + "commits/" + parent);
  var tree   = gh_(token, "POST", base + "trees", {
    base_tree: commit.tree.sha,
    tree: Object.keys(files).map(function(p) {
      return { path: p, mode: "100644", type: "blob", content: files[p] };
    })
  });
  var nuovo = gh_(token, "POST", base + "commits", { message: messaggio, tree: tree.sha, parents: [parent] });
  gh_(token, "PATCH", base + "refs/heads/" + GITHUB_BRANCH, { sha: nuovo.sha });
  Logger.log("Commit GitHub: " + nuovo.sha.substring(0, 7));
}

function gh_(token, metodo, url, corpo) {
  var opt = {
    method: metodo,
    headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json" },
    muteHttpExceptions: true
  };
  if (corpo) { opt.contentType = "application/json"; opt.payload = JSON.stringify(corpo); }
  var r = UrlFetchApp.fetch(url, opt);
  var code = r.getResponseCode();
  if (code >= 300) {
    throw new Error("GitHub " + metodo + " " + url.split("/git/")[1] + " → HTTP " + code + ": " +
      r.getContentText().substring(0, 300) +
      (code === 401 ? "\n→ Token scaduto o sbagliato: rigeneralo (vedi guida, passo 2)." : "") +
      (code === 403 || code === 404 ? "\n→ Il token non ha il permesso 'Contents: Read and write' sul repo " + GITHUB_REPO + "." : ""));
  }
  return JSON.parse(r.getContentText());
}

// ============================================================
// UTILITÀ
// ============================================================
function leggiToken_() {
  var t = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!t) throw new Error("Manca il token: Impostazioni progetto (⚙️) → Proprietà script → aggiungi GITHUB_TOKEN.");
  return t.trim();
}

function etichetta_(nome) {
  return GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
}

function oraLocale_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
}
