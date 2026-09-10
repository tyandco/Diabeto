import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type NearbyCarePlace = {
  address: string | null;
  distanceMeters: number | null;
  mapsUrl: string;
  name: string;
  openNow: boolean | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  website: string | null;
};

type NearbyCareResponse = {
  error?: string;
  places?: NearbyCarePlace[];
};

const LOCATION_ERROR =
  'Location is needed to find nearby hospitals and clinicians. Turn on location access for Diabeto and try again.';

export async function findNearbyCare() {
  const isLocationAvailable = await Location.hasServicesEnabledAsync().catch(() => false);

  if (!isLocationAvailable) {
    throw new Error(LOCATION_ERROR);
  }

  const permission = await Location.requestForegroundPermissionsAsync().catch(() => null);

  if (!permission?.granted) {
    throw new Error(LOCATION_ERROR);
  }

  const location =
    (await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,
      requiredAccuracy: 5000,
    }).catch(() => null)) ??
    (await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    }).catch(() => null));

  if (!location) {
    throw new Error('Could not read your current location. Check iOS Location Services and try again.');
  }

  const response = await fetch(getNearbyCareUrl(), {
    body: JSON.stringify({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      radiusMeters: 10000,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  const data = (await response.json()) as NearbyCareResponse;

  if (!response.ok) {
    throw new Error(data.error ?? 'Could not find nearby care right now.');
  }

  return data.places ?? [];
}

function getNearbyCareUrl() {
  if (Platform.OS === 'web') {
    return '/api/nearby-care';
  }

  const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;

  if (!siteUrl) {
    throw new Error('Add EXPO_PUBLIC_SITE_URL to use nearby care from the installed app.');
  }

  return `${siteUrl.replace(/\/$/, '')}/api/nearby-care`;
}
