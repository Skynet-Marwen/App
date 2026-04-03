"""Command line interface for SKYNET deployment operations."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

from tools.skynet_deploy.deploy.engine import DeploymentEngine
from tools.skynet_deploy.targets.config import load_targets, parse_target_selector
from tools.skynet_deploy.utils.errors import DeployError
from tools.skynet_deploy.utils.logging import ConsoleLogger


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="skynet", description="SKYNET deployment CLI")
    parser.add_argument("--config", type=Path, help="Path to targets.json")
    parser.add_argument("--dry-run", action="store_true", help="Print steps without changing anything")
    parser.add_argument("--quiet", action="store_true", help="Reduce command echoing")
    subparsers = parser.add_subparsers(dest="command", required=True)

    deploy = subparsers.add_parser("deploy", help="Sync and deploy one or more targets")
    deploy.add_argument("target", help="Target name, comma-separated names, or 'all'")

    restart = subparsers.add_parser("restart", help="Restart the current release")
    restart.add_argument("target", help="Target name, comma-separated names, or 'all'")

    status = subparsers.add_parser("status", help="Show current release and runtime status")
    status.add_argument("target", help="Target name, comma-separated names, or 'all'")

    rollback = subparsers.add_parser("rollback", help="Roll back to the previous or selected release")
    rollback.add_argument("target", help="Target name, comma-separated names, or 'all'")
    rollback.add_argument("--release", help="Specific release id to restore")

    subparsers.add_parser("list-targets", help="List configured deployment targets")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    repo_root = Path(__file__).resolve().parents[3]
    logger = ConsoleLogger(verbose=not args.quiet)
    try:
        targets = load_targets(repo_root, args.config)
        if args.command == "list-targets":
            for name in sorted(targets):
                print(name)
            return 0
        selected = parse_target_selector(args.target, targets)
        for target in selected:
            engine = DeploymentEngine(target, logger, dry_run=args.dry_run)
            if args.command == "deploy":
                engine.deploy()
            elif args.command == "restart":
                engine.restart()
            elif args.command == "status":
                print(engine.status())
            elif args.command == "rollback":
                engine.rollback(release_id=args.release)
        return 0
    except DeployError as exc:
        logger.error(str(exc))
        return 1
    except KeyboardInterrupt:
        logger.warn("Interrupted by user")
        return 130


if __name__ == "__main__":
    sys.exit(main())
