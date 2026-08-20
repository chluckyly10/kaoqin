import React, { useState, useEffect, useCallback } from 'react';
import { Table, Form, Input, InputNumber, Switch, Button, Space, message, Drawer, Popconfirm, Tag, Modal, Descriptions, List, Empty, Card, Row, Col, TimePicker } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, EnvironmentOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getRuleList, createRule, updateRule, deleteRule, AttendanceRule } from '@/services/rule';
import { request } from '@/services/request';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useAutoTableHeight } from '@/hooks/useAutoTableHeight';

dayjs.extend(customParseFormat);

interface RuleEmployee {
  id: number;
  real_name: string;
  username: string;
  dept_name: string;
}

const RulePage: React.FC = () => {
  const [dataSource, setDataSource] = useState<AttendanceRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<AttendanceRule | null>(null);
  const [form] = Form.useForm();
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [currentRule, setCurrentRule] = useState<AttendanceRule | null>(null);
  const [ruleEmployees, setRuleEmployees] = useState<RuleEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);

  // 表格高度自适应
  const { ref: tableWrapRef, height: tableScrollY } = useAutoTableHeight<HTMLDivElement>(56);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRuleList();
      const list = Array.isArray(res.data?.list) ? res.data.list : (Array.isArray(res.data) ? res.data : []);
      setDataSource(list);
    } catch (error) {
      console.error('Fetch rules error:', error);
      setDataSource([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRuleEmployees = useCallback(async (ruleId: number) => {
    setEmployeesLoading(true);
    try {
      const res = await request.get(`/attendance/rule/${ruleId}/employees`);
      setRuleEmployees(res.data || []);
    } catch (error) {
      console.error('Fetch rule employees error:', error);
      setRuleEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      late_minute: 15,
      early_minute: 15,
      allow_outside: false,
      status: true,
    });
    setDrawerVisible(true);
  };

  const handleEdit = (rule: AttendanceRule) => {
    setEditingRule(rule);
    form.setFieldsValue({
      ...rule,
      status: rule.status === 1,
    });
    setDrawerVisible(true);
  };

  const handleViewEmployees = async (rule: AttendanceRule) => {
    setCurrentRule(rule);
    setEmployeeModalVisible(true);
    await fetchRuleEmployees(rule.id);
  };

  const handleSave = async (values: Record<string, any>) => {
    const payload = {
      ...values,
      status: values.status ? 1 : 0,
      allow_outside: values.allow_outside ? 1 : 0,
    };

    try {
      if (editingRule) {
        await updateRule(editingRule.id, payload);
        message.success('更新成功');
      } else {
        await createRule(payload as Omit<AttendanceRule, 'id'>);
        message.success('创建成功');
      }
      setDrawerVisible(false);
      form.resetFields();
      fetchRules();
    } catch (error: any) {
      message.error(error?.message || '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRule(id);
      message.success('删除成功');
      fetchRules();
    } catch (error: any) {
      message.error(error?.message || '删除失败');
    }
  };

  const columns = [
    {
      title: '规则名称',
      dataIndex: 'rule_name',
      key: 'rule_name',
      width: 150,
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '上班时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 120,
      render: (text: string) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '下班时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 120,
      render: (text: string) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#52c41a' }} />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '迟到阈值',
      dataIndex: 'late_minute',
      key: 'late_minute',
      width: 120,
      render: (text: number) => <Tag color="orange">{text} 分钟</Tag>,
    },
    {
      title: '早退阈值',
      dataIndex: 'early_minute',
      key: 'early_minute',
      width: 120,
      render: (text: number) => <Tag color="blue">{text} 分钟</Tag>,
    },
    {
      title: '外勤打卡',
      dataIndex: 'allow_outside',
      key: 'allow_outside',
      width: 100,
      render: (status: number) => (
        status === 1 
          ? <Tag color="green"><EnvironmentOutlined /> 允许</Tag>
          : <Tag color="default">不允许</Tag>
      ),
    },
    {
      title: '加班规则',
      dataIndex: 'overtime_rule',
      key: 'overtime_rule',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'default'}>
          {status === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: AttendanceRule) => (
        <Space size="small">
          <Button 
            type="link" 
            icon={<EyeOutlined />} 
            onClick={() => handleViewEmployees(record)}
          >
            使用员工
          </Button>
          <Button 
            type="link" 
            icon={<EditOutlined />} 
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm 
            title="确定删除此考勤规则？" 
            description="删除后使用该规则的员工排班将受影响"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <Card style={{ marginBottom: 12, flexShrink: 0 }} styles={{ body: { padding: 16 } }}>
        <Row justify="space-between" align="middle">
          <Col>
            <h2 style={{ margin: 0 }}>考勤规则管理</h2>
            <span style={{ color: '#999', fontSize: 14 }}>
              管理公司考勤规则，设置上下班时间、迟到早退阈值等
            </span>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新增规则
            </Button>
          </Col>
        </Row>
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
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条规则` }}
            rowKey="id"
            scroll={{ x: 1200, y: tableScrollY }}
          />
        </div>
      </Card>

      <Drawer
        title={editingRule ? '编辑考勤规则' : '新增考勤规则'}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          form.resetFields();
        }}
        width={600}
        destroyOnHidden
      >
        <Form form={form} onFinish={handleSave} layout="vertical" initialValues={{ late_minute: 15, early_minute: 15, allow_outside: false, status: true }}>
          <Form.Item 
            label="规则名称" 
            name="rule_name" 
            rules={[{ required: true, message: '请输入规则名称' }]}
          >
            <Input placeholder="如：标准工时制、弹性工时制" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                label="上班时间" 
                name="start_time" 
                rules={[{ required: true, message: '请选择上班时间' }]}
                getValueProps={(value) => ({
                  value: value ? dayjs(value, 'HH:mm') : null,
                })}
                normalize={(value) => (value ? value.format('HH:mm') : value)}
              >
                <TimePicker format="HH:mm" style={{ width: '100%' }} placeholder="选择上班时间" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                label="下班时间" 
                name="end_time" 
                rules={[{ required: true, message: '请选择下班时间' }]}
                getValueProps={(value) => ({
                  value: value ? dayjs(value, 'HH:mm') : null,
                })}
                normalize={(value) => (value ? value.format('HH:mm') : value)}
              >
                <TimePicker format="HH:mm" style={{ width: '100%' }} placeholder="选择下班时间" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="迟到阈值(分钟)" name="late_minute">
                <InputNumber min={0} max={120} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="早退阈值(分钟)" name="early_minute">
                <InputNumber min={0} max={120} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item 
            label={
              <Space>
                <EnvironmentOutlined />
                <span>是否允许外勤打卡</span>
              </Space>
            } 
            name="allow_outside" 
            valuePropName="checked"
            extra="开启后员工可在公司以外地点打卡"
          >
            <Switch checkedChildren="允许" unCheckedChildren="禁止" />
          </Form.Item>

          <Form.Item label="加班规则说明" name="overtime_rule">
            <Input.TextArea 
              placeholder="如：工作日延长工作时间不超过3小时，每月不超过36小时" 
              rows={3}
            />
          </Form.Item>

          <Form.Item label="启用状态" name="status" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => {
                setDrawerVisible(false);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        title={
          <Space>
            <EyeOutlined />
            <span>使用该规则的员工</span>
          </Space>
        }
        open={employeeModalVisible}
        onCancel={() => {
          setEmployeeModalVisible(false);
          setCurrentRule(null);
        }}
        footer={[
          <Button key="close" onClick={() => setEmployeeModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {currentRule && (
          <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="规则名称">{currentRule.rule_name}</Descriptions.Item>
            <Descriptions.Item label="时间">{currentRule.start_time} - {currentRule.end_time}</Descriptions.Item>
          </Descriptions>
        )}
        <List
          loading={employeesLoading}
          dataSource={ruleEmployees}
          locale={{ emptyText: <Empty description="暂无员工使用此规则" /> }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={item.real_name}
                description={
                  <Space>
                    <span>账号：{item.username}</span>
                    <span>部门：{item.dept_name}</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default RulePage;