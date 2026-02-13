"use client";

import { useRef } from "react";
import { Camera } from "lucide-react";
import { motion } from "framer-motion";

interface CameraFabProps {
  onCapture: (file: File) => void;
}

export function CameraFab({ onCapture }: CameraFabProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg md:hidden"
        style={{ backgroundColor: "#2CA9E1" }}
        onClick={() => inputRef.current?.click()}
        aria-label="カメラで撮影"
      >
        <Camera className="h-6 w-6 text-white" />
      </motion.button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onCapture(file);
          }
          e.target.value = "";
          // Re-open for continuous capture
          setTimeout(() => inputRef.current?.click(), 500);
        }}
      />
    </>
  );
}
