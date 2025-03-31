import React, { useEffect, RefObject } from "react";
import { MapContainer, Marker, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet.tilelayer.fallback"; // Import the plugin

// Add basic type declaration for the fallback plugin
declare module "leaflet" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace tileLayer {
    function fallback(
      urlTemplate: string,
      options?: TileLayerOptions
    ): TileLayer;
  }
}

import type { Location } from "../App"; // Add type keyword
import { FaPlane } from "react-icons/fa";
import ReactDOMServer from "react-dom/server";
import AnimatedPlane from "./AnimatedPlane"; // Import the plane component
import { createCityMarkerIcon } from "./CityMarkerIcon"; // Import new icon creator

// Fix for default marker icon issue with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});

// Create a custom airplane icon using react-icons
export const planeIcon = L.divIcon({
  // Render the react icon component to an HTML string
  html: ReactDOMServer.renderToString(
    // Added a wrapper div to potentially help with rotation later
    <div id="plane-icon-wrapper">
      <FaPlane className="text-blue-600 text-2xl" />
    </div>
  ),
  className: "bg-transparent border-none", // Remove default Leaflet icon styles
  iconSize: [24, 24], // Size of the icon
  iconAnchor: [12, 12], // Point of the icon which will correspond to marker's location (center)
});

// Define props for MapComponent
interface MapComponentProps {
  locations: Location[];
  isAnimating: boolean;
  onAnimationEnd: () => void;
  onDistanceUpdate: (distanceIncrement: number) => void; // Add distance update callback
  mapRef: RefObject<L.Map | null>; // Add mapRef prop
}

// Component to automatically adjust map view based on markers
const MapBoundsUpdater: React.FC<{ locations: Location[] }> = ({
  locations,
}) => {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) {
      // Reset view if no locations
      map.setView([54.526, 15.2551], 4); // Initial view
      return;
    }

    // Fit bounds only if there's more than one location, otherwise just center on the single point
    if (locations.length > 1) {
      const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] }); // Add padding
      }
    } else if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 10); // Zoom in on single location
    }
  }, [locations, map]);

  return null; // This component does not render anything
};

const MapComponent: React.FC<MapComponentProps> = ({
  locations,
  isAnimating,
  onAnimationEnd,
  onDistanceUpdate, // Receive distance update callback
  mapRef, // Receive mapRef
}) => {
  // Initial map position (will be updated by MapBoundsUpdater)
  const initialPosition: L.LatLngExpression = [54.526, 15.2551];

  // Extract positions for the Polyline
  const pathPositions: L.LatLngExpression[] = locations.map((loc) => [
    loc.lat,
    loc.lng,
  ]);

  // Define path style options - Updated for dashed gray line
  const pathOptions = {
    color: "#6b7280", // gray-500
    weight: 2,
    dashArray: "5, 10", // Defines the pattern of dashes and gaps
    opacity: 0.7,
  };

  return (
    <MapContainer
      center={initialPosition}
      zoom={4}
      scrollWheelZoom={true}
      style={{ height: "100%", width: "100%" }}
      ref={mapRef}
      attributionControl={false} // Disable Leaflet attribution control
    >
      {/* Use TileLayer.Fallback instead of TileLayer from react-leaflet */}
      {/* We need to manage this layer manually or create a wrapper */}
      {/* Let's create a simple wrapper component */}

      <TileLayerFallback />

      {/* Render city markers with custom icons */}
      {locations.map((location) => (
        <Marker
          key={location.id}
          position={[location.lat, location.lng]}
          icon={createCityMarkerIcon(location)} // Use the custom icon
        >
          {/* Optional: Keep Popup or remove if icon is enough */}
          {/* <Popup>{location.name}</Popup> */}
        </Marker>
      ))}

      {/* Render Polyline if there are at least 2 locations */}
      {pathPositions.length >= 2 && (
        <Polyline pathOptions={pathOptions} positions={pathPositions} />
      )}

      {/* Render AnimatedPlane and pass locations, animation status, and callback */}
      <AnimatedPlane
        locations={locations}
        startAnimation={isAnimating}
        onAnimationEnd={onAnimationEnd}
        onDistanceUpdate={onDistanceUpdate} // Pass callback down
      />

      {/* Add the component to update map bounds */}
      <MapBoundsUpdater locations={locations} />
    </MapContainer>
  );
};

// Wrapper component for TileLayer.Fallback
const TileLayerFallback: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    // @ts-ignore - L.tileLayer.fallback might not be recognized by TS
    const tileLayer = L.tileLayer
      .fallback("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        // Optional: Add fallback options if needed
        // errorTileUrl: 'path/to/error/tile.png',
      })
      .addTo(map);

    // Cleanup function to remove the layer when component unmounts
    return () => {
      map.removeLayer(tileLayer);
    };
  }, [map]); // Dependency on map instance

  return null; // This component doesn't render anything itself
};

export default MapComponent;
