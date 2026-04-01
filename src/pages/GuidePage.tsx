import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const STOPS = [
  {
    emoji: '☀️',
    title: 'Morning Route',
    color: '#0098D4', // Victoria blue
    time: 'Open the app · 2 minutes',
    description: 'Check your planned moves for today. Confirm, adjust, or add — then go.',
    detail: 'The app proposes. You decide.',
  },
  {
    emoji: '💬',
    title: 'AI Conversation',
    color: '#E32017', // Central red
    time: 'Talk to your favorite LLM · all day',
    description: 'Use ChatGPT, Claude, or any AI to:',
    bullets: [
      'Capture new tasks as you think of them',
      'Mark things done as you finish them',
      'Think through priorities and blockers',
      'Get context on what\'s in flight',
    ],
    example: '"I finished the V2 invoice and need to schedule a call with Rachel for next week."',
    exampleCaption: 'Your AI handles the rest.',
  },
  {
    emoji: '🌙',
    title: 'Evening Review',
    color: '#003688', // Piccadilly blue
    time: 'Open the app · 1 minute',
    description: 'See what you accomplished today. Close out incomplete tasks: Done / Tomorrow / Drop.',
    detail: 'Preview tomorrow\'s route. Then close your laptop. You\'re good.',
  },
];

export default function GuidePage() {
  const navigate = useNavigate();

  return (
    <AppShell>
      <div className="max-w-xl mx-auto space-y-6 sm:space-y-8 pb-12 px-4 sm:px-0">
        {/* Header */}
        <div className="text-center pt-2 sm:pt-4">
          <h1 className="text-xl sm:text-2xl font-display font-bold">How to Use NextMove</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2">Your AI-powered daily execution system</p>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground text-center leading-relaxed">
          NextMove works best as a loop — three touches a day,<br className="hidden sm:inline" />
          <span className="sm:hidden"> </span>each one in the right place.
        </p>

        {/* Three stops */}
        <div className="relative">
          {/* Vertical connecting line */}
          <div className="absolute left-[17px] sm:left-[19px] top-8 bottom-8 w-[3px] rounded-full" style={{
            background: `linear-gradient(180deg, #0098D4, #E32017, #003688)`,
          }} />

          <div className="space-y-6 sm:space-y-8">
            {STOPS.map((stop, idx) => (
              <div key={idx} className="flex gap-3 sm:gap-5 relative">
                {/* Stop dot */}
                <div className="flex-shrink-0 relative z-10">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-[3px] flex items-center justify-center bg-card text-base sm:text-lg" style={{ borderColor: stop.color }}>
                    {stop.emoji}
                  </div>
                </div>

                {/* Content */}
                <Card className="flex-1 p-4 sm:p-5 rounded-xl border-l-[3px] min-w-0" style={{ borderLeftColor: stop.color }}>
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <h2 className="font-display font-bold text-sm sm:text-base">{stop.title}</h2>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stop.color }} />
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-mono mb-2 sm:mb-3">{stop.time}</p>
                  <p className="text-xs sm:text-sm text-foreground leading-relaxed">{stop.description}</p>

                  {stop.bullets && (
                    <ul className="mt-2 space-y-1">
                      {stop.bullets.map((b, i) => (
                        <li key={i} className="text-xs sm:text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-muted-foreground/50">·</span> {b}
                        </li>
                      ))}
                    </ul>
                  )}

                  {stop.example && (
                    <div className="mt-3 sm:mt-4 bg-muted/50 rounded-lg sm:rounded-xl p-3 sm:p-4">
                      <p className="text-xs sm:text-sm italic text-foreground/80 leading-relaxed">
                        {stop.example}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 sm:mt-2">{stop.exampleCaption}</p>
                    </div>
                  )}

                  {stop.detail && (
                    <p className="text-xs sm:text-sm text-muted-foreground mt-2 sm:mt-3">{stop.detail}</p>
                  )}
                </Card>
              </div>
            ))}
          </div>
        </div>

        {/* Rule of Thumb */}
        <Card className="p-4 sm:p-6 rounded-xl sm:rounded-2xl text-center bg-[hsl(var(--mint)/0.1)] border-accent/20">
          <h3 className="font-display font-bold text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">The Rule of Thumb</h3>
          <div className="space-y-1.5 sm:space-y-2 text-sm sm:text-base">
            <p className="text-foreground">
              <span className="font-semibold">App</span> → for planning and reflecting
            </p>
            <p className="text-foreground">
              <span className="font-semibold">AI</span> → for doing and capturing
            </p>
          </div>
          <div className="mt-3 sm:mt-4 space-y-1 text-xs sm:text-sm text-muted-foreground">
            <p>The app gives you clarity.</p>
            <p>Your AI gives you momentum.</p>
            <p>Together, they keep you moving.</p>
          </div>
        </Card>

        {/* Supported Platforms */}
        <div className="text-center text-[10px] sm:text-xs text-muted-foreground px-2">
          <p>Works with ChatGPT, Claude, or any LLM that supports custom instructions.</p>
        </div>

        {/* CTA */}
        <div className="text-center pb-4">
          <Button onClick={() => navigate('/today')} className="rounded-xl font-display min-h-[44px]" size="sm">
            Got it — show me my route <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
