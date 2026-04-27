/**
 * AIGS Email Scrapper — Loan form inbox → Sheet CRM → Uchat WhatsApp.
 *
 * Edit CONFIG below, then:
 *   1. Run setup() once to create the sheet and grant scopes.
 *   2. Deploy → New deployment → Web app to get the UI URL.
 *   3. Run installHourlyTrigger() once to auto-scrape.
 */

const CONFIG = {
  // Gmail search. Tighten this to match your real form emails so spam never enters.
  // Examples:
  //   'from:noreply@yoursite.com subject:"New Loan Application"'
  //   'to:leads@yoursite.com subject:"Loan Form" -label:scrapped'
  GMAIL_QUERY: 'subject:"New Loan Application" newer_than:30d',

  // Sheet that acts as your CRM. Leave SHEET_ID blank on first run; setup() fills it in.
  SHEET_ID: '',
  SHEET_NAME: 'Leads',

  // Gmail label applied to processed threads so they aren't re-scraped.
  PROCESSED_LABEL: 'scrapped',

  // Uchat External Trigger URL (Flow → External Trigger node → copy URL).
  UCHAT_TRIGGER_URL: '',

  // Default country code prepended to phones missing one. India = '91'.
  DEFAULT_COUNTRY_CODE: '91',

  // Field map: Sheet column header  ->  regex run against the email body.
  // The first capture group is the value. Order here = column order in the sheet.
  FIELDS: {
    'Name':        /Name\s*[:\-]\s*(.+)/i,
    'Phone':       /(?:Phone|Mobile|WhatsApp)\s*[:\-]\s*([+\d\s\-()]+)/i,
    'Email':       /Email\s*[:\-]\s*([^\s<>]+@[^\s<>]+)/i,
    'Loan Amount': /(?:Loan\s*Amount|Amount)\s*[:\-]\s*([\d,\.]+)/i,
    'Purpose':     /(?:Purpose|Reason)\s*[:\-]\s*(.+)/i,
  },
};

const SHEET_HEADERS = [
  'Received At', 'Message ID',
  ...Object.keys(CONFIG.FIELDS),
  'WA Status', 'WA Sent At', 'Notes',
];

const PROPS = PropertiesService.getScriptProperties();

// ─── Web app entry ─────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Loan Leads CRM')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─── One-time setup ────────────────────────────────────────────────────────
function setup() {
  let sheetId = CONFIG.SHEET_ID || PROPS.getProperty('SHEET_ID');
  let ss;
  if (sheetId) {
    ss = SpreadsheetApp.openById(sheetId);
  } else {
    ss = SpreadsheetApp.create('Loan Leads CRM');
    sheetId = ss.getId();
    PROPS.setProperty('SHEET_ID', sheetId);
  }
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(SHEET_HEADERS);
    sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  ensureLabel_(CONFIG.PROCESSED_LABEL);
  const url = ss.getUrl();
  Logger.log('Sheet ready: ' + url);
  Logger.log('Sheet ID: ' + sheetId);
  return { sheetId: sheetId, sheetUrl: url };
}

function installHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'scrapeInbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scrapeInbox').timeBased().everyHours(1).create();
}

// ─── Scrape ────────────────────────────────────────────────────────────────
function scrapeInbox() {
  const sheet = getSheet_();
  const label = ensureLabel_(CONFIG.PROCESSED_LABEL);
  const seen = new Set(getColumnValues_(sheet, 'Message ID'));
  const query = CONFIG.GMAIL_QUERY + ' -label:' + CONFIG.PROCESSED_LABEL;
  const threads = GmailApp.search(query, 0, 50);

  let added = 0;
  threads.forEach(thread => {
    thread.getMessages().forEach(msg => {
      const id = msg.getId();
      if (seen.has(id)) return;
      const body = msg.getPlainBody();
      const parsed = parseBody_(body);
      if (!hasMinimum_(parsed)) return;

      const row = [msg.getDate(), id];
      Object.keys(CONFIG.FIELDS).forEach(h => row.push(parsed[h] || ''));
      row.push('pending', '', '');
      sheet.appendRow(row);
      seen.add(id);
      added++;
    });
    thread.addLabel(label);
  });
  return { scanned: threads.length, added: added };
}

function parseBody_(body) {
  const out = {};
  Object.keys(CONFIG.FIELDS).forEach(field => {
    const m = body.match(CONFIG.FIELDS[field]);
    if (m) out[field] = m[1].trim().replace(/\s+/g, ' ');
  });
  if (out['Phone']) out['Phone'] = normalizePhone_(out['Phone']);
  return out;
}

function hasMinimum_(parsed) {
  // A row only counts as a real lead if at least Name + Phone parsed.
  return parsed['Name'] && parsed['Phone'];
}

function normalizePhone_(raw) {
  let digits = String(raw).replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  if (!digits.startsWith(CONFIG.DEFAULT_COUNTRY_CODE)) {
    digits = CONFIG.DEFAULT_COUNTRY_CODE + digits;
  }
  return digits;
}

// ─── Uchat ─────────────────────────────────────────────────────────────────
function sendToUchat(messageId) {
  if (!CONFIG.UCHAT_TRIGGER_URL) {
    return { ok: false, error: 'UCHAT_TRIGGER_URL not configured.' };
  }
  const sheet = getSheet_();
  const rowIndex = findRowByMessageId_(sheet, messageId);
  if (rowIndex < 0) return { ok: false, error: 'Row not found.' };

  const row = sheet.getRange(rowIndex, 1, 1, SHEET_HEADERS.length).getValues()[0];
  const record = {};
  SHEET_HEADERS.forEach((h, i) => { record[h] = row[i]; });
  if (!record['Phone']) return { ok: false, error: 'Missing phone.' };

  const payload = {
    user_ns: record['Phone'],
    phone: record['Phone'],
    name: record['Name'],
    email: record['Email'],
    loan_amount: record['Loan Amount'],
    purpose: record['Purpose'],
    received_at: record['Received At'],
  };
  const res = UrlFetchApp.fetch(CONFIG.UCHAT_TRIGGER_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const ok = code >= 200 && code < 300;
  const status = ok ? 'sent' : 'error ' + code;
  sheet.getRange(rowIndex, indexOf_('WA Status') + 1).setValue(status);
  sheet.getRange(rowIndex, indexOf_('WA Sent At') + 1).setValue(ok ? new Date() : '');
  if (!ok) sheet.getRange(rowIndex, indexOf_('Notes') + 1).setValue(res.getContentText().slice(0, 500));
  return { ok: ok, code: code, body: res.getContentText().slice(0, 500) };
}

function sendAllPending() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return { sent: 0 };
  const data = sheet.getRange(2, 1, last - 1, SHEET_HEADERS.length).getValues();
  const idCol = indexOf_('Message ID');
  const statusCol = indexOf_('WA Status');
  let sent = 0, failed = 0;
  data.forEach(row => {
    if (row[statusCol] === 'pending') {
      const r = sendToUchat(row[idCol]);
      if (r.ok) sent++; else failed++;
    }
  });
  return { sent: sent, failed: failed };
}

// ─── Read for UI ───────────────────────────────────────────────────────────
function getLeads() {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const values = sheet.getRange(2, 1, last - 1, SHEET_HEADERS.length).getValues();
  return values.map(row => {
    const o = {};
    SHEET_HEADERS.forEach((h, i) => { o[h] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
    return o;
  }).reverse();
}

function getConfigStatus() {
  return {
    sheetUrl: getSheetUrl_(),
    uchatConfigured: !!CONFIG.UCHAT_TRIGGER_URL,
    query: CONFIG.GMAIL_QUERY,
  };
}

// ─── Excel export ──────────────────────────────────────────────────────────
function exportXlsxUrl() {
  const id = CONFIG.SHEET_ID || PROPS.getProperty('SHEET_ID');
  return 'https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx';
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getSheet_() {
  const id = CONFIG.SHEET_ID || PROPS.getProperty('SHEET_ID');
  if (!id) throw new Error('Run setup() first.');
  return SpreadsheetApp.openById(id).getSheetByName(CONFIG.SHEET_NAME);
}
function getSheetUrl_() {
  const id = CONFIG.SHEET_ID || PROPS.getProperty('SHEET_ID');
  return id ? SpreadsheetApp.openById(id).getUrl() : '';
}
function ensureLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
function getColumnValues_(sheet, header) {
  const col = indexOf_(header) + 1;
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, col, last - 1, 1).getValues().map(r => r[0]);
}
function indexOf_(header) {
  return SHEET_HEADERS.indexOf(header);
}
function findRowByMessageId_(sheet, messageId) {
  const ids = getColumnValues_(sheet, 'Message ID');
  const i = ids.indexOf(messageId);
  return i < 0 ? -1 : i + 2;
}
