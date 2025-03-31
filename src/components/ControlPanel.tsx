import React, { useState, useCallback } from "react";
import { FaTrash } from "react-icons/fa";
import type { Location } from "../App"; // Add type keyword

// Simple debounce function
function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

// Utility function to format distance
const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${(distanceKm * 1000).toFixed(0)} m`; // Show meters if less than 1 km
  }
  if (distanceKm < 1000) {
    return `${distanceKm.toFixed(1)} km`; // Show 1 decimal for < 1000 km
  }
  return `${(distanceKm / 1000).toFixed(1)}k km`; // Show 'k' for thousands
};

// Define props for ControlPanel
interface ControlPanelProps {
  locations: Location[];
  onAddLocation: (location: Location) => void;
  onRemoveLocation: (id: string) => void;
  onStartAnimation: () => void; // Add prop for starting animation
  onStopAnimation: () => void; // Add stop handler prop
  onStartRecording: () => void; // Add recording handler prop
  isAnimating: boolean; // Add prop to know animation status
  isRecording: boolean; // Add recording status prop
  totalDistance: number; // Add total distance prop
  traveledDistance: number; // Add traveled distance prop
  recordedVideoUrl: string | null; // Add video URL prop
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  locations,
  onAddLocation,
  onRemoveLocation,
  onStartAnimation, // Receive the function
  onStopAnimation, // Receive stop handler
  onStartRecording, // Receive handler
  isAnimating, // Receive the status
  isRecording, // Receive status
  totalDistance, // Receive distances
  traveledDistance,
  recordedVideoUrl, // Receive URL
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Location[]>([]); // To show search results
  const [error, setError] = useState<string | null>(null); // To show search errors
  const [isTyping, setIsTyping] = useState(false); // Track if user is typing for visual feedback

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (!term.trim()) {
        setSearchResults([]);
        setError(null);
        setIsSearching(false);
        setIsTyping(false);
        return;
      }

      setIsSearching(true);
      setError(null);
      setSearchResults([]);
      console.log(`Searching for: ${term}`);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            term
          )}&format=json&limit=5&addressdetails=1`
        );
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        if (data && data.length > 0) {
          const results: Location[] = data.map((item: any) => ({
            id: item.place_id.toString(),
            name: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            countryCode: item.address?.country_code?.toUpperCase() ?? "XX",
          }));
          setSearchResults(results);
        } else {
          setError("No locations found.");
        }
      } catch (err) {
        console.error("Search error:", err);
        setError("Failed to fetch locations.");
      } finally {
        setIsSearching(false);
        setIsTyping(false);
      }
    }, 500), // 500ms debounce delay
    [] // Empty dependency array for useCallback
  );

  // Handle input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newTerm = event.target.value;
    setSearchTerm(newTerm);
    setIsTyping(true); // Indicate typing
    setSearchResults([]); // Clear results immediately while typing
    setError(null);
    debouncedSearch(newTerm); // Call debounced search
  };

  // Function to handle adding a selected location from search results
  const selectLocation = (location: Location) => {
    // Check if location already added to prevent duplicates
    if (!locations.some((loc) => loc.id === location.id)) {
      onAddLocation(location);
    }
    setSearchTerm(""); // Clear search input
    setSearchResults([]); // Clear search results
    setError(null);
    setIsTyping(false);
  };

  // Handler for the main button (Start/Stop)
  const handleToggleAnimation = () => {
    if (isAnimating) {
      onStopAnimation(); // Call the received stop handler
    } else {
      onStartAnimation();
    }
  };

  return (
    // Main flex container for the panel
    <div className="flex flex-col h-full">
      {/* Top Section (Title + Search) - Fixed Height */}
      <div className="flex-shrink-0">
        <h2 className="text-xl font-semibold mb-4">Plan Your Trip</h2>
        {/* Search Input */}
        <div className="relative mb-1">
          <div className="flex items-center border rounded dark:border-gray-600 focus-within:ring-2 focus-within:ring-blue-500">
            <input
              type="text"
              placeholder="Search & add a city..."
              value={searchTerm}
              onChange={handleInputChange} // Use new handler
              className="flex-grow p-2 focus:outline-none dark:bg-gray-700 rounded-l"
              disabled={isAnimating} // Keep disabled while animating
            />
            {/* Optional: Show loading indicator directly in input area */}
            {(isSearching || isTyping) && (
              <div className="p-2">
                <div
                  className={`w-4 h-4 border-2 border-gray-400 ${
                    isSearching ? "border-t-transparent animate-spin" : ""
                  } rounded-full`}
                ></div>
              </div>
            )}
          </div>
          {/* Search Results Dropdown or Error Message */}
          {(searchResults.length > 0 || error) && !isTyping && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
              {error ? (
                <p className="p-2 text-red-500">{error}</p>
              ) : (
                <ul>
                  {searchResults.map((result) => (
                    <li
                      key={result.id}
                      onClick={() => selectLocation(result)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer border-b dark:border-gray-600 last:border-b-0"
                    >
                      {result.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Middle Section (Locations List) - Flexible Height with Scroll */}
      <div className="flex-shrink-0 mt-3 mb-4 border rounded dark:border-gray-700 p-2 min-h-0">
        <h3 className="text-lg font-medium mb-2 bg-white dark:bg-gray-800 py-1">
          Selected Locations ({locations.length})
        </h3>
        {locations.length === 0 ? (
          <p className="text-gray-500 italic">
            Add locations using the search above.
          </p>
        ) : (
          <ul>
            {locations.map((loc, index) => (
              <li
                key={loc.id}
                className="flex justify-between items-center p-2 border-b dark:border-gray-600"
              >
                <span className="flex-1 mr-2 truncate" title={loc.name}>
                  {index + 1}. {loc.name}
                </span>
                <button
                  onClick={() => onRemoveLocation(loc.id)} // Use prop function
                  className="text-red-500 hover:text-red-700 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isAnimating} // Disable removal while animating
                >
                  <FaTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bottom Section (Distance + Buttons) - Fixed Height */}
      <div className="flex-shrink-0">
        {/* Distance Display */}
        <div className="my-4 p-3 border rounded dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <h3 className="text-lg font-medium mb-2">Trip Distance</h3>
          {locations.length >= 2 ? (
            <div>
              <p>Total Path: {formatDistance(totalDistance)}</p>
              <p>
                Traveled:{" "}
                {isAnimating || traveledDistance > 0
                  ? formatDistance(traveledDistance)
                  : "-"}
              </p>
              {/* Progress Bar */}
              {isAnimating && totalDistance > 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-width ease-linear"
                    style={{
                      width: `${Math.min(
                        (traveledDistance / totalDistance) * 100,
                        100
                      )}%`,
                    }}
                  ></div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">
              Add at least two locations to calculate distance.
            </p>
          )}
        </div>

        {/* Action Buttons Container */}
        <div className="space-y-2 pt-2 border-t dark:border-gray-700">
          {/* Start/Stop Animation Button */}
          <button
            onClick={handleToggleAnimation}
            disabled={(locations.length < 2 && !isAnimating) || isRecording}
            className={`w-full p-3 text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ${
              isAnimating ? "bg-red-500" : "bg-green-500"
            }`}
          >
            {isAnimating ? "Stop Animation" : "View Path"}
          </button>

          {/* Record Video Button */}
          <button
            onClick={onStartRecording}
            disabled={isAnimating || isRecording || locations.length < 2}
            className="w-full p-3 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRecording ? "Recording..." : "Record Video"}
          </button>

          {/* Download Link */}
          {recordedVideoUrl && (
            <div className="text-center">
              <a
                href={recordedVideoUrl}
                download={`map-my-flight-${new Date().toISOString()}.webm`} // Update filename prefix
                className="inline-block mt-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Download Recorded Video
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
