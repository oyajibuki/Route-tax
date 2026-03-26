// ============================================================
// RouteLog - Google Apps Script バックエンド v2
// ============================================================

const SS_ID = '1mQFAmJgaVy8OIwVOntElEH0YWuVtnzrCtXgaZ131X54';

const LOG_HEADERS    = ['記録日時', '担当者', '移動手段', '移動距離(km)', '緯度', '経度', 'メモ', '受信日時'];
const CHECKIN_HEADERS = ['チェックイン日時', '担当者', '種別(朝/昼/夜)', '緯度', '経度', '受信日時'];
const KPI_HEADERS    = ['日付', '担当者', '口座開設数', '受信日時'];

// -----------------------------------------------------------
// POST: log / checkin / kpi
// -----------------------------------------------------------
function doPost(e) {
  if (!e || !e.parameter) return response('error: no parameter');
  try {
    const p   = e.parameter;
    const ss  = SpreadsheetApp.openById(SS_ID);
    const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

    if      (p.type === 'log')     writeLog(ss, p, now);
    else if (p.type === 'checkin') writeCheckin(ss, p, now);
    else if (p.type === 'kpi')     writeKpi(ss, p, now);
    else return response('error: unknown type');

    return response('ok');
  } catch (err) {
    return response('error: ' + err.message);
  }
}

// -----------------------------------------------------------
// GET: date別データ返却（JSONP対応）
// -----------------------------------------------------------
function doGet(e) {
  try {
    const params   = (e && e.parameter) ? e.parameter : {};
    const date     = params.date ? params.date.replace(/-/g, '/') : getTodayStr();
    const callback = params.callback || null;

    const ss       = SpreadsheetApp.openById(SS_ID);
    const logs     = getSheetDataByDate(ss, 'logs',        date);
    const checkins = getSheetDataByDate(ss, 'checkins',    date);
    const kpis     = getSheetDataByDate(ss, 'oshipay_kpi', date);

    const json = JSON.stringify({ date, logs, checkins, kpis });

    if (callback) {
      return ContentService.createTextOutput(callback + '(' + json + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errJson = JSON.stringify({ error: err.message });
    const cb = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;
    if (cb) return ContentService.createTextOutput(cb + '(' + errJson + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(errJson).setMimeType(ContentService.MimeType.JSON);
  }
}

// -----------------------------------------------------------
// 書き込み関数
// -----------------------------------------------------------
function writeLog(ss, p, now) {
  const sheet = getOrCreateSheet(ss, 'logs', LOG_HEADERS);
  sheet.appendRow([formatTimestamp(p.timestamp), p.userName||'', p.mode||'', parseFloat(p.distance)||0, parseFloat(p.lat)||0, parseFloat(p.lng)||0, p.memo||'', now]);
}

function writeCheckin(ss, p, now) {
  const sheet = getOrCreateSheet(ss, 'checkins', CHECKIN_HEADERS);
  sheet.appendRow([formatTimestamp(p.timestamp), p.userName||'', p.checkType||'', parseFloat(p.lat)||0, parseFloat(p.lng)||0, now]);
}

function writeKpi(ss, p, now) {
  const sheet = getOrCreateSheet(ss, 'oshipay_kpi', KPI_HEADERS);
  sheet.appendRow([p.date || getTodayStr(), p.userName || '', parseInt(p.count) || 0, now]);
}

// -----------------------------------------------------------
// シート取得（なければ作成）
// -----------------------------------------------------------
function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const h = sheet.getRange(1, 1, 1, headers.length);
    h.setValues([headers]); h.setFontWeight('bold'); h.setBackground('#2563eb'); h.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// -----------------------------------------------------------
// 日付でフィルタしてオブジェクト配列を返す
// -----------------------------------------------------------
function getSheetDataByDate(ss, sheetName, date) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0].map(String);
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const cellVal = data[i][0];
    let rowDate;
    if (cellVal instanceof Date) {
      rowDate = Utilities.formatDate(cellVal, 'Asia/Tokyo', 'yyyy/MM/dd');
    } else {
      rowDate = String(cellVal).substring(0, 10);
    }
    if (rowDate === date) {
      const obj = {};
      headers.forEach((h, j) => {
        const v = data[i][j];
        obj[h] = (v instanceof Date) ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss') : v;
      });
      results.push(obj);
    }
  }
  return results;
}

// -----------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------
function getTodayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
}

function formatTimestamp(isoStr) {
  try {
    return Utilities.formatDate(new Date(isoStr), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  } catch (e) { return isoStr || ''; }
}

function response(msg) {
  return ContentService.createTextOutput(JSON.stringify({ status: msg })).setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------
// テスト用
// -----------------------------------------------------------
function testGet() {
  const result = doGet({ parameter: { date: getTodayStr() } });
  console.log(result.getContent());
}

function testKpi() {
  const ss = SpreadsheetApp.openById(SS_ID);
  writeKpi(ss, { date: getTodayStr(), userName: '田中', count: '3' },
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));
  console.log('testKpi: OK');
}
