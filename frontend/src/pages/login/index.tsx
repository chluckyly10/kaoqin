import React, { useState, useEffect, useCallback } from 'react';
import { Form, Input, Button, Card, message, Checkbox, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { history } from 'umi';
import { request } from '@/services/request';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [rememberMe, setRememberMe] = useState(false);
  const [loginFailedCount, setLoginFailedCount] = useState(0);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const savedUsername = localStorage.getItem('remembered_username');
    if (savedUsername) {
      form.setFieldsValue({ username: savedUsername });
      setRememberMe(true);
    }

    const token = localStorage.getItem('token');
    if (token) {
      const lastPage = sessionStorage.getItem('last_page') || '/';
      message.info('您已登录，正在跳转...');
      history.push(lastPage);
      return;
    }
  }, [form]);

  const handleSubmit = useCallback(async (values: { username: string; password: string }) => {
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await request.post('/auth/login', {
        username: values.username,
        password: values.password,
      });

      const { token, user } = res.data;
      localStorage.setItem('token', token);

      if (rememberMe) {
        localStorage.setItem('remembered_username', values.username);
      } else {
        localStorage.removeItem('remembered_username');
      }

      message.success(`欢迎回来，${user?.real_name || values.username}`);

      const lastPage = sessionStorage.getItem('last_page') || '/record';
      sessionStorage.removeItem('last_page');
      history.push(lastPage);
    } catch (error: any) {
      setLoginFailedCount((prev) => {
        const newCount = prev + 1;
        if (newCount >= 3) {
          setShowCaptcha(true);
        }
        return newCount;
      });

      if (error?.message?.includes('账号不存在')) {
        setErrorMsg('账号不存在，请检查后重试');
      } else if (error?.message?.includes('密码错误')) {
        setErrorMsg('密码错误，您已失败 ' + (loginFailedCount + 1) + ' 次');
      } else {
        setErrorMsg(error?.message || '登录失败，请检查账号密码');
      }
    } finally {
      setLoading(false);
    }
  }, [rememberMe, loginFailedCount]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <Card
        style={{
          width: 420,
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
          borderRadius: 12,
        }}
        title={
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <SafetyOutlined style={{ fontSize: 36, color: '#1890ff' }} />
            <div style={{ fontSize: 22, fontWeight: 'bold', marginTop: 8 }}>
              考勤管理系统
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              Attendance Management System
            </div>
          </div>
        }
      >
        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: '请输入账号' },
              { min: 3, max: 30, message: '账号长度为3-30位' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入账号"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入密码"
              autoComplete="current-password"
              iconRender={(visible) => visible ? <EyeInvisibleOutlined /> : <LockOutlined />}
            />
          </Form.Item>

          {showCaptcha && (
            <Form.Item
              name="captcha"
              rules={[{ required: true, message: '请输入验证码' }]}
              extra="验证码功能预留扩展位"
            >
              <Input
                placeholder="请输入验证码"
                prefix={<SafetyOutlined />}
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 16 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              >
                记住账号
              </Checkbox>
              {loginFailedCount > 0 && (
                <span style={{ color: '#faad14', fontSize: 12 }}>
                  已失败 {loginFailedCount} 次
                </span>
              )}
            </Space>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44, fontSize: 16, borderRadius: 6 }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', color: '#999', marginTop: 8, fontSize: 12 }}>
          <div>默认账号：admin / admin123</div>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;
