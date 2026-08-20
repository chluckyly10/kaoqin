# 前端API调用规范

## 1. 认证方式

### 1.1 Token传递

前端登录成功后，服务端返回 `token`，后续所有请求需在请求头中携带：

```javascript
// 请求头格式
{
  'Authorization': 'Bearer ' + token,
  'Content-Type': 'application/json'
}
```

### 1.2 前端请求封装示例

```javascript
const BASE_URL = 'http://localhost:3000/api/v1';

let token = localStorage.getItem('token');

const request = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers
  });
  
  const data = await response.json();
  
  if (data.code === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }
  
  return data;
};

export const api = {
  login: (username, encryptedPassword) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password: encryptedPassword })
    });
  },
  
  getProfile: () => request('/auth/profile'),
  
  getPublicKey: () => request('/auth/public-key'),
  
  getDepartmentList: () => request('/department/list'),
  
  createDepartment: (data) => request('/department/create', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  updateDepartment: (id, data) => request(`/department/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  deleteDepartment: (id) => request(`/department/${id}`, {
    method: 'DELETE'
  }),
  
  getEmployeePage: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/employee/page?${query}`);
  },
  
  createEmployee: (data) => request('/employee/create', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  updateEmployee: (id, data) => request(`/employee/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  deleteEmployee: (id) => request(`/employee/${id}`, {
    method: 'DELETE'
  }),
  
  getRuleList: () => request('/attendance/rule/list'),
  
  createRule: (data) => request('/attendance/rule/create', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  updateRule: (id, data) => request(`/attendance/rule/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  deleteRule: (id) => request(`/attendance/rule/${id}`, {
    method: 'DELETE'
  }),
  
  getSchedulePage: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/attendance/schedule/page?${query}`);
  },
  
  batchCreateSchedule: (data) => request('/attendance/schedule/batch', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  deleteSchedule: (id) => request(`/attendance/schedule/${id}`, {
    method: 'DELETE'
  }),
  
  sign: (data) => request('/attendance/sign', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  getRecordPage: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/attendance/record/page?${query}`);
  },
  
  updateRecord: (id, data) => request(`/attendance/record/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  deleteRecord: (id) => request(`/attendance/record/${id}`, {
    method: 'DELETE'
  }),
  
  applyException: (data) => request('/attendance/exception/apply', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  getExceptionPage: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/attendance/exception/page?${query}`);
  },
  
  auditException: (id, data) => request(`/attendance/exception/audit/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  checkUpload: (fileHash, filename) => {
    const query = new URLSearchParams({ fileHash, filename }).toString();
    return request(`/upload/check?${query}`);
  },
  
  uploadChunk: (formData) => {
    return fetch(`${BASE_URL}/upload/chunk`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      body: formData
    });
  },
  
  mergeUpload: (data) => request('/upload/merge', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  importAttendance: (formData) => {
    return fetch(`${BASE_URL}/task/import-attendance`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      body: formData
    });
  },
  
  exportAttendance: (data) => request('/task/export-attendance', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  getTaskList: (params) => {
    const query = new URLSearchParams(params).toString();
    return request(`/task/list?${query}`);
  },
  
  getLatestRecords: (lastId) => {
    const query = lastId ? `?lastId=${lastId}` : '';
    return request(`/attendance/latest-record${query}`);
  }
};

export const setToken = (newToken) => {
  token = newToken;
  localStorage.setItem('token', newToken);
};
```

## 2. RSA密码加密

### 2.1 加密流程

```
1. 前端调用 GET /api/v1/auth/public-key 获取公钥
2. 使用 Web Crypto API 对密码进行 RSA-OAEP 加密（sha256）
3. 将加密后的密码（Base64编码）发送到后端
4. 后端使用私钥解密得到明文密码
5. 后端使用 bcrypt 哈希后验证或存储
```

### 2.2 前端RSA加密工具类（使用 Web Crypto API）

```javascript
let cryptoKey = null;

export const initRSA = async () => {
  const result = await api.getPublicKey();
  if (result.code === 200) {
    const publicKey = result.data.publicKey;
    const binaryDerString = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    const binaryDer = str2ab(binaryDerString);
    cryptoKey = await window.crypto.subtle.importKey(
      'spki',
      binaryDer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      true,
      ['encrypt']
    );
  }
};

const str2ab = (str) => {
  const buffer = new ArrayBuffer(str.length * 2);
  const bufferView = new Uint16Array(buffer);
  for (let i = 0; i < str.length; i++) {
    bufferView[i] = str.charCodeAt(i);
  }
  return buffer;
};

const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export const encryptPassword = async (password) => {
  if (!cryptoKey) {
    throw new Error('RSA公钥未初始化');
  }
  
  const encoded = new TextEncoder().encode(password);
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    cryptoKey,
    encoded
  );
  return arrayBufferToBase64(encrypted);
};
```

### 2.3 登录示例

```javascript
import { api, setToken, initRSA, encryptPassword } from './api';

const handleLogin = async (username, password) => {
  try {
    await initRSA();
    
    const encryptedPassword = await encryptPassword(password);
    
    const result = await api.login(username, encryptedPassword);
    
    if (result.code === 200) {
      setToken(result.data.token);
      localStorage.setItem('user', JSON.stringify(result.data));
      return true;
    } else {
      console.error(result.message);
      return false;
    }
  } catch (error) {
    console.error('登录失败:', error);
    return false;
  }
};
```

### 2.4 创建用户示例

```javascript
const handleCreateEmployee = async (formData) => {
  try {
    await initRSA();
    
    const encryptedPassword = await encryptPassword(formData.password);
    
    const result = await api.createEmployee({
      ...formData,
      password: encryptedPassword
    });
    
    if (result.code === 200) {
      console.log('创建成功');
      return true;
    } else {
      console.error(result.message);
      return false;
    }
  } catch (error) {
    console.error('创建失败:', error);
    return false;
  }
};
```

### 2.5 修改密码示例

```javascript
const handleUpdatePassword = async (id, oldPassword, newPassword) => {
  try {
    await initRSA();
    
    const encryptedOldPassword = await encryptPassword(oldPassword);
    const encryptedNewPassword = await encryptPassword(newPassword);
    
    const result = await request(`/employee/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({
        oldPassword: encryptedOldPassword,
        newPassword: encryptedNewPassword
      })
    });
    
    if (result.code === 200) {
      console.log('密码修改成功');
      return true;
    } else {
      console.error(result.message);
      return false;
    }
  } catch (error) {
    console.error('修改失败:', error);
    return false;
  }
};
```

### 2.6 后端处理流程

```
登录:
  前端 → RSA-OAEP加密密码 → 后端 → 私钥解密 → bcrypt.compare验证 → 生成JWT

创建用户:
  前端 → RSA-OAEP加密密码 → 后端 → 私钥解密 → bcrypt.hash哈希 → 入库

修改密码:
  前端 → RSA-OAEP加密旧密码和新密码 → 后端 → 私钥解密 → bcrypt.compare验证旧密码 → bcrypt.hash哈希新密码 → 入库
```

### 2.7 安全说明

1. **RSA密钥长度**：2048位，保证加密强度
2. **加密方式**：RSA-OAEP-SHA256
3. **编码格式**：Base64编码传输
4. **密钥管理**：服务启动时自动生成，存放在 `keys/` 目录
5. **公钥获取**：无需认证，前端可自由获取
6. **私钥保护**：私钥仅存储在服务端，永不对外暴露
7. **前端兼容性**：使用浏览器原生 Web Crypto API，无需额外依赖

## 3. WebSocket连接

```javascript
const connectWebSocket = (token) => {
  const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);
  
  ws.onopen = () => {
    console.log('WebSocket连接成功');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.event === 'new_attendance_record') {
      console.log('收到新打卡记录:', data.data);
    }
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket错误:', error);
  };
  
  ws.onclose = () => {
    console.log('WebSocket连接关闭，5秒后重连');
    setTimeout(() => connectWebSocket(token), 5000);
  };
  
  return ws;
};
```

## 4. SSE订阅任务进度

```javascript
const subscribeTaskProgress = (taskId, onProgress) => {
  const eventSource = new EventSource(`/api/v1/task/sse/${taskId}`, {
    headers: {
      'Authorization': 'Bearer ' + token
    }
  });
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onProgress(data);
    
    if (data.status === 1 || data.status === 2) {
      eventSource.close();
    }
  };
  
  eventSource.onerror = () => {
    eventSource.close();
  };
  
  return eventSource;
};
```

## 5. 分片上传流程

```javascript
const uploadFile = async (file, onProgress) => {
  const fileHash = await calculateFileHash(file);
  const chunkSize = 2 * 1024 * 1024;
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  const checkResult = await api.checkUpload(fileHash, file.name);
  if (checkResult.data.isCompleted) {
    onProgress(100);
    return checkResult.data.filePath;
  }
  
  const uploadedChunks = checkResult.data.uploadedChunks || [];
  
  for (let i = 1; i <= totalChunks; i++) {
    if (uploadedChunks.includes(i)) continue;
    
    const start = (i - 1) * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    const formData = new FormData();
    formData.append('file', chunk);
    formData.append('chunkNumber', i);
    formData.append('totalChunks', totalChunks);
    formData.append('fileHash', fileHash);
    
    await api.uploadChunk(formData);
    
    const progress = Math.round((i / totalChunks) * 100);
    onProgress(progress);
  }
  
  const mergeResult = await api.mergeUpload({
    fileHash,
    filename: file.name,
    totalChunks
  });
  
  return mergeResult.data.path;
};
```

## 6. 错误码处理

```javascript
const handleError = (code, message) => {
  switch (code) {
    case 400:
      alert('参数错误：' + message);
      break;
    case 401:
      alert('登录已过期，请重新登录');
      localStorage.removeItem('token');
      window.location.href = '/login';
      break;
    case 403:
      alert('无权限操作');
      break;
    case 500:
      alert('服务器错误：' + message);
      break;
    default:
      alert('未知错误');
  }
};
```