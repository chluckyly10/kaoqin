import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Breadcrumb, Button, Modal, message, Space } from 'antd';
import {
  DashboardOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  FormOutlined,
  BarChartOutlined,
  EnvironmentOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useHistory, useLocation } from 'umi';
import { request } from '@/services/request';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import { getIsInQiankun } from '@/qiankunStatus';
import { getWsUrl } from '@/utils/apiBase';

const { Header, Sider, Content } = Layout;

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
}

const menuItems: MenuItem[] = [
  { key: '/record', icon: <DashboardOutlined />, label: '打卡流水', path: '/record' },
  { key: '/rule', icon: <FileTextOutlined />, label: '考勤规则', path: '/rule' },
  { key: '/schedule', icon: <ScheduleOutlined />, label: '排班管理', path: '/schedule' },
  { key: '/exception', icon: <FormOutlined />, label: '异常申诉', path: '/exception' },
  { key: '/statistics', icon: <BarChartOutlined />, label: '统计报表', path: '/statistics' },
  { key: '/out-setting', icon: <EnvironmentOutlined />, label: '外勤设置', path: '/out-setting' },
];

const LayoutPage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const history = useHistory();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [isInQiankun, setIsInQiankun] = useState(getIsInQiankun());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let detected = getIsInQiankun();
    if (!detected && typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/attendance')) {
        detected = true;
      }
    }
    setIsInQiankun(detected);
  }, []);

  // 全局样式：去除默认 body/html margin，防止 body margin 撑开 document 产生滚动条
  useEffect(() => {
    const prevBodyCssText = document.body.style.cssText;
    const prevHtmlCssText = document.documentElement.style.cssText;
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100%';
    document.documentElement.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    // 防止 #root 没有占满
    const ensureRoot = () => {
      const root = document.getElementById('root');
      if (root) {
        root.style.height = '100%';
        root.style.minHeight = '0';
      }
    };
    ensureRoot();
    const t = setTimeout(ensureRoot, 0);
    return () => {
      document.body.style.cssText = prevBodyCssText;
      document.documentElement.style.cssText = prevHtmlCssText;
      clearTimeout(t);
    };
  }, []);

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await request.get('/auth/profile');
      setUserInfo(res.data);
    } catch (error) {
      console.error('Fetch user info error:', error);
    }
  }, []);

  const initWebSocket = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = getWsUrl(`/ws?token=${token}`);

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
          console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === 'new_attendance_record') {
              setNewMessageCount((prev) => prev + 1);
              message.success('收到新的打卡记录');
            }
          } catch (e) {
            console.error('Parse WebSocket message error:', e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          console.log('WebSocket disconnected, reconnecting...');
          reconnectTimerRef.current = setTimeout(connect, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          ws.close();
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('WebSocket connection failed:', error);
        reconnectTimerRef.current = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    fetchUserInfo();
    const cleanup = initWebSocket();

    return () => {
      cleanup?.();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [fetchUserInfo, initWebSocket]);

  const handleLogout = () => {
    Modal.confirm({
      title: '确认退出登录',
      content: '您确定要退出登录吗？',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        localStorage.removeItem('token');
        wsRef.current?.close();
        history.push('/login');
      },
    });
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    history.push(key);
  };

  const breadcrumbItems = () => {
    const currentItem = menuItems.find((item) => item.key === location.pathname);
    return [
      { title: '首页' },
      ...(currentItem ? [{ title: currentItem.label }] : []),
    ];
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      disabled: true,
    },
    {
      key: 'password',
      icon: <SafetyOutlined />,
      label: '修改密码',
      onClick: () => setPasswordModalVisible(true),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  if (isInQiankun) {
    return (
      <div style={{ padding: 0, background: '#f0f2f5', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
        <ChangePasswordModal
          open={passwordModalVisible}
          onClose={() => setPasswordModalVisible(false)}
        />
      </div>
    );
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        style={{
          background: '#001529',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.05)',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 16 : 18,
            fontWeight: 'bold',
            borderBottom: '1px solid #002140',
          }}
        >
          {collapsed ? '考勤' : '考勤管理系统'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={handleMenuClick}
          items={menuItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
          }))}
        />
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            height: 64,
            minHeight: 64,
            lineHeight: '64px',
          }}
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 48, height: 48 }}
            />
            <Breadcrumb items={breadcrumbItems()} />
          </Space>
          <Space size="large">
            <Badge
              count={newMessageCount}
              size="small"
              offset={[-2, 2]}
            >
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 18 }} />}
                onClick={() => setNewMessageCount(0)}
              />
            </Badge>
            {wsConnected && (
              <span style={{ fontSize: 12, color: '#52c41a' }}>● 实时连接</span>
            )}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  style={{ backgroundColor: '#1890ff' }}
                  icon={<UserOutlined />}
                />
                <span>{userInfo?.real_name || userInfo?.username || '用户'}</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: 12,
            padding: 0,
            background: 'transparent',
            borderRadius: 8,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 0,
              borderRadius: 8,
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {children}
            </div>
          </div>
        </Content>
      </Layout>
      <ChangePasswordModal
        open={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
      />
    </Layout>
  );
};

export default LayoutPage;