import request from './request';

export interface Department {
  id: number;
  dept_name: string;
  parent_id: number;
  status: number;
}

export const getDepartmentList = () => {
  return request.get('/department/list');
};