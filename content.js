/* Edit all German names, labels, story scenes and rewards here. */
window.CONTENT = {
  app: { title:'Die Einhorn-Rettung', eyebrow:'EIN MAGISCHES TEAMABENTEUER', footer:'Gemeinsam sind wir magisch.' },
  teams: [
    { id:'monster', name:'Die kleinen Monster', short:'Monster', word:'BREIT', gestures:['Monster-Krallen','Monster-Brüllen','Monster-Sprung'], reward:{icon:'🥤',name:'Besonderer Zaubertrank',text:'Euer Mut hat einen besonderen Zaubertrank freigeschaltet!'} },
    { id:'octopus', name:'Die kleinen Oktopusse', short:'Oktopusse', word:'WIESEN', gestures:['Oktopus-Arme','Oktopus-Welle','Oktopus-Stern'], reward:{icon:'🍫',name:'Besondere Zauberschokolade',text:'Euer Zusammenhalt hat eine besondere Schokolade freigeschaltet!'} },
    { id:'crocodile', name:'Die kleinen Krokodile', short:'Krokodile', word:'SCHULE', gestures:['Krokodil-Schnapp','Krokodil-Schleich','Krokodil-Power'], reward:{icon:'🔥',name:'Magischer Grill-Marshmallow',text:'Eure Klugheit hat einen gegrillten Marshmallow freigeschaltet!'} }
  ],
  icons:[['star','⭐','Stern'],['moon','🌙','Mond'],['rainbow','🌈','Regenbogen'],['heart','🧡','Herz'],['cloud','☁️','Wolke'],['sun','☀️','Sonne'],['diamond','🔷','Diamant'],['flower','🌼','Blume'],['butterfly','🦋','Schmetterling'],['lightning','⚡','Blitz'],['wand','🪄','Zauberstab'],['leaf','🍃','Blatt'],['comet','☄️','Komet'],['crown','👑','Krone'],['gem','💎','Zauberstein']],
  powers:[{icon:'⭐',name:'Mut'},{icon:'🌈',name:'Zusammenhalt'},{icon:'💎',name:'Klugheit'}],
  screens:{home:'Start',setup:'Kinder & Teams',reveal:'Unsere Rettungsteams',intro:'Die Geschichte',warmup:'Unser Teamzeichen',level1:'Level 1 · 5 Matten',level2:'Level 2 · 4 Matten',level3:'Level 3 · Buchstabensuche',destination:'Der nächste Ort',waiting:'Bis zum Finale',finale:'Das Einhorn retten',found:'Findet das Einhorn!',rewards:'Geheime Team-Belohnungen',done:'Geschafft!',progress:'Unsere Zauberkraft'},
  ui:{
    next:'Weiter',back:'Zurück',home:'Zum Start',organizer:'Spielleitung',close:'Schließen',presentation:'Präsentationsmodus',exitPresentation:'Präsentationsmodus verlassen',progress:'Unsere Zauberkraft',setup:'Kinder & Teams vorbereiten',resume:'Abenteuer fortsetzen',begin:'Teams zeigen',startAdventure:'JA! ABENTEUER STARTEN',skip:'Intro überspringen',replayIntro:'Intro wiederholen',replayFinale:'Finale wiederholen',
    complete:'✓ Aufgabe geschafft',wordFound:'✓ Wort gefunden',undo:'Rückgängig',completed:'Geschafft!',pending:'Noch unterwegs',ready:'Bereit fürs Finale!',locked:'Zuerst müssen alle drei Teams die vorherigen Aufgaben schaffen.',waitTeams:'Weiter, sobald alle drei Teams fertig sind.',unlock:'FINALE FREISCHALTEN',startFinale:'Finale starten',confirmFound:'Das Einhorn ist gefunden!',nextReward:'Nächste Team-Belohnung',finish:'🎉 Geschafft!',
    reset:'Spiel zurücksetzen',resetQuestion:'Wirklich alles zurücksetzen?',resetDetail:'Alle Namen, Teams, Teamzeichen und Fortschritte werden gelöscht.',cancel:'Abbrechen',confirmReset:'Ja, alles zurücksetzen',edit:'Namen & Teams bearbeiten',jump:'Zu einer Station',completions:'Aufgaben & Zauberkräfte',answers:'Wortteile für die Spielleitung',
    name:'Name',icon:'Symbol',team:'Team',slot:'Kind {n}',empty:'Name (optional)',childrenCount:'{n} Kinder dabei',noChildren:'Hier ist noch niemand eingetragen.',childRequired:'Trage mindestens ein Kind ein.',saved:'Automatisch gespeichert',saveFailed:'Speichern ist gerade nicht möglich. Bitte diese Seite geöffnet lassen.',corruptSave:'Der gespeicherte Spielstand konnte nicht gelesen werden. Bitte prüfe die Teams.',
    selected:'Gewählt',selectGesture:'Wählt euer Teamzeichen.',countdown:'3 – 2 – 1 – TEAMFOTO!',photo:'📷 Erinnerungsfoto machen',photoHint:'Optional: Kamera oder Bildauswahl öffnen. Fotos werden hier nicht gespeichert. Bitte direkt am Gerät sichern.',photoSelected:'Bild ausgewählt. Die App speichert keine Fotos; bitte über die Kamera oder Foto-App sichern.',
    rewardUnlocked:'{team} haben etwas freigeschaltet!',rewardCounter:'GEHEIME BELOHNUNG {n} / 3',levelLabel:'LEVEL {n} / 3',powerRestored:'{power} zurückgebracht!',progressCount:'{n} / 3',allPowers:'Alle drei Zauberkräfte sind zurück!',organizerHint:'Die Spielleitung führt euch durch das Abenteuer.',missingPart:'Findet euer fehlendes Wortteil!',wordSlots:'{n} fehlende Buchstaben',revealDestination:'Spur aufdecken',toWaiting:'Weiter · Bis zu Hause',replayDestination:'Spur noch einmal zeigen',stepCounter:'SZENE {n} / {total}',finaleUnavailable:'Für das Finale brauchen alle Teams alle drei Zauberkräfte.',returnGame:'Zurück zum Abenteuer',teamGesture:'Teamzeichen',progressHint:'Jeder Schritt bringt die Magie zurück.',rewardLocked:'Die Belohnungen warten, bis das Einhorn gefunden wurde.',resetDone:'Das Spiel wurde zurückgesetzt.'
  },
  home:{tag:'DIE EINHORN-RETTUNG',title:'Kleine Teams.\nGroße Magie.',text:'Ein Zaubersturm. Ein verschwundenes Einhorn. Und ihr könnt es gemeinsam retten!',mission:'EURE MISSION',missionText:'Bringt Mut, Zusammenhalt und Klugheit zurück.',stats:['3 Rettungsteams','3 Abenteuer','1 Einhorn'],prepare:'Vor der Party',prepareText:'Namen eintragen, Symbole wählen und Teams zusammenstellen.'},
  setup:{title:'Wer rettet das Einhorn?',text:'12 Plätze, drei Rettungsteams. Leere Plätze sind völlig okay.',help:'Vier Plätze pro Team sind vorbereitet. Du kannst jedes Kind einem anderen Team zuordnen.'},
  reveal:{title:'Das sind unsere Rettungsteams!',text:'Findet euren Namen, euer Symbol und euer Team.'},
  warmup:{title:'So sieht euer Team aus!',text:'Wählt eine Bewegung. Macht sie gemeinsam. Bereit fürs Teamfoto?'},
  intro:[
    {visual:'happy',text:'Im Zauberland lebte ein kleines Einhorn.',duration:6500},
    {visual:'storm',text:'Doch plötzlich kam ein großer Zaubersturm!',duration:7000},
    {visual:'lost',text:'Mut, Zusammenhalt und Klugheit gingen verloren. Das kleine Einhorn verschwand.',duration:9000},
    {visual:'teams',text:'Nur drei mutige Rettungsteams können seine Zauberkräfte zurückbringen. Seid ihr bereit?',duration:8500}
  ],
  levels:[
    {title:'Der Regenbogenweg',subtitle:'5 Matten · Ein mutiger erster Schritt',story:'Der Regenbogenweg ist kaputt. Könnt ihr gemeinsam ans andere Ufer kommen?',organizer:'Jedes Team bekommt 5 Matten. Nach dem gemeinsamen Überqueren die Aufgabe als geschafft markieren.',rules:['Ihr dürft den Boden nicht berühren.','Bleibt als Team zusammen.','Gebt die hintere Matte nach vorne.','Kommt gemeinsam ans Ziel.'],mats:5},
    {title:'Der Sturm ist zurück!',subtitle:'5 → 4 Matten · Gemeinsam schafft ihr das',story:'Oh nein! Der Zaubersturm hat eine Regenbogenmatte weggeweht! Schafft ihr den Weg jetzt auch mit nur 4 Matten?',organizer:'Eine Matte pro Team wegnehmen. Jetzt stehen jedem Team nur 4 Matten zur Verfügung.',rules:['Ihr dürft den Boden nicht berühren.','Jetzt habt ihr nur 4 Matten.','Helft euch gegenseitig.','Kommt wieder gemeinsam ans Ziel.'],mats:4},
    {title:'Die Buchstaben-Schatzsuche',subtitle:'Die letzte Spur · Eure Klugheit ist gefragt',story:'Das Einhorn hat uns eine letzte Spur hinterlassen. Jedes Team muss sein fehlendes Wortteil finden!',organizer:'Die vorbereiteten Wortteile draußen verstecken. Jedes Team sucht sein eigenes Teil. Erst nach dem echten Fund bestätigen.',rules:['Sucht gemeinsam nach eurem Wortteil.','Bringt eure Fundstücke zusammen.','Zeigt sie der Spielleitung.']}
  ],
  destination:[
    {visual:'words',text:'Drei Teams. Drei Teile. Eine gemeinsame Spur.',duration:3500},
    {visual:'joined',text:'Ihr habt den nächsten Ort gefunden!',duration:3500},
    {visual:'courtyard',text:'Auf zum Breitwiesenschule-Hof!',duration:3500}
  ],
  waiting:{title:'Die Spur führt euch weiter.',text:'Auf zum Breitwiesenschule-Hof! Das Einhorn bleibt noch verschwunden …',hint:'Nach eurer Zeit im Hof geht es nach Hause. Dort startet die Spielleitung das Finale.',readyTitle:'Alle Zauberkräfte sind gesammelt.',readyText:'Zu Hause geht die Rettung weiter.'},
  finale:[
    {visual:'weak',text:'Das Einhorn wartet auf seine verlorene Magie …',duration:4500},
    {visual:'restore',text:'Mut. Zusammenhalt. Klugheit. Eure Zauberkräfte kehren zurück!',duration:5500},
    {visual:'happy',text:'Ihr habt meine Magie zurückgebracht!',duration:4000},
    {visual:'thanks',text:'Danke, kleine Monster!\nDanke, kleine Oktopusse!\nDanke, kleine Krokodile!',duration:5500},
    {visual:'pause',text:'Aber wartet …',duration:1800},
    {visual:'near',text:'Das Einhorn ist ganz in eurer Nähe!',duration:3500}
  ],
  found:{title:'FINDET DAS EINHORN!',text:'Das Einhorn ist ganz in eurer Nähe!',hint:'Erst weiter, wenn die Kinder den echten Einhorn-Ballon entdeckt haben.'},
  done:{title:'IHR HABT DAS EINHORN GERETTET!',text:'Gemeinsam sind wir magisch.'},
  destinationWords:{parts:['BREIT','WIESEN','SCHULE'],joined:'BREITWIESENSCHULE',final:'HOF'}
};
