import { ScrollView, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { CreatureCard } from '@/components/game/CreatureCard';
import { mockCreatures } from '@/src/utils/mockData';
import { twoStyles as styles } from '@/src/styles';

export default function CreaturesScreen() {
  const capturedCreatureIds = ['1', '3']; // Mock captured creatures

  const renderCreature = ({ item }: { item: typeof mockCreatures[0] }) => (
    <CreatureCard
      creature={item}
      captured={capturedCreatureIds.includes(item.id)}
      onPress={() => {
        // Handle creature selection
        console.log('Selected creature:', item.name);
      }}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Creature Collection</Text>
        <Text style={styles.subtitle}>
          Catch creatures by completing workout challenges!
        </Text>
        <Text style={styles.stats}>
          {capturedCreatureIds.length} / {mockCreatures.length} captured
        </Text>
      </View>
      
      <FlatList
        data={mockCreatures}
        renderItem={renderCreature}
        keyExtractor={(item) => item.id}
        numColumns={1}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}
