"""Small console logger with step timing."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import time


RESET = "\033[0m"
BLUE = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
BOLD = "\033[1m"


@dataclass
class ConsoleLogger:
    """Structured, human-readable logging for deploy operations."""

    verbose: bool = True

    def _stamp(self) -> str:
        return datetime.now(timezone.utc).strftime("%H:%M:%S")

    def _emit(self, prefix: str, color: str, message: str) -> None:
        print(f"{color}[{self._stamp()}] {prefix:<7}{RESET} {message}")

    def info(self, message: str) -> None:
        self._emit("INFO", BLUE, message)

    def success(self, message: str) -> None:
        self._emit("OK", GREEN, message)

    def warn(self, message: str) -> None:
        self._emit("WARN", YELLOW, message)

    def error(self, message: str) -> None:
        self._emit("ERROR", RED, message)

    def command(self, message: str) -> None:
        if self.verbose:
            self._emit("CMD", BLUE, message)

    @contextmanager
    def step(self, title: str):
        started = time.monotonic()
        self.info(title)
        try:
            yield
        except Exception:
            elapsed = time.monotonic() - started
            self.error(f"{title} failed in {elapsed:.1f}s")
            raise
        elapsed = time.monotonic() - started
        self.success(f"{title} finished in {elapsed:.1f}s")

    def banner(self, title: str) -> None:
        line = "═" * max(24, len(title) + 6)
        print(f"{BOLD}{line}{RESET}")
        print(f"{BOLD}  {title}{RESET}")
        print(f"{BOLD}{line}{RESET}")
