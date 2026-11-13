from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin_or_superadmin, require_authenticated_user
from app.models import Department, User
from app.schemas import (
    DepartmentCreate,
    DepartmentListResponse,
    DepartmentOut,
    DepartmentUpdate,
)

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=DepartmentListResponse)
def list_departments(
    is_active: bool | None = Query(default=None),
    _user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> DepartmentListResponse:
    query = select(Department)
    if is_active is not None:
        query = query.where(Department.is_active == is_active)
    query = query.order_by(Department.name.asc())
    items = db.scalars(query).all()
    return DepartmentListResponse(items=list(items), total=len(items))


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    body: DepartmentCreate,
    _admin: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
) -> DepartmentOut:
    code = body.code.strip().upper()
    name = body.name.strip()
    existing_code = db.scalar(select(Department).where(Department.code == code))
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department with code '{code}' already exists",
        )
    existing_name = db.scalar(select(Department).where(Department.name == name))
    if existing_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Department with name '{name}' already exists",
        )
    department = Department(
        code=code,
        name=name,
        cost_center=body.cost_center.strip() if body.cost_center else None,
        budget_annual=body.budget_annual,
        is_active=True,
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    return DepartmentOut.model_validate(department)


@router.get("/{department_id}", response_model=DepartmentOut)
def get_department(
    department_id: int,
    _user: User = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> DepartmentOut:
    dept = db.get(Department, department_id)
    if dept is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {department_id} not found",
        )
    return DepartmentOut.model_validate(dept)


@router.put("/{department_id}", response_model=DepartmentOut)
def update_department(
    department_id: int,
    body: DepartmentUpdate,
    _admin: User = Depends(require_admin_or_superadmin),
    db: Session = Depends(get_db),
) -> DepartmentOut:
    dept = db.get(Department, department_id)
    if dept is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Department with ID {department_id} not found",
        )
    if body.name is not None:
        name = body.name.strip()
        existing_name = db.scalar(
            select(Department).where(Department.name == name, Department.id != department_id)
        )
        if existing_name:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Department with name '{name}' already exists",
            )
        dept.name = name
    if body.cost_center is not None:
        dept.cost_center = body.cost_center.strip() if body.cost_center else None
    if body.budget_annual is not None:
        dept.budget_annual = body.budget_annual
    if body.is_active is not None:
        dept.is_active = body.is_active
    db.commit()
    db.refresh(dept)
    return DepartmentOut.model_validate(dept)

