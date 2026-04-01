import { useState, useRef, useEffect } from 'react';
import { TUBE_LINES } from '@/lib/tube-colors';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface RouteColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  triggerClassName?: string;
}

export function RouteColorPicker({ currentColor, onColorChange, triggerClassName }: RouteColorPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={cn(
          "w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-transparent hover:ring-muted-foreground/30 transition-all cursor-pointer",
          triggerClassName
        )}
        style={{ backgroundColor: currentColor }}
        title="Change line color"
      />
      {open && (
        <div className="absolute z-50 top-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-elevated p-2 grid grid-cols-5 gap-1.5 min-w-[140px]"
          onClick={e => e.stopPropagation()}>
          {TUBE_LINES.map(line => (
            <button
              key={line.hex}
              onClick={() => { onColorChange(line.hex); setOpen(false); }}
              className="w-6 h-6 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
              style={{ backgroundColor: line.hex }}
              title={line.name}
            >
              {currentColor === line.hex && (
                <Check className="h-3 w-3" style={{ color: ['#FFD300', '#F3A9BB', '#A0A5A9', '#95CDBA'].includes(line.hex) ? '#000' : '#fff' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
