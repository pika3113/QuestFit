import React, { useState } from 'react';
import { View, TextInput, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/Themed';
import { instructorDashboardStyles as styles } from '@/src/styles/screens/instructorDashboardStyles';
import { User } from '../types';

interface UserSelectionViewProps {
  allUsers: User[];
  selectedUserIds: string[];
  onToggleUser: (userId: string) => void;
  onDone: () => void;
}

export const UserSelectionView = ({ 
  allUsers, 
  selectedUserIds, 
  onToggleUser, 
  onDone 
}: UserSelectionViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const selectedIds = Array.isArray(selectedUserIds) ? selectedUserIds : [];

  const filteredUsers = allUsers.filter(user =>
    user.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Users to Monitor</Text>
        <Pressable
          style={styles.doneButton}
          onPress={onDone}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search user ID..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#999"
      />

      <ScrollView style={styles.userList}>
        {filteredUsers.map(user => (
          <Pressable
            key={user.id}
            style={[
              styles.userItem,
              selectedIds.includes(user.id) && styles.userItemSelected,
            ]}
            onPress={() => onToggleUser(user.id)}
          >
            <View>
              <Text style={styles.userNameText}>{user.displayName}</Text>
              <Text style={styles.userIdSubText}>{user.id}</Text>
            </View>
            {selectedIds.includes(user.id) && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};
