# 云包饺子·冬至团圆局（DumplingCloud）

冬至主题暖色治愈 H5 互动小游戏：和面、擀皮、包饺子、下锅，生成专属结果页与分享内容。后端使用 Node.js + Express + SQLite 提供参与人数统计与分享相关接口。

## 功能

- 四步互动流程：和面 / 擀皮 / 包馅 / 下锅
- 结果页生成：人格标签与冬至祝福
- 参与人数统计：服务端 SQLite 计数，失败时前端本地计数兜底
- 分享能力：生成分享链接、生成分享图片预览

## 技术栈

- 前端：原生 HTML + CSS（Tailwind via CDN）+ 原生 JS
- 后端：Node.js、Express
- 数据库：SQLite（本地文件）

## 目录结构

```text
.
├─ index.html        # 页面与组件结构（含弹窗）
├─ styles.css        # 全局样式与适配
├─ app.js            # 前端交互逻辑（拖拽/步骤/分享/参与人数）
├─ server.js         # Express 服务与 API（参与人数/分享）
├─ package.json      # 依赖与启动脚本
└─ dumpling.sqlite   # SQLite 数据库文件（运行后生成/更新）
```

## 本地运行

### 1) 安装依赖

```bash
npm install
```

### 2) 启动服务

```bash
npm start
```

启动后访问终端输出的地址（默认从 `3000` 起，如端口被占用会自动递增）。

## 环境变量

- `PORT`：服务端端口（默认 `3000`，占用时自动尝试后续端口）
- `DB_PATH`：SQLite 文件路径（默认 `./dumpling.sqlite`）
- `DEFAULT_EVENT`：参与人数统计的默认事件名（默认 `yun_jiaozi_dongzhi`）

## API

- `GET /api/participants?event=...`：获取参与人数
- `POST /api/participants`：参与人数 +1  
  - JSON Body：`{ "event": "yun_jiaozi_dongzhi" }`
- `GET /api/share-qr?data=...`：生成分享二维码 PNG
- `POST /api/share-image`：上传分享图片（PNG/WEBP），返回可访问 URL
- `GET /share-image/:id`：访问分享图片资源（临时缓存）
- `GET /health`：健康检查

## 许可证

未指定许可证。若需要开源发布，建议补充 `LICENSE`。

