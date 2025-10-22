import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

interface Location {
  latitude: number;
  longitude: number;
}

interface WorkoutMapProps {
  route?: Location[];
  startLocation?: Location;
  endLocation?: Location;
  creatures?: Array<{
    id: string;
    name: string;
    location: Location;
    found: boolean;
  }>;
  style?: any;
}

export const WorkoutMap: React.FC<WorkoutMapProps> = ({
  route = [],
  startLocation,
  endLocation,
  creatures = [],
  style
}) => {
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    if (route.length > 0) {
      // Calculate region to fit all route points
      const lats = route.map(point => point.latitude);
      const lngs = route.map(point => point.longitude);
      
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      const deltaLat = (maxLat - minLat) * 1.2; // Add some padding
      const deltaLng = (maxLng - minLng) * 1.2;
      
      setRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: Math.max(deltaLat, 0.01),
        longitudeDelta: Math.max(deltaLng, 0.01),
      });
    } else if (startLocation) {
      setRegion(prev => ({
        ...prev,
        latitude: startLocation.latitude,
        longitude: startLocation.longitude,
      }));
    }
  }, [route, startLocation]);

  return (
    <View style={[styles.container, style]}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
      >
        {/* Route polyline */}
        {route.length > 1 && (
          <Polyline
            coordinates={route}
            strokeColor="#3B82F6"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        )}
        
        {/* Start marker */}
        {startLocation && (
          <Marker
            coordinate={startLocation}
            title="Start"
            pinColor="green"
          />
        )}
        
        {/* End marker */}
        {endLocation && (
          <Marker
            coordinate={endLocation}
            title="Finish"
            pinColor="red"
          />
        )}
        
        {/* Creature markers */}
        {creatures.map((creature) => (
          <Marker
            key={creature.id}
            coordinate={creature.location}
            title={creature.name}
            description={creature.found ? "Captured!" : "Available to catch"}
          >
            <View style={[
              styles.creatureMarker,
              { backgroundColor: creature.found ? '#10B981' : '#F59E0B' }
            ]}>
              <Text style={styles.creatureEmoji}>🎯</Text>
            </View>
          </Marker>
        ))}
      </MapView>
      
      {route.length === 0 && !startLocation && (
        <View style={styles.noDataOverlay}>
          <Text style={styles.noDataText}>No route data available</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  creatureMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  creatureEmoji: {
    fontSize: 14,
  },
  noDataOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  noDataText: {
    color: '#6B7280',
    fontSize: 16,
    fontStyle: 'italic',
  },
});
