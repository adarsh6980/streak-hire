function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD, UTC-based for consistency
}

function daysBetween(aKey, bKey) {
  const a = new Date(`${aKey}T00:00:00Z`);
  const b = new Date(`${bKey}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

// Given the current streak record and "now", returns the updated record
// after logging an application today. Idempotent for repeat applications
// on the same day.
export function applyStreakUpdate(streak, now = new Date()) {
  const today = todayKey(now);
  const current = streak || { current: 0, longest: 0, lastAppliedDate: null };

  if (current.lastAppliedDate === today) {
    return current; // already logged today, streak unchanged
  }

  let nextCurrent;
  if (!current.lastAppliedDate) {
    nextCurrent = 1;
  } else {
    const gap = daysBetween(current.lastAppliedDate, today);
    nextCurrent = gap === 1 ? current.current + 1 : 1;
  }

  return {
    current: nextCurrent,
    longest: Math.max(current.longest || 0, nextCurrent),
    lastAppliedDate: today,
  };
}

// A streak "counts as alive" if the user applied today or yesterday.
export function isStreakActive(streak, now = new Date()) {
  if (!streak || !streak.lastAppliedDate) return false;
  const gap = daysBetween(streak.lastAppliedDate, todayKey(now));
  return gap <= 1;
}
