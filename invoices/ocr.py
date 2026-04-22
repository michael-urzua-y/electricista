import os
import pytesseract
from PIL import Image
import pdf2image
import tempfile
import logging
from django.conf import settings
from io import BytesIO
import base64

logger = logging.getLogger(__name__)


class OCRProcessor:
    """Procesador de OCR para extraer texto de imágenes y PDFs"""

    def __init__(self):
        # Configurar pytesseract si es necesario
        # En Mac con Homebrew: pytesseract.pytesseract.tesseract_cmd = '/opt/homebrew/bin/tesseract'
        pass

    def extract_text(self, file_path=None, file_content=None, file_type=None):
        """
        Extrae texto de un archivo (imagen o PDF)

        Args:
            file_path: Ruta local al archivo
            file_content: Bytes del archivo
            file_type: Tipo de archivo (pdf, jpg, png)

        Returns:
            str: Texto extraído
        """
        try:
            if file_type == 'pdf':
                return self._extract_from_pdf(file_path, file_content)
            elif file_type in ['jpg', 'jpeg', 'png']:
                return self._extract_from_image(file_path, file_content)
            else:
                raise ValueError(f"Tipo de archivo no soportado: {file_type}")
        except Exception as e:
            logger.error(f"Error en OCR: {e}")
            raise

    def _extract_from_pdf(self, file_path=None, file_content=None):
        """Extrae texto de PDF"""
        # Estrategia para PDFs electrónicos (texto nativo):
        # Intentar primero con pymupdf (fitz) que extrae texto plano directamente
        try:
            import fitz  # pymupdf
            # Abrir PDF
            if file_content:
                doc = fitz.open(stream=file_content, filetype='pdf')
            elif file_path:
                doc = fitz.open(file_path)
            else:
                raise ValueError("Se requiere file_path o file_content")
            
            text_parts = []
            for page in doc:
                text = page.get_text()
                text_parts.append(text)
            
            full_text = '\n\n'.join(text_parts)
            # Si el texto extraído tiene suficientes caracteres (> 100 por página), asumimos que es bueno
            if len(full_text) > len(doc) * 100:
                logger.info(f"PDF extraído con pymupdf: {len(full_text)} caracteres")
                return full_text
            else:
                # Poco texto, probablemente PDF escaneado → intentar OCR
                logger.info("PDF parece escaneado, intentando OCR...")
                raise ValueError("PDF escaneado")
                
        except Exception as e1:
            logger.info(f"Pymupdf falló o no aplica ({e1}), intentando OCR...")
            # Fallback: convertir PDF a imágenes y hacer OCR
            try:
                if file_content:
                    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
                        tmp.write(file_content)
                        tmp_path = tmp.name
                    images = pdf2image.convert_from_path(tmp_path, dpi=300)
                    os.unlink(tmp_path)
                elif file_path:
                    images = pdf2image.convert_from_path(file_path, dpi=300)

                for img in images:
                    text = pytesseract.image_to_string(img, lang='spa')
                    text_parts.append(text)

                return '\n\n'.join(text_parts)
            except Exception as e2:
                logger.error(f"Error extrayendo PDF con OCR: {e2}")
                # Último intento: PyPDF2
                try:
                    import PyPDF2
                    reader = PyPDF2.PdfReader(file_path if file_path else BytesIO(file_content))
                    text = '\n'.join([page.extract_text() for page in reader.pages if page.extract_text()])
                    return text
                except:
                    raise

    def _extract_from_image(self, file_path=None, file_content=None):
        """Extrae texto de imagen"""
        if file_content:
            image = Image.open(BytesIO(file_content))
        elif file_path:
            image = Image.open(file_path)
        else:
            raise ValueError("Se requiere file_path o file_content")

        # Convertir a RGB si es necesario (JPEG no soporta RGBA)
        if image.mode in ('RGBA', 'LA'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background

        return pytesseract.image_to_string(image, lang='spa')
