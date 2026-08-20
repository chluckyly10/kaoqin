import React, { useState, useRef } from 'react';
import { Modal, Upload, Button, Progress, message, Space, Typography, List, Result } from 'antd';
import { UploadOutlined, DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { request } from '@/services/request';
import { createSseInstance, SseInstance } from '@/services/sse';
import { apiBase } from '@/utils/apiBase';

const { Text, Link } = Typography;

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  importType?: 'attendance' | 'employee' | 'schedule';
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

const ImportModal: React.FC<ImportModalProps> = ({
  open,
  onClose,
  onSuccess,
  importType = 'attendance',
}) => {
  const [fileList, setFileList] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    totalCount: number;
    successCount: number;
    failCount: number;
    errors: ImportError[];
  } | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const sseRef = useRef<SseInstance | null>(null);

  const getTemplateUrl = () => {
    const templates: Record<string, string> = {
      attendance: '/uploads/templates/attendance_template.xlsx',
      employee: '/uploads/templates/employee_template.xlsx',
      schedule: '/uploads/templates/schedule_template.xlsx',
    };
    return templates[importType] || templates.attendance;
  };

  const handleDownloadTemplate = () => {
    const url = `${apiBase}${getTemplateUrl()}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${importType}_template.xlsx`;
    link.click();
    message.success('模板下载中...');
  };

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上传 Excel 文件！');
      return false;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超过 10MB！');
      return false;
    }
    return false;
  };

  const handleImport = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择文件');
      return;
    }

    setUploading(true);
    setProgress(0);
    setImportResult(null);

    try {
      const file = fileList[0].originFileObj || fileList[0];
      const formData = new FormData();
      formData.append('file', file);

      const res = await request.post(`/task/import-${importType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { taskId: newTaskId } = res.data;
      setTaskId(newTaskId);

      const sseUrl = `/task/sse/${newTaskId}`;
      const sse = createSseInstance(sseUrl);
      sseRef.current = sse;

      sse.setCallbacks({
        onMessage: (data: any) => {
          if (data.progress !== undefined) {
            setProgress(data.progress);
          }
          if (data.status === 'completed') {
            setImportResult({
              success: true,
              totalCount: data.totalCount || 0,
              successCount: data.successCount || 0,
              failCount: data.failCount || 0,
              errors: data.errors || [],
            });
            sse.close();
            message.success('导入完成');
            onSuccess?.();
          }
          if (data.status === 'failed') {
            setImportResult({
              success: false,
              totalCount: data.totalCount || 0,
              successCount: 0,
              failCount: data.totalCount || 0,
              errors: data.errors || [{ row: 0, field: '', message: data.message || '导入失败' }],
            });
            sse.close();
          }
        },
        onError: () => {
          message.error('SSE 连接断开');
        },
      });
    } catch (error: any) {
      message.error(error?.message || '导入失败');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFileList([]);
    setProgress(0);
    setImportResult(null);
    setTaskId(null);
    sseRef.current?.close();
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal
      title={`批量导入${importType === 'attendance' ? '打卡记录' : importType === 'employee' ? '员工数据' : '排班数据'}`}
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={600}
    >
      {!importResult && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <FileExcelOutlined style={{ fontSize: 40, color: '#52c41a' }} />
              <div>
                <Text strong>Step 1: 下载导入模板</Text>
                <div>
                  <Link onClick={handleDownloadTemplate}>
                    <DownloadOutlined /> 下载 Excel 模板
                  </Link>
                </div>
              </div>
            </Space>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>Step 2: 上传填写好的 Excel 文件</Text>
            <Upload
              beforeUpload={handleUpload}
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList.slice(-1))}
              maxCount={1}
              accept=".xlsx,.xls"
            >
              <Button icon={<UploadOutlined />} disabled={uploading}>
                选择文件
              </Button>
            </Upload>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">支持 .xlsx, .xls 格式，最大 10MB</Text>
            </div>
          </div>

          {uploading && (
            <div style={{ marginBottom: 16 }}>
              <Text>正在导入...</Text>
              <Progress percent={progress} status={progress === 100 ? 'success' : 'active'} />
            </div>
          )}

          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={handleClose} disabled={uploading}>
                取消
              </Button>
              <Button type="primary" onClick={handleImport} loading={uploading}>
                开始导入
              </Button>
            </Space>
          </div>
        </>
      )}

      {importResult && (
        <>
          {importResult.success ? (
            <Result
              status="success"
              title="导入完成"
              subTitle={`共处理 ${importResult.totalCount} 条数据，成功 ${importResult.successCount} 条，失败 ${importResult.failCount} 条`}
            >
              {importResult.errors.length > 0 && (
                <List
                  header={<Text strong>错误详情</Text>}
                  bordered
                  dataSource={importResult.errors.slice(0, 10)}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        <Text>第 {item.row} 行 - {item.field}: {item.message}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Result>
          ) : (
            <Result
              status="error"
              title="导入失败"
              subTitle="请检查文件格式和数据是否正确"
            >
              {importResult.errors.length > 0 && (
                <List
                  header={<Text strong>错误详情</Text>}
                  bordered
                  dataSource={importResult.errors.slice(0, 10)}
                  renderItem={(item) => (
                    <List.Item>
                      <Space>
                        <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        <Text>第 {item.row} 行 - {item.field}: {item.message}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Result>
          )}

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={handleReset}>继续导入</Button>
              <Button type="primary" onClick={handleClose}>
                完成
              </Button>
            </Space>
          </div>
        </>
      )}
    </Modal>
  );
};

export default ImportModal;
