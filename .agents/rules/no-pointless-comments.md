---
description: Do not leave pointless or restating comments in code
alwaysApply: true
---

# No pointless comments

Do not add comments that restate what the code already says, or that only explain something obvious from context / dependencies.

```js
// ❌
// Tone CC events already have { time, ticks, value }
p.scheduleCueSet(midiData.tracks[9].controlChanges[74] ?? [], 'executeTrack9', true);

// ✅
p.scheduleCueSet(midiData.tracks[9].controlChanges[74] ?? [], 'executeTrack9', true);
```

Only comment when the intent is non-obvious (tradeoff, constraint, workaround, non-local why). Prefer no comment over a restating one.
