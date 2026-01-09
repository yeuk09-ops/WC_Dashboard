import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'F&F 운전자본 대시보드',
  description: 'F&F 그룹 연결 운전자본 분석 대시보드',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-3 hover:opacity-80 transition">
                <span className="text-2xl font-bold text-slate-800">F&F</span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-600 font-medium">운전자본 대시보드</span>
              </a>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-500">25.3Q 기준</div>
              <a
                href="/admin"
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition"
              >
                관리자
              </a>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-200 mt-12 py-6 text-center text-sm text-slate-500">
          © 2025 F&F 회계팀.
        </footer>
      </body>
    </html>
  );
}
