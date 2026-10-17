# Third-party audio notice — Arknights preview pack

These are third-party Arknights game audio recordings, NOT original Fourfold compositions and NOT assets offered here under an open-source license.

Source repository: https://github.com/PseudoMon/arknights-audio
Pinned source commit: `d6de8b50e23bdfa5cf9d391f4ccb3798d7baf4db`

The upstream README describes this repository as containing audio from the global version of Arknights, forked from Aceship, and says it is used for educational purposes only. No permissive license granting redistribution or use in another publicly released game was found at the repository root. A public GitHub URL does not itself grant such permission.

All rights to the game audio remain with their respective owners. Neither this integration nor attribution grants permission to distribute, publish, or commercially use these recordings. Before publishing a Fourfold release containing this pack, obtain the necessary permission or remove/replace the recordings. Selecting Original Synth changes playback but does not remove these files from a deployment.

This pack was added at the user's request for a local preview/prototype. It is not an official Arknights integration or endorsement.

## Provenance and processing

`sources.json` maps each local MP3 to its exact upstream WAV path and commit. BGM uses the upstream loop segments rather than the intro segments. WAVs were transcoded to MP3 at 44.1 kHz: 160 kbps for BGM and 112 kbps for SFX. Music was normalized toward -18 LUFS with a -2 dBTP ceiling; effects toward -16 LUFS with a -2 dBTP ceiling. This processing does not change their copyright status.

- `menu.mp3`: `m_sys_dontmaketrouble_loop`
- `battle.mp3`: `m_bat_talulhahard_loop`
- Other MP3 files: button, deployment, grenade explosion, shield, EMP, skill, win, loss/draw, and reward/offer cues.

## Removing the pack for a synth-only build

1. Set `defaults.pack` to `"synth"` in `js/audio.js`.
2. Delete the third-party MP3 files under this directory from the deployment.
3. Remove the Arknights pack option and related attribution UI if no longer needed.

The synth engine has no dependency on these recordings. If a previously saved Arknights preference remains, missing BGM files display a load error; explicitly select Original Synth in the mixer. Resetting `fourfold.audio` in local storage restores the build's defaults.
