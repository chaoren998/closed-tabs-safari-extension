[English](./README.md) | [简体中文](./README.zh-CN.md)

# Safari 最近关闭标签页扩展

Closed Tabs 是一个以 Safari 为中心的扩展，用来显示并重新打开扩展自己维护的最近关闭标签页历史。

本项目包含：

- 位于 `extension/` 的网页扩展源码
- 位于 `tests/` 的自动化测试
- 位于 `Closed Tabs/Closed Tabs.xcodeproj` 的 Safari 打包 Xcode 工程

## 下载

最新的 macOS 安装包可以从 [GitHub Releases 页面](https://github.com/chaoren998/closed-tabs-safari-extension/releases) 下载。

## 安装 macOS 版本

1. 在 Releases 页面下载最新的 `Closed-Tabs-macOS-*.zip`。
2. 解压压缩包。
3. 将 `Closed Tabs.app` 拖到 `/Applications`。
4. 先手动打开一次 `Closed Tabs.app`。
5. 打开 Safari，在 `Safari > 设置 > 扩展` 中启用该扩展。

## 安全提示

当前提供下载的版本还是开发签名版本，暂时没有做 notarization（苹果公证）。

因此，在其他 Mac 上第一次打开时，macOS Gatekeeper 可能会拦截这个 App。按照 Apple 官方说明，未公证或当前不被允许打开的 App，可能需要你在 `系统设置 > 隐私与安全性` 中手动放行。

## 如果 macOS 阻止打开

如果 macOS 提示无法打开这个 App，可以按下面步骤处理：

1. 先尝试打开一次 `Closed Tabs.app`，让系统记录这次拦截。
2. 打开 `系统设置 > 隐私与安全性`。
3. 向下滚动到 `安全性` 区域。
4. 找到与该 App 对应的拦截提示后，点击 `仍要打开`。
5. 在再次弹出的警告窗口中确认打开；如果系统要求输入登录密码，也请按提示完成。
6. 再次打开这个 App。

补充说明：

- Apple 官方说明 `仍要打开` 按钮通常只会在你尝试打开 App 后的大约 1 小时内显示。
- 你手动批准一次之后，系统会把它保存为例外项目，后续就可以像普通 App 一样直接双击打开。
- 如果你的 Mac 由公司或学校统一管理，这些设置可能会被管理员限制。

## 项目结构

- 扩展源码位于 `extension/`
- 后台入口：`extension/src/background/background.html`
- 弹窗入口：`extension/src/popup/popup.html`

## 用 Xcode 打开

使用 Xcode 打开 `Closed Tabs/Closed Tabs.xcodeproj`，然后选择 `Closed Tabs (macOS)` scheme，即可运行、归档和打包 Safari 扩展容器 App。

## 运行测试

```bash
npm test
```

## Safari 打包与本地调试

Safari 的正式打包和分发通过 Xcode 完成。如果你只是想快速验证网页扩展层，也可以在 Safari 中临时加载 `extension/` 目录：

- [Apple 官方文档：在 macOS Safari 中临时安装网页扩展目录](https://developer.apple.com/documentation/safariservices/safari_web_extensions/running_your_safari_web_extension)

## 参考资料

- [Apple 官方支持：通过覆盖安全设置来打开 App](https://support.apple.com/guide/mac-help/mh40617/mac)
- [Apple 官方支持：在 Mac 上安全地打开 App](https://support.apple.com/102445)
