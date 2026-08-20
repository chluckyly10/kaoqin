import { defineConfig } from '@umijs/max';

export default defineConfig({
  base: '/',
  routes: [
    {
      path: '/login',
      component: '@/pages/login/index',
      layout: false,
    },
    {
      path: '/',
      component: '@/layouts/index',
      routes: [
        {
          path: '/',
          redirect: '/record',
        },
        {
          path: '/record',
          component: '@/pages/attendanceRecord/index',
          name: '打卡流水',
        },
        {
          path: '/schedule',
          component: '@/pages/schedule/index',
          name: '排班管理',
        },
        {
          path: '/rule',
          component: '@/pages/rule/index',
          name: '考勤规则',
        },
        {
          path: '/exception',
          component: '@/pages/exceptionAudit/index',
          name: '异常申诉',
        },
        {
          path: '/statistics',
          component: '@/pages/statistics/index',
          name: '统计报表',
        },
        {
          path: '/out-setting',
          component: '@/pages/outSetting/index',
          name: '外勤设置',
        },
      ],
    },
  ],
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
    '/uploads': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
    '/exports': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
  mfsu: false,
});
