import request from './request';

export interface Attachment {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number;
  upload_time: string;
}

export interface AttendanceException {
  id: number;
  employee_id: number;
  record_id: number;
  exception_type: number;
  apply_time: string;
  reason: string;
  status: number;
  audit_time: string;
  audit_remark: string;
  real_name: string;
  dept_name: string;
  involved_date: string;
  attachments: Attachment[];
}

export interface CreateExceptionParams {
  exception_type: number;
  involved_date: string;
  reason: string;
  attachments?: { file_name: string; file_url: string; file_size: number }[];
}

export const getExceptionList = (params: {
  page?: number;
  size?: number;
  employee_id?: number;
  status?: number;
  start_date?: string;
  end_date?: string;
}) => {
  return request.get('/attendance/exception/page', { params });
};

export const getMyExceptionList = (params: { page?: number; size?: number; status?: number }) => {
  return request.get('/attendance/exception/my', { params });
};

export const createException = (data: CreateExceptionParams) => {
  return request.post('/attendance/exception/apply', data);
};

export const auditException = (id: number, data: { status: number; audit_remark?: string }) => {
  return request.put(`/attendance/exception/audit/${id}`, data);
};

export const cancelException = (id: number) => {
  return request.put(`/attendance/exception/cancel/${id}`);
};