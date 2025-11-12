# Integration Plan for Gyroscope Motion Sensing in Chess App

## Information Gathered
- The `useGyroscope` hook is available and provides device orientation data (alpha, beta, gamma) via DeviceOrientationEvent.
- The app currently uses click-based input for selecting squares and making moves in the Chessboard component.
- Telegram mini-apps run in a webview, so gyroscope access is possible if permissions are granted, but may require user interaction (e.g., button to request access).
- Motion sensing can be used as an alternative input method, e.g., tilting the device to navigate or select moves, but chess moves are discrete, so mapping needs to be intuitive (e.g., tilt to move a virtual cursor).

## Plan
- Integrate the `useGyroscope` hook into the App component to manage gyroscope state.
- Modify the Chessboard component to support motion-based input as an option (e.g., a toggle for motion mode).
- In motion mode, interpret gyroscope data to simulate cursor movement or direct move selection (e.g., tilt left/right for file, up/down for rank, and a shake or specific tilt to confirm move).
- Add a button to request gyroscope permission and enable motion sensing.
- Ensure fallback to click-based input if gyroscope is unavailable or disabled.
- Handle edge cases like permission denial or unsupported devices.

## Dependent Files to be Edited
- `App.tsx`: Import and use the `useGyroscope` hook, pass gyroscope data to Chessboard, add UI for enabling motion mode.
- `hooks/useGyroscope.ts`: Already implemented, no changes needed unless enhancements (e.g., calibration).
- No new dependencies required.

## Followup Steps
- Test on a mobile device with gyroscope support (e.g., via browser or Telegram webview).
- Verify permission request works in Telegram.
- Adjust sensitivity of tilt detection for better UX.
- Add user feedback (e.g., visual cursor on board during motion input).

## Completed Tasks
- [x] Integrate `useGyroscope` hook into App component.
- [x] Modify Chessboard component to accept motion mode props and gyroscope data.
- [x] Add motion cursor logic: tilt to move cursor (beta for row, gamma for col).
- [x] Add confirmation logic: shake (gamma > 45 degrees) to select square.
- [x] Add "Enable Motion" button in header to toggle motion mode and request permission.
- [x] Disable click input when in motion mode.
- [x] Add visual feedback: blue ring for motion cursor, instructions in board status.
- [x] Handle permission errors and unsupported devices.
- [x] Start dev server to test locally.
- [x] Test on mobile device or Telegram webview for gyroscope functionality.
- [x] Adjust sensitivity if needed (currently 10 degrees per square).
- [x] Ensure motion mode works for both 'one' and 'two' move modes.
