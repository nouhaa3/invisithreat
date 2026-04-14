"""
OWASP ZAP API Client
Provides a Python interface to the OWASP ZAP REST API running in daemon mode.
Wraps the ZAP API endpoints for easy access to core, spider, and active scanning functionalities.
"""
import logging
import requests
from typing import Optional, Dict, List, Any, Union
from enum import Enum
import json
import os
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# Default ZAP configuration
def _resolve_default_zap_target() -> tuple[str, int]:
    """Resolve ZAP host/port from environment, with sensible fallbacks."""
    zap_url = (os.getenv("ZAP_URL") or "").strip()
    if zap_url:
        parsed = urlparse(zap_url)
        if parsed.hostname:
            if parsed.port:
                return parsed.hostname, parsed.port
            if parsed.scheme == "https":
                return parsed.hostname, 443
            return parsed.hostname, 80

    host = (os.getenv("ZAP_HOST") or "localhost").strip() or "localhost"
    try:
        port = int((os.getenv("ZAP_PORT") or "8090").strip())
    except ValueError:
        port = 8090

    return host, port


DEFAULT_ZAP_HOST, DEFAULT_ZAP_PORT = _resolve_default_zap_target()
DEFAULT_ZAP_TIMEOUT = 30  # seconds
DEFAULT_ZAP_API_KEY = ""  # Disabled by default in daemon mode


class ZapApiException(Exception):
    """Exception raised for ZAP API errors"""
    pass


class ZapResponseFormat(Enum):
    """Supported response formats from ZAP API"""
    JSON = "json"
    XML = "xml"


class ZapCoreAPI:
    """Core ZAP API operations"""
    
    def __init__(self, client: "ZapClient"):
        self.client = client
    
    def version(self) -> str:
        """Get ZAP version"""
        result = self.client._api_call("core", "version")
        return result.get("version", "Unknown")
    
    def new_session(self, name: str = "", overwrite: bool = False) -> Dict[str, Any]:
        """
        Create a new session in ZAP.
        
        Args:
            name: Session name (optional)
            overwrite: Whether to overwrite existing session
            
        Returns:
            Session details dictionary
        """
        params = {}
        if name:
            params["sessionName"] = name
        if overwrite:
            params["overwrite"] = "true"
        
        result = self.client._api_call("core", "newSession", params)
        return result
    
    def open_session(self, name: str) -> Dict[str, Any]:
        """Open an existing session"""
        params = {"sessionName": name}
        result = self.client._api_call("core", "openSession", params)
        return result
    
    def save_session(self) -> bool:
        """Save the current session"""
        result = self.client._api_call("core", "saveSession")
        return "status" not in result or result.get("status", "").lower() != "error"
    
    def get_session_ids(self) -> List[str]:
        """Get list of all session IDs"""
        result = self.client._api_call("core", "sessionIdList")
        session_ids = result.get("sessionIdList", "")
        return [sid.strip() for sid in session_ids.split(",") if sid.strip()]
    
    def urls(self) -> List[str]:
        """Get all URLs in scope"""
        result = self.client._api_call("core", "urls")
        urls = result.get("urls", [])
        return urls if isinstance(urls, list) else []

    def alerts(self, baseurl: Optional[str] = None, start: int = 0, count: int = 0) -> Dict[str, Any]:
        """Get alerts found by ZAP."""
        params: Dict[str, str] = {}
        if baseurl:
            params["baseurl"] = baseurl
        if start > 0:
            params["start"] = str(start)
        if count > 0:
            params["count"] = str(count)
        return self.client._api_call("core", "alerts", params)
    
    def exclude_from_proxy(self, pattern: str) -> bool:
        """Add a URL pattern to proxy exclusion list"""
        params = {"pattern": pattern}
        result = self.client._api_call("core", "excludeFromProxy", params)
        return "error" not in str(result).lower()
    
    def exclude_from_scanner(self, pattern: str) -> bool:
        """Add a URL pattern to scanner exclusion list"""
        params = {"pattern": pattern}
        result = self.client._api_call("core", "excludeFromScanner", params)
        return "error" not in str(result).lower()


class ZapSpiderAPI:
    """OWASP ZAP Spider API operations"""
    
    def __init__(self, client: "ZapClient"):
        self.client = client
    
    def scan(self, url: str, recurse: bool = True, contextid: Optional[int] = None) -> Dict[str, Any]:
        """
        Start a spider scan on the given URL.
        
        Args:
            url: Target URL to scan
            recurse: Whether to recurse on found URLs
            contextid: Optional context ID for the scan
            
        Returns:
            Scan details including scan ID
        """
        params = {"url": url, "recurse": "true" if recurse else "false"}
        if contextid is not None:
            params["contextId"] = str(contextid)
        
        result = self.client._api_call("spider", "scan", params)
        return result
    
    def scan_as_user(self, contextid: int, userid: int, url: str) -> Dict[str, Any]:
        """Start a spider scan as a specific user"""
        params = {
            "contextId": str(contextid),
            "userId": str(userid),
            "url": url,
        }
        result = self.client._api_call("spider", "scanAsUser", params)
        return result
    
    def stop_scan(self, scanid: Optional[str] = None) -> bool:
        """Stop a running spider scan"""
        params = {}
        if scanid is not None:
            params["id"] = scanid
        
        result = self.client._api_call("spider", "stop", params)
        return "error" not in str(result).lower()
    
    def status(self, scanid: Optional[str] = None) -> int:
        """Get spider scan progress (0-100)"""
        params = {}
        if scanid is not None:
            params["id"] = scanid
        
        result = self.client._api_call("spider", "status", params)
        status = result.get("status")
        return int(status) if status and str(status).isdigit() else 0
    
    def results(self, scanid: Optional[str] = None) -> List[str]:
        """Get discovered URLs from spider scan"""
        params = {}
        if scanid is not None:
            params["id"] = scanid
        
        result = self.client._api_call("spider", "results", params)
        results = result.get("results", [])
        return results if isinstance(results, list) else []


class ZapAscanAPI:
    """OWASP ZAP Active Scanner API operations"""
    
    def __init__(self, client: "ZapClient"):
        self.client = client
    
    def scan(self, url: str, recurse: bool = True, inscopeonly: bool = False,
             contextid: Optional[int] = None) -> Dict[str, Any]:
        """
        Start an active scan on the given URL.
        
        Args:
            url: Target URL to scan
            recurse: Whether to recurse on found URLs
            inscopeonly: Only scan URLs in scope
            contextid: Optional context ID
            
        Returns:
            Scan details including scan ID
        """
        params = {
            "url": url,
            "recurse": "true" if recurse else "false",
            "inScopeOnly": "true" if inscopeonly else "false",
        }
        if contextid is not None:
            params["contextId"] = str(contextid)
        
        result = self.client._api_call("ascan", "scan", params)
        return result
    
    def scan_as_user(self, contextid: int, userid: int, url: str) -> Dict[str, Any]:
        """Start an active scan as a specific user"""
        params = {
            "contextId": str(contextid),
            "userId": str(userid),
            "url": url,
        }
        result = self.client._api_call("ascan", "scanAsUser", params)
        return result
    
    def stop_scan(self, scanid: Optional[str] = None) -> bool:
        """Stop a running active scan"""
        params = {}
        if scanid is not None:
            params["id"] = scanid
        
        result = self.client._api_call("ascan", "stop", params)
        return "error" not in str(result).lower()
    
    def remove_scan(self, scanid: str) -> bool:
        """Remove an active scan from history"""
        params = {"id": scanid}
        result = self.client._api_call("ascan", "removeScan", params)
        return "error" not in str(result).lower()
    
    def status(self, scanid: Optional[str] = None) -> int:
        """Get active scan progress (0-100)"""
        params = {}
        if scanid is not None:
            params["id"] = scanid
        
        result = self.client._api_call("ascan", "status", params)
        status = result.get("status")
        return int(status) if status and str(status).isdigit() else 0
    
    def scans(self) -> List[Dict[str, Any]]:
        """Get list of all active scans"""
        result = self.client._api_call("ascan", "scans")
        scans = result.get("scans", [])
        return scans if isinstance(scans, list) else []
    
    def scan_progress(self, scanid: str) -> Dict[str, Any]:
        """Get detailed progress for a specific scan"""
        params = {"id": scanid}
        result = self.client._api_call("ascan", "scanProgress", params)
        return result


class ZapClient:
    """
    Client for interacting with OWASP ZAP Running in daemon mode.
    Provides access to core, spider, and active scanner APIs.
    """
    
    def __init__(
        self,
        host: str = DEFAULT_ZAP_HOST,
        port: int = DEFAULT_ZAP_PORT,
        api_key: str = DEFAULT_ZAP_API_KEY,
        timeout: int = DEFAULT_ZAP_TIMEOUT,
    ):
        """
        Initialize ZAP client.
        
        Args:
            host: ZAP host (default: localhost)
            port: ZAP port (default: 8090)
            api_key: ZAP API key (default: empty for disabled API key requirement)
            timeout: Request timeout in seconds (default: 30)
        """
        self.host = host
        self.port = port
        self.api_key = api_key
        self.timeout = timeout
        self.base_url = f"http://{host}:{port}"
        
        # Initialize API components
        self.core = ZapCoreAPI(self)
        self.spider = ZapSpiderAPI(self)
        self.ascan = ZapAscanAPI(self)
        
        logger.info(f"ZapClient initialized for {self.base_url}")
    
    def _api_call(
        self,
        component: str,
        operation: str,
        params: Optional[Dict[str, str]] = None,
        response_format: ZapResponseFormat = ZapResponseFormat.JSON,
    ) -> Dict[str, Any]:
        """
        Make a call to the ZAP API.
        
        Args:
            component: API component (e.g., 'core', 'spider', 'ascan')
            operation: API operation (e.g., 'version', 'scan')
            params: Optional query parameters
            response_format: Response format (JSON or XML)
            
        Returns:
            Parsed API response
            
        Raises:
            ZapApiException: If API call fails
        """
        # Add API key if provided
        if params is None:
            params = {}
        if self.api_key:
            params["apikey"] = self.api_key

        # Modern ZAP API paths include an explicit endpoint type: /JSON/{component}/{view|action}/{name}/
        # Try view first, then action when ZAP reports bad_type.
        last_error: Optional[Exception] = None
        for endpoint_type in ("view", "action"):
            url = f"{self.base_url}/{response_format.value.upper()}/{component}/{endpoint_type}/{operation}/"
            try:
                logger.debug(f"Calling ZAP API: {url} with params: {params}")
                response = requests.get(url, params=params, timeout=self.timeout)

                if response.status_code == 400 and response_format == ZapResponseFormat.JSON:
                    try:
                        payload = response.json()
                    except Exception:
                        payload = {}
                    if isinstance(payload, dict) and payload.get("code") == "bad_type":
                        continue

                response.raise_for_status()

                # Parse response based on format
                if response_format == ZapResponseFormat.JSON:
                    data = response.json()

                    # Check for error in response
                    if isinstance(data, dict) and "error" in data:
                        error_msg = data.get("error", "Unknown error")
                        logger.error(f"ZAP API error: {error_msg}")
                        raise ZapApiException(f"ZAP API returned error: {error_msg}")

                    return data

                # XML response
                return response.text

            except requests.exceptions.ConnectionError as e:
                logger.error(f"Failed to connect to ZAP at {url}: {e}")
                raise ZapApiException(f"Cannot connect to ZAP: {e}")
            except requests.exceptions.Timeout as e:
                logger.error(f"ZAP API request timed out: {e}")
                raise ZapApiException(f"ZAP API request timed out: {e}")
            except requests.exceptions.RequestException as e:
                last_error = e
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse ZAP JSON response: {e}")
                raise ZapApiException(f"Invalid JSON response from ZAP: {e}")

        if last_error is not None:
            logger.error(f"ZAP API request failed: {last_error}")
            raise ZapApiException(f"ZAP API request failed: {last_error}")

        raise ZapApiException(f"ZAP API operation not available: {component}.{operation}")
    
    def get_version(self) -> str:
        """Get ZAP version (convenience method)"""
        return self.core.version()
    
    def new_session(self, name: str = "", overwrite: bool = False) -> Dict[str, Any]:
        """Create a new ZAP session (convenience method)"""
        return self.core.new_session(name, overwrite)
    
    def is_running(self) -> bool:
        """Check if ZAP is running and accessible"""
        try:
            self.get_version()
            return True
        except ZapApiException:
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get overall ZAP status"""
        return {
            "running": self.is_running(),
            "host": self.host,
            "port": self.port,
            "base_url": self.base_url,
            "version": self.get_version() if self.is_running() else None,
        }
