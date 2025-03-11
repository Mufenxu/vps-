// 请将下面两个常量替换为你自己的 Telegram Bot Token 和 Chat ID
const TELEGRAM_BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const TELEGRAM_CHAT_ID = 'YOUR_TELEGRAM_CHAT_ID';

// 统一使用的背景图片（简约风景照）
const BACKGROUND_IMAGE = 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?fit=crop&w=1950&q=80';
// 新的好看图标（favicon），可根据需要替换
const FAVICON_URL = 'https://img.icons8.com/fluency/48/000000/cloud.png';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

// 定时任务：每次检测 VPS 剩余不足 7 天时均发送 Telegram 提醒
addEventListener('scheduled', event => {
  event.waitUntil(handleScheduled(event));
});

async function handleScheduled(event) {
  return checkExpirations();
}

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // 退出登录
  if (url.pathname === '/logout') {
    return handleLogout(request);
  }
  
  // 添加 VPS 页面
  if (url.pathname === '/add') {
    return handleAdd(request);
  }
  
  // 编辑 VPS 页面
  if (url.pathname === '/edit') {
    return handleEdit(request);
  }
  
  // 删除 VPS（通过 /delete?id=xxx 访问）
  if (url.pathname === '/delete') {
    return handleDelete(request);
  }
  
  // POST 提交且未登录时处理登录
  if (request.method === 'POST' && !isAuthenticated(request)) {
    return handleLogin(request);
  }
  
  // 未登录时显示登录页面
  if (!isAuthenticated(request)) {
    return new Response(renderLoginPage(), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
  
  // 登录后显示仪表板
  return handleDashboard(request);
}

// —— Cookie 工具函数 ——
function getCookie(request, name) {
  let result = null;
  const cookieString = request.headers.get('Cookie');
  if (cookieString) {
    cookieString.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      if (parts[0].trim() === name) {
        result = parts[1];
      }
    });
  }
  return result;
}

function isAuthenticated(request) {
  return getCookie(request, 'auth') === '1';
}

// —— 登录处理 ——
// 登录成功后设置 Cookie 有效期 600 秒（10 分钟）
async function handleLogin(request) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');
  if (username === 'admin' && password === 'password123') {
    return new Response('', {
      status: 302,
      headers: {
        'Set-Cookie': `auth=1; HttpOnly; Path=/; Max-Age=600`,
        'Location': '/'
      }
    });
  } else {
    return new Response(renderLoginPage('用户名或密码错误'), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
}

// —— 登录页面 ——
function renderLoginPage(errorMsg = '') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录 - VPS监控</title>
  <link rel="icon" href="${FAVICON_URL}" type="image/png">
  <style>
    body {
      margin: 0; padding: 0;
      font-family: 'Arial', sans-serif;
      background: url('https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?fit=crop&w=1950&q=80') center center / cover no-repeat;
      display: flex; justify-content: center; align-items: center; height: 100vh;
    }
    .login-container {
      background: rgba(255,255,255,0.95);
      padding: 40px; border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      width: 90%; max-width: 360px;
    }
    h2 { text-align: center; margin-bottom: 20px; color: #333; }
    input[type="text"], input[type="password"] {
      width: 100%; padding: 12px; margin: 10px 0;
      border: 1px solid #ccc; border-radius: 6px;
      font-size: 16px; box-sizing: border-box;
    }
    button {
      width: 100%; padding: 12px; margin-top: 20px;
      border: none; border-radius: 6px;
      background: #667eea; color: white;
      font-size: 16px; cursor: pointer;
      transition: background 0.3s, box-shadow 0.3s;
    }
    button:hover { background: #556cd6; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    .error { color: red; text-align: center; }
  </style>
</head>
<body>
  <div class="login-container">
    <h2>用户登录</h2>
    ${errorMsg ? `<p class="error">${errorMsg}</p>` : ''}
    <form method="POST" action="/">
      <input type="text" name="username" placeholder="用户名" required>
      <input type="password" name="password" placeholder="密码" required>
      <button type="submit">登录</button>
    </form>
  </div>
</body>
</html>`;
}

// —— 登出处理 ——
function handleLogout(request) {
  return new Response('', {
    status: 302,
    headers: {
      'Set-Cookie': 'auth=; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
      'Location': '/'
    }
  });
}

// —— 添加 VPS ——  
// 表单中删除“厂商”，新增“用户名”、“密码”、“服务器地址”、“邮箱信息”
async function handleAdd(request) {
  if (!isAuthenticated(request)) return Response.redirect('/', 302);
  
  if (request.method === 'POST') {
    const formData = await request.formData();
    const vps = {
      id: Date.now().toString(),
      name: formData.get('name'),
      provider: formData.get('provider'),
      registrationDate: formData.get('registrationDate'),
      expirationDate: formData.get('expirationDate'),
      website: formData.get('website'),
      username: formData.get('username'),
      password: formData.get('password'),
      serverAddress: formData.get('serverAddress'),
      email: formData.get('email')
    };
    const vpsKey = 'vpsList';
    let vpsList = await VPS_DATA.get(vpsKey, { type: 'json' });
    if (!vpsList) vpsList = [];
    vpsList.push(vps);
    await VPS_DATA.put(vpsKey, JSON.stringify(vpsList));
    return new Response('', { status: 302, headers: { 'Location': '/' } });
  } else {
    return new Response(renderAddPage(), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
}

function renderAddPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>添加VPS - VPS监控</title>
  <link rel="icon" href="${FAVICON_URL}" type="image/png">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    body {
      font-family: 'Arial', sans-serif;
      background: url('${BACKGROUND_IMAGE}') center center / cover no-repeat;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
    }
    .container {
      background: rgba(255,255,255,0.95);
      padding: 30px; border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      max-width: 600px; width: 90%;
    }
    h2 { text-align: center; color: #333; }
    form { display: flex; flex-direction: column; }
    label { margin-top: 15px; font-size: 16px; color: #333; }
    input[type="text"], input[type="date"], input[type="url"] {
      padding: 12px; margin-top: 8px;
      border: 1px solid #ccc; border-radius: 6px; font-size: 16px;
    }
    button {
      margin-top: 20px; padding: 12px;
      background: #667eea; border: none; color: white;
      font-size: 16px; border-radius: 6px;
      cursor: pointer; transition: background 0.3s, box-shadow 0.3s;
    }
    button:hover { background: #556cd6; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    a { text-decoration: none; color: #667eea; display: block; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>添加新的VPS</h2>
    <form method="POST" action="/add">
      <label>VPS名称:
        <input type="text" name="name" required>
      </label>
      <label>服务商:
        <input type="text" name="provider" required>
      </label>
      <label>第一次注册时间:
        <input type="date" name="registrationDate" required>
      </label>
      <label>到期日期:
        <input type="date" name="expirationDate" required>
      </label>
      <label>官网链接:
        <input type="url" name="website" required>
      </label>
      <label>用户名:
        <input type="text" name="username" required>
      </label>
      <label>密码:
        <input type="text" name="password" required>
      </label>
      <label>服务器地址:
        <input type="text" name="serverAddress" required>
      </label>
      <label>邮箱信息:
        <input type="text" name="email" required>
      </label>
      <button type="submit">提交</button>
    </form>
    <a href="/">返回首页</a>
  </div>
</body>
</html>`;
}

// —— 编辑 VPS ——  
async function handleEdit(request) {
  if (!isAuthenticated(request)) return Response.redirect('/', 302);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('无效请求：缺少 VPS ID', { status: 400 });
  
  const vpsKey = 'vpsList';
  let vpsList = await VPS_DATA.get(vpsKey, { type: 'json' });
  if (!vpsList) return new Response('未找到 VPS 数据', { status: 404 });
  const vps = vpsList.find(item => item.id === id);
  if (!vps) return new Response('未找到对应 VPS', { status: 404 });
  
  if (request.method === 'POST') {
    const formData = await request.formData();
    vps.name = formData.get('name');
    vps.provider = formData.get('provider');
    vps.registrationDate = formData.get('registrationDate');
    vps.expirationDate = formData.get('expirationDate');
    vps.website = formData.get('website');
    vps.username = formData.get('username');
    vps.password = formData.get('password');
    vps.serverAddress = formData.get('serverAddress');
    vps.email = formData.get('email');
    await VPS_DATA.put(vpsKey, JSON.stringify(vpsList));
    return new Response('', { status: 302, headers: { 'Location': '/' } });
  } else {
    return new Response(renderEditPage(vps), {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
  }
}

function renderEditPage(vps) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>编辑VPS - VPS监控</title>
  <link rel="icon" href="${FAVICON_URL}" type="image/png">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    body {
      font-family: 'Arial', sans-serif;
      background: url('${BACKGROUND_IMAGE}') center center / cover no-repeat;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
    }
    .container {
      background: rgba(255,255,255,0.95);
      padding: 30px; border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      max-width: 600px; width: 90%;
    }
    h2 { text-align: center; color: #333; }
    form { display: flex; flex-direction: column; }
    label { margin-top: 15px; font-size: 16px; color: #333; }
    input[type="text"], input[type="date"], input[type="url"] {
      padding: 12px; margin-top: 8px;
      border: 1px solid #ccc; border-radius: 6px; font-size: 16px;
    }
    button {
      margin-top: 20px; padding: 12px;
      background: #667eea; border: none; color: white;
      font-size: 16px; border-radius: 6px;
      cursor: pointer; transition: background 0.3s, box-shadow 0.3s;
    }
    button:hover { background: #556cd6; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    a { text-decoration: none; color: #667eea; display: block; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>编辑VPS信息</h2>
    <form method="POST" action="/edit?id=${vps.id}">
      <label>VPS名称:
        <input type="text" name="name" value="${vps.name}" required>
      </label>
      <label>服务商:
        <input type="text" name="provider" value="${vps.provider}" required>
      </label>
      <label>第一次注册时间:
        <input type="date" name="registrationDate" value="${vps.registrationDate}" required>
      </label>
      <label>到期日期:
        <input type="date" name="expirationDate" value="${vps.expirationDate}" required>
      </label>
      <label>官网链接:
        <input type="url" name="website" value="${vps.website}" required>
      </label>
      <label>用户名:
        <input type="text" name="username" value="${vps.username}" required>
      </label>
      <label>密码:
        <input type="text" name="password" value="${vps.password}" required>
      </label>
      <label>服务器地址:
        <input type="text" name="serverAddress" value="${vps.serverAddress}" required>
      </label>
      <label>邮箱信息:
        <input type="text" name="email" value="${vps.email}" required>
      </label>
      <button type="submit">保存修改</button>
    </form>
    <a href="/">返回首页</a>
  </div>
</body>
</html>`;
}

// —— 删除 VPS ——
async function handleDelete(request) {
  if (!isAuthenticated(request)) return Response.redirect('/', 302);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('无效请求', { status: 400 });
  const vpsKey = 'vpsList';
  let vpsList = await VPS_DATA.get(vpsKey, { type: 'json' });
  if (!vpsList) vpsList = [];
  vpsList = vpsList.filter(vps => vps.id !== id);
  await VPS_DATA.put(vpsKey, JSON.stringify(vpsList));
  return new Response('', { status: 302, headers: { 'Location': '/' } });
}

// —— 仪表板 ——  
// 1. 对 VPS 列表按注册日期升序排序
// 2. 日期显示采用 YYYY-MM-DD 格式（通过 toISOString().split('T')[0]）
// 3. “编辑”和“删除”按钮放在同一行（使用内联 Flex 容器）
// 4. “VPS名称”和日期列增加 white-space: nowrap 以避免换行
// 5. “服务商”列只显示服务商名称，点击直接跳转到官网
async function handleDashboard(request) {
  const vpsKey = 'vpsList';
  let vpsList = await VPS_DATA.get(vpsKey, { type: 'json' });
  if (!vpsList) vpsList = [];
  
  // 按注册日期升序排序
  vpsList.sort((a, b) => new Date(a.registrationDate) - new Date(b.registrationDate));
  
  let tableRows = vpsList.map(vps => {
    const regDate = new Date(vps.registrationDate);
    const expDate = new Date(vps.expirationDate);
    const now = new Date();
    let percent = 0;
    if(expDate > regDate) {
      percent = ((now - regDate) / (expDate - regDate)) * 100;
      if(percent < 0) percent = 0;
      if(percent > 100) percent = 100;
      percent = percent.toFixed(0);
    }
    const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    let statusIcon = '';
    if(expDate < now) {
      statusIcon = `<span title="已过期" style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#f44336;"></span>`;
    } else if (daysLeft <= 7) {
      statusIcon = `<span title="预警" style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#ff9800;"></span>`;
    } else {
      statusIcon = `<span title="正常" style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#4caf50;"></span>`;
    }
    return `<tr>
      <td>${statusIcon}</td>
      <td style="white-space: nowrap;">${vps.name}</td>
      <td>
        <button class="btn-detail" onclick="showDetailModal('${vps.username}','${vps.password}','${vps.serverAddress}','${vps.email}')">详细信息</button>
      </td>
      <td>
        <a class="btn" href="${vps.website}" target="_blank">${vps.provider}</a>
      </td>
      <td style="white-space: nowrap;">${regDate.toISOString().split('T')[0]}</td>
      <td style="white-space: nowrap;">${expDate.toISOString().split('T')[0]}</td>
      <td>
        <div class="progress">
          <div class="progress-bar" style="width:${percent}%;">${percent}%</div>
        </div>
      </td>
      <td>
        <div style="display:inline-flex; gap:10px;">
          <a class="btn" href="/edit?id=${vps.id}">编辑</a>
          <a class="btn btn-danger" href="/delete?id=${vps.id}" onclick="return confirm('确认删除此VPS吗？')">删除</a>
        </div>
      </td>
    </tr>`;
  }).join('');
  
  return new Response(renderDashboardPage(tableRows), {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' }
  });
}

// —— 仪表板页面 ——
function renderDashboardPage(tableRows) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VPS监控仪表板</title>
  <link rel="icon" href="${FAVICON_URL}" type="image/png">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    body {
      font-family: 'Arial', sans-serif;
      background: url('${BACKGROUND_IMAGE}') center center / cover no-repeat;
      min-height: 100vh;
      display: flex; flex-direction: column; align-items: center;
    }
    .container {
      background: rgba(255,255,255,0.95);
      padding: 20px; border-radius: 10px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      width: 90%; max-width: 1000px; margin: 20px 0;
    }
    header { text-align: center; margin-bottom: 20px; }
    header h1 { margin: 0; font-size: 28px; color: #333; }
    nav a { margin: 0 10px; text-decoration: none; color: #667eea; font-size: 16px; }
    .table-container { overflow-x: auto; width: 100%; }
    table {
      width: 100%; border-collapse: collapse;
      margin-top: 20px; min-width: 800px;
    }
    th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; font-size: 14px; }
    th { background: #f2f2f2; color: #333; }
    .progress { background-color: #e0e0e0; border-radius: 6px; overflow: hidden; height: 20px; }
    .progress-bar { background-color: #667eea; height: 100%; text-align: center; color: #fff; line-height: 20px; }
    /* 按钮样式 */
    .btn {
      display: inline-block; padding: 6px 12px;
      background: #667eea; color: white; text-decoration: none;
      border-radius: 4px; font-size: 14px;
      transition: background 0.3s, box-shadow 0.3s; margin-right: 4px;
      white-space: nowrap;
    }
    .btn:hover { background: #556cd6; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    .btn-danger { background: #e74c3c; }
    .btn-danger:hover { background: #c0392b; }
    .btn-detail {
      padding: 6px 12px; background: #3498db; color: white;
      border: none; border-radius: 4px; font-size: 14px;
      cursor: pointer; transition: background 0.3s, box-shadow 0.3s;
      white-space: nowrap;
    }
    .btn-detail:hover { background: #2980b9; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
    /* 模态窗口样式 */
    .modal {
      display: none; position: fixed; z-index: 1000;
      left: 0; top: 0; width: 100%; height: 100%;
      overflow: auto; background-color: rgba(0,0,0,0.5);
    }
    .modal-content {
      background-color: #fefefe; margin: 10% auto;
      padding: 20px; border: 1px solid #888;
      border-radius: 10px; width: 80%; max-width: 500px;
    }
    .close {
      color: #aaa; float: right;
      font-size: 28px; font-weight: bold;
    }
    .close:hover, .close:focus {
      color: black; text-decoration: none; cursor: pointer;
    }
    .detail-field {
      margin: 10px 0; display: flex; align-items: center;
    }
    .detail-field label {
      font-weight: bold; margin-right: 10px; min-width: 120px;
    }
    .copy-btn {
      margin-left: auto; background: #3498db;
      border: none; color: white; padding: 4px 8px;
      border-radius: 4px; cursor: pointer; font-size: 12px;
      transition: background 0.3s, box-shadow 0.3s;
    }
    .copy-btn:hover { background: #2980b9; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>VPS监控仪表板</h1>
      <nav>
        <a class="btn" href="/add">添加VPS</a>
        <a class="btn" href="/logout">退出登录</a>
      </nav>
    </header>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>状态</th>
            <th>VPS名称</th>
            <th>详细信息</th>
            <th>服务商</th>
            <th>注册时间</th>
            <th>到期日期</th>
            <th>剩余时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || `<tr><td colspan="8" style="text-align:center;">暂无数据</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
  <!-- 模态窗口 -->
  <div id="detailModal" class="modal">
    <div class="modal-content">
      <span class="close" onclick="closeModal()">&times;</span>
      <h2>详细信息</h2>
      <div class="detail-field">
        <label>用户名:</label>
        <span id="modalUsername"></span>
        <button class="copy-btn" onclick="copyText('modalUsername')">复制</button>
      </div>
      <div class="detail-field">
        <label>密码:</label>
        <span id="modalPassword"></span>
        <button class="copy-btn" onclick="copyText('modalPassword')">复制</button>
      </div>
      <div class="detail-field">
        <label>服务器地址:</label>
        <span id="modalServerAddress"></span>
        <button class="copy-btn" onclick="copyText('modalServerAddress')">复制</button>
      </div>
      <div class="detail-field">
        <label>邮箱:</label>
        <span id="modalEmail"></span>
        <button class="copy-btn" onclick="copyText('modalEmail')">复制</button>
      </div>
    </div>
  </div>
  <script>
    function showDetailModal(username, password, serverAddress, email) {
      document.getElementById('modalUsername').innerText = username;
      document.getElementById('modalPassword').innerText = password;
      document.getElementById('modalServerAddress').innerText = serverAddress;
      document.getElementById('modalEmail').innerText = email;
      document.getElementById('detailModal').style.display = 'block';
    }
    function closeModal() {
      document.getElementById('detailModal').style.display = 'none';
    }
    function copyText(elementId) {
      var text = document.getElementById(elementId).innerText;
      navigator.clipboard.writeText(text).then(function() {
        alert("复制成功: " + text);
      }).catch(function(err) {
        alert("复制失败: " + err);
      });
    }
    window.onclick = function(event) {
      var modal = document.getElementById('detailModal');
      if (event.target == modal) {
        modal.style.display = "none";
      }
    }
  </script>
</body>
</html>`;
}

// —— 定时任务检测 ——  
async function checkExpirations() {
  const vpsKey = 'vpsList';
  let vpsList = await VPS_DATA.get(vpsKey, { type: 'json' });
  if (!vpsList) return;
  const now = new Date();
  for (let vps of vpsList) {
    const expDate = new Date(vps.expirationDate);
    if(expDate <= now) continue;
    const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 7) {
      const message = `提醒：VPS【${vps.name}】将于 ${expDate.toISOString().split('T')[0]} 到期，还剩 ${daysLeft} 天，请及时续费。`;
      await sendTelegramNotification(message);
    }
  }
}

// —— 通过 Telegram Bot API 发送消息 ——
async function sendTelegramNotification(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = { chat_id: TELEGRAM_CHAT_ID, text: message };
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
