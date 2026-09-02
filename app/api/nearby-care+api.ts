type NearbyCareRequest = {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
  error?: {
    message?: string;
  };
};

type GooglePlace = {
  displayName?: {
    text?: string;
  };
  formattedAddress?: string;
  googleMapsUri?: string;
  id?: string;
  location?: {
    latitude?: number;
    longitude?: number;
  };
  nationalPhoneNumber?: string;
  primaryType?: string;
  rating?: number;
  regularOpeningHours?: {
    openNow?: boolean;
  };
  types?: string[];
  userRatingCount?: number;
  websiteUri?: string;
};

const CARE_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.googleMapsUri',
  'places.location',
  'places.nationalPhoneNumber',
  'places.primaryType',
  'places.rating',
  'places.regularOpeningHours.openNow',
  'places.types',
  'places.userRatingCount',
  'places.websiteUri',
].join(',');

const CARE_DAILY_REQUEST_LIMIT = 40;
const CARE_MIN_REQUEST_INTERVAL_MS = 30_000;
const rateLimits = new Map<string, { count: number; resetAt: number; updatedAt: number }>();

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(request);

    if (!rateLimit.allowed) {
      return Response.json(
        { error: rateLimit.message },
        {
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.retryAfterMs / 1000)),
          },
          status: 429,
        }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

    if (!apiKey) {
      return Response.json({ error: 'Google Maps API key is not configured.' }, { status: 500 });
    }

    const body = (await request.json()) as NearbyCareRequest;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const radiusMeters = clampRadius(body.radiusMeters);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return Response.json({ error: 'Send latitude and longitude.' }, { status: 400 });
    }

    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return Response.json({ error: 'Location coordinates are out of range.' }, { status: 400 });
    }

    const [hospitals, diabetesCare] = await Promise.all([
      searchNearby(apiKey, latitude, longitude, radiusMeters),
      searchText(apiKey, latitude, longitude, radiusMeters),
    ]);
    const places = dedupePlaces([...hospitals, ...diabetesCare])
      .filter(isRelevantCarePlace)
      .map((place) => ({
        address: place.formattedAddress ?? null,
        distanceMeters: getDistanceMeters(latitude, longitude, place.location?.latitude, place.location?.longitude),
        mapsUrl:
          place.googleMapsUri ??
          buildMapsSearchUrl(place.displayName?.text, place.formattedAddress),
        name: place.displayName?.text ?? 'Nearby care option',
        openNow: place.regularOpeningHours?.openNow ?? null,
        phone: place.nationalPhoneNumber ?? null,
        rating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        types: place.types ?? [],
        website: place.websiteUri ?? null,
      }))
      .sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 8);

    return Response.json({ places });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Could not find nearby care right now.' },
      { status: 500 }
    );
  }
}

function checkRateLimit(request: Request) {
  const now = Date.now();
  const clientId = getClientId(request);
  const existing = rateLimits.get(clientId);
  const current =
    existing && existing.resetAt > now
      ? existing
      : {
          count: 0,
          resetAt: now + 24 * 60 * 60 * 1000,
          updatedAt: 0,
        };
  const cooldownRemaining = CARE_MIN_REQUEST_INTERVAL_MS - (now - current.updatedAt);

  if (cooldownRemaining > 0) {
    return {
      allowed: false,
      message: 'Please wait a few seconds before searching nearby care again.',
      retryAfterMs: cooldownRemaining,
    };
  }

  if (current.count >= CARE_DAILY_REQUEST_LIMIT) {
    return {
      allowed: false,
      message: 'Nearby care search limit reached for today. Try again tomorrow.',
      retryAfterMs: current.resetAt - now,
    };
  }

  rateLimits.set(clientId, {
    count: current.count + 1,
    resetAt: current.resetAt,
    updatedAt: now,
  });

  cleanupRateLimits(now);

  return { allowed: true, message: '', retryAfterMs: 0 };
}

function getClientId(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();

  return forwardedFor || realIp || 'unknown-client';
}

function cleanupRateLimits(now: number) {
  if (rateLimits.size < 1000) {
    return;
  }

  for (const [key, value] of rateLimits) {
    if (value.resetAt <= now) {
      rateLimits.delete(key);
    }
  }
}

async function searchNearby(apiKey: string, latitude: number, longitude: number, radiusMeters: number) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    body: JSON.stringify({
      includedTypes: ['hospital'],
      excludedTypes: ['dentist', 'dental_clinic', 'veterinary_care'],
      excludedPrimaryTypes: ['dentist', 'dental_clinic', 'veterinary_care'],
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters,
        },
      },
      maxResultCount: 8,
      rankPreference: 'DISTANCE',
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': CARE_FIELD_MASK,
    },
    method: 'POST',
  });

  const data = (await response.json()) as GooglePlacesResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Google Places nearby search failed.');
  }

  return data.places ?? [];
}

async function searchText(apiKey: string, latitude: number, longitude: number, radiusMeters: number) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    body: JSON.stringify({
      locationBias: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters,
        },
      },
      maxResultCount: 8,
      textQuery: 'endocrinologist diabetes clinic diabetes doctor urgent care hospital',
    }),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': CARE_FIELD_MASK,
    },
    method: 'POST',
  });

  const data = (await response.json()) as GooglePlacesResponse;

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Google Places text search failed.');
  }

  return data.places ?? [];
}

function isRelevantCarePlace(place: GooglePlace) {
  const searchableText = [place.displayName?.text, place.formattedAddress, place.primaryType, ...(place.types ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(dental|dentist|orthodont|veterinary|vet clinic|animal hospital|beauty|spa|cosmetic)\b/.test(searchableText)) {
    return false;
  }

  return /\b(hospital|doctor|clinic|medical|urgent|endocrinologist|diabetes|health|healthcare)\b/.test(searchableText);
}

function clampRadius(radiusMeters: number | undefined) {
  const fallback = 10000;

  if (!Number.isFinite(radiusMeters)) {
    return fallback;
  }

  return Math.min(Math.max(Number(radiusMeters), 1000), 50000);
}

function dedupePlaces(places: GooglePlace[]) {
  const seen = new Set<string>();
  const deduped: GooglePlace[] = [];

  for (const place of places) {
    const key = place.id ?? `${place.displayName?.text ?? ''}|${place.formattedAddress ?? ''}`.toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(place);
  }

  return deduped;
}

function getDistanceMeters(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number | undefined,
  toLongitude: number | undefined
) {
  if (!Number.isFinite(toLatitude) || !Number.isFinite(toLongitude)) {
    return null;
  }

  const earthRadiusMeters = 6371000;
  const dLat = toRadians(Number(toLatitude) - fromLatitude);
  const dLng = toRadians(Number(toLongitude) - fromLongitude);
  const lat1 = toRadians(fromLatitude);
  const lat2 = toRadians(Number(toLatitude));
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(earthRadiusMeters * c);
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function buildMapsSearchUrl(name: string | undefined, address: string | undefined) {
  const query = [name, address].filter(Boolean).join(' ');

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'hospital')}`;
}
