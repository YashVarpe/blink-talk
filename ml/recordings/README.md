# BlinkTalk eye-gesture recordings

Labeled training data we recorded ourselves at UB Hacking 2026 to build BlinkTalk's eye-gesture classifier.
All four team members agreed to publish these files.

**What is pretrained and what is ours**
- **Pretrained (Google MediaPipe Face Landmarker):** turns each camera frame into face measurements
  (52 "blendshape" scores such as eye openness and gaze direction, plus head angles).
- **Ours:** these labeled recordings, the gesture classifier trained from scratch on them (LightGBM,
  `ml/notebooks/02_train_classifier.ipynb`), its evaluation on people it never saw
  (`web/public/results.json`), and the per-user calibration in the app (`web/lib/calibrate.ts`).

**Privacy:** no images or video are stored, only numbers per frame. Video never leaves the browser.

## How they were recorded
`ml/recorder/index.html` (open it via a local web server) shows guided prompts and labels every frame automatically:

| Session | Length | What the person does |
|---|---|---|
| `guided` | ~3 min | relax (`idle`), normal blinks (`natural_blink`), long blinks (`long_blink`, close at the 1st beep, open at the 2nd), look at a dot on the left / right screen edge (`left` / `right`), raise eyebrows (`brow_up`) |
| `normal` | ~2 min | talk, laugh, look around, without doing any gesture (everything is `idle`); used to measure false activations |

Same laptop, same seat, camera at head level. `_glasses` sessions were recorded wearing glasses.

## Files
`<person>_<session>_<timestamp>.json`, one per session: 4 people × (guided + normal), plus 2 guided sessions with glasses.
Everything before `_glasses` / `_guided` / `_normal` is the person; glasses sessions count as the same person in testing.

## Format
```jsonc
{
  "person": "yashvarpe",
  "session": "guided",            // or "normal"
  "created": "2026-11-08T01:57:51.681Z",
  "userAgent": "…",               // browser that recorded it
  "bsNames": ["_neutral", "browDownLeft", …],   // names of the 52 blendshape scores
  "frames": [
    {
      "t": 1234.5,                // ms since the session started
      "label": "long_blink",      // idle | natural_blink | long_blink | left | right | brow_up
      "trial": 12,                // trial id while a prompt is active, -1 between prompts
      "faceFound": true,
      "blink": 0.81,              // (eyeBlinkLeft + eyeBlinkRight) / 2
      "lookA": 0.05,              // (eyeLookOutLeft + eyeLookInRight) / 2
      "lookB": 0.03,              // (eyeLookInLeft + eyeLookOutRight) / 2
      "brow": 0.01,               // browInnerUp
      "yaw": -2.1, "pitch": 0.4,  // head angles, degrees
      "bs": [0.0, 0.01, …]        // all 52 blendshape scores, same order as bsNames
    }
  ]
}
```
30–60 frames per second depending on the camera and lighting.

## How they are used
`ml/notebooks/02_train_classifier.ipynb` loads every file here, fixes labels for reaction time, builds 1-second
windows, trains the classifier with **leave-one-person-out** testing (train on three people, test on the fourth),
measures false activations on the `normal` sessions, and exports `web/public/models/signal_trees.json` and
`web/public/results.json`. Run it top to bottom to reproduce the numbers.
