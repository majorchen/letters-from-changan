# Playtest Acceptance

This file defines what must be proven before the remaining v1.0 playtest items can be marked complete.

## Long-Run Pass

Run at least one 200-turn pass for each role:

```bash
PLAYTEST_ROLES=merchant PLAYTEST_TURNS=200 npm run playtest:longrun
PLAYTEST_ROLES=musician PLAYTEST_TURNS=200 npm run playtest:longrun
PLAYTEST_ROLES=wanderer PLAYTEST_TURNS=200 npm run playtest:longrun
PLAYTEST_ROLES=scholar PLAYTEST_TURNS=200 npm run playtest:longrun
```

Pass criteria:

- `narrativeSummary` remains present after turn 20 and continues to include recent player decisions.
- Recent assistant openings do not repeat as a template.
- The story does not repeatedly reset to the inn or an unrelated mystery figure.
- Letter replies do not trigger a new unread letter before the configured cooldown.
- Each role reaches act 2 and act 3 pacing without losing its role-specific 2077 fragment.

## Role Aha Moments

Each role needs at least one moment where the player can infer a connection without the model explaining it.

- Merchant: a Tang price or ledger anomaly becomes a future supply-chain echo.
- Scholar: a copied text or poem reveals that memory and written culture are being rewritten.
- Wanderer: blade damage, wanted lists, and future surveillance point to the same tracker.
- Musician: a melody appears as Tang performance, personal memory, and future generated audio.

Pass criteria:

- The moment is readable from dialogue and scene facts, not from exposition.
- It writes a durable event code into `[STATE] EVENTS`.
- It can later be referenced by a letter, NPC, or contradiction follow-up.

## Human Feedback

Collect at least three full-play notes. Each report should include:

- Role and rough turn count.
- Where the player felt pulled forward.
- Where the player felt interrupted or reset.
- Whether Lin Shen felt like a person rather than a narrator.
- Whether the player noticed one contradiction or aha moment.
- Whether the letter frequency felt rare enough.

