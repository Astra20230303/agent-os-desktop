#!/usr/bin/env node
'use strict';

const baseUrl = String(process.env.OCTOP_URL || 'http://127.0.0.1:8088').replace(/\/+$/, '');
const username = process.env.OCTOP_USERNAME || '';
const password = process.env.OCTOP_PASSWORD || '';
const checkWs = !!process.env.OCTOP_WS;
const createThread = !!process.env.OCTOP_CREATE_THREAD;
const checkBrowser = !!process.env.OCTOP_BROWSER;

async function request(path, options = {}) {
  const headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(`${baseUrl}/api${path}`, Object.assign({}, options, { headers })); }
  catch (error) { throw new Error(`${path} 无法连接 ${baseUrl}：${error.message}`); }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { throw new Error(`${path} 返回了非 JSON 响应（HTTP ${response.status}）`); }
  if (!response.ok) throw new Error(`${path} 失败（HTTP ${response.status}）：${data?.error?.message || text || '未知错误'}`);
  return data;
}

function checkWebSocket(agentId, token) {
  if (typeof WebSocket !== 'function') throw new Error('当前 Node 运行时没有 WebSocket 客户端');
  const wsBase = baseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${wsBase}/api/agents/${encodeURIComponent(agentId)}/chat/ws?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => { socket.close(); reject(new Error('WebSocket ping 超时')); }, 5000);
    let settled = false;
    const fail = (error) => { if (settled) return; settled = true; clearTimeout(timer); try { socket.close(); } catch {} reject(error); };
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'ping' })));
    socket.addEventListener('message', (event) => {
      let data;
      try { data = JSON.parse(String(event.data)); } catch { return fail(new Error('WebSocket 返回了非 JSON 响应')); }
      if (data.type === 'pong') { settled = true; clearTimeout(timer); socket.close(); resolve(); }
      else if (data.type === 'error') fail(new Error(data.message || 'WebSocket 返回错误'));
    });
    socket.addEventListener('error', () => fail(new Error('WebSocket 连接失败')));
    socket.addEventListener('close', () => { if (!settled) fail(new Error('WebSocket 在 pong 前关闭')); });
  });
}

function checkNotificationWebSocket(token) {
  if (typeof WebSocket !== 'function') throw new Error('当前 Node 运行时没有 WebSocket 客户端');
  const wsBase = baseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${wsBase}/api/notifications/ws?token=${encodeURIComponent(token)}`);
    const timer = setTimeout(() => { socket.close(); reject(new Error('通知 WebSocket ping 超时')); }, 5000);
    let settled = false;
    const fail = (error) => { if (settled) return; settled = true; clearTimeout(timer); try { socket.close(); } catch {} reject(error); };
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'ping' })));
    socket.addEventListener('message', (event) => {
      let data;
      try { data = JSON.parse(String(event.data)); } catch { return fail(new Error('通知 WebSocket 返回了非 JSON 响应')); }
      if (data.type === 'pong') { settled = true; clearTimeout(timer); socket.close(); resolve(); }
    });
    socket.addEventListener('error', () => fail(new Error('通知 WebSocket 连接失败')));
    socket.addEventListener('close', () => { if (!settled) fail(new Error('通知 WebSocket 在 pong 前关闭')); });
  });
}

async function main() {
  const health = await request('/health');
  if (!health || !(health.status === 'ok' || health.ok === true)) throw new Error('健康检查未返回可用状态');
  console.log(`✓ health  ${baseUrl}`);

  if (!username && !password) {
    console.log('✓ API 可达（未执行登录；设置 OCTOP_USERNAME/OCTOP_PASSWORD 可继续验 JWT）');
    return;
  }
  if (!username || !password) throw new Error('OCTOP_USERNAME 与 OCTOP_PASSWORD 必须同时设置');

  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  if (!login?.access_token) throw new Error('登录响应缺少 access_token');
  console.log('✓ login   JWT 已签发');

  const auth = { Authorization: `Bearer ${login.access_token}` };
  if (checkBrowser) {
    const browser = await request('/browser/harness-sessions', { headers: auth });
    if (!browser || !Array.isArray(browser.sessions)) throw new Error('/browser/harness-sessions 返回格式无效');
    console.log(`✓ browser ${browser.sessions.length} 个会话`);
  }
  const agents = await request('/agents', { headers: auth });
  if (!Array.isArray(agents)) throw new Error('/agents 返回格式不是数组');
  console.log(`✓ agents  ${agents.length} 个 Agent`);
  if (agents[0]?.id != null) {
    const rawAgentId = agents[0].agent_id || agents[0].id;
    const agentId = encodeURIComponent(rawAgentId);
    const status = await request(`/agents/${agentId}/status`, { headers: auth });
    console.log(`✓ status  ${rawAgentId}: ${status?.state || 'unknown'}`);
    const welcome = await request(`/agents/${agentId}/chat/welcome`, { headers: auth });
    if (!welcome || !Object.prototype.hasOwnProperty.call(welcome, 'welcome_message')) throw new Error('/chat/welcome 缺少 welcome_message');
    console.log(`✓ welcome Octop 欢迎语字段有效${welcome.welcome_message ? '' : '（当前未配置模型，值为空）'}`);
    const sessions = await request(`/agents/${agentId}/threads`, { headers: auth });
    if (!Array.isArray(sessions)) throw new Error('/chat/sessions 返回格式不是数组');
    console.log(`✓ sessions ${sessions.length} 个会话`);
    if (createThread) {
      const created = await request(`/agents/${agentId}/threads`, { method: 'POST', headers: auth, body: JSON.stringify({ session_key: `agentos-smoke-${Date.now()}` }) });
      if (!created?.thread_id) throw new Error('/threads 创建响应缺少 thread_id');
      const history = await request(`/agents/${agentId}/threads/${encodeURIComponent(created.thread_id)}/history`, { headers: auth });
      if (!Array.isArray(history?.messages)) throw new Error('/threads/{thread_id}/history 返回格式无效');
      console.log(`✓ thread  ${created.thread_id} 创建并读取历史`);
    }
    if (checkWs) {
      await checkWebSocket(rawAgentId, login.access_token); console.log('✓ websocket ping/pong');
      await checkNotificationWebSocket(login.access_token); console.log('✓ notifications 通知 WebSocket');
    }
  }
}

main().catch((error) => { console.error(`✗ Octop smoke check: ${error.message}`); process.exitCode = 1; });
