import { Platform, View, StyleSheet, ScrollView, Image } from 'react-native';
import { Redirect, Link } from 'expo-router';
import { Text } from '@/components/Themed';

export default function Index() {
  // On mobile, redirect to home tab
  if (Platform.OS !== 'web') {
    return <Redirect href="/home" />;
  }
  
  // On web, show QuestFit landing page
  return (
    <ScrollView style={styles.container}>
      {/* Hero Section */}
      <View style={styles.hero}>
        <Image 
          source={require('@/assets/images/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>QuestFit</Text>
        <Text style={styles.tagline}>Transform Your Workouts Into Epic Adventures</Text>
        <Text style={styles.description}>
          Turn every workout into an exciting quest. Capture mythical creatures, 
          level up your character, and unlock epic rewards as you get fit.
        </Text>
        <Link href="/(tabs)/home" style={styles.ctaButton}>
          <Text style={styles.ctaText}>Get Started →</Text>
        </Link>
      </View>

      {/* Features Section */}
      <View style={styles.features}>
        <Text style={styles.sectionTitle}>Features</Text>
        
        <View style={styles.featureGrid}>
          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🏃</Text>
            <Text style={styles.featureTitle}>Live Workout Tracking</Text>
            <Text style={styles.featureDescription}>
              Connect your Polar heart rate monitor for real-time workout tracking
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🐉</Text>
            <Text style={styles.featureTitle}>Capture Creatures</Text>
            <Text style={styles.featureDescription}>
              Unlock mythical creatures based on your workout intensity and type
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>⭐</Text>
            <Text style={styles.featureTitle}>Gain Experience</Text>
            <Text style={styles.featureDescription}>
              Level up your profile and unlock new challenges as you work out
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>🎯</Text>
            <Text style={styles.featureTitle}>Complete Quests</Text>
            <Text style={styles.featureDescription}>
              Take on fitness challenges and earn exclusive rewards
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>📊</Text>
            <Text style={styles.featureTitle}>Track Progress</Text>
            <Text style={styles.featureDescription}>
              Monitor your fitness journey with detailed stats and achievements
            </Text>
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.featureIcon}>👥</Text>
            <Text style={styles.featureTitle}>Multi-Device Support</Text>
            <Text style={styles.featureDescription}>
              Instructor dashboard for managing group workouts and classes
            </Text>
          </View>
        </View>
      </View>

      {/* How It Works Section */}
      <View style={styles.howItWorks}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        
        <View style={styles.stepContainer}>
          <View style={styles.step}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepTitle}>Sign In</Text>
            <Text style={styles.stepDescription}>Create your account and set up your profile</Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepTitle}>Connect Device</Text>
            <Text style={styles.stepDescription}>Link your Polar heart rate monitor via Bluetooth</Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepTitle}>Start Working Out</Text>
            <Text style={styles.stepDescription}>Choose your workout type and begin your adventure</Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepTitle}>Unlock Rewards</Text>
            <Text style={styles.stepDescription}>Capture creatures and gain XP as you exercise</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2025 QuestFit. Transform your fitness journey.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  hero: {
    alignItems: 'center',
    padding: 60,
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
    borderRadius: 60,
  },
  title: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  tagline: {
    fontSize: 28,
    color: '#3B82F6',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 600,
    marginBottom: 32,
    lineHeight: 28,
  },
  ctaButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  features: {
    padding: 60,
    backgroundColor: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 48,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
  },
  featureCard: {
    width: 300,
    backgroundColor: '#FFFFFF',
    padding: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  featureIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
  howItWorks: {
    padding: 60,
    backgroundColor: '#FFFFFF',
  },
  stepContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 32,
  },
  step: {
    width: 250,
    alignItems: 'center',
  },
  stepNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    padding: 40,
    backgroundColor: '#1F2937',
    alignItems: 'center',
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
});
