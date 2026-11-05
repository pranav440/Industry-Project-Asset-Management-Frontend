from datetime import date, datetime
from starlette.testclient import TestClient

from app.deps import get_current_user
from app.models import Asset, AssetMovement, AssetStatus, AuditLog, GatePass, GatePassHistory, GatePassStatus, GatePassType
from app.routers.assets import router as assets_router
from test_host_dashboard import make_test_environment


def test_qr_validation_success_pass_urn():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-QR-001",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.approved,
            requester_name="Elena Vance",
            department="Operations",
            asset_or_item="Calibrator Tool",
            quantity=1,
            destination="Facility Bay 2",
            purpose="Maintenance",
        )
        db.add(gp)
        db.commit()

    # Validate using assetmx:pass: URN
    resp = client.post(
        "/api/gate-passes/validate-qr",
        json={"qr_code": "assetmx:pass:GP-QR-001", "expected_pass_id": "GP-QR-001", "target_action": "exit"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["valid"] is True
    assert data["pass_id"] == "GP-QR-001"
    assert data["action_eligible"] is True
    assert data["resolved_format"] == "pass_urn"
    assert "Approved" in data["eligibility_reason"]


def test_qr_validation_success_raw_pass_id():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-QR-002",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.approved,
            requester_name="Elena Vance",
            department="Operations",
            asset_or_item="Laser Kit",
            quantity=1,
            destination="Site B",
            purpose="Survey",
        )
        db.add(gp)
        db.commit()

    resp = client.post(
        "/api/gate-passes/validate-qr",
        json={"qr_code": "GP-QR-002", "expected_pass_id": "GP-QR-002", "target_action": "exit"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["valid"] is True
    assert data["pass_id"] == "GP-QR-002"
    assert data["action_eligible"] is True
    assert data["resolved_format"] == "pass_id"


def test_qr_validation_success_asset_tag():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        asset = Asset(
            asset_id="AST-QR-100",
            name="Precision Drill Machine",
            category="Industrial Equipment",
            location="Main Workshop",
            custodian="Elena Vance",
            status=AssetStatus.active,
            purchase_date=datetime.now(),
            vendor_name="Acme Tools",
            total_cost=2500.0,
            warranty_period="2 Years",
            invoice_reference="INV-QR-100",
            qr_code_value="assetmx:AST-QR-100:secrettoken123",
            qr_code_data_url="data:image/png;base64,placeholder",
        )
        db.add(asset)
        db.flush()

        gp = GatePass(
            pass_id="GP-QR-003",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.approved,
            requester_name="Elena Vance",
            department="Operations",
            asset_or_item="Precision Drill Machine",
            quantity=1,
            destination="Offsite Yard",
            purpose="Relocation",
        )
        db.add(gp)
        db.commit()

    resp = client.post(
        "/api/gate-passes/validate-qr",
        json={"qr_code": "assetmx:AST-QR-100:secrettoken123", "expected_pass_id": "GP-QR-003", "target_action": "exit"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["valid"] is True
    assert data["pass_id"] == "GP-QR-003"
    assert data["resolved_format"] == "asset_tag"


def test_qr_validation_rejects_unknown_or_malformed_code():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    resp = client.post(
        "/api/gate-passes/validate-qr",
        json={"qr_code": "random_unregistered_code_xyz", "target_action": "exit"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["valid"] is False
    assert data["pass_id"] is None
    assert data["action_eligible"] is False
    assert "Invalid QR code" in data["message"]


def test_qr_validation_rejects_mismatched_pass():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp1 = GatePass(
            pass_id="GP-QR-AAA",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.approved,
            requester_name="Elena",
            department="Ops",
            asset_or_item="Item A",
            quantity=1,
            destination="Dest A",
            purpose="Testing",
        )
        gp2 = GatePass(
            pass_id="GP-QR-BBB",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.approved,
            requester_name="Elena",
            department="Ops",
            asset_or_item="Item B",
            quantity=1,
            destination="Dest B",
            purpose="Testing",
        )
        db.add_all([gp1, gp2])
        db.commit()

    # Scan QR for GP-QR-AAA while verifying GP-QR-BBB
    resp = client.post(
        "/api/gate-passes/validate-qr",
        json={"qr_code": "assetmx:pass:GP-QR-AAA", "expected_pass_id": "GP-QR-BBB", "target_action": "exit"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["valid"] is False
    assert data["action_eligible"] is False
    assert "Mismatched QR code" in data["message"]
    assert "GP-QR-AAA" in data["message"]


def test_qr_validation_ineligible_for_exit_when_pending():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-QR-PEND",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.pending,
            requester_name="Elena",
            department="Ops",
            asset_or_item="Pending Item",
            quantity=1,
            destination="Dest",
            purpose="Testing",
        )
        db.add(gp)
        db.commit()

    resp = client.post(
        "/api/gate-passes/validate-qr",
        json={"qr_code": "assetmx:pass:GP-QR-PEND", "target_action": "exit"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["valid"] is True
    assert data["action_eligible"] is False
    assert "Exit verification requires 'Approved' status" in data["eligibility_reason"]


def test_qr_validation_ineligible_for_entry_when_non_returnable():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-QR-NONRET",
            pass_type=GatePassType.non_returnable,
            request_date=date.today(),
            status=GatePassStatus.active,
            requester_name="Elena",
            department="Ops",
            asset_or_item="Non-returnable Item",
            quantity=1,
            destination="Dest",
            purpose="Testing",
        )
        db.add(gp)
        db.commit()

    resp = client.post(
        "/api/gate-passes/validate-qr",
        json={"qr_code": "assetmx:pass:GP-QR-NONRET", "target_action": "entry"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["valid"] is True
    assert data["action_eligible"] is False
    assert "Non-returnable gate pass" in data["eligibility_reason"]


def test_exit_verification_with_valid_and_mismatched_qr():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-QR-EXIT",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.approved,
            requester_name="Elena",
            department="Ops",
            asset_or_item="Hardware Crate",
            quantity=1,
            destination="Site 9",
            purpose="Relocation",
        )
        db.add(gp)
        db.commit()

    # Mismatched QR code should be rejected with 400
    mismatch_resp = client.post(
        "/api/gate-passes/GP-QR-EXIT/exit-verification",
        json={"exit_gate": "Gate 1", "exit_notes": "Departing", "qr_code": "assetmx:pass:GP-WRONG-001"},
    )
    assert mismatch_resp.status_code == 400, mismatch_resp.text
    assert "QR validation failed" in mismatch_resp.json()["detail"]

    # Valid matching QR code succeeds
    valid_resp = client.post(
        "/api/gate-passes/GP-QR-EXIT/exit-verification",
        json={"exit_gate": "Gate 1", "exit_notes": "Departing", "qr_code": "assetmx:pass:GP-QR-EXIT"},
    )
    assert valid_resp.status_code == 200, valid_resp.text
    body = valid_resp.json()
    assert body["status"] == "Active"
    assert body["exit_status"] == "Verified"
    assert any("[QR Validated]" in h["note"] for h in body["history"])


def test_entry_verification_with_valid_and_mismatched_qr():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-QR-ENTRY",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.active,
            requester_name="Elena",
            department="Ops",
            asset_or_item="Hardware Crate",
            quantity=1,
            destination="Site 9",
            purpose="Relocation",
            exit_status="Verified",
        )
        db.add(gp)
        db.commit()

    # Mismatched QR code rejected with 400
    mismatch_resp = client.post(
        "/api/gate-passes/GP-QR-ENTRY/entry-verification",
        json={"entry_gate": "Receiving Bay 3", "entry_notes": "Returning", "qr_code": "assetmx:pass:GP-WRONG-001"},
    )
    assert mismatch_resp.status_code == 400, mismatch_resp.text
    assert "QR validation failed" in mismatch_resp.json()["detail"]

    # Valid matching QR code succeeds
    valid_resp = client.post(
        "/api/gate-passes/GP-QR-ENTRY/entry-verification",
        json={"entry_gate": "Receiving Bay 3", "entry_notes": "Returning", "qr_code": "assetmx:pass:GP-QR-ENTRY"},
    )
    assert valid_resp.status_code == 200, valid_resp.text
    body = valid_resp.json()
    assert body["status"] == "Completed"
    assert body["entry_status"] == "Verified"
    assert any("[QR Validated]" in h["note"] for h in body["history"])


def test_exit_verification_requires_mandatory_qr_code():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-QR-MAND-EXIT",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.approved,
            requester_name="Elena",
            department="Ops",
            asset_or_item="Hardware Unit",
            quantity=1,
            destination="Site 10",
            purpose="Testing",
        )
        db.add(gp)
        db.commit()

    # 1. Omitting qr_code -> 422
    resp_missing = client.post(
        "/api/gate-passes/GP-QR-MAND-EXIT/exit-verification",
        json={"exit_gate": "Gate 1", "exit_notes": "Attempt without QR"},
    )
    assert resp_missing.status_code == 422

    # 2. Empty qr_code -> 422
    resp_empty = client.post(
        "/api/gate-passes/GP-QR-MAND-EXIT/exit-verification",
        json={"exit_gate": "Gate 1", "exit_notes": "Attempt with empty QR", "qr_code": "   "},
    )
    assert resp_empty.status_code == 422

    # Verify state immutability on failure
    with session_factory() as db:
        record = db.query(GatePass).filter_by(pass_id="GP-QR-MAND-EXIT").one()
        assert record.status == GatePassStatus.approved
        assert record.exit_status is None
        assert db.query(GatePassHistory).filter_by(pass_id=record.pass_id).count() == 0


def test_entry_verification_requires_mandatory_qr_code():
    app, session_factory, users = make_test_environment()
    guard = users["guard"]
    app.dependency_overrides[get_current_user] = lambda: guard
    client = TestClient(app)

    with session_factory() as db:
        gp = GatePass(
            pass_id="GP-QR-MAND-ENTRY",
            pass_type=GatePassType.returnable,
            request_date=date.today(),
            status=GatePassStatus.active,
            requester_name="Elena",
            department="Ops",
            asset_or_item="Hardware Unit",
            quantity=1,
            destination="Site 10",
            purpose="Testing",
            exit_status="Verified",
        )
        db.add(gp)
        db.commit()

    # 1. Omitting qr_code -> 422
    resp_missing = client.post(
        "/api/gate-passes/GP-QR-MAND-ENTRY/entry-verification",
        json={"entry_gate": "Gate 1", "entry_notes": "Attempt without QR"},
    )
    assert resp_missing.status_code == 422

    # 2. Empty qr_code -> 422
    resp_empty = client.post(
        "/api/gate-passes/GP-QR-MAND-ENTRY/entry-verification",
        json={"entry_gate": "Gate 1", "entry_notes": "Attempt with empty QR", "qr_code": ""},
    )
    assert resp_empty.status_code == 422

    # Verify state immutability on failure
    with session_factory() as db:
        record = db.query(GatePass).filter_by(pass_id="GP-QR-MAND-ENTRY").one()
        assert record.status == GatePassStatus.active
        assert record.entry_status is None
        assert db.query(GatePassHistory).filter_by(pass_id=record.pass_id).count() == 0


def test_asset_transfer_mandatory_qr_validation_flow():
    app, session_factory, users = make_test_environment()
    app.include_router(assets_router)
    admin = users["admin"]
    app.dependency_overrides[get_current_user] = lambda: admin
    client = TestClient(app)

    with session_factory() as db:
        asset = Asset(
            asset_id="AST-TRF-001",
            name="Field Spectrometer",
            category="Lab Equipment",
            location="HQ Lab 1",
            custodian="Dr. Vance",
            status=AssetStatus.active,
            purchase_date=datetime.now(),
            vendor_name="Precision Corp",
            total_cost=8500.0,
            warranty_period="3 Years",
            invoice_reference="INV-9901",
            qr_code_value="assetmx:AST-TRF-001:securehash77",
            qr_code_data_url="data:image/png;base64,mock",
        )
        db.add(asset)
        db.commit()

    # 1. Missing qr_code -> 422
    resp_missing = client.post(
        "/api/assets/AST-TRF-001/transfer",
        json={"destination_location": "Field Lab 2", "new_custodian": "Dr. Gordon"},
    )
    assert resp_missing.status_code == 422

    # 2. Empty qr_code -> 422
    resp_empty = client.post(
        "/api/assets/AST-TRF-001/transfer",
        json={"destination_location": "Field Lab 2", "new_custodian": "Dr. Gordon", "qr_code": "  "},
    )
    assert resp_empty.status_code == 422

    # 3. Mismatched qr_code -> 400
    resp_mismatch = client.post(
        "/api/assets/AST-TRF-001/transfer",
        json={"destination_location": "Field Lab 2", "new_custodian": "Dr. Gordon", "qr_code": "assetmx:AST-WRONG:999"},
    )
    assert resp_mismatch.status_code == 400
    assert "QR validation failed" in resp_mismatch.json()["detail"]

    # Verify state immutability on failure: status remains active, no movement created
    with session_factory() as db:
        db_asset = db.query(Asset).filter_by(asset_id="AST-TRF-001").one()
        assert db_asset.status == AssetStatus.active
        assert db.query(AssetMovement).filter_by(asset_id=db_asset.id).count() == 0
        assert db.query(AuditLog).filter_by(asset_id=db_asset.id).count() == 0

    # 4. Valid matching qr_code -> 201 Created and AuditLog recorded
    resp_valid = client.post(
        "/api/assets/AST-TRF-001/transfer",
        json={
            "destination_location": "Field Lab 2",
            "new_custodian": "Dr. Gordon",
            "transfer_reason": "Expedition equipment transfer",
            "qr_code": "assetmx:AST-TRF-001:securehash77",
        },
    )
    assert resp_valid.status_code == 201, resp_valid.text
    data = resp_valid.json()
    assert data["asset"]["status"] == "In Transit"
    assert data["movement"]["status"] == "In Transit"
    assert data["movement"]["to_location"] == "Field Lab 2"
    assert data["movement"]["to_custodian"] == "Dr. Gordon"

    # Verify database state and audit log metadata
    with session_factory() as db:
        db_asset = db.query(Asset).filter_by(asset_id="AST-TRF-001").one()
        assert db_asset.status == AssetStatus.in_transit
        movements = db.query(AssetMovement).filter_by(asset_id=db_asset.id).all()
        assert len(movements) == 1
        audits = db.query(AuditLog).filter_by(asset_id=db_asset.id).all()
        assert len(audits) == 1
        audit = audits[0]
        assert audit.metadata_json["qr_validated"] is True
        assert audit.metadata_json["qr_code"] == "assetmx:AST-TRF-001:securehash77"
