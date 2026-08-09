import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Modal, PanResponder, Platform, Pressable, StatusBar, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { spacing } from '../config/theme';
import { cropImage, imageSize } from '../services/mediaCompress';
import { MyazaText } from './Typography';
import { MyazaButton } from './MyazaButton';
import { Icon } from './Icon';
import { Image } from 'react-native';

// Interactive ID-card cropper — a 1:1 RN port of the Flutter SDK's
// _DocumentCropperScreen. Shown after picking a document photo from the gallery:
// a draggable, fixed-aspect (ISO ID-1) crop box over the image, with a dimmed
// surround, white border, rule-of-thirds grid and L-shaped corner brackets.
// Geometry, hit-testing and the confirm math all mirror the Flutter widget.

// ISO/IEC 7810 ID-1: 85.6 mm × 53.98 mm → AR ≈ 1.5858 (fixed, like Flutter).
const ID_AR = 85.6 / 53.98;
const HANDLE_RADIUS = 28; // touch radius for the corner handles
const ARM = 22; // corner-bracket arm length
const APPBAR_BG = '#1A1A2E';
// Keep the title clear of the status bar / notch on the full-screen cropper Modal.
const TOP_INSET = Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight ?? 24) + 8;

interface Rectangle {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Handle = 'none' | 'move' | 'tl' | 'tr' | 'bl' | 'br';

export interface DocumentCropperProps {
  uri: string;
  onCancel: () => void;
  onConfirm: (croppedUri: string) => void;
}

function computeImgRect(natW: number, natH: number, cw: number, ch: number): Rectangle {
  // object-contain rect of the image within the container.
  const natAR = natW / natH;
  const conAR = cw / ch;
  let rw: number;
  let rh: number;
  if (natAR > conAR) {
    rw = cw;
    rh = cw / natAR;
  } else {
    rh = ch;
    rw = ch * natAR;
  }
  return { x: (cw - rw) / 2, y: (ch - rh) / 2, w: rw, h: rh };
}

function initCropRect(img: Rectangle): Rectangle {
  // 85% of image width, centered, respecting the ID aspect; capped at 90% height.
  let w = img.w * 0.85;
  let h = w / ID_AR;
  if (h > img.h * 0.9) {
    h = img.h * 0.9;
    w = h * ID_AR;
  }
  return { x: img.x + (img.w - w) / 2, y: img.y + (img.h - h) / 2, w, h };
}

function clampCrop(crop: Rectangle, b: Rectangle): Rectangle {
  let w = Math.min(Math.max(crop.w, 60), b.w);
  let h = w / ID_AR;
  if (h > b.h) {
    h = b.h;
    w = h * ID_AR;
    if (w > b.w) {
      w = b.w;
      h = w / ID_AR;
    }
  }
  const maxLeft = Math.max(b.x, b.x + b.w - w);
  const maxTop = Math.max(b.y, b.y + b.h - h);
  return {
    x: Math.min(Math.max(crop.x, b.x), maxLeft),
    y: Math.min(Math.max(crop.y, b.y), maxTop),
    w,
    h,
  };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function DocumentCropper({ uri, onCancel, onConfirm }: DocumentCropperProps): React.ReactElement {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [container, setContainer] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Rectangle | null>(null);
  const [processing, setProcessing] = useState(false);

  // Pan state held in refs so the PanResponder callbacks stay stable.
  const handleRef = useRef<Handle>('none');
  const cropAtStart = useRef<Rectangle | null>(null);
  const cropRef = useRef<Rectangle | null>(null);
  cropRef.current = crop;

  useEffect(() => {
    let alive = true;
    imageSize(uri)
      .then(({ width, height }) => {
        if (alive) setNatural({ w: width, h: height });
      })
      .catch(() => {
        /* fall through — confirm is gated on `natural` */
      });
    return () => {
      alive = false;
    };
  }, [uri]);

  const imgRect = useMemo<Rectangle | null>(() => {
    if (!natural || !container) return null;
    return computeImgRect(natural.w, natural.h, container.w, container.h);
  }, [natural, container]);

  // Initialise the crop box once the image rect is known.
  useEffect(() => {
    if (imgRect && !crop) setCrop(initCropRect(imgRect));
  }, [imgRect, crop]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const c = cropRef.current;
          if (!c) return;
          const px = evt.nativeEvent.locationX;
          const py = evt.nativeEvent.locationY;
          let h: Handle = 'none';
          if (dist(px, py, c.x, c.y) < HANDLE_RADIUS) h = 'tl';
          else if (dist(px, py, c.x + c.w, c.y) < HANDLE_RADIUS) h = 'tr';
          else if (dist(px, py, c.x, c.y + c.h) < HANDLE_RADIUS) h = 'bl';
          else if (dist(px, py, c.x + c.w, c.y + c.h) < HANDLE_RADIUS) h = 'br';
          else if (px >= c.x - 8 && px <= c.x + c.w + 8 && py >= c.y - 8 && py <= c.y + c.h + 8) h = 'move';
          handleRef.current = h;
          cropAtStart.current = c;
        },
        onPanResponderMove: (_evt, g) => {
          const start = cropAtStart.current;
          const bounds = imgRect;
          const h = handleRef.current;
          if (!start || !bounds || h === 'none') return;
          const dx = g.dx;
          const dy = g.dy;
          const bottom = start.y + start.h;
          let next: Rectangle;
          switch (h) {
            case 'move':
              next = { x: start.x + dx, y: start.y + dy, w: start.w, h: start.h };
              break;
            case 'br': {
              const w = start.w + dx;
              next = { x: start.x, y: start.y, w, h: w / ID_AR };
              break;
            }
            case 'bl': {
              const w = start.w - dx;
              next = { x: start.x + dx, y: start.y, w, h: w / ID_AR };
              break;
            }
            case 'tr': {
              const w = start.w + dx;
              const hh = w / ID_AR;
              next = { x: start.x, y: bottom - hh, w, h: hh };
              break;
            }
            case 'tl': {
              const w = start.w - dx;
              const hh = w / ID_AR;
              next = { x: start.x + dx, y: bottom - hh, w, h: hh };
              break;
            }
            default:
              return;
          }
          setCrop(clampCrop(next, bounds));
        },
        onPanResponderRelease: () => {
          handleRef.current = 'none';
        },
        onPanResponderTerminate: () => {
          handleRef.current = 'none';
        },
      }),
    [imgRect],
  );

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainer((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
  };

  const confirm = async () => {
    if (!natural || !imgRect || !crop || processing) return;
    setProcessing(true);
    try {
      const scaleX = natural.w / imgRect.w;
      const scaleY = natural.h / imgRect.h;
      const originX = Math.min(Math.max((crop.x - imgRect.x) * scaleX, 0), natural.w - 1);
      const originY = Math.min(Math.max((crop.y - imgRect.y) * scaleY, 0), natural.h - 1);
      const width = Math.min(crop.w * scaleX, natural.w - originX);
      const height = Math.min(crop.h * scaleY, natural.h - originY);
      const out = await cropImage(uri, { originX, originY, width, height });
      onConfirm(out);
    } catch {
      setProcessing(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* App bar */}
        <View style={styles.appBar}>
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={8} style={{ padding: 4, marginRight: 4 }}>
            <Icon name="close" size={20} color="#FFFFFF" />
          </Pressable>
          <View>
            <MyazaText variant="bodyMedium" color="#FFFFFF" style={{ fontWeight: '600' }}>
              Crop to ID Card
            </MyazaText>
            <MyazaText variant="bodySmall" color="rgba(255,255,255,0.6)">
              Drag to reposition · handles to resize
            </MyazaText>
          </View>
        </View>

        {/* Image + crop overlay */}
        <View style={{ flex: 1 }} onLayout={onContainerLayout}>
          {!natural ? (
            <View style={StyleSheet.absoluteFill}>
              <ActivityIndicator color="#FFFFFF" style={{ flex: 1 }} />
            </View>
          ) : (
            <>
              <Image source={{ uri }} resizeMode="contain" style={StyleSheet.absoluteFill} />
              {container && crop ? (
                <Svg style={StyleSheet.absoluteFill} width={container.w} height={container.h}>
                  {/* Dim surround (4 rects) */}
                  <Rect x={0} y={0} width={container.w} height={crop.y} fill="rgba(0,0,0,0.6)" />
                  <Rect x={0} y={crop.y + crop.h} width={container.w} height={Math.max(0, container.h - crop.y - crop.h)} fill="rgba(0,0,0,0.6)" />
                  <Rect x={0} y={crop.y} width={crop.x} height={crop.h} fill="rgba(0,0,0,0.6)" />
                  <Rect x={crop.x + crop.w} y={crop.y} width={Math.max(0, container.w - crop.x - crop.w)} height={crop.h} fill="rgba(0,0,0,0.6)" />

                  {/* White border */}
                  <Rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="#FFFFFF" strokeWidth={2} />

                  {/* Rule-of-thirds grid */}
                  <Line x1={crop.x + crop.w / 3} y1={crop.y} x2={crop.x + crop.w / 3} y2={crop.y + crop.h} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                  <Line x1={crop.x + (crop.w * 2) / 3} y1={crop.y} x2={crop.x + (crop.w * 2) / 3} y2={crop.y + crop.h} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                  <Line x1={crop.x} y1={crop.y + crop.h / 3} x2={crop.x + crop.w} y2={crop.y + crop.h / 3} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                  <Line x1={crop.x} y1={crop.y + (crop.h * 2) / 3} x2={crop.x + crop.w} y2={crop.y + (crop.h * 2) / 3} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />

                  {/* L-shaped corner brackets */}
                  {cornerLines(crop).map((l, i) => (
                    <Line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" />
                  ))}
                </Svg>
              ) : null}
              {/* Gesture layer on top */}
              <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
            </>
          )}
        </View>

        {/* Action bar */}
        <View style={styles.actionBar}>
          {processing ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48 }}>
              <ActivityIndicator color="#FFFFFF" />
              <View style={{ width: 10 }} />
              <MyazaText variant="bodyMedium" color="rgba(255,255,255,0.8)" style={{ flexShrink: 1 }}>
                Processing…
              </MyazaText>
            </View>
          ) : (
            <MyazaButton label="Crop & Use" leadingIcon="check" onPress={confirm} disabled={!crop} />
          )}
        </View>
      </View>
    </Modal>
  );
}

function cornerLines(c: Rectangle): Array<[number, number, number, number]> {
  const r = c.x + c.w;
  const b = c.y + c.h;
  return [
    [c.x, c.y, c.x + ARM, c.y],
    [c.x, c.y, c.x, c.y + ARM],
    [r, c.y, r - ARM, c.y],
    [r, c.y, r, c.y + ARM],
    [c.x, b, c.x + ARM, b],
    [c.x, b, c.x, b - ARM],
    [r, b, r - ARM, b],
    [r, b, r, b - ARM],
  ];
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: APPBAR_BG,
    paddingTop: TOP_INSET,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  actionBar: {
    backgroundColor: APPBAR_BG,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
});
