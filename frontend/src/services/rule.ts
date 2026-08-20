import request from './request';

export interface AttendanceRule {
  id: number;
  rule_name: string;
  start_time: string;
  end_time: string;
  late_minute: number;
  early_minute: number;
  allow_outside?: number;
  overtime_rule?: string;
  status: number;
}

export const getRuleList = () => {
  return request.get('/attendance/rule/list');
};

export const createRule = (data: Omit<AttendanceRule, 'id'>) => {
  return request.post('/attendance/rule/create', data);
};

export const updateRule = (id: number, data: Partial<AttendanceRule>) => {
  return request.put(`/attendance/rule/${id}`, data);
};

export const deleteRule = (id: number) => {
  return request.delete(`/attendance/rule/${id}`);
};

export const getRuleEmployees = (id: number) => {
  return request.get(`/attendance/rule/${id}/employees`);
};