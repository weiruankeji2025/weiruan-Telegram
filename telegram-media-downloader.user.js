// ==UserScript==
// @name         Telegram 受限媒体下载器
// @namespace    https://github.com/weiruankeji2025/weiruan-Telegram
// @version      1.0.0
// @description  下载 Telegram Web 中的受限图片和视频，支持最佳质量下载
// @author       WeiRuan Tech
// @match        https://web.telegram.org/*
// @match        https://*.web.telegram.org/*
// @icon         https://telegram.org/favicon.ico
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 配置选项
    const CONFIG = {
        downloadPath: GM_getValue('downloadPath', 'Telegram'),
        autoDownload: GM_getValue('autoDownload', false),
        notifyOnDownload: GM_getValue('notifyOnDownload', true),
        downloadQuality: GM_getValue('downloadQuality', 'best'), // best, medium, low
        buttonPosition: GM_getValue('buttonPosition', 'top-right'), // top-right, bottom-right
    };

    // 保存配置
    function saveConfig() {
        GM_setValue('downloadPath', CONFIG.downloadPath);
        GM_setValue('autoDownload', CONFIG.autoDownload);
        GM_setValue('notifyOnDownload', CONFIG.notifyOnDownload);
        GM_setValue('downloadQuality', CONFIG.downloadQuality);
        GM_setValue('buttonPosition', CONFIG.buttonPosition);
    }

    // 通知函数
    function notify(title, message, type = 'info') {
        if (!CONFIG.notifyOnDownload) return;

        GM_notification({
            title: title,
            text: message,
            timeout: 3000,
            onclick: () => {}
        });

        // 同时显示页面内通知
        showToast(message, type);
    }

    // 页面内 Toast 通知
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `tg-downloader-toast tg-downloader-toast-${type}`;
        toast.textContent = message;

        const styles = {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '999999',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'slideIn 0.3s ease-out',
            maxWidth: '300px',
            wordWrap: 'break-word'
        };

        const bgColors = {
            'info': '#3390ec',
            'success': '#4caf50',
            'error': '#f44336',
            'warning': '#ff9800'
        };

        Object.assign(toast.style, styles);
        toast.style.backgroundColor = bgColors[type] || bgColors.info;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 添加 CSS 样式
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(400px); opacity: 0; }
            }
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            .tg-download-btn {
                position: absolute;
                z-index: 10000;
                padding: 8px 16px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 20px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 600;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 6px;
                backdrop-filter: blur(10px);
            }

            .tg-download-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
            }

            .tg-download-btn:active {
                transform: translateY(0);
            }

            .tg-download-btn.downloading {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                animation: pulse 1.5s infinite;
            }

            .tg-download-btn.success {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            }

            .tg-download-btn-icon {
                width: 16px;
                height: 16px;
                fill: currentColor;
            }

            .tg-settings-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.2);
                z-index: 100000;
                min-width: 400px;
                max-width: 500px;
            }

            .tg-settings-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 99999;
                backdrop-filter: blur(4px);
            }

            .tg-settings-title {
                font-size: 20px;
                font-weight: 700;
                margin-bottom: 20px;
                color: #333;
            }

            .tg-settings-option {
                margin-bottom: 16px;
            }

            .tg-settings-label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #555;
                font-size: 14px;
            }

            .tg-settings-input,
            .tg-settings-select {
                width: 100%;
                padding: 10px 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 14px;
                transition: border-color 0.3s;
            }

            .tg-settings-input:focus,
            .tg-settings-select:focus {
                outline: none;
                border-color: #667eea;
            }

            .tg-settings-checkbox {
                margin-right: 8px;
                width: 18px;
                height: 18px;
                cursor: pointer;
            }

            .tg-settings-buttons {
                display: flex;
                gap: 12px;
                margin-top: 24px;
            }

            .tg-settings-btn {
                flex: 1;
                padding: 12px;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s;
                font-size: 14px;
            }

            .tg-settings-btn-save {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .tg-settings-btn-save:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }

            .tg-settings-btn-cancel {
                background: #f5f5f5;
                color: #666;
            }

            .tg-settings-btn-cancel:hover {
                background: #e0e0e0;
            }

            .tg-watermark {
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(0,0,0,0.6);
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 11px;
                z-index: 9999;
                backdrop-filter: blur(10px);
            }
        `;
        document.head.appendChild(style);
    }

    // 设置面板
    function showSettings() {
        const overlay = document.createElement('div');
        overlay.className = 'tg-settings-overlay';

        const panel = document.createElement('div');
        panel.className = 'tg-settings-panel';

        panel.innerHTML = `
            <div class="tg-settings-title">⚙️ Telegram 下载器设置</div>

            <div class="tg-settings-option">
                <label class="tg-settings-label">下载文件夹名称</label>
                <input type="text" class="tg-settings-input" id="downloadPath" value="${CONFIG.downloadPath}" placeholder="例如: Telegram">
            </div>

            <div class="tg-settings-option">
                <label class="tg-settings-label">下载质量</label>
                <select class="tg-settings-select" id="downloadQuality">
                    <option value="best" ${CONFIG.downloadQuality === 'best' ? 'selected' : ''}>最佳质量</option>
                    <option value="medium" ${CONFIG.downloadQuality === 'medium' ? 'selected' : ''}>中等质量</option>
                    <option value="low" ${CONFIG.downloadQuality === 'low' ? 'selected' : ''}>低质量</option>
                </select>
            </div>

            <div class="tg-settings-option">
                <label class="tg-settings-label">按钮位置</label>
                <select class="tg-settings-select" id="buttonPosition">
                    <option value="top-right" ${CONFIG.buttonPosition === 'top-right' ? 'selected' : ''}>右上角</option>
                    <option value="bottom-right" ${CONFIG.buttonPosition === 'bottom-right' ? 'selected' : ''}>右下角</option>
                    <option value="top-left" ${CONFIG.buttonPosition === 'top-left' ? 'selected' : ''}>左上角</option>
                    <option value="bottom-left" ${CONFIG.buttonPosition === 'bottom-left' ? 'selected' : ''}>左下角</option>
                </select>
            </div>

            <div class="tg-settings-option">
                <label>
                    <input type="checkbox" class="tg-settings-checkbox" id="notifyOnDownload" ${CONFIG.notifyOnDownload ? 'checked' : ''}>
                    <span class="tg-settings-label" style="display: inline;">启用下载通知</span>
                </label>
            </div>

            <div class="tg-settings-buttons">
                <button class="tg-settings-btn tg-settings-btn-save">保存设置</button>
                <button class="tg-settings-btn tg-settings-btn-cancel">取消</button>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        // 保存按钮
        panel.querySelector('.tg-settings-btn-save').addEventListener('click', () => {
            CONFIG.downloadPath = document.getElementById('downloadPath').value || 'Telegram';
            CONFIG.downloadQuality = document.getElementById('downloadQuality').value;
            CONFIG.buttonPosition = document.getElementById('buttonPosition').value;
            CONFIG.notifyOnDownload = document.getElementById('notifyOnDownload').checked;

            saveConfig();
            notify('设置已保存', '您的设置已成功保存！', 'success');

            overlay.remove();
            panel.remove();
        });

        // 取消按钮
        panel.querySelector('.tg-settings-btn-cancel').addEventListener('click', () => {
            overlay.remove();
            panel.remove();
        });

        // 点击遮罩关闭
        overlay.addEventListener('click', () => {
            overlay.remove();
            panel.remove();
        });
    }

    // 获取按钮位置样式
    function getButtonPositionStyle() {
        const positions = {
            'top-right': { top: '10px', right: '10px' },
            'bottom-right': { bottom: '10px', right: '10px' },
            'top-left': { top: '10px', left: '10px' },
            'bottom-left': { bottom: '10px', left: '10px' }
        };
        return positions[CONFIG.buttonPosition] || positions['top-right'];
    }

    // 创建下载按钮
    function createDownloadButton(mediaElement, mediaUrl, mediaType) {
        const button = document.createElement('button');
        button.className = 'tg-download-btn';
        button.innerHTML = `
            <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span>下载${mediaType === 'video' ? '视频' : '图片'}</span>
        `;

        const positionStyle = getButtonPositionStyle();
        Object.assign(button.style, positionStyle);

        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();

            button.classList.add('downloading');
            button.innerHTML = `
                <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span>下载中...</span>
            `;

            try {
                await downloadMedia(mediaUrl, mediaType);

                button.classList.remove('downloading');
                button.classList.add('success');
                button.innerHTML = `
                    <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                    </svg>
                    <span>下载成功</span>
                `;

                setTimeout(() => {
                    button.classList.remove('success');
                    button.innerHTML = `
                        <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                        </svg>
                        <span>下载${mediaType === 'video' ? '视频' : '图片'}</span>
                    `;
                }, 2000);

            } catch (error) {
                console.error('下载失败:', error);
                notify('下载失败', error.message, 'error');

                button.classList.remove('downloading');
                button.innerHTML = `
                    <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    <span>下载${mediaType === 'video' ? '视频' : '图片'}</span>
                `;
            }
        });

        return button;
    }

    // 下载媒体文件
    async function downloadMedia(url, mediaType) {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().getTime();
            const extension = mediaType === 'video' ? 'mp4' : 'jpg';
            const filename = `${CONFIG.downloadPath}/telegram_${mediaType}_${timestamp}.${extension}`;

            notify('开始下载', `正在下载${mediaType === 'video' ? '视频' : '图片'}...`, 'info');

            GM_download({
                url: url,
                name: filename,
                saveAs: true,
                onload: () => {
                    notify('下载完成', `${mediaType === 'video' ? '视频' : '图片'}已保存到: ${filename}`, 'success');
                    resolve();
                },
                onerror: (error) => {
                    reject(new Error('下载失败，请重试'));
                },
                ontimeout: () => {
                    reject(new Error('下载超时，请重试'));
                }
            });
        });
    }

    // 获取最佳质量的媒体 URL
    function getBestQualityUrl(element, mediaType) {
        if (mediaType === 'video') {
            // 尝试获取视频源
            const source = element.querySelector('source');
            if (source && source.src) return source.src;
            if (element.src) return element.src;

            // 尝试从属性获取
            const dataSrc = element.getAttribute('data-src') || element.getAttribute('data-video');
            if (dataSrc) return dataSrc;
        } else {
            // 图片处理
            if (element.src && !element.src.includes('blob:')) return element.src;

            // 尝试获取高清图片
            const srcset = element.srcset;
            if (srcset) {
                const sources = srcset.split(',').map(s => s.trim().split(' '));
                const sorted = sources.sort((a, b) => {
                    const sizeA = parseInt(a[1]) || 0;
                    const sizeB = parseInt(b[1]) || 0;
                    return sizeB - sizeA;
                });
                if (sorted.length > 0) return sorted[0][0];
            }

            // 尝试从背景图获取
            const bgImage = window.getComputedStyle(element).backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                if (match) return match[1];
            }

            // 尝试从 data 属性获取
            const dataSrc = element.getAttribute('data-src') ||
                          element.getAttribute('data-image') ||
                          element.getAttribute('data-full');
            if (dataSrc) return dataSrc;
        }

        return null;
    }

    // 处理媒体元素
    function processMediaElement(element, mediaType) {
        // 检查是否已处理
        if (element.hasAttribute('data-tg-downloader-processed')) return;
        element.setAttribute('data-tg-downloader-processed', 'true');

        const url = getBestQualityUrl(element, mediaType);
        if (!url) return;

        // 查找合适的父容器
        let container = element.closest('.media-viewer-content') ||
                       element.closest('.media-viewer') ||
                       element.closest('.message-media') ||
                       element.parentElement;

        if (!container) container = element;

        // 确保容器有相对定位
        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        // 创建并添加下载按钮
        const button = createDownloadButton(element, url, mediaType);
        container.appendChild(button);
    }

    // 扫描页面中的媒体
    function scanForMedia() {
        // 扫描图片
        const images = document.querySelectorAll('img:not([data-tg-downloader-processed])');
        images.forEach(img => {
            // 过滤掉太小的图片（可能是图标）
            if (img.naturalWidth > 100 && img.naturalHeight > 100) {
                processMediaElement(img, 'image');
            }
        });

        // 扫描视频
        const videos = document.querySelectorAll('video:not([data-tg-downloader-processed])');
        videos.forEach(video => {
            processMediaElement(video, 'video');
        });

        // 扫描 canvas（某些受限内容可能使用 canvas）
        const canvases = document.querySelectorAll('canvas:not([data-tg-downloader-processed])');
        canvases.forEach(canvas => {
            if (canvas.width > 100 && canvas.height > 100) {
                // Canvas 需要转换为图片 URL
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    canvas.setAttribute('data-tg-downloader-processed', 'true');

                    let container = canvas.closest('.media-viewer-content') || canvas.parentElement;
                    if (window.getComputedStyle(container).position === 'static') {
                        container.style.position = 'relative';
                    }

                    const button = createDownloadButton(canvas, dataUrl, 'image');
                    container.appendChild(button);
                } catch (e) {
                    console.error('Canvas 处理失败:', e);
                }
            }
        });
    }

    // 拦截受限内容的下载保护
    function bypassRestrictions() {
        // 移除右键菜单限制
        document.addEventListener('contextmenu', (e) => {
            e.stopPropagation();
        }, true);

        // 移除选择限制
        document.addEventListener('selectstart', (e) => {
            e.stopPropagation();
        }, true);

        // 移除复制限制
        document.addEventListener('copy', (e) => {
            e.stopPropagation();
        }, true);

        // 移除拖拽限制
        document.addEventListener('dragstart', (e) => {
            e.stopPropagation();
        }, true);
    }

    // 监听 DOM 变化
    function observeDOM() {
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;

            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'IMG' || node.tagName === 'VIDEO' || node.tagName === 'CANVAS') {
                            shouldScan = true;
                        } else if (node.querySelector &&
                                 (node.querySelector('img') || node.querySelector('video') || node.querySelector('canvas'))) {
                            shouldScan = true;
                        }
                    }
                });
            });

            if (shouldScan) {
                setTimeout(scanForMedia, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 添加水印
    function addWatermark() {
        const watermark = document.createElement('div');
        watermark.className = 'tg-watermark';
        watermark.textContent = 'Telegram 下载器 v1.0.0';
        document.body.appendChild(watermark);

        // 5秒后隐藏水印
        setTimeout(() => {
            watermark.style.opacity = '0';
            watermark.style.transition = 'opacity 0.5s';
            setTimeout(() => watermark.remove(), 500);
        }, 5000);
    }

    // 初始化
    function init() {
        // 等待页面加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        console.log('🚀 Telegram 媒体下载器已启动');

        // 添加样式
        addStyles();

        // 绕过限制
        bypassRestrictions();

        // 首次扫描
        setTimeout(scanForMedia, 1000);

        // 监听 DOM 变化
        observeDOM();

        // 定期扫描
        setInterval(scanForMedia, 3000);

        // 添加水印
        addWatermark();

        // 注册菜单命令
        GM_registerMenuCommand('⚙️ 打开设置', showSettings);
        GM_registerMenuCommand('🔄 重新扫描媒体', scanForMedia);

        notify('下载器已就绪', 'Telegram 媒体下载器已成功加载！', 'success');
    }

    // 启动脚本
    init();
})();
