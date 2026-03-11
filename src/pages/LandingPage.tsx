import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowDown, Check, X } from 'lucide-react';

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
              <Button size="sm" className="text-sm rounded-xl">Get Started</Button>
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
          Always know your next move.
        </motion.h1>
        <motion.p
          className="text-lg sm:text-xl text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed"
          initial="hidden" animate="visible" variants={fadeUp} custom={1}
        >
          NextMove manages your projects and tasks quietly in the background and schedules the work that matters most.
        </motion.p>

        {/* Flow visual */}
        <motion.div
          className="mt-12 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6"
          initial="hidden" animate="visible" variants={fadeUp} custom={2}
        >
          {/* Projects */}
          <Card className="p-5 rounded-2xl shadow-card w-full max-w-[200px] text-left">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Projects</p>
            <div className="space-y-1.5">
              {['Client Insights', 'Career Ladder', 'Real Estate'].map(p => (
                <div key={p} className="text-sm font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  {p}
                </div>
              ))}
            </div>
          </Card>

          <ArrowDown className="h-5 w-5 text-muted-foreground md:hidden" />
          <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />

          {/* NextMove */}
          <Card className="px-5 py-4 rounded-2xl shadow-card border-primary/30 bg-primary/5 w-full max-w-[220px] text-center">
            <p className="text-xs font-display font-semibold text-primary">NextMove analyzes priorities</p>
          </Card>

          <ArrowDown className="h-5 w-5 text-muted-foreground md:hidden" />
          <ArrowRight className="h-5 w-5 text-muted-foreground hidden md:block" />

          {/* Today's Plan */}
          <Card className="p-5 rounded-2xl shadow-card w-full max-w-[260px] text-left">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Today's Plan</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-sm"><span>🐸</span><span className="font-medium">Write KPI pipeline spec</span></div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground"><span>🔧</span><span>Update architecture doc</span></div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground"><span>🔧</span><span>Send Slack update</span></div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          className="flex items-center justify-center gap-4 mt-10"
          initial="hidden" animate="visible" variants={fadeUp} custom={3}
        >
          <Link to="/auth?mode=signup">
            <Button size="lg" className="text-base px-8 h-12 rounded-2xl font-display font-semibold">
              Plan my day <ArrowRight className="ml-2 h-4 w-4" />
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
            Planning work shouldn't be a second job.
          </motion.h2>
          <motion.div
            className="text-muted-foreground text-base sm:text-lg leading-relaxed space-y-3 max-w-lg mx-auto"
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
          >
            <p>Most productivity tools require constant manual organization.</p>
            <p>You end up managing lists instead of making progress.</p>
            <p className="text-foreground font-medium">NextMove quietly manages the system for you.</p>
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
            { step: '01', title: 'Capture', desc: 'Add your projects and tasks once. NextMove keeps track of everything.' },
            { step: '02', title: 'Prioritize', desc: 'NextMove analyzes deadlines, project momentum, and strategic value. The most important work rises to the top.' },
            { step: '03', title: 'Execute', desc: 'NextMove schedules meaningful work directly into your calendar. You always know what to do next.' },
          ].map((card, i) => (
            <motion.div key={card.step} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}>
              <Card className="p-8 rounded-2xl shadow-card hover:shadow-elevated transition-shadow h-full">
                <span className="text-xs font-mono text-accent font-bold">{card.step}</span>
                <h3 className="font-display text-xl font-semibold mt-2 mb-3">{card.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{card.desc}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── 4. MAGIC MOMENT ── */}
      <section className="border-t bg-muted/30">
        <div className="container max-w-3xl mx-auto px-6 py-20">
          <motion.h2
            className="font-display text-3xl sm:text-4xl font-bold text-center mb-10"
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          >
            Your day, automatically organized.
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          >
            <Card className="max-w-sm mx-auto rounded-2xl shadow-elevated p-6 space-y-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Today's Plan</p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                  <span className="text-lg leading-none mt-0.5">☕</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Warm-up</p>
                    <p className="text-sm font-medium mt-0.5">Reply to Rachel</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <span className="text-lg leading-none mt-0.5">🐸</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Eat the Frog</p>
                    <p className="text-sm font-medium mt-0.5">Write Client Insights architecture</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                  <span className="text-lg leading-none mt-0.5">🔧</span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Supporting tasks</p>
                    <p className="text-sm font-medium mt-0.5">Update pipeline spec</p>
                    <p className="text-sm text-muted-foreground mt-1">Slack update to team</p>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center pt-1">
                NextMove groups tasks by project so work flows naturally.
              </p>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── 5. DIFFERENTIATION ── */}
      <section className="container max-w-4xl mx-auto px-6 py-20">
        <motion.h2
          className="font-display text-3xl sm:text-4xl font-bold text-center mb-12"
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
        >
          Not another task manager.
        </motion.h2>
        <motion.div
          className="grid grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden shadow-card"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        >
          {/* Header */}
          <div className="bg-muted p-4 font-display text-xs font-semibold text-muted-foreground uppercase tracking-wider">Typical apps</div>
          <div className="bg-muted p-4 font-display text-xs font-semibold text-primary uppercase tracking-wider">NextMove</div>
          {/* Rows */}
          {[
            ['Endless task lists', 'Clear daily plan'],
            ['Constant manual planning', 'Automatic prioritization'],
            ['Scattered work', 'Project momentum'],
            ['Calendar chaos', 'Intelligent scheduling'],
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
            Your next move is ready.
          </h2>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="text-base px-10 h-12 rounded-2xl font-display font-semibold">
              Start using NextMove <ArrowRight className="ml-2 h-4 w-4" />
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
          <span>Always know your next move.</span>
        </div>
      </footer>
    </div>
  );
}
