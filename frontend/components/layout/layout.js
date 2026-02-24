import TopBar from '../../../components/layout/TopBar';
import Sidebar from '../../../components/layout/Sidebar';

export default function DashboardLayout({ children }) {
  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}