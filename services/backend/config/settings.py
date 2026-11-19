"""Django settings for LUCENTRA backend service.

Sprint 3 - SQLite Database & Local Anvil Integration.
"""

from pathlib import Path
import os
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent.parent

# Load environment variables from .env if present
root_env = REPO_ROOT / ".env"
if root_env.exists():
    load_dotenv(root_env)

env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(env_file, override=True)
else:
    load_dotenv()

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "lucentra-local-dev-secret-key-insecure-only-for-local-development-1234567890",
)

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,[::1],testserver").split(",")

# Application definition
INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "corsheaders",
    # Local apps
    "apps.publishers",
    "apps.domains",
    "apps.releases",
    "apps.attestations",
    "apps.audit",
    "apps.ai",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Database: SQLite ONLY for Sprint 3
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Django REST Framework Configuration
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "EXCEPTION_HANDLER": "config.exceptions.custom_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True

# LUCENTRA Blockchain & CLI Configuration
ANVIL_RPC_URL = os.getenv("ANVIL_RPC_URL", "http://127.0.0.1:8545")
CHAIN_ID = int(os.getenv("CHAIN_ID", "31337"))
CORE_CLI_PATH = os.getenv(
    "CORE_PACKAGE_CLI_PATH",
    str(REPO_ROOT / "packages" / "core" / "dist" / "src" / "cli.js"),
)
DEPLOYMENT_CONFIG_PATH = os.getenv(
    "DEPLOYMENT_CONFIG_PATH",
    str(REPO_ROOT / "deployments" / "local" / "deployment.json"),
)

LOCAL_ANVIL_REGISTRAR_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
reg_key_env = os.getenv("REGISTRAR_PRIVATE_KEY", "").strip()

if not reg_key_env or reg_key_env == "0x" + "0" * 64:
    if CHAIN_ID != 31337:
        from django.core.exceptions import ImproperlyConfigured
        raise ImproperlyConfigured(
            f"REGISTRAR_PRIVATE_KEY must be explicitly configured for non-local network (CHAIN_ID={CHAIN_ID})."
        )
    REGISTRAR_PRIVATE_KEY = LOCAL_ANVIL_REGISTRAR_KEY
else:
    if CHAIN_ID != 31337 and reg_key_env.lower() == LOCAL_ANVIL_REGISTRAR_KEY.lower():
        from django.core.exceptions import ImproperlyConfigured
        raise ImproperlyConfigured(
            "Security violation: Default Anvil local testnet private key cannot be used on non-local networks."
        )
    REGISTRAR_PRIVATE_KEY = reg_key_env

# DNS Verification Engine Configuration
DNS_CHALLENGE_PREFIX = os.getenv("DNS_CHALLENGE_PREFIX", "_lucentra-verification")
DNS_CHALLENGE_TTL_SECONDS = int(os.getenv("DNS_CHALLENGE_TTL_SECONDS", "900"))  # 15 min
DNS_CHALLENGE_MAX_ATTEMPTS = int(os.getenv("DNS_CHALLENGE_MAX_ATTEMPTS", "5"))
DNS_TIMEOUT_SECONDS = float(os.getenv("DNS_TIMEOUT_SECONDS", "5.0"))

# Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} [{name}:{lineno}] {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.getenv("DJANGO_LOG_LEVEL", "INFO"),
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "apps": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "blockchain": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}
