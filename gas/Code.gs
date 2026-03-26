// ============================================================
// RouteLog - Google Apps Script バックエンド
//
// 【セットアップ手順】
//  1. Google スプレッドシートを新規作成
//  2. 拡張機能 → Apps Script を開く
//  3. このコードを貼り付けて保存
//  4. SS_ID に スプレッドシートのID を貼り付け
//     （スプレッドシートのURLの /d/XXXXX/ の部分）
//  5. デプロイ → 新しいデプロイ
//     種類: ウェブアプリ
//     次のユーザーとして実行: 自分
//     アクセスできるユーザー: 全員
//  6. デプロイURLをコピー → RouteLogの GAS_URL に貼り付け
// ============================================================

const SS_ID = '1mQFAmJgaVy8OIwVOntElEH0YWuVtnzrCtXgaZ131X54';

// ヘッダー定義
const LOG_HEADERS    = ['記録日時', '担当者', '移動手段', '移動距離(km)', '緯度', '経度', 'メモ', '受信日時'];
const CHECKIN_HEADERS = ['チェックイン日時', '担当者', '種別(朝/昼/夜)', '緯度', '経度', '受信日時'];

// -----------------------------------------------------------
// メインエントリーポイント
// -----------------------------------------------------------
function doPost(e) {
  // エディタから直接実行した場合のガード
  if (!e || !e.parameter) {
    return response('error: no parameter (direct execution not supported, use testLog/testCheckin)');
  }
  try {
    const p    = e.parameter;
    const type = p.type;
    const ss   = SpreadsheetApp.openById(SS_ID);
    const now  = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

    if (type === 'log') {
      writeLog(ss, p, now);
    } else if (type === 'checkin') {
      writeCheckin(ss, p, now);
    } else {
      return response('error: unknown type');
    }

    return response('ok');

  } catch (err) {
    console.error(err);
    return response('error: ' + err.message);
  }
}

// -----------------------------------------------------------
// 移動ログ書き込み
// -----------------------------------------------------------
function writeLog(ss, p, now) {
  const sheet = getOrCreateSheet(ss, 'logs', LOG_HEADERS);

  const dateStr = formatTimestamp(p.timestamp);
  sheet.appendRow([
    dateStr,
    p.userName  || '',
    p.mode      || '',
    parseFloat(p.distance) || 0,
    parseFloat(p.lat)      || 0,
    parseFloat(p.lng)      || 0,
    p.memo      || '',
    now
  ]);
}

// -----------------------------------------------------------
// チェックイン書き込み
// -----------------------------------------------------------
function writeCheckin(ss, p, now) {
  const sheet = getOrCreateSheet(ss, 'checkins', CHECKIN_HEADERS);

  const dateStr = formatTimestamp(p.timestamp);
  sheet.appendRow([
    dateStr,
    p.userName  || '',
    p.checkType || '',
    parseFloat(p.lat) || 0,
    parseFloat(p.lng) || 0,
    now
  ]);
}

// -----------------------------------------------------------
// シートを取得（なければ作成してヘッダーを追加）
// -----------------------------------------------------------
function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headerRow = sheet.getRange(1, 1, 1, headers.length);
    headerRow.setValues([headers]);
    headerRow.setFontWeight('bold');
    headerRow.setBackground('#2563eb');
    headerRow.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// -----------------------------------------------------------
// ISOタイムスタンプ → 日本時間の読みやすい形式
// -----------------------------------------------------------
function formatTimestamp(isoStr) {
  try {
    const d = new Date(isoStr);
    return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  } catch (e) {
    return isoStr || '';
  }
}

// -----------------------------------------------------------
// レスポンス生成
// -----------------------------------------------------------
function response(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// -----------------------------------------------------------
// ダッシュボード用データ取得 API（doGet）
// 呼び出し例: GAS_URL?date=2026/03/26
// -----------------------------------------------------------
function doGet(e) {
  try {
    const params   = (e && e.parameter) ? e.parameter : {};
    const date     = params.date ? params.date.replace(/-/g, '/') : getTodayStr();
    const callback = params.callback || null; // JSONP対応

    const ss       = SpreadsheetApp.openById(SS_ID);
    const logs     = getSheetDataByDate(ss, 'logs',     date);
    const checkins = getSheetDataByDate(ss, 'checkins', date);

    const json = JSON.stringify({ date, logs, checkins });

    // JSONP: callback=xxx がある場合は xxx({...}) 形式で返す
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errJson = JSON.stringify({ error: err.message });
    const callback = (e && e.parameter && e.parameter.callback) ? e.parameter.callback : null;
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + errJson + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService
      .createTextOutput(errJson)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 今日の日付文字列を返す（Asia/Tokyo）
function getTodayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd');
}

// シートから指定日付のデータを取得してオブジェクト配列で返す
function getSheetDataByDate(ss, sheetName, date) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(String);
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const cellVal = data[i][0];

    // スプレッドシートがDate型で保持している場合と文字列の場合を両方対応
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
        // Date型の値はすべて文字列に変換してJSONに含める
        obj[h] = (v instanceof Date)
          ? Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss')
          : v;
      });
      results.push(obj);
    }
  }
  return results;
}

// テスト用
function testGet() {
  const result = doGet({ parameter: { date: getTodayStr() } });
  console.log(result.getContent());
}

// -----------------------------------------------------------
// テスト用（Apps Script エディタから手動実行して確認）
// -----------------------------------------------------------
function testLog() {
  const ss = SpreadsheetApp.openById(SS_ID);
  writeLog(ss, {
    timestamp: new Date().toISOString(),
    userName:  'テスト太郎',
    mode:      '車',
    distance:  '3.5',
    lat:       '35.6895',
    lng:       '139.6917',
    memo:      '渋谷訪問'
  }, Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));
  console.log('testLog: OK');
}

function testCheckin() {
  const ss = SpreadsheetApp.openById(SS_ID);
  writeCheckin(ss, {
    timestamp: new Date().toISOString(),
    userName:  'テスト太郎',
    checkType: '朝',
    lat:       '35.6895',
    lng:       '139.6917'
  }, Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'));
  console.log('testCheckin: OK');
}
