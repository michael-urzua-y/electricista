"""
Middleware de seguridad personalizado para Electricista Pro
Incluye: Rate limiting, logging de seguridad, headers de seguridad
"""

from django.utils.deprecation import MiddlewareMixin
from django.core.cache import cache
from django.http import JsonResponse
from django.conf import settings
import logging
import json
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class RateLimitMiddleware(MiddlewareMixin):
    """Rate limiting por IP para endpoints críticos"""
    
    RATE_LIMITS = {
        '/api/token/': (5, 60),  # 5 intentos por 60 segundos (login)
        '/api/token/refresh/': (10, 60),  # 10 intentos por minuto
        '/api/facturas/': (100, 60),  # 100 requests por minuto (aumentado para lectura)
        '/api/proveedores/': (100, 60),  # 100 requests por minuto (aumentado para lectura)
        '/api/productos/': (100, 60),  # 100 requests por minuto (aumentado para lectura)
    }
    
    def process_request(self, request):
        # Obtener IP del cliente
        ip = self.get_client_ip(request)
        
        # Verificar si el endpoint tiene límite
        for endpoint, (limit, window) in self.RATE_LIMITS.items():
            if request.path.startswith(endpoint):
                cache_key = f"rate_limit:{ip}:{endpoint}"
                
                # Obtener contador actual
                count = cache.get(cache_key, 0)
                
                if count >= limit:
                    logger.warning(
                        f"[SECURITY] Rate limit exceeded for {ip} on {endpoint}",
                        extra={
                            'ip': ip,
                            'endpoint': endpoint,
                            'count': count,
                            'limit': limit
                        }
                    )
                    return JsonResponse(
                        {
                            'error': 'Demasiadas solicitudes. Intenta más tarde.',
                            'retry_after': window
                        },
                        status=429
                    )
                
                # Incrementar contador
                cache.set(cache_key, count + 1, window)
                break
        
        return None
    
    @staticmethod
    def get_client_ip(request):
        """Obtener IP real del cliente (considerando proxies)"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class SecurityHeadersMiddleware(MiddlewareMixin):
    """Agregar headers de seguridad a todas las respuestas"""
    
    def process_response(self, request, response):
        # Prevenir clickjacking
        response['X-Frame-Options'] = 'DENY'
        
        # Prevenir MIME type sniffing
        response['X-Content-Type-Options'] = 'nosniff'
        
        # Habilitar XSS protection en navegadores antiguos
        response['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer policy
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions policy (antes Feature-Policy)
        response['Permissions-Policy'] = (
            'geolocation=(), '
            'microphone=(), '
            'camera=(), '
            'payment=(), '
            'usb=(), '
            'magnetometer=(), '
            'gyroscope=(), '
            'accelerometer=()'
        )
        
        # HSTS (solo en producción)
        if not settings.DEBUG:
            response['Strict-Transport-Security'] = (
                'max-age=31536000; includeSubDomains; preload'
            )
        
        return response


class SecurityLoggingMiddleware(MiddlewareMixin):
    """Registra eventos de seguridad importantes"""
    
    def process_request(self, request):
        ip = RateLimitMiddleware.get_client_ip(request)
        
        # Registrar intentos de acceso a admin sin autenticación
        if request.path.startswith('/admin/') and not request.user.is_authenticated:
            logger.warning(
                f"[SECURITY] Unauthorized admin access attempt from {ip}",
                extra={
                    'ip': ip,
                    'path': request.path,
                    'method': request.method,
                    'user_agent': request.META.get('HTTP_USER_AGENT', 'Unknown')
                }
            )
        
        # Registrar intentos de acceso a endpoints sensibles sin token
        sensitive_endpoints = ['/api/facturas/', '/api/proveedores/', '/api/productos/']
        if any(request.path.startswith(ep) for ep in sensitive_endpoints):
            if not request.user.is_authenticated:
                logger.warning(
                    f"[SECURITY] Unauthorized API access attempt from {ip}",
                    extra={
                        'ip': ip,
                        'path': request.path,
                        'method': request.method
                    }
                )
        
        return None
    
    def process_response(self, request, response):
        # Registrar respuestas de error 4xx y 5xx
        if response.status_code >= 400:
            ip = RateLimitMiddleware.get_client_ip(request)
            logger.warning(
                f"[SECURITY] HTTP {response.status_code} from {ip}",
                extra={
                    'ip': ip,
                    'path': request.path,
                    'method': request.method,
                    'status_code': response.status_code
                }
            )
        
        return response


class CSPMiddleware(MiddlewareMixin):
    """Content Security Policy middleware"""
    
    def process_response(self, request, response):
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' fonts.googleapis.com; "
            "font-src 'self' fonts.gstatic.com; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        response['Content-Security-Policy'] = csp
        return response
