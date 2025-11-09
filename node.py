#!/usr/bin/env python3
import zipfile
import os
import shutil

ZIP_PATH = "node_modules.zip"
EXTRACT_FOLDER = "node_modules"

def safe_make_dir(path):
    os.makedirs(path, exist_ok=True)

def is_within_directory(directory, target):
    # Защита от zip-slip
    abs_directory = os.path.abspath(directory)
    abs_target = os.path.abspath(target)
    return os.path.commonpath([abs_directory]) == os.path.commonpath([abs_directory, abs_target])

def safe_extract_member(zipf, member, target_path):
    # member: ZipInfo
    member_name = member.filename
    if member.is_dir():
        safe_make_dir(target_path)
        return
    # ensure parent dir exists
    parent = os.path.dirname(target_path)
    if parent:
        safe_make_dir(parent)
    with zipf.open(member, "r") as source, open(target_path, "wb") as dest:
        shutil.copyfileobj(source, dest)

def main():
    if not os.path.isfile(ZIP_PATH):
        print(f"Архив не найден: {ZIP_PATH}")
        return

    safe_make_dir(EXTRACT_FOLDER)

    with zipfile.ZipFile(ZIP_PATH, "r") as z:
        names = z.namelist()

        # Проверим, есть ли в архиве упоминания node_modules/
        has_node_modules_paths = any(("node_modules/" in n) or (n.rstrip("/") == "node_modules") for n in names)

        if has_node_modules_paths:
            # Извлекаем только то, что внутри node_modules, удаляя префикс до node_modules/
            for member in z.infolist():
                name = member.filename
                # Игнорируем мета-пути типа __MACOSX, но это не обязательно
                if "node_modules/" in name:
                    # берем часть после первого вхождения 'node_modules/'
                    rel = name.split("node_modules/", 1)[1]
                    if not rel:
                        # если это сама папка node_modules (директория), пропускаем
                        continue
                    dest = os.path.join(EXTRACT_FOLDER, rel)
                elif name.rstrip("/") == "node_modules":
                    # папка node_modules сама по себе — пропускаем
                    continue
                else:
                    # игнорируем все, что не внутри node_modules
                    continue

                # защита от выхода за пределы папки назначения
                if not is_within_directory(EXTRACT_FOLDER, dest):
                    raise Exception("Обнаружен потенциально опасный путь в архиве: " + name)

                # создаем и записываем
                if member.is_dir():
                    safe_make_dir(dest)
                else:
                    safe_make_dir(os.path.dirname(dest) or ".")
                    safe_extract_member(z, member, dest)
        else:
            # В архиве нет node_modules — распакуем всё как есть в папку EXTRACT_FOLDER
            for member in z.infolist():
                dest = os.path.join(EXTRACT_FOLDER, member.filename)
                # защита от zip-slip
                if not is_within_directory(EXTRACT_FOLDER, dest):
                    raise Exception("Обнаружен потенциально опасный путь в архиве: " + member.filename)
                if member.is_dir():
                    safe_make_dir(dest)
                else:
                    safe_make_dir(os.path.dirname(dest) or ".")
                    safe_extract_member(z, member, dest)

    print(f"Рас упаковка завершена в папку: {EXTRACT_FOLDER}")

if __name__ == "__main__":
    main()
