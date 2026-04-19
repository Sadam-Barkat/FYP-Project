"""finance role, billing description, service signals for finance queue

Revision ID: c3d5e7f9_fin1
Revises: a8f3c2b1_ops1
Create Date: 2026-04-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d5e7f9_fin1"
down_revision: Union[str, None] = "a8f3c2b1_ops1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'finance'"))
    op.add_column(
        "billings",
        sa.Column("description", sa.String(length=512), nullable=False, server_default=""),
    )
    op.alter_column("billings", "description", server_default=None)
    op.create_table(
        "billing_service_signals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("signal_type", sa.String(length=48), nullable=False),
        sa.Column("reference_id", sa.Integer(), nullable=True),
        sa.Column("detail", sa.String(length=512), nullable=True),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patients.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_billing_service_signals_id"), "billing_service_signals", ["id"], unique=False)
    op.create_index(
        "ix_billing_signals_patient_unresolved",
        "billing_service_signals",
        ["patient_id"],
        unique=False,
        postgresql_where=sa.text("resolved_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_billing_signals_patient_unresolved", table_name="billing_service_signals")
    op.drop_index(op.f("ix_billing_service_signals_id"), table_name="billing_service_signals")
    op.drop_table("billing_service_signals")
    op.drop_column("billings", "description")
    # PostgreSQL: cannot remove enum value 'finance' safely; leave userrole as-is.
