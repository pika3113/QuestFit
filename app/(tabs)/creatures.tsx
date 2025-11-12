import { useEffect, useState } from 'react';
import { ScrollView, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { CreatureCard } from '@/components/game/CreatureCard';
import { twoStyles as styles } from '@/src/styles';
import creatureService from '@/src/services/creatureService';
import { useGameProfile } from '@/src/hooks/useGameProfile';
import { useAuth } from '@/src/hooks/useAuth';
import { Creature } from '@/src/types/polar';

export default function CreaturesScreen() {
  const { user } = useAuth();
  const { profile } = useGameProfile(user?.uid || null);
  const [allCreatures, setAllCreatures] = useState<Creature[]>([]);

  const capturedCreatureIds = profile?.capturedCreatures || [];
  
  useEffect(() => {
    // load only locked/uncaptured creatures
    const locked = creatureService.getLockedCreatures(capturedCreatureIds);
    setAllCreatures(locked);
  }, [capturedCreatureIds.length]);

  const lockedCreatures = allCreatures;

  const renderCreature = ({ item }: { item: Creature }) => (
    <CreatureCard
      creature={item}
      captured={false} // all shown here are locked
      onPress={() => {
        // handle creature selection zzzzzzzzzzzzzzzzzzzzzzzzzz sleeeeep
        console.log('Selected creature:', item.name);
        const lore = creatureService.getCreatureLore(item.id);
        if (lore) {
          console.log('Lore:', lore);
        }
      }}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Locked Creatures</Text>
        <Text style={styles.subtitle}>
          Complete workout challenges to unlock these creatures!
        </Text>
        <Text style={styles.stats}>
          {capturedCreatureIds.length} captured, {lockedCreatures.length} remaining
        </Text>
      </View>
      
      <FlatList
        data={lockedCreatures}
        renderItem={renderCreature}
        keyExtractor={(item) => item.id}
        numColumns={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}
