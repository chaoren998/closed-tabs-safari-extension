# Safari Closed Tabs Extension

This repository contains a Safari-first extension for listing and reopening recently closed tabs.

The project includes:

- The web extension source in `extension/`
- Automated tests in `tests/`
- An Xcode project for Safari packaging in `Closed Tabs/Closed Tabs.xcodeproj`

## Download

Download the latest macOS build from the [GitHub Releases page](https://github.com/chaoren998/closed-tabs-safari-extension/releases).

Note: the current downloadable build is development-signed and not notarized yet, so macOS may show a Gatekeeper warning on other Macs.

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

## Safari Packaging and Local Testing

Safari packaging and distribution are handled through Xcode. For quick local validation of the web extension layer, you can also temporarily install the `extension/` folder in Safari:

- [Temporarily install a web extension folder in macOS Safari](https://developer.apple.com/documentation/safariservices/safari_web_extensions/running_your_safari_web_extension)
