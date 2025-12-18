import { useEffect, useState } from 'react';
import { ScrollView, TextInput, Pressable, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { CreatureDetailsModal, CreatureCardGrid, CreatureCardGridSkeleton } from '@/components/game/CreatureCard';
import { twoStyles as styles } from '@/src/styles';
import creatureService from '@/src/services/creatureService';
import { useGameProfile } from '@/src/hooks/useGameProfile';
import { useAuth } from '@/src/hooks/useAuth';
import { Creature } from '@/src/types/polar';
import { Ionicons } from '@expo/vector-icons';

const RARITIES = ['common', 'rare', 'epic', 'legendary'];
const SPORTS = ['GENERAL', 'RUNNING', 'SWIMMING', 'HIKING', 'FITNESS', 'CYCLING', 'CIRCUIT'];

type SortField = 'none' | 'rarity' | 'sport';
type SortDirection = 'asc' | 'desc';

export default function CreaturesScreen() {
  const { user } = useAuth();
  const { profile, loading } = useGameProfile(user?.uid || null);
  const [allCreatures, setAllCreatures] = useState<Creature[]>([]);

  const capturedCreatureIds = profile?.capturedCreatures || [];

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [selectedCreature, setSelectedCreature] = useState(creatureService.getAllCreatures()[0]);
  const [selectedCaptured, setSelectedCaptured] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'captured' | 'locked'>('all');
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('none');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  useEffect(() => {
    // load all creatures by ID
    const creatures = creatureService.getAllCreatures();
    setAllCreatures(creatures);
  }, [capturedCreatureIds.length]);

  const isLoading = loading || allCreatures.length === 0;

  const cards = allCreatures.map(creature => ({
    creature,
    captured: capturedCreatureIds.includes(creature.id)
  }));

  const toggleSelection = (current: string[], value: string) => {
    if (current.includes(value)) return current.filter(v => v !== value);
    return [...current, value];
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.creature.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'captured' ? card.captured : !card.captured;
    const matchesRarity = selectedRarities.length === 0 ? true : selectedRarities.includes(card.creature.rarity);
    const matchesSport = selectedSports.length === 0 ? true : selectedSports.includes(card.creature.sport);

    return matchesSearch && matchesStatus && matchesRarity && matchesSport;
  });

  const activeFiltersCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (selectedRarities.length > 0 ? 1 : 0) +
    (selectedSports.length > 0 ? 1 : 0) +
    (sortField !== 'none' ? 1 : 0);

  const rarityOrder: Record<string, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const sportOrder = Object.fromEntries(SPORTS.map((s, idx) => [s, idx])) as Record<string, number>;

  const sortedCards = [...filteredCards].sort((a, b) => {
    if (sortField === 'none') return 0;

    let cmp = 0;
    if (sortField === 'rarity') {
      cmp = (rarityOrder[a.creature.rarity] ?? 999) - (rarityOrder[b.creature.rarity] ?? 999);
    } else if (sortField === 'sport') {
      cmp = (sportOrder[a.creature.sport] ?? 999) - (sportOrder[b.creature.sport] ?? 999);
    }

    if (cmp === 0) {
      cmp = a.creature.name.localeCompare(b.creature.name);
    }

    return sortDirection === 'desc' ? -cmp : cmp;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.title, localStyles.headerTitle]}>Creatures</Text>
        <Text style={styles.subtitle}>
          View creatures here. Complete workout challenges to unlock even more creatures!
        </Text>
        <Text style={styles.stats}>
          {capturedCreatureIds.length} captured, {allCreatures.length-capturedCreatureIds.length} remaining
          {(activeFiltersCount > 0 || searchQuery.length > 0) && ` • Showing ${filteredCards.length} filtered`}
        </Text>

        {/* Search and Filter Bar */}
        <View style={localStyles.searchContainer}>
          <View style={localStyles.searchBar}>
            <Ionicons name="search" size={20} color="#666" style={{ marginRight: 8 }} />
            <TextInput
              style={localStyles.searchInput}
              placeholder="Search creatures..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[localStyles.filterButton, activeFiltersCount > 0 && localStyles.filterButtonActive]} 
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="options" size={20} color={activeFiltersCount > 0 ? "#FFF" : "#666"} />
            {activeFiltersCount > 0 && (
              <View style={localStyles.badge}>
                <Text style={localStyles.badgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
      
      {/* Creature Card Grid */}
      {isLoading ? (
        <CreatureCardGridSkeleton count={12} />
      ) : (
        <CreatureCardGrid
          cards={sortedCards}
          onPress={(id) => {
            const card = cards.find(c => parseInt(c.creature.id) === id);
            if (card) {
              setSelectedCreature(card.creature);
              setSelectedCaptured(card.captured);
              setShowUnlockModal(true);
            }
          }}
        />
      )}
      {!isLoading && sortedCards.length === 0 && (
        <View style={localStyles.emptyState}>
          <Text style={localStyles.emptyStateText}>No creatures found matching your filters.</Text>
          <TouchableOpacity onPress={() => {
            setSearchQuery('');
            setStatusFilter('all');
            setSelectedRarities([]);
            setSelectedSports([]);
            setSortField('none');
            setSortDirection('asc');
          }}>
            <Text style={localStyles.clearFiltersText}>Clear all filters</Text>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Filter Creatures</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={localStyles.modalBody}>
              <Text style={localStyles.filterLabel}>Status</Text>
              <View style={localStyles.chipContainer}>
                {['all', 'captured', 'locked'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[localStyles.chip, statusFilter === status && localStyles.chipActive]}
                    onPress={() => setStatusFilter(status as any)}
                  >
                    <Text style={[localStyles.chipText, statusFilter === status && localStyles.chipTextActive]}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={localStyles.filterLabel}>Rarity</Text>
              <View style={localStyles.chipContainer}>
                <TouchableOpacity
                    style={[localStyles.chip, selectedRarities.length === 0 && localStyles.chipActive]}
                    onPress={() => setSelectedRarities([])}
                  >
                    <Text style={[localStyles.chipText, selectedRarities.length === 0 && localStyles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {RARITIES.map((rarity) => (
                  <TouchableOpacity
                    key={rarity}
                    style={[localStyles.chip, selectedRarities.includes(rarity) && localStyles.chipActive]}
                    onPress={() => setSelectedRarities((prev) => toggleSelection(prev, rarity))}
                  >
                    <Text style={[localStyles.chipText, selectedRarities.includes(rarity) && localStyles.chipTextActive]}>
                      {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={localStyles.filterLabel}>Exercise Type</Text>
              <View style={localStyles.chipContainer}>
                <TouchableOpacity
                    style={[localStyles.chip, selectedSports.length === 0 && localStyles.chipActive]}
                    onPress={() => setSelectedSports([])}
                  >
                    <Text style={[localStyles.chipText, selectedSports.length === 0 && localStyles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {SPORTS.map((sport) => (
                  <TouchableOpacity
                    key={sport}
                    style={[localStyles.chip, selectedSports.includes(sport) && localStyles.chipActive]}
                    onPress={() => setSelectedSports((prev) => toggleSelection(prev, sport))}
                  >
                    <Text style={[localStyles.chipText, selectedSports.includes(sport) && localStyles.chipTextActive]}>
                      {sport.charAt(0) + sport.slice(1).toLowerCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={localStyles.filterLabel}>Sort</Text>
              <View style={localStyles.chipContainer}>
                {(
                  [
                    { key: 'none' as const, label: 'None' },
                    { key: 'rarity' as const, label: 'Rarity' },
                    { key: 'sport' as const, label: 'Exercise Type' },
                  ]
                ).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[localStyles.chip, sortField === opt.key && localStyles.chipActive]}
                    onPress={() => setSortField(opt.key)}
                  >
                    <Text style={[localStyles.chipText, sortField === opt.key && localStyles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={localStyles.filterLabel}>Sort Order</Text>
              <View style={localStyles.chipContainer}>
                {(
                  [
                    { key: 'asc' as const, label: 'Asc' },
                    { key: 'desc' as const, label: 'Desc' },
                  ]
                ).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[localStyles.chip, sortDirection === opt.key && localStyles.chipActive]}
                    onPress={() => setSortDirection(opt.key)}
                  >
                    <Text style={[localStyles.chipText, sortDirection === opt.key && localStyles.chipTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={localStyles.modalFooter}>
              <TouchableOpacity 
                style={localStyles.resetButton}
                onPress={() => {
                  setStatusFilter('all');
                  setSelectedRarities([]);
                  setSelectedSports([]);
                  setSortField('none');
                  setSortDirection('asc');
                }}
              >
                <Text style={localStyles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={localStyles.applyButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={localStyles.applyButtonText}>Show Results</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Creature Details Modal */}
      <CreatureDetailsModal
        visible={showUnlockModal}
        creature={selectedCreature}
        captured={selectedCaptured}
        onClose={() => {
          setShowUnlockModal(false);
        }}
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  headerTitle: {
    fontSize: 20,
    lineHeight: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
    backgroundColor: 'transparent',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B35',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  clearFiltersText: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#FFF5F1',
    borderColor: '#FF6B35',
  },
  chipText: {
    color: '#4B5563',
    fontSize: 14,
  },
  chipTextActive: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingBottom: 20,
    backgroundColor: 'transparent',
  },
  resetButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#4B5563',
    fontWeight: '600',
    fontSize: 16,
  },
  applyButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
