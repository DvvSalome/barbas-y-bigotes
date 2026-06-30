import sys
from PIL import Image

def remove_background(input_path, output_path, threshold=25):
    try:
        img = Image.open(input_path).convert("RGBA")
        datas = img.getdata()
        
        newData = []
        for item in datas:
            # item is (R, G, B, A)
            # If the pixel is very dark (close to black), make it transparent
            if item[0] < threshold and item[1] < threshold and item[2] < threshold:
                newData.append((0, 0, 0, 0)) # fully transparent
            else:
                newData.append(item)
                
        img.putdata(newData)
        img.save(output_path, "PNG")
        print(f"Success! Saved transparent image to {output_path}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    remove_background(sys.argv[1], sys.argv[2])
