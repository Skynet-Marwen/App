from sqlalchemy import and_, exists, or_, select

from ..models.anomaly_flag import AnomalyFlag
from ..models.device import Device
from ..models.incident import Incident
from ..models.user_profile import UserProfile
from ..models.visitor import Visitor


def active_incident_clause():
    """Keep incident queries scoped to incidents whose linked parents still exist."""
    return and_(
        or_(
            Incident.user_id.is_(None),
            exists(
                select(UserProfile.id).where(UserProfile.external_user_id == Incident.user_id)
            ),
        ),
        or_(
            Incident.device_id.is_(None),
            exists(select(Device.id).where(Device.id == Incident.device_id)),
        ),
    )


def orphan_incident_clause():
    return or_(
        and_(
            Incident.user_id.is_not(None),
            ~exists(
                select(UserProfile.id).where(UserProfile.external_user_id == Incident.user_id)
            ),
        ),
        and_(
            Incident.device_id.is_not(None),
            ~exists(select(Device.id).where(Device.id == Incident.device_id)),
        ),
    )


def active_anomaly_flag_clause():
    """Hide flags that point to visitors/devices already deleted."""
    return and_(
        or_(
            AnomalyFlag.external_user_id.is_(None),
            exists(
                select(UserProfile.id).where(
                    UserProfile.external_user_id == AnomalyFlag.external_user_id
                )
            ),
        ),
        or_(
            AnomalyFlag.related_device_id.is_(None),
            exists(select(Device.id).where(Device.id == AnomalyFlag.related_device_id)),
        ),
        or_(
            AnomalyFlag.related_visitor_id.is_(None),
            exists(select(Visitor.id).where(Visitor.id == AnomalyFlag.related_visitor_id)),
        ),
    )


def orphan_anomaly_flag_clause():
    return or_(
        and_(
            AnomalyFlag.external_user_id.is_not(None),
            ~exists(
                select(UserProfile.id).where(
                    UserProfile.external_user_id == AnomalyFlag.external_user_id
                )
            ),
        ),
        and_(
            AnomalyFlag.related_device_id.is_not(None),
            ~exists(select(Device.id).where(Device.id == AnomalyFlag.related_device_id)),
        ),
        and_(
            AnomalyFlag.related_visitor_id.is_not(None),
            ~exists(select(Visitor.id).where(Visitor.id == AnomalyFlag.related_visitor_id)),
        ),
    )
