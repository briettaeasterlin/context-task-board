import { TUBE_LINES } from '@/lib/tube-colors';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

interface Props {
  value: string | null;
  onChange: (color: string) => void;
}

export function LineColorPicker({ value, onChange }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg text-xs">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: value || TUBE_LINES[0].hex }}
          />
          <span>Line colour</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3" align="start">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Choose line colour
        </p>
        <div className="grid grid-cols-4 gap-2">
          {TUBE_LINES.map(line => {
            const isSelected = value === line.hex;
            return (
              <button
                key={line.hex}
                className={cn(
                  "relative w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                  "hover:scale-110 hover:shadow-md",
                  isSelected && "ring-2 ring-offset-2 ring-foreground/20"
                )}
                style={{ backgroundColor: line.hex }}
                onClick={() => onChange(line.hex)}
                title={line.name}
              >
                {isSelected && <Check className="h-4 w-4 text-white drop-shadow-md" />}
              </button>
            );
          })}
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground text-center">
          {TUBE_LINES.find(l => l.hex === value)?.name ?? 'Select a line'} Line
        </div>
      </PopoverContent>
    </Popover>
  );
}
