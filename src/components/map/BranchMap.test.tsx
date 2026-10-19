// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * BranchMap against a recording Leaflet: jsdom has no layout, so what is
 * pinned here is what the component ASKS Leaflet for. The point-mode callers
 * (BranchForm, BranchesMap) must see exactly what they saw before the area
 * mode (IP activity, 2026-10-07) existed.
 */

const leaf = vi.hoisted(() => {
  const state = {
    mapOptions: [] as unknown[],
    views: [] as Array<{ center: [number, number]; zoom: number }>,
    circles: [] as Array<{ center: [number, number]; options: Record<string, unknown>; removed: boolean }>,
    fits: [] as Array<{ bounds: unknown; options: Record<string, unknown> }>,
    markers: [] as Array<[number, number]>,
    invalidations: 0,
    removed: 0,
  };
  const layerGroup = () => ({ addTo: () => layerGroup(), clearLayers: () => {} });
  const L = {
    map: (_el: unknown, options?: unknown) => {
      state.mapOptions.push(options);
      const map = {
        setView: (center: [number, number], zoom: number) => { state.views.push({ center, zoom }); return map; },
        on: () => map,
        remove: () => { state.removed += 1; },
        invalidateSize: () => { state.invalidations += 1; return map; },
        fitBounds: (bounds: unknown, options: Record<string, unknown>) => { state.fits.push({ bounds, options }); return map; },
      };
      return map;
    },
    tileLayer: () => ({ addTo: () => ({}) }),
    layerGroup,
    divIcon: () => ({}),
    marker: (latlng: [number, number]) => {
      state.markers.push(latlng);
      const m = { addTo: () => m, bindPopup: () => m };
      return m;
    },
    circle: (center: [number, number], options: Record<string, unknown>) => {
      const rec = { center, options, removed: false };
      state.circles.push(rec);
      const c = {
        addTo: () => c,
        remove: () => { rec.removed = true; return c; },
        getBounds: () => ({ around: center, radius: options.radius }),
      };
      return c;
    },
  };
  return { state, L };
});
vi.mock("leaflet", () => ({ default: leaf.L }));
vi.mock("leaflet/dist/leaflet.css", () => ({}));

import BranchMap, { AREA_MAX_ZOOM } from "./BranchMap";

beforeEach(() => {
  Object.assign(leaf.state, { mapOptions: [], views: [], circles: [], fits: [], markers: [], invalidations: 0, removed: 0 });
});
afterEach(() => cleanup());

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe("BranchMap", () => {
  test("point mode (BranchForm / BranchesMap) is unchanged: no zoom cap, no circle, its pins", () => {
    render(<BranchMap markers={[{ lat: 40.1, lng: 44.5, label: "Club" }]} center={{ lat: 40.1, lng: 44.5 }} zoom={15} />);
    expect(leaf.state.mapOptions).toEqual([undefined]);
    expect(leaf.state.views).toEqual([{ center: [40.1, 44.5], zoom: 15 }]);
    expect(leaf.state.markers).toEqual([[40.1, 44.5]]);
    expect(leaf.state.circles).toHaveLength(0);
    expect(leaf.state.fits).toHaveLength(0);
  });

  test("area mode draws the accuracy circle in METRES and frames it, never past the zoom cap", () => {
    render(<BranchMap markers={[]} center={{ lat: 51.5, lng: -0.09 }} zoom={15} accuracyRadiusKm={10} />);
    expect(leaf.state.mapOptions).toEqual([{ maxZoom: AREA_MAX_ZOOM }]);
    expect(leaf.state.views[0].zoom).toBe(AREA_MAX_ZOOM);
    expect(leaf.state.markers).toHaveLength(0);

    expect(leaf.state.circles).toHaveLength(1);
    expect(leaf.state.circles[0].center).toEqual([51.5, -0.09]);
    expect(leaf.state.circles[0].options).toMatchObject({ radius: 10_000, className: "cp-map-area", interactive: false });

    expect(leaf.state.fits).toHaveLength(1);
    expect(leaf.state.fits[0].bounds).toEqual({ around: [51.5, -0.09], radius: 10_000 });
    expect(leaf.state.fits[0].options.maxZoom).toBe(AREA_MAX_ZOOM);
  });

  test("the cap keeps an approximate place off street level", () => {
    expect(AREA_MAX_ZOOM).toBeLessThanOrEqual(12);
  });

  test("area mode without a radius: capped view, no circle", () => {
    render(<BranchMap markers={[]} center={{ lat: 51.5, lng: -0.09 }} zoom={9} accuracyRadiusKm={null} />);
    expect(leaf.state.mapOptions).toEqual([{ maxZoom: AREA_MAX_ZOOM }]);
    expect(leaf.state.views[0].zoom).toBe(9);
    expect(leaf.state.circles).toHaveLength(0);
  });

  test("a new radius replaces the circle instead of stacking a second one", () => {
    const { rerender } = render(<BranchMap markers={[]} center={{ lat: 1, lng: 2 }} accuracyRadiusKm={10} />);
    rerender(<BranchMap markers={[]} center={{ lat: 1, lng: 2 }} accuracyRadiusKm={50} />);
    expect(leaf.state.circles.map((c) => [c.options.radius, c.removed])).toEqual([[10_000, true], [50_000, false]]);
  });

  test("re-measures after the first paint (a dialog that was still settling) and re-frames the circle", async () => {
    render(<BranchMap markers={[]} center={{ lat: 1, lng: 2 }} accuracyRadiusKm={20} />);
    const fitsBefore = leaf.state.fits.length;
    await nextFrame();
    expect(leaf.state.invalidations).toBeGreaterThanOrEqual(1);
    expect(leaf.state.fits.length).toBeGreaterThan(fitsBefore);
  });

  test("unmount removes the map", () => {
    const { unmount } = render(<BranchMap markers={[]} />);
    unmount();
    expect(leaf.state.removed).toBe(1);
  });
});
