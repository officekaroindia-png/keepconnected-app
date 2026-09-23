// Fun message pools + the logic that decides which dashboard animation shows right now.
// One animation at a time, chosen by current time + day against the company's windows.

const MORNING_LINES = [
  'Rise and grind! ☀️ Ready to conquer today?',
  'Good morning! 🌅 Let’s make today count',
  'A fresh day, a fresh start 🌱',
  'Chai first, then check in? ☕',
  'Are you going office today? 🚗💨',
  'New day, new wins 💪 Let’s go!',
  'Morning! 🌞 The team’s waiting for you',
  'Up and at ’em! 🐦 Early bird gets it done',
  'Let’s turn today into a great one ✨',
  'Wakey wakey! ☕ Time to shine',
];

const LATE_LINES = [
  'Sneaking in? 👀 Better hurry!',
  'Running a little behind? 🏃 You got this',
  'Rough morning? No worries, just get here 💪',
  'Traffic won again? 🚦 Deep breath, you’re close',
  'Late start, strong finish 🔥 Let’s go',
  'Still time to make today great ⏰',
];

const LUNCH_LINES = [
  'Lunch time! 🍽️ Fuel up, you earned it',
  'Take a break — you deserve it 😋',
  'Food o’clock! 🍛 Enjoy every bite',
  'Recharge with a good meal 🥗',
  'Bon appétit! 🍱 Back stronger after',
];

const WEEKEND_LINES = [
  'Weekend’s almost here! 🎉 One more push',
  'Nearly the weekend — finish strong 💪',
  'Friday feeling! 🕺 Wrap it up nicely',
  'The weekend is calling 📞 Almost there!',
];

const SUNDAY_LINES = [
  'It’s Sunday 😴 Rest up, you’ve earned it',
  'Lazy Sunday vibes 🐱 Relax and recharge',
  'Take it easy today 🛋️ See you tomorrow',
  'Sunday = you time 🌿 Enjoy the break',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Minutes since local midnight, right now.
export const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const todayDow = () => new Date().getDay(); // 0=Sun..6=Sat

// Is `min` within [start, end)? Handles normal same-day windows.
const inWindow = (min, w) => w && w.enabled !== false && min >= w.start && min < w.end;

/**
 * Decide which dashboard animation to show right now.
 * Priority (highest first): Sunday → Weather-rain handled separately → within-window animations.
 * Returns { type, line, animFile } or null.
 *
 * @param settings company.animations object
 * @param offDays array of weekly-off day numbers (to know if today is Sunday-off)
 */
export function pickDashboardAnimation(animations = {}) {
  const min = nowMinutes();
  const dow = todayDow();

  // Sunday always gets the sleepy cat (independent of windows).
  if (dow === 0) {
    return { type: 'sunday', line: pick(SUNDAY_LINES), animFile: 'sunday' };
  }

  // Late window — takes priority over morning if they somehow overlap (they shouldn't,
  // the settings UI prevents overlap, but late is the more important signal).
  if (inWindow(min, animations.late)) {
    return { type: 'late', line: pick(LATE_LINES), animFile: 'late' };
  }

  // Morning greeting.
  if (inWindow(min, animations.morning)) {
    return { type: 'morning', line: pick(MORNING_LINES), animFile: 'morning' };
  }

  // Lunch.
  if (inWindow(min, animations.lunch)) {
    return { type: 'lunch', line: pick(LUNCH_LINES), animFile: 'lunch' };
  }

  // Weekend vibe — only Fri (5) or Sat (6), and only if enabled + provided.
  // Disabled for now (no animation provided yet); enable once a weekend file is added.
  // if ((dow === 5 || dow === 6) && inWindow(min, animations.weekend)) {
  //   return { type: 'weekend', line: pick(WEEKEND_LINES), animFile: 'weekend' };
  // }

  return null;
}
