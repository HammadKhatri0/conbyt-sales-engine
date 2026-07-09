// lib/apollo.ts
// ⚠️ VERIFY BEFORE RELYING ON THIS: Apollo's API details below (endpoint,
// field names, request/response shape) are based on their documented
// people-search API as of my training data, NOT a live-tested call against
// your actual account. Apollo's API surface — and free-tier access to the
// search endpoint specifically — changes over time. Before running a real
// import, test one small search (e.g. per_page: 3) and inspect the raw
// response with a console.log, then adjust field mappings below if anything
// doesn't match. Two things in particular are worth confirming on your plan:
//
// 1. Whether /v1/mixed_people/search is available on your current tier at
//    all (Apollo has historically gated full people-search behind paid
//    plans, with free tiers limited to things like email verification).
// 2. Whether `email`/phone numbers come back directly in search results, or
//    whether they're locked/masked until a separate "reveal" call — which
//    typically consumes additional credits per contact. If fields come back
//    null or masked (e.g. "email_not_unlocked@domain.com"), that's Apollo's
//    reveal-gating, not a bug in this code.

const APOLLO_SEARCH_URL = "https://api.apollo.io/v1/mixed_people/search";

export interface ApolloSearchFilters {
  industries?: string[];
  jobTitles?: string[];
  excludeJobTitles?: string[];
  employeeCountMin?: number | null;
  employeeCountMax?: number | null;
  geographyCountry?: string | null;
  geographyRegion?: string | null;
  page?: number;
  perPage?: number;
}

export interface ApolloPersonResult {
  apolloId: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  industry: string | null;
  employeeCount: number | null;
  location: string | null;
  jobTitle: string | null;
  seniorityLevel: string | null;
  website: string | null;
}

export interface ApolloSearchResponse {
  people: ApolloPersonResult[];
  page: number;
  totalPages: number;
  totalEntries: number;
}

// Apollo buckets employee count into predefined ranges rather than accepting
// a raw min/max. This is a best-effort mapping — confirm against Apollo's
// actual accepted range strings in their docs/UI before trusting it fully.
function buildEmployeeRanges(min?: number | null, max?: number | null): string[] {
  if (min == null && max == null) return [];
  const lo = min ?? 1;
  const hi = max ?? 10000;
  return [`${lo},${hi}`];
}

export async function searchApolloPeople(
  apiKey: string,
  filters: ApolloSearchFilters
): Promise<ApolloSearchResponse> {
  const body: Record<string, any> = {
    page: filters.page ?? 1,
    per_page: filters.perPage ?? 25,
  };

  if (filters.industries?.length) {
    body.q_organization_keyword_tags = filters.industries;
  }
  if (filters.jobTitles?.length) {
    body.person_titles = filters.jobTitles;
  }
  if (filters.geographyCountry || filters.geographyRegion) {
    body.person_locations = [filters.geographyRegion, filters.geographyCountry].filter(Boolean);
  }
  const employeeRanges = buildEmployeeRanges(filters.employeeCountMin, filters.employeeCountMax);
  if (employeeRanges.length) {
    body.organization_num_employees_ranges = employeeRanges;
  }

  const res = await fetch(APOLLO_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Apollo search failed (${res.status}): ${errText || res.statusText}`);
  }

  const data = await res.json();

  const people: ApolloPersonResult[] = (data.people ?? []).map((p: any) => ({
    apolloId: p.id,
    name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(" "),
    email: p.email && !p.email.includes("not_unlocked") ? p.email : null,
    phone: p.phone_numbers?.[0]?.sanitized_number ?? p.phone_numbers?.[0]?.raw_number ?? null,
    company: p.organization?.name ?? null,
    industry: p.organization?.industry ?? null,
    employeeCount: p.organization?.estimated_num_employees ?? null,
    location: [p.city, p.state, p.country].filter(Boolean).join(", ") || null,
    jobTitle: p.title ?? null,
    seniorityLevel: p.seniority ?? null,
    website: p.organization?.website_url ?? null,
  }));

  return {
    people,
    page: data.pagination?.page ?? 1,
    totalPages: data.pagination?.total_pages ?? 1,
    totalEntries: data.pagination?.total_entries ?? people.length,
  };
}