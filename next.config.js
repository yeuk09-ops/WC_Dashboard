/** @type {import('next').NextConfig} */
const nextConfig = {
  // Snowflake SDK는 Node.js 전용이므로 서버사이드에서만 사용
  experimental: {
    serverComponentsExternalPackages: ['snowflake-sdk'],
  },
  // 환경 변수 접두사
  env: {
    NEXT_PUBLIC_APP_NAME: 'F&F 운전자본 대시보드',
  },
};

module.exports = nextConfig;
