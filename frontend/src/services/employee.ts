import request from './request';

export interface Employee {
  id: number;
  dept_id: number;
  username: string;
  real_name: string;
  phone: string;
  avatar: string;
  status: number;
  dept_name: string;
}

export const getEmployeeList = (params: { page?: number; size?: number; keyword?: string; dept_id?: number }) => {
  return request.get('/employee/page', { params });
};

export const getProfile = () => {
  return request.get('/auth/profile');
};