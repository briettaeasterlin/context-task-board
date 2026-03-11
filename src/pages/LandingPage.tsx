import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, Layers, Target, Zap } from 'lucide-react';

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
            <span>VectorHQ</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="text-sm">Log in</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="text-sm">Start Planning</Button>
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
            VectorHQ
          </h1>
        </motion.div>
        <motion.p
          className="text-xl sm:text-2xl text-muted-foreground mt-4 font-display"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={1}
        >
          Your personal execution headquarters.
        </motion.p>
        <motion.p
          className="text-base text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed"
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={2}
        >
          Plan your work. Organize your projects. Focus on what matters.
          <br />
          VectorHQ helps you turn ideas into real progress.
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
              Start Planning <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#preview">
            <Button variant="outline" size="lg" className="text-base px-8 h-12 rounded-2xl font-display">
              <Eye className="mr-2 h-4 w-4" /> View Demo
            </Button>
          </a>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="container max-w-5xl mx-auto px-6 py-20">
        <motion.h2
          className="font-display text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          How it works
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Layers className="h-6 w-6" />,
              title: 'Clarity',
              description: 'Organize your work into initiatives, projects, and tasks so nothing falls through the cracks.',
            },
            {
              icon: <Target className="h-6 w-6" />,
              title: 'Focus',
              description: 'Plan your week and identify the next actions that move your work forward.',
            },
            {
              icon: <Zap className="h-6 w-6" />,
              title: 'Momentum',
              description: 'VectorHQ AI reviews your board and helps you stay on track.',
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

      {/* Product Preview */}
      <section id="preview" className="container max-w-5xl mx-auto px-6 py-20">
        <motion.h2
          className="font-display text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Structure that scales
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Card className="rounded-2xl shadow-elevated overflow-hidden border-2">
            <div className="bg-card p-8">
              {/* Mock board */}
              <div className="space-y-6">
                {/* Initiative */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">🚀</span>
                    <h3 className="font-display text-lg font-bold">Launch Product</h3>
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Initiative</span>
                  </div>
                  {/* Projects */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-6">
                    <Card className="p-4 rounded-xl border shadow-card">
                      <div className="flex items-center gap-2 mb-3">
                        <span>📣</span>
                        <h4 className="font-display font-semibold text-sm">Marketing</h4>
                      </div>
                      <div className="space-y-2">
                        {['Define positioning', 'Launch landing page'].map(task => (
                          <div key={task} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-4 h-4 rounded border-2 border-accent/40 flex-shrink-0" />
                            <span>{task}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                    <Card className="p-4 rounded-xl border shadow-card">
                      <div className="flex items-center gap-2 mb-3">
                        <span>⚙️</span>
                        <h4 className="font-display font-semibold text-sm">Product Development</h4>
                      </div>
                      <div className="space-y-2">
                        {['Customer outreach', 'Beta testing'].map(task => (
                          <div key={task} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-4 h-4 rounded border-2 border-accent/40 flex-shrink-0" />
                            <span>{task}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </section>

      {/* Final CTA */}
      <section className="container max-w-5xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6">
            Run your work like a command center.
          </h2>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="text-base px-10 h-12 rounded-2xl font-display font-semibold">
              Start Using VectorHQ <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container max-w-5xl mx-auto px-6 flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-display font-semibold">▸ VectorHQ</span>
          <span>Your personal execution headquarters.</span>
        </div>
      </footer>
    </div>
  );
}
