import { useAuth } from '@/hooks/useAuth';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LogOut, Circle, GitBranch, CalendarRange, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoSrc from '@/assets/nextmove-logo-dark.svg';

const NAV_ITEMS = [
  { path: '/today', label: 'Today', icon: Circle },
  { path: '/projects', label: 'Projects', icon: GitBranch },
  { path: '/plan', label: 'Calendar', icon: CalendarRange },
  { path: '/review', label: 'Review', icon: CheckCircle },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[hsl(160_8%_95%)]">
      {/* Spatial frame — mission control workspace */}
      <div className="max-w-[1280px] mx-auto min-h-screen bg-card rounded-none sm:rounded-2xl sm:my-0 shadow-elevated">
        <header className="border-b border-border/50 sticky top-0 z-10 bg-card/95 backdrop-blur-sm sm:rounded-t-2xl">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-8">
                <Link to="/today" className="flex items-center gap-2.5 font-display text-sm font-bold tracking-tight hover:opacity-80 transition-opacity">
                  <img src={logoSrc} alt="NextMove" className="h-7 w-7" />
                  <span>NextMove</span>
                </Link>

                {/* Wayfinding navigation — transit stop style */}
                <nav className="flex items-center gap-0.5">
                  {NAV_ITEMS.map((item, idx) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                      <div key={item.path} className="flex items-center">
                        {idx > 0 && (
                          <div className="w-4 h-px bg-mint mx-0.5 hidden sm:block" />
                        )}
                        <Link
                          to={item.path}
                          className={cn(
                            'relative flex items-center gap-2 px-3.5 py-1.5 text-sm font-semibold rounded-full transition-all duration-150',
                            isActive
                              ? 'bg-mint text-primary shadow-inset'
                              : 'text-muted-foreground hover:text-foreground hover:translate-x-px hover:bg-secondary'
                          )}
                        >
                          {/* Transit node indicator */}
                          <span className={cn(
                            'flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-150',
                            isActive
                              ? 'border-primary bg-accent'
                              : 'border-muted-foreground/30 bg-transparent'
                          )}>
                            <Icon className={cn(
                              'h-2.5 w-2.5',
                              isActive ? 'text-accent-foreground' : 'text-muted-foreground/50'
                            )} />
                          </span>
                          <span className="hidden sm:inline">{item.label}</span>
                          {isActive && (
                            <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-accent" />
                          )}
                        </Link>
                      </div>
                    );
                  })}
                </nav>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground hidden sm:inline font-mono tracking-tight">
                  {user?.email}
                </span>
                <Button variant="ghost" size="sm" onClick={signOut} className="h-8 px-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:translate-x-px transition-all duration-150">
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </header>
        <main className="px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
