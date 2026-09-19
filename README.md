# MengSign

国科大课程与签到 PWA。Next.js + TypeScript + Tailwind CSS，适配手机、桌面与深色模式，可部署到 Vercel Hobby。

## 功能

- SEP 邮箱／轻新课堂学号登录；密码仅用于本次学校验证，不保存。
- 今日课表、当前／下一节课、手动签到、动态二维码。
- 演示模式不调用学校签到接口，演示二维码不能用于真实签到。
- 添加到主屏幕，缓存应用外壳与按账号、日期隔离的本机课表。
- 没有后台自动签到、密码托管、数据库或收费依赖。

## 本地运行

需要 Node.js 24。

```sh
npm ci
cp .env.example .env.local
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

把生成的随机值填入 `.env.local` 的 `SESSION_SECRET`，`APP_ORIGIN` 使用 `http://localhost:3000`。不要提交 `.env.local`。

```sh
npm run dev
```

访问 http://localhost:3000 。无需学校账号即可进入演示模式。

## 验证

```sh
npm run test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

已安装 Chrome 时可设置 `PLAYWRIGHT_CHANNEL=chrome` 运行浏览器测试。Windows PowerShell：`$env:PLAYWRIGHT_CHANNEL='chrome'`。

浏览器测试使用示例数据与模拟失败响应，不执行真实签到。截图输出到被 Git 忽略的 `artifacts/`。生产离线测试见 `tests/e2e/pwa.spec.ts`，通过 `PWA_TEST=1` 对生产服务运行。

## Vercel 部署

1. 将此仓库导入自己的 Vercel Hobby 账号，Framework Preset 选择 Next.js。
2. 设置环境变量：`SESSION_SECRET`（新生成的 32 字节 base64 随机密钥）；`APP_ORIGIN=https://mengsign.cdro.tech`；`ADDITIONAL_ORIGINS=https://mengsign.vercel.app`（生产别名）。预览部署的自动分配域名通过 Vercel 注入的 `VERCEL_URL` 验证来源。
3. 使用 `iad1` 区域，函数最长 60 秒，无 Cron、数据库或付费组件。实测香港和新加坡出口对学校端口建连不稳定，美国东部校时通过；改变区域前应重新验证学校连接。
4. 部署完成后访问 `/api/clock`；应返回数值型 `timestamp`。这只验证学校接口可达性，不表示登录／签到已经验证。
5. 在项目 Settings → Domains 添加 `mengsign.cdro.tech`。在现有 DNS 服务商添加 `mengsign` CNAME，目标必须采用该 Vercel 项目显示的实际值，不要修改博客的根域记录。
6. 域名生效后验证 HTTPS，在页面中登录自己的学校账号，确认课表；仅在自己有效的课程中主动点击签到进行最终验证。

GitHub 主分支的提交由 Vercel 自动构建部署。回滚使用 Vercel 的历史部署，回滚后浏览器可关闭所有 MengSign 窗口并重新打开以启用对应 Service Worker。

如果学校阻止云端 IP 或端口连接，本机测试成功也不能保证 Vercel 可用。此时不能宣称真实功能上线成功；应先解决网络可达性，而不是把演示数据当成真实结果。少量用户下的按需请求适配免费计划，免费额度并非无限。

## 接口与数据

| 接口 | 行为 |
| --- | --- |
| POST `/api/auth/login` | `{account,password}`；返回脱敏 profile，写入加密 Cookie |
| GET `/api/auth/session` | 本站会话及脱敏 profile；上游有效性在课表请求中验证 |
| POST `/api/auth/logout` | 清除本站 Cookie |
| GET `/api/courses` | 当天课程、独立周课表回退、上海时区日期及更新时间 |
| GET `/api/clock` | 学校时间、上游耗时、采样时间 |
| POST `/api/attendance` | `{courseId,accountKey}`；服务端核验当前会话与本人今日课程后提交，accountKey 仅用于检测其他窗口的账号切换 |

错误响应：`{error:{code,message}}`。所有业务响应 `private, no-store`。生产会话为 AES-256-GCM 认证加密的 `__Host-` Cookie（HttpOnly、Secure、SameSite=Strict、无 Domain），最长七天。更新 SESSION_SECRET 会使旧会话全部失效。

学校 session 不返回 JavaScript；浏览器只保存主题、脱敏账号标识和本机课表。Service Worker 不缓存 API 或 RSC 响应，离线不排队签到。退出和清除数据时删除本机个人缓存；无数据库因此不提供远程撤销其他设备会话功能。

签到结果只在学校明确确认，或重新查询课表确认后才报告成功。网络超时不自动重发签到。跨实例／多设备的最终去重由学校系统完成，本应用只在当前页面防止重复点击；不是面向全校的公共托管服务。

周课表适配器要求明确的 `STATUS=0` 成功和数组结构。原 Android 实现中相反的条件未被照搬，最终仍需真实账号响应验证；未知响应显示错误而不冒充空课表。

## 许可与致谢

本项目按 AGPL-3.0-only 发布。学校接口约定及相关思路来自：

- https://github.com/zhan-nine/UCAS-Sign-in
- https://github.com/lccipher/UCAS-Course-Sign-in

完整许可证见 `LICENSE`，修改与归属见 `NOTICE`，原项目声明保留在 `public/licenses/UPSTREAM-NOTICE.txt`。未使用 Android 小部件或 Breezy Weather 实现。

非学校官方应用。请在自己的课程中正常使用，签到结果以学校系统为准。
