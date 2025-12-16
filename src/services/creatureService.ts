import creaturesData from '../../data/creatures.json';
import { Creature } from '../types/polar';

class CreatureService {
  private creatures: Creature[];

  constructor() {
    this.creatures = creaturesData.creatures as Creature[];
  }

  /**
   * Get all creatures in the game
   */
  getAllCreatures(): Creature[] {
    return this.creatures;
  }

  /**
   * Get a specific creature by ID
   */
  getCreatureById(id: string): Creature | null {
    const creature = this.creatures.find(c => c.id === id);
    return creature ? creature : null;
  }

  /**
   * Get creatures by rarity level
   */
  getCreaturesByRarity(rarity: 'common' | 'rare' | 'epic' | 'legendary'): Creature[] {
    return this.creatures
      .filter(c => c.rarity === rarity);
  }

  /**
   * Get creatures by sport type
   */
  getCreaturesBySport(sport: string): Creature[] {
    return this.creatures
      .filter(c => c.sport === sport);
  }

  /**
   * Get only locked/uncaptured creatures
   */
  getLockedCreatures(capturedIds: string[]): Creature[] {
    return this.creatures
      .filter(c => !capturedIds.includes(c.id));
  }

  /**
   * Get only unlocked/captured creatures
   */
  getUnlockedCreatures(capturedIds: string[]): Creature[] {
    return this.creatures
      .filter(c => capturedIds.includes(c.id));
  }

  // Checks a workout to see if it unlocked any new creatures for the user
  checkWorkoutForUnlocks(workoutData: {
    calories: number;
    duration: number; // measured in minutes
    distance?: number; // in meters if we have it
    avgHeartRate?: number;
    sport?: string;
  }, alreadyCaptured: string[]): Creature[] {
    const unlockedCreatures: Creature[] = [];

    console.log('🔍 Checking workout for unlocks:', workoutData);
    console.log(`📊 Already captured: ${alreadyCaptured.length}/${this.creatures.length} creatures`);
    console.log(`🔓 Checking ${this.creatures.length - alreadyCaptured.length} locked creatures...`);

    for (const creature of this.creatures) {
      // dont bother checking creatures they already have
      if (alreadyCaptured.includes(creature.id)) {
        continue;
      }

      const req = creature.unlockRequirements;
      let meetsRequirements = true;
      const failedRequirements: string[] = [];

      // see if they burned enough calories
      if (req.minCalories && workoutData.calories < req.minCalories) {
        meetsRequirements = false;
        failedRequirements.push(`calories: ${workoutData.calories} < ${req.minCalories}`);
      }

      // check if workout was long enough
      if (req.minDuration && workoutData.duration < req.minDuration) {
        meetsRequirements = false;
        failedRequirements.push(`duration: ${workoutData.duration} < ${req.minDuration}`);
      }

      // make sure its the right sport type if that matters
      if (creature.sport !== 'GENERAL' && workoutData.sport !== creature.sport) {
        meetsRequirements = false;
        failedRequirements.push(`sport: ${workoutData.sport} !== ${creature.sport}`);
      }

      if (meetsRequirements) {
        console.log(`✅ ${creature.name} (${creature.rarity}) - UNLOCKED!`);
        unlockedCreatures.push(creature);
      } else {
        console.log(`❌ ${creature.name} - Failed: ${failedRequirements.join(', ')}`);
      }
    }

    console.log(`🎉 Unlocked ${unlockedCreatures.length} new creature(s) from this workout!`);
    return unlockedCreatures;
  }

  /**
   * Get experience reward for capturing a creature
   */
  getExperienceReward(creatureId: string): number {
    const creature = this.creatures.find(c => c.id === creatureId);
    return creature?.xPReward || 0;
  }

  /**
   * Get creature description and lore
   */
  getCreatureLore(creatureId: string): { description: string; lore: string } | null {
    const creature = this.creatures.find(c => c.id === creatureId);
    if (!creature) return null;
    
    return {
      description: creature.description,
      lore: creature.lore
    };
  }

  /**
   * Get progress towards unlocking a specific creature
   */
  getUnlockProgress(creatureId: string, workoutData: {
    calories: number;
    duration: number;
    distance?: number;
    avgHeartRate?: number;
    sport?: string;
  }): {
    requirement: string;
    current: number;
    target: number;
    percentage: number;
  }[] {
    const creature = this.creatures.find(c => c.id === creatureId);
    if (!creature) return [];

    const progress: {
      requirement: string;
      current: number;
      target: number;
      percentage: number;
    }[] = [];

    const req = creature.unlockRequirements;

    if (req.minCalories) {
      progress.push({
        requirement: 'Calories',
        current: workoutData.calories,
        target: req.minCalories,
        percentage: Math.min((workoutData.calories / req.minCalories) * 100, 100)
      });
    }

    if (req.minDuration) {
      progress.push({
        requirement: 'Duration (min)',
        current: workoutData.duration,
        target: req.minDuration,
        percentage: Math.min((workoutData.duration / req.minDuration) * 100, 100)
      });
    }

    if (creature.sport !== 'GENERAL') {
      progress.push({
        requirement: 'Sport Type',
        current: workoutData.sport === creature.sport ? 1 : 0,
        target: 1,
        percentage: workoutData.sport === creature.sport ? 100 : 0
      });
    }

    return progress;
  }

  // Gets a random creature based on rarity for like random encounters or bonus rewards
  getRandomCreatureByRarity(rarity?: 'common' | 'rare' | 'epic' | 'legendary'): Creature | null {
    const filteredCreatures = rarity 
      ? this.creatures.filter(c => c.rarity === rarity)
      : this.creatures;

    if (filteredCreatures.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * filteredCreatures.length);
    return filteredCreatures[randomIndex];
  }

  /**
   * Get total count of creatures by rarity
   */
  getCreatureCountsByRarity(): Record<string, number> {
    return this.creatures.reduce((acc, creature) => {
      acc[creature.rarity] = (acc[creature.rarity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export default new CreatureService();
