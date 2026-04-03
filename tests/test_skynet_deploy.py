import json
import tempfile
import unittest
from pathlib import Path

from tools.skynet_deploy.cli.main import build_parser
from tools.skynet_deploy.deploy.registry import (
    _docker_info_has_insecure_registry,
    _probe_registry_from_local,
    registry_probe_url,
)
from tools.skynet_deploy.targets.config import load_targets, parse_target_selector
from tools.skynet_deploy.utils.errors import DeployError


class TargetConfigTests(unittest.TestCase):
    def test_load_targets_and_defaults(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            (repo_root / "infra").mkdir()
            payload = {
                "defaults": {
                    "source_path": ".",
                    "shared_paths": ["backend/.env"],
                    "health_check": {"url": "http://127.0.0.1:8000/api/health"},
                },
                "targets": {
                    "local": {
                        "deploy_path": ".skynet-deploy/local",
                        "connection": {"type": "local"},
                        "runtime": {"type": "docker", "compose_files": ["docker-compose.yml"]},
                    }
                },
            }
            (repo_root / "infra" / "targets.json").write_text(json.dumps(payload), encoding="utf-8")
            loaded = load_targets(repo_root)
            local = loaded["local"]
            self.assertEqual(local.connection.type, "local")
            self.assertEqual(local.health_check.url, "http://127.0.0.1:8000/api/health")
            self.assertIn("backend/.env", local.shared_paths)

    def test_selector_supports_all_and_csv(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            (repo_root / "infra").mkdir()
            payload = {
                "targets": {
                    "local": {
                        "deploy_path": "deploy/local",
                        "connection": {"type": "local"},
                        "runtime": {"type": "docker", "compose_files": ["docker-compose.yml"]},
                    },
                    "synology": {
                        "deploy_path": "/volume1/docker/skynet",
                        "connection": {"type": "ssh", "host": "nas", "user": "deploy"},
                        "runtime": {"type": "docker", "compose_files": ["docker-compose.yml"]},
                    },
                }
            }
            (repo_root / "infra" / "targets.json").write_text(json.dumps(payload), encoding="utf-8")
            loaded = load_targets(repo_root)
            self.assertEqual(len(parse_target_selector("all", loaded)), 2)
            self.assertEqual([item.name for item in parse_target_selector("local,synology", loaded)], ["local", "synology"])

    def test_registry_runtime_is_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            (repo_root / "infra").mkdir()
            (repo_root / "backend").mkdir()
            payload = {
                "targets": {
                    "synology": {
                        "deploy_path": "/volume1/docker/skynet",
                        "connection": {"type": "ssh", "host": "10.0.0.9", "user": "deploy"},
                        "runtime": {
                            "type": "docker",
                            "compose_files": ["docker-compose.yml"],
                            "registry": {
                                "url": "http://10.0.0.9:32769",
                                "namespace": "skynet",
                                "services": {
                                    "backend": {
                                        "repository": "backend",
                                        "context": "backend",
                                        "dockerfile": "Dockerfile",
                                    }
                                },
                            },
                        },
                    }
                }
            }
            (repo_root / "infra" / "targets.json").write_text(json.dumps(payload), encoding="utf-8")
            loaded = load_targets(repo_root)
            self.assertEqual(loaded["synology"].runtime["registry"]["url"], "http://10.0.0.9:32769")

    def test_smb_sync_config_is_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            (repo_root / "infra").mkdir()
            payload = {
                "targets": {
                    "synology": {
                        "deploy_path": "/volume1/docker/skynet",
                        "connection": {"type": "ssh", "host": "10.0.0.9", "user": "deploy"},
                        "sync": {
                            "type": "smb",
                            "uri": "smb://10.0.0.9/docker",
                            "username": "deploy",
                            "remote_root": "/volume1/docker",
                        },
                        "runtime": {"type": "docker", "compose_files": ["docker-compose.yml"]},
                    }
                }
            }
            (repo_root / "infra" / "targets.json").write_text(json.dumps(payload), encoding="utf-8")
            loaded = load_targets(repo_root)
            self.assertEqual(loaded["synology"].sync["type"], "smb")
            self.assertEqual(loaded["synology"].sync["remote_root"], "/volume1/docker")

    def test_prebuilt_runtime_is_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo_root = Path(tmp)
            (repo_root / "infra").mkdir()
            (repo_root / "backend").mkdir()
            payload = {
                "targets": {
                    "synology": {
                        "deploy_path": "/volume1/docker/skynet",
                        "connection": {"type": "ssh", "host": "10.0.0.9", "user": "deploy"},
                        "runtime": {
                            "type": "docker",
                            "compose_files": ["docker-compose.yml"],
                            "prebuilt_images": {
                                "namespace": "skynet",
                                "services": {
                                    "backend": {
                                        "repository": "backend",
                                        "context": "backend",
                                        "dockerfile": "Dockerfile",
                                    }
                                },
                            },
                        },
                    }
                }
            }
            (repo_root / "infra" / "targets.json").write_text(json.dumps(payload), encoding="utf-8")
            loaded = load_targets(repo_root)
            self.assertEqual(loaded["synology"].runtime["prebuilt_images"]["namespace"], "skynet")


class CliParserTests(unittest.TestCase):
    def test_rollback_release_flag(self):
        parser = build_parser()
        args = parser.parse_args(["rollback", "synology", "--release", "20260331123000"])
        self.assertEqual(args.command, "rollback")
        self.assertEqual(args.release, "20260331123000")


class RegistryHelpersTests(unittest.TestCase):
    def test_registry_probe_url_appends_v2(self):
        self.assertEqual(registry_probe_url("http://10.0.0.9:32768"), "http://10.0.0.9:32768/v2/")

    def test_probe_local_registry_reports_connection_error(self):
        with self.assertRaisesRegex(DeployError, "not reachable"):
            _probe_registry_from_local("http://127.0.0.1:9/v2/")

    def test_docker_info_detects_insecure_registry_host(self):
        sample = """
Insecure Registries:
  10.0.0.9:32768
  127.0.0.0/8
"""
        self.assertTrue(_docker_info_has_insecure_registry(sample, "10.0.0.9:32768"))
        self.assertFalse(_docker_info_has_insecure_registry(sample, "10.0.0.9:32769"))


if __name__ == "__main__":
    unittest.main()
