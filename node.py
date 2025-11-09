import zipfile
import os

zip_path = "node_modules.zip"

extract_folder = "node_modules"

os.makedirs(extract_folder, exist_ok=True)

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(extract_folder)

print(f"Архив распакован в папку '{extract_folder}'")
