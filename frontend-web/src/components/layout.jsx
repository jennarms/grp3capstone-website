import { Navbar } from '../components/navBar';

export function Layout({ children }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-blue-500 to-green-300">
        <Navbar />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 bg-white">
        {children}
      </main>
    </div>
  );
}