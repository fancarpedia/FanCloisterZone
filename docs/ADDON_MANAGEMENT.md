# Add-on Management

Addon management uses a manifest-driven flow with a single reload path for startup, manual changes, installs, uninstalls, and automatic updates.

## Startup Flow

1. The main process registers a small IPC endpoint that returns the built-in add-on defaults, including the fallback manifest URL.
2. The renderer reads the current `addonsManifestUrl` setting.
3. If the setting is empty, the renderer uses the built-in default manifest URL.
4. The add-on service fetches the manifest, filters versions to those compatible with the current app version, and builds the downloadable list.
5. Installed add-ons are loaded from disk and merged into one in-memory list.
6. After the first load, the app checks whether any downloadable add-on is outdated and updates it if auto-update is allowed.

## Installed Add-ons

Installed add-ons are collected from:

- `settings.userAddons`, which are custom folders chosen by the user.
- `process.resourcesPath/addons`, which contains bundled add-ons.
- The user data add-ons directory, which is where downloaded add-ons are installed.

The loader keeps the first add-on with a given id and ignores later duplicates. That means a user-provided add-on can override a bundled one with the same id.

Each add-on is validated before it is accepted:

- `jcz-addon.json` must exist.
- `version` must be a valid integer.
- `minimumJczVersion` must be present.
- The add-on must be compatible with the running app version.

If the add-on defines artwork entries, those artworks are loaded after the add-on metadata is accepted. When an add-on is installed or removed, its artwork ids are added to or removed from the enabled artwork list in settings.

## Downloadable Add-ons

The downloadable list is built from the manifest JSON.

- Each add-on entry may contain several versions.
- Only versions compatible with the current app version are kept.
- Development builds use the dev-specific version bounds when they are present.
- The classic add-on must be present in the manifest and must include a `sha256` checksum.

When the user installs a downloadable add-on, the app:

1. Resolves the download URL, including trying multiple mirrors when needed.
2. Downloads the `.jca` package to a temporary file.
3. Verifies the SHA-256 checksum when one is provided.
4. Unpacks the archive into a temporary directory.
5. Validates the extracted add-on metadata.
6. Moves the add-on into the user data add-ons folder.

If the add-on is already installed and the requested version is newer, the old version is removed first and then replaced.

## Automatic Updates

The update pass currently focuses on downloadable add-ons that allow auto-update.

- On startup, the app checks installed add-ons against the manifest.
- If a newer compatible version exists, the add-on is removed and reinstalled.
- After an update, the app reloads add-ons, tiles, and artworks so the UI reflects the new files immediately.

The classic add-on gets one extra check: if the installed copy is missing or outdated, the app can download the newest compatible version from the manifest and replace the old files.

## Reload Behavior

The app now refreshes add-ons when any of these happen:

- The user changes the manifest URL.
- The user edits the list of custom add-on folders.
- An add-on is installed or uninstalled.
- The developer menu action for reloading add-ons is used.

This keeps the in-memory add-on list, the tile and artwork loaders, and the settings UI in sync.

## Game Validation

Saved games and remote games can declare required add-ons and versions.

- If a required add-on is missing, the game is blocked.
- If an installed add-on is older than the required version, the game is blocked.
- The validation runs for both local saves and remote games, so a match cannot start with incompatible content.

## User Experience

In the Settings screen, the user can:

- Leave the manifest URL empty to use the built-in default.
- Paste a custom manifest URL.
- Install a local `.jca` file by drag and drop or file picker.
- Install downloadable add-ons from the manifest list.
- Remove installed add-ons that are marked as removable.

If the classic add-on is missing, the landing page shows a warning and displays the download URL that the app is currently using.

## Main Files Involved

- `src/main/modules/addonDefaults.js` provides the built-in manifest URL.
- `src/renderer/plugins/addons.js` loads, validates, installs, updates, and removes add-ons.
- `src/renderer/layouts/default.vue` triggers the initial reload and wires setting changes into the add-on service.
- `src/renderer/components/settings/AddonsSettings.vue` exposes the add-on management UI.
- `src/renderer/store/game.js` and `src/renderer/store/networking.js` block game loads when required add-ons are missing.
