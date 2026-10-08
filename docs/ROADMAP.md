# 项目路线图：Mihomo 一体化管理方案

基于 AnGe-ClashBoard（MIT）二次开发，目标是对标 Open-Box 的完整一体化：
一键安装、订阅管理、配置生成、透明代理部署。内核选用 **Mihomo**
（VLESS Encryption 官方支持，节点全兼容）。

## 架构

```
┌──────────────────────────────────────────────────┐
│ 前端 (Vue 3, 现有)                                │
│ + 订阅管理 UI / 内核管理 UI / 部署 UI             │
└──────────────────────┬───────────────────────────┘
                       │ REST API
┌──────────────────────┴───────────────────────────┐
│ 后端 (Node, server/)                              │
│ ├── core/            # 内核版本管理               │
│ │   ├── mihomo.version  # 版本唯一来源（一行）   │
│ │   ├── download.mjs    # 下载官方 Release       │
│ │   └── manager.mjs     # 检查/升级 API          │
│ ├── subscriptions/   # 订阅管理                  │
│ │   ├── store.mjs       # CRUD + SQLite          │
│ │   └── fetcher.mjs     # 拉取订阅内容           │
│ ├── config/          # 配置生成                  │
│ │   ├── templates/      # 按内核版本分的模板     │
│ │   └── generator.mjs   # 生成 Mihomo YAML       │
│ └── deploy/          # 部署                      │
│     ├── openwrt.mjs     # 防火墙/DNS/服务控制    │
│     └── service.mjs     # 内核启停               │
└──────────────────────────────────────────────────┘
```

## 内核版本跟进设计（核心需求）

Mihomo 版本有且仅有一个来源：`core/mihomo.version`（一行，如 `v1.19.32`）。

- **下载**：`scripts/fetch-mihomo.sh [arch]` 读版本文件，从
  `github.com/MetaCubeX/mihomo/releases` 拉官方二进制，校验 SHA256。
- **检查更新**：`GET /api/core/check-update` 查 GitHub Releases API，
  对比 `mihomo.version`。
- **升级**：`POST /api/core/upgrade` → 下载新版 → `mihomo -v` 验明 →
  用新版 `mihomo -t` 校验现有配置 → 通过才替换二进制并重启。
- **配置兼容**：模板按大版本存放（`config/templates/v1/`），Mihomo
  有 breaking change 时只改模板，不动代码。

升级内核 = 改 `core/mihomo.version` 里一行版本号，其余自动化。

## 阶段

- **P0**（本阶段）：路线图 + 仓库骨架。`core/`、`docs/` 目录，
  版本文件与下载脚本。
- **P1**：内核管理后端 API（版本查询/检查更新/升级）+ 最小前端入口。
- **P2**：订阅管理（CRUD、定时拉取、SQLite 存储）。
- **P3**：配置生成（订阅 → Mihomo YAML，VLESS Encryption 透传，
  复用 sublink 的转换逻辑）。
- **P4**：部署（写配置、重启内核；OpenWrt 防火墙/DNS/TUN）。
- **P5**：一键安装脚本（OpenWrt）。
- **P6**：前端完整 UI（订阅/内核/部署三页）。

## 约定

- 后端保持单文件风格拆模块：`server/` 下按域拆 `.mjs`，`index.mjs`
  只做路由挂载（现有 5154 行单文件不再膨胀）。
- 所有写配置/换内核操作必须先校验（`mihomo -t`），失败拒绝执行。
- VLESS Encryption 节点必须全链路可用（解析→生成→部署），这是
  区别于 sing-box 方案的核心优势，回归测试覆盖。
