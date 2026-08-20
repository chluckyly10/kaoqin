import { request } from '@/services/request';

export function onRouteChange({ location }: { location: { pathname: string } }) {
  const token = localStorage.getItem('token');
  if (!token && location.pathname !== '/login') {
    window.location.href = '/login';
  }
  if (token) {
    request.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }
}
