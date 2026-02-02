"""
Check if the write area coordinates are correct by visualizing them on the warped image.
"""
import cv2
import numpy as np

# Load the warped canonical image
img = cv2.imread('debug_output/00_warped_canonical.png')
print(f"Warped image shape: {img.shape}")  # Should be (1240, 1080, 3)

# Current coordinates from the code
WRITE_AREAS = [
    ("pH", 64, 263, 438, 65),
    ("dissolved_oxygen", 574, 263, 438, 65),
    ("electrical_conductivity", 64, 443, 438, 65),
    ("turbidity", 574, 443, 438, 65),
    ("temperature", 64, 623, 438, 65),
    ("tds", 574, 623, 438, 65),
    ("nitrate", 64, 803, 438, 65),
    ("phosphate", 574, 803, 438, 65),
    ("total_hardness", 64, 983, 438, 65),
    ("residual_chlorine", 574, 983, 438, 65),
]

# Draw current coordinates in RED
for name, x, y, w, h in WRITE_AREAS:
    cv2.rectangle(img, (x, y), (x+w, y+h), (0, 0, 255), 2)  # Red
    cv2.putText(img, name[:6], (x+5, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

# Now let's try to find where the actual write areas are by looking for white boxes
# The template's write-area has white background with dark border

gray = cv2.cvtColor(cv2.imread('debug_output/00_warped_canonical.png'), cv2.COLOR_BGR2GRAY)

# Find the BRIGHTEST regions (white write areas)
# Sample brightness at grid positions to find the actual layout
print("\nSearching for actual write areas by brightness...")

# Expected grid: 2 columns x 5 rows
# Let's scan in a grid pattern to find bright regions
for row in range(5):
    for col in range(2):
        # Search in a region
        search_y = 200 + row * 180  # Start at 200, spacing ~180
        search_x = 60 + col * 510   # Left column at ~60, right at ~570
        
        # Sample a 100x50 region
        region = gray[search_y:search_y+100, search_x:search_x+400]
        mean_brightness = region.mean()
        
        # Find where brightness peaks (center of write area)
        col_brightness = region.mean(axis=0)
        row_brightness = region.mean(axis=1)
        
        # Most bright row within the search region
        peak_row = np.argmax(row_brightness)
        actual_y = search_y + peak_row
        
        print(f"  Row {row}, Col {col}: search_y={search_y}, peak_y={actual_y}, brightness={mean_brightness:.1f}")

# Let's also measure the actual locations by finding edges
print("\nLooking for horizontal lines (box borders)...")
edges = cv2.Canny(gray, 50, 150)
h_edges = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
h_edges = np.abs(h_edges)

# Sum across each row to find strong horizontal edges
row_sums = h_edges.mean(axis=1)
# Find peaks (rows with strong horizontal edges)
from scipy import signal
peaks, _ = signal.find_peaks(row_sums, height=5, distance=30)
print(f"Horizontal edge peaks at y = {peaks[:15]}...")

cv2.imwrite('debug_output/check_coordinates.png', img)
print("\nSaved debug_output/check_coordinates.png - shows current coordinates in RED")
