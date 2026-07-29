# Fix 2: LogPeriodScreen — React.memo + stable defaultValues

**Problem:**
1. `LogPeriodScreen` is not wrapped in `React.memo`, so it re-renders whenever parent re-renders
2. `defaultValues: { startDate: new Date().toISOString().slice(0, 10), notes: '' }` creates a new `Date()` on every render, causing `useForm` to re-initialize

**File:** `mobile/src/screens/cycle/LogPeriodScreen.tsx`

**Change 1 — Add `useMemo` import (line 5):**
```
OLD: import React, { useState } from 'react';
NEW: import React, { useState, useMemo } from 'react';
```

**Change 2 — Wrap component with React.memo (line 63):**
```
OLD: export function LogPeriodScreen() {
NEW: export const LogPeriodScreen = React.memo(function LogPeriodScreen() {
```

**Change 3 — Wrap defaultValues in useMemo (lines 66-70):**
```
OLD:
  const { control, handleSubmit, formState } = useForm<LogPeriodForm>({
    resolver: zodResolver(logPeriodSchema),
    defaultValues: { startDate: new Date().toISOString().slice(0, 10), notes: '' },
    mode: 'onBlur',
  });

NEW:
  const defaultValues = useMemo(() => ({ startDate: new Date().toISOString().slice(0, 10), notes: '' }), []);
  const { control, handleSubmit, formState } = useForm<LogPeriodForm>({
    resolver: zodResolver(logPeriodSchema),
    defaultValues,
    mode: 'onBlur',
  });
```

**Effect:** Screen renders only once on mount, not on parent re-renders. `useForm` gets a stable `defaultValues` reference.

**Verification:** Component still renders correctly, form fields populate with today's date.
