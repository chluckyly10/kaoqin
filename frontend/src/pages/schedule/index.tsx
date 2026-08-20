import React, { useState, useEffect, useCallback } from 'react';
import { Table, Form, Select, DatePicker, Button, Space, message, Drawer, Popconfirm, Input, Card, Tabs, Tag, Row, Col, Empty, Modal } from 'antd';
import { request } from '@/services/request';
import { SearchOutlined, PlusOutlined, DeleteOutlined, CalendarOutlined, UnorderedListOutlined, ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import { getScheduleList, batchCreateSchedule, deleteSchedule, AttendanceSchedule } from '@/services/schedule';
import { getEmployeeList, Employee } from '@/services/employee';
import { getRuleList, AttendanceRule } from '@/services/rule';
import { getDepartmentList } from '@/services/department';
import dayjs, { Dayjs } from 'dayjs';
import { useAutoTableHeight } from '@/hooks/useAutoTableHeight';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface Department {
  id: number;
  name: string;
}

const SchedulePage: React.FC = () => {
  const [form] = Form.useForm();
  const [dataSource, setDataSource] = useState<AttendanceSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rules, setRules] = useState<AttendanceRule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [batchForm] = Form.useForm();
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(dayjs());
  const [calendarData, setCalendarData] = useState<Record<string, AttendanceSchedule[]>>({});

  // 表格高度自适应
  const { ref: tableWrapRef, height: tableScrollY } = useAutoTableHeight<HTMLDivElement>(56);

  const fetchSchedules = useCallback(async (page = 1, size = 10, params: Record<string, any> = {}) => {
    setLoading(true);
    try {
      const res = await getScheduleList({ page, size, ...params });
      setDataSource(res.data.list);
      setPagination({ current: page, pageSize: size, total: res.data.total });
    } catch (error) {
      console.error('Fetch schedules error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCalendarData = useCallback(async (month: Dayjs) => {
    const startDate = month.startOf('month').format('YYYY-MM-DD');
    const endDate = month.endOf('month').format('YYYY-MM-DD');
    
    try {
      const res = await getScheduleList({ 
        page: 1, 
        size: 1000, 
        start_date: startDate, 
        end_date: endDate 
      });
      
      const grouped: Record<string, AttendanceSchedule[]> = {};
      (res.data.list || []).forEach((item: AttendanceSchedule) => {
        const date = item.schedule_date;
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(item);
      });
      setCalendarData(grouped);
    } catch (error) {
      console.error('Fetch calendar data error:', error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await getEmployeeList({ page: 1, size: 1000 });
      const list = Array.isArray(res.data?.list) ? res.data.list : (Array.isArray(res.data) ? res.data : []);
      setEmployees(list);
    } catch (error) {
      console.error('Fetch employees error:', error);
      setEmployees([]);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const res = await getRuleList();
      const list = Array.isArray(res.data?.list) ? res.data.list : (Array.isArray(res.data) ? res.data : []);
      setRules(list);
    } catch (error) {
      console.error('Fetch rules error:', error);
      setRules([]);
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
    fetchSchedules();
    fetchEmployees();
    fetchRules();
    fetchDepartments();
  }, [fetchSchedules, fetchEmployees, fetchRules, fetchDepartments]);

  useEffect(() => {
    if (viewMode === 'calendar') {
      fetchCalendarData(calendarMonth);
    }
  }, [viewMode, calendarMonth, fetchCalendarData]);

  const handleSearch = (values: Record<string, any>) => {
    const params: Record<string, any> = {};
    if (values.employee_id) params.employee_id = values.employee_id;
    if (values.dept_id) params.dept_id = values.dept_id;
    if (values.dateRange && values.dateRange.length === 2) {
      params.start_date = values.dateRange[0].format('YYYY-MM-DD');
      params.end_date = values.dateRange[1].format('YYYY-MM-DD');
    }
    fetchSchedules(1, pagination.pageSize, params);
  };

  const handleReset = () => {
    form.resetFields();
    fetchSchedules(1, pagination.pageSize);
  };

  const handlePageChange = (page: number, pageSize: number) => {
    fetchSchedules(page, pageSize);
  };

  const handleBatchCreate = async (values: Record<string, any>) => {
    const { employee_ids, date_range, rule_id, remark } = values;
    if (!employee_ids || employee_ids.length === 0) {
      message.error('请选择员工');
      return;
    }
    if (!date_range || date_range.length !== 2) {
      message.error('请选择日期区间');
      return;
    }

    const startDate = date_range[0];
    const endDate = date_range[1];
    const schedules: { employee_id: number; schedule_date: string; rule_id: number; remark?: string }[] = [];

    let current = startDate;
    while (current.isBefore(endDate) || current.isSame(endDate)) {
      const dateStr = current.format('YYYY-MM-DD');
      employee_ids.forEach((employee_id: number) => {
        schedules.push({
          employee_id,
          schedule_date: dateStr,
          rule_id,
          remark,
        });
      });
      current = current.add(1, 'day');
    }

    try {
      await batchCreateSchedule({ schedules });
      message.success(`成功生成 ${schedules.length} 条排班记录`);
      setDrawerVisible(false);
      batchForm.resetFields();
      fetchSchedules(pagination.current, pagination.pageSize);
      if (viewMode === 'calendar') {
        fetchCalendarData(calendarMonth);
      }
    } catch (error: any) {
      message.error(error?.message || '批量排班失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id);
      message.success('删除成功');
      fetchSchedules(pagination.current, pagination.pageSize);
      if (viewMode === 'calendar') {
        fetchCalendarData(calendarMonth);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleClearMonth = async () => {
    Modal.confirm({
      title: '确定清空本月排班？',
      content: `将清空 ${calendarMonth.format('YYYY年MM月')} 的所有排班数据，此操作不可恢复。`,
      okText: '确认清空',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const startDate = calendarMonth.startOf('month').format('YYYY-MM-DD');
          const endDate = calendarMonth.endOf('month').format('YYYY-MM-DD');
          await request.delete('/attendance/schedule/batch', { 
            data: { start_date: startDate, end_date: endDate } 
          });
          message.success('清空成功');
          fetchCalendarData(calendarMonth);
          fetchSchedules(1, pagination.pageSize);
        } catch (error: any) {
          message.error(error?.message || '清空失败');
        }
      },
    });
  };

  const columns = [
    { 
      title: '排班日期', 
      dataIndex: 'schedule_date', 
      key: 'schedule_date', 
      width: 120,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD'),
    },
    { 
      title: '员工姓名', 
      dataIndex: 'real_name', 
      key: 'real_name', 
      width: 120,
    },
    { 
      title: '部门', 
      dataIndex: 'dept_name', 
      key: 'dept_name', 
      width: 120,
      render: (text: string) => text || '-',
    },
    { 
      title: '考勤规则', 
      dataIndex: 'rule_name', 
      key: 'rule_name', 
      width: 150,
      render: (text: string) => <Tag color="blue">{text || '-'}</Tag>,
    },
    { 
      title: '上班时间', 
      dataIndex: 'start_time', 
      key: 'start_time', 
      width: 100,
      render: (text: string, record: AttendanceSchedule) => {
        const rule = rules.find(r => r.id === record.rule_id);
        return rule?.start_time || '-';
      },
    },
    { 
      title: '下班时间', 
      dataIndex: 'end_time', 
      key: 'end_time', 
      width: 100,
      render: (_: any, record: AttendanceSchedule) => {
        const rule = rules.find(r => r.id === record.rule_id);
        return rule?.end_time || '-';
      },
    },
    { 
      title: '备注', 
      dataIndex: 'remark', 
      key: 'remark', 
      width: 150,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: any, record: AttendanceSchedule) => (
        <Popconfirm 
          title="确定删除此排班？" 
          onConfirm={() => handleDelete(record.id)}
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const renderCalendarView = () => {
    const startOfMonth = calendarMonth.startOf('month');
    const daysInMonth = calendarMonth.daysInMonth();
    const firstDayOfWeek = startOfMonth.day();
    
    const weeks: (Dayjs | null)[][] = [];
    let currentDay = startOfMonth.subtract(firstDayOfWeek, 'day');
    
    for (let week = 0; week < 6; week++) {
      const weekDays: (Dayjs | null)[] = [];
      for (let day = 0; day < 7; day++) {
        if (currentDay.month() === calendarMonth.month()) {
          weekDays.push(currentDay);
        } else {
          weekDays.push(null);
        }
        currentDay = currentDay.add(1, 'day');
      }
      weeks.push(weekDays);
      if (currentDay.month() !== calendarMonth.month()) break;
    }

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Space>
            <Button 
              onClick={() => setCalendarMonth(calendarMonth.subtract(1, 'month'))}
            >
              上月
            </Button>
            <h3 style={{ margin: 0 }}>{calendarMonth.format('YYYY年MM月')}</h3>
            <Button 
              onClick={() => setCalendarMonth(calendarMonth.add(1, 'month'))}
            >
              下月
            </Button>
          </Space>
          <Space>
            <Button 
              icon={<ReloadOutlined />}
              onClick={() => fetchCalendarData(calendarMonth)}
            >
              刷新
            </Button>
            <Button 
              danger 
              icon={<ClearOutlined />}
              onClick={handleClearMonth}
            >
              清空本月
            </Button>
          </Space>
        </div>
        
        <div style={{ 
          border: '1px solid #e8e8e8', 
          borderRadius: 8,
          overflow: 'hidden'
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)',
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #e8e8e8',
          }}>
            {weekDays.map((day, index) => (
              <div key={index} style={{ 
                padding: '12px', 
                textAlign: 'center',
                fontWeight: 'bold',
                color: index === 0 || index === 6 ? '#1890ff' : '#333',
                borderRight: index < 6 ? '1px solid #e8e8e8' : 'none',
              }}>
                {day}
              </div>
            ))}
          </div>
          
          {weeks.map((week, weekIndex) => (
            <div 
              key={weekIndex}
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(7, 1fr)',
                borderBottom: weekIndex < weeks.length - 1 ? '1px solid #e8e8e8' : 'none',
              }}
            >
              {week.map((day, dayIndex) => {
                if (!day) {
                  return (
                    <div 
                      key={dayIndex}
                      style={{ 
                        padding: '8px',
                        minHeight: 100,
                        backgroundColor: '#f5f5f5',
                        borderRight: dayIndex < 6 ? '1px solid #e8e8e8' : 'none',
                      }}
                    />
                  );
                }

                const dateStr = day.format('YYYY-MM-DD');
                const daySchedules = calendarData[dateStr] || [];
                const isToday = day.isSame(dayjs(), 'day');

                return (
                  <div 
                    key={dayIndex}
                    style={{ 
                      padding: '8px',
                      minHeight: 100,
                      backgroundColor: isToday ? '#e6f7ff' : '#fff',
                      borderRight: dayIndex < 6 ? '1px solid #e8e8e8' : 'none',
                      borderTop: isToday ? '2px solid #1890ff' : 'none',
                    }}
                  >
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: 'bold',
                      color: isToday ? '#1890ff' : '#333',
                      marginBottom: 4,
                    }}>
                      {day.format('D')}
                    </div>
                    {daySchedules.length > 0 ? (
                      <div style={{ fontSize: 12 }}>
                        <Tag color="blue" style={{ marginBottom: 2 }}>
                          {daySchedules.length} 人
                        </Tag>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#ccc' }}>无排班</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Card style={{ marginBottom: 12, flexShrink: 0 }} styles={{ body: { padding: 16 } }}>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item label="员工" style={{ marginBottom: 12 }}>
              <Select
                placeholder="选择员工"
                showSearch
                allowClear
                style={{ width: '100%' }}
                options={employees.map((e) => ({ value: e.id, label: e.real_name }))}
                filterOption={(input, option) =>
                  (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="部门" style={{ marginBottom: 12 }}>
              <Select
                placeholder="选择部门"
                allowClear
                style={{ width: '100%' }}
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="日期范围" style={{ marginBottom: 12 }}>
              <RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label=" " style={{ marginBottom: 12 }}>
              <Space>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                  查询
                </Button>
                <Button onClick={handleReset}>重置</Button>
              </Space>
            </Form.Item>
          </Col>
        </Row>
      </Card>

      <Card
        title={
          <Tabs
            activeKey={viewMode}
            onChange={(key) => setViewMode(key as 'table' | 'calendar')}
            items={[
              {
                key: 'table',
                label: (
                  <span>
                    <UnorderedListOutlined /> 表格视图
                  </span>
                ),
              },
              {
                key: 'calendar',
                label: (
                  <span>
                    <CalendarOutlined /> 日历视图
                  </span>
                ),
              },
            ]}
          />
        }
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setDrawerVisible(true)}
            >
              批量生成排班
            </Button>
          </Space>
        }
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, minHeight: 0, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      >
        {viewMode === 'table' ? (
          <div ref={tableWrapRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 24px 24px 24px' }}>
            <Table
              columns={columns}
              dataSource={dataSource}
              loading={loading}
              pagination={{ 
                ...pagination, 
                showSizeChanger: true, 
                showTotal: (total) => `共 ${total} 条排班`,
                pageSizeOptions: ['10', '20', '50'],
              }}
              onChange={handlePageChange}
              rowKey="id"
              scroll={{ x: 1000, y: tableScrollY }}
            />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0 24px 24px 24px' }}>
            {renderCalendarView()}
          </div>
        )}
      </Card>

      <Drawer
        title="批量生成排班"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          batchForm.resetFields();
        }}
        width={600}
        destroyOnHidden
      >
        <Form 
          form={batchForm} 
          onFinish={handleBatchCreate} 
          layout="vertical"
          initialValues={{ date_range: [dayjs(), dayjs().add(6, 'day')] }}
        >
          <Form.Item 
            label="选择员工" 
            name="employee_ids" 
            rules={[{ required: true, message: '请选择员工' }]}
          >
            <Select
              mode="multiple"
              placeholder="请选择员工（可多选）"
              showSearch
              style={{ width: '100%' }}
              options={employees.map((e) => ({ value: e.id, label: e.real_name }))}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>

          <Form.Item 
            label="日期范围" 
            name="date_range" 
            rules={[{ required: true, message: '请选择日期范围' }]}
            extra="将在所选日期区间内的每一天为每位员工生成一条排班"
          >
            <RangePicker 
              style={{ width: '100%' }} 
              format="YYYY-MM-DD"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          <Form.Item 
            label="考勤规则" 
            name="rule_id" 
            rules={[{ required: true, message: '请选择考勤规则' }]}
          >
            <Select 
              style={{ width: '100%' }} 
              placeholder="选择考勤规则"
              options={rules.map((r) => ({ 
                value: r.id, 
                label: `${r.rule_name} (${r.start_time} - ${r.end_time})` 
              }))}
            />
          </Form.Item>

          <Form.Item label="备注" name="remark">
            <Input.TextArea 
              placeholder="可选，为本次排班添加备注" 
              rows={2}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                确认生成
              </Button>
              <Button onClick={() => {
                setDrawerVisible(false);
                batchForm.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default SchedulePage;