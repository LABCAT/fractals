---
description: Always use arrow functions instead of function declarations
alwaysApply: true
---

# Arrow functions

Always use arrow functions. Prefer `const` / `export const` arrow assignments over `function` declarations.

```js
// ✅
const foo = (x) => x * 2;
export const bar = async () => {};

// ❌
function foo(x) {
  return x * 2;
}
```

Applies to module helpers, callbacks, and sketch methods assigned on `p` (e.g. `p.setup = async () => {}`).
