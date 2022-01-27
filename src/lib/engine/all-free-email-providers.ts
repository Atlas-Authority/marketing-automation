import { emailBurnerList } from "burner-email-providers";
import allEmailProviders from "email-providers";

/** A set of domains that host multiple unrelated email addresses */
export function deriveMultiProviderDomainsSet(freeDomains: readonly string[]) {
  return new Set([
    ...emailBurnerList,
    ...allEmailProviders,
    ...freeDomains,
  ].map(d => d.toLowerCase()));
}
