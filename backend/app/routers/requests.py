import os
import re
import uuid
import zipfile
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import require_admin
from app.models import AuditLog, Request, RequestAttachment, RequestHistory, RequestPriority, RequestStatus, RequestType, User
from app.schemas import (
    ExternalRequestCreate,
    RequestAttachmentOut,
    RequestDetailOut,
    RequestHistoryOut,
    RequestListResponse,
    RequestTransitionOut,
    RequestTransitionRequest,
    format_file_size,
)

router = APIRouter(prefix="/api/requests", tags=["requests"])

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MiB
CHUNK_SIZE = 64 * 1024  # 64 KiB
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".docx"}
ALLOWED_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

VALID_REQUEST_TYPE_VALUES = {"Asset Request": RequestType.asset_request, "Consumable Request": RequestType.consumable_request}
VALID_PRIORITY_VALUES = {"High": RequestPriority.high, "Medium": RequestPriority.medium, "Low": RequestPriority.low}
VALID_STATUS_VALUES = {"Pending": RequestStatus.pending, "In Review": RequestStatus.in_review, "Fulfilled": RequestStatus.fulfilled, "Rejected": RequestStatus.rejected}
ALLOWED_TRANSITIONS = {
    RequestStatus.pending: {RequestStatus.in_review, RequestStatus.fulfilled, RequestStatus.rejected},
    RequestStatus.in_review: {RequestStatus.fulfilled, RequestStatus.rejected},
}


def _request_id(db: Session) -> str:
    year = date.today().year
    while True:
        candidate = f"REQ-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(Request.id).where(Request.request_id == candidate)) is None:
            return candidate


def _history_id(db: Session) -> str:
    year = date.today().year
    while True:
        candidate = f"RH-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(RequestHistory.id).where(RequestHistory.history_id == candidate)) is None:
            return candidate


def _attachment_id(db: Session) -> str:
    year = date.today().year
    while True:
        candidate = f"ATT-{year}-{uuid.uuid4().hex[:8].upper()}"
        if db.scalar(select(RequestAttachment.id).where(RequestAttachment.attachment_id == candidate)) is None:
            return candidate


def _status_label(value: RequestStatus) -> str:
    return value.value


def _request_history_response(history: RequestHistory) -> RequestHistoryOut:
    return RequestHistoryOut(
        history_id=history.history_id,
        timestamp=history.timestamp,
        stage=history.stage,
        action=history.action,
        performed_by=history.performed_by,
        note=history.note,
    )


def _attachment_response(att: RequestAttachment) -> RequestAttachmentOut:
    date_str = att.uploaded_at.strftime("%Y-%m-%d") if att.uploaded_at else date.today().isoformat()
    return RequestAttachmentOut(
        attachment_id=att.attachment_id,
        id=att.attachment_id,
        request_id=att.request_id,
        original_filename=att.original_filename,
        name=att.original_filename,
        content_type=att.content_type,
        type=att.content_type,
        file_size=att.file_size,
        size=format_file_size(att.file_size),
        uploaded_at=att.uploaded_at,
        uploadDate=date_str,
        download_url=f"/api/requests/{att.request_id}/attachments/{att.attachment_id}/download",
        preview_url=f"/api/requests/{att.request_id}/attachments/{att.attachment_id}/preview",
    )


def _sanitize_filename(raw_name: str | None, ext: str) -> str:
    if not raw_name:
        return f"attachment{ext}"
    base = os.path.basename(raw_name.replace("\\", "/"))
    clean = re.sub(r'[\x00-\x1f/\\:?*"<>|]', '_', base).strip()
    if not clean or clean.replace(".", "") == "":
        return f"attachment{ext}"
    return clean[:255]


def _validate_file_magic(path: Path, ext: str) -> None:
    with open(path, "rb") as f:
        header = f.read(2048)

    if len(header) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    # Disallow executable signatures or script headers
    if header.startswith(b"MZ") or header.startswith(b"\x7fELF") or header.startswith(b"#!"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Executable files are not permitted",
        )

    lower_header = header.lower()
    if lower_header.startswith(b"<html") or lower_header.startswith(b"<!doctype html") or lower_header.startswith(b"<svg"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="HTML and SVG files are not permitted",
        )

    if ext == ".pdf":
        if not header.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match PDF format",
            )
    elif ext == ".png":
        if not header.startswith(b"\x89PNG\r\n\x1a\n"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match PNG format",
            )
    elif ext in {".jpg", ".jpeg"}:
        if not header.startswith(b"\xff\xd8\xff"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match JPEG format",
            )
    elif ext == ".docx":
        if not header.startswith(b"PK\x03\x04"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File content does not match DOCX package format",
            )
        if not zipfile.is_zipfile(path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid DOCX package format",
            )
        try:
            with zipfile.ZipFile(path, "r") as zf:
                namelist = zf.namelist()
                if "[Content_Types].xml" not in namelist:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid DOCX package structure",
                    )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to inspect DOCX package",
            ) from exc


def _request_response(db: Session, request: Request, *, include_history: bool = False) -> RequestDetailOut:
    history = []
    if include_history:
        history = [
            _request_history_response(row)
            for row in db.scalars(
                select(RequestHistory)
                .where(RequestHistory.request_id == request.request_id)
                .order_by(RequestHistory.timestamp.asc(), RequestHistory.id.asc())
            ).all()
        ]
    attachments = [
        _attachment_response(row)
        for row in db.scalars(
            select(RequestAttachment)
            .where(RequestAttachment.request_id == request.request_id)
            .order_by(RequestAttachment.uploaded_at.asc(), RequestAttachment.id.asc())
        ).all()
    ]
    return RequestDetailOut(
        request_id=request.request_id,
        requester_name=request.requester_name,
        requester_email=request.requester_email,
        department=request.department,
        request_type=request.request_type.value,
        requested_item=request.requested_item,
        category=request.category,
        quantity=request.quantity,
        priority=request.priority.value,
        request_date=request.request_date,
        status=request.status.value,
        justification=request.justification,
        processing_guidelines=request.processing_guidelines,
        request_source=request.request_source or "Internal",
        date_received=request.date_received,
        external_reference=request.external_reference,
        contact_info=request.contact_info,
        estimated_cost=request.estimated_cost,
        procurement_reference=request.procurement_reference,
        attachments=attachments,
        created_at=request.created_at,
        updated_at=request.updated_at,
        history=history,
    )


def _find_request(db: Session, request_id: str, *, lock: bool = False) -> Request | None:
    query = select(Request).where(Request.request_id == request_id)
    if lock:
        query = query.with_for_update()
    return db.scalar(query)


def _create_audit_log(*, db: Session, request: Request, actor: User, previous_status: RequestStatus, target_status: RequestStatus, operational_note: str | None) -> AuditLog:
    return AuditLog(
        action="request_status_transition",
        asset_id=None,
        asset_identifier="",
        consumable_id=None,
        consumable_identifier=None,
        request_id=request.id,
        request_identifier=request.request_id,
        actor_user_id=actor.id,
        before_state={"status": previous_status.value},
        after_state={"status": target_status.value},
        metadata_json={
            "request_id": request.request_id,
            "previous_status": previous_status.value,
            "new_status": target_status.value,
            "operational_note": operational_note,
        },
    )


def _create_external_audit_log(*, db: Session, request: Request, actor: User) -> AuditLog:
    return AuditLog(
        action="external_request_created",
        asset_id=None,
        asset_identifier="",
        consumable_id=None,
        consumable_identifier=None,
        request_id=request.id,
        request_identifier=request.request_id,
        actor_user_id=actor.id,
        before_state=None,
        after_state={
            "status": RequestStatus.pending.value,
            "request_source": "External",
            "requested_item": request.requested_item,
            "quantity": request.quantity,
        },
        metadata_json={
            "request_id": request.request_id,
            "request_source": "External",
            "date_received": request.date_received.isoformat() if request.date_received else None,
            "external_reference": request.external_reference,
            "procurement_reference": request.procurement_reference,
            "estimated_cost": request.estimated_cost,
        },
    )


def _create_attachment_audit_log(
    *,
    db: Session,
    request: Request,
    attachment: RequestAttachment,
    actor: User,
) -> AuditLog:
    return AuditLog(
        action="request_attachment_uploaded",
        asset_id=None,
        asset_identifier="",
        consumable_id=None,
        consumable_identifier=None,
        request_id=request.id,
        request_identifier=request.request_id,
        actor_user_id=actor.id,
        before_state=None,
        after_state={
            "attachment_id": attachment.attachment_id,
            "original_filename": attachment.original_filename,
            "file_size": attachment.file_size,
            "content_type": attachment.content_type,
        },
        metadata_json={
            "request_id": request.request_id,
            "attachment_id": attachment.attachment_id,
            "original_filename": attachment.original_filename,
            "size": attachment.file_size,
            "content_type": attachment.content_type,
        },
    )


def _create_history_entry(*, db: Session, request: Request, actor: User, target_status: RequestStatus, operational_note: str | None) -> RequestHistory:
    history = RequestHistory(
        history_id=_history_id(db),
        request_id=request.request_id,
        stage=target_status.value,
        action="Status Updated",
        performed_by=actor.full_name,
        note=operational_note,
    )
    db.add(history)
    return history


@router.get("", response_model=RequestListResponse)
def list_requests(
    search: str | None = Query(default=None),
    request_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    department: str | None = Query(default=None),
    request_date: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RequestListResponse:
    query = select(Request)

    if search:
        pattern = f"%{search}%"
        query = query.where(or_(
            Request.request_id.ilike(pattern),
            Request.requester_name.ilike(pattern),
            Request.requested_item.ilike(pattern),
            Request.department.ilike(pattern),
        ))
    if request_type:
        request_type_key = VALID_REQUEST_TYPE_VALUES.get(request_type)
        if request_type_key is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid request type filter")
        query = query.where(Request.request_type == request_type_key)
    if status:
        status_key = VALID_STATUS_VALUES.get(status)
        if status_key is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status filter")
        query = query.where(Request.status == status_key)
    if priority:
        priority_key = VALID_PRIORITY_VALUES.get(priority)
        if priority_key is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid priority filter")
        query = query.where(Request.priority == priority_key)
    if department:
        query = query.where(Request.department == department)
    if request_date:
        try:
            parsed_date = datetime.strptime(request_date, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid request date filter") from exc
        query = query.where(Request.request_date == parsed_date)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.order_by(Request.request_date.desc(), Request.created_at.desc(), Request.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return RequestListResponse(
        items=[_request_response(db, row).model_dump(exclude={"history", "attachments"}) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/external", response_model=RequestDetailOut, status_code=status.HTTP_201_CREATED)
def create_external_request(
    body: ExternalRequestCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RequestDetailOut:
    request_type = VALID_REQUEST_TYPE_VALUES.get(body.request_type)
    if request_type is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid request type")

    priority = VALID_PRIORITY_VALUES.get(body.priority)
    if priority is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid priority")

    department = body.department.strip() if body.department and body.department.strip() else "General Operations"

    if body.requester_email and body.requester_email.strip():
        requester_email = body.requester_email.strip()
    elif body.contact_info and "@" in body.contact_info:
        requester_email = body.contact_info.strip()
    else:
        sanitized_name = re.sub(r"\s+", ".", body.requester_name.strip().lower())
        requester_email = f"{sanitized_name}@external.local"

    processing_guidelines = (
        body.processing_guidelines.strip()
        if body.processing_guidelines and body.processing_guidelines.strip()
        else "External requisition recorded for administrative review."
    )

    request_id = _request_id(db)

    try:
        new_request = Request(
            request_id=request_id,
            requester_name=body.requester_name.strip(),
            requester_email=requester_email,
            department=department,
            request_type=request_type,
            requested_item=body.requested_item.strip(),
            category=body.category.strip(),
            quantity=body.quantity,
            priority=priority,
            request_date=body.date_received,
            status=RequestStatus.pending,
            justification=body.justification.strip(),
            processing_guidelines=processing_guidelines,
            request_source="External",
            date_received=body.date_received,
            external_reference=body.external_reference.strip() if body.external_reference and body.external_reference.strip() else None,
            contact_info=body.contact_info.strip() if body.contact_info and body.contact_info.strip() else None,
            estimated_cost=body.estimated_cost,
            procurement_reference=body.procurement_reference.strip() if body.procurement_reference and body.procurement_reference.strip() else None,
        )
        db.add(new_request)
        db.flush()

        history = RequestHistory(
            history_id=_history_id(db),
            request_id=new_request.request_id,
            stage=RequestStatus.pending.value,
            action="External request recorded",
            performed_by=admin.full_name,
            note=(
                f"External reference: {new_request.external_reference}"
                if new_request.external_reference
                else "Recorded via external request entry workflow."
            ),
        )
        db.add(history)

        audit = _create_external_audit_log(db=db, request=new_request, actor=admin)
        db.add(audit)

        db.commit()
        db.refresh(new_request)
        return _request_response(db, new_request, include_history=True)
    except HTTPException:
        db.rollback()
        raise
    except (SQLAlchemyError, Exception):
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="External request creation failed",
        )



@router.get("/{request_id}", response_model=RequestDetailOut)
def get_request(
    request_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RequestDetailOut:
    request = _find_request(db, request_id)
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return _request_response(db, request, include_history=True)


@router.post("/{request_id}/transition", response_model=RequestDetailOut)
def transition_request(
    request_id: str,
    body: RequestTransitionRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RequestDetailOut:
    if body.operational_note is not None and len(body.operational_note) > 2000:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Operational note too long")

    target_status = VALID_STATUS_VALUES.get(body.target_status)
    if target_status is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid target status")

    try:
        request = db.scalar(select(Request).where(Request.request_id == request_id).with_for_update())
        if request is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

        current_status = request.status
        allowed_statuses = ALLOWED_TRANSITIONS.get(current_status)
        if allowed_statuses is None or target_status not in allowed_statuses:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invalid state transition")

        previous_status = request.status
        request.status = target_status
        request.updated_at = datetime.now(timezone.utc)

        history = _create_history_entry(db=db, request=request, actor=admin, target_status=target_status, operational_note=body.operational_note)
        audit = _create_audit_log(
            db=db,
            request=request,
            actor=admin,
            previous_status=previous_status,
            target_status=target_status,
            operational_note=body.operational_note,
        )
        db.add(audit)
        db.commit()
        db.refresh(request)
        db.refresh(history)
        return _request_response(db, request, include_history=True)
    except HTTPException:
        raise
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Request transition failed")


@router.post(
    "/{request_id}/attachments",
    response_model=RequestAttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_request_attachment(
    request_id: str,
    file: UploadFile = File(...),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RequestAttachmentOut:
    request = _find_request(db, request_id)
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    raw_name = file.filename or ""
    ext = Path(raw_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed extensions are: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    clean_filename = _sanitize_filename(raw_name, ext)
    canonical_content_type = ALLOWED_CONTENT_TYPES[ext]

    storage_dir = Path(settings.request_upload_dir)
    storage_dir.mkdir(parents=True, exist_ok=True)
    storage_key = f"{uuid.uuid4().hex}.dat"
    target_path = storage_dir / storage_key

    bytes_read = 0
    try:
        with open(target_path, "wb") as out_f:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                bytes_read += len(chunk)
                if bytes_read > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File size exceeds maximum allowed limit of 15 MiB",
                    )
                out_f.write(chunk)

        if bytes_read == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty",
            )

        _validate_file_magic(target_path, ext)
    except Exception:
        if target_path.exists():
            target_path.unlink(missing_ok=True)
        raise

    try:
        att_id = _attachment_id(db)
        attachment = RequestAttachment(
            attachment_id=att_id,
            request_id=request.request_id,
            original_filename=clean_filename,
            storage_key=storage_key,
            content_type=canonical_content_type,
            file_size=bytes_read,
            uploader_user_id=admin.id,
        )
        db.add(attachment)
        db.flush()

        audit = _create_attachment_audit_log(
            db=db,
            request=request,
            attachment=attachment,
            actor=admin,
        )
        db.add(audit)
        db.commit()
        db.refresh(attachment)
        return _attachment_response(attachment)
    except HTTPException:
        db.rollback()
        if target_path.exists():
            target_path.unlink(missing_ok=True)
        raise
    except Exception:
        db.rollback()
        if target_path.exists():
            target_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist attachment metadata",
        )


@router.get("/{request_id}/attachments", response_model=list[RequestAttachmentOut])
def list_request_attachments(
    request_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[RequestAttachmentOut]:
    request = _find_request(db, request_id)
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    attachments = db.scalars(
        select(RequestAttachment)
        .where(RequestAttachment.request_id == request.request_id)
        .order_by(RequestAttachment.uploaded_at.asc(), RequestAttachment.id.asc())
    ).all()
    return [_attachment_response(att) for att in attachments]


@router.get("/{request_id}/attachments/{attachment_id}/download")
def download_request_attachment(
    request_id: str,
    attachment_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    request = _find_request(db, request_id)
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    attachment = db.scalar(
        select(RequestAttachment).where(
            RequestAttachment.request_id == request.request_id,
            RequestAttachment.attachment_id == attachment_id,
        )
    )
    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    storage_dir = Path(settings.request_upload_dir)
    file_path = storage_dir / attachment.storage_key
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored attachment file not found",
        )

    safe_filename = quote(attachment.original_filename)
    return FileResponse(
        path=str(file_path),
        media_type=attachment.content_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": f'attachment; filename="{attachment.original_filename}"; filename*=UTF-8\'\'{safe_filename}',
        },
    )


@router.get("/{request_id}/attachments/{attachment_id}/preview")
def preview_request_attachment(
    request_id: str,
    attachment_id: str,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    request = _find_request(db, request_id)
    if request is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    attachment = db.scalar(
        select(RequestAttachment).where(
            RequestAttachment.request_id == request.request_id,
            RequestAttachment.attachment_id == attachment_id,
        )
    )
    if attachment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found",
        )

    storage_dir = Path(settings.request_upload_dir)
    file_path = storage_dir / attachment.storage_key
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored attachment file not found",
        )

    safe_filename = quote(attachment.original_filename)
    if attachment.content_type in {"application/pdf", "image/png", "image/jpeg"}:
        disposition = f'inline; filename="{attachment.original_filename}"; filename*=UTF-8\'\'{safe_filename}'
    else:
        disposition = f'attachment; filename="{attachment.original_filename}"; filename*=UTF-8\'\'{safe_filename}'

    return FileResponse(
        path=str(file_path),
        media_type=attachment.content_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": disposition,
        },
    )


@router.get("/{request_id}/attachments/{attachment_id}")
def get_request_attachment(
    request_id: str,
    attachment_id: str,
    disposition: str = Query("download", description="Attachment disposition: 'download'/'attachment' or 'preview'/'inline'"),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if disposition.lower() in {"preview", "inline"}:
        return preview_request_attachment(
            request_id=request_id,
            attachment_id=attachment_id,
            _admin=_admin,
            db=db,
        )
    return download_request_attachment(
        request_id=request_id,
        attachment_id=attachment_id,
        _admin=_admin,
        db=db,
    )
