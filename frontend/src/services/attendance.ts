import request from './request';

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  schedule_id: number | null;
  rule_id: number | null;
  sign_type: number;
  sign_time: string;
  address: string;
  longitude: string;
  latitude: string;
  device: string;
  sign_source: number;
  status: number;
  remark: string;
  real_name: string;
  username: string;
  dept_name: string;
  rule_name: string;
  start_time: string;
  end_time: string;
}

export interface AttendanceRecordQuery {
  page?: number;
  size?: number;
  employee_id?: number;
  start_date?: string;
  end_date?: string;
  status?: number;
  keyword?: string;
}

export const getAttendanceRecords = (params: AttendanceRecordQuery) => {
  return request.get('/attendance/record/page', { params });
};

export const updateAttendanceRecord = (id: number, data: Partial<AttendanceRecord>) => {
  return request.put(`/attendance/record/${id}`, data);
};

export const deleteAttendanceRecord = (id: number) => {
  return request.delete(`/attendance/record/${id}`);
};

export const sign = (data: { employee_id: number; signType: number; address?: string; longitude?: string; latitude?: string; device?: string; sign_source?: number }) => {
  return request.post('/attendance/sign', data);
};

export const exportAttendance = (data: { employee_id?: number; start_date?: string; end_date?: string }) => {
  return request.post('/task/export-attendance', data, { responseType: 'stream' });
};

export const importAttendance = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/task/import-attendance', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'stream',
  });
};