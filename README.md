# Safari Closed Tabs Extension

This repository contains a Safari-first web extension prototype for listing and reopening recently closed tabs.

## Project Layout

- Extension source lives in `extension/`
- Background entrypoint: `extension/src/background/background.html`
- Popup entrypoint: `extension/src/popup/popup.html`

## Run Tests

```bash
npm test
```

## Safari Packaging and Local Testing

This repository is only the web-extension source and tests. Full Safari packaging/distribution still requires Xcode.

For local Safari verification, use Apple’s guidance for temporarily installing a web extension folder in macOS Safari and point Safari to the `extension/` directory:

- [Temporarily install a web extension folder in macOS Safari](https://developer.apple.com/documentation/safariservices/safari_web_extensions/running_your_safari_web_extension)
