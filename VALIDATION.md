# 验证记录

2026-09-19，Windows / Node.js 24.20.0。

- `npm test`：30 项通过，覆盖上海时区、课程解析、会话认证加密与过期、账号隔离、校时 TTL、二维码参数、课表回退、登录失败、签到确认及超时核对、来源校验、请求体大小和课程归属。
- `npm run typecheck`：通过。
- `npm run build`：生产构建通过。
- `npm audit`：当前依赖无已知漏洞。
- Playwright / 已安装 Chrome：桌面 1440×1000、手机 390×664 模拟视口，6 项流程测试通过；覆盖演示签到不发送真实签到、登录失败、二维码离线隐藏和恢复、明暗主题、安装引导对话框、退出与 API 边界。
- 生产服务 PWA：手机和桌面共 2 项通过，Service Worker 注册成功，离线刷新可打开应用外壳，API 未进入缓存。
- 已查看桌面和手机截图；本机截图在 Git 忽略的 `artifacts/` 内。
- 本机真实 `/api/clock`：HTTP 200，学校返回有效毫秒时间戳。

浏览器测试中的登录响应和演示课程不能代替真实账号验证。iOS 使用 Chromium 移动模拟验证布局，不代表已在实体 iPhone Safari 完成安装测试。

正式学校账号登录、课表及有效课程签到，需要账号所有者在部署页面主动完成。没有使用真实学校密码或执行真实签到。

## 部署记录

- GitHub：`https://github.com/576690/MengSign`，公开 AGPL-3.0 仓库。
- Vercel：`576690s-projects/mengsign`，已连接上述 Git 仓库。
- Production / Preview 的 SESSION_SECRET、APP_ORIGIN 已配置，密钥不在源码中。
- 自定义域名 `mengsign.cdro.tech` 已绑定，阿里云 DNS 所需 CNAME：`mengsign` → `476288b0621b722e.vercel-dns-017.com`。
- 云端可达性与域名验证结果在部署完成后补充。
