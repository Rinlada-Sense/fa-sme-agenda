/**
 * SME How to Scale Expo 2026 – agenda picks collector
 *
 * Receives one anonymous record each time a visitor downloads their agenda
 * (image, copy as text, or calendar) and adds it as a row on the "Picks" tab.
 * "Most picked" and "Next session" tabs then count the results with formulas.
 *
 * SETUP (once, about 3 minutes)
 * 1. Create a new Google Sheet, e.g. "SME Expo 2026 – Agenda picks".
 * 2. Extensions → Apps Script. Delete what is there, paste this whole file, Save.
 * 3. Choose the function "setup" in the toolbar and click Run. Allow access when asked.
 * 4. Back in the sheet, open the "Session list" tab, click cell A1 and press "Allow access"
 *    (this links the session titles from the agenda editor sheet).
 * 5. In Apps Script: Deploy → New deployment → type "Web app"
 *      Execute as: Me
 *      Who has access: Anyone
 *    Click Deploy and copy the Web app URL (ends with /exec). Send that URL to Claude.
 *
 * WHAT IS STORED: time, day, the session ID in each of the 5 time slots, which button
 * was used, language, phone/tablet/desktop, and a random browser ID. No names, emails
 * or other personal details.
 */

var AGENDA_SHEET_ID = '1_aPPFCTuysdVxZhAN-80CrzA-rSOq6Vd7QhdVEHXRpQ'; // the agenda editor sheet
var PICKS_HEADERS = ['Time', 'Day', '9.00', '10.45', '13.00', '14.45', '16.30',
                     'Sessions (in order)', 'Pairs (A>B)', 'Action', 'Language', 'Device', 'Browser ID'];

// ---------------------------------------------------------------- receive a record
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var row = cleanRecord_(data);
    if (!row) return reply_({ ok: false, error: 'bad request' });
    lock.waitLock(10000);
    getSheet_('Picks').appendRow(row);
    return reply_({ ok: true });
  } catch (err) {
    return reply_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

// Opening the web app URL in a browser shows this, which is a quick way to check it is live.
function doGet() {
  return reply_({ ok: true, service: 'SME Expo agenda picks' });
}

/**
 * Expected body (sent by the agenda page as text/plain JSON):
 * {"day":1,"slots":["D1-02","D1-07","D1-13","D1-13",""],"action":"image",
 *  "lang":"th","device":"phone","client":"k3j9x0q2ab"}
 * A 2-slot workshop appears in both of its slots. Empty slot = "".
 * Anything that does not match is rejected, so the public URL cannot be used
 * to write arbitrary text into the sheet.
 */
function cleanRecord_(d) {
  var day = Number(d.day);
  if (day !== 1 && day !== 2) return null;

  var idPattern = new RegExp('^D' + day + '-\\d{2}$');
  if (!Array.isArray(d.slots) || d.slots.length !== 5) return null;
  var slots = [];
  for (var i = 0; i < 5; i++) {
    var s = String(d.slots[i] || '').trim();
    if (s && !idPattern.test(s)) return null;
    slots.push(s);
  }

  // sessions in time order, a workshop counted once
  var sessions = [];
  slots.forEach(function (s) { if (s && sessions[sessions.length - 1] !== s) sessions.push(s); });
  if (!sessions.length) return null;

  // "followed by": each session and the next one in the same day plan
  var pairs = [];
  for (var j = 1; j < sessions.length; j++) pairs.push(sessions[j - 1] + '>' + sessions[j]);

  var action = ['image', 'text', 'calendar'].indexOf(d.action) >= 0 ? d.action : null;
  if (!action) return null;
  var lang = ['en', 'th'].indexOf(d.lang) >= 0 ? d.lang : '';
  var device = ['phone', 'tablet', 'desktop'].indexOf(d.device) >= 0 ? d.device : '';
  var client = /^[a-z0-9]{6,32}$/i.test(String(d.client || '')) ? String(d.client) : '';

  return [new Date(), day].concat(slots, [sessions.join(','), pairs.join(','), action, lang, device, client]);
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// ---------------------------------------------------------------- one-time setup
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Bangkok');

  // Picks: one row per download
  var picks = getSheet_('Picks');
  picks.getRange(1, 1, 1, PICKS_HEADERS.length).setValues([PICKS_HEADERS]).setFontWeight('bold');
  picks.setFrozenRows(1);
  picks.getRange('A:A').setNumberFormat('dd mmm yyyy hh:mm');

  // Session list: live copy of the agenda editor's Sessions tab (for titles, rooms, times)
  var list = getSheet_('Session list');
  list.getRange('A1').setFormula('=IMPORTRANGE("' + AGENDA_SHEET_ID + '","Sessions!A1:M60")');

  // Most picked: every session, ranked by how many downloads included it
  var most = getSheet_('Most picked');
  most.clear();
  most.getRange('A1:G1').setValues([['Session ID', 'Picks', 'Day', 'Room', 'Time', 'Title (EN)', 'Title (TH)']])
      .setFontWeight('bold');
  most.setFrozenRows(1);
  most.getRange('A2').setFormula(
    '=IFERROR(QUERY(TOCOL(ARRAYFORMULA(SPLIT(FILTER(Picks!H2:H,Picks!H2:H<>""),",")),3),' +
    '"select Col1, count(Col1) group by Col1 order by count(Col1) desc label count(Col1) \'\'",0),"No picks yet")');
  most.getRange('C2').setFormula(
    '=ARRAYFORMULA(IF(($A2:$A="")+($A2:$A="No picks yet"),"",' +
    'IFERROR(VLOOKUP($A2:$A,\'Session list\'!$A:$M,{2,3,13,8,9},FALSE),"")))');

  // Next session: "chose A, then B next" pairs, ranked
  var next = getSheet_('Next session');
  next.clear();
  next.getRange('A1:G1').setValues([['From', 'To', 'People', 'From time', 'From title', 'To time', 'To title']])
      .setFontWeight('bold');
  next.setFrozenRows(1);
  next.getRange('A2').setFormula(
    '=IFERROR(LET(q,QUERY(TOCOL(ARRAYFORMULA(SPLIT(FILTER(Picks!I2:I,Picks!I2:I<>""),",")),3),' +
    '"select Col1, count(Col1) group by Col1 order by count(Col1) desc label count(Col1) \'\'",0),' +
    'HSTACK(ARRAYFORMULA(SPLIT(CHOOSECOLS(q,1),">")),CHOOSECOLS(q,2))),"No pairs yet")');
  next.getRange('D2').setFormula(
    '=ARRAYFORMULA(IF(($A2:$A="")+($A2:$A="No pairs yet"),"",' +
    'IFERROR(VLOOKUP($A2:$A,\'Session list\'!$A:$M,{13,8},FALSE),"")))');
  next.getRange('F2').setFormula(
    '=ARRAYFORMULA(IF($B2:$B="","",IFERROR(VLOOKUP($B2:$B,\'Session list\'!$A:$M,{13,8},FALSE),"")))');

  // tidy: drop the empty default tab, put the results first
  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (blank && blank.getLastRow() === 0) ss.deleteSheet(blank);
  ss.setActiveSheet(most); ss.moveActiveSheet(1);
  ss.setActiveSheet(next); ss.moveActiveSheet(2);
}

// Optional: run this from the editor to add one sample row and check the tabs fill in.
// Delete the sample row from "Picks" afterwards.
function testRecord() {
  var row = cleanRecord_({ day: 1, slots: ['D1-01', 'D1-07', 'D1-13', 'D1-13', 'D1-14'],
                           action: 'image', lang: 'en', device: 'desktop', client: 'test123' });
  getSheet_('Picks').appendRow(row);
}
