import { useAuth } from '@/hooks/useAuth';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LogOut, Crosshair, FolderKanban, CalendarRange, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoSrc from '@/assets/nextmove-logo-dark.svg';

const NAV_ITEMS = [
  { path: '/today', label: 'Today', icon: Crosshair },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/plan', label: 'Calendar', icon: CalendarRange },
  { path: '/review', label: 'Review', icon: RotateCcw },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link to="/today" className="flex items-center gap-2.5 font-display text-sm font-bold tracking-tight hover:opacity-80 transition-opacity">
                <img src={logoSrc} alt="NextMove" className="h-7 w-7" />
                <span>NextMove</span>
              </Link>
              <nav className="flex items-center gap-1">
                {NAV_ITEMS.map(item => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        'relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-200',
                        isActive
                          ? 'bg-[hsl(var(--mint))] text-primary shadow-inset'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', isActive && 'stroke-[2.5]')} />
                      {item.label}
                      {isActive && (
                        <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground hidden sm:inline font-mono">
                {user?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} className="h-8 px-2.5 rounded-lg text-muted-foreground hover:text-foreground">
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
