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

export async function findNearbyCare() {
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    throw new Error('Location permission is needed to find nearby hospitals and clinicians.');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

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
