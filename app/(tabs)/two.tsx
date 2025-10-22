import { StyleSheet, ScrollView, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import { CreatureCard } from '@/components/game/CreatureCard';
import { mockCreatures } from '@/src/utils/mockData';

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 8,
  },
  stats: {
    fontSize: 14,
    textAlign: 'center',
    color: '#3B82F6',
    fontWeight: '600',
  },
  listContainer: {
    padding: 8,
  },
});
