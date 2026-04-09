[English](./README.md) | [简体中文](./README.zh-CN.md)

# Safari Closed Tabs Extension

Closed Tabs is a Safari-first extension for listing and reopening recently closed tabs from an extension-managed history.

The project includes:

- The web extension source in `extension/`
- Automated tests in `tests/`
- An Xcode project for Safari packaging in `Closed Tabs/Closed Tabs.xcodeproj`

## Download

Download the latest macOS build from the [GitHub Releases page](https://github.com/chaoren998/closed-tabs-safari-extension/releases).

## Install The macOS Build

1. Download the latest `Closed-Tabs-macOS-*.zip` file from Releases.
2. Unzip the archive.
3. Move `Closed Tabs.app` to `/Applications`.
4. Open `Closed Tabs.app` once.
5. Open Safari and enable the extension in `Safari > Settings > Extensions`.

## Security Notice

The current downloadable build is development-signed and not notarized yet.

Because of that, macOS Gatekeeper may block the app the first time you try to open it on another Mac. Apple documents that apps that are not notarized or otherwise not allowed to open may require a manual override in `System Settings > Privacy & Security`.

## If macOS Blocks The App

If macOS shows a warning and won’t open the app:

1. Try to open `Closed Tabs.app` once so macOS records the blocked app.
2. Open `System Settings > Privacy & Security`.
3. Scroll down to the `Security` section.
4. Find the message saying the app was blocked, then click `Open Anyway`.
5. Confirm the warning dialog and enter your login password if macOS asks for it.
6. Open the app again.

Notes:

- Apple says the `Open Anyway` button is available for about one hour after you try to open the app.
- After you approve it once, macOS saves the app as an exception and you can open it normally later.
- If your Mac is managed by your company or school, these settings may be restricted by an administrator.

## Project Layout

- Extension source lives in `extension/`
- Background entrypoint: `extension/src/background/background.html`
- Popup entrypoint: `extension/src/popup/popup.html`

## Open In Xcode

Open `Closed Tabs/Closed Tabs.xcodeproj`, then select the `Closed Tabs (macOS)` scheme to run, archive, and package the Safari extension app.

## Run Tests

```bash
npm test
```

## Safari Packaging And Local Testing

Safari packaging and distribution are handled through Xcode. For quick local validation of the web extension layer, you can also temporarily install the `extension/` folder in Safari:

- [Temporarily install a web extension folder in macOS Safari](https://developer.apple.com/documentation/safariservices/safari_web_extensions/running_your_safari_web_extension)

## References

- [Apple Support: Open an app by overriding security settings](https://support.apple.com/guide/mac-help/mh40617/mac)
- [Apple Support: Safely open apps on your Mac](https://support.apple.com/102445)
