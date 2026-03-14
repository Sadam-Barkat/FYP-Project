from .base import Base
from .user import User
from .patient import Patient
from .admission import Admission
from .bed import Bed
from .vital import Vital
from .alert import Alert
from .pharmacy import PharmacyStock
from .laboratory import LaboratoryResult
from .billing import Billing
from .staff import Staff

from .organization import Department, WardDetail
from .hr import Attendance, Shift
from .clinical import Appointment, Visit, Prescription, TreatmentPlan, DischargeSummary
from .assignments import DoctorAssignment, NurseAssignment, NursePatientAssignment
from .laboratory_extra import LabCategory, LabRequest
from .pharmacy_extra import MedicineCategory, InventoryItem
from .billing_extra import BillItem, Transaction
from .analytics import Forecast, Categorization, EmergencyLog, ICUDetail
from .system import AuditLog
from .staff_invitation import StaffInvitation

# This file imports all models so that Alembic's env.py can load Base.metadata
# and see all the tables it needs to generate migrations for.

