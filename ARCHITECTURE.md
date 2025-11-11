# System Architecture: Creature Unlock & XP Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER COMPLETES WORKOUT                       │
│                     (Live Workout or Polar Sync)                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKOUT COMPLETION SERVICE                       │
│  src/services/workoutCompletionService.ts                           │
├─────────────────────────────────────────────────────────────────────┤
│  1. Parse workout metrics (calories, duration, HR, distance)        │
│  2. Calculate base XP using WorkoutProcessor                        │
│  3. Check for creature unlocks using CreatureService                │
│  4. Calculate bonus XP from unlocked creatures                      │
│  5. Calculate total XP and new level                                │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────┴───────────────────────┐
        │                                                │
        ▼                                                ▼
┌──────────────────────┐                    ┌───────────────────────┐
│  WORKOUT PROCESSOR   │                    │  CREATURE SERVICE     │
│  workoutProcessor.ts │                    │  creatureService.ts   │
├──────────────────────┤                    ├───────────────────────┤
│  Calculate XP:       │                    │  Load creatures.json  │
│  • Calories × 0.1    │                    │  Check requirements:  │
│  • Distance × 5      │                    │  • Min calories       │
│  • Duration × 0.5    │                    │  • Min duration       │
│  • HR bonus +10      │                    │  • Min distance       │
│                      │                    │  • Min heart rate     │
│  Returns: Base XP    │                    │  • Sport type         │
└──────────────────────┘                    │                       │
                                            │  Returns: Unlocked    │
                                            │  creatures + Bonus XP │
                                            └───────────────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FIREBASE UPDATE                             │
│                     (Automatic & Real-time)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  users/{userId}                      workoutSessions/{sessionId}    │
│  ├─ xp += totalXP                    ├─ userId                      │
│  ├─ level (recalculated)             ├─ metrics                     │
│  ├─ totalWorkouts += 1               ├─ gameRewards                 │
│  ├─ totalCalories += calories        │   ├─ experienceGained        │
│  ├─ capturedCreatures.push(...)      │   └─ creaturesFound          │
│  └─ workoutHistory.push({...})       └─ timestamps                  │
│                                                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
        ┌───────────────────────┴────────────────────────┐
        │                                                │
        ▼                                                ▼
┌──────────────────────┐                    ┌───────────────────────┐
│   CREATURE UNLOCK    │                    │     XP TAB UPDATE     │
│       MODAL          │                    │                       │
├──────────────────────┤                    ├───────────────────────┤
│  IF creatures > 0:   │                    │  • Show new XP total  │
│  • Show celebration  │                    │  • Update level       │
│  • Display creatures │                    │  • Add to history     │
│  • Show stats        │                    │  • Show stats         │
│  • Rarity colors     │                    │  • Progress to next   │
└──────────────────────┘                    └───────────────────────┘
```

---

## Data Flow Example

### Scenario: User completes a 30-minute run

```
INPUT:
┌─────────────────────────┐
│ Workout Metrics:        │
│ • Calories: 350         │
│ • Duration: 30 min      │
│ • Distance: 5.2 km      │
│ • Avg HR: 148 bpm       │
│ • Sport: RUNNING        │
└─────────────────────────┘
            │
            ▼
PROCESSING:
┌─────────────────────────┐
│ XP Calculation:         │
│ • 350 × 0.1 = 35 pts    │
│ • 5.2 × 5 = 26 pts      │
│ • 30 × 0.5 = 15 pts     │
│ • HR bonus = 10 pts     │
│ ───────────────────     │
│ Base XP = 86 XP         │
└─────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│ Creature Check:         │
│ Wind Falcon (300 cal,   │
│ 8km) - ❌ Distance too  │
│ short                   │
│                         │
│ Thunder Wolf (400 cal,  │
│ 5km) - ❌ Calories too  │
│ low                     │
│                         │
│ Shadow Panther (450 cal,│
│ 6km, 35min) - ❌ All    │
│ requirements not met    │
│                         │
│ No creatures unlocked   │
└─────────────────────────┘
            │
            ▼
OUTPUT:
┌─────────────────────────┐
│ Result:                 │
│ • Base XP: 86           │
│ • Bonus XP: 0           │
│ • Total XP: 86          │
│ • Creatures: 0          │
│ • Level: (updated)      │
└─────────────────────────┘
```

---

## Component Interaction

```
app/(tabs)/live.tsx
    │
    │ User clicks "End Workout"
    │
    ├─► useLiveWorkout()
    │       └─► Returns workout metrics
    │
    ├─► workoutCompletionService.completeLiveWorkout()
    │       │
    │       ├─► WorkoutProcessor.calculateExperience()
    │       ├─► creatureService.checkWorkoutForUnlocks()
    │       ├─► gameService.saveWorkoutSession()
    │       └─► Firebase updates
    │
    ├─► IF creatures unlocked:
    │       └─► Show CreatureUnlockModal
    │
    └─► Display workout summary


app/(tabs)/xp.tsx
    │
    ├─► useAuth() - Get current user
    │
    ├─► Firebase getDoc('users/{userId}')
    │       └─► Load XP, level, workoutHistory
    │
    ├─► Display current stats
    │       ├─► Level & XP
    │       ├─► Progress to next level
    │       ├─► Total workouts/calories
    │       └─► Recent workout history
    │
    └─► Auto-refreshes when Firebase updates


app/(tabs)/creature.tsx
    │
    ├─► useAuth() - Get current user
    │
    ├─► useGameProfile(userId)
    │       └─► Load captured creatures
    │
    ├─► creatureService.getAllCreatures()
    │       └─► Load all available creatures
    │
    └─► Display creatures with captured status
            ├─► Show unlock requirements
            └─► Highlight captured ones
```

---

## State Management

```
┌────────────────────────────────────────────────┐
│              FIREBASE (Source of Truth)        │
├────────────────────────────────────────────────┤
│  • User XP & Level                             │
│  • Captured Creatures                          │
│  • Workout History                             │
│  • Total Stats                                 │
└──────────────────┬─────────────────────────────┘
                   │
                   │ Real-time sync
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
┌───────────────┐    ┌───────────────┐
│  useGameProfile│    │   XP Tab     │
│  Hook          │    │   Component  │
├───────────────┤    ├───────────────┤
│  • Loads data │    │  • Displays  │
│  • Caches     │    │    current   │
│  • Updates    │    │    state     │
│  • Refreshes  │    │  • Auto-     │
│               │    │    updates   │
└───────────────┘    └───────────────┘
```

---

## File Dependencies

```
data/creatures.json
    ↓ loaded by
src/services/creatureService.ts
    ↓ used by
src/services/workoutCompletionService.ts
    ↓ used by
app/(tabs)/live.tsx
    ↓ displays
components/game/CreatureUnlockModal.tsx


src/types/polar.ts
    ↓ defines types for
src/utils/workoutProcessor.ts
    ↓ used by
src/services/workoutCompletionService.ts


src/services/firebase.ts
    ↓ provides db connection to
src/services/gameService.ts
    ↓ used by
src/hooks/useGameProfile.ts
    ↓ used by
app/(tabs)/xp.tsx
app/(tabs)/creature.tsx
```

---

## Key Decision Points

```
User Completes Workout
    │
    ├─► Is user authenticated?
    │   ├─ Yes → Process workout
    │   └─ No → Show "Sign in to earn rewards"
    │
    ├─► Calculate XP
    │   └─► Always award based on performance
    │
    ├─► Check creature unlocks
    │   ├─ Requirements met? → Unlock + Bonus XP
    │   └─ Not met? → Continue with base XP
    │
    ├─► Update Firebase
    │   ├─ Success → Show results
    │   └─ Failure → Show error, retry option
    │
    └─► Display UI
        ├─ Creatures unlocked? → Show modal
        └─ No creatures? → Show summary only
```

---

## Performance Considerations

### Optimizations in Place:
- ✅ Single Firebase write for all user updates
- ✅ Batch creature unlock checks
- ✅ Cached creature data (loaded once from JSON)
- ✅ Limited workout history (last 10 workouts)
- ✅ Efficient XP calculation (simple math)

### Potential Bottlenecks:
- ⚠️ Large number of creatures (currently 10, no issue)
- ⚠️ Frequent Firebase reads (use hooks with caching)
- ⚠️ Complex unlock requirements (keep simple)

---

## Error Handling

```
Workout Completion
    │
    ├─ Try to process
    │   ├─ Success → Continue
    │   └─ Error → Log & show user-friendly message
    │
    ├─ Try to update Firebase
    │   ├─ Success → Continue
    │   └─ Error → Retry or queue for later
    │
    └─ Try to display UI
        ├─ Success → Done!
        └─ Error → Fallback to basic summary
```

**Error Scenarios Handled:**
1. User not authenticated
2. Firebase connection failure
3. Invalid workout data
4. Missing creature configuration
5. XP calculation errors

---

This architecture ensures:
- 🔒 Data consistency (Firebase as single source of truth)
- ⚡ Real-time updates (Firebase sync)
- 🎨 Clean separation of concerns (services, hooks, components)
- 🧪 Easy testing (mock data available)
- 📈 Scalability (modular design)
