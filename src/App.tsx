import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import L from "leaflet";
import MapComponent from "./components/MapComponent";
import ControlPanel from "./components/ControlPanel";
import SummaryOverlay from "./components/SummaryOverlay";
import OnboardingModal from "./components/OnboardingModal";

// Define Location interface here again
export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  countryCode: string;
}

const LOCATIONS_STORAGE_KEY = "map-my-flight-locations";
const ONBOARDING_KEY = "map-my-flight-onboarding-seen";

function App() {
  // Load initial locations from localStorage
  const [locations, setLocations] = useState<Location[]>(() => {
    const savedLocations = localStorage.getItem(LOCATIONS_STORAGE_KEY);
    try {
      return savedLocations ? JSON.parse(savedLocations) : [];
    } catch (e) {
      console.error("Failed to parse locations from localStorage", e);
      return [];
    }
  });
  const [isAnimating, setIsAnimating] = useState(false); // State for animation status
  const [totalDistance, setTotalDistance] = useState<number>(0);
  const [traveledDistance, setTraveledDistance] = useState<number>(0); // Distance traveled during animation
  const mapRef = useRef<L.Map | null>(null); // Create ref for the map

  // States for recording
  const [isRecording, setIsRecording] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [showSummaryOverlay, setShowSummaryOverlay] = useState(false); // State for overlay
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Show onboarding if the key is not found in localStorage
    return localStorage.getItem(ONBOARDING_KEY) !== "true";
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Calculate total distance whenever locations change
  useMemo(() => {
    let distance = 0;
    if (locations.length >= 2) {
      for (let i = 0; i < locations.length - 1; i++) {
        const point1 = L.latLng(locations[i].lat, locations[i].lng);
        const point2 = L.latLng(locations[i + 1].lat, locations[i + 1].lng);
        distance += point1.distanceTo(point2);
      }
    }
    setTotalDistance(distance / 1000); // Convert meters to kilometers
  }, [locations]);

  // Save locations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(locations));
  }, [locations]);

  // Function to add a new location
  const addLocation = (location: Location) => {
    setLocations((prevLocations) => [...prevLocations, location]);
    setIsAnimating(false); // Stop animation when locations change
    setTraveledDistance(0); // Reset traveled distance
  };

  // Function to remove a location by id
  const removeLocation = (id: string) => {
    setLocations((prevLocations) =>
      prevLocations.filter((location) => location.id !== id)
    );
    setIsAnimating(false); // Stop animation when locations change
    setTraveledDistance(0); // Reset traveled distance
  };

  // Start/Stop Animation Handlers
  const startAnimation = useCallback(() => {
    if (locations.length >= 2) {
      setTraveledDistance(0);
      setIsAnimating(true);
    }
  }, [locations.length]); // Dependency added

  const stopAnimation = useCallback(() => {
    setIsAnimating(false);
  }, []);

  // Moved stopRecordingHandler before handleAnimationEnd
  const stopRecordingHandler = useCallback(() => {
    console.log("Stopping recording process...");
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsAnimating(false);
    setIsRecording(false);
    setHideUI(false);
    setShowSummaryOverlay(false);

    // --- Restore Zoom Control ---
    if (mapRef.current && !mapRef.current.zoomControl) {
      mapRef.current.addControl(L.control.zoom({ position: "topleft" }));
      console.log("Zoom control restored");
    }
    // --- End Restore Zoom Control ---
  }, []);

  const handleAnimationEnd = useCallback(() => {
    // Fit bounds to show the whole path
    if (mapRef.current && locations.length >= 2) {
      const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
      mapRef.current.fitBounds(bounds, { animate: true, padding: [50, 50] });
    }

    // If recording, show summary and schedule stop
    if (mediaRecorderRef.current?.state === "recording" || isRecording) {
      setShowSummaryOverlay(true);
      console.log("Animation ended, showing summary overlay...");
      setTimeout(() => {
        console.log("Stopping recording after summary display.");
        stopRecordingHandler();
      }, 2000);
    } else if (hideUI) {
      // If in fullscreen mode (hideUI true but not recording), show summary
      setShowSummaryOverlay(true);
      console.log(
        "Animation ended in fullscreen mode, showing summary overlay..."
      );

      // In fullscreen mode, keep showing summary but don't exit automatically
      // User will exit using the floating button
    } else {
      // Normal panel animation ending
      setIsAnimating(false);
    }
  }, [locations, isRecording, stopRecordingHandler, hideUI]);

  // Function to update traveled distance during animation
  // This will be passed down to AnimatedPlane
  const updateTraveledDistance = useCallback(
    (distanceIncrement: number) => {
      setTraveledDistance((prev) => {
        const newTraveled = prev + distanceIncrement / 1000;
        // Ensure traveled distance doesn't exceed total distance due to potential precision issues
        return Math.min(newTraveled, totalDistance);
      });
    },
    [totalDistance]
  ); // Add totalDistance dependency

  // --- Recording Logic ---
  const startRecordingHandler = async () => {
    // Ensure there are enough locations and we have mapRef
    if (locations.length < 2 || !mapRef.current) {
      alert("Please add at least two locations before recording.");
      return;
    }

    // Check if running on iOS
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    if (isIOS) {
      alert(
        "Recording is not fully supported on iOS devices. This is a limitation of iOS WebKit. Consider using a desktop browser for better experience."
      );
    }

    try {
      // 1. Get Media Stream
      mediaStreamRef.current = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // @ts-ignore
          displaySurface: "browser",
          frameRate: 30,
          // @ts-ignore
          cursor: "never",
        },
        preferCurrentTab: true,
      });

      // --- Hide Zoom Control ---
      if (mapRef.current?.zoomControl) {
        mapRef.current.zoomControl.remove();
        console.log("Zoom control removed");
      }
      // --- End Hide Zoom Control ---

      // --- Resize preparation ---
      console.log("Hiding UI for resize...");
      setHideUI(true);
      // Brief pause to allow UI to hide and map to potentially resize
      await new Promise((resolve) => setTimeout(resolve, 100));
      // --- End resize preparation ---

      // 2. Fit bounds to the first segment
      console.log("Fitting bounds to first segment...");
      if (!mapRef.current) throw new Error("Map ref is not available"); // Add null check
      const startLatLng = L.latLng(locations[0].lat, locations[0].lng);
      const nextLatLng = L.latLng(locations[1].lat, locations[1].lng);
      const initialBounds = L.latLngBounds([startLatLng, nextLatLng]);
      mapRef.current.fitBounds(initialBounds, {
        animate: true,
        padding: [60, 60],
      });
      // Brief pause AFTER fitBounds to allow map animation/redraw
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 3. Wait before recording starts
      console.log("Waiting before recording starts...");
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Adjusted back from 2000 to keep total similar

      // 4. Setup and Start MediaRecorder
      setRecordedVideoUrl(null);
      recordedChunksRef.current = [];

      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error("MediaRecorder API is not supported in this browser");
      }

      mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, {
        mimeType: "video/webm;codecs=vp9",
      });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        // Clean up stream tracks
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        console.log("Recording stopped, URL created:", url);
      };
      mediaRecorderRef.current.start();
      console.log("MediaRecorder started.");

      // 5. Set Recording State and Start Animation (UI is already hidden)
      setIsRecording(true);
      startAnimation();
      console.log("Recording and animation started after delay");

      // Handle user stopping screen share
      mediaStreamRef.current.getVideoTracks()[0].onended = () => {
        console.log("Screen sharing stopped by user.");
        if (mediaRecorderRef.current?.state === "recording") {
          stopRecordingHandler();
        }
      };
    } catch (err) {
      console.error("Error starting recording:", err);
      // Clean up if something went wrong
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      // Restore zoom control on error
      if (mapRef.current && !mapRef.current.zoomControl) {
        mapRef.current.addControl(L.control.zoom({ position: "topleft" }));
      }
      setIsRecording(false);
      setHideUI(false);

      // Provide better error message based on the error
      if (isIOS) {
        alert(
          "Recording on iOS is limited. Please use Safari and ensure you've granted screen recording permissions in iOS system settings."
        );
      } else if (
        err instanceof DOMException &&
        err.name === "NotAllowedError"
      ) {
        alert(
          "Permission to record was denied. Please allow screen recording permission when prompted."
        );
      } else if (
        err instanceof DOMException &&
        err.name === "NotSupportedError"
      ) {
        alert(
          "Recording is not supported in this browser. Please try using Chrome, Edge, or Safari."
        );
      } else {
        alert(
          "Could not start recording. Please ensure you grant permission and are using a supported browser."
        );
      }
    }
  };

  // Exit fullscreen mode handler
  const exitFullscreenMode = useCallback(() => {
    // Restore UI
    setHideUI(false);
    setIsAnimating(false);
    setShowSummaryOverlay(false);

    // Restore zoom control
    if (mapRef.current && !mapRef.current.zoomControl) {
      mapRef.current.addControl(L.control.zoom({ position: "topleft" }));
      console.log("Zoom control restored after fullscreen exit");
    }

    // Find and remove the exit fullscreen button if it exists
    const exitButton = document.querySelector("button.exit-fullscreen-btn");
    if (exitButton && exitButton.parentElement) {
      exitButton.parentElement.removeChild(exitButton);
    }
  }, []);

  const startFullscreenViewHandler = async () => {
    // Ensure there are enough locations and we have mapRef
    if (locations.length < 2 || !mapRef.current) {
      alert("Please add at least two locations before viewing path.");
      return;
    }

    try {
      // --- Hide Zoom Control ---
      if (mapRef.current?.zoomControl) {
        mapRef.current.zoomControl.remove();
        console.log("Zoom control removed for fullscreen view");
      }
      // --- End Hide Zoom Control ---

      // --- Resize preparation ---
      console.log("Hiding UI for fullscreen view...");
      setHideUI(true);
      // Brief pause to allow UI to hide and map to potentially resize
      await new Promise((resolve) => setTimeout(resolve, 100));
      // --- End resize preparation ---

      // Fit bounds to the first segment
      console.log("Fitting bounds to first segment...");
      if (!mapRef.current) throw new Error("Map ref is not available");
      const startLatLng = L.latLng(locations[0].lat, locations[0].lng);
      const nextLatLng = L.latLng(locations[1].lat, locations[1].lng);
      const initialBounds = L.latLngBounds([startLatLng, nextLatLng]);
      mapRef.current.fitBounds(initialBounds, {
        animate: true,
        padding: [60, 60],
      });

      // Brief pause to allow map animations
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Start animation
      startAnimation();

      // Add a floating button to exit fullscreen mode
      const exitFullscreenButton = document.createElement("button");
      exitFullscreenButton.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
      exitFullscreenButton.className =
        "absolute top-4 right-4 z-[1000] bg-white text-black rounded-full p-3 shadow-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 exit-fullscreen-btn";
      exitFullscreenButton.style.position = "absolute";
      exitFullscreenButton.style.top = "10px";
      exitFullscreenButton.style.right = "10px";
      exitFullscreenButton.onclick = exitFullscreenMode;

      document.body.appendChild(exitFullscreenButton);
    } catch (err) {
      console.error("Error starting fullscreen view:", err);

      // Restore UI in case of an error
      setHideUI(false);

      // Restore zoom control on error
      if (mapRef.current && !mapRef.current.zoomControl) {
        mapRef.current.addControl(L.control.zoom({ position: "topleft" }));
      }
    }
  };

  // Function to close onboarding and mark as seen
  const handleCloseOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_KEY, "true");
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Onboarding Modal */}
      {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} />}

      {/* Map Area */}
      <div className="flex-grow h-3/5 md:h-full relative">
        {" "}
        {/* Added relative for Stop button positioning */}
        <MapComponent
          locations={locations}
          isAnimating={isAnimating}
          onAnimationEnd={handleAnimationEnd}
          onDistanceUpdate={updateTraveledDistance}
          mapRef={mapRef}
        />
        {/* Floating Stop Button */}
        {isRecording && (
          <button
            onClick={stopRecordingHandler}
            className="absolute top-4 right-4 z-[1000] bg-red-600 text-white rounded-full p-3 shadow-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            aria-label="Stop Recording"
          >
            {/* Simple Stop Icon (or use react-icons) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
              />
            </svg>
          </button>
        )}
        {/* Summary Overlay - Conditionally rendered */}
        {showSummaryOverlay && (
          <SummaryOverlay
            locations={locations}
            totalDistance={totalDistance}
            onInteraction={exitFullscreenMode}
            isFullscreenMode={hideUI}
          />
        )}
      </div>

      {/* Control Panel - Conditionally rendered */}
      {!hideUI && (
        <div className="w-full h-2/5 md:w-1/4 md:h-full bg-white dark:bg-gray-800 p-4 shadow-lg overflow-y-auto flex flex-col">
          <ControlPanel
            locations={locations}
            onAddLocation={addLocation}
            onRemoveLocation={removeLocation}
            onStartAnimation={startAnimation}
            onStopAnimation={stopAnimation}
            onStartRecording={startRecordingHandler} // Pass recording start function
            onStartFullscreenView={startFullscreenViewHandler} // Pass fullscreen view function
            isAnimating={isAnimating}
            isRecording={isRecording} // Pass recording status
            totalDistance={totalDistance}
            traveledDistance={traveledDistance}
            recordedVideoUrl={recordedVideoUrl} // Pass video URL
          />
        </div>
      )}
    </div>
  );
}

export default App;
