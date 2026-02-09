import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AREAS, type TaskArea, type Project } from '@/types/task';
import { Search } from 'lucide-react';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  areaFilter: TaskArea | 'all';
  onAreaChange: (v: TaskArea | 'all') => void;
  projectFilter: string;
  onProjectChange: (v: string) => void;
  projects: Project[];
}

export function FilterBar({ search, onSearchChange, areaFilter, onAreaChange, projectFilter, onProjectChange, projects }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Search tasks..." className="pl-8 h-8 text-sm" />
      </div>
      <Select value={areaFilter} onValueChange={v => onAreaChange(v as TaskArea | 'all')}>
        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="All Areas" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Areas</SelectItem>
          {AREAS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={projectFilter || 'all'} onValueChange={v => onProjectChange(v === 'all' ? '' : v)}>
        <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="All Projects" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Projects</SelectItem>
          {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
