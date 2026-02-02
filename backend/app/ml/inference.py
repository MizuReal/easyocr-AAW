from __future__ import annotations

import re
import logging
import os
from dataclasses import dataclass
from io import BytesIO
from typing import Dict, List, Optional, Sequence, Tuple

import cv2
import numpy as np
from PIL import Image, ImageFilter, ImageOps


_RESAMPLE = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
_NUMERIC_PATTERN = re.compile(r"^-?(?:\d+\.?\d*|\d*\.\d+)$")
logger = logging.getLogger(__name__)

# Set up logging to show info level
logging.basicConfig(level=logging.INFO)

# Canonical dimensions matching the template exactly
_CANONICAL_WIDTH = 1080
_CANONICAL_HEIGHT = 1240

# Fiducial centers: 56px squares at 12px from edges -> center at 12 + 28 = 40px
_FIDUCIAL_TARGETS = np.array(
    [
        [40.0, 40.0],                                      # top-left
        [_CANONICAL_WIDTH - 40.0, 40.0],                   # top-right
        [_CANONICAL_WIDTH - 40.0, _CANONICAL_HEIGHT - 40.0],  # bottom-right
        [40.0, _CANONICAL_HEIGHT - 40.0],                  # bottom-left
    ],
    dtype=np.float32,
)

# Detection parameters
_FIDUCIAL_MIN_AREA_RATIO = 0.0004
_FIDUCIAL_MAX_AREA_RATIO = 0.025

# Debug flag - set to True to save intermediate images
DEBUG_SAVE_IMAGES = os.environ.get("OCR_DEBUG", "").lower() in ("1", "true", "yes")
DEBUG_OUTPUT_DIR = os.environ.get("OCR_DEBUG_DIR", "./ocr_debug")


# ============================================================================
# PRECISE WRITE-AREA COORDINATES - CAREFULLY CALCULATED FROM TEMPLATE
# ============================================================================
# After perspective transform, the image is exactly 1080x1240px
# The fiducials are at 12px from edges, so the "sheet" content starts at ~68px
# 
# Template structure (inside the 40px padding):
#   - header: padding-top 20px + h1 28px + meta-row ~52px = ~100px
#   - instructions: ~65px (with 16px margin-bottom)  
# ============================================================================
# WRITE-AREA COORDINATES - DETECTED FROM ACTUAL CAPTURES
# ============================================================================
# These coordinates were determined by analyzing actual captured images.
# The write areas are the white rectangular regions where numbers are written.
# 
# DETECTED POSITIONS (from contour analysis of warped image):
#   Row 0: y=306, height=97
#   Row 1: y=489, height=96  
#   Row 2: y=671, height=96
#   Row 3: y=853, height=97
#   Row 4: y=1034, height=97
#
#   Left column: x=60-61, width=445-446
#   Right column: x=573, width=446-448
#
# We add small margins inward to avoid capturing borders

_ROW_Y_POSITIONS = [306, 489, 671, 853, 1034]  # Detected y-coordinates for each row
_LEFT_COL_X = 65      # Left column starts at x=60, add 5px margin
_RIGHT_COL_X = 578    # Right column starts at x=573, add 5px margin
_WRITE_WIDTH = 435    # Detected ~445px, subtract margins
_WRITE_HEIGHT = 85    # Detected ~97px, subtract margins for safety


@dataclass(frozen=True)
class WriteAreaSpec:
    """Precise pixel coordinates of a write-area in the canonical 1080x1240 image."""
    name: str
    x: int      # Left edge (pixels)
    y: int      # Top edge (pixels)
    width: int  # Width (pixels)
    height: int # Height (pixels)


def _compute_write_areas() -> Tuple[WriteAreaSpec, ...]:
    """
    Compute exact pixel coordinates for all 10 write-areas.
    Layout: 5 rows x 2 columns
    Coordinates based on actual image analysis, not template CSS.
    """
    # Field names in order: left column then right column for each row
    # Updated to match new water quality parameters
    fields = [
        ("pH", 0, 0),                      # Row 0, Left
        ("hardness", 0, 1),                # Row 0, Right
        ("solids", 1, 0),                  # Row 1, Left
        ("chloramines", 1, 1),             # Row 1, Right
        ("sulfate", 2, 0),                 # Row 2, Left
        ("conductivity", 2, 1),            # Row 2, Right
        ("organic_carbon", 3, 0),          # Row 3, Left
        ("trihalomethanes", 3, 1),         # Row 3, Right
        ("turbidity", 4, 0),               # Row 4, Left
        ("free_chlorine_residual", 4, 1),  # Row 4, Right
    ]
    
    areas = []
    for name, row, col in fields:
        x = _LEFT_COL_X if col == 0 else _RIGHT_COL_X
        y = _ROW_Y_POSITIONS[row] + 5  # Add small top margin
        
        areas.append(WriteAreaSpec(
            name=name,
            x=x,
            y=y,
            width=_WRITE_WIDTH,
            height=_WRITE_HEIGHT,
        ))
    
    return tuple(areas)


WRITE_AREAS = _compute_write_areas()


def _load_and_normalize(image_bytes: bytes, target_long_edge: int = 1600) -> Tuple[np.ndarray, bool]:
    """
    Load image and attempt perspective correction using fiducials.
    Returns (image, is_canonical) where is_canonical=True means fiducials were found
    and image is warped to exact 1080x1240.
    """
    if not image_bytes:
        raise ValueError("No image payload provided")
    try:
        with Image.open(BytesIO(image_bytes)) as pil_img:
            pil_img = ImageOps.exif_transpose(pil_img)
            pil_img = pil_img.convert("RGB")
            
            # Minimal preprocessing - don't over-process before detection
            width, height = pil_img.size
            long_edge = max(width, height)
            if long_edge == 0:
                raise ValueError("Invalid image dimensions")
            
            # Scale to reasonable size for processing
            scale = target_long_edge / long_edge
            if abs(scale - 1.0) > 0.05:
                pil_img = pil_img.resize((int(width * scale), int(height * scale)), _RESAMPLE)
            
            image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception as exc:
        raise ValueError("Unable to decode image for OCR processing") from exc
    
    # Try fiducial-based warping first
    warped = _warp_with_fiducials(image)
    if warped is not None:
        logger.info("Fiducials detected - using perspective-corrected image")
        if DEBUG_SAVE_IMAGES:
            _save_debug_image(warped, "01_warped.png")
        return warped, True
    
    # Fallback: just deskew
    logger.warning("Fiducials NOT detected - using fallback deskew (accuracy will be reduced)")
    deskewed = _deskew(image)
    return deskewed, False


def _save_debug_image(image: np.ndarray, filename: str) -> None:
    """Save debug image if DEBUG_SAVE_IMAGES is enabled."""
    if not DEBUG_SAVE_IMAGES:
        return
    try:
        os.makedirs(DEBUG_OUTPUT_DIR, exist_ok=True)
        path = os.path.join(DEBUG_OUTPUT_DIR, filename)
        cv2.imwrite(path, image)
        logger.debug("Saved debug image: %s", path)
    except Exception as e:
        logger.warning("Failed to save debug image %s: %s", filename, e)


def _deskew(image: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.bitwise_not(gray)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    coords = cv2.findNonZero(thresh)
    if coords is None:
        return image
    rect = cv2.minAreaRect(coords)
    angle = rect[-1]
    angle = -(90 + angle) if angle < -45 else -angle
    if abs(angle) < 1:
        return image
    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width // 2, height // 2), angle, 1.0)
    return cv2.warpAffine(image, matrix, (width, height), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _warp_with_fiducials(image: np.ndarray) -> Optional[np.ndarray]:
    fiducials = _detect_fiducials(image)
    if fiducials is None:
        logger.debug("Fiducial detection failed - could not find all 4 corners")
        return None
    ordered = np.array(
        [fiducials[label] for label in ("tl", "tr", "br", "bl")],
        dtype=np.float32,
    )
    logger.info("Fiducials detected at: tl=%s tr=%s br=%s bl=%s", 
                fiducials.get("tl"), fiducials.get("tr"), 
                fiducials.get("br"), fiducials.get("bl"))
    matrix = cv2.getPerspectiveTransform(ordered, _FIDUCIAL_TARGETS)
    return cv2.warpPerspective(
        image,
        matrix,
        (_CANONICAL_WIDTH, _CANONICAL_HEIGHT),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def _detect_fiducials(image: np.ndarray) -> Optional[Dict[str, np.ndarray]]:
    """
    Robust detection of solid BLACK square fiducial markers.
    
    Uses multiple thresholding strategies to handle varying lighting conditions.
    The markers are pure black 56x56px squares positioned in the corners.
    """
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    image_area = float(height * width)
    min_area = image_area * _FIDUCIAL_MIN_AREA_RATIO
    max_area = image_area * _FIDUCIAL_MAX_AREA_RATIO
    
    all_candidates: List[Tuple[str, float, float, float]] = []
    
    # Strategy 1: Fixed threshold for pure black
    _, thresh1 = cv2.threshold(gray, 80, 255, cv2.THRESH_BINARY_INV)
    
    # Strategy 2: Otsu's method
    _, thresh2 = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    
    # Strategy 3: Adaptive threshold for uneven lighting
    thresh3 = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 51, 15
    )
    
    for thresh in [thresh1, thresh2, thresh3]:
        # Morphological cleanup
        kernel = np.ones((3, 3), np.uint8)
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel, iterations=1)
        
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < min_area or area > max_area:
                continue
            
            x, y, w, h = cv2.boundingRect(contour)
            if h == 0:
                continue
            
            # Must be roughly square
            aspect = w / float(h)
            if aspect < 0.65 or aspect > 1.5:
                continue
            
            # Check solidity (must be filled)
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            if hull_area == 0:
                continue
            solidity = area / hull_area
            if solidity < 0.75:
                continue
            
            # Verify the region is actually dark
            mask = np.zeros(gray.shape, dtype=np.uint8)
            cv2.drawContours(mask, [contour], -1, 255, -1)
            mean_intensity = cv2.mean(gray, mask=mask)[0]
            if mean_intensity > 120:
                continue
            
            cx = x + w / 2.0
            cy = y + h / 2.0
            label = _classify_corner(cx, cy, width, height)
            
            if label:
                score = solidity * (1.0 - abs(1.0 - aspect))
                all_candidates.append((label, cx, cy, score))
    
    # Remove duplicates and pick best for each corner
    corners: Dict[str, np.ndarray] = {}
    for label in ("tl", "tr", "br", "bl"):
        best = None
        for cand in all_candidates:
            if cand[0] == label:
                if best is None or cand[3] > best[3]:
                    best = cand
        if best:
            corners[label] = np.array([best[1], best[2]], dtype=np.float32)
    
    logger.debug("Fiducial detection found %d/4 corners: %s", len(corners), list(corners.keys()))
    return corners if len(corners) == 4 else None


def _classify_corner(cx: float, cy: float, width: int, height: int) -> Optional[str]:
    """Classify a detected marker as one of the four corners."""
    # Fiducials should be in the outer 35% of each dimension
    margin_ratio = 0.35
    
    if cx < width * margin_ratio:
        x_side = "l"
    elif cx > width * (1 - margin_ratio):
        x_side = "r"
    else:
        return None
    
    if cy < height * margin_ratio:
        y_side = "t"
    elif cy > height * (1 - margin_ratio):
        y_side = "b"
    else:
        return None
    
    return y_side + x_side


# ============================================================================
# NEW SIMPLIFIED PREPROCESSING - Less aggressive, preserves digit features
# ============================================================================

def _preprocess_for_ocr_simple(region: np.ndarray) -> np.ndarray:
    """
    Preprocessing for photographed forms (not scans).
    
    Key insight: Camera photos have grayish backgrounds (~190-200) not pure white.
    We need ADAPTIVE thresholding to handle uneven lighting.
    Also need to filter out template guide lines while keeping dark ink.
    """
    if region.size == 0:
        return region
    
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    
    # Upscale 2x for better digit recognition
    h, w = gray.shape
    scaled = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    
    # Apply CLAHE to normalize contrast across the region
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    normalized = clahe.apply(scaled)
    
    # Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(normalized, (5, 5), 0)
    
    # ADAPTIVE thresholding - works with uneven lighting from photos
    # blockSize=31 looks at local ~15px neighborhood
    # C=35 means pixel must be 35 units darker than local mean to be "ink"
    # Higher C = more aggressive filtering of light pixels (guide lines, shadows)
    binary = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=35  # Aggressive - filters out guide lines and faint artifacts
    )
    
    # Morphological operations to clean up
    kernel = np.ones((2, 2), np.uint8)
    # Open to remove small noise specks (like guide line remnants)
    cleaned = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    # Close to connect broken strokes
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel)
    
    # Add border padding (helps OCR)
    padded = cv2.copyMakeBorder(cleaned, 10, 10, 10, 10, cv2.BORDER_CONSTANT, value=255)
    
    return cv2.cvtColor(padded, cv2.COLOR_GRAY2BGR)


def _preprocess_for_ocr_binarized(region: np.ndarray) -> np.ndarray:
    """
    Alternative preprocessing with Otsu's method.
    Used when adaptive thresholding doesn't work well.
    Otsu automatically finds the optimal threshold for bimodal distributions.
    """
    if region.size == 0:
        return region
    
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
    
    # Upscale
    h, w = gray.shape
    scaled = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
    
    # Apply CLAHE first to improve contrast
    clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(scaled)
    
    # Gaussian blur
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)
    
    # Otsu's method automatically finds the optimal threshold
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Remove small noise with morphological open
    kernel = np.ones((2, 2), np.uint8)
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    
    # Close small gaps in strokes
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
    
    # Padding
    padded = cv2.copyMakeBorder(closed, 10, 10, 10, 10, cv2.BORDER_CONSTANT, value=255)
    
    return cv2.cvtColor(padded, cv2.COLOR_GRAY2BGR)


# ============================================================================
# NEW EXTRACTOR CLASS - Uses precise pixel coordinates
# ============================================================================

class WaterQualityOCRExtractor:
    """
    Extracts numeric values from water quality data sheet.
    
    Key design decisions:
    1. Uses ABSOLUTE PIXEL coordinates (not ratios) for maximum precision
    2. Targets ONLY the write-areas (not labels) 
    3. Minimal preprocessing to preserve digit features
    4. Multiple OCR attempts with different preprocessing
    5. Robust decimal detection
    """
    
    def __init__(
        self,
        write_areas: Sequence[WriteAreaSpec],
        *,
        confidence_threshold: float = 0.15,  # Very low - we validate with regex
    ) -> None:
        self._areas = tuple(write_areas)
        self._threshold = confidence_threshold
        # Allow digits and decimal point/comma
        self._allowlist = "0123456789.,"
    
    def extract(self, image_bytes: bytes, reader: "easyocr.Reader") -> Dict[str, Optional[str]]:
        """Extract all field values from the image."""
        logger.info("=" * 60)
        logger.info("STARTING OCR EXTRACTION")
        logger.info("=" * 60)
        
        image, is_canonical = _load_and_normalize(image_bytes)
        
        logger.info(f"Image loaded: shape={image.shape}, is_canonical={is_canonical}")
        
        results: Dict[str, Optional[str]] = {area.name: None for area in self._areas}
        
        if not is_canonical:
            logger.error("FIDUCIALS NOT DETECTED - Cannot use fixed coordinates!")
            logger.error("The image will be processed with fallback which is very inaccurate")
            return self._fallback_full_ocr(image, reader)
        
        # Save the warped image for debugging
        if DEBUG_SAVE_IMAGES:
            _save_debug_image(image, "00_warped_canonical.png")
            # Also save with regions drawn
            debug_img = image.copy()
            for area in self._areas:
                cv2.rectangle(debug_img, (area.x, area.y), 
                             (area.x + area.width, area.y + area.height), 
                             (0, 255, 0), 2)
                cv2.putText(debug_img, area.name[:6], (area.x, area.y - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)
            _save_debug_image(debug_img, "00_regions_overlay.png")
        
        # Process each write area
        for idx, area in enumerate(self._areas):
            logger.info(f"\n--- Processing field: {area.name} ---")
            logger.info(f"    Region: x={area.x}, y={area.y}, w={area.width}, h={area.height}")
            
            region = self._crop_write_area(image, area)
            logger.info(f"    Cropped region shape: {region.shape}")
            
            if DEBUG_SAVE_IMAGES:
                _save_debug_image(region, f"region_{idx:02d}_{area.name}_raw.png")
            
            # Try BOTH preprocessing methods and pick the best result
            value_simple = self._extract_from_region(region, reader, area.name, "simple")
            value_binarized = self._extract_from_region(region, reader, area.name, "binarized")
            
            # Smart selection: prefer longer valid result (more digits captured)
            # This helps with cases like "4.0" vs "0" - pick "4.0"
            value = self._select_best_value(value_simple, value_binarized, area.name)
            
            results[area.name] = value
            logger.info(f"    FINAL VALUE for {area.name}: {value}")
        
        logger.info("=" * 60)
        logger.info(f"EXTRACTION COMPLETE: {results}")
        logger.info("=" * 60)
        
        return results
    
    def _crop_write_area(self, image: np.ndarray, area: WriteAreaSpec) -> np.ndarray:
        """Crop write area with small safety margin."""
        h, w = image.shape[:2]
        
        # Add small margin to handle slight misalignment
        margin = 3
        x1 = max(0, area.x - margin)
        y1 = max(0, area.y - margin)
        x2 = min(w, area.x + area.width + margin)
        y2 = min(h, area.y + area.height + margin)
        
        logger.debug(f"    Crop bounds: ({x1},{y1}) to ({x2},{y2})")
        
        return image[y1:y2, x1:x2]
    
    def _extract_from_region(
        self, 
        region: np.ndarray, 
        reader: "easyocr.Reader",
        field_name: str,
        preprocess_mode: str
    ) -> Optional[str]:
        """Extract numeric value from a single region."""
        if region.size == 0:
            logger.warning(f"    Empty region for {field_name}")
            return None
        
        # Apply preprocessing
        if preprocess_mode == "simple":
            processed = _preprocess_for_ocr_simple(region)
        else:
            processed = _preprocess_for_ocr_binarized(region)
        
        logger.info(f"    Preprocessing mode: {preprocess_mode}, result shape: {processed.shape}")
        
        if DEBUG_SAVE_IMAGES:
            _save_debug_image(processed, f"region_{field_name}_{preprocess_mode}.png")
        
        # Run EasyOCR with tuned parameters
        # Balanced settings: capture more text while filtering noise
        try:
            detections = reader.readtext(
                processed,
                allowlist=self._allowlist,
                detail=1,
                paragraph=False,
                min_size=8,           # Slightly smaller to catch decimal points
                text_threshold=0.4,   # Lower threshold to catch more characters
                low_text=0.3,         # More permissive for faint strokes
                link_threshold=0.6,   # Link nearby characters (helps "4.0" stay together)
                decoder='greedy',     # Faster, works well for numbers
                batch_size=1,
                contrast_ths=0.2,     # Lower contrast requirement
                adjust_contrast=0.6,  # Moderate contrast adjustment
                width_ths=0.8,        # Allow wider character spacing
                mag_ratio=1.5,        # Magnify text slightly for detection
            )
            
            logger.info(f"    EasyOCR detections ({preprocess_mode}): {len(detections)} items")
            for det in detections:
                bbox, text, conf = det
                logger.info(f"      -> text='{text}', conf={conf:.3f}")
                
        except Exception as e:
            logger.error(f"    OCR failed for {field_name}: {e}")
            return None
        
        if not detections:
            logger.info(f"    No detections for {field_name} with {preprocess_mode}")
            return None
        
        # Process all detections
        result = self._process_detections(detections)
        logger.info(f"    Processed result ({preprocess_mode}): {result}")
        return result
    
    def _process_detections(self, detections: List) -> Optional[str]:
        """
        Process OCR detections into a clean numeric value.
        
        Strategy:
        1. Filter by confidence threshold
        2. Sort by x-position (left to right)
        3. Combine spatially close detections
        4. Clean and validate the result
        """
        if not detections:
            return None
        
        # Minimum confidence - lowered slightly to catch decimal points
        # which sometimes have lower confidence
        MIN_CONF = 0.15
        
        # Filter to only confident detections
        confident_dets = [d for d in detections if d[2] >= MIN_CONF]
        
        logger.info(f"    Confident detections (conf >= {MIN_CONF}): {len(confident_dets)}/{len(detections)}")
        
        if not confident_dets:
            # NO confident detections - return None, don't use garbage
            logger.info(f"    No confident detections - returning None (not using low-conf garbage)")
            return None
        
        # Sort confident detections by x-position (left to right)
        sorted_dets = sorted(confident_dets, key=lambda d: d[0][0][0] if d[0] else 0)
        
        # Check if detections should be combined (spatially close = same number)
        # or if they're separate entities
        if len(sorted_dets) == 1:
            text = str(sorted_dets[0][1]).strip()
            cleaned = self._clean_numeric(text)
            logger.info(f"    Single detection: '{text}' -> '{cleaned}'")
            if cleaned and self._is_valid_number(cleaned):
                return cleaned
            return None
        
        # Multiple detections - combine only if they look like parts of one number
        # Check spatial proximity: if gap between detections is small, combine them
        combined_text = ""
        last_x_end = None
        
        for det in sorted_dets:
            bbox, text, conf = det
            x_start = bbox[0][0]  # Top-left x
            x_end = bbox[1][0]    # Top-right x
            
            if last_x_end is not None:
                gap = x_start - last_x_end
                # If gap is large (>50 pixels after 2x scaling = 25 original), treat as separate
                if gap > 100:
                    logger.info(f"    Large gap ({gap}px) - ignoring subsequent detection")
                    break
            
            combined_text += str(text).strip()
            last_x_end = x_end
        
        logger.info(f"    Combined text: '{combined_text}'")
        cleaned = self._clean_numeric(combined_text)
        logger.info(f"    After cleaning: '{cleaned}'")
        
        if cleaned and self._is_valid_number(cleaned):
            return cleaned
        
        return None
    
    def _clean_numeric(self, text: str) -> str:
        """
        Clean OCR output to extract numeric value.
        
        CONSERVATIVE approach - only fix obvious OCR errors,
        don't aggressively convert letters to digits.
        """
        if not text:
            return ""
        
        # Very conservative corrections - only the most common OCR errors
        # that are unambiguous
        corrections = {
            'O': '0',   # Capital O -> 0
            'o': '0',   # Lowercase o -> 0 (when in numeric context)
            'l': '1',   # Lowercase L -> 1
            'I': '1',   # Capital I -> 1  
            '|': '1',   # Pipe -> 1
            ',': '.',   # European decimal comma -> point
        }
        
        result = []
        for char in text:
            # Only apply correction if the character is in our limited set
            corrected = corrections.get(char, char)
            result.append(corrected)
        
        # Extract only digits and decimal points
        cleaned = ""
        has_decimal = False
        for char in result:
            if char.isdigit():
                cleaned += char
            elif char == '.' and not has_decimal:
                # Only add decimal if we have at least one digit before it
                # or if it's at the start (like ".5")
                cleaned += '.'
                has_decimal = True
        
        # Clean up the result
        # Remove leading zeros except for "0.xxx" 
        if cleaned and len(cleaned) > 1:
            if cleaned.startswith('0') and len(cleaned) > 1 and cleaned[1] != '.':
                cleaned = cleaned.lstrip('0') or '0'
        
        # Remove trailing decimal with no digits after
        if cleaned.endswith('.'):
            cleaned = cleaned[:-1]
        
        # Handle leading decimal (add 0)
        if cleaned.startswith('.'):
            cleaned = '0' + cleaned
        
        return cleaned
    
    def _is_valid_number(self, text: str) -> bool:
        """Check if text is a valid numeric value."""
        if not text:
            return False
        try:
            val = float(text)
            # Reasonable range for water quality parameters
            return -50 <= val <= 50000
        except ValueError:
            return False
    
    def _select_best_value(self, value1: Optional[str], value2: Optional[str], field_name: str) -> Optional[str]:
        """
        Select the best value from two OCR attempts.
        
        Strategy:
        1. If both are None, return None
        2. If only one has a value, return that
        3. If both have values, prefer the one with more information (longer, has decimal)
        4. If equal length, prefer the one that looks more like a typical measurement
        """
        logger.info(f"    Selecting best value: simple='{value1}' vs binarized='{value2}'")
        
        if value1 is None and value2 is None:
            return None
        if value1 is None:
            return value2
        if value2 is None:
            return value1
        
        # Both have values - need to pick the better one
        
        # Score each value
        def score_value(val: str) -> tuple:
            """Return (length, has_decimal, num_digits, numeric_value)"""
            if not val:
                return (0, 0, 0, 0)
            has_decimal = 1 if '.' in val else 0
            num_digits = sum(1 for c in val if c.isdigit())
            try:
                numeric = float(val)
            except:
                numeric = 0
            return (len(val), has_decimal, num_digits, numeric)
        
        score1 = score_value(value1)
        score2 = score_value(value2)
        
        logger.info(f"    Scores: '{value1}'={score1} vs '{value2}'={score2}")
        
        # Prefer value with more digits (captures more of the number)
        if score1[2] > score2[2]:
            logger.info(f"    Selected '{value1}' (more digits)")
            return value1
        if score2[2] > score1[2]:
            logger.info(f"    Selected '{value2}' (more digits)")
            return value2
        
        # Same digit count - prefer one with decimal (more precise)
        if score1[1] > score2[1]:
            logger.info(f"    Selected '{value1}' (has decimal)")
            return value1
        if score2[1] > score1[1]:
            logger.info(f"    Selected '{value2}' (has decimal)")
            return value2
        
        # Still tied - prefer longer string
        if score1[0] > score2[0]:
            logger.info(f"    Selected '{value1}' (longer)")
            return value1
        if score2[0] > score1[0]:
            logger.info(f"    Selected '{value2}' (longer)")
            return value2
        
        # Completely tied - prefer simple preprocessing result
        logger.info(f"    Tied - defaulting to simple: '{value1}'")
        return value1

    def _fallback_full_ocr(
        self, 
        image: np.ndarray, 
        reader: "easyocr.Reader"
    ) -> Dict[str, Optional[str]]:
        """Fallback: try to extract any numbers from full image."""
        logger.warning("Using fallback full-image OCR - results will be poor!")
        results = {area.name: None for area in self._areas}
        
        # This is a last resort - accuracy will be low
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            detections = reader.readtext(
                gray,
                allowlist="0123456789.",
                detail=1,
                paragraph=False,
            )
            
            logger.info(f"Fallback found {len(detections)} detections")
            
            # Extract any valid numbers found
            numbers = []
            for det in detections:
                text = self._clean_numeric(str(det[1]))
                if text and self._is_valid_number(text):
                    numbers.append(text)
                    logger.info(f"  Fallback number: {text}")
            
            # Assign found numbers to fields (best effort)
            for i, area in enumerate(self._areas):
                if i < len(numbers):
                    results[area.name] = numbers[i]
        except Exception as e:
            logger.error("Fallback OCR failed: %s", e)
        
        return results


# Create the extractor instance with our precise write areas
EXTRACTOR = WaterQualityOCRExtractor(WRITE_AREAS)

