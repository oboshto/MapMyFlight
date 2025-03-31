import React from "react";
import {
  FaTimes,
  FaMapMarkerAlt,
  FaVideo,
  FaPlaneDeparture,
  FaDownload,
} from "react-icons/fa";

interface OnboardingModalProps {
  onClose: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-70 p-4"
      onClick={onClose} // Close on overlay click
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 relative animate-fade-in"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          aria-label="Close onboarding"
        >
          <FaTimes size={20} />
        </button>

        <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-gray-100">
          Welcome to Map My Flight!
        </h2>

        <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
          Create stunning animations of your journeys across the globe and share
          them easily!
        </p>

        <div className="space-y-4 text-gray-700 dark:text-gray-200">
          <div className="flex items-start space-x-3">
            <FaMapMarkerAlt
              className="text-blue-500 mt-1 flex-shrink-0"
              size={18}
            />
            <span>
              <span className="font-semibold">Add Locations:</span> Use the
              search bar to find and add cities to your route.
            </span>
          </div>
          <div className="flex items-start space-x-3">
            <FaPlaneDeparture
              className="text-green-500 mt-1 flex-shrink-0"
              size={18}
            />
            <span>
              <span className="font-semibold">View Path:</span> Click "View
              Path" to see the animated plane fly between your selected
              locations.
            </span>
          </div>
          <div className="flex items-start space-x-3">
            <FaVideo className="text-purple-500 mt-1 flex-shrink-0" size={18} />
            <span>
              <span className="font-semibold">Record Video:</span> Click "Record
              Video" to capture the animation. Your browser will ask for screen
              sharing permission (choose the current tab for best results).
            </span>
          </div>
          <div className="flex items-start space-x-3">
            <FaDownload
              className="text-gray-500 mt-1 flex-shrink-0"
              size={18}
            />
            <span>
              <span className="font-semibold">Download:</span> After recording,
              a download link will appear. Save your video and share it!
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
        >
          Got it, Let's Travel!
        </button>
      </div>
    </div>
  );
};

export default OnboardingModal;
