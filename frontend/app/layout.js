import '../styles/globals.css';
import { AuthProvider } from '../lib/auth';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'TELCO Asset Management',
  description: 'Enterprise Telco Server Asset Management System',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: 'any' },
      { url: '/favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: '#FFFFFF', color: '#1E293B', border: '1px solid #ADBAC8', borderRadius: '12px' },
              success: { iconTheme: { primary: '#16A34A', secondary: '#FFFFFF' } },
              error: { iconTheme: { primary: '#DC2626', secondary: '#FFFFFF' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
