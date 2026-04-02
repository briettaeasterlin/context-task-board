

## UX Streamlining Plan -- Reduce Cognitive Load

### Problem Summary
The app shows too much at once, duplicates information, and relies on unlabeled icons. The core loop (see task, do task, mark done) is buried under decorative UI.

### Recommended Changes

#### 1. Remove the "Your Next Move" hero card duplication
**Today page**: The first task in "Today's Moves" is already visually highlighted with a ring and pulsing indicator. The separate "Your Next Move" hero card above it shows the exact same task, creating redundancy. 

**Change**: Remove the standalone "Your Next Move" hero card entirely. Instead, make the first task in the list slightly more prominent (larger text, "Start This" button inline). One task, one place.

#### 2. Reduce icon buttons to the 2 that matter most
Each task card currently shows 5 action icons (check, swap, deprioritize, bump tomorrow, delete). Most users need only two fast actions on this screen:
- **Check** (mark done) 
- **Calendar arrow** (move to tomorrow)

**Change**: Show only these 2 icons by default. Move swap, deprioritize, and delete into the task detail drawer (which already opens on card click). This cuts visible icons from ~30 to ~10 on a typical day.

#### 3. Collapse the greeting hero into a single line
The greeting card ("Good morning, Name") with its streak counter and progress bar takes significant vertical space before any actionable content.

**Change**: Merge greeting + progress into a compact single-line header: `Good morning, Sarah. 2 of 5 moves done. 🔥 3-day streak` with the thin progress bar directly below. No separate Card wrapper -- just text at the top.

#### 4. Fix onboarding terminology mismatch
Step 2 says "Morning Route / AI Conversation / Evening Review" but the nav says "Today / Plan / Routes / Review". 

**Change**: Update Step 2 copy to reference the actual tab names: "Today (see your plan) / Plan (set tomorrow) / Review (reflect & improve)". Drop "AI Conversation" since it's an external tool, not an app tab.

#### 5. Simplify nav bar styling
The double-circle transit node treatment on each nav item adds visual weight.

**Change**: Use a simple filled dot (active) or no dot (inactive) instead of the nested circle-in-circle. Keep the colored line connectors between items -- those are lightweight and reinforce the transit theme without the extra visual mass.

### Files Modified
- `src/pages/TodayPage.tsx` -- Remove hero card, reduce action buttons, compact greeting
- `src/pages/OnboardingPage.tsx` -- Fix Step 2 terminology
- `src/components/layout/AppShell.tsx` -- Simplify nav node styling

### What This Does NOT Change
- Task detail drawer (all actions remain accessible there)
- Plan page functionality
- Routes page
- Review page
- Database schema
- Any backend logic
