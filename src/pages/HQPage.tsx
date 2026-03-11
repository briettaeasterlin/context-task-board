import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '@/hooks/useTasks';
import { useProjects } from '@/hooks/useProjects';
import type { Task, TaskUpdate } from '@/types/task';
import { TaskDetailDrawer } from '@/components/task/TaskDetailDrawer';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Zap, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useMilestones } from '@/hooks/useProjects';

function getGreeting(): { text: string; emoji: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
  return { text: 'Good evening', emoji: '🌙' };
}

export default function HQPage() {
  const navigate = useNavigate();
  const { tasks, isLoading, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const { milestones } = useMilestones();
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const greeting = getGreeting();

  const focusTasks = useMemo(() =>
    tasks.filter(t => t.status === 'Next').sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, 6),
  [tasks]);

  const recentlyDone = useMemo(() =>
    tasks.filter(t => t.status === 'Done')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5),
  [tasks]);

  const activeProjects = useMemo(() =>
    projects.slice(0, 6),
  [projects]);

  const handleMarkDone = useCallback((id: string) => {
    updateTask.mutate({ id, status: 'Done' }, {
      onSuccess: () => toast.success('Task complete. Momentum builds momentum.'),
    });
  }, [updateTask]);

  const handleUpdate = useCallback((id: string, updates: TaskUpdate) => { updateTask.mutate({ id, ...updates }); }, [updateTask]);
  const handleDelete = useCallback((id: string) => { deleteTask.mutate(id); }, [deleteTask]);

  const stats = useMemo(() => ({
    focus: tasks.filter(t => t.status === 'Next').length,
    waiting: tasks.filter(t => t.status === 'Waiting').length,
    backlog: tasks.filter(t => t.status === 'Backlog').length,
    doneThisWeek: tasks.filter(t => t.status === 'Done' && differenceInDays(new Date(), new Date(t.updated_at)) <= 7).length,
  }), [tasks]);

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Greeting */}
        <div className="pt-2">
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <span>{greeting.emoji}</span>
            {greeting.text}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {format(new Date(), 'EEEE, MMMM d')} · {stats.focus} tasks in focus
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'In Focus', value: stats.focus, color: 'text-accent' },
            { label: 'Completed (7d)', value: stats.doneThisWeek, color: 'text-success' },
            { label: 'Waiting', value: stats.waiting, color: 'text-status-waiting' },
            { label: 'Backlog', value: stats.backlog, color: 'text-muted-foreground' },
          ].map(stat => (
            <Card key={stat.label} className="p-5 rounded-2xl shadow-card text-center">
              <div className={cn("text-3xl font-display font-bold", stat.color)}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1.5">{stat.label}</div>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/review')} className="rounded-xl font-display" size="sm">
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Run HQ Review
          </Button>
          <Button variant="outline" onClick={() => navigate('/plan')} className="rounded-xl font-display" size="sm">
            🗓️ Plan My Week
          </Button>
          <Button variant="outline" onClick={() => navigate('/today')} className="rounded-xl font-display" size="sm">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Suggest Next Tasks
          </Button>
        </div>

        {/* Focus Tasks */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              🎯 Focus Tasks
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/today')} className="text-xs text-muted-foreground">
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : focusTasks.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl shadow-card">
              <p className="text-muted-foreground mb-2">No tasks in focus yet.</p>
              <p className="text-sm text-muted-foreground">Add your first task and start building momentum.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {focusTasks.map(task => (
                <Card key={task.id}
                  className="p-4 rounded-2xl shadow-card flex items-center gap-3 cursor-pointer hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200 group"
                  onClick={() => setDetailTask(task)}
                >
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                    onClick={e => { e.stopPropagation(); handleMarkDone(task.id); }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium flex-1">{task.title}</span>
                  {task.project_id && (
                    <span className="text-xs text-accent">
                      {projects.find(p => p.id === task.project_id)?.name}
                    </span>
                  )}
                  {task.due_date && (
                    <Badge variant="outline" className="text-[10px] rounded-full">{format(new Date(task.due_date), 'MMM d')}</Badge>
                  )}
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Active Projects */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2">
              📁 Active Projects
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="text-xs text-muted-foreground">
              View all <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          {activeProjects.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl shadow-card">
              <p className="text-muted-foreground mb-2">No projects yet.</p>
              <p className="text-sm text-muted-foreground">Create a project to organize your work.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeProjects.map(project => {
                const projectTasks = tasks.filter(t => t.project_id === project.id);
                const done = projectTasks.filter(t => t.status === 'Done').length;
                const total = projectTasks.length;
                return (
                  <Card key={project.id}
                    className="p-5 rounded-2xl shadow-card cursor-pointer hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-200"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <h3 className="font-display font-semibold text-sm mb-1">{project.name}</h3>
                    {project.summary && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.summary}</p>}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] rounded-full">{project.area}</Badge>
                      <span className="text-xs text-muted-foreground">{done}/{total} done</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Activity */}
        {recentlyDone.length > 0 && (
          <section>
            <h2 className="font-display text-xl font-semibold flex items-center gap-2 mb-4">
              ✅ Recent Activity
            </h2>
            <div className="space-y-1.5">
              {recentlyDone.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded-xl hover:bg-muted/30 transition-colors">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs shrink-0">{format(new Date(t.updated_at), 'MMM d')}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <TaskDetailDrawer task={detailTask} open={!!detailTask} onClose={() => setDetailTask(null)}
        onUpdate={handleUpdate} onDelete={handleDelete} projects={projects} milestones={milestones} />
    </AppShell>
  );
}
