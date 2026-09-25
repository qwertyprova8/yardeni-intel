// ============================================================
// YARDENI WEEKLY PUBLISHER
// Legge TXT da Google Drive → classifica per tipo →
// genera HTML dashboard → pubblica su Cloudflare Pages
//
// SETUP (una tantum):
//   1. Vai su https://dash.cloudflare.com/
//   2. Sinistra: "Workers & Pages" → "Pages" → "Create" → "Direct Upload"
//   3. Nome progetto: "yardeni-intel" → Upload un file index.html vuoto
//   4. Sinistra: "My Profile" → "API Tokens" → "Create Token"
//      Template: "Edit Cloudflare Workers" → aggiungi permesso "Cloudflare Pages:Edit"
//      Zone Resources: "All zones" → crea token → copia il valore
//   5. Vai su: https://dash.cloudflare.com/ → copia l'Account ID (in alto a destra)
//   6. In questo script: incolla le 3 costanti sotto
//
// TRIGGER:
//   In Apps Script → "Trigger" → aggiungi:
//   Funzione: pubblicaYardeni | Tipo: Time-driven | Domenica | 23:00-00:00
// ============================================================

// ── CONFIGURAZIONE ──────────────────────────────────────────
var DRIVE_FOLDER_ID = "1rN2KOpXmJWLwP2s-P6EZYgzJRUYg1tSF"; // cartella Drive con TXT Yardeni
var GITHUB_USER     = "qwertyprova8";                        // username GitHub
var GITHUB_REPO     = "yardeni-intel";                       // nome repository GitHub
var GITHUB_TOKEN    = "INCOLLA_QUI_TOKEN_GITHUB";            // token GitHub (non condividere mai in chat)
var GIORNI_FINESTRA = 7;                                     // quanti giorni di storia includere
// ────────────────────────────────────────────────────────────

function pubblicaYardeni() {
  var files = leggiFilesSettimana_();
  if (files.length === 0) {
    Logger.log("Nessun file trovato negli ultimi " + GIORNI_FINESTRA + " giorni.");
    return;
  }

  var classificati = classificaFiles_(files);
  var html         = generaHTML_(classificati);
  var esito        = pubblicaSuCloudflare_(html);

  Logger.log("Pubblicazione completata: " + esito);
}

// ── STEP 1: leggi file Drive degli ultimi N giorni ──────────
// Usa la data nel NOME del file (YYYY-MM-DD) — non la metadata Drive
// che riflette la data di sincronizzazione, non quella dell'email
function leggiFilesSettimana_() {
  var cartella = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var files    = cartella.getFilesByType(MimeType.PLAIN_TEXT);
  var risultati = [];
  var cutoff   = new Date();
  cutoff.setDate(cutoff.getDate() - GIORNI_FINESTRA);
  cutoff.setHours(0, 0, 0, 0);

  while (files.hasNext()) {
    var f = files.next();
    var nome = f.getName();

    // Estrai data dal nome file (formato: YYYY-MM-DD - Titolo.txt)
    var match = nome.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) continue;

    var dataFile = new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3])
    );

    if (dataFile >= cutoff) {
      risultati.push({
        nome:  nome,
        testo: f.getBlob().getDataAsString(),
        data:  dataFile
      });
    }
  }

  risultati.sort(function(a, b) { return a.data - b.data; });
  Logger.log("File trovati: " + risultati.length);
  risultati.forEach(function(f) { Logger.log(" -> " + f.nome); });
  return risultati;
}

// ── STEP 2: classifica per tipo dal nome file ────────────────
// Tipi identificati dall'analisi dei TXT reali:
//   US_MARKET_CALL   → "US MARKET CALL" nel nome
//   GLOBAL_CALL      → "GLOBAL MARKET CALL" o "GLOBAL MARKETS CALL"
//   WEEK_AHEAD       → "ECONOMIC WEEK AHEAD"
//   WEBCAST          → "WEEKLY WEBCAST"
//   WEEKLY_ROUNDUP   → "Weekly Roundup"
//   SETTORIALE       → nomi di settori noti (MATERIALS, CONSUMER, ENERGY...)
//   QUICKTAKE        → tutto il resto (analisi discorsiva firmata Yardeni)

function classificaFiles_(files) {
  var bucket = {
    US_MARKET_CALL:  [],
    GLOBAL_CALL:     [],
    WEEK_AHEAD:      [],
    WEBCAST:         [],
    WEEKLY_ROUNDUP:  [],
    SETTORIALE:      [],
    QUICKTAKE:       []
  };

  var SETTORI = ["MATERIALS", "CONSUMER STAPLES", "CONSUMER DISCRETIONARY",
                 "ENERGY", "HEALTH CARE", "FINANCIALS", "INDUSTRIALS",
                 "INFORMATION TECHNOLOGY", "COMMUNICATION", "UTILITIES", "REAL ESTATE"];

  files.forEach(function(f) {
    var n = f.nome.toUpperCase();
    if      (n.indexOf("US MARKET CALL") !== -1)                 bucket.US_MARKET_CALL.push(f);
    else if (n.indexOf("GLOBAL MARKET") !== -1)                  bucket.GLOBAL_CALL.push(f);
    else if (n.indexOf("ECONOMIC WEEK AHEAD") !== -1)            bucket.WEEK_AHEAD.push(f);
    else if (n.indexOf("WEEKLY WEBCAST") !== -1)                 bucket.WEBCAST.push(f);
    else if (n.indexOf("WEEKLY ROUNDUP") !== -1)                 bucket.WEEKLY_ROUNDUP.push(f);
    else if (SETTORI.some(function(s){ return n.indexOf(s) !== -1; })) bucket.SETTORIALE.push(f);
    else                                                         bucket.QUICKTAKE.push(f);
  });

  return bucket;
}

// ── STEP 3: genera HTML ──────────────────────────────────────
function generaHTML_(classificati) {
  var oggi = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  var dal  = new Date(); dal.setDate(dal.getDate() - GIORNI_FINESTRA);
  var dalStr = Utilities.formatDate(dal, Session.getScriptTimeZone(), "dd/MM/yyyy");

  var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n';
  html += '<meta charset="UTF-8">\n';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += '<meta name="robots" content="noindex, nofollow">\n';  // non indicizzare
  html += '<title>Yardeni Intel — ' + oggi + '</title>\n';
  html += '<style>\n';
  html += 'body{font-family:Georgia,serif;max-width:900px;margin:40px auto;padding:0 20px;';
  html += 'background:#f9f7f2;color:#1a1a1a;line-height:1.7;}\n';
  html += 'h1{font-size:1.6em;border-bottom:3px solid #8b1a1a;padding-bottom:10px;color:#8b1a1a;}\n';
  html += 'h2{font-size:1.15em;background:#8b1a1a;color:#fff;padding:8px 14px;margin-top:40px;border-radius:3px;}\n';
  html += 'h3{font-size:1em;color:#8b1a1a;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px;}\n';
  html += '.meta{font-size:0.8em;color:#888;margin-bottom:30px;}\n';
  html += '.card{background:#fff;border:1px solid #e0dcd5;border-radius:4px;padding:18px 22px;margin-bottom:18px;}\n';
  html += '.tag{display:inline-block;font-size:0.7em;font-family:monospace;background:#f0ece4;';
  html += 'border:1px solid #ccc;padding:2px 7px;border-radius:2px;margin-bottom:8px;color:#555;}\n';
  html += '.empty{color:#aaa;font-style:italic;font-size:0.9em;}\n';
  html += 'pre{white-space:pre-wrap;word-wrap:break-word;font-family:Georgia,serif;font-size:0.95em;margin:0;}\n';
  html += '.morning-link{background:#e8f4e8;border:1px solid #aed4ae;border-radius:4px;';
  html += 'padding:12px 16px;margin-bottom:20px;font-size:0.9em;}\n';
  html += '.morning-link a{color:#2d6a2d;font-weight:bold;}\n';
  html += '</style>\n</head>\n<body>\n';

  html += '<h1>📊 Yardeni Research — Intelligence Hub</h1>\n';
  html += '<div class="meta">Aggiornato: ' + oggi + ' &nbsp;|&nbsp; Finestra: ' + dalStr + ' → oggi &nbsp;|&nbsp; ';
  html += 'File elaborati: ' + contaTotale_(classificati) + '</div>\n';

  // Link Morning Briefing pubblico (sempre disponibile)
  var anno = new Date().getFullYear();
  html += '<div class="morning-link">📰 <strong>Morning Briefing (archivio pubblico):</strong> ';
  html += '<a href="https://archive.yardeni.com/morning-briefing-' + anno + '/" target="_blank">';
  html += 'archive.yardeni.com/morning-briefing-' + anno + '/</a> — accessibile direttamente</div>\n';

  // Sezioni in ordine di priorità operativa
  html += sezioneHTML_("🇺🇸 US MARKET CALL", classificati.US_MARKET_CALL,
    "Posizionamento tattico mercato US — settori, livelli S&P, raccomandazioni peso");
  html += sezioneHTML_("🌍 GLOBAL MARKETS CALL", classificati.GLOBAL_CALL,
    "Tattico internazionale — Go Global vs Stay Home, EM, Europa, Giappone");
  html += sezioneHTML_("🏭 FOCUS SETTORIALE", classificati.SETTORIALE,
    "Analisi per settore — Materials, Energy, Health Care, ecc.");
  html += sezioneHTML_("📋 QUICKTAKES", classificati.QUICKTAKE,
    "Analisi macro discorsiva — view strutturale, temi di fondo");
  html += sezioneHTML_("📅 ECONOMIC WEEK AHEAD", classificati.WEEK_AHEAD,
    "Preview settimana — dati macro attesi, eventi Fed, earnings");
  html += sezioneHTML_("📊 WEEKLY ROUNDUP", classificati.WEEKLY_ROUNDUP,
    "Recap settimanale — summary performance e temi");
  html += sezioneHTML_("🎙️ WEBCAST", classificati.WEBCAST,
    "Link e note webcast settimanale");

  html += '\n<div class="meta" style="margin-top:40px;border-top:1px solid #ddd;padding-top:12px;">';
  html += 'Generato automaticamente da Google Apps Script &nbsp;|&nbsp; Solo uso interno &nbsp;|&nbsp; noindex</div>\n';
  html += '</body>\n</html>';

  return html;
}

function sezioneHTML_(titolo, files, descrizione) {
  var s = '<h2>' + titolo + '</h2>\n';
  s += '<p style="font-size:0.85em;color:#666;margin-top:-8px;margin-bottom:16px;">' + descrizione + '</p>\n';

  if (files.length === 0) {
    s += '<p class="empty">Nessun file di questo tipo nella finestra temporale.</p>\n';
    return s;
  }

  files.forEach(function(f) {
    // estrai data dal nome file (formato: YYYY-MM-DD - Titolo.txt)
    var dataMatch = f.nome.match(/^(\d{4}-\d{2}-\d{2})/);
    var dataLabel = dataMatch ? dataMatch[1] : "";
    // estrai titolo pulito
    var titoloFile = f.nome.replace(/^\d{4}-\d{2}-\d{2}\s*-\s*/, "").replace(/\.txt$/i, "");
    // tronca testo molto lungo (max 8000 chars per card)
    var testo = f.testo.trim();
    var troncato = false;
    if (testo.length > 8000) {
      testo = testo.substring(0, 8000);
      troncato = true;
    }
    // escape HTML
    testo = testo.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    s += '<div class="card">\n';
    s += '<span class="tag">' + dataLabel + '</span>\n';
    s += '<h3>' + titoloFile + '</h3>\n';
    s += '<pre>' + testo;
    if (troncato) s += '\n\n[... testo troncato a 8000 caratteri ...]';
    s += '</pre>\n</div>\n';
  });

  return s;
}

function contaTotale_(classificati) {
  var tot = 0;
  Object.keys(classificati).forEach(function(k){ tot += classificati[k].length; });
  return tot;
}

// ── STEP 4: pubblica su GitHub → Cloudflare Pages deploy automatico ─
// Apps Script fa PUT base64 su GitHub API → Cloudflare Pages rileva il commit → deploy automatico
function pubblicaSuCloudflare_(htmlContent) {

  var apiUrl = "https://api.github.com/repos/" + GITHUB_USER + "/" + GITHUB_REPO + "/contents/index.html";

  // Recupera SHA del file attuale (necessario per aggiornare file esistente)
  var getSha = UrlFetchApp.fetch(apiUrl, {
    method: "GET",
    headers: {
      "Authorization": "token " + GITHUB_TOKEN,
      "Accept": "application/vnd.github.v3+json"
    },
    muteHttpExceptions: true
  });

  var sha = "";
  if (getSha.getResponseCode() === 200) {
    sha = JSON.parse(getSha.getContentText()).sha;
    Logger.log("SHA attuale: " + sha);
  }

  // Converti HTML in base64
  var base64Html = Utilities.base64Encode(htmlContent, Utilities.Charset.UTF_8);

  // Costruisci payload
  var payload = {
    message: "Yardeni weekly update " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    content: base64Html,
    branch: "main"
  };
  if (sha) payload.sha = sha;

  // PUT su GitHub
  var response = UrlFetchApp.fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Authorization": "token " + GITHUB_TOKEN,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  Logger.log("GitHub Response [" + code + "]: " + response.getContentText().substring(0, 200));

  if (code === 200 || code === 201) {
    Logger.log("OK - Pubblicato su GitHub. Cloudflare Pages si aggiornera in ~30 secondi.");
    Logger.log("URL: https://" + GITHUB_REPO + ".pages.dev");
    return "OK";
  } else {
    Logger.log("ERRORE GitHub. Eseguo Piano B (Drive).");
    salvaBackupDrive_(htmlContent);
    return "PIANO_B";
  }
}

// ── Piano B (primario stabile): salva HTML su Drive ──────────
// Il file viene salvato nella cartella Yardeni con nome fisso.
// Lo condividi pubblicamente una volta sola → URL fisso permanente.
function salvaBackupDrive_(htmlContent) {
  var cartella = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  var nomeFile = "YARDENI_DASHBOARD.html";

  // Elimina versione precedente (stesso nome → URL Drive stabile)
  var esistenti = cartella.getFilesByName(nomeFile);
  while (esistenti.hasNext()) { esistenti.next().setTrashed(true); }

  // Crea nuovo file
  var nuovoFile = cartella.createFile(nomeFile, htmlContent, MimeType.HTML);

  // Rendi pubblico (chiunque con il link può vedere)
  nuovoFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId  = nuovoFile.getId();
  var urlView = "https://drive.google.com/file/d/" + fileId + "/view";
  var urlDirect = "https://drive.google.com/uc?export=view&id=" + fileId;

  Logger.log("✅ Dashboard salvata su Drive: " + nomeFile);
  Logger.log("📎 URL visualizzazione: " + urlView);
  Logger.log("🔗 URL diretto (per AI web_fetch): " + urlDirect);
}

// ── FUNZIONE DI TEST (eseguila manualmente per verificare) ───
function testLocale() {
  var files = leggiFilesSettimana_();
  Logger.log("File trovati: " + files.length);
  files.forEach(function(f){ Logger.log(f.nome); });
  var classificati = classificaFiles_(files);
  Object.keys(classificati).forEach(function(k){
    Logger.log(k + ": " + classificati[k].length + " file");
  });
  var html = generaHTML_(classificati);
  Logger.log("HTML generato: " + html.length + " caratteri");
  // Per vedere l'HTML: copia il log e aprilo in un browser
}
