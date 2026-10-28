# Stillwave — 音乐可视化

>让音乐，有迹可循

Stillwave 是一个纯前端的音乐可视化播放器。选择本地歌曲、专辑封面和 LRC 歌词，即可在浏览器中播放音乐、查看实时音频可视化和同步歌词，并自定义界面氛围色。

## 在线体验

**立即体验：** [https://blucelicoder.github.io/music-visualization/](https://blucelicoder.github.io/music-visualization/)

## 功能亮点

-**本地音频播放** - 支持 MP3、M4A、WAV 等格式
-**实时音频可视化** - 使用 Web Audio API 绘制频谱
-**LRC 歌词同步** - 解析带时间戳的歌词并随播放进度高亮
-**自定义专辑封面** - 上传图片作为专辑封面
-**自定义氛围色** - 随心选择你的点缀色
-**隐私安全** - 所有数据仅在浏览器本地处理，不会上传到服务器

## 快速开始

无需安装依赖或构建项目：

1. 下载或克隆项目。
2. 在现代浏览器中打开 `index.html`。
3. 选择一首本地音频；歌曲名称、演唱者、封面和 LRC 歌词均可选。
4. 设置氛围色，然后进入聆听空间。
5. 使用播放按钮和进度条控制播放；点击"编辑曲目"返回设置。

## 文件结构

```text
.
├── index.html   # 页面结构
├── 404.html     # 找不到页面时显示的错误页面
├── style.css    # 页面样式
├── script.js    # 播放器、歌词和可视化逻辑
└── logo.svg     # 页面图标
```

## 技术栈

- HTML5 + CSS3
- JavaScript (ES6+)
- Web Audio API
- Canvas API

## 兼容性

建议使用支持 HTML 音频和 Web Audio API 的现代浏览器。可播放的音频格式取决于浏览器；常见格式包括 MP3、M4A 和 WAV。实时频谱可视化需要浏览器支持 Web Audio API。

## 许可证

MIT License
