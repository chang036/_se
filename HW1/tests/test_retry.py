from __future__ import annotations

import unittest

import httpx

from curlike.retry import RetryPolicy, parse_retry_after


class ShouldRetryTests(unittest.TestCase):
    def test_disabled_by_default(self):
        policy = RetryPolicy()
        self.assertFalse(policy.enabled)
        self.assertFalse(policy.should_retry(1, status=503))

    def test_retryable_status(self):
        policy = RetryPolicy(retries=2)
        self.assertTrue(policy.should_retry(1, status=503))
        self.assertTrue(policy.should_retry(2, status=429))

    def test_client_error_is_not_retried(self):
        policy = RetryPolicy(retries=2)
        self.assertFalse(policy.should_retry(1, status=404))
        self.assertFalse(policy.should_retry(1, status=200))

    def test_redirect_is_not_retried(self):
        policy = RetryPolicy(retries=2)
        self.assertFalse(policy.should_retry(1, status=302))

    def test_budget_exhausted(self):
        policy = RetryPolicy(retries=2)
        self.assertFalse(policy.should_retry(3, status=503))

    def test_max_time_stops_early(self):
        policy = RetryPolicy(retries=5, max_time=1.0)
        self.assertFalse(policy.should_retry(1, status=503, elapsed=1.5))

    def test_transient_error_is_retried(self):
        policy = RetryPolicy(retries=2)
        self.assertTrue(policy.should_retry(1, error=httpx.ConnectError("boom")))

    def test_timeout_is_retried(self):
        policy = RetryPolicy(retries=2)
        self.assertTrue(policy.should_retry(1, error=httpx.ReadTimeout("slow")))

    def test_unsupported_protocol_is_never_retried(self):
        policy = RetryPolicy(retries=2, all_errors=True)
        self.assertFalse(policy.should_retry(1, error=httpx.UnsupportedProtocol("ftp")))

    def test_non_transport_error_needs_all_errors(self):
        policy = RetryPolicy(retries=2)
        self.assertFalse(policy.should_retry(1, error=ValueError("nope")))
        self.assertTrue(RetryPolicy(retries=2, all_errors=True).should_retry(1, error=ValueError("x")))

    def test_max_time_stops_early(self):
        policy = RetryPolicy(retries=5, max_time=1.0)
        self.assertFalse(policy.should_retry(1, status=503, elapsed=1.5))
        self.assertTrue(policy.should_retry(1, status=503, elapsed=0.5))


class DelayTests(unittest.TestCase):
    def test_exponential_by_default(self):
        policy = RetryPolicy(retries=3)
        self.assertEqual(policy.delay_for(1), 1.0)
        self.assertEqual(policy.delay_for(2), 2.0)
        self.assertEqual(policy.delay_for(3), 4.0)

    def test_zero_delay_means_exponential(self):
        self.assertEqual(RetryPolicy(retries=1, delay=0.0).delay_for(1), 1.0)

    def test_fixed_delay(self):
        self.assertEqual(RetryPolicy(retries=3, delay=0.25).delay_for(1), 0.25)

    def test_retry_after_header_wins(self):
        response = httpx.Response(503, headers={"Retry-After": "5"})
        self.assertEqual(RetryPolicy(retries=1).delay_for(1, response), 5.0)

    def test_retry_after_is_capped(self):
        response = httpx.Response(503, headers={"Retry-After": "600"})
        self.assertEqual(RetryPolicy(retries=1).delay_for(1, response), 60.0)


class RetryAfterTests(unittest.TestCase):
    def test_seconds(self):
        self.assertEqual(parse_retry_after("30"), 30.0)

    def test_negative_clamped(self):
        self.assertEqual(parse_retry_after("-5"), 0.0)

    def test_http_date_in_the_past(self):
        self.assertEqual(parse_retry_after("Wed, 21 Oct 2015 07:28:00 GMT"), 0.0)

    def test_garbage(self):
        self.assertIsNone(parse_retry_after("soon"))
        self.assertIsNone(parse_retry_after(None))


if __name__ == "__main__":
    unittest.main()