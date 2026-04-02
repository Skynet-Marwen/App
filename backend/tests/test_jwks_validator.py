import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from jose import ExpiredSignatureError, JWTError

from app.services import jwks_validator


class JwksValidatorTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        jwks_validator._cache["providers"] = {}

    async def test_get_keys_returns_cached_keys_when_ttl_is_fresh(self):
        jwks_validator._cache["providers"]["https://idp.example/jwks"] = {
            "keys": [{"kid": "cached"}],
            "fetched_at": 100.0,
        }
        cfg = {"jwks_url": "https://idp.example/jwks", "cache_ttl": 300}

        with patch("app.services.jwks_validator.time.time", return_value=250.0), \
             patch("app.services.jwks_validator._fetch_jwks", new=AsyncMock()) as fetch_mock:
            keys = await jwks_validator._get_keys(cfg)

        self.assertEqual(keys, [{"kid": "cached"}])
        fetch_mock.assert_not_awaited()

    async def test_get_keys_uses_grace_period_when_idp_is_temporarily_unreachable(self):
        jwks_validator._cache["providers"]["https://idp.example/jwks"] = {
            "keys": [{"kid": "cached"}],
            "fetched_at": 100.0,
        }
        cfg = {"jwks_url": "https://idp.example/jwks", "cache_ttl": 300}

        with patch("app.services.jwks_validator.time.time", return_value=650.0), \
             patch("app.services.jwks_validator._fetch_jwks", new=AsyncMock(side_effect=RuntimeError("offline"))):
            keys = await jwks_validator._get_keys(cfg)

        self.assertEqual(keys, [{"kid": "cached"}])

    async def test_get_keys_raises_when_cache_is_expired_and_fetch_fails(self):
        cfg = {"jwks_url": "https://idp.example/jwks", "cache_ttl": 300}

        with patch("app.services.jwks_validator.time.time", return_value=1000.0), \
             patch("app.services.jwks_validator._fetch_jwks", new=AsyncMock(side_effect=RuntimeError("offline"))):
            with self.assertRaises(HTTPException) as ctx:
                await jwks_validator._get_keys(cfg)

        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.detail["code"], "IDP_UNAVAILABLE")

    async def test_validate_external_token_returns_claims_after_skipping_invalid_key(self):
        cfg = {
            "name": "google",
            "enabled": True,
            "jwks_url": "https://idp.example/jwks",
            "issuer": "https://issuer.example",
            "audience": "skynet-app",
            "cache_ttl": 300,
        }
        keys = [{"kid": "bad"}, {"kid": "good"}]
        claims = {"sub": "external-user", "iss": "https://issuer.example", "aud": "skynet-app"}

        with patch("app.services.jwks_validator._provider_candidates", return_value=[cfg]), \
             patch("app.services.jwks_validator._get_keys", new=AsyncMock(return_value=keys)), \
             patch(
                 "app.services.jwks_validator.jwt.decode",
                 side_effect=[JWTError("bad key"), claims],
            ) as decode_mock:
            result = await jwks_validator.validate_external_token("token")

        self.assertEqual(result["sub"], claims["sub"])
        self.assertEqual(result["__skynet_id_provider"], "google")
        self.assertEqual(decode_mock.call_count, 2)

    async def test_validate_external_token_rejects_disabled_configuration(self):
        with patch(
            "app.services.jwks_validator._provider_candidates",
            side_effect=HTTPException(status_code=400, detail={"code": "IDP_NOT_CONFIGURED"}),
        ):
            with self.assertRaises(HTTPException) as ctx:
                await jwks_validator.validate_external_token("token")

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail["code"], "IDP_NOT_CONFIGURED")

    async def test_validate_external_token_maps_expired_and_invalid_tokens(self):
        cfg = {
            "name": "keycloak",
            "enabled": True,
            "jwks_url": "https://idp.example/jwks",
            "issuer": "https://issuer.example",
            "audience": "",
            "cache_ttl": 300,
        }

        with patch("app.services.jwks_validator._provider_candidates", return_value=[cfg]), \
             patch("app.services.jwks_validator._get_keys", new=AsyncMock(return_value=[{"kid": "only"}])), \
             patch("app.services.jwks_validator.jwt.decode", side_effect=ExpiredSignatureError("expired")):
            with self.assertRaises(HTTPException) as expired_ctx:
                await jwks_validator.validate_external_token("expired-token")

        self.assertEqual(expired_ctx.exception.status_code, 401)
        self.assertEqual(expired_ctx.exception.detail["code"], "TOKEN_EXPIRED")

        with patch("app.services.jwks_validator._provider_candidates", return_value=[cfg]), \
             patch("app.services.jwks_validator._get_keys", new=AsyncMock(return_value=[{"kid": "only"}])), \
             patch("app.services.jwks_validator.jwt.decode", side_effect=JWTError("bad token")):
            with self.assertRaises(HTTPException) as invalid_ctx:
                await jwks_validator.validate_external_token("bad-token")

        self.assertEqual(invalid_ctx.exception.status_code, 401)
        self.assertEqual(invalid_ctx.exception.detail["code"], "TOKEN_INVALID")

    def test_provider_candidates_match_unverified_issuer(self):
        providers = [
            {"name": "google", "enabled": True, "jwks_url": "https://google/jwks", "issuer": "https://accounts.google.com", "audience": "", "cache_ttl": 300},
            {"name": "github", "enabled": True, "jwks_url": "https://github/jwks", "issuer": "https://github.com/login/oauth", "audience": "", "cache_ttl": 300},
        ]
        with patch("app.services.jwks_validator._settings_idp_providers", return_value=providers), \
             patch("app.services.jwks_validator.jwt.get_unverified_claims", return_value={"iss": "https://github.com/login/oauth"}):
            candidates = jwks_validator._provider_candidates("token")

        self.assertEqual([item["name"] for item in candidates], ["github"])

    def test_provider_candidates_honor_explicit_provider_hint(self):
        providers = [
            {"name": "google", "enabled": True, "jwks_url": "https://google/jwks", "issuer": "", "audience": "", "cache_ttl": 300},
            {"name": "github", "enabled": True, "jwks_url": "https://github/jwks", "issuer": "", "audience": "", "cache_ttl": 300},
        ]
        with patch("app.services.jwks_validator._settings_idp_providers", return_value=providers):
            candidates = jwks_validator._provider_candidates("token", provider_hint="google")

        self.assertEqual([item["name"] for item in candidates], ["google"])

    def test_extract_bearer_requires_bearer_prefix(self):
        self.assertEqual(jwks_validator.extract_bearer("Bearer abc.def"), "abc.def")

        with self.assertRaises(HTTPException) as ctx:
            jwks_validator.extract_bearer("Token abc.def")

        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail["code"], "MISSING_TOKEN")


if __name__ == "__main__":
    unittest.main()
