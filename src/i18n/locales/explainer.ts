import type { LocaleBundle } from '../types'

// Translations for the "explainer" area. Keep en + de keys in sync.
export const explainer: LocaleBundle = {
  en: {
    'explainer.page.eyebrow': 'Studio',
    'explainer.page.title': 'Explainer Studio',
    'explainer.page.subtitle': 'Record your screen, auto-zoom on every click, and export a polished product tutorial — all in the browser.',
    'explainer.page.subtitleMotion': 'After-Effects-style SaaS explainers, generated entirely in code — edit scenes, preview live, export as video.',

    'explainer.mode.aria': 'Explainer mode',
    'explainer.mode.motion': 'Motion video',
    'explainer.mode.record': 'Screen recorder',

    'explainer.action.newRecording': 'New recording',
    'explainer.action.exportVideo': 'Export video',
    'explainer.action.exporting': 'Exporting {p}%',

    'explainer.warn.unsupported': 'Your browser doesn’t support screen capture (getDisplayMedia / MediaRecorder). Try the latest Chrome, Edge, or Firefox on desktop.',

    'explainer.start.chip': 'Screen Studio-style effects',
    'explainer.start.heading': 'Record a tutorial that looks produced.',
    'explainer.start.body1': 'Capture any window or your whole screen. When you record ',
    'explainer.start.bodyTabBold': 'this browser tab',
    'explainer.start.body2': ', every click is tracked so the camera auto-zooms and follows your cursor — no editing required.',
    'explainer.start.feat1': 'Auto-zoom & pan on clicks',
    'explainer.start.feat2': 'Cursor spotlight + click ripples',
    'explainer.start.feat3': 'Gradient stage & rounded frame',
    'explainer.start.feat4': 'One-click video export',
    'explainer.start.micToggle': 'Also record my microphone (narration)',
    'explainer.start.startBtn': 'Start recording',
    'explainer.start.hintBefore': 'Tip: in the share dialog choose ',
    'explainer.start.hintBold': '“This Tab”',
    'explainer.start.hintAfter': ' for click-tracked auto-zoom.',

    'explainer.recording.label': 'Recording… interact with your app, then stop.',
    'explainer.recording.stopBtn': 'Stop & edit',

    'explainer.editor.rendering': 'Rendering effects into your video…',
    'explainer.editor.tabTracked': 'Tab tracked',
    'explainer.editor.screenCapture': 'Screen capture',
    'explainer.editor.clicksMeta': '{n} clicks · auto-zoom {state}',
    'explainer.editor.note': 'No click track was captured (you shared a window/screen rather than this tab). Framing, background and cursor effects still apply — record “This Tab” next time for automatic click-zoom.',

    'explainer.common.on': 'on',
    'explainer.common.off': 'off',

    'explainer.sec.format': 'Format',
    'explainer.sec.background': 'Background',
    'explainer.sec.frame': 'Frame',
    'explainer.sec.autoZoom': 'Auto-zoom',
    'explainer.sec.cursorSpotlight': 'Cursor spotlight',
    'explainer.sec.clickRipples': 'Click ripples',
    'explainer.sec.playback': 'Playback',

    'explainer.slider.padding': 'Padding',
    'explainer.slider.cornerRadius': 'Corner radius',
    'explainer.slider.shadow': 'Shadow',
    'explainer.slider.zoomLevel': 'Zoom level',
    'explainer.slider.holdTime': 'Hold time',
    'explainer.slider.speed': 'Speed',

    'explainer.aspect.landscape': 'Landscape',
    'explainer.aspect.vertical': 'Vertical',
    'explainer.aspect.square': 'Square',
    'explainer.aspect.original': 'Original',

    'explainer.bg.aurora': 'Aurora',
    'explainer.bg.mesh': 'Mesh',
    'explainer.bg.sunset': 'Sunset',
    'explainer.bg.slate': 'Slate',
    'explainer.bg.none': 'None',

    'explainer.toast.shareCancelled': 'Screen sharing was cancelled.',
    'explainer.toast.startFailed': 'Could not start the recording.',
    'explainer.toast.empty': 'The recording came back empty — try again.',
    'explainer.toast.exported': 'Explainer exported — check your downloads.',
    'explainer.toast.exportFailed': 'Export failed.',
  },
  de: {
    'explainer.page.eyebrow': 'Studio',
    'explainer.page.title': 'Explainer-Studio',
    'explainer.page.subtitle': 'Nimm deinen Bildschirm auf, zoome automatisch bei jedem Klick heran und exportiere ein poliertes Produkt-Tutorial — alles im Browser.',
    'explainer.page.subtitleMotion': 'SaaS-Explainer im After-Effects-Stil, komplett im Code generiert — Szenen bearbeiten, live in der Vorschau ansehen, als Video exportieren.',

    'explainer.mode.aria': 'Explainer-Modus',
    'explainer.mode.motion': 'Motion-Video',
    'explainer.mode.record': 'Bildschirmrekorder',

    'explainer.action.newRecording': 'Neue Aufnahme',
    'explainer.action.exportVideo': 'Video exportieren',
    'explainer.action.exporting': 'Exportiere {p}%',

    'explainer.warn.unsupported': 'Dein Browser unterstützt keine Bildschirmaufnahme (getDisplayMedia / MediaRecorder). Verwende die neueste Version von Chrome, Edge oder Firefox auf dem Desktop.',

    'explainer.start.chip': 'Effekte im Screen-Studio-Stil',
    'explainer.start.heading': 'Nimm ein Tutorial auf, das professionell produziert aussieht.',
    'explainer.start.body1': 'Nimm ein beliebiges Fenster oder deinen gesamten Bildschirm auf. Wenn du ',
    'explainer.start.bodyTabBold': 'diesen Browser-Tab',
    'explainer.start.body2': ' aufnimmst, wird jeder Klick verfolgt, sodass die Kamera automatisch heranzoomt und deinem Cursor folgt — ganz ohne Nachbearbeitung.',
    'explainer.start.feat1': 'Automatischer Zoom & Schwenk bei Klicks',
    'explainer.start.feat2': 'Cursor-Spotlight + Klick-Wellen',
    'explainer.start.feat3': 'Farbverlauf-Bühne & abgerundeter Rahmen',
    'explainer.start.feat4': 'Video-Export mit einem Klick',
    'explainer.start.micToggle': 'Auch mein Mikrofon aufnehmen (Kommentar)',
    'explainer.start.startBtn': 'Aufnahme starten',
    'explainer.start.hintBefore': 'Tipp: Wähle im Freigabedialog ',
    'explainer.start.hintBold': '„Dieser Tab“',
    'explainer.start.hintAfter': ' für klickbasierten Auto-Zoom.',

    'explainer.recording.label': 'Aufnahme läuft … interagiere mit deiner App und stoppe dann.',
    'explainer.recording.stopBtn': 'Stoppen & bearbeiten',

    'explainer.editor.rendering': 'Effekte werden in dein Video gerendert …',
    'explainer.editor.tabTracked': 'Tab verfolgt',
    'explainer.editor.screenCapture': 'Bildschirmaufnahme',
    'explainer.editor.clicksMeta': '{n} Klicks · Auto-Zoom {state}',
    'explainer.editor.note': 'Es wurde keine Klick-Spur erfasst (du hast ein Fenster/den Bildschirm statt diesen Tab geteilt). Rahmen-, Hintergrund- und Cursor-Effekte werden trotzdem angewendet — nimm nächstes Mal „Dieser Tab“ auf, um automatisches Klick-Zoom zu erhalten.',

    'explainer.common.on': 'ein',
    'explainer.common.off': 'aus',

    'explainer.sec.format': 'Format',
    'explainer.sec.background': 'Hintergrund',
    'explainer.sec.frame': 'Rahmen',
    'explainer.sec.autoZoom': 'Auto-Zoom',
    'explainer.sec.cursorSpotlight': 'Cursor-Spotlight',
    'explainer.sec.clickRipples': 'Klick-Wellen',
    'explainer.sec.playback': 'Wiedergabe',

    'explainer.slider.padding': 'Abstand',
    'explainer.slider.cornerRadius': 'Eckenradius',
    'explainer.slider.shadow': 'Schatten',
    'explainer.slider.zoomLevel': 'Zoomstufe',
    'explainer.slider.holdTime': 'Haltezeit',
    'explainer.slider.speed': 'Geschwindigkeit',

    'explainer.aspect.landscape': 'Querformat',
    'explainer.aspect.vertical': 'Hochformat',
    'explainer.aspect.square': 'Quadrat',
    'explainer.aspect.original': 'Original',

    'explainer.bg.aurora': 'Aurora',
    'explainer.bg.mesh': 'Mesh',
    'explainer.bg.sunset': 'Sonnenuntergang',
    'explainer.bg.slate': 'Schiefer',
    'explainer.bg.none': 'Keiner',

    'explainer.toast.shareCancelled': 'Die Bildschirmfreigabe wurde abgebrochen.',
    'explainer.toast.startFailed': 'Die Aufnahme konnte nicht gestartet werden.',
    'explainer.toast.empty': 'Die Aufnahme war leer — bitte erneut versuchen.',
    'explainer.toast.exported': 'Explainer exportiert — sieh in deinen Downloads nach.',
    'explainer.toast.exportFailed': 'Export fehlgeschlagen.',
  },
}
