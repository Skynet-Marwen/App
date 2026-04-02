import tempfile
import unittest
from pathlib import Path

from app.services import https_assets


class HttpsAssetsTests(unittest.TestCase):
    def test_generate_self_signed_certificate_writes_pem_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            original = https_assets.cert_root
            https_assets.cert_root = lambda: root
            try:
                status = https_assets.generate_self_signed_certificate("localhost", 30)
                cert_text = (root / "self-signed" / "cert.pem").read_text(encoding="utf-8")
                key_text = (root / "self-signed" / "key.pem").read_text(encoding="utf-8")
            finally:
                https_assets.cert_root = original

        self.assertTrue(status["ready"])
        self.assertIn("BEGIN CERTIFICATE", cert_text)
        self.assertIn("BEGIN RSA PRIVATE KEY", key_text)

    def test_generate_self_signed_certificate_rejects_invalid_common_name(self):
        with self.assertRaisesRegex(ValueError, "Common name"):
            https_assets.generate_self_signed_certificate("bad host", 30)


if __name__ == "__main__":
    unittest.main()
