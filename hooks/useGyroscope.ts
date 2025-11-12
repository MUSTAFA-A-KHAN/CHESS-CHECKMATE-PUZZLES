import { useState, useEffect, useCallback } from 'react';

// Define the shape of the data returned by the hook
interface GyroData {
  alpha: number | null; // Z-axis rotation (yaw)
  beta: number | null;  // X-axis rotation (pitch/forward-backward tilt)
  gamma: number | null; // Y-axis rotation (roll/left-right tilt)
  isAvailable: boolean; // Flag to check if the sensor is supported
  isListening: boolean; // Flag to check if the listener is active
  error: string | null;
}

export const useGyroscope = () => {
  const [data, setData] = useState<GyroData>({
    alpha: null,
    beta: null,
    gamma: null,
    isAvailable: 'DeviceOrientationEvent' in window,
    isListening: false,
    error: null,
  });

  // Handler to process the orientation event and update state
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    setData(prev => ({
      ...prev,
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      error: null,
    }));
  }, []);

  // Function to request permission (necessary for iOS 13+ in Safari)
  const requestAccess = useCallback(async () => {
    if (data.isAvailable) {
      // Check if the permission API is available (iOS 13+)
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const state = await (DeviceOrientationEvent as any).requestPermission();
          if (state === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
            setData(prev => ({ ...prev, isListening: true, error: null }));
            return true;
          } else {
            setData(prev => ({ ...prev, error: 'Permission denied for motion sensors.' }));
            return false;
          }
        } catch (err: any) {
          setData(prev => ({ ...prev, error: `Error requesting permission: ${err.message}` }));
          return false;
        }
      } else {
        // Fallback for non-iOS devices or older browsers
        window.addEventListener('deviceorientation', handleOrientation);
        setData(prev => ({ ...prev, isListening: true, error: null }));
        return true;
      }
    } else {
      setData(prev => ({ ...prev, error: 'Device Orientation API is not supported.' }));
      return false;
    }
  }, [data.isAvailable, handleOrientation]);

  // Clean up the event listener when the component unmounts or stops listening
  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

  // Public function to stop listening, for example, when a move is confirmed
  const stopListening = useCallback(() => {
    window.removeEventListener('deviceorientation', handleOrientation);
    setData(prev => ({ ...prev, isListening: false }));
  }, [handleOrientation]);

  return { ...data, requestAccess, stopListening };
};