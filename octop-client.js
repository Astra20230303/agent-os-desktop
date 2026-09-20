/* Octop adapter. The desktop UI remains usable offline and promotes Octop to
 * the source of truth when its local API is available. */
(function () {
  'use strict';
  var STORAGE_URL = 'aos.octop.baseUrl';
  var STORAGE_TOKEN = 'aos.octop.accessToken';
  var DEFAULT_URL = 'http://127.0.0.1:8088';
  function trimUrl(value) { return String(value || DEFAULT_URL).replace(/\/+$/, ''); }
  var OCTOP = {
    baseUrl: trimUrl(localStorage.getItem(STORAGE_URL) || DEFAULT_URL),
    token: localStorage.getItem(STORAGE_TOKEN) || '',
    online: false,
    lastError: '',
    notificationSocket: null,
    notificationReconnect: null,
    notificationBackoff: 1000,
    configure: function (url) { this.baseUrl = trimUrl(url); localStorage.setItem(STORAGE_URL, this.baseUrl); return this.health(); },
    request: async function (path, options) {
      options = options || {};
      var headers = Object.assign({ Accept: 'application/json' }, options.headers || {});
      if (this.token) headers.Authorization = 'Bearer ' + this.token;
      if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      var response = await fetch(this.baseUrl + '/api' + path, Object.assign({}, options, { headers: headers }));
      var text = await response.text(), data = null;
      if (text) {
        try { data = JSON.parse(text); }
        catch (parseError) {
          var invalid = new Error('Octop 返回了无法解析的响应'); invalid.status = response.status; throw invalid;
        }
      }
      if (!response.ok) {
        if (response.status === 401 && this.token) {
          this.disconnectNotifications();
          this.token = ''; this.online = false; localStorage.removeItem(STORAGE_TOKEN); this._syncIndicator();
          window.dispatchEvent(new CustomEvent('octop-auth-expired'));
        }
        var error = new Error(data && data.error && data.error.message || ('Octop API ' + response.status)); error.status = response.status; throw error;
      }
      return data;
    },
    health: async function () {
      try { var result = await this.request('/health'); this.online = !!(result && (result.status === 'ok' || result.ok === true)); this.lastError = this.online ? '' : '健康检查未返回 ok'; }
      catch (error) { this.online = false; this.lastError = error && error.message || '无法连接 Octop'; }
      this._syncIndicator(); return this.online;
    },
    login: async function (username, password) {
      var result = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ username: username, password: password }) });
      this.token = result.access_token || ''; if (this.token) localStorage.setItem(STORAGE_TOKEN, this.token); this._syncIndicator(); window.dispatchEvent(new CustomEvent('octop-authenticated')); return result;
    },
    logout: function () {
      var token = this.token;
      this.disconnectNotifications();
      if (token) {
        fetch(this.baseUrl + '/api/auth/logout', { method: 'POST', headers: { Accept: 'application/json', Authorization: 'Bearer ' + token } }).catch(function () {});
      }
      this.token = ''; this.online = false; localStorage.removeItem(STORAGE_TOKEN); this._syncIndicator(); window.dispatchEvent(new CustomEvent('octop-disconnected'));
    },
    listAgents: function () { return this.request('/agents'); },
    createAgent: function (body) { return this.request('/agents', { method: 'POST', body: JSON.stringify(body || {}) }); },
    publishAgentExpert: function (id, body) { return this.request('/agents/' + encodeURIComponent(id) + '/publish-expert', { method: 'POST', body: JSON.stringify(body || {}) }); },
    refreshPublishedExpert: function (id) { return this.request('/experts/published/' + encodeURIComponent(id) + '/refresh', { method: 'POST' }); },
    unpublishExpert: function (id) { return this.request('/experts/published/' + encodeURIComponent(id), { method: 'DELETE' }); },
    listExperts: function () { return this.request('/experts'); },
    expert: function (id) { return this.request('/experts/' + encodeURIComponent(id)); },
    createAgentFromExpert: function (id, body) { return this.request('/agents/from-expert/' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify(body || {}) }); },
    listExpertHub: function (query) { var qs = query ? '?' + new URLSearchParams(query).toString() : ''; return this.request('/experts/hub' + qs); },
    expertHub: function (slug) { return this.request('/experts/hub/' + encodeURIComponent(slug)); },
    installExpertHub: function (slug, body) { return this.request('/experts/hub/' + encodeURIComponent(slug) + '/install', { method: 'POST', body: JSON.stringify(body || {}) }); },
    skillHubSearch: function (query, limit) { return this.request('/skill-packages/hub/search?q=' + encodeURIComponent(query || '') + '&limit=' + (limit || 50)); },
    createSkillPackageFromHub: function (body) { return this.request('/skill-packages/from-skillhub', { method: 'POST', body: JSON.stringify(body || {}) }); },
    listSkillPackages: function () { return this.request('/skill-packages'); },
    listPlugins: function () { return this.request('/plugins'); },
    connectorCatalog: function () { return this.request('/connectors/catalog'); },
    connectorInstances: function () { return this.request('/connector-instances'); },
    hubCatalog: async function (query) {
      query = query || {};
      var q = query.q || '', limit = query.limit || 50;
      try {
        return await this.request('/hub/catalog?q=' + encodeURIComponent(q) + '&scene=' + encodeURIComponent(query.scene || ''));
      } catch (unifiedError) {
        /* Older Octop versions do not expose /hub yet; keep the compatible fan-out. */
      }
      var results = await Promise.all([
        this.listExpertHub({ q: q, scene: query.scene || '' }),
        this.skillHubSearch(q, limit),
        this.listPlugins(),
        this.connectorCatalog()
      ].map(function (task) { return task.catch(function () { return null; }); }));
      return {
        experts: (results[0] && results[0].items) || [],
        scenes: (results[0] && results[0].scenes) || [],
        skills: Array.isArray(results[1]) ? results[1] : [],
        plugins: Array.isArray(results[2]) ? results[2] : [],
        connectors: Array.isArray(results[3]) ? results[3] : [],
        updatedAt: Date.now()
      };
    },
    hubInstalled: async function () {
      try { return await this.request('/hub/installed'); } catch (unifiedError) {}
      var results = await Promise.all([
        this.listAgents(),
        this.listSkillPackages(),
        this.listPlugins(),
        this.connectorInstances()
      ]);
      return {
        agents: Array.isArray(results[0]) ? results[0] : [],
        skillPackages: Array.isArray(results[1]) ? results[1] : [],
        plugins: Array.isArray(results[2]) ? results[2].filter(function (x) { return x.enabled || x.loaded; }) : [],
        connectors: Array.isArray(results[3]) ? results[3] : [],
        updatedAt: Date.now()
      };
    },
    hubInstall: async function (kind, item, options) {
      options = options || {};
      if (kind === 'expert') return this.installExpertHub(item.slug || item.id, { name: options.name || item.name || item.label, description: options.description || item.description || '', enable_trajectory: true });
      if (kind === 'skill') return this.createSkillPackageFromHub({ slug: item.slug || item.id, name: options.name || item.name, description: options.description || item.description || item.summary || '', icon_url: item.icon_url || null });
      if (kind === 'plugin' || kind === 'connector' || kind === 'mcp') throw new Error('该资产由 Octop 管理端完成安装与授权');
      throw new Error('不支持的生态资产类型：' + kind);
    },
    listSessions: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/threads'); },
    listCron: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/cron'); },
    patchCron: function (agentId, cronId, patch) { return this.request('/agents/' + encodeURIComponent(agentId) + '/cron/' + encodeURIComponent(cronId), { method: 'PATCH', body: JSON.stringify(patch) }); },
    runCronNow: function (agentId, cronId) { return this.request('/agents/' + encodeURIComponent(agentId) + '/cron/' + encodeURIComponent(cronId) + '/run-now', { method: 'POST' }); },
    workspaceTree: function (id, path) { return this.request('/agents/' + encodeURIComponent(id) + '/workspace/tree?path=' + encodeURIComponent(path || '/') + '&from_workspace=true'); },
    workspaceFile: function (id, path) { return this.request('/agents/' + encodeURIComponent(id) + '/workspace/file?path=' + encodeURIComponent(path) + '&from_workspace=true'); },
    writeWorkspaceFile: function (id, path, content) { return this.request('/agents/' + encodeURIComponent(id) + '/workspace/file?path=' + encodeURIComponent(path) + '&from_workspace=true', { method: 'PUT', body: JSON.stringify({ content: String(content) }) }); },
    uploadWorkspaceFile: async function (id, path, file) { var form = new FormData(); form.append('file', file); var response = await fetch(this.baseUrl + '/api/agents/' + encodeURIComponent(id) + '/workspace/upload?path=' + encodeURIComponent(path) + '&from_workspace=true', { method: 'POST', headers: { Authorization: 'Bearer ' + this.token }, body: form }); var text = await response.text(), data = null; try { data = text ? JSON.parse(text) : null; } catch (error) { throw new Error('Octop 上传返回无法解析的响应'); } if (!response.ok) throw new Error(data && data.error && data.error.message || ('Octop API ' + response.status)); return data; },
    listSkills: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/skills'); },
    toolSettings: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/tool-settings'); },
    patchTool: function (id, name, enabled) { return this.request('/agents/' + encodeURIComponent(id) + '/tool-settings/' + encodeURIComponent(name), { method: 'PATCH', body: JSON.stringify({ enabled: !!enabled, source: 'builtin' }) }); },
    terminalUrl: function (id, sessionId, cols, rows) { var protocol = this.baseUrl.indexOf('https://') === 0 ? 'wss://' : 'ws://'; return protocol + this.baseUrl.replace(/^https?:\/\//, '') + '/api/agents/' + encodeURIComponent(id) + '/terminal/ws?token=' + encodeURIComponent(this.token) + '&session_id=' + encodeURIComponent(sessionId || '') + '&cols=' + (cols || 80) + '&rows=' + (rows || 24); },
    browserSessions: function () { return this.request('/browser/harness-sessions'); },
    browserHandoff: function (sessionId, target) { return this.request('/browser/sessions/' + encodeURIComponent(sessionId) + '/handoff', { method: 'POST', body: JSON.stringify({ target: target }) }); },
    browserStreamUrl: function (listenOnly, width, height) { var protocol = this.baseUrl.indexOf('https://') === 0 ? 'wss://' : 'ws://'; return protocol + this.baseUrl.replace(/^https?:\/\//, '') + '/api/browser-stream/ws?token=' + encodeURIComponent(this.token) + '&listen_only=' + (listenOnly ? '1' : '0') + '&width=' + (width || 960) + '&height=' + (height || 620); },
    createSession: function (id, sessionKey) { return this.request('/agents/' + encodeURIComponent(id) + '/threads', { method: 'POST', body: JSON.stringify(sessionKey ? { session_key: sessionKey } : {}) }); },
    history: function (id, threadId) { return this.request('/agents/' + encodeURIComponent(id) + '/threads/' + encodeURIComponent(threadId) + '/history'); },
    trajectory: function (id, threadId, limit) { return this.request('/agents/' + encodeURIComponent(id) + '/threads/' + encodeURIComponent(threadId) + '/trajectory?limit=' + (limit || 30)); },
    trajectoryMetrics: function (id, threadId) { return this.request('/agents/' + encodeURIComponent(id) + '/threads/' + encodeURIComponent(threadId) + '/trajectory/metrics'); },
    resumeHitl: async function (id, threadId, decisions, onChunk) { var response = await fetch(this.baseUrl + '/api/agents/' + encodeURIComponent(id) + '/chat/hitl/resume', { method: 'POST', headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token }, body: JSON.stringify({ thread_id: threadId, decisions: decisions }) }); if (!response.ok) { var text = await response.text(); throw new Error(text || ('Octop API ' + response.status)); } if (!response.body) return; var reader = response.body.getReader(), decoder = new TextDecoder(), buffer = ''; while (true) { var part = await reader.read(); if (part.done) break; buffer += decoder.decode(part.value, { stream: true }); var lines = buffer.split(/\n\n/); buffer = lines.pop() || ''; lines.forEach(function (block) { var line = block.split('\n').find(function (x) { return x.indexOf('data:') === 0; }); if (line && onChunk) { try { onChunk(JSON.parse(line.slice(5).trim())); } catch (ignore) {} } }); } },
    requestLogin: function () { window.dispatchEvent(new CustomEvent('octop-login-request')); },
    agentStatus: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/status'); },
    startAgent: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/start', { method: 'POST' }); },
    stopAgent: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/stop', { method: 'POST' }); },
    reloadAgent: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/reload', { method: 'POST' }); },
    welcome: function (id) { return this.request('/agents/' + encodeURIComponent(id) + '/chat/welcome'); },
    chatUrl: function (id) { var protocol = this.baseUrl.indexOf('https://') === 0 ? 'wss://' : 'ws://'; return protocol + this.baseUrl.replace(/^https?:\/\//, '') + '/api/agents/' + encodeURIComponent(id) + '/chat/ws?token=' + encodeURIComponent(this.token); },
    notificationUrl: function () { var protocol = this.baseUrl.indexOf('https://') === 0 ? 'wss://' : 'ws://'; return protocol + this.baseUrl.replace(/^https?:\/\//, '') + '/api/notifications/ws?token=' + encodeURIComponent(this.token); },
    connectNotifications: function () {
      var self = this;
      if (!this.token || !this.online || this.notificationSocket) return;
      if (this.notificationReconnect) { clearTimeout(this.notificationReconnect); this.notificationReconnect = null; }
      var socket;
      try { socket = new WebSocket(this.notificationUrl()); } catch (error) { this.scheduleNotificationReconnect(); return; }
      this.notificationSocket = socket;
      socket.onopen = function () { self.notificationBackoff = 1000; window.dispatchEvent(new CustomEvent('octop-notifications-connected')); };
      socket.onmessage = function (event) {
        var data; try { data = JSON.parse(event.data); } catch (error) { return; }
        window.dispatchEvent(new CustomEvent('octop-notification', { detail: data }));
      };
      socket.onerror = function () { try { socket.close(); } catch (ignore) {} };
      socket.onclose = function () {
        if (self.notificationSocket === socket) self.notificationSocket = null;
        window.dispatchEvent(new CustomEvent('octop-notifications-disconnected'));
        self.scheduleNotificationReconnect();
      };
    },
    scheduleNotificationReconnect: function () {
      var self = this;
      if (!this.token || this.notificationReconnect) return;
      var delay = this.notificationBackoff;
      this.notificationBackoff = Math.min(this.notificationBackoff * 2, 30000);
      this.notificationReconnect = setTimeout(function () { self.notificationReconnect = null; self.connectNotifications(); }, delay);
    },
    disconnectNotifications: function () {
      if (this.notificationReconnect) { clearTimeout(this.notificationReconnect); this.notificationReconnect = null; }
      if (this.notificationSocket) { var socket = this.notificationSocket; this.notificationSocket = null; try { socket.close(); } catch (ignore) {} }
      this.notificationBackoff = 1000;
    },
    _syncIndicator: function () { var el = document.querySelector('#st-net'), ready = this.online && !!this.token; if (!el) return; el.dataset.octop = ready ? 'online' : 'offline'; el.title = ready ? 'Octop 后端 · 已连接' : (this.online ? 'Octop API 可达 · 尚未登录' : 'Octop 后端 · 未连接（点击查看）'); el.style.color = ready ? 'var(--ok)' : ''; }
  };
  window.OCTOP = OCTOP;
  window.addEventListener('octop-authenticated', function () { OCTOP.connectNotifications(); });
  window.addEventListener('octop-disconnected', function () { OCTOP.disconnectNotifications(); });
  window.addEventListener('aos-ready', function () {
    OCTOP.health().then(function (ok) {
      if (ok && OCTOP.token) window.dispatchEvent(new CustomEvent('octop-authenticated'));
    });
  });
})();
