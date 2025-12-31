// ==UserScript==
// @name         Telegram 受限媒体下载器
// @namespace    https://github.com/weiruankeji2025/weiruan-Telegram
// @version      1.5.4
// @description  下载 Telegram Web 中的受限图片和视频
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

    // 配置
    const CONFIG = {
        downloadPath: GM_getValue('downloadPath', 'Telegram'),
        notifyOnDownload: GM_getValue('notifyOnDownload', true),
        buttonPosition: GM_getValue('buttonPosition', 'top-right'), // top-right, top-left, bottom-right, bottom-left
    };

    // 保存配置
    function saveConfig() {
        GM_setValue('downloadPath', CONFIG.downloadPath);
        GM_setValue('notifyOnDownload', CONFIG.notifyOnDownload);
        GM_setValue('buttonPosition', CONFIG.buttonPosition);
    }

    // Content-Range 正则
    const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;

    // Hash函数
    const hashCode = (s) => {
        var h = 0, l = s.length, i = 0;
        if (l > 0) {
            while (i < l) {
                h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
            }
        }
        return h >>> 0;
    };

    // 通知
    function notify(title, message) {
        if (!CONFIG.notifyOnDownload) return;
        GM_notification({
            title: title,
            text: message,
            timeout: 2000
        });
    }

    // 创建进度条
    function createProgressBar(videoId, fileName) {
        const isDarkMode = document.querySelector('html').classList.contains('night') ||
                          document.querySelector('html').classList.contains('theme-dark');
        const container = document.getElementById('tg-progress-container');

        const item = document.createElement('div');
        item.id = 'tg-progress-' + videoId;
        item.style.cssText = `width:20rem;margin-top:0.4rem;padding:0.6rem;background-color:${isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.6)'};border-radius:8px;`;

        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:8px;';

        const title = document.createElement('p');
        title.className = 'filename';
        title.style.cssText = 'margin:0;color:white;font-size:13px;max-width:16rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        title.innerText = fileName;

        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `cursor:pointer;font-size:1.2rem;color:${isDarkMode ? '#8a8a8a' : 'white'};`;
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => container.removeChild(item);

        const progressBar = document.createElement('div');
        progressBar.style.cssText = 'background-color:#e2e2e2;position:relative;width:100%;height:1.6rem;border-radius:2rem;overflow:hidden;';

        const counter = document.createElement('p');
        counter.style.cssText = 'position:absolute;z-index:5;left:50%;top:50%;transform:translate(-50%,-50%);margin:0;color:black;font-size:12px;font-weight:bold;';
        counter.innerText = '0%';

        const progress = document.createElement('div');
        progress.style.cssText = 'position:absolute;height:100%;width:0%;background-color:#6093B5;transition:width 0.3s ease;';

        progressBar.appendChild(counter);
        progressBar.appendChild(progress);
        header.appendChild(title);
        header.appendChild(closeBtn);
        item.appendChild(header);
        item.appendChild(progressBar);
        container.appendChild(item);
    }

    // 更新进度
    function updateProgress(videoId, fileName, percent) {
        const item = document.getElementById('tg-progress-' + videoId);
        if (!item) return;
        item.querySelector('p.filename').innerText = fileName;
        const bar = item.querySelector('div div:last-child');
        const text = item.querySelector('div p');
        text.innerText = percent + '%';
        bar.style.width = percent + '%';
    }

    // 完成进度
    function completeProgress(videoId) {
        const item = document.getElementById('tg-progress-' + videoId);
        if (!item) return;
        const bar = item.querySelector('div div:last-child');
        const text = item.querySelector('div p');
        text.innerText = '完成';
        bar.style.backgroundColor = '#B6C649';
        bar.style.width = '100%';
    }

    // 中止进度
    function abortProgress(videoId) {
        const item = document.getElementById('tg-progress-' + videoId);
        if (!item) return;
        const bar = item.querySelector('div div:last-child');
        const text = item.querySelector('div p');
        text.innerText = '失败';
        bar.style.backgroundColor = '#D16666';
        bar.style.width = '100%';
    }

    // 分块下载视频
    async function downloadVideo(url) {
        let blobs = [];
        let nextOffset = 0;
        let totalSize = null;
        let fileExtension = 'mp4';
        let fileName = hashCode(url).toString(36) + '.' + fileExtension;

        // 使用URL的hash作为唯一ID，避免重复创建进度条
        const videoId = hashCode(url).toString(36);

        // 检查是否已经在下载中
        if (document.getElementById('tg-progress-' + videoId)) {
            console.log('[下载] 该视频已在下载中，跳过');
            return;
        }

        // 提取文件名
        try {
            const metadata = JSON.parse(decodeURIComponent(url.split('/')[url.split('/').length - 1]));
            if (metadata.fileName) fileName = metadata.fileName;
            if (metadata.mimeType) fileExtension = metadata.mimeType.split('/')[1];
        } catch (e) {}

        createProgressBar(videoId, fileName);

        const fetchNext = async () => {
            try {
                const res = await fetch(url, {
                    method: 'GET',
                    headers: { 'Range': `bytes=${nextOffset}-` },
                    credentials: 'include'
                });

                if (![200, 206].includes(res.status)) {
                    throw new Error(`HTTP ${res.status}`);
                }

                const mime = res.headers.get('Content-Type')?.split(';')[0];
                if (mime && mime.startsWith('video/')) {
                    fileExtension = mime.split('/')[1];
                    fileName = fileName.substring(0, fileName.lastIndexOf('.') + 1) + fileExtension;
                }

                const range = res.headers.get('Content-Range');
                if (range) {
                    const match = range.match(contentRangeRegex);
                    if (match) {
                        const start = parseInt(match[1]);
                        const end = parseInt(match[2]);
                        const total = parseInt(match[3]);

                        if (start !== nextOffset) throw new Error('分块不连续');
                        if (totalSize && total !== totalSize) throw new Error('大小不一致');

                        nextOffset = end + 1;
                        totalSize = total;

                        updateProgress(videoId, fileName, Math.round((nextOffset * 100) / totalSize));
                    }
                }

                blobs.push(await res.blob());

                if (totalSize && nextOffset < totalSize) {
                    return fetchNext();
                } else {
                    const blob = new Blob(blobs, { type: `video/${fileExtension}` });
                    const blobUrl = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = blobUrl;
                    a.download = fileName;
                    a.style.display = 'none';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);

                    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);

                    completeProgress(videoId);
                    notify('下载完成', fileName);
                }
            } catch (error) {
                console.error('[下载错误]', error);
                abortProgress(videoId);
                throw error;
            }
        };

        return fetchNext();
    }

    // Canvas捕获图片
    async function captureImage(imgElement) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = imgElement.naturalWidth || imgElement.width;
                canvas.height = imgElement.naturalHeight || imgElement.height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(imgElement, 0, 0);

                canvas.toBlob((blob) => {
                    if (blob) {
                        resolve(URL.createObjectURL(blob));
                    } else {
                        reject(new Error('Canvas转换失败'));
                    }
                }, 'image/png', 1.0);
            } catch (error) {
                reject(error);
            }
        });
    }

    // 备用下载
    async function fallbackDownload(url, filename, mediaType, sourceElement) {
        try {
            let blobUrl;

            // 视频 - 使用分块下载
            if (mediaType === 'video') {
                await downloadVideo(url);
                return;
            }

            // 图片 - 使用Canvas
            if (mediaType === 'image' && sourceElement && sourceElement.tagName === 'IMG') {
                if (!sourceElement.complete) {
                    await new Promise((resolve, reject) => {
                        sourceElement.onload = resolve;
                        sourceElement.onerror = () => reject(new Error('图片加载失败'));
                        setTimeout(() => reject(new Error('超时')), 10000);
                    });
                }
                blobUrl = await captureImage(sourceElement);
            }
            // Blob URL
            else if (url.startsWith('blob:') || url.startsWith('data:')) {
                blobUrl = url;
            }
            // 普通下载
            else {
                const res = await fetch(url, { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                blobUrl = URL.createObjectURL(blob);
            }

            // 下载
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => {
                if (!url.startsWith('data:') && !url.startsWith('blob:')) {
                    URL.revokeObjectURL(blobUrl);
                }
            }, 100);

            notify('下载完成', filename);
        } catch (error) {
            console.error('[下载错误]', error);
            throw error;
        }
    }

    // 下载媒体
    async function downloadMedia(url, mediaType, sourceElement = null) {
        const timestamp = Date.now();
        const ext = mediaType === 'video' ? 'mp4' : 'jpg';
        const baseFilename = `telegram_${mediaType}_${timestamp}.${ext}`;

        try {
            await fallbackDownload(url, baseFilename, mediaType, sourceElement);
        } catch (error) {
            notify('下载失败', error.message);
        }
    }

    // 获取最佳质量URL
    function getBestQualityUrl(element, mediaType) {
        if (mediaType === 'video') {
            const source = element.querySelector('source');
            if (source?.src) return source.src;
            if (element.src) return element.src;
            return element.getAttribute('data-src') || element.getAttribute('data-video');
        } else {
            if (element.src) return element.src;

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

            return element.getAttribute('data-src') || element.getAttribute('data-image');
        }
    }

    // 检测聊天列表
    function isInChatListOrSidebar(element) {
        return element.closest('.chat-list') ||
               element.closest('.chatlist') ||
               element.closest('[class*="ChatList"]') ||
               element.closest('[class*="DialogList"]') ||
               element.closest('.sidebar') ||
               element.closest('[class*="Sidebar"]');
    }

    // 检测真实媒体内容
    function isActualMediaContent(element, container) {
        return container.closest('.media-viewer') ||
               container.closest('.MediaViewer') ||
               container.closest('.message-media') ||
               container.closest('[class*="MediaViewer"]') ||
               container.closest('[class*="MessageMedia"]');
    }

    // 创建下载按钮
    function createDownloadButton(mediaElement, mediaUrl, mediaType, container) {
        const button = document.createElement('button');
        button.className = 'tg-download-btn';
        button.innerHTML = `
            <svg class="tg-download-btn-icon" viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span>下载${mediaType === 'video' ? '视频' : '图片'}</span>
        `;

        // 根据配置设置按钮位置
        const positions = {
            'top-right': 'top:10px;right:10px;',
            'top-left': 'top:10px;left:10px;',
            'bottom-right': 'bottom:10px;right:10px;',
            'bottom-left': 'bottom:10px;left:10px;'
        };
        const positionStyle = positions[CONFIG.buttonPosition] || positions['top-right'];

        button.style.cssText = `position:absolute;${positionStyle}padding:8px 16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;border:none;border-radius:20px;cursor:pointer;font-size:14px;font-weight:bold;display:flex;align-items:center;gap:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:1000;opacity:0.9;transition:all 0.3s;`;

        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            await downloadMedia(mediaUrl, mediaType, mediaElement);
        });

        button.addEventListener('mouseenter', () => {
            button.style.opacity = '1';
            button.style.transform = 'scale(1.05)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.opacity = '0.9';
            button.style.transform = 'scale(1)';
        });

        return button;
    }

    // 处理媒体元素
    function processMediaElement(element, mediaType) {
        if (element.hasAttribute('data-tg-processed')) return;
        element.setAttribute('data-tg-processed', 'true');

        if (isInChatListOrSidebar(element)) return;

        let container = element.closest('.media-viewer-content') ||
                       element.closest('.media-viewer') ||
                       element.closest('.message-media') ||
                       element.closest('[class*="Media"]') ||
                       element.parentElement;

        if (!container) container = element;
        if (!isActualMediaContent(element, container)) return;

        const url = getBestQualityUrl(element, mediaType);
        if (!url) return;

        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const button = createDownloadButton(element, url, mediaType, container);
        container.appendChild(button);
    }

    // 观察器
    function startObserving() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // 图片
                        if (node.tagName === 'IMG') {
                            processMediaElement(node, 'image');
                        }
                        node.querySelectorAll?.('img').forEach(img => {
                            processMediaElement(img, 'image');
                        });

                        // 视频
                        if (node.tagName === 'VIDEO') {
                            processMediaElement(node, 'video');
                        }
                        node.querySelectorAll?.('video').forEach(video => {
                            processMediaElement(video, 'video');
                        });
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 初始扫描
        document.querySelectorAll('img').forEach(img => processMediaElement(img, 'image'));
        document.querySelectorAll('video').forEach(video => processMediaElement(video, 'video'));
    }

    // CSS样式
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tg-download-btn-icon { width: 16px; height: 16px; fill: currentColor; }
        `;
        document.head.appendChild(style);
    }

    // 进度条容器
    function setupProgressContainer() {
        const container = document.createElement('div');
        container.id = 'tg-progress-container';
        container.style.cssText = 'position:fixed;bottom:0;right:0;z-index:9999;';
        document.body.appendChild(container);
    }

    // 注册菜单命令
    function registerMenuCommands() {
        GM_registerMenuCommand('📍 按钮位置: 右上角', () => {
            CONFIG.buttonPosition = 'top-right';
            saveConfig();
            alert('✅ 按钮位置已设置为：右上角\n\n刷新页面后生效');
        });

        GM_registerMenuCommand('📍 按钮位置: 左上角', () => {
            CONFIG.buttonPosition = 'top-left';
            saveConfig();
            alert('✅ 按钮位置已设置为：左上角\n\n刷新页面后生效');
        });

        GM_registerMenuCommand('📍 按钮位置: 右下角', () => {
            CONFIG.buttonPosition = 'bottom-right';
            saveConfig();
            alert('✅ 按钮位置已设置为：右下角\n\n刷新页面后生效');
        });

        GM_registerMenuCommand('📍 按钮位置: 左下角', () => {
            CONFIG.buttonPosition = 'bottom-left';
            saveConfig();
            alert('✅ 按钮位置已设置为：左下角\n\n刷新页面后生效');
        });
    }

    // 初始化
    function init() {
        addStyles();
        setupProgressContainer();
        startObserving();
        registerMenuCommands();
        console.log('[Telegram下载器] v1.5.4 已加载');
        console.log('[配置] 按钮位置:', CONFIG.buttonPosition);
    }

    // 启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
