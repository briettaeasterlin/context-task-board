import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LogOut, Navigation, Map, CalendarCheck, BarChart3, Smartphone, X, Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import logoSrc from '@/assets/nextmove-logo-dark.svg';

const NAV_ITEMS = [
  { path: '/today', label: 'Today', icon: Navigation, tooltip: 'Do your work' },
  { path: '/plan', label: 'Plan', icon: CalendarCheck, tooltip: 'Set tomorrow' },
  { path: '/routes', label: 'Routes', icon: Map, tooltip: 'See your projects' },
  { path: '/review', label: 'Review', icon: BarChart3, tooltip: 'Reflect & improve' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const { showBanner, install, dismiss, deferredPrompt, isIos } = usePwaInstall();

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
                        </Link>
                      </div>
                    );
                  })}
                </nav>
              </div>
              <div className="flex items-center gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2.5 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-150">
                      <Smartphone className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="font-display">Install NextMove</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm text-muted-foreground">
                      <div>
                        <p className="font-semibold text-foreground mb-1">iPhone / iPad (Safari)</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Tap the <span className="font-medium text-foreground">Share</span> button (square with arrow)</li>
                          <li>Scroll down and tap <span className="font-medium text-foreground">Add to Home Screen</span></li>
                          <li>Tap <span className="font-medium text-foreground">Add</span></li>
                        </ol>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Android (Chrome)</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Tap the <span className="font-medium text-foreground">⋮ menu</span> (top right)</li>
                          <li>Tap <span className="font-medium text-foreground">Add to Home screen</span></li>
                          <li>Tap <span className="font-medium text-foreground">Install</span></li>
                        </ol>
                      </div>
                      <p className="text-xs">The app will open in standalone mode — no browser chrome, just NextMove.</p>
                    </div>
                  </DialogContent>
                </Dialog>
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
        {showBanner && (
          <div className="bg-primary text-primary-foreground px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={logoSrc} alt="" className="h-8 w-8 rounded-lg shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">Install NextMove</p>
                <p className="text-xs opacity-80 truncate">
                  {isIos ? 'Tap Share → Add to Home Screen' : 'Add to your home screen for quick access'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {deferredPrompt ? (
                <Button size="sm" variant="secondary" onClick={install} className="h-11 min-w-[44px] rounded-lg text-xs font-semibold">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Install
                </Button>
              ) : isIos ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-11 min-w-[44px] rounded-lg text-xs font-semibold"
                  onClick={() => {
                    // Guide users - the share menu is a system action
                    alert('Tap the Share button (square with arrow) at the bottom of Safari, then tap "Add to Home Screen".');
                  }}
                >
                  <Share className="h-3.5 w-3.5 mr-1.5" />
                  Share → Add
                </Button>
              ) : null}
              <button onClick={dismiss} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <main className="px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
