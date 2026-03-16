'use strict';
const https = require('https');

const APP_ID = 'cli_a93d7aa044f8dcd2';
const APP_SECRET = 'KVWV9TgX1Q8xNjls9SAN5bOzHcfRlRbf';
const SPREADSHEET_TOKEN = 'JJbes3OPChjOQQtrbC2c4BFVnTa';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function request(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname, path, method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

exports.main_handler = async (event) => {
  // 处理 CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const payload = JSON.parse(event.body);

    // 1. 获取 tenant_access_token
    const tokenData = await request('POST', 'open.feishu.cn',
      '/open-apis/auth/v3/tenant_access_token/internal', {},
      { app_id: APP_ID, app_secret: APP_SECRET }
    );
    const token = tokenData.tenant_access_token;

    // 2. 获取第一个 sheet 的 ID
    const sheetsData = await request('GET', 'open.feishu.cn',
      `/open-apis/sheets/v3/spreadsheets/${SPREADSHEET_TOKEN}/sheets/query`,
      { Authorization: `Bearer ${token}` }
    );
    const sheetId = sheetsData.data.sheets[0].sheet_id;

    // 3. 追加一行数据
    const row = [
      payload.response_id,
      payload.condition,
      payload.user_question,
      String(payload.used_example),
      String(payload.input_valid),
      payload.submitted_at,
      payload.full_data,
    ];
    const result = await request('POST', 'open.feishu.cn',
      `/open-apis/sheets/v2/spreadsheets/${SPREADSHEET_TOKEN}/values_append`,
      { Authorization: `Bearer ${token}` },
      { valueRange: { range: `${sheetId}!A1:G1`, values: [row] } }
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: true, result }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
