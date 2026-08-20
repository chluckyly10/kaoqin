import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, Button, message, Space, Row, Col, Card } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { request } from '@/services/request';

const { TextArea } = Input;
const { Option } = Select;

interface SignRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  record?: any;
  mode?: 'create' | 'edit';
}

const signTypeMap: Record<number, string> = { 1: '签到', 2: '签退' };
const signSourceMap: Record<number, string> = {
  1: '后台手动录入',
  2: 'H5移动端',
  3: '人脸设备',
  4: '外勤打卡',
};

const statusMap: Record<number, string> = {
  0: '正常',
  1: '迟到',
  2: '早退',
  3: '缺卡',
  4: '外勤打卡',
};

const SignRecordModal: React.FC<SignRecordModalProps> = ({
  open,
  onClose,
  onSuccess,
  record,
  mode = 'create',
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  const fetchEmployees = async () => {
    try {
      const res = await request.get('/employee/page', { params: { page: 1, size: 1000 } });
      setEmployees(res.data.list || []);
    } catch (error) {
      console.error('获取员工列表失败:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmployees();
      if (mode === 'edit' && record) {
        form.setFieldsValue({
          employee_id: record.employee_id,
          sign_type: record.sign_type,
          sign_time: dayjs(record.sign_time),
          sign_source: record.sign_source || 1,
          address: record.address,
          status: record.status,
          remark: record.remark,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          sign_type: 1,
          sign_time: dayjs(),
          sign_source: 1,
          status: 0,
        });
      }
    }
  }, [open, mode, record, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const data = {
        employee_id: values.employee_id,
        sign_type: values.sign_type,
        sign_time: values.sign_time.format('YYYY-MM-DD HH:mm:ss'),
        sign_source: values.sign_source,
        address: values.address,
        longitude: values.longitude,
        latitude: values.latitude,
        status: values.status,
        remark: values.remark,
      };

      if (mode === 'create') {
        await request.post('/attendance/sign', data);
        message.success('打卡记录创建成功');
      } else {
        await request.put(`/attendance/record/${record.id}`, data);
        message.success('打卡记录更新成功');
      }

      onSuccess?.();
      handleClose();
    } catch (error: any) {
      message.error(error?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={mode === 'create' ? '新增打卡记录' : '编辑打卡记录'}
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={600}
    >
      <Form
        form={form}
        onFinish={handleSubmit}
        layout="vertical"
        requiredMark
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="employee_id"
              label="员工"
              rules={[{ required: true, message: '请选择员工' }]}
            >
              <Select
                showSearch
                placeholder="选择员工"
                optionFilterProp="children"
              >
                {employees.map((emp: any) => (
                  <Option key={emp.id} value={emp.id}>
                    {emp.real_name} ({emp.username})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="sign_type"
              label="打卡类型"
              rules={[{ required: true, message: '请选择打卡类型' }]}
            >
              <Select>
                <Option value={1}>签到</Option>
                <Option value={2}>签退</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="sign_time"
              label="打卡时间"
              rules={[{ required: true, message: '请选择打卡时间' }]}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                style={{ width: '100%' }}
                placeholder="选择打卡时间"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="sign_source"
              label="打卡来源"
              rules={[{ required: true, message: '请选择打卡来源' }]}
            >
              <Select>
                {Object.entries(signSourceMap).map(([key, value]) => (
                  <Option key={key} value={parseInt(key)}>{value}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="status"
              label="打卡状态"
              rules={[{ required: true, message: '请选择打卡状态' }]}
            >
              <Select>
                {Object.entries(statusMap).map(([key, value]) => (
                  <Option key={key} value={parseInt(key)}>{value}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="address"
              label="打卡地址"
            >
              <Input placeholder="请输入打卡地址" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="longitude"
              label="经度"
            >
              <Input placeholder="经度（可选）" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="latitude"
              label="纬度"
            >
              <Input placeholder="纬度（可选）" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="remark"
          label="备注"
        >
          <TextArea rows={3} placeholder="请输入备注（可选）" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={handleClose}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              {mode === 'create' ? '创建' : '保存'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SignRecordModal;
