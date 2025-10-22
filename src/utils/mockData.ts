import { Creature } from '../types/polar';

export const mockCreatures: Creature[] = [
  {
    id: '1',
    name: 'Thunder Wolf',
    type: 'rare',
    image: '',
    stats: { power: 85, speed: 92, endurance: 78 },
    requiredWorkout: { 
      minCalories: 400, 
      minDistance: 5000, // 5km
      sport: 'RUNNING' 
    }
  },
  {
    id: '2',
    name: 'Flame Phoenix',
    type: 'epic',
    image: '',
    stats: { power: 120, speed: 88, endurance: 95 },
    requiredWorkout: { 
      minCalories: 600, 
      minDuration: 60, // 60 minutes
      minHeartRate: 150
    }
  },
  {
    id: '3',
    name: 'Aqua Serpent',
    type: 'common',
    image: '',
    stats: { power: 45, speed: 65, endurance: 70 },
    requiredWorkout: { 
      minCalories: 200, 
      sport: 'SWIMMING' 
    }
  },
  {
    id: '4',
    name: 'Golden Dragon',
    type: 'legendary',
    image: '',
    stats: { power: 150, speed: 100, endurance: 120 },
    requiredWorkout: { 
      minCalories: 1000, 
      minDistance: 15000, // 15km
      minDuration: 90, // 90 minutes
      minHeartRate: 160
    }
  },
  {
    id: '5',
    name: 'Forest Spirit',
    type: 'common',
    image: '',
    stats: { power: 55, speed: 60, endurance: 85 },
    requiredWorkout: { 
      minCalories: 250, 
      sport: 'HIKING',
      minDuration: 45
    }
  },
  {
    id: '6',
    name: 'Iron Titan',
    type: 'rare',
    image: '',
    stats: { power: 110, speed: 45, endurance: 130 },
    requiredWorkout: { 
      minCalories: 500, 
      sport: 'FITNESS',
      minDuration: 50
    }
  },
  {
    id: '7',
    name: 'Wind Falcon',
    type: 'common',
    image: '',
    stats: { power: 60, speed: 95, endurance: 55 },
    requiredWorkout: { 
      minCalories: 300, 
      sport: 'CYCLING',
      minDistance: 8000 // 8km
    }
  },
  {
    id: '8',
    name: 'Crystal Guardian',
    type: 'epic',
    image: '',
    stats: { power: 95, speed: 70, endurance: 140 },
    requiredWorkout: { 
      minCalories: 800, 
      minDuration: 75,
      minHeartRate: 140
    }
  }
];

export const getCreaturesByRarity = (rarity: Creature['type']): Creature[] => {
  return mockCreatures.filter(creature => creature.type === rarity);
};

export const getCreaturesBySport = (sport: string): Creature[] => {
  return mockCreatures.filter(creature => 
    creature.requiredWorkout.sport?.toLowerCase() === sport.toLowerCase()
  );
};

export const getRandomCreature = (rarity?: Creature['type']): Creature => {
  const filteredCreatures = rarity 
    ? mockCreatures.filter(c => c.type === rarity)
    : mockCreatures;
  
  const randomIndex = Math.floor(Math.random() * filteredCreatures.length);
  return filteredCreatures[randomIndex];
};
