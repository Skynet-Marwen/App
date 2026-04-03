"""Deployment-specific exception types."""


class DeployError(RuntimeError):
    """Raised when a deployment step cannot complete safely."""
