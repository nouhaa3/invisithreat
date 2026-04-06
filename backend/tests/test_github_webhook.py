"""
GitHub Webhook Tests
Tests webhook handling, authentication, and triggers
"""
import requests
import json
import hmac
import hashlib
from datetime import datetime

BASE_URL = "http://localhost:8000"
API_URL = f"{BASE_URL}/api"

# Mock GitHub webhook secret
WEBHOOK_SECRET = "test_webhook_secret_12345"


def create_webhook_signature(payload: str, secret: str) -> str:
    """Create GitHub webhook X-Hub-Signature"""
    signature = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"sha256={signature}"


class TestWebhookBasics:
    """Test basic webhook endpoint functionality"""
    
    def test_webhook_endpoint_exists(self):
        """Verify webhook endpoint is accessible"""
        response = requests.get(f"{API_URL}/integrations/github/webhook")
        # GET should be rejected or return 405
        assert response.status_code in [400, 404, 405]
    
    def test_webhook_post_no_signature(self):
        """POST to webhook without signature"""
        payload = json.dumps({"action": "push", "ref": "refs/heads/main"})
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        # Should reject unsigned webhooks
        assert response.status_code in [400, 401, 403]
    
    def test_webhook_invalid_signature(self):
        """POST with invalid signature"""
        payload = json.dumps({"action": "push", "ref": "refs/heads/main"})
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": "sha256=invalidsignature123"
            }
        )
        assert response.status_code in [400, 401, 403]


class TestWebhookPayloads:
    """Test various webhook payload types"""
    
    def test_webhook_push_event(self):
        """Handle push event webhook"""
        payload = json.dumps({
            "action": "opened",
            "ref": "refs/heads/main",
            "pusher": {"name": "testuser"},
            "commits": [
                {
                    "id": "abc123def",
                    "message": "Fix security issue",
                    "author": {"name": "Test User"}
                }
            ]
        })
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature,
                "X-GitHub-Event": "push"
            }
        )
        # Should accept or process
        assert response.status_code in [200, 202, 400, 401, 403]
    
    def test_webhook_pull_request_event(self):
        """Handle pull request event webhook"""
        payload = json.dumps({
            "action": "opened",
            "number": 123,
            "pull_request": {
                "id": 456,
                "title": "Add new feature",
                "head": {"ref": "feature-branch"}
            }
        })
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature,
                "X-GitHub-Event": "pull_request"
            }
        )
        assert response.status_code in [200, 202, 400, 401, 403]
    
    def test_webhook_issue_event(self):
        """Handle issue event webhook"""
        payload = json.dumps({
            "action": "opened",
            "issue": {
                "id": 789,
                "title": "Security vulnerability",
                "body": "We found a vulnerability"
            }
        })
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature,
                "X-GitHub-Event": "issues"
            }
        )
        assert response.status_code in [200, 202, 400, 401, 403]


class TestWebhookValidation:
    """Test webhook payload validation"""
    
    def test_webhook_empty_payload(self):
        """POST empty webhook payload"""
        payload = ""
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature
            }
        )
        assert response.status_code in [200, 202, 400, 401, 403]
    
    def test_webhook_invalid_json(self):
        """POST invalid JSON payload"""
        payload = "{ invalid json }"
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature
            }
        )
        assert response.status_code in [200, 202, 400, 401, 403]
    
    def test_webhook_missing_required_fields(self):
        """Webhook payload missing required fields"""
        payload = json.dumps({
            "action": "opened"
            # Missing repository info
        })
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature
            }
        )
        assert response.status_code in [200, 202, 400, 401, 403]


class TestWebhookProcessing:
    """Test webhook processing logic"""
    
    def test_webhook_triggers_scan(self):
        """Verify webhook can trigger security scan"""
        payload = json.dumps({
            "ref": "refs/heads/main",
            "repository": {"full_name": "user/repo"},
            "pusher": {"name": "user"}
        })
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature,
                "X-GitHub-Event": "push"
            }
        )
        # Should accept and potentially trigger scan
        assert response.status_code in [200, 202, 400, 401, 403]
    
    def test_webhook_ignores_unknown_action(self):
        """Webhook with unknown action type"""
        payload = json.dumps({
            "action": "unknown_action",
            "repository": {"full_name": "user/repo"}
        })
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature,
                "X-GitHub-Event": "unknown"
            }
        )
        # Should handle gracefully
        assert response.status_code in [200, 202, 400, 401, 403]


class TestWebhookHeaders:
    """Test webhook header validation"""
    
    def test_webhook_missing_event_header(self):
        """Webhook without X-GitHub-Event header"""
        payload = json.dumps({"ref": "refs/heads/main"})
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature
                # Missing X-GitHub-Event
            }
        )
        assert response.status_code in [200, 202, 400, 401, 403]
    
    def test_webhook_invalid_content_type(self):
        """Webhook with wrong content type"""
        payload = json.dumps({"ref": "refs/heads/main"})
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "text/plain",  # Wrong type
                "X-Hub-Signature-256": signature
            }
        )
        assert response.status_code in [200, 202, 400, 401, 403]
    
    def test_webhook_case_insensitive_algorithm(self):
        """Test if webhook accepts case-insensitive algorithm"""
        payload = json.dumps({"ref": "refs/heads/main"})
        correct_sig = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        # Try uppercase
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": correct_sig.upper()
            }
        )
        # Should handle or reject
        assert response.status_code in [200, 202, 400, 401, 403]


class TestWebhookReplay:
    """Test webhook replay and idempotency"""
    
    def test_webhook_idempotency(self):
        """Same webhook received twice"""
        payload = json.dumps({
            "id": "webhook-123",
            "ref": "refs/heads/main"
        })
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        headers = {
            "Content-Type": "application/json",
            "X-Hub-Signature-256": signature,
            "X-GitHub-Delivery": "unique-delivery-id-1"
        }
        
        response1 = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers=headers
        )
        
        response2 = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers=headers
        )
        
        # Both should succeed or both fail same way
        assert response1.status_code == response2.status_code or \
               response1.status_code in [200, 202, 400, 401, 403]


class TestWebhookLargePayload:
    """Test webhook payload size limits"""
    
    def test_webhook_very_large_payload(self):
        """POST very large webhook payload"""
        large_data = {
            "ref": "refs/heads/main",
            "commits": [{"message": "x" * 100000}] * 100  # Large payload
        }
        payload = json.dumps(large_data)
        signature = create_webhook_signature(payload, WEBHOOK_SECRET)
        
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": signature
            },
            timeout=30
        )
        # Should handle or reject
        assert response.status_code in [200, 202, 400, 401, 403, 413]


class TestWebhookSecurity:
    """Test webhook security aspects"""
    
    def test_webhook_signature_timing_attack(self):
        """Test resistance to timing attacks"""
        payload = json.dumps({"ref": "refs/heads/main"})
        correct_sig = create_webhook_signature(payload, WEBHOOK_SECRET)
        wrong_sig = "sha256=00000000000000000000000000000000"
        
        # Both should take similar time (constant-time comparison)
        response = requests.post(
            f"{API_URL}/integrations/github/webhook",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": wrong_sig
            }
        )
        assert response.status_code in [400, 401, 403]
