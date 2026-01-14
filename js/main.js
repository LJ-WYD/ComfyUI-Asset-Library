console.log("[ComfyUI-Asset-Library] JS file loading...");

import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

console.log("[ComfyUI-Asset-Library] Imports successful");

// Load CSS
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = "extensions/ComfyUI-Asset-Library/style.css"; // Check path resolution
document.head.appendChild(link);

class AssetLibrary {
    constructor() {
        this.visible = false;
        this.assets = [];
        this.filter = "all";

        // 分页相关
        this.currentPage = 1;
        this.itemsPerPage = 50;

        // 文件夹导航 (用于工作流)
        this.currentFolder = ""; // 当前文件夹路径

        this.createUI();
    }

    createUI() {
        // Modal Shell
        this.modal = document.createElement("div");
        this.modal.className = "comfy-asset-library-modal";

        this.container = document.createElement("div");
        this.container.className = "comfy-asset-library-container";
        this.modal.appendChild(this.container);

        // Header
        const header = document.createElement("div");
        header.className = "comfy-asset-library-header";
        header.innerHTML = `
            <div class="comfy-asset-library-title">Asset Library (资产库)</div>
            <button class="comfy-asset-library-close">×</button>
        `;
        header.querySelector(".comfy-asset-library-close").onclick = () => this.toggle();
        this.container.appendChild(header);

        // Body
        const body = document.createElement("div");
        body.className = "comfy-asset-library-body";
        this.container.appendChild(body);

        // Sidebar
        this.sidebar = document.createElement("div");
        this.sidebar.className = "comfy-asset-library-sidebar";
        this.sidebar.innerHTML = `
            <div class="comfy-asset-library-filter active" data-filter="all">All (全部)</div>
            <div class="comfy-asset-library-filter" data-filter="image">Images (图片)</div>
            <div class="comfy-asset-library-filter" data-filter="video">Videos (视频)</div>
            <div class="comfy-asset-library-filter" data-filter="audio">Audio (音频)</div>
            <div class="comfy-asset-library-filter" data-filter="workflow">Workflows (工作流)</div>
            <div id="workflow-folders-container" style="display: none; margin-left: 15px; border-left: 2px solid #444; padding-left: 8px;"></div>
        `;
        this.sidebar.querySelectorAll(".comfy-asset-library-filter").forEach(el => {
            el.onclick = (e) => {
                this.sidebar.querySelectorAll(".comfy-asset-library-filter").forEach(f => f.classList.remove("active"));
                e.target.classList.add("active");
                this.filter = e.target.dataset.filter;
                this.currentFolder = "";
                this.currentPage = 1;

                // 当选择 workflow 时显示文件夹标签
                const foldersContainer = document.getElementById("workflow-folders-container");
                if (this.filter === "workflow") {
                    foldersContainer.style.display = "block";
                    this.loadWorkflowFolders();
                } else {
                    foldersContainer.style.display = "none";
                }

                this.renderAssets();
            };
        });
        body.appendChild(this.sidebar);

        // Content
        this.content = document.createElement("div");
        this.content.className = "comfy-asset-library-content";
        body.appendChild(this.content);

        document.body.appendChild(this.modal);
    }

    // 加载工作流文件夹列表
    async loadWorkflowFolders() {
        const container = document.getElementById("workflow-folders-container");
        if (!container) return;

        try {
            const response = await api.fetchApi("/asset_library/workflow_folders");
            const data = await response.json();
            this.workflowFolders = data.folders || [];
            this.renderFolderTabs();
        } catch (e) {
            console.error("[AssetLibrary] Error loading folders:", e);
        }
    }

    // 渲染文件夹标签
    renderFolderTabs() {
        const container = document.getElementById("workflow-folders-container");
        if (!container) return;

        container.innerHTML = "";

        // 现代风格的文件夹图标 SVG
        const folderIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
        const listIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;

        // "全部" 子标签
        const allTab = document.createElement("div");
        allTab.className = "workflow-folder-tab" + (this.currentFolder === "" ? " active" : "");
        allTab.innerHTML = `${listIcon}全部`;
        allTab.style.cssText = `
            padding: 8px 12px;
            margin: 2px 0;
            cursor: pointer;
            border-radius: 6px;
            font-size: 13px;
            color: ${this.currentFolder === "" ? "#fff" : "#aaa"};
            background: ${this.currentFolder === "" ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "transparent"};
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
        `;
        allTab.onmouseenter = () => { if (this.currentFolder !== "") allTab.style.background = "rgba(59, 130, 246, 0.2)"; };
        allTab.onmouseleave = () => { if (this.currentFolder !== "") allTab.style.background = "transparent"; };
        allTab.onclick = () => {
            this.currentFolder = "";
            this.currentPage = 1;
            this.renderFolderTabs();
            this.renderAssets();
        };
        allTab.ondragover = (e) => { e.preventDefault(); allTab.style.background = "linear-gradient(135deg, #2563eb, #1d4ed8)"; };
        allTab.ondragleave = () => { allTab.style.background = this.currentFolder === "" ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "transparent"; };
        allTab.ondrop = (e) => this.handleDrop(e, "");
        container.appendChild(allTab);

        // 文件夹标签
        this.workflowFolders.forEach(folder => {
            const tab = document.createElement("div");
            tab.className = "workflow-folder-tab" + (this.currentFolder === folder.name ? " active" : "");
            tab.innerHTML = `${folderIcon}${folder.name} <span style="color:#666; font-size:11px; margin-left:auto;">${folder.count}</span>`;
            tab.style.cssText = `
                padding: 8px 12px;
                margin: 2px 0;
                cursor: pointer;
                border-radius: 6px;
                font-size: 13px;
                color: ${this.currentFolder === folder.name ? "#fff" : "#aaa"};
                background: ${this.currentFolder === folder.name ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "transparent"};
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
            `;
            tab.onmouseenter = () => { if (this.currentFolder !== folder.name) tab.style.background = "rgba(59, 130, 246, 0.2)"; };
            tab.onmouseleave = () => { if (this.currentFolder !== folder.name) tab.style.background = "transparent"; };
            tab.onclick = () => {
                this.currentFolder = folder.name;
                this.currentPage = 1;
                this.renderFolderTabs();
                this.renderAssets();
            };
            tab.ondragover = (e) => { e.preventDefault(); tab.style.background = "linear-gradient(135deg, #2563eb, #1d4ed8)"; };
            tab.ondragleave = () => { tab.style.background = this.currentFolder === folder.name ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "transparent"; };
            tab.ondrop = (e) => this.handleDrop(e, folder.name);

            // 右键菜单删除
            tab.oncontextmenu = (e) => {
                e.preventDefault();
                this.showFolderContextMenu(e, folder.name);
            };

            container.appendChild(tab);
        });

        // 新建文件夹按钮
        const createBtn = document.createElement("div");
        createBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>新建文件夹`;
        createBtn.style.cssText = `
            padding: 8px 12px;
            margin: 8px 0 3px 0;
            cursor: pointer;
            border-radius: 6px;
            font-size: 13px;
            color: #10b981;
            border: 1px dashed rgba(16, 185, 129, 0.5);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
        `;
        createBtn.onmouseenter = () => { createBtn.style.background = "rgba(16, 185, 129, 0.1)"; createBtn.style.borderColor = "#10b981"; };
        createBtn.onmouseleave = () => { createBtn.style.background = "transparent"; createBtn.style.borderColor = "rgba(16, 185, 129, 0.5)"; };
        createBtn.onclick = () => this.createFolder();
        container.appendChild(createBtn);
    }

    // 显示文件夹右键菜单
    showFolderContextMenu(e, folderName) {
        // 移除已存在的菜单
        const existingMenu = document.getElementById("folder-context-menu");
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement("div");
        menu.id = "folder-context-menu";
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 4px;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 120px;
        `;

        const deleteItem = document.createElement("div");
        deleteItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" style="margin-right: 8px; vertical-align: middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>删除文件夹`;
        deleteItem.style.cssText = `
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 13px;
            color: #f87171;
            display: flex;
            align-items: center;
        `;
        deleteItem.onmouseenter = () => { deleteItem.style.background = "rgba(248, 113, 113, 0.1)"; };
        deleteItem.onmouseleave = () => { deleteItem.style.background = "transparent"; };
        deleteItem.onclick = async () => {
            menu.remove();
            if (confirm(`确定删除文件夹 "${folderName}" 吗？\n注意：只能删除空文件夹`)) {
                await this.deleteFolder(folderName);
            }
        };
        menu.appendChild(deleteItem);

        document.body.appendChild(menu);

        // 点击其他地方关闭菜单
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener("click", closeMenu);
            }
        };
        setTimeout(() => document.addEventListener("click", closeMenu), 0);
    }

    // 创建文件夹
    async createFolder() {
        const name = prompt("请输入文件夹名称:");
        if (!name || !name.trim()) return;

        try {
            const response = await api.fetchApi("/asset_library/create_folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() })
            });
            const data = await response.json();
            if (data.success) {
                await this.loadWorkflowFolders();
            } else {
                alert(data.error || "创建失败");
            }
        } catch (e) {
            console.error("[AssetLibrary] Error creating folder:", e);
            alert("创建文件夹失败: " + e.message);
        }
    }

    // 删除文件夹
    async deleteFolder(name) {
        try {
            const response = await api.fetchApi("/asset_library/delete_folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (data.success) {
                if (this.currentFolder === name) {
                    this.currentFolder = "";
                }
                await this.loadWorkflowFolders();
                this.renderAssets();
            } else {
                alert(data.error || "删除失败");
            }
        } catch (e) {
            console.error("[AssetLibrary] Error deleting folder:", e);
            alert("删除文件夹失败: " + e.message);
        }
    }

    // 处理拖放
    async handleDrop(e, targetFolder) {
        e.preventDefault();
        const data = e.dataTransfer.getData("application/json");
        if (!data) return;

        try {
            const asset = JSON.parse(data);
            if (asset.category !== "workflow") return;

            const response = await api.fetchApi("/asset_library/move_workflow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: asset.filename,
                    source_folder: asset.subfolder || "",
                    target_folder: targetFolder
                })
            });
            const result = await response.json();
            if (result.success) {
                await this.loadWorkflowFolders();
                await this.fetchAssets();
            } else {
                alert(result.error || "移动失败");
            }
        } catch (e) {
            console.error("[AssetLibrary] Error moving workflow:", e);
        }
    }

    async fetchAssets() {
        console.log("[AssetLibrary] Fetching assets...");
        try {
            const response = await api.fetchApi("/asset_library/files");
            const data = await response.json();
            console.log("[AssetLibrary] Received", data.files?.length || 0, "files");
            this.assets = data.files || [];
            this.renderAssets();
        } catch (e) {
            console.error("[AssetLibrary] Failed to fetch assets", e);
            this.content.innerHTML = `<div style='padding:20px; color:red;'>Error loading assets: ${e.message}</div>`;
        }
    }

    renderAssets() {
        this.content.innerHTML = "";
        let filtered = this.assets.filter(a => this.filter === "all" || a.category === this.filter);

        // 工作流文件夹筛选 (根据侧边栏选择的文件夹)
        if (this.filter === "workflow" && this.currentFolder !== "") {
            // 只显示当前文件夹的工作流
            filtered = filtered.filter(a => (a.subfolder || "") === this.currentFolder);
        }

        if (filtered.length === 0 && this.content.children.length === 0) {
            this.content.innerHTML = "<div style='padding:20px; color:#666;'>No assets found.</div>";
            return;
        }

        // 分页计算
        const totalPages = Math.ceil(filtered.length / this.itemsPerPage);
        if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);
        if (this.currentPage < 1) this.currentPage = 1;

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = filtered.slice(startIndex, endIndex);

        console.log(`[AssetLibrary] Page ${this.currentPage}/${totalPages}, showing ${pageItems.length} of ${filtered.length} items`);


        // 渲染当前页的项目
        pageItems.forEach(asset => {
            const el = document.createElement("div");
            el.className = "comfy-asset-item";
            el.style.cssText = "border: 1px solid #444; border-radius: 8px; overflow: hidden; background: #1a1a1a; display: flex; flex-direction: column; cursor: pointer; min-height: 200px; position: relative;";

            // 工作流可拖拽
            if (asset.category === "workflow") {
                el.draggable = true;
                el.ondragstart = (e) => {
                    e.dataTransfer.setData("application/json", JSON.stringify(asset));
                    el.style.opacity = "0.5";
                };
                el.ondragend = () => {
                    el.style.opacity = "1";
                };
            }

            const preview = document.createElement("div");
            preview.className = "comfy-asset-preview";
            preview.style.cssText = "height: 150px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;";

            let src = "";
            if (asset.type === "workflow") {
                // 工作流使用封面图或图标
                if (asset.cover) {
                    // 添加时间戳避免缓存问题
                    src = `/asset_library/workflow_cover/${encodeURIComponent(asset.cover)}?t=${Date.now()}`;
                    const img = document.createElement("img");
                    img.src = src;
                    img.loading = "lazy";
                    img.style.cssText = "max-width: 100%; max-height: 100%; object-fit: contain;";
                    preview.appendChild(img);
                } else {
                    preview.innerHTML = `<div style="text-align:center; color:#888;"><div style="font-size:32px;">📜</div><div style="font-size:12px; margin-top:5px;">工作流</div></div>`;
                }

                // 工作流的设置封面按钮 - 直接在卡片上显示
                const setCoverBtn = document.createElement("button");
                setCoverBtn.innerHTML = "🖼️";
                setCoverBtn.title = "设置封面";
                setCoverBtn.style.cssText = `
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background: rgba(0,0,0,0.7);
                    border: none;
                    color: white;
                    font-size: 14px;
                    cursor: pointer;
                    z-index: 10;
                `;
                setCoverBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.setWorkflowCover(asset);
                };
                el.appendChild(setCoverBtn);
            } else {
                src = `/view?filename=${encodeURIComponent(asset.filename)}&type=${asset.type}&subfolder=${encodeURIComponent(asset.subfolder)}`;

                if (asset.category === "image") {
                    const img = document.createElement("img");
                    img.src = src;
                    img.loading = "lazy";
                    img.style.cssText = "max-width: 100%; max-height: 100%; object-fit: contain;";
                    preview.appendChild(img);
                } else if (asset.category === "video") {
                    const video = document.createElement("video");
                    video.src = src;
                    video.muted = true;
                    video.style.cssText = "max-width: 100%; max-height: 100%; object-fit: contain;";
                    video.onmouseover = () => video.play();
                    video.onmouseout = () => { video.pause(); video.currentTime = 0; };
                    preview.appendChild(video);
                } else if (asset.category === "audio") {
                    preview.innerHTML = `<div style="text-align:center; color:#888;"><div style="font-size:32px;">🎵</div><div style="font-size:12px; margin-top:5px;">音频</div></div>`;
                } else {
                    preview.innerText = asset.category.toUpperCase();
                    preview.style.color = "#888";
                    preview.style.fontSize = "14px";
                }
            }

            el.appendChild(preview);

            const info = document.createElement("div");
            info.className = "comfy-asset-info";
            info.style.cssText = "padding: 10px; font-size: 12px; color: #ddd;";
            info.innerHTML = `
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold;" title="${asset.filename}">${asset.filename}</div>
                <div style="color: #888; margin-top: 4px;">${new Date(asset.modified * 1000).toLocaleString()}</div>
            `;
            el.appendChild(info);

            // 工作流直接打开，其他资产打开预览
            if (asset.category === "workflow") {
                el.onclick = () => {
                    this.openWorkflow(asset);
                };
            } else {
                el.onclick = () => {
                    this.showPreviewModal(asset, src);
                };
            }

            this.content.appendChild(el);
        });

        // 添加分页控制器
        if (totalPages > 1) {
            const paginationContainer = document.createElement("div");
            paginationContainer.style.cssText = "grid-column: 1 / -1; display: flex; justify-content: center; align-items: center; gap: 10px; padding: 20px; margin-top: 20px;";

            const prevBtn = document.createElement("button");
            prevBtn.textContent = "◀ 上一页";
            prevBtn.style.cssText = "padding: 8px 16px; background: #333; border: 1px solid #555; color: #ddd; cursor: pointer; border-radius: 4px;";
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.onclick = () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderAssets();
                    this.content.scrollTop = 0;
                }
            };

            const pageInfo = document.createElement("span");
            pageInfo.style.cssText = "color: #aaa; font-size: 14px;";
            pageInfo.textContent = `第 ${this.currentPage} 页 / 共 ${totalPages} 页 (${filtered.length} 项)`;

            const nextBtn = document.createElement("button");
            nextBtn.textContent = "下一页 ▶";
            nextBtn.style.cssText = "padding: 8px 16px; background: #333; border: 1px solid #555; color: #ddd; cursor: pointer; border-radius: 4px;";
            nextBtn.disabled = this.currentPage === totalPages;
            nextBtn.onclick = () => {
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderAssets();
                    this.content.scrollTop = 0;
                }
            };

            paginationContainer.appendChild(prevBtn);
            paginationContainer.appendChild(pageInfo);
            paginationContainer.appendChild(nextBtn);
            this.content.appendChild(paginationContainer);
        }
    }

    toggle() {
        this.visible = !this.visible;
        this.modal.classList.toggle("visible", this.visible);
        if (this.visible) {
            this.fetchAssets();
        }
    }

    async showPreviewModal(asset, src) {
        // 创建预览模态框
        const previewModal = document.createElement("div");
        previewModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.9);
            z-index: 10001;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        `;

        // 关闭按钮
        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "×";
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: transparent;
            border: none;
            color: white;
            font-size: 40px;
            cursor: pointer;
            z-index: 10002;
        `;
        closeBtn.onclick = () => previewModal.remove();
        previewModal.appendChild(closeBtn);

        // 内容区域
        const contentArea = document.createElement("div");
        contentArea.style.cssText = `
            max-width: 90%;
            max-height: 80%;
            display: flex;
            flex-direction: column;
            align-items: center;
        `;

        if (asset.category === "image") {
            const img = document.createElement("img");
            img.src = src;
            img.style.cssText = "max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 8px;";
            contentArea.appendChild(img);
        } else if (asset.category === "video") {
            const video = document.createElement("video");
            video.src = src;
            video.controls = true;
            video.autoplay = true;
            video.style.cssText = "max-width: 100%; max-height: 70vh; border-radius: 8px;";
            contentArea.appendChild(video);
        } else if (asset.category === "audio") {
            const audioContainer = document.createElement("div");
            audioContainer.style.cssText = "text-align: center; color: white;";
            audioContainer.innerHTML = `<div style="font-size: 64px; margin-bottom: 20px;">🎵</div><div style="font-size: 18px; margin-bottom: 20px;">${asset.filename}</div>`;

            const audio = document.createElement("audio");
            audio.src = src;
            audio.controls = true;
            audio.autoplay = true;
            audio.style.cssText = "width: 400px;";
            audioContainer.appendChild(audio);
            contentArea.appendChild(audioContainer);
        } else if (asset.category === "workflow") {
            // 工作流预览
            const workflowInfo = document.createElement("div");
            workflowInfo.style.cssText = "text-align: center; color: white;";
            workflowInfo.innerHTML = `<div style="font-size: 64px; margin-bottom: 20px;">📜</div><div style="font-size: 18px; margin-bottom: 20px;">${asset.filename}</div>`;
            contentArea.appendChild(workflowInfo);
        }

        previewModal.appendChild(contentArea);

        // 底部按钮区域
        const buttonArea = document.createElement("div");
        buttonArea.style.cssText = `
            margin-top: 20px;
            display: flex;
            gap: 15px;
        `;

        const btnStyle = `
            padding: 10px 20px;
            background: #3b82f6;
            border: none;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            cursor: pointer;
        `;

        // 如果是图片，添加加载图片和打开工作流按钮
        if (asset.category === "image") {
            // 加载图片按钮
            const loadImageBtn = document.createElement("button");
            loadImageBtn.textContent = "📷 加载图片";
            loadImageBtn.style.cssText = btnStyle.replace("#3b82f6", "#10b981");
            loadImageBtn.onclick = async () => {
                await this.loadImageToNode(asset, src);
                previewModal.remove();
                this.toggle();
            };
            buttonArea.appendChild(loadImageBtn);

            // 打开工作流按钮 (仅对 PNG)
            if (asset.filename.endsWith(".png")) {
                const openWorkflowBtn = document.createElement("button");
                openWorkflowBtn.textContent = "📂 打开工作流";
                openWorkflowBtn.style.cssText = btnStyle;
                openWorkflowBtn.onclick = async () => {
                    try {
                        const response = await api.fetchApi(`/asset_library/workflow_from_image?filename=${encodeURIComponent(asset.filename)}&type=${asset.type}&subfolder=${encodeURIComponent(asset.subfolder)}`);
                        const data = await response.json();
                        if (data.has_workflow) {
                            app.loadGraphData(data.workflow);
                            previewModal.remove();
                            this.toggle();
                        } else {
                            alert("该图片不包含工作流信息");
                        }
                    } catch (e) {
                        console.error("[AssetLibrary] Error loading workflow:", e);
                        alert("打开工作流失败: " + e.message);
                    }
                };
                buttonArea.appendChild(openWorkflowBtn);
            }
        }

        // 如果是工作流文件
        if (asset.category === "workflow") {
            const openWorkflowBtn = document.createElement("button");
            openWorkflowBtn.textContent = "📂 打开工作流";
            openWorkflowBtn.style.cssText = btnStyle;
            openWorkflowBtn.onclick = async () => {
                try {
                    const response = await api.fetchApi(`/asset_library/workflow_content?filename=${encodeURIComponent(asset.filename)}&subfolder=${encodeURIComponent(asset.subfolder)}`);
                    const data = await response.json();
                    if (data.workflow) {
                        app.loadGraphData(data.workflow);
                        previewModal.remove();
                        this.toggle(); // 关闭资产库
                    }
                } catch (e) {
                    console.error("[AssetLibrary] Error loading workflow:", e);
                    alert("打开工作流失败: " + e.message);
                }
            };
            buttonArea.appendChild(openWorkflowBtn);

            // 设置封面按钮
            const setCoverBtn = document.createElement("button");
            setCoverBtn.textContent = "🖼️ 设置封面";
            setCoverBtn.style.cssText = btnStyle.replace("#3b82f6", "#10b981");
            setCoverBtn.onclick = () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append("workflow_name", asset.filename);
                    formData.append("cover", file);

                    try {
                        const response = await fetch("/asset_library/workflow_cover", {
                            method: "POST",
                            body: formData
                        });
                        const data = await response.json();
                        if (data.success) {
                            alert("封面设置成功！");
                            this.fetchAssets(); // 刷新列表
                            previewModal.remove();
                        }
                    } catch (e) {
                        console.error("[AssetLibrary] Error setting cover:", e);
                        alert("设置封面失败: " + e.message);
                    }
                };
                input.click();
            };
            buttonArea.appendChild(setCoverBtn);
        }

        // 关闭按钮
        const closeBtnBottom = document.createElement("button");
        closeBtnBottom.textContent = "关闭";
        closeBtnBottom.style.cssText = btnStyle.replace("#3b82f6", "#6b7280");
        closeBtnBottom.onclick = () => previewModal.remove();
        buttonArea.appendChild(closeBtnBottom);

        previewModal.appendChild(buttonArea);

        // ESC 关闭
        const handleEsc = (e) => {
            if (e.key === "Escape") {
                previewModal.remove();
                document.removeEventListener("keydown", handleEsc);
            }
        };
        document.addEventListener("keydown", handleEsc);

        document.body.appendChild(previewModal);
    }

    // 加载图片到新的 LoadImage 节点
    async loadImageToNode(asset, src) {
        try {
            // 构建图片路径格式：subfolder/filename 或直接 filename
            let imagePath = asset.filename;
            if (asset.subfolder) {
                imagePath = `${asset.subfolder}/${asset.filename}`;
            }

            // 创建新的 LoadImage 节点
            const node = LiteGraph.createNode("LoadImage");
            if (!node) {
                alert("无法创建 LoadImage 节点");
                return;
            }

            // 添加到画布中心位置
            const canvas = app.canvas;
            const centerX = canvas.canvas.width / 2 / canvas.ds.scale - canvas.ds.offset[0];
            const centerY = canvas.canvas.height / 2 / canvas.ds.scale - canvas.ds.offset[1];
            node.pos = [centerX - node.size[0] / 2, centerY - node.size[1] / 2];

            // 添加到图中
            app.graph.add(node);

            // 设置 image widget 的值
            setTimeout(() => {
                const imageWidget = node.widgets?.find(w => w.name === "image");
                if (imageWidget) {
                    imageWidget.value = imagePath;
                    node.setDirtyCanvas(true, true);
                }
            }, 100);

            console.log(`[AssetLibrary] Created LoadImage node with: ${imagePath}`);
        } catch (e) {
            console.error("[AssetLibrary] Error loading image to node:", e);
            alert("加载图片失败: " + e.message);
        }
    }

    // 打开工作流
    async openWorkflow(asset) {
        try {
            const response = await api.fetchApi(`/asset_library/workflow_content?filename=${encodeURIComponent(asset.filename)}&subfolder=${encodeURIComponent(asset.subfolder)}`);
            const data = await response.json();
            if (data.workflow) {
                app.loadGraphData(data.workflow);
                this.toggle(); // 关闭资产库
            } else {
                alert("无法加载工作流");
            }
        } catch (e) {
            console.error("[AssetLibrary] Error opening workflow:", e);
            alert("打开工作流失败: " + e.message);
        }
    }

    // 设置工作流封面
    setWorkflowCover(asset) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append("workflow_name", asset.filename);
            formData.append("cover", file);

            try {
                const response = await fetch("/asset_library/workflow_cover", {
                    method: "POST",
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    // 更新 asset 的 cover 属性
                    asset.cover = data.cover;
                    // 刷新列表
                    this.currentPage = 1;
                    this.fetchAssets();
                }
            } catch (e) {
                console.error("[AssetLibrary] Error setting cover:", e);
                alert("设置封面失败: " + e.message);
            }
        };
        input.click();
    }
}

app.registerExtension({
    name: "Comfy.AssetLibrary",
    async setup() {
        const library = new AssetLibrary();

        // 创建类似 crystools 风格的独立按钮容器
        const createButton = () => {
            // 外层容器 - 与 crystools 风格一致
            const container = document.createElement("div");
            container.id = "asset-library-button-container";
            container.style.cssText = `
                pointer-events: auto;
                display: flex;
                height: 48px;
                align-items: center;
                border-radius: 8px;
                border: 1px solid var(--border-color, #444);
                background: var(--comfy-menu-bg, #1a1a1a);
                padding: 0 4px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                margin-right: 8px;
            `;

            // 按钮本身
            const btn = document.createElement("button");
            btn.className = "asset-library-btn";
            btn.title = "Asset Library (资产库)";
            btn.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                background: transparent;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                padding: 4px;
                transition: background 0.2s;
            `;

            // 使用自定义图标
            const icon = document.createElement("img");
            icon.src = "extensions/ComfyUI-Asset-Library/icon.png";
            icon.alt = "Asset Library";
            icon.onerror = () => {
                // 如果图片加载失败，使用 emoji 作为后备
                btn.innerHTML = "📁";
                btn.style.fontSize = "24px";
            };
            icon.style.cssText = `
                width: 28px;
                height: 28px;
                object-fit: contain;
            `;

            btn.appendChild(icon);
            btn.onmouseover = () => btn.style.background = "rgba(255,255,255,0.1)";
            btn.onmouseout = () => btn.style.background = "transparent";
            btn.onclick = () => library.toggle();

            container.appendChild(btn);
            return container;
        };

        const tryInsert = () => {
            // 检查是否已经插入
            if (document.getElementById("asset-library-button-container")) {
                return true;
            }

            const btn = createButton();

            // 查找 crystools 监控条或其他顶部 UI 元素
            // crystools 通常会创建一个 id 为 crystools-root 或类似的容器
            const crystoolsRoot = document.getElementById("crystools-root");

            // 查找新版 UI 的顶部菜单栏区域
            const topMenuBar = document.querySelector('.flex.h-12.shrink-0.items-center.rounded-lg.border');

            if (crystoolsRoot) {
                // 插入到 crystools 左边
                console.log("[AssetLibrary] Found crystools-root, inserting before it");
                crystoolsRoot.parentNode.insertBefore(btn, crystoolsRoot);
                return true;
            }

            if (topMenuBar) {
                // 插入到顶部菜单栏左边
                console.log("[AssetLibrary] Found top menu bar, inserting before it");
                topMenuBar.parentNode.insertBefore(btn, topMenuBar);
                return true;
            }

            // 查找带有 pointer-events: auto 的顶部容器 (通常是按钮组的父容器)
            const topBarContainers = document.querySelectorAll('[style*="pointer-events: auto"]');
            for (const container of topBarContainers) {
                if (container.querySelector('button') && container.offsetHeight > 30) {
                    console.log("[AssetLibrary] Found pointer-events container, inserting before it");
                    container.parentNode.insertBefore(btn, container);
                    return true;
                }
            }

            return false;
        };

        // 重试机制
        let attempts = 0;
        const interval = setInterval(() => {
            if (tryInsert()) {
                clearInterval(interval);
                console.log("[AssetLibrary] Button inserted successfully");
            } else {
                attempts++;
                if (attempts > 15) {
                    clearInterval(interval);
                    console.warn("[AssetLibrary] Could not find suitable container. Using fixed position fallback.");

                    // 回退: 固定位置
                    const btn = createButton();
                    btn.style.position = "fixed";
                    btn.style.top = "8px";
                    btn.style.right = "600px";
                    btn.style.zIndex = "10000";
                    document.body.appendChild(btn);
                }
            }
        }, 500);
    },
});

