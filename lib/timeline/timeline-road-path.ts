export interface RoadPoint {
  x: number;
  y: number;
}

function catmullRom(p0: RoadPoint, p1: RoadPoint, p2: RoadPoint, p3: RoadPoint, t: number): RoadPoint {
  const blend = (a: number, b: number, c: number, d: number) => 0.5 * (
    2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t
  );
  return { x: blend(p0.x, p1.x, p2.x, p3.x), y: blend(p0.y, p1.y, p2.y, p3.y) };
}

export function sampleTimelineRoad(points: RoadPoint[], centers: RoadPoint[]) {
  const first = points[0];
  const last = points[points.length - 1];
  const padded = [
    { x: 2 * first.x - points[1].x, y: 2 * first.y - points[1].y },
    ...points,
    { x: 2 * last.x - points[points.length - 2].x, y: 2 * last.y - points[points.length - 2].y },
  ];
  const dots: RoadPoint[] = [first];
  let previous = first;
  let travelled = 0;
  for (let index = 1; index < padded.length - 2; index++) {
    for (let step = 1; step <= 64; step++) {
      const point = catmullRom(padded[index - 1], padded[index], padded[index + 1], padded[index + 2], step / 64);
      travelled += Math.hypot(point.x - previous.x, point.y - previous.y);
      previous = point;
      if (travelled >= 20) {
        dots.push(point);
        travelled = 0;
      }
    }
  }
  return dots.filter((dot) => centers.every((center) => Math.hypot(dot.x - center.x, dot.y - center.y) > 40));
}
