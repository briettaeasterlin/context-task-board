import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, Inbox, Brain, CalendarClock } from 'lucide-react';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container max-w-5xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-1.5 font-display text-lg font-bold tracking-tight">
            <span className="text-accent">▸</span>
            <span>NextMove</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm">Log in</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="text-sm">Start Using NextMove</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={0}
        >
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
            NextMove
          </h1>
        </motion.div>
        <motion.p
          className="text-xl sm:text-2xl text-muted-foreground mt-4 font-display"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
        >
          Always know your next move.
        </motion.p>
        <motion.p
          className="text-base text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={2}
        >
          NextMove quietly manages your projects and tasks so you can focus on doing the work.
          <br />
          It prioritizes what matters, schedules meaningful progress, and helps you stay on track without constant planning.
        </motion.p>
        <motion.div
          className="flex items-center justify-center gap-4 mt-10"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={3}
        >
          <Link to="/auth?mode=signup">
            <Button size="lg" className="text-base px-8 h-12 rounded-2xl font-display font-semibold">
              Start Using NextMove <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#how">
            <Button variant="outline" size="lg" className="text-base px-8 h-12 rounded-2xl font-display">
              See How It Works
            </Button>
          </a>
        </motion.div>
      </section>

      {/* How It Works */}
      <section id="how" className="container max-w-5xl mx-auto px-6 py-20">
        <motion.h2
          className="font-display text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Low-touch execution
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Inbox className="h-6 w-6" />,
              title: 'Capture your work',
              description: 'Add projects and tasks once. NextMove keeps track of everything.',
            },
            {
              icon: <Brain className="h-6 w-6" />,
              title: 'NextMove prioritizes',
              description: 'The execution engine evaluates deadlines, strategic value, and project momentum.',
            },
            {
              icon: <CalendarClock className="h-6 w-6" />,
              title: 'Your day gets scheduled',
              description: 'NextMove schedules the most impactful work into your calendar.',
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
            >
              <Card className="p-8 rounded-2xl shadow-card hover:shadow-elevated transition-shadow duration-300 h-full">
                <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-5">
                  {card.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">{card.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{card.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container max-w-5xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Your personal execution manager.
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Instead of forcing you to constantly manage tasks, NextMove analyzes your projects and tells you what to work on next.
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="text-base px-10 h-12 rounded-2xl font-display font-semibold">
              Start Using NextMove <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
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
