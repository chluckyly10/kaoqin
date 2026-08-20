import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Switch,
  InputNumber,
  Checkbox,
  Button,
  Space,
  Form,
  Row,
  Col,
  message,
  Transfer,
  Divider,
  Typography,
} from 'antd';
import {
  SafetyCertificateOutlined,
  EnvironmentOutlined,
  CheckSquareOutlined,
  TeamOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { request } from '@/services/request';
import { getEmployeeList } from '@/services/employee';
import { getDepartmentList } from '@/services/department';

const { Title, Text, Paragraph } = Typography;

interface OutSetting {
  id?: number;
  enabled: boolean;
  radius: number;
  require_photo: boolean;
  require_remark: boolean;
  require_location: boolean;
  allowed_employee_ids: number[];
  allowed_department_ids: number[];
}

interface EmployeeItem {
  id: number;
  real_name: string;
  dept_name: string;
}

interface DepartmentItem {
  id: number;
  dept_name: string;
}

type TargetKey = string;

interface TransferItem {
  key: string;
  title: string;
  description?: string;
  type: 'employee' | 'department';
  rawId: number;
}

const OutSettingPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(true);
  const [radius, setRadius] = useState(300);
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [requireRemark, setRequireRemark] = useState(false);
  const [requireLocation, setRequireLocation] = useState(true);

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<TargetKey[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const [form] = Form.useForm();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request.get('/attendance/out-setting');
      const data: OutSetting = res.data || {};

      setEnabled(data.enabled ?? true);
      setRadius(data.radius ?? 300);
      setRequirePhoto(data.require_photo ?? false);
      setRequireRemark(data.require_remark ?? false);
      setRequireLocation(data.require_location ?? true);

      const empIds: number[] = data.allowed_employee_ids || [];
      const deptIds: number[] = data.allowed_department_ids || [];
      const keys: TargetKey[] = [
        ...empIds.map((id) => `emp-${id}`),
        ...deptIds.map((id) => `dept-${id}`),
      ];
      setSelectedKeys(keys);

      form.setFieldsValue({
        radius: data.radius ?? 300,
      });
    } catch (error) {
      console.error('Fetch out settings error:', error);
      message.error('获取外勤打卡设置失败');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const fetchEmployeesAndDepartments = useCallback(async () => {
    setLoadingData(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        getEmployeeList({ page: 1, size: 9999 }),
        getDepartmentList(),
      ]);

      const empList: EmployeeItem[] = Array.isArray(empRes.data?.list) ? empRes.data.list : (Array.isArray(empRes.data) ? empRes.data : []);
      const deptList: DepartmentItem[] = Array.isArray(deptRes.data?.list) ? deptRes.data.list : (Array.isArray(deptRes.data) ? deptRes.data : []);

      setEmployees(empList);
      setDepartments(deptList);
    } catch (error) {
      console.error('Fetch employees/departments error:', error);
      setEmployees([]);
      setDepartments([]);
      message.error('获取员工和部门数据失败');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchEmployeesAndDepartments();
  }, [fetchSettings, fetchEmployeesAndDepartments]);

  const transferDataSource: TransferItem[] = [
    ...departments.map((d) => ({
      key: `dept-${d.id}`,
      title: d.dept_name,
      description: '部门',
      type: 'department' as const,
      rawId: d.id,
    })),
    ...employees.map((e) => ({
      key: `emp-${e.id}`,
      title: e.real_name || e.username,
      description: `员工 · ${e.dept_name || ''}`,
      type: 'employee' as const,
      rawId: e.id,
    })),
  ];

  const handleTransferChange = (targetKeys: TargetKey[]) => {
    setSelectedKeys(targetKeys);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const empIds: number[] = [];
      const deptIds: number[] = [];

      selectedKeys.forEach((key) => {
        const item = transferDataSource.find((t) => t.key === key);
        if (item) {
          if (item.type === 'employee') {
            empIds.push(item.rawId);
          } else {
            deptIds.push(item.rawId);
          }
        }
      });

      const payload: OutSetting = {
        enabled,
        radius,
        require_photo: requirePhoto,
        require_remark: requireRemark,
        require_location: requireLocation,
        allowed_employee_ids: empIds,
        allowed_department_ids: deptIds,
      };

      await request.post('/attendance/out-setting/save', payload);
      message.success('外勤打卡设置保存成功');
    } catch (error) {
      console.error('Save out settings error:', error);
      message.error('保存外勤打卡设置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          外勤打卡设置
        </Title>
        <Text type="secondary">配置外勤打卡相关规则和权限</Text>
      </div>

      <Form form={form} layout="vertical">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card
            loading={loading}
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: 24 } }}
          >
            <Space align="start" size="middle" style={{ width: '100%' }}>
              <SafetyCertificateOutlined
                style={{ fontSize: 28, color: '#1890ff', marginTop: 4 }}
              />
              <div style={{ flex: 1 }}>
                <Title level={5} style={{ marginBottom: 8 }}>
                  外勤打卡权限
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  开启后，允许指定员工通过移动端进行外勤打卡。外勤打卡可在地理位置有效范围内进行签到，适用于出差、外出办公等场景。
                </Paragraph>
                <Space>
                  <Text>是否启用户外勤打卡功能：</Text>
                  <Switch
                    checked={enabled}
                    onChange={(checked) => setEnabled(checked)}
                    checkedChildren="开启"
                    unCheckedChildren="关闭"
                  />
                </Space>
              </div>
            </Space>
          </Card>

          <Card
            loading={loading}
            title={
              <Space>
                <EnvironmentOutlined style={{ color: '#1890ff' }} />
                <span>打卡有效范围</span>
              </Space>
            }
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: 24 } }}
          >
            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} lg={12}>
                <Form.Item
                  label="地理位置半径（米）"
                  name="radius"
                  rules={[{ required: true, message: '请输入有效范围' }]}
                >
                  <Space.Compact style={{ width: 200 }}>
                    <InputNumber
                      min={10}
                      max={5000}
                      value={radius}
                      onChange={(val) => setRadius(val ?? 300)}
                      style={{ width: 'calc(100% - 30px)' }}
                      placeholder="10 - 5000"
                    />
                    <Button disabled style={{ width: 30 }}>米</Button>
                  </Space.Compact>
                </Form.Item>
                <Paragraph type="secondary" style={{ marginTop: -8 }}>
                  员工在打卡时，需在指定的有效范围内才能完成定位打卡。支持设置 10 米到 5000 米的范围。
                </Paragraph>
                <Space>
                  {[100, 200, 500, 1000].map((preset) => (
                    <Button
                      key={preset}
                      size="small"
                      type={radius === preset ? 'primary' : 'default'}
                      onClick={() => setRadius(preset)}
                    >
                      {preset} 米
                    </Button>
                  ))}
                </Space>
              </Col>
              <Col xs={24} lg={12}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '24px',
                    background: '#f5f5f5',
                    borderRadius: 8,
                    minHeight: 200,
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: Math.min(240, Math.max(60, (radius / 5000) * 240 + 20)),
                      height: Math.min(240, Math.max(60, (radius / 5000) * 240 + 20)),
                      borderRadius: '50%',
                      background: 'rgba(24, 144, 255, 0.1)',
                      border: '2px dashed #1890ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: '#1890ff',
                        boxShadow: '0 0 0 6px rgba(24, 144, 255, 0.2)',
                      }}
                    />
                    <Text
                      style={{
                        position: 'absolute',
                        bottom: -28,
                        color: '#1890ff',
                        fontWeight: 500,
                      }}
                    >
                      {radius} 米
                    </Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          <Card
            loading={loading}
            title={
              <Space>
                <CheckSquareOutlined style={{ color: '#1890ff' }} />
                <span>打卡要求</span>
              </Space>
            }
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: 24 } }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Checkbox
                checked={requirePhoto}
                onChange={(e) => setRequirePhoto(e.target.checked)}
              >
                <Text strong>外勤打卡是否需要上传照片</Text>
                <br />
                <Text type="secondary">打卡时要求员工拍摄现场照片作为凭证</Text>
              </Checkbox>

              <Divider style={{ margin: '8px 0' }} />

              <Checkbox
                checked={requireRemark}
                onChange={(e) => setRequireRemark(e.target.checked)}
              >
                <Text strong>外勤打卡是否需要填写备注</Text>
                <br />
                <Text type="secondary">打卡时要求员工填写外勤事由或说明</Text>
              </Checkbox>

              <Divider style={{ margin: '8px 0' }} />

              <Checkbox
                checked={requireLocation}
                onChange={(e) => setRequireLocation(e.target.checked)}
              >
                <Text strong>外勤打卡是否需要定位验证</Text>
                <br />
                <Text type="secondary">打卡时验证员工位置是否在有效范围内</Text>
              </Checkbox>
            </Space>
          </Card>

          <Card
            loading={loading || loadingData}
            title={
              <Space>
                <TeamOutlined style={{ color: '#1890ff' }} />
                <span>允许外勤的员工/部门</span>
              </Space>
            }
            style={{ borderRadius: 8 }}
            styles={{ body: { padding: 24 } }}
          >
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              选择允许外勤打卡的员工和部门，未选中的员工将无法使用外勤打卡功能。
            </Paragraph>
            <Transfer
              dataSource={transferDataSource}
              targetKeys={selectedKeys}
              onChange={handleTransferChange}
              render={(item) => (
                <Space>
                  {item.type === 'department' ? (
                    <TeamOutlined style={{ color: '#722ed1' }} />
                  ) : (
                    <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                  )}
                  <span>{item.title}</span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.description}
                  </Text>
                </Space>
              )}
              titles={['待选列表', '已选列表']}
              showSearch
              listStyle={{ width: 320, height: 400 }}
              filterOption={(inputValue, item) =>
                item.title.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0 ||
                (item.description && item.description.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0)
              }
            />
          </Card>

          <div style={{ textAlign: 'center', padding: '16px 0 32px' }}>
            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
              style={{ minWidth: 200 }}
            >
              保存设置
            </Button>
          </div>
        </Space>
      </Form>
    </div>
  );
};

export default OutSettingPage;