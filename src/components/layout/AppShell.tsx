import { useAuth } from '@/hooks/useAuth';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LogOut, Sun, Layers, Columns3, Clock, CheckCircle2, Inbox, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { path: '/', label: 'Today', icon: Sun },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/projects', label: 'Projects', icon: Layers },
  { path: '/kanban', label: 'Kanban', icon: Columns3 },
  { path: '/waiting', label: 'Waiting', icon: Clock },
  { path: '/done', label: 'Done', icon: CheckCircle2 },
  { path: '/inbox', label: 'Inbox', icon: Inbox },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-6">
              <Link to="/" className="font-mono text-sm font-bold tracking-tight hover:opacity-80 transition-opacity">Task OS</Link>
              <nav className="flex items-center gap-0.5">
                {NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors',
                        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} className="h-7 px-2">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="container max-w-6xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}
