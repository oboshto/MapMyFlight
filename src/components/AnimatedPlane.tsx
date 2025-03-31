import React, { useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { Location } from "../App"; // Import from App

interface AnimatedPlaneProps {
  locations: Location[];
  startAnimation: boolean;
  // Optional callback for when animation finishes
  onAnimationEnd?: () => void;
  onDistanceUpdate?: (distanceIncrement: number) => void; // Add distance update callback
}

// Helper function for linear interpolation
const interpolateLatLng = (
  start: L.LatLng,
  end: L.LatLng,
  t: number
): L.LatLng => {
  const lat = start.lat + (end.lat - start.lat) * t;
  const lng = start.lng + (end.lng - start.lng) * t;
  return L.latLng(lat, lng);
};

// Helper function to calculate bearing (angle)
const calculateBearing = (start: L.LatLng, end: L.LatLng): number => {
  const startLat = (start.lat * Math.PI) / 180;
  const startLng = (start.lng * Math.PI) / 180;
  const endLat = (end.lat * Math.PI) / 180;
  const endLng = (end.lng * Math.PI) / 180;

  const dLng = endLng - startLng;
  const y = Math.sin(dLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let brng = Math.atan2(y, x);
  brng = (brng * 180) / Math.PI;
  return (brng + 360) % 360; // Normalize to 0-360
};

// Helper to update icon rotation using Emoji
const createRotatedIcon = (rotation: number): L.DivIcon => {
  // Apply offset
  const baseCssRotation = rotation - 90;
  // Adjust further: current +5, needs +10 more = +15 total adjustment
  const adjustedCssRotation = baseCssRotation + 40;
  const emoji = "✈️";

  return L.divIcon({
    html: `<div style="font-size: 24px; transform: rotate(${adjustedCssRotation}deg);">${emoji}</div>`,
    className: "bg-transparent border-none", // Important to remove Leaflet default styles
    iconSize: [28, 28], // Adjust size slightly for emoji
    iconAnchor: [14, 14], // Center the emoji
  });
};

const AnimatedPlane: React.FC<AnimatedPlaneProps> = ({
  locations,
  startAnimation,
  onAnimationEnd,
  onDistanceUpdate, // Receive callback
}) => {
  const map = useMap();
  const planeMarkerRef = useRef<L.Marker | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const currentSegmentIndexRef = useRef<number>(0);
  const segmentStartTimeRef = useRef<number | null>(null);
  const lastPositionRef = useRef<L.LatLng | null>(null); // Store last position to calculate increment
  const cumulativeDistanceRef = useRef<number>(0); // Store cumulative distance for tooltip

  // Configurable animation speed (e.g., units per second - adjust based on map scale)
  // Or duration per segment
  const DURATION_PER_SEGMENT_MS = 5000; // 5 seconds per segment

  // Use the same format function (or import if moved to utils)
  const formatDistance = (distanceKm: number): string => {
    if (distanceKm < 1) return `${(distanceKm * 1000).toFixed(0)} m`;
    if (distanceKm < 1000) return `${distanceKm.toFixed(1)} km`;
    return `${(distanceKm / 1000).toFixed(1)}k km`;
  };

  // Animation loop function
  const animateStep = useCallback(() => {
    if (!planeMarkerRef.current || locations.length < 2) {
      console.log("Stopping animation: No marker or not enough locations");
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      return;
    }

    const currentIndex = currentSegmentIndexRef.current;
    if (currentIndex >= locations.length - 1) {
      console.log("Stopping animation: Reached end of path");
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      segmentStartTimeRef.current = null;
      lastPositionRef.current = null; // Reset last position
      onAnimationEnd?.(); // Notify parent component animation ended
      // Keep tooltip showing final distance
      if (planeMarkerRef.current) {
        planeMarkerRef.current.setTooltipContent(
          formatDistance(cumulativeDistanceRef.current / 1000)
        );
      }
      return; // End of path
    }

    const segmentStartLocation = locations[currentIndex];
    const segmentEndLocation = locations[currentIndex + 1];
    const segmentStartLatLng = L.latLng(
      segmentStartLocation.lat,
      segmentStartLocation.lng
    );
    const segmentEndLatLng = L.latLng(
      segmentEndLocation.lat,
      segmentEndLocation.lng
    );

    // Fit bounds at the beginning of each segment
    if (segmentStartTimeRef.current === null) {
      segmentStartTimeRef.current = performance.now();
      lastPositionRef.current = segmentStartLatLng;

      // Fit map view to the current segment
      const bounds = L.latLngBounds([segmentStartLatLng, segmentEndLatLng]);
      map.fitBounds(bounds, {
        animate: true,
        padding: [60, 60], // Add padding around the bounds
      });
    }

    const elapsedTime = performance.now() - segmentStartTimeRef.current;
    let progress = elapsedTime / DURATION_PER_SEGMENT_MS;
    progress = Math.min(progress, 1); // Clamp progress to max 1

    // Interpolate position
    const currentPosition = interpolateLatLng(
      segmentStartLatLng,
      segmentEndLatLng,
      progress
    );
    planeMarkerRef.current.setLatLng(currentPosition);

    // Calculate distance increment and update state & tooltip
    let distanceIncrement = 0;
    if (lastPositionRef.current) {
      distanceIncrement = lastPositionRef.current.distanceTo(currentPosition);
      if (distanceIncrement > 0) {
        cumulativeDistanceRef.current += distanceIncrement; // Update cumulative distance in meters
        onDistanceUpdate?.(distanceIncrement); // Call App's update function
        // Update tooltip content
        planeMarkerRef.current.setTooltipContent(
          formatDistance(cumulativeDistanceRef.current / 1000)
        );
      }
    }
    lastPositionRef.current = currentPosition; // Update last position for next frame

    // Calculate rotation/bearing for the current segment
    const bearing = calculateBearing(segmentStartLatLng, segmentEndLatLng);
    // Create a new icon with rotation and set it (Leaflet requires setting the whole icon)
    planeMarkerRef.current.setIcon(createRotatedIcon(bearing));

    // Check if segment is completed
    if (progress >= 1) {
      currentSegmentIndexRef.current += 1; // Move to next segment
      segmentStartTimeRef.current = null; // Reset start time for next segment
      // lastPositionRef will be reset at the start of the next segment
    }

    // Request next frame
    animationFrameIdRef.current = requestAnimationFrame(animateStep);
  }, [locations, map, onAnimationEnd, onDistanceUpdate]);

  // Effect to control animation start/stop
  useEffect(() => {
    const originalMapState = {
      dragging: map.dragging.enabled(),
      touchZoom: map.touchZoom.enabled(),
      doubleClickZoom: map.doubleClickZoom.enabled(),
      scrollWheelZoom: map.scrollWheelZoom.enabled(),
      boxZoom: map.boxZoom.enabled(),
      keyboard: map.keyboard.enabled(),
    };

    const cleanup = () => {
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      if (planeMarkerRef.current) {
        try {
          map.removeLayer(planeMarkerRef.current);
        } catch (error) {
          /* Ignore */
        }
        planeMarkerRef.current = null;
      }
      currentSegmentIndexRef.current = 0;
      segmentStartTimeRef.current = null;
      lastPositionRef.current = null;
      cumulativeDistanceRef.current = 0;

      // Re-enable map interactions
      if (originalMapState.dragging) map.dragging.enable();
      if (originalMapState.touchZoom) map.touchZoom.enable();
      if (originalMapState.doubleClickZoom) map.doubleClickZoom.enable();
      if (originalMapState.scrollWheelZoom) map.scrollWheelZoom.enable();
      if (originalMapState.boxZoom) map.boxZoom.enable();
      if (originalMapState.keyboard) map.keyboard.enable();
    };

    if (startAnimation && locations.length >= 2) {
      cleanup(); // Run cleanup first to ensure state is clean

      // Disable map interactions
      map.dragging.disable();
      map.touchZoom.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();

      // Create the marker at the starting position
      const startLatLng = L.latLng(locations[0].lat, locations[0].lng);
      const nextLatLng = L.latLng(locations[1].lat, locations[1].lng);
      const initialBearing = calculateBearing(startLatLng, nextLatLng);
      cumulativeDistanceRef.current = 0; // Reset before starting

      planeMarkerRef.current = L.marker(startLatLng, {
        icon: createRotatedIcon(initialBearing),
      })
        // Bind tooltip *after* creating the marker
        .bindTooltip(formatDistance(0), {
          permanent: true,
          direction: "top",
          offset: [0, -15],
          className: "plane-tooltip",
        })
        .addTo(map);

      // Fit bounds for the very first segment immediately
      const initialBounds = L.latLngBounds([startLatLng, nextLatLng]);
      map.fitBounds(initialBounds, { animate: true, padding: [60, 60] });

      // Start the animation loop
      currentSegmentIndexRef.current = 0;
      segmentStartTimeRef.current = null; // Will be set on first frame
      lastPositionRef.current = startLatLng; // Set initial last position
      animationFrameIdRef.current = requestAnimationFrame(animateStep);
      console.log("Starting manual animation");
    } else {
      // If not starting animation, ensure interactions are enabled (in case they were disabled before)
      cleanup();
    }

    // Return the cleanup function
    return cleanup;
  }, [locations, startAnimation, map, animateStep]); // Keep dependencies

  return null; // Component doesn't render directly
};

export default AnimatedPlane;
