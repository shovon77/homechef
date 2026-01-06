'use client';
import React, { createContext, useContext, useState } from 'react';

type LocationModalContextType = {
  showLocationModal: boolean;
  setShowLocationModal: (show: boolean) => void;
};

const LocationModalContext = createContext<LocationModalContextType>({
  showLocationModal: false,
  setShowLocationModal: () => {},
});

export function LocationModalProvider({ children }: { children: React.ReactNode }) {
  const [showLocationModal, setShowLocationModal] = useState(false);

  return (
    <LocationModalContext.Provider value={{ showLocationModal, setShowLocationModal }}>
      {children}
    </LocationModalContext.Provider>
  );
}

export function useLocationModal() {
  return useContext(LocationModalContext);
}

