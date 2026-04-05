import unittest

from app.api.routes.track import parse_user_agent


class TrackHelperTests(unittest.TestCase):
    def test_parse_user_agent_keeps_windows_touch_laptop_as_desktop(self):
        browser, os_name, device_type = parse_user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            screen="1920x1080",
            fingerprint_traits={
                "platform": "Win32",
                "touch_points": 10,
            },
        )

        self.assertIn("Chrome", browser or "")
        self.assertIn("Windows", os_name or "")
        self.assertEqual(device_type, "desktop")

    def test_parse_user_agent_detects_android_phone_as_mobile(self):
        _, os_name, device_type = parse_user_agent(
            "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
            screen="412x915",
            fingerprint_traits={
                "platform": "Linux armv8l",
                "touch_points": 5,
            },
        )

        self.assertIn("Android", os_name or "")
        self.assertEqual(device_type, "mobile")

    def test_parse_user_agent_uses_large_screen_to_prefer_desktop(self):
        _, _, device_type = parse_user_agent(
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            screen="2560x1440",
            fingerprint_traits={
                "platform": "Linux x86_64",
                "touch_points": 0,
            },
        )

        self.assertEqual(device_type, "desktop")

    def test_parse_user_agent_detects_android_webview_aarch64_as_mobile(self):
        _, os_name, device_type = parse_user_agent(
            "Mozilla/5.0 (Linux; Android 15; SM-G998B Build/AP3A.240905.015.A2; ) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.119 Mobile Safari/537.36",
            screen="412x915",
            fingerprint_traits={
                "platform": "Linux aarch64",
                "touch_points": 5,
            },
        )

        self.assertIn("Android", os_name or "")
        self.assertEqual(device_type, "mobile")

    def test_parse_user_agent_detects_facebook_android_webview_as_mobile(self):
        _, os_name, device_type = parse_user_agent(
            "Mozilla/5.0 (Linux; Android 15; SM-G998B Build/AP3A.240905.015.A2; wv) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.164 Mobile Safari/537.36 "
            "[FB_IAB/FB4A;FBAV/554.0.0.59.70;]",
            screen="412x915",
            fingerprint_traits={
                "platform": "Linux aarch64",
                "touch_points": 5,
            },
        )

        self.assertIn("Android", os_name or "")
        self.assertEqual(device_type, "mobile")


if __name__ == "__main__":
    unittest.main()
