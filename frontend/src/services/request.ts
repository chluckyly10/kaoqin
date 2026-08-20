import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { message } from 'antd';
import { history } from 'umi';

const request: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

request.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data.code !== 200) {
      message.error(response.data.message || '请求失败');
      return Promise.reject(response.data);
    }

    return response.data;
  },
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      message.error('登录已过期，请重新登录');
      localStorage.removeItem('token');
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        sessionStorage.setItem('last_page', currentPath);
      }
      history.push('/login');
      return Promise.reject(error);
    }

    if (error.response?.status === 403) {
      message.error('没有权限执行此操作');
      return Promise.reject(error);
    }

    if (error.response?.status === 500) {
      message.error('服务器内部错误');
    } else if (error.response?.status !== 404) {
      message.error(error.message || '请求失败');
    }

    return Promise.reject(error);
  }
);

export { request };
export default request;
