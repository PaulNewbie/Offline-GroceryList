// src/utils/notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermission = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

/**
 * Schedule a local push notification for a trip.
 * Fires 1 hour before the scheduled time.
 * Returns the notification identifier so we can cancel it later.
 */
export const scheduleTripNotification = async (
  tripId:      number,
  tripName:    string,
  scheduledAt: string,   // ISO string
): Promise<string | null> => {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const triggerDate = new Date(new Date(scheduledAt).getTime() - 60 * 60 * 1000);
    if (triggerDate <= new Date()) return null;  // already past

    // Cancel any existing notification for this trip first
    await cancelTripNotification(tripId);

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🛒 Grocery trip coming up',
        body:  `"${tripName}" is scheduled in 1 hour.`,
        data:  { tripId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    // Persist the mapping so we can cancel later
    // We piggyback on a simple naming convention: `trip_notif_{tripId}`
    // stored as a scheduled notification identifier.
    // No AsyncStorage needed — expo-notifications persists across restarts.
    return identifier;
  } catch (e) {
    console.error('[Notif] scheduleTripNotification:', e);
    return null;
  }
};

/**
 * Cancel all scheduled notifications for a trip.
 * Call when the trip is deleted or rescheduled.
 */
export const cancelTripNotification = async (tripId: number): Promise<void> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter(n => n.content.data?.tripId === tripId);
    await Promise.all(ours.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch (e) {
    console.warn('[Notif] cancelTripNotification:', e);
  }
};