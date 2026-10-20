"""``-w`` connection details have to survive whatever shape the OS hands back.

The local test server is always IPv4, but a real IPv6 socket reports a four
element ``(host, port, flowinfo, scope_id)`` address, which used to crash the
write-out step outright.
"""

from __future__ import annotations

import unittest

from curlike.diagnostics import Trace, _address, connection_summary


class AddressTests(unittest.TestCase):
    def test_ipv4_pair(self):
        self.assertEqual(_address(("10.0.0.1", 443)), ("10.0.0.1", 443))

    def test_ipv6_quad_is_reduced(self):
        self.assertEqual(_address(("::1", 8080, 0, 2)), ("::1", 8080))

    def test_junk_is_rejected(self):
        for value in (None, (), "1.2.3.4", 42, (1,)):
            self.assertIsNone(_address(value), value)


class ConnectionSummaryTests(unittest.TestCase):
    def test_ipv6_local_address_does_not_crash(self):
        trace = Trace()
        trace.local_address = ("fe80::1", 51234, 0, 0)
        trace.peer_address = ("2606:4700::1111", 443, 0, 0)

        summary = connection_summary(response=None, trace=trace)

        self.assertEqual(summary["local_ip"], "fe80::1")
        self.assertEqual(summary["local_port"], 51234)
        self.assertEqual(summary["remote_ip"], "2606:4700::1111")
        self.assertEqual(summary["remote_port"], 443)

    def test_missing_addresses_are_none_not_crashes(self):
        summary = connection_summary(response=None, trace=Trace())
        for key in ("local_ip", "local_port", "remote_ip", "remote_port"):
            self.assertIsNone(summary[key], key)


if __name__ == "__main__":
    unittest.main()
