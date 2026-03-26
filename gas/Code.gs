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
