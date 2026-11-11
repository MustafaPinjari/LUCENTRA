"""Custom API exception handling for LUCENTRA backend.

Produces structured, standardized error responses across all endpoints:
{
    "error": {
        "code": "<string_code>",
        "message": "<human_readable_message>",
        "details": <dict_or_null>
    }
}
"""

import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)


class LucentraAPIException(APIException):
    """Base exception for domain-specific LUCENTRA errors."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "lucentra_error"
    default_detail = "A business logic error occurred."

    def __init__(self, detail=None, code=None, status_code=None):
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail=detail, code=code)


def custom_exception_handler(exc, context):
    """Transform DRF and unhandled exceptions into uniform JSON format."""
    # Call REST framework's default exception handler first,
    # to get the standard error response.
    response = exception_handler(exc, context)

    view = context.get("view")
    view_name = view.__class__.__name__ if view else "UnknownView"

    if response is not None:
        # Standard DRF exception (e.g. ValidationError, NotFound, PermissionDenied)
        code = getattr(exc, "default_code", "validation_error")
        if hasattr(exc, "get_codes"):
            codes = exc.get_codes()
            if isinstance(codes, str):
                code = codes
            elif isinstance(codes, dict) and "code" in codes:
                code = codes["code"]

        message = "Validation or processing error"
        details = response.data

        if isinstance(response.data, dict) and "detail" in response.data:
            message = str(response.data["detail"])
            details = None
        elif isinstance(response.data, list) and len(response.data) > 0:
            message = str(response.data[0])

        formatted_data = {
            "error": {
                "code": str(code),
                "message": message,
                "details": details,
            }
        }
        response.data = formatted_data
        return response

    # Unhandled exceptions (500)
    logger.exception("Unhandled server exception in %s: %s", view_name, str(exc))
    return Response(
        {
            "error": {
                "code": "internal_server_error",
                "message": "An unexpected server error occurred.",
                "details": str(exc) if getattr(context.get("request"), "is_debug", False) else None,
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
