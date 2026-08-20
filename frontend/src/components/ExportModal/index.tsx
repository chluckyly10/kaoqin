import React, { useState, useRef } from 'react';
import { Modal, Form, Button, Progress, message, Space, Typography, DatePicker, Select, List } from 'antd';
import { DownloadOutlined, FileExcelOutlined, ClockCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/services/request';
import { createSseInstance, SseInstance } from '@/services/sse';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  exportType?: 'attendance' | 'schedule' | 'employee';
}

interface TaskRecord {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: string;
  downloadUrl?: string;
  errorMessage?: string;
}

const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  onSuccess,
  exportType = 'attendance',
}) => {
  const [form] = Form.useForm();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<TaskRecord[]>([]);
  const [currentTask, setCurrentTask] = useState<TaskRecord | null>(null);
  const sseRef = useRef<SseInstance | null>(null);

  const fetchTaskHistory = async () => {
    try {
      const res = await request.get(`/task/list?type=${exportType}&page=1&size=10`);
      setCompletedTasks(res.data.list || []);
    } catch (error) {
      console.error('获取任务历史失败:', error);
    }
  };

  React.useEffect(() => {
    if (open) {
      fetchTaskHistory();
    }
  }, [open, exportType]);

  const handleExport = async (values: any) => {
    setExporting(true);
    setProgress(0);
    setCurrentTask(null);

    try {
      const params: Record<string, any> = {
        type: exportType,
      };

      if (values.dateRange && values.dateRange.length === 2) {
        params.start_date = values.dateRange[0].format('YYYY-MM-DD');
        params.end_date = values.dateRange[1].format('YYYY-MM-DD');
      }

      if (values.employee_id) {
        params.employee_id = values.employee_id;
      }

      const res = await request.post(`/task/export-${exportType}`, params);
      const { taskId } = res.data;

      const task: TaskRecord = {
        id: taskId,
        type: exportType,
        status: 'processing',
        progress: 0,
        createdAt: new Date().toLocaleString(),
      };
      setCurrentTask(task);

      const sseUrl = `/task/sse/${taskId}`;
      const sse = createSseInstance(sseUrl);
      sseRef.current = sse;

      sse.setCallbacks({
        onMessage: (data: any) => {
          if (data.progress !== undefined) {
            setProgress(data.progress);
            setCurrentTask((prev) => prev ? { ...prev, progress: data.progress } : null);
          }
          if (data.status === 'completed') {
            setCurrentTask((prev) => prev ? {
              ...prev,
              status: 'completed',
              progress: 100,
              downloadUrl: data.downloadUrl,
            } : null);
            sse.close();
            message.success('导出完成');
            fetchTaskHistory();
            onSuccess?.();
          }
          if (data.status === 'failed') {
            setCurrentTask((prev) => prev ? {
              ...prev,
              status: 'failed',
              errorMessage: data.message || '导出失败',
            } : null);
            sse.close();
          }
        },
        onError: () => {
          message.error('SSE 连接断开');
        },
      });
    } catch (error: any) {
      message.error(error?.message || '导出失败');
      setExporting(false);
    }
  };

  const handleDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportType}_export_${dayjs().format('YYYYMMDD')}.xlsx`;
    link.click();
  };

  const handleReset = () => {
    form.resetFields();
    setExporting(false);
    setProgress(0);
    setCurrentTask(null);
    sseRef.current?.close();
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const exportTypeLabels: Record<string, string> = {
    attendance: '打卡记录',
    schedule: '排班数据',
    employee: '员工数据',
  };

  return (
    <Modal
      title={`批量导出${exportTypeLabels[exportType]}`}
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={600}
    >
      <Form
        form={form}
        onFinish={handleExport}
        layout="vertical"
      >
        <Form.Item label="日期范围" name="dateRange">
          <RangePicker
            style={{ width: '100%' }}
            placeholder={['开始日期', '结束日期']}
            format="YYYY-MM-DD"
          />
        </Form.Item>

        <Form.Item label="员工（可选）" name="employee_id">
          <Select
            placeholder="选择员工"
            allowClear
            style={{ width: '100%' }}
            notFoundContent="请先在员工管理中添加员工"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space>
            <Button type="primary" htmlType="submit" icon={<DownloadOutlined />} loading={exporting}>
              开始导出
            </Button>
            <Button onClick={handleClose} disabled={exporting}>
              取消
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {exporting && currentTask && (
        <div style={{ marginTop: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <ClockCircleOutlined />
              <Text>导出进度</Text>
            </Space>
            <Progress
              percent={progress}
              status={currentTask.status === 'failed' ? 'exception' : progress === 100 ? 'success' : 'active'}
            />
            {currentTask.status === 'completed' && currentTask.downloadUrl && (
              <Button
                type="link"
                icon={<FileExcelOutlined />}
                onClick={() => handleDownload(currentTask.downloadUrl!)}
              >
                下载导出文件
              </Button>
            )}
            {currentTask.status === 'failed' && (
              <Text type="danger">{currentTask.errorMessage}</Text>
            )}
          </Space>
        </div>
      )}

      {completedTasks.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong>历史任务</Text>
          <List
            size="small"
            dataSource={completedTasks}
            renderItem={(task) => (
              <List.Item
                actions={[
                  task.status === 'completed' && task.downloadUrl ? (
                    <Button
                      key="download"
                      type="link"
                      size="small"
                      onClick={() => handleDownload(task.downloadUrl!)}
                    >
                      下载
                    </Button>
                  ) : null,
                ].filter(Boolean)}
              >
                <Space>
                  {task.status === 'completed' ? (
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  ) : (
                    <ClockCircleOutlined />
                  )}
                  <Text>{task.type} - {task.createdAt}</Text>
                  <Text type={task.status === 'completed' ? 'success' : 'secondary'}>
                    {task.status === 'completed' ? '已完成' : '处理中'}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      )}
    </Modal>
  );
};

export default ExportModal;
