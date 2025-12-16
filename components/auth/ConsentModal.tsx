import React, { useState } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/Themed';
import { consentModalStyles as styles } from '@/src/styles/components/consentModalStyles';

interface ConsentModalProps {
  visible: boolean;
  onConsent?: () => void;
  onDecline?: () => void;
  loading?: boolean;
  readOnly?: boolean;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  visible,
  onConsent,
  onDecline,
  loading = false,
  readOnly = false,
}) => {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  // Check if content fits on screen whenever dimensions change
  React.useEffect(() => {
    if (scrollViewHeight > 0 && contentHeight > 0) {
      // If content is smaller than scroll view (plus buffer), user has "seen" it all
      if (contentHeight <= scrollViewHeight + 50) {
        setScrolledToBottom(true);
      }
    }
  }, [scrollViewHeight, contentHeight]);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
    
    // Only update if we haven't reached bottom yet or if we scrolled back up (optional)
    // But for consent, usually once true stays true is fine, or dynamic is fine.
    // The existing logic was just setting it.
    if (isAtBottom) {
        setScrolledToBottom(true);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onDecline}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Data Consent Agreement</Text>
          <Text style={styles.headerSubtitle}>
            Please read and agree to continue with Polar integration
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.scrollContainer}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => setContentHeight(height)}
        >
          <View style={styles.content}>
            {/* Section 1 */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>1</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Purpose</Text>
                <Text style={styles.sectionText}>
                  By connecting your Polar account to this service, you agree that your activity
                  and wellness data may be used to provide feedback, monitoring, and support
                  within this platform.
                </Text>
              </View>
            </View>

            {/* Section 2 */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>2</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Who Can View Your Data</Text>
                <Text style={styles.sectionText}>
                  You understand and agree that your data can be accessed and viewed only by
                  authorised instructors and administrators within this system. These people are
                  approved by the organisation running this service.
                </Text>
              </View>
            </View>

            {/* Section 3 */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>3</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>How Your Data Will Be Handled</Text>
                <Text style={styles.sectionText}>
                  We will only use your data for purposes related to training, performance
                  monitoring, safety, or support. Your data will not be shared outside of this
                  platform or with anyone not authorised.
                </Text>
              </View>
            </View>

            {/* Section 4 */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>4</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Your Control</Text>
                <Text style={styles.sectionText}>
                  You may withdraw your consent at any time by disconnecting your Polar account.
                  If you withdraw consent, instructors and administrators will no longer receive
                  new data from your account.
                </Text>
              </View>
            </View>

            {/* Section 5 */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>5</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Security</Text>
                <Text style={styles.sectionText}>
                  We take reasonable steps to protect your data from unauthorised access and
                  limit access strictly to approved instructors and administrators.
                </Text>
              </View>
            </View>

            {/* Section 6 */}
            <View style={styles.section}>
              <Text style={styles.sectionNumber}>6</Text>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionTitle}>Your Responsibility</Text>
                <Text style={styles.sectionText}>
                  By agreeing, you confirm that the information you provide is accurate and that
                  you understand how your data will be used inside this service.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Scroll Indicator */}
        {!scrolledToBottom && (
          <View style={styles.scrollIndicator}>
            <Text style={styles.scrollIndicatorText}>Scroll to view full consent ↓</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.footer}>
          {!readOnly && (
            <Pressable
              style={[styles.button, styles.declineButton, loading && styles.buttonDisabled]}
              onPress={onDecline}
              disabled={loading}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </Pressable>
          )}

          <Pressable
            style={[
              styles.button,
              styles.acceptButton,
              (!readOnly && (!scrolledToBottom || loading)) && styles.buttonDisabled,
            ]}
            onPress={onConsent}
            disabled={!readOnly && (!scrolledToBottom || loading)}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptButtonText}>{readOnly ? "Close" : "I Agree & Accept"}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};
