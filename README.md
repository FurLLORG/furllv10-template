# FurLLV10

> **AI 辅助声明**：本仓库部分代码由 AI 辅助生成 / AI 自动补全（含代码、文档与构建脚本）。已在人工审阅与测试后发布，但请在使用前自行评估与验证。

>注意到有人称本模板为「老嫂子模板」。回应见 [DISPUTES.md](./DISPUTES.md),爱用不用。

FurLLCN 出品的**魔方业务系统 V10** 前台模板：官网 + 会员中心，React 单应用。

基于 [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin)（MIT）二次开发，
技术栈：Vite 8 + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui + TanStack Router/Query/Table + Zustand + axios。

- 官网：https://furll.cn
- 测试站：https://v10.ruinexus.com
- 组织：https://github.com/FurLLORG
- 许可证：MIT（本仓库 LICENSE），上游许可证见 `LICENSE-shadcn-admin`，attribution 见 `NOTICE`

## 在线演示

测试站点：**https://v10.ruinexus.com**

### 测试账号

- 邮箱：`github@furll.cn`
- 密码：`test114514`

> 该账号仅用于功能体验。

## 前置插件

使用本模板前，需先安装配套插件（官网首页配置）：

- https://github.com/FurLLORG/furllv10-home-plugin/

## 注意事项

> **开发状态**：本模板当前正处于**迭代开发中**，功能与稳定性将随版本持续完善，敬请关注后续更新。
>
> **移动端适配**：已针对**手机端（移动端）完成适配**，桌面端与移动端均可正常使用，体验会随版本持续优化。
>
> **轮播图**：首页轮播图为 **AI 生成**的示意图片，请自行更换为你自己的素材。

由于本模板的特殊性，所有未适配的插件和部分产品管理都需要手动适配。若在使用过程中遇到相关问题，可以通过以下方式联系我们：

- 邮件：`github@furll.cn`
- QQ 群：`311971756`
- 提交 Issues：https://github.com/FurLLORG/furllv10-template/issues

也感谢有能力者提交 PR。


## 这是什么

非标准模板，**仅采用官方模板载入方式**部署。

一份 React 构建产物分发为系统要求的多页面入口文件，由官方模板解析机制逐页输出：

- 官网：`public/web/FurLLV10/*.html`（34 页 + solution 8 子页），页面路由由前端 TanStack Router
  接管（path 带 `.html` 后缀对齐系统 URL），页面间跳转无刷新。
- 会员中心：`public/clientarea/template/pc|mobile/FurLLV10/*.php` 薄壳。
- 购物车 / 首页：`public/cart/`、`public/home/template/pc|mobile/FurLLV10/` 壳。

数据全部走 `/console/v1` API（token 存 `localStorage.jwt`，与官方约定一致）。

## 开发

```bash
pnpm install
pnpm dev        # vite dev，/console/v1 代理到 .env 的 VITE_API_PROXY_TARGET（默认 https://v10.ruinexus.com）
pnpm lint
```

## 站点配置

模板读取根目录 `.env` 的环境变量。**`./release.sh` 运行时会交互式询问你输入站点信息**（各项可直接回车用默认值），
脚本自动写入 `.env` 再打包，无需手动建 `.env`。

| 变量 | 说明 | 默认 |
|------|------|------|
| `VITE_API_PROXY_TARGET` | 开发时 `/console/v1` 代理目标（填你后端魔方站点根地址） | 空 |
| `VITE_APP_SITE_NAME` | 站点名兜底（common 未加载完时登录/注册页标题用） | `FurLL 客户中心` |
| `VITE_APP_TITLE` | 浏览器标题（index.html `%VITE_APP_TITLE%` 占位替换） | `FurLL 客户中心` |
| `VITE_APP_DESCRIPTION` | SEO meta description | 魔方业务前台模板 FurLLV10 |
| `VITE_APP_KEYWORDS` | SEO meta keywords | 魔方业务,IDC,FurLLV10 |

> 提示：`VITE_APP_TITLE` / `VITE_APP_DESCRIPTION` / `VITE_APP_KEYWORDS` 用于替换 `index.html`
> 中的 `<title>` 与 meta 标签（即浏览器标题与 SEO 元信息）；`VITE_APP_SITE_NAME` 为兜底值——
> 当 `/common` 接口未返回站点名时，登录/注册页标题会回退显示它。这些配置仅影响构建产物中的
> 静态元信息与接口兜底显示，不会改变页面实际内容与业务功能。

### 打包步骤

执行一键构建，按提示输入你的站点信息（可回车用默认值）：

```bash
./release.sh
```

```
→ [2/5] 站点配置 ...
   VITE_API_PROXY_TARGET（开发代理，本地调试用，可留空）:
   VITE_APP_SITE_NAME（站点名，默认: FurLL 客户中心）:
   VITE_APP_TITLE（浏览器标题，默认: FurLL 客户中心）:
   ...
```

说明：
- 生产部署**无需配代理**：API 走同域相对路径 `/console/v1`，与魔方系统同域即可直接使用。
  `VITE_API_PROXY_TARGET` 仅本地 `pnpm dev` 调试时用到。
- 手动用 `pnpm dev` / `pnpm build` 调试时，可自行编辑 `.env`（参考 `.env.example`）。
- 重新运行 `./release.sh` 会再次询问并覆盖 `.env`。

## 构建与分发

一键构建（推荐）：

```bash
./release.sh
```

或手动分步：

```bash
pnpm build                 # tsc + vite build → dist/
node deploy.mjs            # 分发到 public/ 下：
                           #   web/FurLLV10/（官网 html 页 + assets）
                           #   clientarea/template/pc|mobile/FurLLV10/（php 薄壳）
                           #   cart/、home/template/pc|mobile/FurLLV10/、images/
```

产物都在本目录 `public/` 下，按 `release.sh` 里的上传指引，把这些子目录合并到服务器魔方系统的
`public/`（上传到 站点根目录/public/web、public/clientarea、public/cart、public/home、public/images）。
`dist/`、`node_modules/`、`favicon.ico`、`mock-sw.js` 无需上传。

后台切换主题：全部修改为 FurLLV10。

## 例图

| 首页 | 登录页 |
|------|--------|
| <img width="600" alt="首页" src="https://github.com/user-attachments/assets/ca721306-9b02-4079-8684-bf59d03a706d" /> | <img width="600" alt="登录页" src="https://github.com/user-attachments/assets/191dc0f9-4de4-417f-aa91-67b79d7a5f0d" /> |

| 注册页 | 用户中心首页 |
|------|--------|
| <img width="600" alt="注册页" src="https://github.com/user-attachments/assets/4a67e28b-e43c-4472-b6a2-ce52f67bec47" /> | <img width="600" alt="用户中心首页" src="https://github.com/user-attachments/assets/b517f57d-5125-4a5d-835a-888aeff1da92" /> |

| 工单 | 可购买产品列表 |
|------|--------|
| <img width="600" alt="工单" src="https://github.com/user-attachments/assets/ec71024f-8291-460f-93d8-9f95c6045d77" /> | <img width="600" alt="可购买产品列表" src="https://github.com/user-attachments/assets/273de6fb-b02e-4f37-949a-d3cccf40b48f" /> |

| 资源中心（新闻） | 公告中心 |
|------|--------|
| <img width="600" alt="资源中心（新闻）" src="https://github.com/user-attachments/assets/35da2a73-a71e-4c38-9901-1255f8238bd0" /> | <img width="600" alt="公告中心" src="https://github.com/user-attachments/assets/56b3e8de-7fc9-4d7b-8f76-3eb3f1ad8114" /> |


## 路由约定

路由在 `src/router.tsx` 手写（code-based）——TanStack Router 文件路由会把 `.htm` 当作嵌套
分隔符，故不支持 `xxx.htm.tsx` 文件命名，必须用 `createRoute({ path: 'xxx.htm' })`。

## 字体协议

全站默认字体为**阿里巴巴普惠体 3.0**（Alibaba PuHuiTi 3.0），自托管于
`src/assets/fonts/`（woff2，Regular/Medium/SemiBold/Bold 四字重，符合国标
GB18030-2022），CSS 引用见 `src/styles/index.css`。

- 阿里巴巴普惠体为阿里巴巴（中国）有限公司发布的**免费正版商用字体**，
  个人与企业均可免费用于商业/非商业用途（含网站、H5、小程序等嵌入式应用）。
- 授权条款：免费普通许可；不得仿制/反向工程字库软件、不得删除或修改法律声明、
  不得将字体单独定价出售/出租/转让/转授权。争议适用中国法律，管辖法院为杭州市。
- 字体来源与官方声明：https://www.alibabafonts.com（字体包内含法律声明文件）
- 本仓库随模板附带字体文件（woff2 子集，约 21.7MB），使用前请阅读字体包内
  《阿里巴巴普惠体 3.0 版法律声明》。
