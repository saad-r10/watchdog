// Skip the HaveIBeenPwned network call in all tests (slow, network-dependent)
process.env.SKIP_HIBP_CHECK = "true";
// Raise rate limits high enough that test suites don't self-throttle
process.env.RATE_LIMIT_AUTH_MAX = "500";
process.env.RATE_LIMIT_API_MAX = "500";
