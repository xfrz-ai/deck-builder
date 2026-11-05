import type { Quad } from "@/lib/mockup/perspective-warp";

const MOCKUP_DIR = "/assets/mockup";

export interface MockupDevice {
  id: string;
  name: string;
  frameSrc: string;
  width: number;
  height: number;
  screen: {
    // Width / height of the real display; screenshots are cropped to it.
    aspectRatio: number;
    // Screen-shaped alpha mask (notch, rounded corners) placed in the frame.
    maskSrc: string;
    maskX: number;
    maskY: number;
    // Screen corners in frame pixels, fitted to the mask's straight edges.
    corners: Quad;
  };
}

const IPHONE_12_PRO_ASPECT_RATIO = 1170 / 2532;

export const IPHONE_12_PRO_LEFT: MockupDevice = {
  id: "iphone-12-pro-left",
  name: "iPhone 12 Pro · Left",
  frameSrc: `${MOCKUP_DIR}/iPhone%2012%20Pro%20-%20left.png`,
  width: 525,
  height: 790,
  screen: {
    aspectRatio: IPHONE_12_PRO_ASPECT_RATIO,
    maskSrc: `${MOCKUP_DIR}/Screen%20iPhone%2012%20Pro%20-%20left.png`,
    maskX: 55,
    maskY: 23,
    corners: [
      [54, 87.3],
      [315.7, 47.4],
      [482.3, 669.2],
      [235.7, 765.4],
    ],
  },
};

export const IPHONE_12_PRO_RIGHT: MockupDevice = {
  id: "iphone-12-pro-right",
  name: "iPhone 12 Pro · Right",
  frameSrc: `${MOCKUP_DIR}/iPhone%2012%20Pro%20-%20right.png`,
  width: 488,
  height: 733,
  screen: {
    aspectRatio: IPHONE_12_PRO_ASPECT_RATIO,
    maskSrc: `${MOCKUP_DIR}/Screen%20iPhone%2012%20Pro%20-%20right.png`,
    maskX: 23,
    maskY: 23,
    corners: [
      [184.1, 34.8],
      [455.8, 93.1],
      [290.6, 709.8],
      [26.1, 624.5],
    ],
  },
};

export const MOCKUP_DEVICES: readonly MockupDevice[] = [
  IPHONE_12_PRO_LEFT,
  IPHONE_12_PRO_RIGHT,
];

export function getMockupDevice(deviceId: string) {
  return MOCKUP_DEVICES.find((device) => device.id === deviceId);
}
