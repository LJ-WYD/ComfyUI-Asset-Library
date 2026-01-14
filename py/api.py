
import os
import json
import folder_paths
from aiohttp import web
from server import PromptServer
from PIL import Image
import io

print("[ComfyUI-Asset-Library] API module loading...")

# Define supported extensions
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'}
VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.webm', '.mkv'}
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.ogg', '.m4a'}
WORKFLOW_EXTENSIONS = {'.json'}

# 工作流封面图片存储目录
WORKFLOW_COVERS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "workflow_covers")
if not os.path.exists(WORKFLOW_COVERS_DIR):
    os.makedirs(WORKFLOW_COVERS_DIR)

class AssetManager:
    def __init__(self):
        pass

    def scan_directory(self, base_path, type_name, category_filter=None):
        files_data = []
        if not os.path.exists(base_path):
            return files_data

        for root, dirs, files in os.walk(base_path):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                
                # Determine file category
                category = "unknown"
                if ext in IMAGE_EXTENSIONS:
                    category = "image"
                elif ext in VIDEO_EXTENSIONS:
                    category = "video"
                elif ext in AUDIO_EXTENSIONS:
                    category = "audio"
                elif ext in WORKFLOW_EXTENSIONS:
                    category = "workflow"
                else:
                    continue
                
                if category_filter and category != category_filter:
                    continue
                
                full_path = os.path.join(root, file)
                stat = os.stat(full_path)
                
                rel_path = os.path.relpath(full_path, base_path)
                subfolder = os.path.dirname(rel_path)
                if subfolder == ".":
                    subfolder = ""
                
                item = {
                    "filename": file,
                    "subfolder": subfolder,
                    "type": type_name,
                    "category": category,
                    "created": stat.st_ctime,
                    "modified": stat.st_mtime,
                    "size": stat.st_size,
                    "full_path": full_path
                }
                
                # 检查工作流是否有封面图片
                if category == "workflow":
                    cover_name = os.path.splitext(file)[0] + ".png"
                    cover_path = os.path.join(WORKFLOW_COVERS_DIR, cover_name)
                    if os.path.exists(cover_path):
                        item["cover"] = cover_name
                
                files_data.append(item)
        return files_data

    def get_workflows_directory(self):
        # ComfyUI 工作流默认目录
        base_path = folder_paths.base_path
        return os.path.join(base_path, "user", "default", "workflows")

    def get_all_assets(self):
        output_dir = folder_paths.get_output_directory()
        temp_dir = folder_paths.get_temp_directory()
        workflows_dir = self.get_workflows_directory()
        
        assets = []
        assets.extend(self.scan_directory(output_dir, "output"))
        assets.extend(self.scan_directory(temp_dir, "temp"))
        assets.extend(self.scan_directory(workflows_dir, "workflow", category_filter="workflow"))
        
        # Sort by modification time descending (newest first)
        assets.sort(key=lambda x: x["modified"], reverse=True)
        return assets

    def extract_workflow_from_png(self, file_path):
        """从 PNG 图片的 metadata 中提取工作流信息"""
        try:
            with Image.open(file_path) as img:
                if hasattr(img, 'text'):
                    # ComfyUI 通常将工作流存储在 'workflow' 或 'prompt' 键中
                    if 'workflow' in img.text:
                        return json.loads(img.text['workflow'])
                    elif 'prompt' in img.text:
                        return json.loads(img.text['prompt'])
        except Exception as e:
            print(f"[AssetLibrary] Error extracting workflow from {file_path}: {e}")
        return None

asset_manager = AssetManager()

@PromptServer.instance.routes.get("/asset_library/files")
async def get_files(request):
    try:
        files = asset_manager.get_all_assets()
        # 移除 full_path 安全考虑
        for f in files:
            if 'full_path' in f:
                del f['full_path']
        return web.json_response({"files": files})
    except Exception as e:
        print(f"[AssetLibrary] Error scanning files: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/asset_library/workflow_from_image")
async def get_workflow_from_image(request):
    """从图片中提取工作流"""
    try:
        filename = request.query.get("filename", "")
        file_type = request.query.get("type", "output")
        subfolder = request.query.get("subfolder", "")
        
        if file_type == "output":
            base_dir = folder_paths.get_output_directory()
        elif file_type == "temp":
            base_dir = folder_paths.get_temp_directory()
        else:
            return web.json_response({"error": "Invalid type"}, status=400)
        
        file_path = os.path.join(base_dir, subfolder, filename)
        
        if not os.path.exists(file_path):
            return web.json_response({"error": "File not found"}, status=404)
        
        workflow = asset_manager.extract_workflow_from_png(file_path)
        if workflow:
            return web.json_response({"workflow": workflow, "has_workflow": True})
        else:
            return web.json_response({"has_workflow": False})
    except Exception as e:
        print(f"[AssetLibrary] Error extracting workflow: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/asset_library/workflow_cover/{cover_name}")
async def get_workflow_cover(request):
    """获取工作流封面图片"""
    cover_name = request.match_info.get("cover_name", "")
    cover_path = os.path.join(WORKFLOW_COVERS_DIR, cover_name)
    
    if os.path.exists(cover_path):
        return web.FileResponse(cover_path)
    else:
        return web.json_response({"error": "Cover not found"}, status=404)

@PromptServer.instance.routes.post("/asset_library/workflow_cover")
async def set_workflow_cover(request):
    """为工作流设置封面图片"""
    try:
        data = await request.post()
        workflow_name = data.get("workflow_name", "")
        cover_file = data.get("cover")
        
        if not workflow_name or not cover_file:
            return web.json_response({"error": "Missing parameters"}, status=400)
        
        cover_name = os.path.splitext(workflow_name)[0] + ".png"
        cover_path = os.path.join(WORKFLOW_COVERS_DIR, cover_name)
        
        # 保存封面图片
        content = cover_file.file.read()
        with open(cover_path, 'wb') as f:
            f.write(content)
        
        return web.json_response({"success": True, "cover": cover_name})
    except Exception as e:
        print(f"[AssetLibrary] Error setting workflow cover: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/asset_library/workflow_content")
async def get_workflow_content(request):
    """获取工作流内容"""
    try:
        filename = request.query.get("filename", "")
        subfolder = request.query.get("subfolder", "")
        
        workflows_dir = asset_manager.get_workflows_directory()
        file_path = os.path.join(workflows_dir, subfolder, filename)
        
        if not os.path.exists(file_path):
            return web.json_response({"error": "Workflow not found"}, status=404)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            workflow = json.load(f)
        
        return web.json_response({"workflow": workflow})
    except Exception as e:
        print(f"[AssetLibrary] Error loading workflow: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/asset_library/workflow_folders")
async def get_workflow_folders(request):
    """获取工作流文件夹列表"""
    try:
        workflows_dir = asset_manager.get_workflows_directory()
        folders = []
        
        for item in os.listdir(workflows_dir):
            item_path = os.path.join(workflows_dir, item)
            if os.path.isdir(item_path):
                # 统计文件夹中的工作流数量
                workflow_count = len([f for f in os.listdir(item_path) if f.endswith('.json')])
                folders.append({
                    "name": item,
                    "count": workflow_count
                })
        
        folders.sort(key=lambda x: x["name"])
        return web.json_response({"folders": folders})
    except Exception as e:
        print(f"[AssetLibrary] Error getting folders: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/asset_library/create_folder")
async def create_folder(request):
    """创建工作流文件夹"""
    try:
        data = await request.json()
        folder_name = data.get("name", "").strip()
        
        if not folder_name:
            return web.json_response({"error": "文件夹名称不能为空"}, status=400)
        
        # 验证文件夹名称（不允许特殊字符）
        invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
        if any(c in folder_name for c in invalid_chars):
            return web.json_response({"error": "文件夹名称包含非法字符"}, status=400)
        
        workflows_dir = asset_manager.get_workflows_directory()
        folder_path = os.path.join(workflows_dir, folder_name)
        
        if os.path.exists(folder_path):
            return web.json_response({"error": "文件夹已存在"}, status=400)
        
        os.makedirs(folder_path)
        return web.json_response({"success": True, "name": folder_name})
    except Exception as e:
        print(f"[AssetLibrary] Error creating folder: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/asset_library/delete_folder")
async def delete_folder(request):
    """删除工作流文件夹（仅删除空文件夹）"""
    try:
        data = await request.json()
        folder_name = data.get("name", "").strip()
        
        if not folder_name:
            return web.json_response({"error": "文件夹名称不能为空"}, status=400)
        
        workflows_dir = asset_manager.get_workflows_directory()
        folder_path = os.path.join(workflows_dir, folder_name)
        
        if not os.path.exists(folder_path):
            return web.json_response({"error": "文件夹不存在"}, status=404)
        
        if not os.path.isdir(folder_path):
            return web.json_response({"error": "不是文件夹"}, status=400)
        
        # 检查文件夹是否为空
        if os.listdir(folder_path):
            return web.json_response({"error": "文件夹不为空，请先移动或删除其中的工作流"}, status=400)
        
        os.rmdir(folder_path)
        return web.json_response({"success": True})
    except Exception as e:
        print(f"[AssetLibrary] Error deleting folder: {e}")
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/asset_library/move_workflow")
async def move_workflow(request):
    """移动工作流到指定文件夹"""
    try:
        data = await request.json()
        filename = data.get("filename", "")
        source_folder = data.get("source_folder", "")
        target_folder = data.get("target_folder", "")  # 空字符串表示根目录
        
        if not filename:
            return web.json_response({"error": "文件名不能为空"}, status=400)
        
        workflows_dir = asset_manager.get_workflows_directory()
        
        # 构建源路径和目标路径
        source_path = os.path.join(workflows_dir, source_folder, filename) if source_folder else os.path.join(workflows_dir, filename)
        target_path = os.path.join(workflows_dir, target_folder, filename) if target_folder else os.path.join(workflows_dir, filename)
        
        if not os.path.exists(source_path):
            return web.json_response({"error": "工作流文件不存在"}, status=404)
        
        if source_path == target_path:
            return web.json_response({"success": True, "message": "无需移动"})
        
        if os.path.exists(target_path):
            return web.json_response({"error": "目标位置已存在同名文件"}, status=400)
        
        # 确保目标文件夹存在
        target_dir = os.path.dirname(target_path)
        if not os.path.exists(target_dir):
            os.makedirs(target_dir)
        
        # 移动文件
        import shutil
        shutil.move(source_path, target_path)
        
        return web.json_response({"success": True, "new_subfolder": target_folder})
    except Exception as e:
        print(f"[AssetLibrary] Error moving workflow: {e}")
        return web.json_response({"error": str(e)}, status=500)
