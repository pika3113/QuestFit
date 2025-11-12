// Level system using a power curve formula for smooth progression
// XP needed to go from level N to level N+1 = round(80 * level^1.3 + 150)
// This scales nicely and feels pretty balanced as you level up

// Calculates how much XP is needed to go from one level to the next
// @param level - the current level you're on
// @returns XP needed to reach the next level
function xpToNext(level: number): number {
  return Math.round(80 * Math.pow(level, 1.3) + 150);
}

// Figures out how much total XP you need to hit a certain level
// @param level - which level you're trying to reach (like level 5)
// @returns the total amount of XP needed from the start
export function getXPForLevel(level: number): number {
  if (level <= 1) return 0;
  
  // add up all the XP requirements for each level
  let totalXP = 0;
  for (let lvl = 1; lvl < level; lvl++) {
    totalXP += xpToNext(lvl);
  }
  
  return totalXP;
}

// Works backwards from your XP to figure out what level you should be
// @param xp - how much total XP you've earned
// @returns your current level
export function calculateLevel(xp: number): number {
  if (xp < 100) return 1;
  
  let level = 1;
  let requiredXP = 0;
  
  // keep bumping up the level until we go past the player's XP
  while (true) {
    const nextLevelXP = getXPForLevel(level + 1);
    if (xp >= nextLevelXP) {
      level++;
    } else {
      break;
    }
  }
  
  return level;
}

// Tells you how much more XP you need to level up
// @param currentXP - your total XP right now
// @param currentLevel - what level you're currently at
// @returns the XP gap to the next level
export function getXPToNextLevel(currentXP: number, currentLevel: number): number {
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  return Math.max(0, nextLevelXP - currentXP);
}

// Gets the XP requirement for leveling up (not your progress, just the requirement)
// @param currentLevel - the level you're on
// @returns how much XP that specific level jump costs
export function getXPRequiredForNextLevel(currentLevel: number): number {
  return xpToNext(currentLevel);
}

// Calcualtes your progress bar percentage towards next level
// @param currentXP - total XP you have
// @param currentLevel - what level you're at
// @returns a number between 0 and 1 for the progress bar
export function getLevelProgress(currentXP: number, currentLevel: number): number {
  const currentLevelXP = getXPForLevel(currentLevel);
  const nextLevelXP = getXPForLevel(currentLevel + 1);
  const xpInCurrentLevel = currentXP - currentLevelXP;
  const xpNeededForLevel = nextLevelXP - currentLevelXP;
  
  return Math.min(1, Math.max(0, xpInCurrentLevel / xpNeededForLevel));
}
