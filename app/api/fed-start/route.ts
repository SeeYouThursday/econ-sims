import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const FRED_API_KEY = process.env.FRED_API_KEY;
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const DEFAULT_PAYLOAD = {
  inflation: 2.0,
  unemployment: 5.0,
  interestRate: 4.0,
  source: 'fallback',
  asOf: 'N/A',
};
const FRESH_TTL_MS = 60 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

type FedStartPayload = {
  inflation: number;
  unemployment: number;
  interestRate: number;
  source: string;
  asOf: string;
};

type CacheEntry = {
  payload: FedStartPayload;
  fetchedAt: number;
};

type FedStartCacheState = {
  entry: CacheEntry | null;
  inFlight: Promise<FedStartPayload> | null;
};

declare global {
  var __fedStartCacheState: FedStartCacheState | undefined;
}

function getCacheState(): FedStartCacheState {
  if (!globalThis.__fedStartCacheState) {
    globalThis.__fedStartCacheState = {
      entry: null,
      inFlight: null,
    };
  }

  return globalThis.__fedStartCacheState;
}

function buildJsonResponse(payload: FedStartPayload, cacheControl: string) {
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': cacheControl,
    },
  });
}

function buildUrl(seriesId: string, limit = 13) {
  const url = new URL(FRED_BASE);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', FRED_API_KEY ?? '');
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('sort_order', 'desc');
  url.searchParams.set('limit', String(limit));
  return url.toString();
}

async function fetchFredSeries(seriesId: string) {
  const response = await fetch(buildUrl(seriesId));
  if (!response.ok) {
    throw new Error(`FRED request failed for ${seriesId}: ${response.status}`);
  }
  const json = await response.json();
  return json;
}

function parseLatestObservation(result: any) {
  if (
    !Array.isArray(result?.observations) ||
    result.observations.length === 0
  ) {
    throw new Error('Missing observations from FRED.');
  }

  const latest = result.observations[0];
  const previous = result.observations.find(
    (item: any) => item.value !== '.' && item.value !== '',
  );

  if (!latest || latest.value === '.' || latest.value === '') {
    throw new Error('Latest FRED observation is invalid.');
  }

  return {
    latestValue: Number(latest.value),
    latestDate: latest.date,
    previousValue: Number(previous?.value ?? latest.value),
  };
}

async function getInflationRate() {
  const series = await fetchFredSeries('CPIAUCSL');
  const observations = Array.isArray(series.observations)
    ? series.observations
    : [];
  if (observations.length < 13) {
    throw new Error('Not enough CPI observations.');
  }

  const latest = observations[0];
  const priorYear = observations[12];

  if (!latest || !priorYear) {
    throw new Error('Missing CPI observations for inflation calculation.');
  }

  const latestValue = Number(latest.value);
  const priorValue = Number(priorYear.value);

  if (
    Number.isNaN(latestValue) ||
    Number.isNaN(priorValue) ||
    priorValue === 0
  ) {
    throw new Error('Invalid CPI values.');
  }

  return {
    inflation: Number(((latestValue / priorValue - 1) * 100).toFixed(2)),
    asOf: latest.date,
  };
}

async function getUnemploymentRate() {
  const series = await fetchFredSeries('UNRATE');
  const { latestValue, latestDate } = parseLatestObservation(series);

  return {
    unemployment: Number(latestValue.toFixed(2)),
    asOf: latestDate,
  };
}

async function getInterestRate() {
  const series = await fetchFredSeries('FEDFUNDS');
  const { latestValue, latestDate } = parseLatestObservation(series);

  return {
    interestRate: Number(latestValue.toFixed(2)),
    asOf: latestDate,
  };
}

async function fetchLivePayload(): Promise<FedStartPayload> {
  const [inflationResult, unemploymentResult, interestResult] =
    await Promise.all([
      getInflationRate(),
      getUnemploymentRate(),
      getInterestRate(),
    ]);

  return {
    inflation: inflationResult.inflation,
    unemployment: unemploymentResult.unemployment,
    interestRate: interestResult.interestRate,
    source: 'FRED',
    asOf: `${inflationResult.asOf} / ${unemploymentResult.asOf} / ${interestResult.asOf}`,
  };
}

export async function GET() {
  const cacheState = getCacheState();
  const now = Date.now();
  const cached = cacheState.entry;

  if (cached && now - cached.fetchedAt <= FRESH_TTL_MS) {
    return buildJsonResponse(
      cached.payload,
      'public, s-maxage=3600, stale-while-revalidate=600',
    );
  }

  if (cacheState.inFlight) {
    try {
      const payload = await cacheState.inFlight;
      return buildJsonResponse(
        payload,
        'public, s-maxage=3600, stale-while-revalidate=600',
      );
    } catch {
      if (cached && now - cached.fetchedAt <= STALE_TTL_MS) {
        return buildJsonResponse(
          {
            ...cached.payload,
            source: `${cached.payload.source} (stale)`,
          },
          'public, s-maxage=300, stale-while-revalidate=3600',
        );
      }
    }
  }

  if (!FRED_API_KEY) {
    if (cached && now - cached.fetchedAt <= STALE_TTL_MS) {
      return buildJsonResponse(
        {
          ...cached.payload,
          source: `${cached.payload.source} (stale: missing FRED_API_KEY)`,
        },
        'public, s-maxage=300, stale-while-revalidate=3600',
      );
    }

    return buildJsonResponse(
      {
        ...DEFAULT_PAYLOAD,
        source: 'fallback (missing FRED_API_KEY)',
      },
      'public, s-maxage=3600, stale-while-revalidate=600',
    );
  }

  try {
    cacheState.inFlight = fetchLivePayload();
    const payload = await cacheState.inFlight;
    cacheState.entry = {
      payload,
      fetchedAt: Date.now(),
    };

    return buildJsonResponse(
      payload,
      'public, s-maxage=3600, stale-while-revalidate=600',
    );
  } catch (error) {
    if (cached && now - cached.fetchedAt <= STALE_TTL_MS) {
      return buildJsonResponse(
        {
          ...cached.payload,
          source: `${cached.payload.source} (stale: FRED error)`,
        },
        'public, s-maxage=300, stale-while-revalidate=3600',
      );
    }

    return buildJsonResponse(
      {
        ...DEFAULT_PAYLOAD,
        source: 'fallback (FRED error)',
        asOf: 'N/A',
      },
      'public, s-maxage=600, stale-while-revalidate=600',
    );
  } finally {
    cacheState.inFlight = null;
  }
}
