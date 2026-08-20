import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Form,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  Modal,
  Upload,
  Tabs,
  Card,
  message,
  Descriptions,
  Input,
  ConfigProvider,
} from 'antd';
import {
  SearchOutlined,
  CheckOutlined,
  CloseOutlined,
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import {
  getExceptionList,
  getMyExceptionList,
  createException,
  auditException,
  cancelException,
  AttendanceException,
  CreateExceptionParams,
  Attachment,
} from '@/services/exception';
import { getEmployeeList, Employee, getProfile } from '@/services/employee';
import { getDepartmentList, Department } from '@/services/department';
import dayjs from 'dayjs';
import request from '@/services/request';
import { useAutoTableHeight } from '@/hooks/useAutoTableHeight';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '待审核', color: 'orange' },
  1: { text: '已通过', color: 'green' },
  2: { text: '已拒绝', color: 'red' },
};

const exceptionTypeMap: Record<number, string> = {
  1: '迟到',
  2: '早退',
  3: '缺卡',
  4: '外勤',
};

const exceptionTypeOptions = Object.entries(exceptionTypeMap).map(([key, value]) => ({
  value: parseInt(key),
  label: value,
}));

const statusOptions = Object.entries(statusMap).map(([key, value]) => ({
  value: parseInt(key),
  label: value.text,
}));

const getStatusTag = (status: number) => {
  const info = statusMap[status];
  return <Tag color={info?.color || 'default'}>{info?.text || '未知'}</Tag>;
};

const AdminView: React.FC = () => {
  const [filterForm] = Form.useForm();
  const [dataSource, setDataSource] = useState<AttendanceException[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [auditingRecord, setAuditingRecord] = useState<AttendanceException | null>(null);
  const [auditRemark, setAuditRemark] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);

  // 表格高度自适应
  const { ref: tableWrapRef, height: tableScrollY } = useAutoTableHeight<HTMLDivElement>(56);

  const fetchExceptions = useCallback(
    async (page = 1, size = 10, params: Record<string, any> = {}) => {
      setLoading(true);
      try {
        const res = await getExceptionList({ page, size, ...params });
        setDataSource(res.data.list || []);
        setPagination({ current: page, pageSize: size, total: res.data.total || 0 });
      } catch (error) {
        console.error('Fetch exceptions error:', error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await getEmployeeList({ page: 1, size: 500 });
      const list = Array.isArray(res.data?.list) ? res.data.list : (Array.isArray(res.data) ? res.data : []);
      setEmployees(list);
    } catch (error) {
      console.error('Fetch employees error:', error);
      setEmployees([]);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await getDepartmentList();
      const list = Array.isArray(res.data?.list) ? res.data.list : (Array.isArray(res.data) ? res.data : []);
      setDepartments(list);
    } catch (error) {
      console.error('Fetch departments error:', error);
      setDepartments([]);
    }
  }, []);

  useEffect(() => {
    fetchExceptions();
    fetchEmployees();
    fetchDepartments();
  }, [fetchExceptions, fetchEmployees, fetchDepartments]);

  const handleSearch = (values: Record<string, any>) => {
    const params: Record<string, any> = {};
    if (values.employee_id) params.employee_id = values.employee_id;
    if (values.status !== undefined && values.status !== null) params.status = values.status;
    if (values.dateRange && values.dateRange.length === 2) {
      params.start_date = values.dateRange[0].format('YYYY-MM-DD');
      params.end_date = values.dateRange[1].format('YYYY-MM-DD');
    }
    fetchExceptions(1, pagination.pageSize, params);
  };

  const handleReset = () => {
    filterForm.resetFields();
    fetchExceptions(1, pagination.pageSize);
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchExceptions(page, pageSize);
  };

  const handleAudit = (record: AttendanceException) => {
    setAuditingRecord(record);
    setAuditRemark('');
    setAuditModalVisible(true);
  };

  const handleConfirmAudit = async (status: number) => {
    if (!auditingRecord) return;
    setAuditLoading(true);
    try {
      await auditException(auditingRecord.id, { status, audit_remark: auditRemark });
      message.success(status === 1 ? '审核通过成功' : '审核拒绝成功');
      setAuditModalVisible(false);
      setAuditingRecord(null);
      fetchExceptions(pagination.current, pagination.pageSize);
    } catch (error) {
      message.error('审核失败，请重试');
    } finally {
      setAuditLoading(false);
    }
  };

  const columns = [
    {
      title: '员工姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 120,
      fixed: 'left' as const,
    },
    {
      title: '部门',
      dataIndex: 'dept_name',
      key: 'dept_name',
      width: 140,
    },
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      width: 100,
      render: (type: number) => (
        <Tag>{exceptionTypeMap[type] || '未知'}</Tag>
      ),
    },
    {
      title: '涉及日期',
      dataIndex: 'involved_date',
      key: 'involved_date',
      width: 120,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '申请原因',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      ellipsis: true,
    },
    {
      title: '申请时间',
      dataIndex: 'apply_time',
      key: 'apply_time',
      width: 170,
      render: (time: string) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '审核状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => getStatusTag(status),
    },
    {
      title: '审核备注',
      dataIndex: 'audit_remark',
      key: 'audit_remark',
      width: 160,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: AttendanceException) => {
        if (record.status !== 0) return null;
        return (
          <Button type="link" icon={<CheckOutlined />} onClick={() => handleAudit(record)}>
            审核
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Card style={{ marginBottom: 12, flexShrink: 0 }} styles={{ body: { padding: 16 } }}>
        <Form
          form={filterForm}
          onFinish={handleSearch}
          layout="inline"
          style={{ rowGap: 12 }}
        >
        <Form.Item name="employee_id" label="员工">
          <Select
            placeholder="选择员工"
            showSearch
            allowClear
            style={{ width: 200 }}
            options={employees.map((e) => ({ value: e.id, label: e.real_name }))}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="dateRange" label="日期范围">
          <RangePicker
            style={{ width: 260 }}
            placeholder={['开始日期', '结束日期']}
            format="YYYY-MM-DD"
          />
        </Form.Item>
        <Form.Item name="status" label="审核状态">
          <Select
            placeholder="选择状态"
            allowClear
            style={{ width: 150 }}
            options={statusOptions}
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              查询
            </Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Form.Item>
      </Form>
      </Card>

      <Card
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      >
        <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 24px 24px 24px' }}>
          <Table
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={handlePageChange}
            rowKey="id"
            scroll={{ x: 1200, y: tableScrollY }}
          />
        </div>
      </Card>

      <Modal
        title="审核异常申请"
        open={auditModalVisible}
        onCancel={() => {
          setAuditModalVisible(false);
          setAuditingRecord(null);
        }}
        width={640}
        footer={[
          <Button
            key="back"
            onClick={() => {
              setAuditModalVisible(false);
              setAuditingRecord(null);
            }}
          >
            取消
          </Button>,
          <Button
            key="reject"
            danger
            loading={auditLoading}
            onClick={() => handleConfirmAudit(2)}
          >
            拒绝
          </Button>,
          <Button
            key="pass"
            type="primary"
            loading={auditLoading}
            onClick={() => handleConfirmAudit(1)}
          >
            通过
          </Button>,
        ]}
      >
        {auditingRecord && (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="员工姓名">
                {auditingRecord.real_name}
              </Descriptions.Item>
              <Descriptions.Item label="部门">
                {auditingRecord.dept_name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="异常类型">
                {exceptionTypeMap[auditingRecord.exception_type]}
              </Descriptions.Item>
              <Descriptions.Item label="涉及日期">
                {auditingRecord.involved_date
                  ? dayjs(auditingRecord.involved_date).format('YYYY-MM-DD')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申请时间" span={2}>
                {auditingRecord.apply_time
                  ? dayjs(auditingRecord.apply_time).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="申请原因" span={2}>
                {auditingRecord.reason}
              </Descriptions.Item>
            </Descriptions>

            {auditingRecord.attachments && auditingRecord.attachments.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>附件列表：</div>
                <Upload
                  fileList={auditingRecord.attachments.map((att: Attachment, idx: number) => ({
                    uid: String(idx),
                    name: att.file_name,
                    status: 'done',
                    url: att.file_url,
                  }))}
                  previewButtonProps={{ disabled: false }}
                  onPreview={(file) => {
                    if (file.url) {
                      window.open(file.url, '_blank');
                    }
                  }}
                  showUploadList={{ showRemoveIcon: false }}
                />
              </div>
            )}

            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>审核备注：</div>
              <TextArea
                value={auditRemark}
                onChange={(e) => setAuditRemark(e.target.value)}
                placeholder="请输入审核备注（选填）"
                rows={4}
                maxLength={500}
                showCount
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const EmployeeView: React.FC = () => {
  const [applyForm] = Form.useForm();
  const [dataSource, setDataSource] = useState<AttendanceException[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 表格高度自适应
  const { ref: tableWrapRef, height: tableScrollY } = useAutoTableHeight<HTMLDivElement>(56);

  const fetchMyExceptions = useCallback(
    async (page = 1, size = 10) => {
      setLoading(true);
      try {
        const res = await getMyExceptionList({ page, size });
        setDataSource(res.data.list || []);
        setPagination({ current: page, pageSize: size, total: res.data.total || 0 });
      } catch (error) {
        console.error('Fetch my exceptions error:', error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchMyExceptions();
  }, [fetchMyExceptions]);

  const handleOpenApply = () => {
    applyForm.resetFields();
    setFileList([]);
    setApplyModalVisible(true);
  };

  const handleFileChange: UploadProps['onChange'] = ({ fileList: newList }) => {
    setFileList(newList);
  };

  const customRequest: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await request.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess?.(res.data, new XMLHttpRequest());
    } catch (err) {
      onError?.(err as Error);
    }
  };

  const handleApplySubmit = async (values: Record<string, any>) => {
    setApplyLoading(true);
    try {
      const uploadedFiles = fileList.map((f) => ({
        file_name: f.name,
        file_url: (f.response as any)?.url || f.url || '',
        file_size: f.size || 0,
      }));

      const params: CreateExceptionParams = {
        exception_type: values.exception_type,
        involved_date: values.involved_date.format('YYYY-MM-DD'),
        reason: values.reason,
        attachments: uploadedFiles,
      };

      await createException(params);
      message.success('申诉提交成功');
      setApplyModalVisible(false);
      applyForm.resetFields();
      setFileList([]);
      fetchMyExceptions(1, pagination.pageSize);
    } catch (error) {
      message.error('提交失败，请重试');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleCancel = (record: AttendanceException) => {
    Modal.confirm({
      title: '确认撤回',
      icon: <ExclamationCircleOutlined />,
      content: `确定要撤回 ${exceptionTypeMap[record.exception_type]} 申诉（${
        record.involved_date ? dayjs(record.involved_date).format('YYYY-MM-DD') : ''
      }）吗？`,
      okText: '确定撤回',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await cancelException(record.id);
          message.success('撤回成功');
          fetchMyExceptions(pagination.current, pagination.pageSize);
        } catch (error) {
          message.error('撤回失败，请重试');
        }
      },
    });
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchMyExceptions(page, pageSize);
  };

  const columns = [
    {
      title: '异常类型',
      dataIndex: 'exception_type',
      key: 'exception_type',
      width: 100,
      render: (type: number) => <Tag>{exceptionTypeMap[type] || '未知'}</Tag>,
    },
    {
      title: '涉及日期',
      dataIndex: 'involved_date',
      key: 'involved_date',
      width: 120,
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '申诉理由',
      dataIndex: 'reason',
      key: 'reason',
      width: 200,
      ellipsis: true,
    },
    {
      title: '申请时间',
      dataIndex: 'apply_time',
      key: 'apply_time',
      width: 170,
      render: (time: string) => (time ? dayjs(time).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '审核状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => getStatusTag(status),
    },
    {
      title: '审核备注',
      dataIndex: 'audit_remark',
      key: 'audit_remark',
      width: 160,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: AttendanceException) => {
        if (record.status !== 0) return null;
        return (
          <Button
            type="link"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleCancel(record)}
          >
            撤回
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Card
        title="我的申诉"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenApply}>
            发起申诉
          </Button>
        }
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginBottom: 0 }}
        styles={{ body: { flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      >
        <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 24px 24px 24px' }}>
          <Table
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            onChange={handlePageChange}
            rowKey="id"
            scroll={{ y: tableScrollY }}
          />
        </div>
      </Card>

      <Modal
        title="发起申诉"
        open={applyModalVisible}
        onCancel={() => {
          setApplyModalVisible(false);
          applyForm.resetFields();
          setFileList([]);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setApplyModalVisible(false);
              applyForm.resetFields();
              setFileList([]);
            }}
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={applyLoading}
            onClick={() => applyForm.submit()}
          >
            提交申诉
          </Button>,
        ]}
        destroyOnHidden
      >
        <Form form={applyForm} onFinish={handleApplySubmit} layout="vertical">
          <Form.Item
            name="involved_date"
            label="选择日期"
            rules={[{ required: true, message: '请选择申诉日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="请选择需要申诉的日期"
              format="YYYY-MM-DD"
              disabledDate={(current) => current && current > dayjs().endOf('day')}
            />
          </Form.Item>

          <Form.Item
            name="exception_type"
            label="申诉类型"
            rules={[{ required: true, message: '请选择申诉类型' }]}
          >
            <Select
              placeholder="请选择申诉类型"
              options={exceptionTypeOptions}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="申诉理由"
            rules={[
              { required: true, message: '请填写申诉理由' },
              { min: 5, message: '申诉理由不少于5个字符' },
            ]}
          >
            <TextArea
              placeholder="请详细说明申诉理由（不少于5个字符）"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item label="附件上传">
            <Upload
              fileList={fileList}
              onChange={handleFileChange}
              customRequest={customRequest}
              beforeUpload={(file) => {
                const isLt10M = file.size / 1024 / 1024 < 10;
                if (!isLt10M) {
                  message.error('文件大小不能超过10MB');
                  return false;
                }
                return true;
              }}
              accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
              multiple
            >
              <Button icon={<UploadOutlined />}>选择文件</Button>
              <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                支持 jpg/png/pdf/doc/docx 格式，单个文件不超过10MB
              </div>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const ExceptionAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('admin');

  const tabItems = [
    {
      key: 'admin',
      label: '管理员视图',
      children: <AdminView />,
    },
    {
      key: 'employee',
      label: '员工视图',
      children: <EmployeeView />,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        destroyOnHidden
        style={{ flexShrink: 0, marginBottom: 0 }}
        // 让 Tabs 的内容 pane 也占满剩余高度
        size="large"
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'admin' ? <AdminView /> : <EmployeeView />}
      </div>
    </div>
  );
};

export default ExceptionAuditPage;