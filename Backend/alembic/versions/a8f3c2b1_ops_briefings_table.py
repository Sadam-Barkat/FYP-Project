"""ops_briefings table for AI Hospital Ops Copilot

Revision ID: a8f3c2b1_ops1
Revises: 179eb31fef4f
Create Date: 2026-04-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a8f3c2b1_ops1"
down_revision: Union[str, None] = "179eb31fef4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ops_briefings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("risk_category", sa.String(length=128), nullable=False),
        sa.Column("what_changed", sa.Text(), nullable=False),
        sa.Column("why_it_matters", sa.Text(), nullable=False),
        sa.Column("recommended_actions", sa.JSON(), nullable=False),
        sa.Column("evidence_links", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="open"),
        sa.Column("signals_snapshot", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ops_briefings_id"), "ops_briefings", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ops_briefings_id"), table_name="ops_briefings")
    op.drop_table("ops_briefings")
