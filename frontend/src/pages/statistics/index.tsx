import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Form,
  Select,
  DatePicker,
  Button,
  Space,
  Progress,
  Modal,
  Tabs,
  Tag,
  message,
  Tooltip,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  MinusCircleOutlined,
  DownloadOutlined,
  HistoryOutlined,
  ReloadOutlined,
  UserOutlined,
  TeamOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { request } from '@/services/request';
import { createSseInstance, SseInstance } from '@/services/sse';
import dayjs, { Dayjs } from 'dayjs';
import { useAutoTableHeight } from '@/hooks/useAutoTableHeight';
import { apiBase } from '@/utils/apiBase';

const { MonthPicker } = DatePicker;

type ViewMode = 'employee' | 'department';

interface StatisticsItem {
  id: string | number;
  name: string;
  attendanceDays: number;
  normalCount: number;
  lateCount: number;
  earlyCount: number;
  absentCount: number;
  fieldWorkCount: number;
  attendanceRate: number;
}

interface TaskItem {
  id: string | number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  fileName?: string;
  createdAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
};

const STATUS_TEXT: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '失败',
};

const StatisticsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [viewMode, setViewMode] = useState<ViewMode>('employee');
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsItem[]>([]);
  const [month, setMonth] = useState<Dayjs>(dayjs().startOf('month'));
  const [departmentId, setDepartmentId] = useState<string | number | undefined>();
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportProgress, setReportProgress] = useState(0);
  const [reportStatus, setReportStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [reportDownloadUrl, setReportDownloadUrl] = useState<string>('');
  const [reportError, setReportError] = useState<string>('');
  const sseRef = useRef<SseInstance | null>(null);

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [taskList, setTaskList] = useState<TaskItem[]>([]);

  // 表格高度自适应
  const { ref: tableWrapRef, height: tableScrollY } = useAutoTableHeight<HTMLDivElement>(56);

  const summaryData = useMemo(() => {
    const totalAttendanceDays = statistics.reduce((sum, s) => sum + s.attendanceDays, 0);
    const totalLate = statistics.reduce((sum, s) => sum + s.lateCount, 0);
    const totalEarly = statistics.reduce((sum, s) => sum + s.earlyCount, 0);
    const totalAbsent = statistics.reduce((sum, s) => sum + s.absentCount, 0);
    return { totalAttendanceDays, totalLate, totalEarly, totalAbsent };
  }, [statistics]);

  const topLateData = useMemo(() => {
    return [...statistics]
      .sort((a, b) => b.lateCount - a.lateCount)
      .slice(0, 10);
  }, [statistics]);

  const maxLateCount = useMemo(() => {
    return topLateData.length > 0 ? Math.max(...topLateData.map((d) => d.lateCount)) : 1;
  }, [topLateData]);

  const fetchStatistics = useCallback(
    async (params: Record<string, any> = {}) => {
      setLoading(true);
      try {
        const url = viewMode === 'employee' ? '/attendance/statistics/employee' : '/attendance/statistics/department';
        const res = await request.get(url, { params });
        const list: StatisticsItem[] = Array.isArray(res.data?.list) ? res.data.list : (Array.isArray(res.data) ? res.data : []);
        setStatistics(list);
        setPagination((prev) => ({ ...prev, total: list.length }));
      } catch (error) {
        console.error('Fetch statistics error:', error);
        setStatistics([]);
        message.error('获取统计数据失败');
      } finally {
        setLoading(false);
      }
    },
    [viewMode]
  );

  useEffect(() => {
    const params: Record<string, any> = {
      month: month.format('YYYY-MM'),
    };
    if (departmentId !== undefined) {
      params.department_id = departmentId;
    }
    fetchStatistics(params);
  }, [fetchStatistics, month, departmentId]);

  const handleSearch = () => {
    const params: Record<string, any> = {
      month: month.format('YYYY-MM'),
    };
    if (departmentId !== undefined) {
      params.department_id = departmentId;
    }
    fetchStatistics(params);
  };

  const handleTabChange = (key: string) => {
    setViewMode(key as ViewMode);
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination((prev) => ({ ...prev, current: page, pageSize }));
  };

  const paginatedData = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    return statistics.slice(start, start + pagination.pageSize);
  }, [statistics, pagination]);

  const handleGenerateReport = async () => {
    setReportModalVisible(true);
    setReportProgress(0);
    setReportStatus('processing');
    setReportDownloadUrl('');
    setReportError('');

    try {
      const res = await request.post('/task/generate-report', {
        month: month.format('YYYY-MM'),
        department_id: departmentId,
        view_mode: viewMode,
      });
      const taskId = res.data?.task_id || res.data?.id;

      // SSE 直连后端，绕过 umi 代理（umi proxy 对 text/event-stream 兼容性差，会缓冲响应导致前端收不到数据）
      const sseUrl = `${apiBase}/api/v1/task/sse/${taskId}`;
      const sse = createSseInstance(sseUrl);
      sseRef.current = sse;

      sse.setCallbacks({
        onMessage: (data: any) => {
          if (data.progress !== undefined) {
            setReportProgress(data.progress);
          }
          // 后端 status 字段：0=进行中, 1=完成, 2=失败
          if (data.status === 1 || data.status === 'completed') {
            setReportStatus('completed');
            setReportProgress(100);
            if (data.file_url || data.download_url) {
              setReportDownloadUrl(data.file_url || data.download_url);
            }
            sse.close();
            message.success('报表生成成功！');
          }
          if (data.status === 2 || data.status === 'failed') {
            setReportStatus('failed');
            setReportError(data.msg || data.error_message || '生成报表失败');
            sse.close();
          }
        },
        onError: () => {
          setReportStatus('failed');
          setReportError('连接中断，请重试');
          sse.close();
        },
      });
    } catch (error: any) {
      setReportStatus('failed');
      setReportError(error?.message || '创建任务失败');
    }
  };

  const closeReportModal = () => {
    setReportModalVisible(false);
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (reportStatus === 'completed') {
      fetchStatistics({ month: month.format('YYYY-MM') });
    }
  };

  const fetchTaskList = async () => {
    try {
      const res = await request.get('/task/list');
      const list: TaskItem[] = res.data?.list || res.data || [];
      setTaskList(list);
    } catch (error) {
      console.error('Fetch task list error:', error);
      message.error('获取任务列表失败');
    }
  };

  const handleHistoryClick = () => {
    setHistoryModalVisible(true);
    fetchTaskList();
  };

  const handleDownloadTask = (task: TaskItem) => {
    if (task.fileName) {
      window.open(task.fileName, '_blank');
    }
  };

  const columns = useMemo(
    () => [
      {
        title: viewMode === 'employee' ? '姓名' : '部门',
        dataIndex: 'name',
        key: 'name',
        width: 140,
        sorter: (a: StatisticsItem, b: StatisticsItem) => a.name.localeCompare(b.name),
      },
      {
        title: '出勤天数',
        dataIndex: 'attendanceDays',
        key: 'attendanceDays',
        width: 100,
        sorter: (a: StatisticsItem, b: StatisticsItem) => a.attendanceDays - b.attendanceDays,
      },
      {
        title: '正常打卡',
        dataIndex: 'normalCount',
        key: 'normalCount',
        width: 100,
        sorter: (a: StatisticsItem, b: StatisticsItem) => a.normalCount - b.normalCount,
      },
      {
        title: '迟到次数',
        dataIndex: 'lateCount',
        key: 'lateCount',
        width: 100,
        sorter: (a: StatisticsItem, b: StatisticsItem) => a.lateCount - b.lateCount,
        render: (val: number) => <span style={{ color: val > 0 ? '#faad14' : undefined }}>{val}</span>,
      },
      {
        title: '早退次数',
        dataIndex: 'earlyCount',
        key: 'earlyCount',
        width: 100,
        sorter: (a: StatisticsItem, b: StatisticsItem) => a.earlyCount - b.earlyCount,
        render: (val: number) => <span style={{ color: val > 0 ? '#722ed1' : undefined }}>{val}</span>,
      },
      {
        title: '缺卡次数',
        dataIndex: 'absentCount',
        key: 'absentCount',
        width: 100,
        sorter: (a: StatisticsItem, b: StatisticsItem) => a.absentCount - b.absentCount,
        render: (val: number) => <span style={{ color: val > 0 ? '#f5222d' : undefined }}>{val}</span>,
      },
      {
        title: '外勤次数',
        dataIndex: 'fieldWorkCount',
        key: 'fieldWorkCount',
        width: 100,
        sorter: (a: StatisticsItem, b: StatisticsItem) => a.fieldWorkCount - b.fieldWorkCount,
      },
      {
        title: '出勤率',
        dataIndex: 'attendanceRate',
        key: 'attendanceRate',
        width: 120,
        sorter: (a: StatisticsItem, b: StatisticsItem) => a.attendanceRate - b.attendanceRate,
        render: (val: number) => (
          <Progress
            percent={Math.round(val)}
            size="small"
            strokeColor={val >= 90 ? '#52c41a' : val >= 70 ? '#faad14' : '#f5222d'}
          />
        ),
      },
    ],
    [viewMode]
  );

  const taskColumns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status]} style={{ marginRight: 0 }}>
          {STATUS_TEXT[status]}
        </Tag>
      ),
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      width: 120,
      render: (val: number, record: TaskItem) => (
        <Progress
          percent={val}
          size="small"
          status={
            record.status === 'failed'
              ? 'exception'
              : record.status === 'completed'
              ? 'success'
              : 'active'
          }
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (val: string) => val || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: TaskItem) => (
        <Button
          type="link"
          size="small"
          disabled={record.status !== 'completed'}
          onClick={() => handleDownloadTask(record)}
        >
          下载
        </Button>
      ),
    },
  ];

  const renderBarChart = () => {
    if (topLateData.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          暂无数据
        </div>
      );
    }

    const colors = [
      '#f5222d', '#fa541c', '#fa8c16', '#faad14', '#a0d911',
      '#52c41a', '#13c2c2', '#1890ff', '#722ed1', '#eb2f96',
    ];

    return (
      <div style={{ padding: '8px 0' }}>
        {topLateData.map((item, index) => {
          const percent = maxLateCount > 0 ? (item.lateCount / maxLateCount) * 100 : 0;
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: index < topLateData.length - 1 ? 12 : 0,
              }}
            >
              <div
                style={{
                  width: 100,
                  textAlign: 'right',
                  paddingRight: 12,
                  fontSize: 13,
                  color: '#333',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Tooltip title={item.name}>{item.name}</Tooltip>
              </div>
              <div
                style={{
                  flex: 1,
                  background: '#f0f2f5',
                  borderRadius: 4,
                  height: 24,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${colors[index]}, ${colors[index]}dd)`,
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    paddingRight: 8,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 500,
                    minWidth: item.lateCount > 0 ? 30 : 0,
                  }}
                >
                  {item.lateCount > 0 && <span style={{ marginRight: 4 }}>{item.lateCount}</span>}
                </div>
                {item.lateCount === 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: 12,
                      color: '#999',
                    }}
                  >
                    0
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Tabs
        activeKey={viewMode}
        onChange={handleTabChange}
        style={{ marginBottom: 12, flexShrink: 0 }}
        items={[
          {
            key: 'employee',
            label: (
              <span>
                <UserOutlined /> 按员工统计
              </span>
            ),
          },
          {
            key: 'department',
            label: (
              <span>
                <TeamOutlined /> 按部门统计
              </span>
            ),
          },
        ]}
      />

      <Card style={{ marginBottom: 12, flexShrink: 0 }} styles={{ body: { padding: 16 } }}>
        <Form layout="inline" style={{ gap: 8 }}>
          <Form.Item label="月份">
            <MonthPicker
              value={month}
              onChange={(date) => setMonth(date || dayjs().startOf('month'))}
              format="YYYY年MM月"
              allowClear={false}
            />
          </Form.Item>
          <Form.Item label="部门">
            <Select
              placeholder="全部部门"
              allowClear
              style={{ width: 180 }}
              value={departmentId}
              onChange={(val) => setDepartmentId(val)}
              options={[
                { label: '技术部', value: 1 },
                { label: '产品部', value: 2 },
                { label: '运营部', value: 3 },
                { label: '市场部', value: 4 },
                { label: '人力资源部', value: 5 },
              ]}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" icon={<ReloadOutlined />} onClick={handleSearch}>
                查询
              </Button>
              <Button icon={<FileExcelOutlined />} onClick={handleGenerateReport}>
                生成报表
              </Button>
              <Button icon={<HistoryOutlined />} onClick={handleHistoryClick}>
                历史任务
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Row gutter={16} style={{ marginBottom: 12, flexShrink: 0 }}>
        <Col span={6}>
          <Card
            hoverable
            style={{ borderLeft: '4px solid #1890ff' }}
          >
            <Statistic
              title="出勤天数"
              value={summaryData.totalAttendanceDays}
              prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 28 }}
              suffix="天"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            hoverable
            style={{ borderLeft: '4px solid #faad14' }}
          >
            <Statistic
              title="迟到次数"
              value={summaryData.totalLate}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: 28 }}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            hoverable
            style={{ borderLeft: '4px solid #722ed1' }}
          >
            <Statistic
              title="早退次数"
              value={summaryData.totalEarly}
              prefix={<MinusCircleOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1', fontSize: 28 }}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            hoverable
            style={{ borderLeft: '4px solid #f5222d' }}
          >
            <Statistic
              title="缺卡次数"
              value={summaryData.totalAbsent}
              prefix={<WarningOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d', fontSize: 28 }}
              suffix="次"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 12, flexShrink: 0 }}>
        <Col span={12}>
          <Card title={`迟到次数 Top 10（${viewMode === 'employee' ? '员工' : '部门'}）`} styles={{ body: { padding: 16 } }}>
            {renderBarChart()}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="统计说明" styles={{ body: { padding: 16 } }}>
            <div style={{ padding: '8px 0' }}>
              <div style={{ marginBottom: 12 }}>
                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                <span>
                  <strong>出勤率</strong>：当月正常打卡次数 / 应打卡次数的百分比
                </span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <ClockCircleOutlined style={{ color: '#faad14', marginRight: 8 }} />
                <span>
                  <strong>迟到</strong>：上班打卡时间晚于规定上班时间
                </span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <MinusCircleOutlined style={{ color: '#722ed1', marginRight: 8 }} />
                <span>
                  <strong>早退</strong>：下班打卡时间早于规定下班时间
                </span>
              </div>
              <div style={{ marginBottom: 12 }}>
                <WarningOutlined style={{ color: '#f5222d', marginRight: 8 }} />
                <span>
                  <strong>缺卡</strong>：应打卡时段未完成打卡
                </span>
              </div>
              <div>
                <CalendarOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                <span>
                  <strong>出勤天数</strong>：当月有考勤记录的工作日天数
                </span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="详细统计数据" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} styles={{ body: { flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}>
        <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 24px 24px 24px' }}>
          <Table
            columns={columns}
            dataSource={paginatedData}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              onChange: handlePageChange,
            }}
            scroll={{ x: 1000, y: tableScrollY }}
            bordered
            size="middle"
          />
        </div>
      </Card>

      <Modal
        title="生成报表"
        open={reportModalVisible}
        onCancel={closeReportModal}
        footer={
          reportStatus === 'completed' ? (
            <Button type="primary" onClick={closeReportModal}>
              完成
            </Button>
          ) : reportStatus === 'failed' ? (
            <Button onClick={closeReportModal}>关闭</Button>
          ) : null
        }
        closable={reportStatus !== 'processing'}
        maskClosable={reportStatus !== 'processing'}
        centered
        width={520}
      >
        {reportStatus === 'idle' && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p>正在创建报表生成任务...</p>
          </div>
        )}
        {reportStatus === 'processing' && (
          <div style={{ padding: '16px 0' }}>
            <Progress
              percent={reportProgress}
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
              size={['100%', 20]}
            />
            <p style={{ textAlign: 'center', marginTop: 16 }}>
              正在生成报表，请稍候... {reportProgress}%
            </p>
          </div>
        )}
        {reportStatus === 'completed' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
            <p style={{ marginTop: 16, fontSize: 16 }}>报表生成成功！</p>
            {reportDownloadUrl && (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                href={reportDownloadUrl}
                target="_blank"
                style={{ marginTop: 16 }}
              >
                下载报表
              </Button>
            )}
          </div>
        )}
        {reportStatus === 'failed' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CloseCircleOutlined style={{ fontSize: 64, color: '#f5222d' }} />
            <p style={{ marginTop: 16, fontSize: 16, color: '#f5222d' }}>报表生成失败</p>
            <p style={{ color: '#999' }}>{reportError}</p>
            <Button
              type="primary"
              style={{ marginTop: 16 }}
              onClick={() => {
                closeReportModal();
                setTimeout(handleGenerateReport, 300);
              }}
            >
              重试
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        title="历史任务"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            关闭
          </Button>,
          <Button key="refresh" type="primary" icon={<ReloadOutlined />} onClick={fetchTaskList}>
            刷新
          </Button>,
        ]}
        width={760}
      >
        <Table
          columns={taskColumns}
          dataSource={taskList}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          locale={{ emptyText: '暂无历史任务' }}
          size="middle"
        />
      </Modal>
    </div>
  );
};

export default StatisticsPage;