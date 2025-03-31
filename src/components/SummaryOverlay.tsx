import React from "react";
import type { Location } from "../App";

interface SummaryOverlayProps {
  locations: Location[];
  totalDistance: number;
}

// Utility function to format distance (same as in ControlPanel)
const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) return `${(distanceKm * 1000).toFixed(0)} m`;
  if (distanceKm < 1000) return `${distanceKm.toFixed(1)} km`;
  return `${(distanceKm / 1000).toFixed(1)}k km`;
};

const SummaryOverlay: React.FC<SummaryOverlayProps> = ({
  locations,
  totalDistance,
}) => {
  const locationCount = locations.length;
  const formattedDistance = formatDistance(totalDistance);

  return (
    <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-black bg-opacity-60 pointer-events-none">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl text-center">
        <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-gray-100">
          Trip Summary
        </h2>
        <p className="text-lg mb-1 text-gray-700 dark:text-gray-300">
          Visited <span className="font-semibold">{locationCount}</span>{" "}
          locations.
        </p>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          Total distance:{" "}
          <span className="font-semibold">{formattedDistance}</span>.
        </p>
      </div>
    </div>
  );
};

export default SummaryOverlay;
