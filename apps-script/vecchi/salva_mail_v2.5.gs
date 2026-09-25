function salvaMailYardeniSuDrive() {
  var folderId = "1rN2KOpXmJWLwP2s-P6EZYgzJRUYg1tSF"; 
  var mittente = "yardeni-research@ghost.io"; 
  var etichettaProcessata = "SALVATO_SU_DRIVE"; 

  var cartella = DriveApp.getFolderById(folderId);
  var label = GmailApp.getUserLabelByName(etichettaProcessata);
  if (!label) { label = GmailApp.createLabel(etichettaProcessata); }

  var threads = GmailApp.search('from:' + mittente + ' -label:' + etichettaProcessata, 0, 50);

  if (threads.length === 0) {
    console.log("Nessuna nuova email da processare.");
    return;
  }

  for (var i = 0; i < threads.length; i++) {
    var messaggi = threads[i].getMessages();
    var messaggio = messaggi[messaggi.length - 1]; 
    
    var data = Utilities.formatDate(messaggio.getDate(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    var oggetto = messaggio.getSubject();
    var corpo = messaggio.getPlainBody(); 

    corpo = corpo.replace(/<[^>]+>/g, '').replace(/\[image:[^\]]+\]/g, '').replace(/\[https?:\/\/[^\]\s]+\]/g, '');
    corpo = corpo.replace(/[-_]{3,}\s*(Forwarded message|Messaggio inoltrato)\s*[-_]{3,}[\s\S]*?(Subject:|Oggetto:).*?\n/gi, '');
    corpo = corpo.replace(/^(Da|From|Date|Data|Subject|Oggetto|To|A):.*\n/gim, '');

    var righe = corpo.split('\n');
    var righePulite = [];
    for (var j = 0; j < righe.length; j++) {
      var riga = righe[j].trim();
      if (riga.length === 0 || /^[\W_]+$/.test(riga)) continue; 
      if (riga.match(/View in browser|Unsubscribe|Manage preferences|Copyright|All rights reserved|View All QuickTakes|More like this|Less like this|View Our Live Charts|Comment|Join the discussion/i)) continue;
      if (riga.match(/^Photo by|^Exclusive Early Access|^By Ed Yardeni|^https?:\/\//i)) continue;
      if (riga.length < 3 && !riga.match(/[a-zA-Z0-9]/)) continue; 
      righePulite.push(riga);
    }
    corpo = righePulite.join('\n\n'); 

    var oggettoSafe = oggetto.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    if (oggettoSafe.length > 50) oggettoSafe = oggettoSafe.substring(0, 50);
    var nomeFile = data + " - " + oggettoSafe + ".txt";

    cartella.createFile(nomeFile, corpo, MimeType.PLAIN_TEXT);
    threads[i].addLabel(label);
    console.log("Salvato: " + nomeFile);
  }
}