import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  message,
  Tag,
  Row,
  Col,
  Badge,
  Dropdown,
  Card,
  Tooltip,
  Typography,
  Modal,
} from 'antd';
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  PlusOutlined,
  ReloadOutlined,
  MoreOutlined,
  BellOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { request } from '@/services/request';
import { createWsInstance, WebSocketInstance } from '@/services/webSocket';
import ImportModal from '@/components/ImportModal';
import ExportModal from '@/components/ExportModal';
import SignRecordModal from '@/components/SignRecordModal';
import { useAutoTableHeight } from '@/hooks/useAutoTableHeight';
import { getWsUrl } from '@/utils/apiBase';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

interface AttendanceRecord {
  id: number;
  employee_id: number;
  sign_type: number;
  sign_time: string;
  address: string;
  sign_source: number;
  status: number;
  remark: string;
  real_name: string;
  username: string;
  dept_name: string;
  rule_name: string;
}

interface Employee {
  id: number;
  real_name: string;
  username: string;
  dept_name: string;
}

const statusMap: Record<number, { text: string; color: string }> = {
  0: { text: '正常', color: 'green' },
  1: { text: '迟到', color: 'orange' },
  2: { text: '早退', color: 'blue' },
  3: { text: '缺卡', color: 'red' },
  4: { text: '外勤', color: 'purple' },
};

const signTypeMap: Record<number, string> = { 1: '签到', 2: '签退' };
const signSourceMap: Record<number, string> = {
  1: '后台录入',
  2: '移动端',
  3: '人脸设备',
  4: '外勤打卡',
};

const AttendanceRecordPage: React.FC = () => {
  const [form] = Form.useForm();
  const [dataSource, setDataSource] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [signModalVisible, setSignModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [newRecordCount, setNewRecordCount] = useState(0);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);
  const wsRef = useRef<WebSocketInstance | null>(null);

  // 表格高度自适应
  const { ref: tableWrapRef, height: tableScrollY } = useAutoTableHeight<HTMLDivElement>(56);

  const fetchRecords = useCallback(async (page = 1, size = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const res = await request.get('/attendance/record/page', { params: { page, size, ...params } });
      setDataSource(res.data.list);
      setPagination({ current: page, pageSize: size, total: res.data.total });
    } catch (error) {
      console.error('Fetch records error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await request.get('/employee/page', { params: { page: 1, size: 1000 } });
      const list = Array.isArray(res.data?.list) ? res.data.list : (Array.isArray(res.data) ? res.data : []);
      setEmployees(list);
    } catch (error) {
      console.error('Fetch employees error:', error);
      setEmployees([]);
    }
  }, []);

  const fetchDepts = useCallback(async () => {
    try {
      const res = await request.get('/department/list');
      const list = Array.isArray(res.data?.list) ? res.data.list : (Array.isArray(res.data) ? res.data : []);
      setDepts(list);
    } catch (error) {
      console.error('Fetch departments error:', error);
      setDepts([]);
    }
  }, []);

  const initWebSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = getWsUrl('/ws');

    const ws = createWsInstance(wsUrl, {
      reconnectDelay: 3000,
      maxReconnectDelay: 30000,
      heartbeatInterval: 30000,
    });

    ws.subscribe('new_attendance_record', () => {
      setNewRecordCount((prev) => prev + 1);
      message.success('有新的打卡记录，请点击刷新');
    });

    wsRef.current = ws;

    setTimeout(() => {
      if (ws.connected) {
        setWsConnected(true);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchEmployees();
    fetchDepts();
    initWebSocket();

    return () => {
      wsRef.current?.close();
    };
  }, [fetchRecords, fetchEmployees, fetchDepts, initWebSocket]);

  const handleSearch = (values: Record<string, any>) => {
    const params: Record<string, any> = {};
    if (values.keyword) params.keyword = values.keyword;
    if (values.employee_id) params.employee_id = values.employee_id;
    if (values.dept_id) params.dept_id = values.dept_id;
    if (values.status !== undefined && values.status !== '') params.status = values.status;
    if (values.sign_type !== undefined && values.sign_type !== '') params.sign_type = values.sign_type;
    if (values.sign_source !== undefined && values.sign_source !== '') params.sign_source = values.sign_source;
    if (values.dateRange && values.dateRange.length === 2) {
      params.start_date = values.dateRange[0].format('YYYY-MM-DD');
      params.end_date = values.dateRange[1].format('YYYY-MM-DD');
    }
    fetchRecords(1, pagination.pageSize, params);
  };

  const handleReset = () => {
    form.resetFields();
    fetchRecords(1, pagination.pageSize);
  };

  const handleRefresh = () => {
    fetchRecords(pagination.current, pagination.pageSize);
    setNewRecordCount(0);
    message.success('数据已刷新');
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchRecords(page, pageSize);
  };

  const handleViewDetail = (record: AttendanceRecord) => {
    setDetailRecord(record);
    setDetailDrawerVisible(true);
  };

  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setSignModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/attendance/record/${id}`);
      message.success('删除成功');
      fetchRecords(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(error?.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }
    try {
      await request.delete('/attendance/record/batch', { data: { ids: selectedRowKeys } });
      message.success(`成功删除 ${selectedRowKeys.length} 条记录`);
      setSelectedRowKeys([]);
      fetchRecords(pagination.current, pagination.pageSize);
    } catch (error: any) {
      message.error(error?.message || '批量删除失败');
    }
  };

  const handleException = (record: AttendanceRecord) => {
    message.info(`为员工 ${record.real_name} 发起异常申诉`);
  };

  const handleAddSign = () => {
    setEditingRecord(null);
    setSignModalVisible(true);
  };

  const columns: ColumnsType<AttendanceRecord> = [
    {
      title: '打卡时间',
      dataIndex: 'sign_time',
      key: 'sign_time',
      width: 180,
      sorter: (a, b) => new Date(a.sign_time).getTime() - new Date(b.sign_time).getTime(),
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '员工姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 100,
    },
    {
      title: '账号',
      dataIndex: 'username',
      key: 'username',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'dept_name',
      key: 'dept_name',
      width: 120,
    },
    {
      title: '打卡类型',
      dataIndex: 'sign_type',
      key: 'sign_type',
      width: 80,
      render: (type: number) => <Tag color={type === 1 ? 'blue' : 'green'}>{signTypeMap[type]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number) => {
        const info = statusMap[status] || { text: '未知', color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '考勤规则',
      dataIndex: 'rule_name',
      key: 'rule_name',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '打卡来源',
      dataIndex: 'sign_source',
      key: 'sign_source',
      width: 100,
      render: (source: number) => signSourceMap[source] || '未知',
    },
    {
      title: '打卡地址',
      dataIndex: 'address',
      key: 'address',
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_: any, record: AttendanceRecord) => (
        <Space size={4}>
          <Tooltip title="查看详情">
            <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
              详情
            </Button>
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          </Tooltip>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'exception',
                  label: '发起申诉',
                  icon: <ExclamationCircleOutlined />,
                  onClick: () => handleException(record),
                },
                { type: 'divider' },
                {
                  key: 'delete',
                  label: '删除',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => handleDelete(record.id),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button type="link" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Card style={{ marginBottom: 12, flexShrink: 0 }} styles={{ body: { padding: 16 } }}>
        <Form form={form} onFinish={handleSearch} layout="vertical">
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="keyword" label="关键词搜索">
                <Input
                  placeholder="搜索员工姓名/账号"
                  prefix={<SearchOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="employee_id" label="员工">
                <Select
                  placeholder="选择员工"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  {employees.map((emp) => (
                    <Option key={emp.id} value={emp.id}>
                      {emp.real_name} ({emp.username})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="dept_id" label="部门">
                <Select placeholder="选择部门" allowClear>
                  {depts.map((dept) => (
                    <Option key={dept.id} value={dept.id}>
                      {dept.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="dateRange" label="日期范围">
                <RangePicker style={{ width: '100%' }} placeholder={['开始日期', '结束日期']} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={4}>
              <Form.Item name="status" label="打卡状态">
                <Select placeholder="全部" allowClear>
                  {Object.entries(statusMap).map(([key, value]) => (
                    <Option key={key} value={parseInt(key)}>{value.text}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="sign_type" label="打卡类型">
                <Select placeholder="全部" allowClear>
                  <Option value={1}>签到</Option>
                  <Option value={2}>签退</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="sign_source" label="打卡来源">
                <Select placeholder="全部" allowClear>
                  {Object.entries(signSourceMap).map(([key, value]) => (
                    <Option key={key} value={parseInt(key)}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label=" ">
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                    查询
                  </Button>
                  <Button onClick={handleReset}>重置</Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title={
          <Space>
            <span>打卡流水</span>
            {wsConnected && (
              <Badge status="success" text="实时连接" />
            )}
            {newRecordCount > 0 && (
              <Tag color="orange" onClick={handleRefresh} style={{ cursor: 'pointer' }}>
                <BellOutlined /> {newRecordCount} 条新记录，点击刷新
              </Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <Button danger onClick={handleBatchDelete}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            )}
            <Button icon={<PlusOutlined />} onClick={handleAddSign}>
              新增打卡
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => setImportModalVisible(true)}>
              批量导入
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => setExportModalVisible(true)}>
              批量导出
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Space>
        }
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      >
        <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 24px 24px 24px' }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={dataSource}
            loading={loading}
            scroll={{ x: 1400, y: tableScrollY }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['20', '50', '100', '200'],
            }}
            onChange={handlePageChange}
          />
        </div>
      </Card>

      <ImportModal
        open={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        onSuccess={handleRefresh}
        importType="attendance"
      />

      <ExportModal
        open={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onSuccess={handleRefresh}
        exportType="attendance"
      />

      <SignRecordModal
        open={signModalVisible}
        onClose={() => {
          setSignModalVisible(false);
          setEditingRecord(null);
        }}
        onSuccess={handleRefresh}
        record={editingRecord || undefined}
        mode={editingRecord ? 'edit' : 'create'}
      />

      <Modal
        title="打卡记录详情"
        open={detailDrawerVisible}
        onCancel={() => setDetailDrawerVisible(false)}
        footer={[
          <Button key="edit" type="primary" onClick={() => {
            if (detailRecord) {
              setEditingRecord(detailRecord);
              setDetailDrawerVisible(false);
              setSignModalVisible(true);
            }
          }}>
            编辑
          </Button>,
          <Button key="close" onClick={() => setDetailDrawerVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {detailRecord && (
          <Card>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text strong>员工姓名：</Text>
                <Text>{detailRecord.real_name}</Text>
              </Col>
              <Col span={12}>
                <Text strong>账号：</Text>
                <Text>{detailRecord.username}</Text>
              </Col>
              <Col span={12}>
                <Text strong>部门：</Text>
                <Text>{detailRecord.dept_name}</Text>
              </Col>
              <Col span={12}>
                <Text strong>打卡类型：</Text>
                <Tag color={detailRecord.sign_type === 1 ? 'blue' : 'green'}>
                  {signTypeMap[detailRecord.sign_type]}
                </Tag>
              </Col>
              <Col span={12}>
                <Text strong>打卡时间：</Text>
                <Text>{dayjs(detailRecord.sign_time).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </Col>
              <Col span={12}>
                <Text strong>状态：</Text>
                <Tag color={statusMap[detailRecord.status]?.color}>
                  {statusMap[detailRecord.status]?.text}
                </Tag>
              </Col>
              <Col span={12}>
                <Text strong>考勤规则：</Text>
                <Text>{detailRecord.rule_name || '-'}</Text>
              </Col>
              <Col span={12}>
                <Text strong>打卡来源：</Text>
                <Text>{signSourceMap[detailRecord.sign_source] || '未知'}</Text>
              </Col>
              <Col span={24}>
                <Text strong>打卡地址：</Text>
                <Text>{detailRecord.address || '-'}</Text>
              </Col>
              {detailRecord.remark && (
                <Col span={24}>
                  <Text strong>备注：</Text>
                  <Text>{detailRecord.remark}</Text>
                </Col>
              )}
            </Row>
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default AttendanceRecordPage;
