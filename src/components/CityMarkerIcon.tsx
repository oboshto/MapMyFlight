import L from "leaflet";
import ReactDOMServer from "react-dom/server";
import type { Location } from "../App"; // Import Location type

// Function to convert country code to flag emoji (basic)
// Needs more robust mapping for all country codes if needed
const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return "🏴"; // Default flag
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch (error) {
    console.error(`Failed to create flag for ${countryCode}`, error);
    return "🏴"; // Default flag on error
  }
};

// Helper to create the styled DivIcon for a city marker
export const createCityMarkerIcon = (location: Location): L.DivIcon => {
  const flag = getFlagEmoji(location.countryCode);
  const cityName = location.name.split(",")[0].trim();

  // Approximate height for vertical anchor
  // Might need adjustment based on actual rendered height of the bubble
  const approxBubbleHeight = 28; // From text size, padding etc.
  const tailHeight = 6;
  const iconTotalHeight = approxBubbleHeight + tailHeight;

  return L.divIcon({
    html: ReactDOMServer.renderToString(
      // Wrapper for CSS centering via transform
      <div style={{ transform: "translateX(-50%)", width: "fit-content" }}>
        <div className="city-marker-container relative flex flex-col items-center">
          {/* Main content bubble */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white px-2.5 py-1 rounded-lg shadow-md flex items-center space-x-1.5">
            <span style={{ fontSize: "1em" }}>{flag}</span>
            <span className="text-xs font-medium whitespace-nowrap">
              {cityName}
            </span>
          </div>
          {/* Tail pointing down */}
          <div className="absolute -bottom-1.5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-blue-600 dark:border-t-blue-700"></div>
        </div>
      </div>
    ),
    className: "bg-transparent border-none",
    // Anchor: Horizontal 0 (corrected by CSS transform), Vertical at the tip of the tail
    iconAnchor: [0, iconTotalHeight],
    iconSize: undefined, // Let browser determine size
  });
};
