import request from './request';

export interface AttendanceSchedule {
  id: number;
  employee_id: number;
  schedule_date: string;
  rule_id: number;
  remark: string;
  real_name: string;
  rule_name: string;
}

export const getScheduleList = (params: { page?: number; size?: number; employee_id?: number; schedule_date?: string }) => {
  return request.get('/attendance/schedule/page', { params });
};

export const batchCreateSchedule = (data: { schedules: { employee_id: number; schedule_date: string; rule_id: number; remark?: string }[] }) => {
  return request.post('/attendance/schedule/batch', data);
};

export const deleteSchedule = (id: number) => {
  return request.delete(`/attendance/schedule/${id}`);
};