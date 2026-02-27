import { useAuth } from '@/hooks/useAuth';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LogOut, Sun, Layers, Columns3, Clock, CheckCircle2, Inbox, LayoutDashboard, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { path: '/', label: 'Today', icon: Sun, emoji: '☀️' },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, emoji: '📋' },
  { path: '/projects', label: 'Projects', icon: Layers, emoji: '📁' },
  { path: '/kanban', label: 'Kanban', icon: Columns3, emoji: '🗂️' },
  { path: '/waiting', label: 'Waiting', icon: Clock, emoji: '⏳' },
  { path: '/done', label: 'Done', icon: CheckCircle2, emoji: '✅' },
  { path: '/inbox', label: 'Inbox', icon: Inbox, emoji: '📥' },
  { path: '/planner', label: 'Planner', icon: CalendarDays, emoji: '📅' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-soft">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-1.5 font-sans text-sm font-bold tracking-tight hover:opacity-80 transition-opacity">
                <span className="text-base">🌿</span>
                <span>Task OS</span>
              </Link>
              <nav className="flex items-center gap-0.5">
                {NAV_ITEMS.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200',
                        isActive
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <span className="text-sm">{item.emoji}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {user?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="h-8 px-2.5 rounded-lg">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="container max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}