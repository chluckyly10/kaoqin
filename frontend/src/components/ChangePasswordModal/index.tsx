import React, { useState } from 'react';
import { Modal, Form, Input, Button, message, Progress } from 'antd';
import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { request } from '@/services/request';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

let cryptoKey: CryptoKey | null = null;

const str2ab = (str: string): ArrayBuffer => {
  const buffer = new ArrayBuffer(str.length);
  const bufferView = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) {
    bufferView[i] = str.charCodeAt(i);
  }
  return buffer;
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const binaryString = window.atob(base64);
  return str2ab(binaryString);
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const encryptPassword = async (password: string): Promise<string> => {
  if (!cryptoKey) {
    const res = await request.get('/auth/public-key');
    const publicKey = res.data.publicKey;
    const binaryDerString = publicKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    const binaryDer = base64ToArrayBuffer(binaryDerString);
    cryptoKey = await window.crypto.subtle.importKey(
      'spki',
      binaryDer,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['encrypt']
    );
  }
  const encoded = new TextEncoder().encode(password);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    cryptoKey,
    encoded
  );
  return arrayBufferToBase64(encrypted);
};

const getPasswordStrength = (password: string): { level: number; text: string; color: string } => {
  if (!password) return { level: 0, text: '', color: '' };
  
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  if (score <= 2) return { level: 1, text: '弱', color: '#ff4d4f' };
  if (score <= 3) return { level: 2, text: '中', color: '#faad14' };
  return { level: 3, text: '强', color: '#52c41a' };
};

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ level: 0, text: '', color: '' });

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPasswordStrength(getPasswordStrength(value));
  };

  const handleSubmit = async (values: { oldPassword: string; newPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致');
      return;
    }

    if (passwordStrength.level < 2) {
      message.warning('密码强度过低，请设置更复杂的密码');
      return;
    }

    setLoading(true);
    try {
      const encryptedOldPassword = await encryptPassword(values.oldPassword);
      const encryptedNewPassword = await encryptPassword(values.newPassword);

      await request.post('/auth/change-password', {
        oldPassword: encryptedOldPassword,
        newPassword: encryptedNewPassword,
      });

      message.success('密码修改成功，请重新登录');
      form.resetFields();
      onClose();

      setTimeout(() => {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }, 1500);
    } catch (error: any) {
      message.error(error?.message || '密码修改失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setPasswordStrength({ level: 0, text: '', color: '' });
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafetyOutlined style={{ color: '#1890ff' }} />
          <span>修改密码</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
      width={480}
    >
      <Form
        form={form}
        onFinish={handleSubmit}
        layout="vertical"
        style={{ padding: '16px 0' }}
      >
        <Form.Item
          name="oldPassword"
          label="旧密码"
          rules={[
            { required: true, message: '请输入旧密码' },
            { min: 6, message: '密码至少6位' },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="请输入当前密码"
          />
        </Form.Item>

        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少8位' },
          ]}
          extra={
            passwordStrength.text && (
              <Progress
                percent={passwordStrength.level * 33}
                strokeColor={passwordStrength.color}
                showInfo={false}
                size="small"
                format={() => `强度：${passwordStrength.text}`}
              />
            )
          }
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="请输入新密码"
            onChange={handlePasswordChange}
          />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: '请确认新密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
            placeholder="请再次输入新密码"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            style={{ height: 44 }}
          >
            确认修改
          </Button>
        </Form.Item>

        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: '#999' }}>
          密码修改成功后将自动退出登录
        </div>
      </Form>
    </Modal>
  );
};

export default ChangePasswordModal;