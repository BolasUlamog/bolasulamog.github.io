from PIL import Image
import os

img_path = 'data/images/page-16.png'
if os.path.exists(img_path):
    img = Image.open(img_path)
    
    # Very tight crop to grab ONLY the diagram, avoiding the text above and below.
    # Image size is 1275x1650
    # Top text ends around y=220. Bottom text starts around y=980.
    cropped = img.crop((50, 240, 1225, 960))
    cropped.save('data/images/setup_diagram.png')
    print("Tight crop successful.")
else:
    print("Page 16 not found.")
