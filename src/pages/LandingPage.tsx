import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowDown, Check, X, Circle, GitBranch, Sparkles, Terminal } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: 'easeOut' },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-1.5 font-display text-lg font-bold tracking-tight">
            <span className="text-accent">▸</span>
            <span>NextMove</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm">Log in</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="text-sm rounded-xl">Plot your route</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 1. HERO ── */}
      <section className="container max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <motion.h1
          className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]"
          initial="hidden" animate="visible" variants={fadeUp} custom={0}
        >
          Always know the next move.
        </motion.h1>
        <motion.p
          className="text-lg sm:text-xl text-muted-foreground mt-5 max-w-2xl mx-auto leading-relaxed"
          initial="hidden" animate="visible" variants={fadeUp} custom={1}
        >
          NextMove is a calm execution system that organizes your projects and helps you decide what to work on next. It works alongside the AI tools you already use — or directly inside the app.
        </motion.p>

        {/* Route map visual */}
        <motion.div
          className="mt-12 flex flex-col items-center justify-center gap-0 max-w-xs mx-auto"
          initial="hidden" animate="visible" variants={fadeUp} custom={2}
        >
          <Card className="p-5 rounded-2xl shadow-card w-full text-left">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Today's Route</p>
            <div className="relative ml-2">
              <div className="absolute left-[3px] top-1 bottom-1 w-px bg-mint" />
              <div className="space-y-3">
                {[
                  { label: 'Draft GTM strategy', done: true },
                  { label: 'Review API documentation', done: true },
                  { label: 'Prepare launch presentation', current: true },
                  { label: 'Customer onboarding review', upcoming: true },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 relative">
                    <span className={`relative z-10 w-[7px] h-[7px] rounded-full border-2 flex-shrink-0 ${
                      item.done ? 'border-muted-foreground/30 bg-muted-foreground/30' :
                      item.current ? 'border-accent bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.4)]' :
                      'border-primary/40 bg-background'
                    }`} />
                    <span className={`text-sm ${
                      item.done ? 'text-muted-foreground line-through' :
                      item.current ? 'font-medium text-foreground' :
                      'text-muted-foreground'
                    }`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          className="flex items-center justify-center gap-4 mt-10"
          initial="hidden" animate="visible" variants={fadeUp} custom={3}
        >
          <Link to="/auth?mode=signup">
            <Button size="lg" className="text-base px-8 h-12 rounded-2xl font-display font-semibold">
              Plot your route <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#how">
            <Button variant="outline" size="lg" className="text-base px-8 h-12 rounded-2xl font-display">
              See how it works
            </Button>
          </a>
        </motion.div>
      </section>

      {/* ── 2. PROBLEM ── */}
      <section className="border-t bg-muted/30">
        <div className="container max-w-3xl mx-auto px-6 py-20 text-center">
          <motion.h2
            className="font-display text-3xl sm:text-4xl font-bold mb-6"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          >
            Execution becomes unclear when everything is active.
          </motion.h2>
          <motion.div
            className="text-muted-foreground text-base sm:text-lg leading-relaxed space-y-3 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
          >
            <p>High-performing operators often have dozens of projects, tasks, and ideas in motion.</p>
            <p>Traditional task managers show everything at once.</p>
            <p className="text-foreground font-medium">NextMove focuses only on what matters right now.</p>
          </motion.div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ── */}
      <section id="how" className="container max-w-5xl mx-auto px-6 py-20">
        <motion.h2
          className="font-display text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          How it works
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: '01', title: 'Organize your work', icon: Circle, desc: 'Capture tasks, projects, and ideas. Everything goes into the system.' },
            { step: '02', title: 'Plot the route', icon: GitBranch, desc: 'NextMove surfaces the small set of actions that matter today. Everything else stays out of the way.' },
            { step: '03', title: 'Move forward', icon: ArrowRight, desc: 'Clear tasks, advance projects, and review progress. Tomorrow\'s route becomes clear automatically.' },
          ].map((card, i) => (
            <motion.div key={card.step} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <Card className="p-8 rounded-2xl shadow-card hover:shadow-elevated transition-shadow h-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-accent/40 text-accent">
                    <card.icon className="h-3 w-3" />
                  </span>
                  <span className="text-xs font-mono text-accent font-bold">{card.step}</span>
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{card.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{card.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 4. AI-NATIVE WORKFLOW ── */}
      <section className="border-t bg-muted/30">
        <div className="container max-w-3xl mx-auto px-6 py-20">
          <motion.h2
            className="font-display text-3xl sm:text-4xl font-bold text-center mb-4"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          >
            Works with the AI tools you already use.
          </motion.h2>
          <motion.p
            className="text-muted-foreground text-base text-center mb-10 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
          >
            You can interact with NextMove through ChatGPT, Claude, or the NextMove interface.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            <Card className="max-w-md mx-auto rounded-2xl shadow-elevated p-5 space-y-3 font-mono text-sm">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                <Terminal className="h-3.5 w-3.5" />
                <span>Commands</span>
              </div>
              {[
                '"Add these three tasks to the product launch project."',
                '"Combine these two initiatives."',
                '"Move the landing page rewrite to next week."',
                '"Plan tomorrow\'s route."',
              ].map((cmd, i) => (
                <div key={i} className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                  {cmd}
                </div>
              ))}
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── 5. CALM INTERFACE ── */}
      <section className="container max-w-4xl mx-auto px-6 py-20">
        <motion.h2
          className="font-display text-3xl sm:text-4xl font-bold text-center mb-6"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          Designed for focus.
        </motion.h2>
        <motion.p
          className="text-muted-foreground text-base sm:text-lg text-center max-w-lg mx-auto mb-12"
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
        >
          NextMove intentionally hides most tasks. Only the small number of actions that matter right now are visible. The result is a calmer workspace that makes it easier to move forward.
        </motion.p>
        <motion.div
          className="grid grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden shadow-card"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        >
          <div className="bg-muted p-4 font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typical apps</div>
          <div className="bg-muted p-4 font-display text-xs font-semibold text-primary uppercase tracking-wider">NextMove</div>
          {[
            ['Endless task lists', 'Focused daily route'],
            ['Constant manual planning', 'Automatic prioritization'],
            ['Scattered work', 'Project momentum'],
            ['Calendar chaos', 'Calm execution'],
          ].map(([old, next]) => (
            <>
              <div key={old} className="bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
                <X className="h-3.5 w-3.5 text-destructive/60 shrink-0" />{old}
              </div>
              <div key={next} className="bg-card p-4 text-sm font-medium flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />{next}
              </div>
            </>
          ))}
        </motion.div>
      </section>

      {/* ── 6. EMOTIONAL OUTCOME ── */}
      <section className="border-t bg-muted/30">
        <div className="container max-w-3xl mx-auto px-6 py-20 text-center">
          <motion.h2
            className="font-display text-3xl sm:text-4xl font-bold mb-8"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          >
            Feel in control of your work again.
          </motion.h2>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto text-left"
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger}
          >
            {[
              'Stop worrying about what to do next',
              'Make meaningful progress every day',
              'Keep projects moving forward',
              'Spend less time planning',
            ].map((b, i) => (
              <motion.div key={b} className="flex items-start gap-2.5 text-sm" variants={fadeUp} custom={i}>
                <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span>{b}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── 7. FINAL CTA ── */}
      <section className="container max-w-5xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Plot your next move.
          </h2>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="text-base px-10 h-12 rounded-2xl font-display font-semibold">
              Start your route <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-5 max-w-xs mx-auto">
            Set up your projects once.<br />NextMove handles the rest.
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container max-w-5xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-display font-semibold">▸ NextMove</span>
          <span>Always know the next move.</span>
        </div>
      </footer>
    </div>
  );
}
