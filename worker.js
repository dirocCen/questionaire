// Cloudflare Worker — 接收实验数据并写入飞书电子表格
// 部署后将 Worker URL 填入 index.html 的 WORKER_ENDPOINT

const APP_ID = 'cli_a93d7aa044f8dcd2';
const APP_SECRET = 'KVWV9TgX1Q8xNjls9SAN5bOzHcfRlRbf';

// 第一次调用 /setup 后，把返回的 spreadsheetToken 填在这里
const SPREADSHEET_TOKEN = 'JJbes3OPChjOQQtrbC2c4BFVnTa';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function getAccessToken() {
  const resp = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    }
  );
  const data = await resp.json();
  if (!data.tenant_access_token) throw new Error('获取飞书 token 失败: ' + JSON.stringify(data));
  return data.tenant_access_token;
}

// 一次性调用：创建应用自己拥有的电子表格，返回新 token
async function createSpreadsheet(token) {
  const resp = await fetch(
    'https://open.feishu.cn/open-apis/sheets/v3/spreadsheets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: '实验数据收集' }),
    }
  );
  return await resp.json();
}

async function getFirstSheetId(token, spreadsheetToken) {
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${spreadsheetToken}/sheets/query`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  if (!data.data || !data.data.sheets || data.data.sheets.length === 0) {
    throw new Error('获取 Sheet 列表失败: ' + JSON.stringify(data));
  }
  return data.data.sheets[0].sheet_id;
}

async function appendRow(token, sheetId, row) {
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${SPREADSHEET_TOKEN}/values_append`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueRange: {
          range: `${sheetId}!A:H`,
          values: [row],
        },
      }),
    }
  );
  const data = await resp.json();
  if (data.code !== 0) throw new Error('写入飞书失败: ' + JSON.stringify(data));
  return data;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // 一次性初始化接口：GET /setup
    if (url.pathname === '/setup') {
      try {
        const token = await getAccessToken();
        const result = await createSpreadsheet(token);
        return new Response(JSON.stringify(result, null, 2), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: '无效 JSON' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    try {
      const token = await getAccessToken();
      const sheetId = await getFirstSheetId(token, SPREADSHEET_TOKEN);

      const row = [
        payload.response_id    ?? '',
        payload.condition      ?? '',
        payload.user_question  ?? '',
        payload.used_example   ? 'TRUE' : 'FALSE',
        payload.reading_time_ms ?? '',
        payload.input_valid    ? 'TRUE' : 'FALSE',
        payload.submitted_at   ?? '',
        typeof payload.full_data === 'string'
          ? payload.full_data
          : JSON.stringify(payload.full_data ?? ''),
      ];

      await appendRow(token, sheetId, row);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error(err);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
