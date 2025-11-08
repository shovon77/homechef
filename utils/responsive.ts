import { useWindowDimensions } from 'react-native';

// Breakpoints: Mobile < 768, Tablet 768-1024, Desktop > 1024
export function useResponsiveColumns() {
  const { width } = useWindowDimensions();
  
  // Mobile: < 768px
  // Tablet: 768px - 1024px
  // Desktop: > 1024px
  const getColumns = (preferredDesktop: number = 4) => {
    if (width < 768) {
      return 1; // Mobile: 1 column
    } else if (width < 1024) {
      return 2; // Tablet: 2 columns
    } else {
      return Math.min(preferredDesktop, 4); // Desktop: 3-4 columns
    }
  };

  return { width, getColumns };
}

