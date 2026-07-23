from PIL import Image
import sys

img1_path = "/Users/laxmansirvi/.gemini/antigravity-ide/brain/076d74e7-bf68-43b7-b233-f679c6d84a64/opportunity-radar-screenshot.png"
img2_path = "/Users/laxmansirvi/.gemini/antigravity-ide/brain/076d74e7-bf68-43b7-b233-f679c6d84a64/reactive-resume-screenshot.png"
out_path = "/Users/laxmansirvi/.gemini/antigravity-ide/brain/076d74e7-bf68-43b7-b233-f679c6d84a64/screenshot-comparison.png"

try:
    img1 = Image.open(img1_path)
    img2 = Image.open(img2_path)
    
    # ensure both are same height
    max_height = max(img1.height, img2.height)
    
    # create new image
    new_img = Image.new('RGB', (img1.width + img2.width + 20, max_height), (255, 255, 255))
    
    new_img.paste(img1, (0, 0))
    new_img.paste(img2, (img1.width + 20, 0))
    
    new_img.save(out_path)
    print("Comparison created at", out_path)
except Exception as e:
    print("Error:", e)
